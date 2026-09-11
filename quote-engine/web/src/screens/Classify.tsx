import { useMemo, useState } from 'react';
import {
  ALL_TECHNOLOGIES, api, ITEM_ROLES,
  type ClassifiedItem, type ClassifyStatus, type ItemClassification,
} from '../api';
import { ITEM_ROLE_PLURAL, ITEM_ROLE_WORD } from '../api/words';
import { useApp, useAsync } from '../state/app';
import { ErrorNote, Panel, Reading, Segmented, Skeleton, Status, Toolbar, money } from '../components/ui';

/**
 * Classification: one list of everything.
 *
 * An item has a technology and a type. Those two answers decide which price book it
 * appears in and which part of the quote builder offers it, and there is nothing else
 * to a classification — so there is one screen, showing every item, with filters to
 * reach the part of it you want.
 *
 * This replaced two screens: a worklist of gaps and a separate 43-row product-line
 * taxonomy. The line map still exists and still does the bulk work — it is how 18,822
 * parts get their first answer without anybody typing — but it is a derivation, not a
 * second thing to maintain by hand. Changing an item here writes an override, which
 * beats every other source.
 *
 * ALL is a technology an item can have, and means every book. Promotions, service
 * offerings and training are sold alongside whatever the customer is buying; filing
 * them under one technology made them invisible in the other six.
 */

const STATUS_LABEL: Record<ClassifyStatus, string> = {
  classified: 'Classified',
  needsTechnology: 'No technology',
  needsType: 'No type',
  /* Short enough to sit on one line in a table cell. The long form is the filter
     label, where there is room for it. */
  unearned: 'No model named',
  redundantOverride: 'Override adds nothing',
};

/** The status filters, shared by the phone select and the desk segmented control. */
const STATUS_FILTERS = (
  counts: Record<string, number>, undecided: number,
): { value: ClassifyStatus | 'all'; label: string; count: number }[] => [
  { value: 'all', label: 'Everything', count: (counts.classified ?? 0) + undecided },
  { value: 'classified', label: 'Classified', count: counts.classified ?? 0 },
  { value: 'unearned', label: 'No model named', count: counts.unearned ?? 0 },
  { value: 'needsTechnology', label: 'No technology', count: counts.needsTechnology ?? 0 },
  { value: 'needsType', label: 'No type', count: counts.needsType ?? 0 },
  ...(counts.redundantOverride
    ? [{ value: 'redundantOverride' as const, label: 'Override adds nothing',
         count: counts.redundantOverride }]
    : []),
];

const STATUS_TONE: Record<ClassifyStatus, string> = {
  classified: 'ok', needsTechnology: 'block', needsType: 'block', unearned: 'warn',
  redundantOverride: 'info',
};

