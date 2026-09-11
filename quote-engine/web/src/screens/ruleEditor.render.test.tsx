// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from '../api/appRules';
import { mockApi } from '../api/mock';
import { EMPTY_PROFILE } from '../api/types';
import { DERIVED_FIELDS } from '../engine/evaluate';
import { AppProvider } from '../state/app';
import { RuleEditor } from './RuleEditor';

/**
 * A rule you can author has to be a rule that can fire.
 *
 * The editor's profile-field list was six names typed into the JSX against 28 on
 * ApplicationProfile, and two of the six were misspelt — `throwDistanceMm` for
 * `throwDistMm`, `characterHeightMm` for `charHeightMm`. A rule saved on either was
 * accepted and silently never fired. The same list made the shipped rule
 * A-CIJ-CHR-6400 show its trigger field as "Choose…", so the editor called a working
 * rule unconfigured.
 *
 * Both halves are one assertion: everything the engines can read must be offerable,
 * and everything the shipped rules already read must be selectable.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  globalThis.scrollTo ??= (() => {}) as never;
});
afterEach(cleanup);

/** The field select, found by an option only it carries. */
async function fieldSelect(): Promise<HTMLSelectElement> {
  return waitFor(() => {
    const found = [...document.querySelectorAll('select')].find((sel) =>
      [...sel.options].some((o) => o.value === 'substrate'));
    if (!found) throw new Error('no profile-field select on screen');
    return found as HTMLSelectElement;
  }, { timeout: 8000 });
}

describe('the rule editor', () => {
  it('offers every field the application profile has', async () => {
    render(<AppProvider><RuleEditor ruleCode="A-CIJ-CHR-6400" /></AppProvider>);
    const sel = await fieldSelect();
    const offered = new Set([...sel.options].map((o) => o.value).filter(Boolean));

    // `notes` is prose for a person, not something to compare against.
    const expected = Object.keys(EMPTY_PROFILE).filter((f) => f !== 'notes');
    expect([...expected].filter((f) => !offered.has(f))).toEqual([]);
  });

  it('offers no field that does not exist', async () => {
    render(<AppProvider><RuleEditor ruleCode="A-CIJ-CHR-6400" /></AppProvider>);
    const sel = await fieldSelect();
    // Real means "an engine resolves it", not "the customer is asked for it". A
    // derived field is as real as a stored one to a rule; what it may not be is
    // undeclared, which is what DERIVED_FIELDS is for.
    const real = new Set([...Object.keys(EMPTY_PROFILE), ...Object.keys(DERIVED_FIELDS)]);
    const invented = [...sel.options].map((o) => o.value).filter((v) => v && !real.has(v));
    expect(invented).toEqual([]);
  });

  it('can select every field the shipped rules already read', async () => {
    render(<AppProvider><RuleEditor ruleCode="A-CIJ-CHR-6400" /></AppProvider>);
    const sel = await fieldSelect();
    const offered = new Set([...sel.options].map((o) => o.value));

    const used = new Set<string>();
    for (const rule of APPLICATION_RULES) {
      for (const t of rule.triggers) if (t.profileField) used.add(t.profileField);
    }
    expect(used.size).toBeGreaterThan(6);
    expect([...used].filter((f) => !offered.has(f)).sort()).toEqual([]);
  });

  it('offers every comparator the engines implement', async () => {
    render(<AppProvider><RuleEditor ruleCode="A-CIJ-CHR-6400" /></AppProvider>);
    await fieldSelect();
    const ops = [...document.querySelectorAll('select')]
      .find((sel) => [...sel.options].some((o) => o.value === 'gte'))!;
    const offered = new Set([...ops.options].map((o) => o.value));
    for (const op of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'includes', 'includesAny', 'in']) {
      expect(offered.has(op), `${op} is not offerable`).toBe(true);
    }
    // "one of" was the label on `includes`, which is substring matching. The label
    // and the operator have to mean the same thing.
    const includesLabel = [...ops.options].find((o) => o.value === 'includes')!.text;
    expect(includesLabel).toMatch(/contain/i);
  });

  it('shows an existing rule as configured, not as blank', async () => {
    // A-CIJ-CHR-6400 triggers on charHeightMm > 8.64. Both halves have to be on screen.
    render(<AppProvider><RuleEditor ruleCode="A-CIJ-CHR-6400" /></AppProvider>);
    const sel = await fieldSelect();
    expect(sel.value).toBe('charHeightMm');
    expect(within(document.body).getByDisplayValue('8.64')).toBeTruthy();
    expect(screen.queryByDisplayValue('Choose…')).toBeNull();
  });
});

/**
 * A rule code identifies a rule, so two rules cannot share one.
 *
 * REPORTED: "there's nothing stopping you from adding multiple rules with the same
 * code." Worse than reported, in the mock: saveRule found the existing rule by code
 * and wrote the new one over it, so a rule disappeared and nothing said so.
 */
describe('rule codes', () => {
  it('refuses a create on a code already in use', async () => {
    const existing = (await mockApi.listRules())[0];
    const v = await mockApi.validateRule(
      { ...blankRule(), ruleCode: existing.ruleCode }, { isNew: true });
    expect(v.issues.some((i) => i.field === 'ruleCode' && i.level === 'error')).toBe(true);
    // Validation refuses it first, which is the better of the two refusals: it
    // carries the issue the editor shows against the field. The guard inside
    // saveRule is the backstop for a caller that skipped validation.
    const err = await mockApi.saveRule({ ...blankRule(), ruleCode: existing.ruleCode },
      { isNew: true }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    const issues = (err as { issues?: { field: string }[] }).issues ?? [];
    expect(issues.some((i) => i.field === 'ruleCode')).toBe(true);
  });

  it('allows the code on the rule that owns it', async () => {
    // Every edit of every rule would fail otherwise, which is the trap in this check.
    const existing = (await mockApi.listRules())[0];
    const full = await mockApi.getRule(existing.ruleCode);
    const v = await mockApi.validateRule(full, { isNew: false });
    expect(v.issues.filter((i) => i.field === 'ruleCode' && i.level === 'error')).toEqual([]);
  });

  it('rejects a code that is not shaped like one', async () => {
    const v = await mockApi.validateRule({ ...blankRule(), ruleCode: 'my rule 3' },
      { isNew: true });
    expect(v.issues.some((i) => i.field === 'ruleCode')).toBe(true);
  });

  it('offers the next free code in an existing family', async () => {
    const next = await mockApi.nextRuleCode('R-');
    expect(next).toMatch(/^R-\d{3}$/);
    const used = (await mockApi.listRules()).map((r) => r.ruleCode);
    expect(used).not.toContain(next);
  });
});

function blankRule() {
  return {
    ruleCode: '', technologyCode: null, ruleType: 'note' as const, summary: 'x',
    detail: '', sourceRef: '', author: '', severity: 'info' as const,
    effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [{ triggerType: 'always' as const }],
    actions: [{ actionType: 'warn' as const, message: 'x' }], conditions: [],
  };
}
