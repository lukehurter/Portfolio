import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from '../api/appRules';
import { CATALOG } from '../api/catalog';
import { EMPTY_PROFILE } from '../api/types';
import { suggest } from './evaluate';

/**
 * The Thorne T400 range prints up to 213 mm, and the tool used to say 107.
 *
 * A-TTO-BAR-107 said "107 mm is the widest thermal bar published in the T400 series"
 * and graded notRecommended above it. The document it cited said otherwise in the same
 * specifications table — T406e 160 x 100 mm, T408 213 x 100 mm, T408e 213 x 155 mm —
 * because the "Thermal bar size" row is stated only for the T402+ and the T404+, and
 * whoever wrote the rule read that row as the range's ceiling.
 *
 * A rep asking for a 150 mm mark was told thermal transfer could not do it while two
 * machines in the range print 160 and 213. That is a rule losing a sale, which is
 * worse than no rule, so the range is tested at every step.
 */
const ngt = CATALOG.find((i) => i.model === 'T400 Series' && i.itemRole === 'printer');

function gradeAt(markHeightMm: number) {
  const got = suggest({
    draft: {
      technologyCode: 'TTO',
      profile: { ...EMPTY_PROFILE, charHeightMm: markHeightMm, linesOfPrint: 1 },
    },
    items: CATALOG, rules: APPLICATION_RULES, categories: [], today: '2026-08-20',
  } as Parameters<typeof suggest>[0]);
  return got.find((f) => f.itemNo === ngt!.itemNo);
}

describe('the Thorne T400 print-area ladder', () => {
  it('has an T400 machine to grade', () => {
    expect(ngt, 'no T400 Series printer in the catalogue').toBeTruthy();
  });

  it('does not rule out a mark the T406 and T408 print', () => {
    // The bug, stated as the case that used to fail.
    const at150 = gradeAt(150);
    expect(at150?.grade, '150 mm is inside the T406e (160 mm) and T408 (213 mm)')
      .not.toBe('notRecommended');
    const codes = at150?.reasons.map((r) => r.ruleCode) ?? [];
    expect(codes).toContain('A-TTO-BAR-107');
  });

  it('names the machine that takes the next step, at every step', () => {
    for (const [mm, mustName] of [[60, /T404\+/], [120, /T406e/], [170, /T408/]] as const) {
      const f = gradeAt(mm);
      expect(f?.grade, `${mm} mm`).toBe('caveat');
      const said = (f?.reasons ?? []).map((r) => r.text).join(' ');
      expect(said, `${mm} mm should name the next machine up`).toMatch(mustName);
    }
  });

  it('refuses only past the largest figure any T400 document states', () => {
    expect(gradeAt(220)?.grade, '220 mm is past the T408').toBe('notRecommended');
    const codes = gradeAt(220)?.reasons.map((r) => r.ruleCode) ?? [];
    expect(codes).toContain('A-TTO-BAR-213');
  });

  it('says nothing about a mark every head prints', () => {
    const f = gradeAt(40);
    const bars = (f?.reasons ?? []).filter((r) => r.ruleCode.startsWith('A-TTO-BAR'));
    expect(bars, '40 mm is inside the smallest head; no bar rule should speak').toEqual([]);
  });
});
