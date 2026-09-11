import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';
import { APPLICATION_RULES } from './appRules';
import { CATALOG } from './catalog';
import { EMPTY_PROFILE } from './types';

/**
 * The notes salespeople wrote in the price workbooks reach the rep.
 *
 * 173 cell comments were recovered from the eight workbooks and 144 were seeded as
 * inactive drafts, correctly — "If replacing screws with tool-less handscrews, order (1)
 * PH and (2) Cross Joints" names two parts in prose and guessing which would put a wrong
 * part on a real quote.
 *
 * What nobody had noticed is that they had no TRIGGER either. The seeder kept the row's
 * part number for the 29 caps, because it needed one to write a cap, and dropped it for
 * everything else — so all 144 were not drafts awaiting a decision, they were inert. A
 * rule with no trigger cannot fire however it is worded.
 *
 * The part is recoverable: a comment is attached to a cell, the cell is on a row, and
 * the row is a part. See data/price-page-notes.md.
 */

const notes = APPLICATION_RULES.filter((r) => /^W-\d+$/.test(r.ruleCode)
  && r.actions.every((a) => a.actionType === 'warn'));

describe('the notes from the price pages', () => {
  it('are attached to a part that exists', () => {
    expect(notes.length).toBeGreaterThanOrEqual(75);
    const known = new Set(CATALOG.map((i) => i.itemNo));
    for (const r of notes) {
      const trig = r.triggers.find((t) => t.triggerType === 'item');
      expect(trig, `${r.ruleCode} has no item trigger — it cannot fire`).toBeTruthy();
      expect(known.has(trig!.itemNo!), `${r.ruleCode} points at ${trig!.itemNo}`).toBe(true);
    }
  });

  it('name the person who wrote them and the cell they came from', () => {
    for (const r of notes) {
      expect(r.author, `${r.ruleCode} has no author`).toBeTruthy();
      expect(r.sourceRef, `${r.ruleCode} lost its cell reference`)
        .toMatch(/workbook, .+, [A-Z]+\d+/);
    }
  });

  it('say what was written, not a paraphrase of it', () => {
    /* Every one of these carries exactly one warn action and no other, because the
       decision about what a note MEANS is the thing the drafts were left inactive for.
       A note that quietly acquired a require action would be that decision made by
       nobody. */
    for (const r of notes) {
      expect(r.actions).toHaveLength(1);
      expect(r.actions[0].actionType).toBe('warn');
      expect(r.actions[0].message?.length ?? 0).toBeGreaterThan(3);
    }
  });

  it("shows the salesperson's own sentence when the part goes on a quote", async () => {
    const ev = await api.evaluateDraft({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Note Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE }, noConstraint: [],
      flags: {}, categoryDiscounts: {},
      lines: [{ itemNo: 'PL79549', quantity: 1 }],
    } as never);
    const e = ev.trace.find((t) => t.ruleCode === 'W-009');
    expect(e, 'W-009 did not fire on PL79549').toBeTruthy();
    expect(e!.headline).toMatch(/tool-less handscrews/i);
    expect(e!.author).toMatch(/price page comment/);
  });

  it('stays quiet when its part is not on the quote', async () => {
    const ev = await api.evaluateDraft({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Note Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE }, noConstraint: [],
      flags: {}, categoryDiscounts: {},
      lines: [{ itemNo: '712295', quantity: 1 }],
    } as never);
    expect(ev.trace.find((t) => t.ruleCode === 'W-009')).toBeFalsy();
  });

  it('does not put a price on screen', () => {
    /* The workbooks are the one thing in this repo that must never reach a reader, and
       these sentences came out of them. A discount ceiling is a rule and is fine; a
       dollar figure is a price and is not. */
    for (const r of notes) {
      const text = `${r.summary} ${r.actions[0].message}`;
      expect(text, `${r.ruleCode} carries a figure that looks like money`)
        .not.toMatch(/\$\s?\d|\d+\s?(?:USD|dollars)/i);
    }
  });
});
