import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';
import { draftFromQuote } from './draft';
import { EMPTY_PROFILE } from './types';

/**
 * What a SAVED quote has to be able to do.
 *
 * Three of these are here because they were reported broken from the screen, and
 * each one was a data fault rather than a rendering fault — which is why they are
 * testable at this level at all:
 *
 *   - "applications don't save on the quotes": createQuote always stored the
 *     profile, but the seeded examples never had one, so the panel that shows it
 *     had nothing to show on the only quotes a demo actually opens.
 *   - "clicking send to the customer says no quote Q-2026-0731": submitQuote
 *     needed a draft from this session, and a seeded quote has none.
 *   - Reopening a quote lost `noConstraint`, which silently un-silenced every
 *     rule the customer had said they had no constraint on.
 */
describe('a saved quote', () => {
  /**
   * The quotes a demo actually opens are the ones this was aimed at.
   *
   * It used to require more than four answers on EVERY seeded quote, which held while
   * there were five of them and all five were written to be opened. The history behind
   * them exists so the analytics page has an uneven fill rate to report, and several of
   * those are deliberately the two-line enquiry that arrives on a Friday — so a blanket
   * richness bar would force the seed to be tidy and the panel to draw a flat chart.
   *
   * So the bar stays exactly where it was pointed, and the weaker guarantee — nothing
   * is blank — now covers all thirty rather than five.
   */
  const OPENED_IN_A_DEMO = [
    'Q-2026-0731', 'Q-2026-0728', 'Q-2026-0722', 'Q-2026-0715', 'Q-2026-0709',
  ];

  it('carries the application it was priced against', async () => {
    for (const q of await api.listQuotes({})) {
      const full = await api.getQuote(q.quoteNo);
      expect(full.profile, `${q.quoteNo} has no application`).toBeTruthy();
      const answered = Object.values(full.profile ?? {}).filter((v) => v !== null && v !== '');
      expect(answered.length, `${q.quoteNo} application is blank`).toBeGreaterThan(0);
      if (OPENED_IN_A_DEMO.includes(q.quoteNo)) {
        expect(answered.length, `${q.quoteNo} is opened in a demo and is thin`)
          .toBeGreaterThan(4);
      }
    }
  });

  it('can be sent without a draft from this session', async () => {
    const before = await api.getQuote('Q-2026-0728');
    expect(before.status).toBe('sent');
    const sent = await api.submitQuote('Q-2026-0728', 'buyer@cascade.example', 'As discussed.');
    expect(sent.recipientEmail).toBe('buyer@cascade.example');
    expect(sent.coveringNote).toBe('As discussed.');
  });

  it('keeps what the customer said they have no constraint on', async () => {
    const draft = {
      technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'Line 1',
      profile: { substrate: 'HDPE bottle', porosity: 'nonPorous' as const },
      noConstraint: ['throwDistMm' as const, 'charHeightMm' as const],
      flags: {}, categoryDiscounts: {}, lines: [],
    };
    const created = await api.createQuote(draft as never);
    const reopened = await api.getQuote(created.quoteNo);
    expect(reopened.noConstraint).toEqual(['throwDistMm', 'charHeightMm']);
  });

  /* REPORTED: "Marking something as optional during quote building doesn't actually
     do anything on the customer copy."

     There was already a test for optional lines, and it passed: it hand-built a draft
     with `optional: true` and rendered QuoteDocument, which proved the component draws
     the section and nothing about whether the flag ever reaches it. The flag was lost
     one step earlier, rebuilding the draft from the saved quote — so it worked in the
     builder, where the draft is still in memory, and was gone on the customer copy,
     which is always opened from a saved quote.

     This goes through the actual route: save it, read it back, convert it the way the
     screens do, price it. */
  it('keeps a line marked optional out of the total after it is reopened', async () => {
    const created = await api.createQuote({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Optional Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE }, noConstraint: [],
      flags: {}, categoryDiscounts: {},
      lines: [{ itemNo: 'E608A393YRJ', quantity: 1 },
              { itemNo: '0210879', quantity: 2, optional: true }],
    } as never);

    const reopened = await api.getQuote(created.quoteNo);
    const stored = reopened.lines.find((l) => l.itemNo === '0210879');
    expect(stored?.optional, 'the saved quote lost the flag').toBe(true);

    // The conversion every screen uses, including the customer copy.
    const draft = draftFromQuote(reopened);
    expect(draft.lines.find((l) => l.itemNo === '0210879')?.optional,
      'rebuilding the draft lost the flag').toBe(true);

    const ev = await api.evaluateDraft(draft);
    expect(ev.optionalNet, 'nothing was priced as optional').toBeGreaterThan(0);
    expect(ev.lines.find((l) => l.itemNo === '0210879')?.optional).toBe(true);
    // And it is genuinely out of the money rather than merely labelled.
    const inTotal = ev.lines.filter((l) => !l.optional)
      .reduce((n, l) => n + (l.extendedNet ?? 0), 0);
    expect(ev.orderTotal).toBeCloseTo(inTotal, 2);
  });

  /* The same rebuild, for the fields that had already been lost this way once.
     noConstraint was fixed in three of the five copies of this conversion and left
     broken in the other two; a flat discount was never carried by any of them. */
  it('keeps the discount and the waved-off rules when it is reopened', async () => {
    const created = await api.createQuote({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Reopen Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE, substrate: 'HDPE bottle' },
      noConstraint: ['throwDistMm', 'charHeightMm'],
      flags: {}, categoryDiscounts: {}, flatDiscount: 500,
      lines: [{ itemNo: 'E608A393YRJ', quantity: 1 }],
    } as never);

    const draft = draftFromQuote(await api.getQuote(created.quoteNo));
    expect(draft.noConstraint).toEqual(['throwDistMm', 'charHeightMm']);
    expect(draft.flatDiscount).toBe(500);
  });

  /* A copy is the same quote. This one never had the noConstraint fix at all. */
  it('carries all of that into a copy', async () => {
    const created = await api.createQuote({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Copy Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE },
      noConstraint: ['throwDistMm'], flags: {}, categoryDiscounts: {},
      lines: [{ itemNo: 'E608A393YRJ', quantity: 1 },
              { itemNo: '0210879', quantity: 2, optional: true }],
    } as never);

    const copy = await api.duplicateQuote(created.quoteNo);
    const full = await api.getQuote(copy.quoteNo);
    expect(full.noConstraint, 'the copy dropped the no-constraint answers')
      .toEqual(['throwDistMm']);
    expect(full.lines.find((l) => l.itemNo === '0210879')?.optional,
      'the copy dropped the optional flag').toBe(true);
  });

  it('grades the machines on it against that application', async () => {
    const q = await api.getQuote('Q-2026-0731');
    const ev = await api.evaluateDraft({
      technologyCode: q.technologyCode,
      customerNo: q.customerNo ?? null, customerName: q.customerName, lineName: q.lineName,
      profile: q.profile!, noConstraint: q.noConstraint ?? [],
      flags: {}, categoryDiscounts: {},
      lines: q.lines.map((l) => ({ itemNo: l.itemNo, quantity: l.quantity })),
    } as never);
    // 620 fpm on a case: the 6420 is inside its speed limit, and the substrate
    // rule has an opinion about small-character CIJ on secondary packaging.
    const graded = ev.fit.filter((f) => f.reasons.length > 0);
    expect(graded.length, 'nothing on the quote was graded').toBeGreaterThan(0);
    expect(graded.flatMap((f) => f.reasons.map((r) => r.ruleCode)))
      .toContain('A-TECH-CIJ-SECONDARY');
  });
});