export function Classify() {
  const { notify, session } = useApp();
  /* Readable by everyone, editable by an admin. A rep looking at a machine list
     with a part missing from it needs to see how that part is classified; only
     an admin gets to change the answer. */
  const canEdit = session?.role === 'admin';
  const [status, setStatus] = useState<ClassifyStatus | 'all'>('all');
  const [tech, setTech] = useState('');
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);
  const [edits, setEdits] = useState<Record<string, Partial<ItemClassification>>>({});
  const [saving, setSaving] = useState(false);

  const techs = useAsync(() => api.listTechnologies(), []);
  const work = useAsync(
    () => api.listClassification({
      status, q, limit,
      technology: tech || undefined,
      role: kind || undefined,
      category: category || undefined,
    }),
    [status, q, limit, tech, kind, category],
  );

  const rows: ClassifiedItem[] = work.data?.items ?? [];
  const counts = work.data?.counts ?? {};
  /* The categories, for the per-row picker and for the manage panel below. Not
     scoped by technology: a rep filing a part is often changing its technology in the
     same breath, and a list that shifts under them as they do is worse than a long
     one. */
  const cats = useAsync(() => api.listCategories(''), []);
  /* The types, from the API rather than the shipped constant — they are editable now
     and every screen has to read the live list or the pickers drift from the truth. */
  const roles = useAsync(() => api.listItemRoles(), []);
  /** Just the names, for the two per-row pickers. */
  const roleNames = (roles.data ?? []).map((r) => r.name);
  const [newCategory, setNewCategory] = useState('');
  const [busyCat, setBusyCat] = useState(false);
  const categories = cats.data ?? [];

  const undecided = (counts.needsTechnology ?? 0) + (counts.needsType ?? 0) + (counts.unearned ?? 0);

  /* An edit is a difference from what was loaded, not the fact that a control was
     touched. Setting a value and setting it straight back used to leave the row marked
     as changed and the Save button offering to write it. */
  const original = useMemo(() => {
    const m = new Map<string, {
      technologyCode: string | null; itemRole: string; category: string;
    }>();
    for (const r of rows) {
      m.set(r.itemNo, {
        technologyCode: r.technologyCode ?? null, itemRole: r.itemRole ?? '',
        category: r.category ?? '',
      });
    }
    return m;
  }, [rows]);

  const differs = (itemNo: string, e: Partial<ItemClassification>) => {
    const was = original.get(itemNo);
    if (!was) return true;
    const t = e.technologyCode !== undefined ? (e.technologyCode ?? null) : was.technologyCode;
    const role = e.itemRole !== undefined ? e.itemRole : was.itemRole;
    const cat = e.category !== undefined ? (e.category ?? '') : was.category;
    return t !== was.technologyCode || role !== was.itemRole || cat !== was.category;
  };

  const changed = Object.entries(edits).filter(([no, e]) => differs(no, e)).map(([no]) => no);
  const dirty = changed.length;

  const set = (itemNo: string, patch: Partial<ItemClassification>) =>
    setEdits((e) => {
      const next = { ...e, [itemNo]: { ...e[itemNo], ...patch } };
      if (!differs(itemNo, next[itemNo])) delete next[itemNo];
      return next;
    });

  /* There is no "set this on everything shown" control, deliberately.
     There was one, and it was the fastest way to be wrong at scale on this screen: a
     filter that is one character off, one touch of a dropdown, and several thousand
     parts are reclassified in a single gesture with no way to see what they were.
     Limiting it to the rows on screen was not the safeguard it looked like — the
     filter decides what is on screen, and the filter is the part that is easy to get
     wrong. Classification is a per-part judgement and it is made per part. The
     hierarchy in build_classification.py is where a decision that covers many parts
     belongs, because there it is written down, reviewed and versioned. */

  async function save() {
    setSaving(true);
    try {
      const payload: ItemClassification[] = changed.map((itemNo) => {
        const was = original.get(itemNo);
        const e = edits[itemNo];
        return {
          itemNo,
          technologyCode: e.technologyCode !== undefined
            ? e.technologyCode : was?.technologyCode ?? null,
          itemRole: (e.itemRole !== undefined ? e.itemRole : was?.itemRole) || '',
          category: (e.category !== undefined ? e.category : was?.category) || null,
          isQuotable: true,
          reason: null,
        };
      });

      /* A row with a technology and no type cannot be saved, and used to be dropped
         silently: it counted towards "Save 3", was filtered out of the payload, and
         then every edit was cleared — so the rep was told two items saved after asking
         for three, and the third was gone. Kept in the editor instead, with the count
         said plainly. */
      const ready = payload.filter((r) => r.itemRole);
      const held = payload.filter((r) => !r.itemRole).map((r) => r.itemNo);

      if (!ready.length) {
        notify(held.length
          ? `Set a type on ${held.length === 1 ? 'that item' : `those ${held.length} items`} before saving.`
          : 'Set a type before saving.');
        return;
      }
      const r = await api.classifyItems(ready);
      // Only the saved rows leave the editor. The rest stay exactly as typed.
      setEdits((cur) => Object.fromEntries(
        Object.entries(cur).filter(([no]) => held.includes(no))));
      work.reload();
      notify(held.length
        ? `${r.saved} classified. ${held.length} still need${held.length === 1 ? 's' : ''} a type.`
        : `${r.saved} item${r.saved === 1 ? '' : 's'} classified.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h-display text-xl">Classification</h1>
      </div>

      <div className="fascia flex flex-wrap items-center justify-between gap-3 border-b-2 border-instr-400 bg-navy-900 px-4 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <Reading label="Items" value={work.data ? String(work.data.total) : '—'} />
          <Reading label="Still to decide" value={String(undecided)} lead />
          <Reading label="Changed, not saved" value={String(dirty)} />
        </div>
        {canEdit ? (
          <button type="button" className="btn-primary text-sm" onClick={save}
                  disabled={saving || !dirty}>
            {dirty ? `Save ${dirty}` : 'Nothing to save'}
          </button>
        ) : (
          <span className="rounded border border-navy-600 px-2 py-1 text-2xs font-semibold text-navy-100">
            Read only — an administrator classifies items
          </span>
        )}
      </div>

      <Panel title="Every item, and what it is">
        <Toolbar>
          <input className="field max-w-xs text-sm" type="search" aria-label="Search items"
                 placeholder="Part number or description…"
                 value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} />
          {/* A select on a phone, the segmented control at a desk.
              Five options with counts wrap to three rows and 138px at 375px, which is
              a filter taking more height than the first two records it filters. */}
          <select className="field w-full text-sm md:hidden" aria-label="Classification status"
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as typeof status); setLimit(50); }}>
            {STATUS_FILTERS(counts, undecided).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.count})
              </option>
            ))}
          </select>
          <div className="hidden md:block">
          <Segmented
            label="Classification status"
            value={status}
            onChange={(v) => { setStatus(v); setLimit(50); }}
            options={STATUS_FILTERS(counts, undecided)}
          />
          </div>
          {/* Side by side rather than stacked: at w-44 the pair came to 352px in 309px
              of room, so each took its own line and the filter block ran to two thirds
              of a phone screen before the first record. */}
          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
          <select className="field min-w-0 text-sm md:w-44" aria-label="Filter by technology"
                  value={tech} onChange={(e) => { setTech(e.target.value); setLimit(50); }}>
            <option value="">Every technology</option>
            {(techs.data ?? []).map((t) => (
              <option key={t.code} value={t.code}>{t.code} — {t.name}</option>
            ))}
            <option value={ALL_TECHNOLOGIES}>Applies to all technologies</option>
          </select>
          {/* Technology, then type, then category — the same order as the columns
              they filter. They were type and category the other way round, which
              reads as a mistake every time somebody moves between the filter and
              the table. REPORTED. */}
          <select className="field min-w-0 text-sm md:w-44" aria-label="Filter by type"
                  value={kind} onChange={(e) => { setKind(e.target.value); setLimit(50); }}>
            <option value="">Every type</option>
            {(roleNames.length ? roleNames : ITEM_ROLES).map((x) => (
              <option key={x} value={x}>{ITEM_ROLE_PLURAL[x] ?? x}</option>
            ))}
          </select>
          {/* Filter by category, beside the other two.
              Without it there is no way to see what is filed under Stands, which
              makes adding a category an act of faith and removing one impossible to
              check. REPORTED: "I also can't test if adding or removing things from
              those categories effects the quote building like it should." */}
          <select className="field min-w-0 text-sm md:w-44" aria-label="Filter by category"
                  value={category} onChange={(e) => { setCategory(e.target.value); setLimit(50); }}>
            <option value="">Every category</option>
            <option value="__none">Not categorised</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
            ))}
          </select>
          </div>
        </Toolbar>

        {status === 'redundantOverride' && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-rule bg-navy-50 px-4 py-2.5">
            <p className="min-w-0 text-2xs text-steel-800">
              These repeat what the hierarchy already says.
            </p>
            <button type="button" className="btn-quiet shrink-0 text-2xs" disabled={saving || !canEdit}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const r = await api.clearOverrides(rows.map((x) => x.itemNo));
                        work.reload();
                        notify(`${r.cleared} override${r.cleared === 1 ? '' : 's'} dropped.`);
                      } finally { setSaving(false); }
                    }}>
              Drop all {rows.length} shown
            </button>
          </div>
        )}

        {work.loading && <Skeleton rows={8} />}
        {work.error && <ErrorNote message={work.error} onRetry={work.reload} />}

        {work.data && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-steel-600">
            {q ? 'Nothing matches that.' : 'Nothing in this view.'}
          </p>
        )}

        {/* A record list on a phone, the table at a desk.
            A 928px table inside a horizontal scroller is the right answer for an admin
            screen used at a desk and the wrong one on 375px, where classifying a part
            meant dragging the row sideways to reach the two controls that do the work.
            Same pattern the quote and order lists already use. */}
        {/* The three vocabularies a part is sorted by, editable here.
            REPORTED in three goes: the categories could not be set from a desk, there
            was no way to see what was filed under one, and "there also needs to be a
            way to add / remove technology and type in the app itself."

            They are the same request — the taxonomy the tool sorts parts by belongs
            to the business, not to the build — so they get one mechanism and one
            safety rule: a value can go only when nothing is filed under it. A
            vocabulary entry that disappears from under a part leaves the part saying
            nothing at all, and nobody notices until a filter comes back empty. The
            count beside each one is both the reason it cannot go and the way to find
            what is holding it. */}
        {canEdit && (
          <Panel title="Price books, types and categories"
                 aside={<span className="text-2xs text-steel-600">
                   what a part can be sorted by
                 </span>}>
            <div className="grid gap-4 p-4 md:grid-cols-3">
              <Vocabulary
                title="Price books"
                hint="CIJ, PALM. The book a quote is built in."
                placeholder="VIJ"
                entries={(techs.data ?? []).map((t) => ({
                  name: t.code, label: `${t.code} — ${t.name}`, count: t.itemCount,
                }))}
                onAdd={(v) => api.addTechnology(v, v)}
                onRemove={(v) => api.removeTechnology(v)}
                onDone={() => { techs.reload(); work.reload(); }}
                notify={notify}
              />
              <Vocabulary
                title="Types"
                hint="What a part is, at the level the rules read."
                placeholder="printhead"
                entries={(roles.data ?? []).map((r) => ({
                  name: r.name, label: ITEM_ROLE_WORD[r.name] ?? r.name, count: r.count,
                }))}
                onAdd={(v) => api.addItemRole(v)}
                onRemove={(v) => api.removeItemRole(v)}
                onDone={() => { roles.reload(); work.reload(); }}
                notify={notify}
              />
              <Vocabulary
                title="Categories"
                hint="A level below the type: Stands, Conveyor, Tamp Pad."
                placeholder="Sensors"
                entries={categories.map((c) => ({
                  name: c.category, label: c.category, count: c.count,
                }))}
                onAdd={(v) => api.addCategory(v)}
                onRemove={(v) => api.removeCategory(v)}
                onDone={() => { cats.reload(); work.reload(); }}
                notify={notify}
              />
            </div>
          </Panel>
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-steel-100 md:hidden">
            {rows.map((r) => {
              const e = edits[r.itemNo] ?? {};
              const t = e.technologyCode !== undefined
                ? (e.technologyCode ?? '') : (r.technologyCode ?? '');
              const role = e.itemRole !== undefined ? e.itemRole : (r.itemRole ?? '');
              return (
                <li key={r.itemNo}
                    className={`px-4 py-3 ${r.itemNo in edits ? 'bg-instr-100/40' : ''}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="num text-xs font-semibold text-steel-900">{r.itemNo}</span>
                    <Status compact tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Status>
                  </div>
                  <p className="mt-0.5 text-2xs text-steel-600">{r.description}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="label">Technology</span>
                      <select className="field mt-0.5 py-1 text-xs" value={t} disabled={!canEdit}
                              aria-label={`Technology for ${r.itemNo}`}
                              onChange={(ev) => set(r.itemNo,
                                { technologyCode: ev.target.value || null })}>
                        <option value="">Not decided</option>
                        {(techs.data ?? []).map((x) => (
                          <option key={x.code} value={x.code}>{x.code}</option>
                        ))}
                        <option value={ALL_TECHNOLOGIES}>All</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">Type</span>
                      <select className="field mt-0.5 py-1 text-xs" value={role} disabled={!canEdit}
                              aria-label={`Type for ${r.itemNo}`}
                              onChange={(ev) => set(r.itemNo, { itemRole: ev.target.value })}>
                        <option value="">Not decided</option>
                        {(roleNames.length ? roleNames : ITEM_ROLES).map((x) => (
                          <option key={x} value={x}>{ITEM_ROLE_WORD[x] ?? x}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">Category</span>
                      {/* The third thing a part is, and it was the one this screen
                          could not change. Asked for: "the entire quoting system must
                          be configurable through the rules and classify pages."
                          A list, not free text — a typo makes a category of one. */}
                      <select className="field mt-0.5 py-1 text-xs" disabled={!canEdit}
                              value={edits[r.itemNo]?.category ?? r.category ?? ''}
                              aria-label={`Category for ${r.itemNo}`}
                              onChange={(ev) => set(r.itemNo, { category: ev.target.value || null })}>
                        <option value="">None</option>
                        {categories.map((c) => (
                          <option key={c.category} value={c.category}>{c.category}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {rows.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="tbl min-w-[58rem]">
              <thead>
                <tr>
                  <th>Part</th>
                  <th className="n">List</th>
                  <th className="n">Status</th>
                  <th>Technology</th>
                  <th>Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = edits[r.itemNo] ?? {};
                  const t = e.technologyCode !== undefined
                    ? (e.technologyCode ?? '') : (r.technologyCode ?? '');
                  const role = e.itemRole !== undefined ? e.itemRole : (r.itemRole ?? '');
                  const isChanged = r.itemNo in edits;
                  return (
                    <tr key={r.itemNo} className={isChanged ? 'bg-instr-100/40' : undefined}>
                      <td>
                        <span className="num block font-semibold text-steel-900">{r.itemNo}</span>
                        <span className="block max-w-md text-2xs text-steel-600">
                          {r.description}
                        </span>
                      </td>
                      <td className="n text-steel-700">{money(r.listPrice)}</td>
                      <td className="stat-cell whitespace-nowrap">
                        <Status compact tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Status>
                      </td>
                      <td>
                        <select className="field w-44 py-1 text-xs" value={t} disabled={!canEdit}
                                aria-label={`Technology for ${r.itemNo}`}
                                onChange={(ev) => set(r.itemNo,
                                  { technologyCode: ev.target.value || null })}>
                          <option value="">Not decided</option>
                          {(techs.data ?? []).map((x) => (
                            <option key={x.code} value={x.code}>{x.code} — {x.name}</option>
                          ))}
                          <option value={ALL_TECHNOLOGIES}>Applies to all technologies</option>
                        </select>
                      </td>
                      <td>
                        <select className="field w-36 py-1 text-xs" value={role} disabled={!canEdit}
                                aria-label={`Type for ${r.itemNo}`}
                                onChange={(ev) => set(r.itemNo, { itemRole: ev.target.value })}>
                          <option value="">Not decided</option>
                          {(roleNames.length ? roleNames : ITEM_ROLES).map((x) => (
                            <option key={x} value={x}>{ITEM_ROLE_WORD[x] ?? x}</option>
                          ))}
                        </select>
                      </td>
                      {/* The category, on the layout that is actually used at a desk.
                          REPORTED: "the categories you added under classify can't
                          actually be mapped to anything." They could — on a phone.
                          The control went onto the narrow layout and not onto the
                          table, which is where anybody classifying two hundred parts
                          is sitting, so from a desk there was no way to set one. */}
                      <td>
                        <select className="field w-40 py-1 text-xs" disabled={!canEdit}
                                value={edits[r.itemNo]?.category ?? r.category ?? ''}
                                aria-label={`Category for ${r.itemNo}`}
                                onChange={(ev) => set(r.itemNo, { category: ev.target.value || null })}>
                          <option value="">None</option>
                          {categories.map((c) => (
                            <option key={c.category} value={c.category}>{c.category}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {work.data && work.data.total > rows.length && (
          <div className="border-t border-rule px-4 py-2">
            <button type="button" className="btn-quiet text-xs"
                    onClick={() => setLimit((n) => n + 50)}>
              Show more ({work.data.total - rows.length} left)
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

/**
 * One vocabulary: what is in it, what is filed under each value, add and remove.
 *
 * Three of these rather than three panels, because the rule that makes them safe is
 * the same rule in each case and writing it once is how it stays the same.
 */
function Vocabulary({ title, hint, placeholder, entries, onAdd, onRemove, onDone, notify }: {
  title: string;
  hint: string;
  placeholder: string;
  entries: { name: string; label: string; count?: number }[];
  onAdd: (value: string) => Promise<void>;
  onRemove: (value: string) => Promise<void>;
  onDone: () => void;
  notify: (m: string) => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(what: () => Promise<void>, said: string) {
    setBusy(true);
    try {
      await what();
      onDone();
      notify(said);
    } catch (e) {
      // The refusals are the interesting part — they say how many parts are in the
      // way — so they are shown rather than swallowed.
      notify(e instanceof Error ? e.message : 'That did not work.');
    } finally { setBusy(false); }
  }

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-steel-900">{title}</p>
      <p className="mt-0.5 text-2xs text-steel-600">{hint}</p>
      <div className="mt-2 flex items-end gap-1.5">
        <input className="field min-w-0 flex-1 py-1 text-xs" value={value}
               placeholder={placeholder} aria-label={`Add to ${title}`}
               onChange={(e) => setValue(e.target.value)} />
        <button type="button" className="btn-primary shrink-0 text-2xs"
                disabled={!value.trim() || busy}
                onClick={() => run(async () => {
                  await onAdd(value.trim());
                  setValue('');
                }, `Added to ${title.toLowerCase()}.`)}>
          Add
        </button>
      </div>
      <ul className="mt-2 max-h-56 divide-y divide-steel-100 overflow-y-auto border-t border-steel-100">
        {entries.map((e) => (
          <li key={e.name} className="flex items-baseline justify-between gap-2 py-1.5">
            <span className="min-w-0 truncate text-2xs text-steel-900">{e.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              {e.count != null && <span className="num text-2xs text-steel-600">{e.count}</span>}
              <button type="button"
                      className="btn-inline text-2xs text-alert-700 disabled:text-steel-400"
                      disabled={busy || (e.count ?? 0) > 0}
                      title={(e.count ?? 0) > 0
                        ? `${e.count} still filed here`
                        : `Remove ${e.label}`}
                      onClick={() => run(() => onRemove(e.name), `${e.label} removed.`)}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
