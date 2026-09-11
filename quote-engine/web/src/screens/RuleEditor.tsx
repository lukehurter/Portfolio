import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api, type Item, type Rule, type RuleAction, type RuleCondition, type RuleTrigger,
  type RuleType, type Severity, type ValidationResult,
} from '../api';
import { useApp, useAsync } from '../state/app';
import { ErrorNote, Field, Panel, Skeleton, Status, shortDate } from '../components/ui';
import { FIELD_LABEL } from '../engine/parseApplication';
import { DERIVED_FIELDS } from '../api/derivedFields';

/**
 * The rule editor.
 *
 * The requirement is that a regular person can add a rule without help. That
 * shapes every decision here: no JSON anywhere, every part number picked from
 * Orbit rather than typed, validation shown while editing rather than on save,
 * and plain-language explanations of what each rule type does.
 */

const RULE_TYPES: { value: RuleType; label: string; blurb: string }[] = [
  { value: 'requires',     label: 'Requires',        blurb: 'When something is quoted, these must be on the quote too.' },
  { value: 'excludes',     label: 'Excludes',        blurb: 'These must not appear together.' },
  { value: 'duplicate',    label: 'Duplicate',       blurb: 'Two items are really the same thing — warn before quoting both.' },
  { value: 'eligibility',  label: 'Eligibility',     blurb: 'Only allowed when a list of conditions all hold.' },
  { value: 'substitution', label: 'Substitution',    blurb: 'Offer an alternative, stating the trade-off.' },
  { value: 'applicationFit', label: 'Application fit', blurb: 'Grade the configuration against the line it will run on.' },
  { value: 'approval',     label: 'Approval',        blurb: 'Raise an approval request rather than blocking the rep.' },
  { value: 'discountCap',  label: 'Discount cap',    blurb: 'Limit the discount on an item below its category maximum.' },
  { value: 'note',         label: 'Note',            blurb: 'Show guidance. Does not change the quote.' },
];

const SEVERITIES: { value: Severity; label: string; blurb: string }[] = [
  { value: 'info',  label: 'Note',  blurb: 'Shown, but nothing to do.' },
  { value: 'warn',  label: 'Check', blurb: 'The rep should look before sending.' },
  { value: 'block', label: 'Block', blurb: 'The quote does not qualify until it is resolved.' },
];

const blank = (): Rule => ({
  ruleCode: '', technologyCode: null, ruleType: 'requires', summary: '', detail: '',
  sourceRef: '', author: '', severity: 'warn',
  effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: null, isActive: true,
  triggers: [{ triggerType: 'item' }], actions: [{ actionType: 'require', quantity: 1 }], conditions: [],
});

/**
 * Every field a rule may read, taken from the profile itself.
 *
 * This used to be six field names typed into the JSX, against 28 on
 * ApplicationProfile, and two of the six did not exist: `throwDistanceMm` and
 * `characterHeightMm`, where the real fields are `throwDistMm` and `charHeightMm`. A
 * rule authored on either was saved and never fired — `compare()` returns false for a
 * field that is not there — which is the exact failure this tool exists to prevent.
 *
 * The same list also made the shipped rule A-CIJ-CHR-6400 display its trigger field as
 * "Choose…", because charHeightMm was not among the six. The editor was calling a
 * working rule unconfigured.
 *
 * Deriving both from FIELD_LABEL means adding a field to the profile adds it here, and
 * a name that does not exist cannot be offered. ruleEditor.test.ts asserts that every
 * profileField in the shipped rules is selectable.
 */
const PROFILE_FIELDS: [string, string][] = Object.entries({
  ...FIELD_LABEL,
  // Computed by the engines rather than asked for — see DERIVED_FIELDS. An author
  // has to be able to pick these or the rules that use them read as unconfigured.
  ...DERIVED_FIELDS,
})
  // `notes` is free text for a person to read, not something to compare against.
  .filter(([field]) => field !== 'notes')
  .map(([field, label]): [string, string] => [field, `${label} — ${field}`])
  .sort((a, b) => a[1].localeCompare(b[1]));

