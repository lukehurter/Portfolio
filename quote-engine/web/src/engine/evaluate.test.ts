import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate, suggest, type EngineInput } from './evaluate';
import { narrowingFor } from './narrowing';
import { EMPTY_PROFILE, type DiscountCategory, type Item, type QuoteDraft, type Rule } from '../api/types';

/**
 * The shared golden cases.
 *
 * api/tests/test_engine.py reads the same file and asserts the same things. The
 * point is that neither engine can be changed alone: touch one and the other
 * side's test fails. Two engines quietly disagreeing about a price is the
 * failure this is here to prevent.
 */

interface Cases {
  fixtures: {
    narrowingItems: Parameters<typeof suggest>[0]['items']; today: string; categories: DiscountCategory[]; items: Item[]; rules: Rule[] };
  cases: {
    name: string;
    draft: Partial<QuoteDraft> & { profile: Partial<typeof EMPTY_PROFILE> };
    expect: Record<string, unknown>;
  }[];
  fixturesNarrowing?: unknown;
  narrowingCases: {
    name: string;
    technologyCode: string;
    profile: Partial<typeof EMPTY_PROFILE>;
    roles: string[] | null;
    expect: {
      applied: string[];
      narrow: Record<string, string[]>;
      survivors: string[];
    };
  }[];
  suggestCases: {
    name: string;
    draft: { technologyCode: string; profile: Partial<typeof EMPTY_PROFILE> };
    identity?: string[];
    attributes?: Record<string, string>;
    q?: string;
    expect: {
      count?: number;
      /** item number → how many configurations it stands for */
      variants?: Record<string, number>;
      /** item number → the attribute values that made it a machine */
      identityOf?: Record<string, Record<string, string>>;
    };
  }[];
}

const spec = JSON.parse(
  readFileSync(new URL('../../../engine-cases.json', import.meta.url), 'utf8'),
) as Cases;

const run = (draft: Cases['cases'][number]['draft']) =>
  evaluate({
    draft: { ...draft, profile: { ...EMPTY_PROFILE, ...draft.profile } } as QuoteDraft,
    items: spec.fixtures.items,
    rules: spec.fixtures.rules,
    categories: spec.fixtures.categories,
    today: spec.fixtures.today,
  } as EngineInput);

describe('rule engine — shared cases', () => {
  for (const c of spec.cases) {
    it(c.name, () => {
      const got = run(c.draft);
      const want = c.expect as Record<string, any>;

      for (const key of ['extendedList', 'extendedNet', 'orderTotal', 'totalDiscount',
                         'marginPct', 'marginNote', 'blocked'] as const) {
        if (key in want) expect(got[key], key).toEqual(want[key]);
      }

      if (want.marginNoteContains) expect(got.marginNote).toContain(want.marginNoteContains);

      if (want.lines) {
        for (const wl of want.lines) {
          const gl = got.lines.find((l) => l.itemNo === wl.itemNo);
          expect(gl, `line ${wl.itemNo}`).toBeTruthy();
          for (const [k, v] of Object.entries(wl)) {
            if (k === 'itemNo') continue;
            expect((gl as any)[k], `${wl.itemNo}.${k}`).toEqual(v);
          }
        }
      }

      const codes = got.trace.map((t) => t.ruleCode);
      if (want.traceCodes) for (const code of want.traceCodes) expect(codes).toContain(code);
      if (want.traceCodesAbsent) for (const code of want.traceCodesAbsent) expect(codes).not.toContain(code);

      if (want.traceStatuses) {
        for (const [code, status] of Object.entries(want.traceStatuses)) {
          const entry = got.trace.find((t) => t.ruleCode === code);
          expect(entry, `trace entry for ${code}`).toBeTruthy();
          expect(entry!.status, `status of ${code}`).toBe(status);
        }
      }

      /* The kind of part a finding sends the rep to find. Read off the rule's own
         trigger, so a rule written later gets a picker without anybody adding one. */
      if (want.tracePickRoles) {
        for (const [code, role] of Object.entries(want.tracePickRoles)) {
          const entry = got.trace.find((t) => t.ruleCode === code);
          expect(entry, `trace entry for ${code}`).toBeTruthy();
          expect(entry!.pickRole, `pickRole of ${code}`).toBe(role);
        }
      }
      if (want.tracePickRolesAbsent) {
        for (const code of want.tracePickRolesAbsent) {
          const entry = got.trace.find((t) => t.ruleCode === code);
          expect(entry, `trace entry for ${code}`).toBeTruthy();
          expect(entry!.pickRole, `${code} should offer no picker`).toBeUndefined();
        }
      }

      if (want.traceHeadlineContains) {
        for (const [code, needle] of Object.entries(want.traceHeadlineContains)) {
          const entry = got.trace.find((t) => t.ruleCode === code);
          expect(entry!.headline).toContain(needle);
        }
      }

      if (want.requiredApprovals) {
        expect(got.requiredApprovals).toHaveLength(want.requiredApprovals.length);
        want.requiredApprovals.forEach((wa: any, i: number) => {
          for (const [k, v] of Object.entries(wa)) {
            expect((got.requiredApprovals[i] as any)[k], `approval[${i}].${k}`).toEqual(v);
          }
        });
      }

      if (want.fit) {
        // Matched on the solution too where the case names one: an item quoted at two
        // stations is two assessments with the same item number, and matching on the
        // number alone would silently check the first one twice.
        for (const wf of want.fit) {
          const gf = got.fit.find((f) => f.itemNo === wf.itemNo
            && (!('solutionId' in wf) || (f.solutionId ?? null) === wf.solutionId));
          const where = 'solutionId' in wf ? `${wf.itemNo} at ${wf.solutionId}` : wf.itemNo;
          expect(gf, `fit for ${where}`).toBeTruthy();
          expect(gf!.grade, `grade of ${where}`).toBe(wf.grade);
          expect(gf!.reasons.map((r) => r.ruleCode), where).toEqual(wf.reasonCodes);
        }
      }
    });
  }
});

