import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from '../api/appRules';
import { CATALOG } from '../api/catalog';
import { EMPTY_PROFILE } from '../api/types';
import { suggest } from './evaluate';

/**
 * An impossible requirement has to produce an answer, not a silence.
 *
 * A reviewer entered a line speed of 10,000,000 fpm and the tool still returned
 * suggestions. Nothing was broken in the sense of throwing: the speed ceilings were
 * written as rules scoped to a MODEL — A-CIJ-SPD-MAX names the 6440, because the 6440 is
 * the fastest CIJ and the datasheet sentence is about the 6440. So the ceiling fired on
 * the one machine it named and said nothing about the other 946, and "nothing said" then
 * rendered as a good fit.
 *
 * Two things were wrong and both had to be fixed, which is why this file tests both. The
 * ceilings are now also written technology-wide, from the same datasheet figures; and an
 * item no rule has spoken about grades notAssessed rather than good, so a silence can
 * never again be drawn as an endorsement.
 */

const TECHS = ['CIJ', 'LSR', 'TTO', 'PALM', 'PIJ', 'TIJ', 'VIJ'] as const;

function graded(technologyCode: string, lineSpeedFpm: number | null) {
  return suggest({
    draft: { technologyCode, profile: { ...EMPTY_PROFILE, lineSpeedFpm } },
    items: CATALOG,
    rules: APPLICATION_RULES,
    categories: [],   // fit grading reads no discount category
    today: '2026-08-13',
  });
}

describe('a requirement no machine can meet', () => {
  it('is refused by every technology, not answered', () => {
    for (const tech of TECHS) {
      const rows = graded(tech, 10_000_000);
      if (rows.length === 0) continue;          // no machines in that book at all
      const offered = rows.filter((r) => r.grade !== 'notRecommended');
      expect(offered.map((r) => `${tech} ${r.itemNo}`), `${tech} still offers machines`)
        .toEqual([]);
    }
  });

  it('says why, citing the figure it was measured against', () => {
    const rows = graded('CIJ', 10_000_000);
    expect(rows.length).toBeGreaterThan(0);
    const reasons = rows[0].reasons.map((r) => r.ruleCode);
    expect(reasons).toContain('A-CIJ-SPD-CEILING');
    // The published number has to survive into the sentence a rep reads aloud.
    expect(rows[0].reasons.some((r) => /1,791/.test(r.text))).toBe(true);
    expect(rows[0].reasons.every((r) => r.sourceRef)).toBe(true);
  });
});

describe('an ordinary requirement', () => {
  it('still leaves machines to choose between', () => {
    // The over-correction this guards: a ceiling set too low, or a default grade that
    // condemns rather than abstains, would satisfy the tests above and leave a rep with
    // an empty list on a line any CIJ printer could code.
    const rows = graded('CIJ', 200);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.grade !== 'notRecommended').length).toBeGreaterThan(0);
  });
});

describe('a machine no rule has examined', () => {
  it('is not called a good fit', () => {
    // An empty profile fires nothing, which is the state a rep starts in. Every machine
    // used to come back green.
    const rows = graded('CIJ', null);
    expect(rows.length).toBeGreaterThan(0);
    const green = rows.filter((r) => r.grade === 'good' && r.reasons.length === 0);
    expect(green).toEqual([]);
  });

  it('ranks below one a datasheet endorses', () => {
    const rows = graded('CIJ', 300);
    const firstUnassessed = rows.findIndex((r) => r.grade === 'notAssessed');
    const lastGood = rows.map((r) => r.grade).lastIndexOf('good');
    if (firstUnassessed >= 0 && lastGood >= 0) expect(lastGood).toBeLessThan(firstUnassessed);
  });
});

describe('ranking within a fit grade', () => {
  it('puts the more-ordered machine first, whatever the item numbers say', () => {
    // Item numbers sort Z after A, so if popularity is ignored this comes back
    // the other way round and the test fails for the right reason.
    const rows = suggest({
      draft: { technologyCode: 'CIJ', profile: { ...EMPTY_PROFILE } },
      items: CATALOG, rules: APPLICATION_RULES, categories: [], today: '2026-08-13',
      rank: Object.fromEntries(CATALOG
        .filter((i) => i.technologyCode === 'CIJ' && i.itemRole === 'printer')
        .map((i, n) => [i.itemNo, { orders: n === 0 ? 0 : 500 - n }])),
    });
    const orders = rows.slice(0, 12).map((r) => r.itemNo);
    expect(orders.length).toBeGreaterThan(2);
    // The one given 0 orders must not lead when others have hundreds.
    const zero = CATALOG.filter((i) => i.technologyCode === 'CIJ' && i.itemRole === 'printer')[0];
    expect(rows[0].itemNo).not.toBe(zero.itemNo);
  });

  it('never lets popularity beat fit', () => {
    // A wildly popular machine that cannot meet the speed still loses to one that can.
    const rank = Object.fromEntries(CATALOG
      .filter((i) => i.technologyCode === 'CIJ')
      .map((i) => [i.itemNo, { orders: 9999 }]));
    const rows = suggest({
      draft: { technologyCode: 'CIJ', profile: { ...EMPTY_PROFILE, lineSpeedFpm: 10_000_000 } },
      items: CATALOG, rules: APPLICATION_RULES, categories: [], today: '2026-08-13',
      rank,
    });
    expect(rows.every((r) => r.grade === 'notRecommended')).toBe(true);
  });
});
