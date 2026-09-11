import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';
import { CATALOG } from './catalog';
import { APPLICATION_RULES } from './appRules';
import { EMPTY_PROFILE } from './types';

/**
 * The ceilings written on the price pages apply where the rep can see them.
 *
 * 28 parts carry "Max Discount 5%" in the discount column of their own row. They were
 * seeded straight into cpq.rule by sql/04_seed_rules.sql and never went through
 * build_rules.py, so they existed for the service and not for the preview — a rep could
 * take a printhead stand to 30% on screen, send the quote, and be held to 5% on the
 * order. Both engines read a cap off a rule action; the rules live in
 * data/discount-caps.json now and reach both.
 *
 * Printhead stands, poles, mounting kits and integration cabling: exactly the
 * accessories that get discounted to close a system sale.
 */

const capRules = APPLICATION_RULES.filter(
  (r) => r.actions.some((a) => a.actionType === 'cap'));

describe('discount ceilings from the price pages', () => {
  it('carries all 49 of them', () => {
    /* 28 said "Max Discount 5%" and were seeded active. The other 21 said "5% Limited
       Discount" — the print-and-apply book's wording for the same thing — and sat in
       the inactive drafts because the extractor was keying on the phrase. */
    const capped = new Set(capRules.flatMap(
      (r) => r.actions.filter((a) => a.actionType === 'cap').map((a) => a.itemNo)));
    expect(capped.size).toBe(49);
  });

  it('caps a part that exists, at a rate the page states', () => {
    const known = new Set(CATALOG.map((i) => i.itemNo));
    for (const r of capRules) {
      for (const a of r.actions) {
        if (a.actionType !== 'cap') continue;
        expect(known.has(a.itemNo!), `${r.ruleCode} caps ${a.itemNo}, which is not a part`)
          .toBe(true);
        // 5% throughout, except the 54" T-Base stand, which the page puts at 10%.
        expect([0.05, 0.10], `${r.ruleCode} caps at ${a.maxDiscount}`)
          .toContain(a.maxDiscount);
      }
    }
  });

  it('keeps the citation back to the workbook cell', () => {
    for (const r of capRules) {
      expect(r.sourceRef, `${r.ruleCode} lost its cell reference`)
        .toMatch(/workbook, .+, [A-Z]+\d+/);
      expect(r.ruleCode).toMatch(/^W-\d+$/);
    }
  });

  it('holds a 30% discount down to 5% on the quote', async () => {
    /* The number that was wrong. 712295 is in the `accessories` category, whose own
       ceiling is 18%, and this part's page says 5%. An item cap is tighter than its
       category and wins. */
    const item = '712295';
    expect(CATALOG.some((i) => i.itemNo === item)).toBe(true);

    const ev = await api.evaluateDraft({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Cap Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE }, noConstraint: [],
      flags: {}, categoryDiscounts: { accessories: 0.30, system: 0.30 },
      lines: [{ itemNo: item, quantity: 1 }],
    } as never);

    const line = ev.lines.find((l) => l.itemNo === item)!;
    expect(line.appliedDiscount, 'the ceiling did not bite').toBe(0.05);
    expect(line.cappedByRule, 'nothing says which rule capped it').toBeTruthy();
    // And the rep is told, rather than the number quietly changing.
    expect(ev.trace.some((t) => t.ruleCode === line.cappedByRule)).toBe(true);
  });

  it('leaves an uncapped accessory on its category ceiling', async () => {
    const uncapped = CATALOG.find(
      (i) => i.technologyCode === 'CIJ' && i.itemRole === 'accessory'
        && !capRules.some((r) => r.actions.some((a) => a.itemNo === i.itemNo)))!;
    const ev = await api.evaluateDraft({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Cap Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE }, noConstraint: [],
      flags: {}, categoryDiscounts: { accessories: 0.10, system: 0.10 },
      lines: [{ itemNo: uncapped.itemNo, quantity: 1 }],
    } as never);
    const line = ev.lines.find((l) => l.itemNo === uncapped.itemNo)!;
    expect(line.appliedDiscount, `${uncapped.itemNo} was capped and should not be`)
      .toBe(0.10);
  });
});