/**
 * Every comparator the engines implement, in the words a rule author would use.
 *
 * "one of" used to be the label on `includes`, which is substring matching — so a rule
 * meant to accept a list quietly matched any text containing the value. `in` is the
 * membership test and was not offered at all, and neither was `includesAny`, which
 * every one of the nine technology-fit rules uses.
 */
const COMPARATORS: [NonNullable<RuleTrigger['compareOp']>, string][] = [
  ['eq', 'equal to'],
  ['ne', 'not equal to'],
  ['gt', 'greater than'],
  ['gte', 'at least'],
  ['lt', 'less than'],
  ['lte', 'at most'],
  ['includes', 'contains the text'],
  ['includesAny', 'contains any of these (comma separated)'],
  ['in', 'one of these exactly (comma separated)'],
];

export function RuleEditor({ ruleCode }: { ruleCode: string | null }) {
  const { go, notify, session } = useApp();
  /* Everyone can read a rule; only an admin can change one. A rep who cannot
     reach the rule behind a recommendation cannot defend the quote they are
     sending — but reading it is the whole of what they need. */
  const canEdit = session?.role === 'admin';
  const isNew = ruleCode === null;

  const loaded = useAsync(async () => (isNew ? blank() : api.getRule(ruleCode!)), [ruleCode]);
  const techs = useAsync(() => api.listTechnologies(), []);
  const audit = useAsync(async () => (isNew ? [] : api.getRuleAudit(ruleCode!)), [ruleCode]);

  const [rule, setRule] = useState<Rule | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (loaded.data) setRule(structuredClone(loaded.data)); }, [loaded.data]);

  /* A new rule opens with the next free code in the box.
     Asked for, and it is also the cheapest way to stop collisions happening at all:
     the commonest way to reuse a code is to type one from memory. Only for a new
     rule, and only into an empty box, so it never overwrites what somebody typed. */
  useEffect(() => {
    if (!isNew) return;
    let alive = true;
    void api.nextRuleCode('R-').then((code) => {
      if (alive) setRule((r) => (r && !r.ruleCode ? { ...r, ruleCode: code } : r));
    });
    return () => { alive = false; };
  }, [isNew]);

  // Validate as they type, not when they press save.
  useEffect(() => {
    if (!rule) return;
    let alive = true;
    const t = window.setTimeout(() => {
      void api.validateRule(rule, { isNew }).then((v) => { if (alive) setValidation(v); });
    }, 220);
    return () => { alive = false; window.clearTimeout(t); };
  }, [rule]);

  const patch = useCallback((p: Partial<Rule>) => {
    setRule((r) => (r ? { ...r, ...p } : r));
    setDirty(true);
  }, []);

  const errorFor = useCallback(
    (field: string) => validation?.issues.find((i) => i.level === 'error' && i.field === field)?.message,
    [validation],
  );

  const typeInfo = useMemo(
    () => RULE_TYPES.find((t) => t.value === rule?.ruleType),
    [rule?.ruleType],
  );

  if (loaded.loading) return <Panel title="Rule"><Skeleton rows={7} /></Panel>;
  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />;
  if (!rule) return null;

  const errors = validation?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = validation?.issues.filter((i) => i.level === 'warning') ?? [];
  const canSave = canEdit && dirty && errors.length === 0 && !saving;

  async function save() {
    if (!rule) return;
    setSaving(true);
    try {
      await api.saveRule(rule, { isNew });
      notify(`${rule.ruleCode} saved. It applies to the next quote.`);
      setDirty(false);
      go({ name: 'rules' });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/*
        The band carries whether this rule can be saved.

        "Before you save" was a panel sixth of seven down the page, so fixing an
        error meant scrolling down to read it, up to change the field, and down again
        to see whether it had cleared. The counts and the Save action belong together
        and belong in view; the messages themselves stay in the panel, because a
        count tells you whether you can save and only the sentence tells you why not.
      */}
      <div style={{ top: 'var(--chrome-h, 3.25rem)' }}
           className="fascia sticky z-dropdown -mx-4 -mt-4 border-b-2 border-instr-400 bg-navy-900 px-4 py-2 text-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="btn-quiet text-xs" onClick={() => go({ name: 'rules' })}>
              ← All rules
            </button>
            <h1 className="h-display truncate text-base text-white">
              {isNew ? 'New rule' : rule.ruleCode}
            </h1>
            {!isNew && <Status inline tone={rule.isActive ? 'ok' : 'muted'}>{rule.isActive ? 'Active' : 'Retired'}</Status>}
          </div>
          {canEdit ? (
            <button type="button" className="btn-primary text-sm" disabled={!canSave}
                    onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save rule'}
            </button>
          ) : (
            <span className="rounded border border-navy-600 px-2 py-1 text-2xs font-semibold text-navy-100">
              Read only — an administrator edits rules
            </span>
          )}
        </div>

        <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t border-navy-700 pt-2">
          <div className="flex items-baseline gap-2">
            <dt className="text-2xs font-semibold uppercase tracking-wider text-navy-300">Must fix</dt>
            <dd className={errors.length
              ? 'num text-base font-medium leading-none text-fascia-alert'
              : 'num text-base font-medium leading-none text-fascia-fit'}>
              {errors.length}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-2xs font-semibold uppercase tracking-wider text-navy-300">
              Worth checking
            </dt>
            <dd className={warnings.length
              ? 'num text-xs text-fascia-signal' : 'num text-xs text-white'}>
              {warnings.length}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-2xs font-semibold uppercase tracking-wider text-navy-300">State</dt>
            <dd className="text-xs font-semibold">
              {dirty
                ? <span className="text-fascia-signal">unsaved changes</span>
                : <span className="text-navy-100">no changes</span>}
            </dd>
          </div>
        </dl>
      </div>

      {/* One fieldset rather than a disabled prop on forty controls: the browser
          disables everything inside it, so a control added later is read-only for a
          reader without anybody remembering to say so. */}
      <fieldset disabled={!canEdit}
                className="grid gap-3 border-0 p-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <Panel title="What the rule says">
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Rule code" required error={errorFor('ruleCode')}
                     hint="Shown on the quote next to whatever this rule caused.">
                <input className="field num text-sm" value={rule.ruleCode} disabled={!isNew}
                       placeholder="R-114"
                       onChange={(e) => patch({ ruleCode: e.target.value.toUpperCase() })} />
                {/* The convention, where it is needed, rather than in a document
                    nobody opens while typing. Asked for: "there's not a guide for
                    naming the rules in a meaningful way like you've done for
                    everything." The families below are the ones already in use — this
                    describes the set, it does not invent one. */}
                {isNew && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-2xs text-instr-800">
                      How these are named
                    </summary>
                    <dl className="mt-1 space-y-1 border-l-2 border-rule pl-2.5 text-2xs text-steel-700">
                      <div>
                        <dt className="num font-semibold text-steel-900">R-091</dt>
                        <dd>Commercial policy recovered from a price-page cell comment.
                          Numbered, because the source is a spreadsheet cell and the
                          number is all it had. Counting up is the default here.</dd>
                      </div>
                      <div>
                        <dt className="num font-semibold text-steel-900">A-CIJ-SPD-6400</dt>
                        <dd>Application fit from a datasheet:
                          <span className="num"> A-</span> then the technology, what it
                          constrains, and the model. Named rather than numbered, because
                          a rep reading a trace should be able to guess what fired.</dd>
                      </div>
                      <div>
                        <dt className="num font-semibold text-steel-900">Q-BARE-MOUNT</dt>
                        <dd>Quote completeness — something the quote is missing.
                          <span className="num"> Q-BARE-</span> then what is absent.</dd>
                      </div>
                    </dl>
                    <p className="mt-1 text-2xs text-steel-600">
                      Capitals, hyphens, no spaces. Say what it is about, not what it
                      does: a rule renamed when its threshold changes is a rule nobody
                      can find in the audit trail.
                    </p>
                  </details>
                )}
              </Field>

              <Field label="Technology" hint="Leave as all if it applies everywhere.">
                <select className="field text-sm" value={rule.technologyCode ?? ''}
                        onChange={(e) => patch({ technologyCode: e.target.value || null })}>
                  <option value="">All technologies</option>
                  {(techs.data ?? []).map((t) => (
                    <option key={t.code} value={t.code}>{t.code} — {t.name}</option>
                  ))}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Summary" required error={errorFor('summary')}
                       hint="One line, as the rep will read it on the quote.">
                  <input className="field text-sm" value={rule.summary}
                         placeholder="Tool-less handscrews require 1 photocell bracket and 2 cross joints."
                         onChange={(e) => patch({ summary: e.target.value })} />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Original wording"
                       hint="The words as they were written in the price page, kept verbatim. The rep can expand to see this, which is what makes the rule trustworthy.">
                  <textarea className="field text-sm" rows={2} value={rule.detail ?? ''}
                            placeholder="If replacing screws with tool-less handscrews, order (1) PH and (2) Cross Joints"
                            onChange={(e) => patch({ detail: e.target.value })} />
                </Field>
              </div>

              <Field label="Where it came from"
                     hint="A workbook and cell, or whoever decided it.">
                <input className="field text-sm" value={rule.sourceRef ?? ''}
                       placeholder="CIJ workbook, 3. Pick your accessories, D49/D50"
                       onChange={(e) => patch({ sourceRef: e.target.value })} />
              </Field>

              <Field label="Author" hint="Who wrote the rule.">
                <input className="field text-sm" value={rule.author ?? ''} placeholder="price page comment"
                       onChange={(e) => patch({ author: e.target.value })} />
              </Field>
            </div>
          </Panel>

          <Panel title="What kind of rule it is">
            <div className="space-y-4 p-4">
              <p className="label">Rule type</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {RULE_TYPES.map((t) => {
                  const on = rule.ruleType === t.value;
                  return (
                    <button key={t.value} type="button" aria-pressed={on}
                            onClick={() => patch({ ruleType: t.value })}
                            className={`rounded-[2px] border px-3 py-2 text-left transition-colors ${
                              on ? 'border-instr-500 bg-instr-100' : 'border-steel-200 bg-surface hover:border-steel-400'}`}>
                      <span className={`block text-xs font-semibold ${on ? 'text-instr-800' : 'text-steel-800'}`}>
                        {t.label}
                      </span>
                      <span className="mt-0.5 block text-2xs leading-snug text-steel-600">{t.blurb}</span>
                    </button>
                  );
                })}
              </div>

              <p className="label border-t border-rule pt-4">How strongly it applies</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {SEVERITIES.map((s) => {
                  const on = rule.severity === s.value;
                  return (
                    <button key={s.value} type="button" aria-pressed={on}
                            onClick={() => patch({ severity: s.value })}
                            className={`rounded-[2px] border px-3 py-2 text-left transition-colors ${
                              on ? 'border-instr-500 bg-instr-100' : 'border-steel-200 bg-surface hover:border-steel-400'}`}>
                      <span className={`block text-xs font-semibold ${on ? 'text-instr-800' : 'text-steel-800'}`}>
                        {s.label}
                      </span>
                      <span className="mt-0.5 block text-2xs text-steel-600">{s.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>

          <TriggerEditor rule={rule} patch={patch} errorFor={errorFor} typeBlurb={typeInfo?.blurb} />
          <ActionEditor rule={rule} patch={patch} errorFor={errorFor} />
          {rule.ruleType === 'eligibility' && <ConditionEditor rule={rule} patch={patch} />}

          <Panel title="When it applies">
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              <Field label="Starts" required>
                <input type="date" className="field num text-sm" value={rule.effectiveFrom}
                       onChange={(e) => patch({ effectiveFrom: e.target.value })} />
              </Field>
              <Field label="Ends" error={errorFor('effectiveTo')}
                     hint="Leave blank for no end.">
                <input type="date" className="field num text-sm" value={rule.effectiveTo ?? ''}
                       onChange={(e) => patch({ effectiveTo: e.target.value || null })} />
              </Field>
              <Field label="Status" hint="Retiring a rule keeps it in the history of quotes it already touched.">
                <select className="field text-sm" value={rule.isActive ? 'active' : 'retired'}
                        onChange={(e) => patch({ isActive: e.target.value === 'active' })}>
                  <option value="active">Active</option>
                  <option value="retired">Retired</option>
                </select>
              </Field>
            </div>
          </Panel>
        </div>

        {/* right column: validation and history */}
        <div style={{ top: 'calc(var(--chrome-h, 3.25rem) + 5.5rem)' }}
             className="space-y-3 xl:sticky xl:self-start">
          <Panel title="Before you save"
                 aside={<span className="text-2xs text-steel-600">checked as you type</span>}>
            <div className="space-y-2 p-3">
              {errors.length === 0 && warnings.length === 0 && (
                <p className="rounded border border-fit-200 bg-fit-100 px-3 py-2 text-xs text-fit-800">
                  This rule is complete and will fire. Nothing outstanding.
                </p>
              )}
              {errors.map((i) => (
                <p key={i.field + i.message}
                   className="rounded border border-alert-200 bg-alert-100 px-3 py-2 text-xs text-alert-800">
                  <span className="font-semibold">Must fix — </span>{i.message}
                </p>
              ))}
              {warnings.map((i) => (
                <p key={i.field + i.message}
                   className="rounded border border-signal-200 bg-signal-100 px-3 py-2 text-xs text-signal-800">
                  <span className="font-semibold">Worth checking — </span>{i.message}
                </p>
              ))}
            </div>
          </Panel>

          {!isNew && (
            <Panel title="History">
              {audit.loading && <Skeleton rows={3} />}
              {audit.data && audit.data.length === 0 && (
                <p className="px-4 py-5 text-center text-xs text-steel-600">No changes recorded yet.</p>
              )}
              {audit.data && audit.data.length > 0 && (
                <ul className="divide-y divide-steel-100">
                  {audit.data.map((a) => (
                    <li key={a.auditId} className="px-4 py-2.5">
                      <p className="text-xs text-steel-800">{a.summary}</p>
                      <p className="mt-0.5 text-2xs text-steel-600">
                        {a.changedBy} · {shortDate(a.changedAt)} · {a.action}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </fieldset>
    </div>
  );
}

/* ---------------------------------------------------------------- triggers */

function TriggerEditor({ rule, patch, errorFor, typeBlurb }: {
  rule: Rule; patch: (p: Partial<Rule>) => void;
  errorFor: (f: string) => string | undefined; typeBlurb?: string;
}) {
  const set = (i: number, t: Partial<RuleTrigger>) =>
    patch({ triggers: rule.triggers.map((x, k) => (k === i ? { ...x, ...t } : x)) });

  /* Offered from the catalogue, for the same reason the profile fields are: a value
     that does not exist is a rule that never fires and looks configured. Scoped to
     the rule's own technology where it has one — a laser rule has no use for Ribbon. */
  const cats = useAsync(
    () => api.listCategories(rule.technologyCode ?? ''),
    [rule.technologyCode]);
  const categories = (cats.data ?? []).map((c) => c.category);

  return (
    <Panel title="When does it fire?"
           aside={<span className="text-2xs text-steel-600">{typeBlurb}</span>}>
      <div className="space-y-2 p-4">
        {rule.triggers.map((t, i) => (
          <div key={i} className="border border-steel-200 bg-steel-50 p-3">
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
              <Field label="Fires on">
                <select className="field text-sm" value={t.triggerType}
                        onChange={(e) => set(i, { triggerType: e.target.value as RuleTrigger['triggerType'] })}>
                  <option value="item">A specific part</option>
                  <option value="role">Any part of a kind</option>
                  <option value="itemCategory">A category of part</option>
                  <option value="model">A machine model</option>
                  <option value="attribute">A product attribute</option>
                  <option value="profile">The application profile</option>
                  <option value="total">The order total</option>
                  <option value="category">A Orbit product category</option>
                  <option value="always">Every quote</option>
                </select>
              </Field>

              {t.triggerType === 'item' && (
                <ItemPicker label="Part number" value={t.itemNo ?? ''} error={errorFor(`triggers.${i}.itemNo`)}
                            onChange={(v) => set(i, { itemNo: v })} />
              )}
              {t.triggerType === 'role' && (
                <Field label="Kind of part">
                  <select className="field text-sm" value={t.itemRole ?? ''} onChange={(e) => set(i, { itemRole: e.target.value })}>
                    <option value="">Choose…</option>
                    {['printer','printhead','ink','consumable','accessory','spare','service','warranty','promo']
                      .map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              )}
              {t.triggerType === 'category' && (
                <Field label="Orbit product category" hint="The code as it appears in Orbit.">
                  <input className="field num text-sm" value={t.prodCat ?? ''} placeholder="P47"
                         onChange={(e) => set(i, { prodCat: e.target.value.toUpperCase() })} />
                </Field>
              )}
              {t.triggerType === 'attribute' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Attribute">
                    <input className="field text-sm" value={t.attrName ?? ''} placeholder="Printer Type"
                           onChange={(e) => set(i, { attrName: e.target.value })} />
                  </Field>
                  <Field label="Equals">
                    <input className="field text-sm" value={t.attrValue ?? ''} placeholder="6420 Dye Based"
                           onChange={(e) => set(i, { attrValue: e.target.value })} />
                  </Field>
                </div>
              )}
              {t.triggerType === 'profile' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Field">
                    <select className="field text-sm" value={t.profileField ?? ''}
                            onChange={(e) => set(i, { profileField: e.target.value })}>
                      <option value="">Choose…</option>
                      {PROFILE_FIELDS.map(([field, label]) => (
                        <option key={field} value={field}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Is">
                    <select className="field text-sm" value={t.compareOp ?? 'eq'}
                            onChange={(e) => set(i, { compareOp: e.target.value as RuleTrigger['compareOp'] })}>
                      {COMPARATORS.map(([op, label]) => (
                        <option key={op} value={op}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Value">
                    <input className="field text-sm" value={t.compareValue ?? ''}
                           onChange={(e) => set(i, { compareValue: e.target.value })} />
                  </Field>
                </div>
              )}
              {/* Model and order total were in both engines and in the shipped rules
                  and neither had a control here, so a rule keyed to either opened
                  showing the first option in the list and no field at all. REPORTED
                  as "a lot of rules you set up where that field isn't even there".
                  Twenty-nine shipped rules trigger on a model. */}
              {t.triggerType === 'model' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Model is">
                    <select className="field text-sm" value={t.compareOp ?? 'eq'}
                            onChange={(e) => set(i, { compareOp: e.target.value as RuleTrigger['compareOp'] })}>
                      {COMPARATORS.map(([op, label]) => (
                        <option key={op} value={op}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Value" hint="6440, T400 Series, CSL60 — as the hierarchy names it.">
                    <input className="field text-sm" value={t.compareValue ?? ''} placeholder="6440"
                           onChange={(e) => set(i, { compareValue: e.target.value })} />
                  </Field>
                </div>
              )}
              {t.triggerType === 'itemCategory' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Category is">
                    <select className="field text-sm" value={t.compareOp ?? 'eq'}
                            onChange={(e) => set(i, { compareOp: e.target.value as RuleTrigger['compareOp'] })}>
                      {COMPARATORS.map(([op, label]) => (
                        <option key={op} value={op}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Value"
                         hint="What the classification calls this kind of part.">
                    {/* Offered from the catalogue rather than typed. A category that
                        does not exist is a rule that never fires, which is the exact
                        failure the profile-field list was rebuilt to prevent. */}
                    <input className="field text-sm" list="rule-categories"
                           value={t.compareValue ?? ''} placeholder="Tamp Pad"
                           onChange={(e) => set(i, { compareValue: e.target.value })} />
                    <datalist id="rule-categories">
                      {categories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>
                </div>
              )}
              {t.triggerType === 'total' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Order total is">
                    <select className="field text-sm" value={t.compareOp ?? 'gte'}
                            onChange={(e) => set(i, { compareOp: e.target.value as RuleTrigger['compareOp'] })}>
                      {COMPARATORS.map(([op, label]) => (
                        <option key={op} value={op}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount, dollars"
                         error={errorFor(`triggers.${i}.compareValue`)}>
                    <input className="field num text-sm" inputMode="decimal"
                           value={t.compareValue ?? ''} placeholder="50000"
                           onChange={(e) => set(i, { compareValue: e.target.value })} />
                  </Field>
                </div>
              )}
              {t.triggerType === 'always' && (
                <p className="self-end pb-2 text-xs text-steel-600">
                  Evaluated on every quote for the chosen technology.
                </p>
              )}

              <div className="flex items-end">
                <button type="button" className="btn-danger text-xs"
                        disabled={rule.triggers.length === 1}
                        onClick={() => patch({ triggers: rule.triggers.filter((_, k) => k !== i) })}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}

        {rule.triggers.length > 1 && (
          <p className="text-2xs text-steel-600">All of the above must be true for the rule to fire.</p>
        )}
        {errorFor('triggers') && (
          <p className="rounded border border-alert-200 bg-alert-100 px-3 py-2 text-xs text-alert-800">
            {errorFor('triggers')}
          </p>
        )}
        <button type="button" className="btn-quiet text-xs"
                onClick={() => patch({ triggers: [...rule.triggers, { triggerType: 'item' }] })}>
          Add another condition
        </button>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------------- actions */

function ActionEditor({ rule, patch, errorFor }: {
  rule: Rule; patch: (p: Partial<Rule>) => void; errorFor: (f: string) => string | undefined;
}) {
  const set = (i: number, a: Partial<RuleAction>) =>
    patch({ actions: rule.actions.map((x, k) => (k === i ? { ...x, ...a } : x)) });

  return (
    <Panel title="What should happen?">
      <div className="space-y-2 p-4">
        {rule.actions.map((a, i) => (
          <div key={i} className="border border-steel-200 bg-steel-50 p-3">
            <div className="grid gap-3 sm:grid-cols-[11rem_1fr_auto]">
              <Field label="Then">
                <select className="field text-sm" value={a.actionType}
                        onChange={(e) => set(i, { actionType: e.target.value as RuleAction['actionType'] })}>
                  <option value="require">Require this part</option>
                  <option value="requireOneOf">Require one of these</option>
                  <option value="exclude">Do not allow together</option>
                  <option value="warn">Show a warning</option>
                  <option value="substitute">Offer an alternative</option>
                  <option value="cap">Cap the discount</option>
                  <option value="approve">Ask for approval</option>
                  <option value="grade">Grade the fit</option>
                  <option value="allowance">Give an allowance</option>
                </select>
              </Field>

              <div className="grid gap-3">
                {['require', 'requireOneOf', 'exclude', 'substitute', 'cap'].includes(a.actionType) && (
                  <ItemPicker label="Part number" value={a.itemNo ?? ''} error={errorFor(`actions.${i}.itemNo`)}
                              onChange={(v) => set(i, { itemNo: v })} />
                )}
                {['require', 'requireOneOf'].includes(a.actionType) && (
                  <Field label="How many">
                    <input type="number" min={1} step={1} className="field num w-28 text-sm"
                           value={a.quantity ?? 1}
                           onChange={(e) => set(i, { quantity: Number(e.target.value) })} />
                  </Field>
                )}
                {a.actionType === 'cap' && (
                  <Field label="Maximum discount" error={errorFor(`actions.${i}.maxDiscount`)}
                         hint="The rep can go no lower than this on the part, whatever the category allows.">
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} step={1} className="field num w-24 text-sm"
                             value={a.maxDiscount != null ? Math.round(a.maxDiscount * 100) : ''}
                             onChange={(e) => set(i, { maxDiscount: Number(e.target.value) / 100 })} />
                      <span className="text-sm text-steel-600">%</span>
                    </div>
                  </Field>
                )}
                {a.actionType === 'approve' && (
                  <Field label="Who approves"
                         hint="Left as a role. The person is resolved per rep from Microsoft 365, or an admin override.">
                    <input className="field text-sm" value={a.approverRole ?? ''} placeholder="Regional Sales Manager"
                           onChange={(e) => set(i, { approverRole: e.target.value })} />
                  </Field>
                )}
                {a.actionType === 'grade' && (
                  <Field label="Grade">
                    <select className="field text-sm" value={a.fitGrade ?? 'caveat'}
                            onChange={(e) => set(i, { fitGrade: e.target.value as RuleAction['fitGrade'] })}>
                      <option value="good">Good fit</option>
                      <option value="caveat">Works with caveats</option>
                      <option value="notRecommended">Not recommended</option>
                    </select>
                  </Field>
                )}
                {a.actionType === 'allowance' && (
                  <Field label="Amount">
                    <input type="number" min={0} step={50} className="field num w-32 text-sm"
                           value={a.allowanceAmt ?? 0}
                           onChange={(e) => set(i, { allowanceAmt: Number(e.target.value) })} />
                  </Field>
                )}
                <Field label="Message to the rep"
                       hint="Appears on the quote when the rule fires.">
                  <input className="field text-sm" value={a.message ?? ''}
                         placeholder="Tool-less handscrews are on the quote. They need their mounting hardware."
                         onChange={(e) => set(i, { message: e.target.value })} />
                </Field>
              </div>

              <div className="flex items-end">
                <button type="button" className="btn-danger text-xs"
                        onClick={() => patch({ actions: rule.actions.filter((_, k) => k !== i) })}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        {errorFor('actions') && (
          <p className="rounded border border-alert-200 bg-alert-100 px-3 py-2 text-xs text-alert-800">
            {errorFor('actions')}
          </p>
        )}
        <button type="button" className="btn-quiet text-xs"
                onClick={() => patch({ actions: [...rule.actions, { actionType: 'require', quantity: 1 }] })}>
          Add another outcome
        </button>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------- conditions */

function ConditionEditor({ rule, patch }: { rule: Rule; patch: (p: Partial<Rule>) => void }) {
  const set = (i: number, c: Partial<RuleCondition>) =>
    patch({ conditions: rule.conditions.map((x, k) => (k === i ? { ...x, ...c } : x)) });

  return (
    <Panel title="Conditions that must all hold"
           aside={<span className="text-2xs text-steel-600">shown to the rep one by one, with pass or fail</span>}>
      <div className="space-y-2 p-4">
        {rule.conditions.length === 0 && (
          <p className="rounded border border-steel-200 bg-steel-50 px-3 py-2 text-xs text-steel-700">
            No conditions yet. An eligibility rule lists each requirement separately so a rep can see
            exactly which one is missing, rather than being told no.
          </p>
        )}
        {rule.conditions.map((c, i) => (
          <div key={i} className="border border-steel-200 bg-steel-50 p-3">
            <div className="grid gap-3 sm:grid-cols-[2rem_1fr_10rem_auto] sm:items-end">
              <span className="num pb-2 text-sm font-semibold text-steel-600">{i + 1}</span>
              <Field label="What the rep sees">
                <input className="field text-sm" value={c.label} placeholder="Quoted with an 6420 printer"
                       onChange={(e) => set(i, { label: e.target.value })} />
              </Field>
              <Field label="Checked against">
                <select className="field text-sm" value={c.conditionKind}
                        onChange={(e) => set(i, { conditionKind: e.target.value as RuleCondition['conditionKind'] })}>
                  <option value="attribute">A product attribute</option>
                  <option value="item">A part on the quote</option>
                  <option value="flag">A deal condition</option>
                  <option value="term">A commercial term</option>
                </select>
              </Field>
              <button type="button" className="btn-danger mb-0.5 text-xs"
                      onClick={() => patch({ conditions: rule.conditions.filter((_, k) => k !== i)
                        .map((x, k) => ({ ...x, seq: k + 1 })) })}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn-quiet text-xs"
                onClick={() => patch({ conditions: [...rule.conditions, {
                  seq: rule.conditions.length + 1, label: '', conditionKind: 'flag' }] })}>
          Add a condition
        </button>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------- item picker */

/** Parts are chosen from Orbit, never typed from memory. */
function ItemPicker({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  const [q, setQ] = useState(value);
  const [results, setResults] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQ(value); }, [value]);
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      void api.searchItems({ q, limit: 8 }).then((r) => { if (alive) setResults(r); });
    }, 160);
    return () => { alive = false; window.clearTimeout(t); };
  }, [q]);

  const chosen = results.find((r) => r.itemNo === value);

  return (
    <div className="relative">
      <Field label={label} error={error}
             hint={chosen ? chosen.description : 'Start typing a part number or description.'}>
        <input
          className="field num text-sm"
          value={q}
          placeholder="E608A393YRJ"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        />
      </Field>
      {open && results.length > 0 && (
        <ul className="absolute z-drawer mt-1 max-h-64 w-full overflow-auto rounded-md border border-steel-300 bg-surface shadow-lift">
          {results.map((r) => (
            <li key={r.itemNo}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-instr-100"
                onMouseDown={() => { onChange(r.itemNo); setQ(r.itemNo); setOpen(false); }}
              >
                <span className="num text-xs font-semibold text-steel-900">{r.itemNo}</span>
                <span className="text-2xs text-steel-600">{r.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