/**
 * The same file's suggest cases.
 *
 * `suggest` answers "which machine", and until grouping it answered with a
 * catalogue: a Corvus part number is a printer already filled, so nine machines came
 * back as 947 rows. api/tests/test_engine.py runs these same cases against the
 * Python engine, so the collapse cannot drift between the two.
 */
describe('suggest — shared cases', () => {
  for (const c of spec.suggestCases) {
    it(c.name, () => {
      const got = suggest({
        draft: {
          technologyCode: c.draft.technologyCode,
          profile: { ...EMPTY_PROFILE, ...c.draft.profile },
        },
        identity: c.identity,
        attributes: c.attributes,
        q: c.q,
        items: spec.fixtures.items,
        rules: spec.fixtures.rules,
        categories: spec.fixtures.categories,
        today: spec.fixtures.today,
      } as Parameters<typeof suggest>[0]);

      if (c.expect.count != null) expect(got.length, 'row count').toBe(c.expect.count);

      // Stated in full: a row absent from `variants` must carry none, so a future
      // change that starts grouping something cannot pass by going unmentioned.
      const want = c.expect.variants ?? {};
      for (const f of got) {
        expect(f.variants ?? 1, `variants of ${f.itemNo}`).toBe(want[f.itemNo] ?? 1);
      }

      for (const [itemNo, values] of Object.entries(c.expect.identityOf ?? {})) {
        const f = got.find((x) => x.itemNo === itemNo);
        expect(f, `${itemNo} should be a row`).toBeTruthy();
        expect(f!.identity, `identity of ${itemNo}`).toEqual(values);
      }
    });
  }
});

/**
 * What the application rules out before anything is graded.
 *
 * ASKED: "do the rules drive the application fit logic or is there a hidden layer in
 * code?" This was the hidden layer, and for a while it lived on this side alone — so
 * the Python engine, which is the production authority, would have offered a rep 947
 * CIJ configurations where this one offers 663. Both sides run these cases now.
 *
 * They run against the real rules in data/narrowing-rules.json rather than a fixture
 * copy, because the rules are the thing under test.
 */
describe('narrowing, held equal with the Python engine', () => {
  const rules = (JSON.parse(
    readFileSync(new URL('../../../data/narrowing-rules.json', import.meta.url), 'utf8'),
  ) as { rules: Rule[] }).rules.map((r) => ({ ...r, isActive: true }));

  for (const c of spec.narrowingCases) {
    it(c.name, () => {
      const profile = { ...EMPTY_PROFILE, ...c.profile };
      const items = spec.fixtures.narrowingItems;
      const n = narrowingFor(profile, items, c.technologyCode, rules);

      expect(n.applied.map((a) => a.ruleCode), 'rules that engaged').toEqual(c.expect.applied);
      expect(n.narrow, 'attribute values kept').toEqual(c.expect.narrow);

      const got = suggest({
        draft: { technologyCode: c.technologyCode, profile },
        roles: c.roles ?? undefined,
        narrow: n.narrow, deny: n.deny,
        items, rules: [], categories: spec.fixtures.categories, today: spec.fixtures.today,
      } as Parameters<typeof suggest>[0]);
      expect(got.map((f) => f.itemNo).sort(), 'what survived').toEqual(c.expect.survivors);

      // Every narrowing a rep sees has to be answerable: a code, a sentence, and the
      // document the judgement came from.
      for (const a of n.applied) {
        expect(a.summary, `${a.ruleCode} has no summary`).toBeTruthy();
        expect(a.sourceRef, `${a.ruleCode} cites nothing`).toBeTruthy();
        expect(a.author, `${a.ruleCode} has no author`).toBeTruthy();
      }
    });
  }
});
