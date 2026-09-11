import { EMPTY_PROFILE, type Quote, type QuoteDraft } from './types';

/**
 * A saved quote, back in the shape the engine and the screens edit.
 *
 * There were five of these — `draftFor` in mock.ts, `draftOf` in QuoteDetail,
 * `toDraft` in QuoteDocumentScreen, one inline in QuoteBuilder and one in
 * copyQuote — and each rebuilt every line as `{ itemNo, quantity }`. Everything
 * else a rep had set on a line was dropped on reopening, which is not a rendering
 * fault a screen can fix: the flag was gone from the data before the page ran.
 *
 * REPORTED: "Marking something as optional during quote building doesn't actually
 * do anything on the customer copy." It worked while the draft was still in memory
 * and stopped the moment the quote was read back, which is every time the customer
 * copy is opened from a saved quote.
 *
 * The same fault had already been found and fixed once — `noConstraint` used to be
 * rebuilt as `[]`, un-silencing every rule the customer had waved off — and the fix
 * went into three of the five copies. copyQuote still drops it today. That is the
 * argument for one function: a field added to the draft has one place to be
 * remembered, and a bug found here is fixed everywhere at once.
 */
export function draftFromQuote(q: Quote): QuoteDraft {
  return {
    technologyCode: q.technologyCode,
    customerNo: q.customerNo ?? null,
    customerName: q.customerName ?? null,
    lineName: q.lineName ?? null,
    profile: { ...EMPTY_PROFILE, ...(q.profile ?? {}) },
    /* The customer's "any / does not matter" answers. cpq.quote.no_constraint is
       the column for it precisely so the decision survives being reopened. */
    noConstraint: q.noConstraint ?? [],
    flags: q.flags ?? {},
    categoryDiscounts: q.categoryDiscounts ?? {},
    flatDiscount: q.flatDiscount ?? null,
    /* The stations, each with its own name, book and application. A quote saved
       before solutions existed has none, and every line falls back to the quote's
       own application — which is the answer it had at the time. */
    solutions: q.solutions ?? [],
    /* Offered, not bought. Priced and graded like any other line and kept out of
       the total, so the customer copy can put it under its own heading.

       solutionId is which station the line serves, and it has to survive reopening
       for the same reason `optional` did: without it every line falls back to the
       quote's application and a two-station quote silently becomes a one-station
       one on the next open. */
    lines: q.lines.map((l) => ({
      itemNo: l.itemNo,
      quantity: l.quantity,
      ...(l.solutionId ? { solutionId: l.solutionId } : {}),
      ...(l.optional ? { optional: true } : {}),
    })),
    recipientEmail: q.recipientEmail ?? null,
    coveringNote: q.coveringNote ?? null,
    document: q.document ?? undefined,
  };
}
