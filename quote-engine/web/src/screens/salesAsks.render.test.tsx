// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { mockApi } from '../api/mock';
import { DEFAULT_DOCUMENT, EMPTY_PROFILE } from '../api/types';
import type { DocumentSettings, Evaluation, QuoteDraft } from '../api/types';
import { QuoteDocument } from './QuoteDocument';

/**
 * The three things the sales team asked to see on the customer's copy.
 *
 * Optional lines, an amount off, and a monthly payment. All three are ways of putting
 * a second number in front of a customer, and all three fail the same way if they are
 * done carelessly: the customer reads the wrong figure as the price. So what is
 * asserted here is mostly separation — that the total is the total, and everything
 * else is visibly not it.
 */

afterEach(cleanup);

async function fixture(over: Partial<QuoteDraft> = {}) {
  const q = await mockApi.getQuote('Q-2026-0731');
  const draft: QuoteDraft = {
    technologyCode: q.technologyCode,
    customerNo: q.customerNo ?? null, customerName: q.customerName ?? null,
    lineName: q.lineName ?? null,
    profile: q.profile ?? EMPTY_PROFILE, noConstraint: [], flags: {},
    categoryDiscounts: q.categoryDiscounts ?? {},
    solutions: q.solutions ?? [],
    lines: q.lines.map((l) => ({
      itemNo: l.itemNo, quantity: l.quantity, solutionId: l.solutionId,
    })),
    recipientEmail: 'dwhitfield@midwestfoods.example',
    ...over,
  };
  const ev: Evaluation = await mockApi.evaluateDraft(draft);
  return { draft, ev };
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

describe('optional lines on the customer copy', () => {
  it('keeps an optional line out of the total and states it separately', async () => {
    const base = await fixture();
    const last = base.draft.lines[base.draft.lines.length - 1];
    const { draft, ev } = await fixture({
      lines: base.draft.lines.map((l) =>
        (l.itemNo === last.itemNo ? { ...l, optional: true } : l)),
    });

    // The engine has already taken it out of the money.
    expect(ev.orderTotal).toBeLessThan(base.ev.orderTotal);
    expect(ev.optionalNet).toBeGreaterThan(0);
    expect(ev.orderTotal + ev.optionalNet!).toBeCloseTo(base.ev.orderTotal, 2);

    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" />);
    // And the page says which is which, rather than leaving the customer to add up.
    expect(screen.getByText(/Also available, not included above/i)).toBeTruthy();
    expect(screen.getByText(/If taken, in addition to the total above/i)).toBeTruthy();
  });

  it('shows no optional section when nothing is optional', async () => {
    const { draft, ev } = await fixture();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" />);
    expect(screen.queryByText(/Also available, not included above/i)).toBeNull();
  });
});

describe('an amount off', () => {
  it('is shown as a discount rather than silently lowering the total', async () => {
    // A total simply smaller than the lines add up to invites the customer to ask
    // what happened to the difference.
    const { draft, ev } = await fixture({ flatDiscount: 500 });
    expect(ev.flatDiscountApplied).toBe(500);
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" />);
    expect(screen.getByText(/Less discount/i)).toBeTruthy();
  });

  it('never puts the discount percentage among the figures', async () => {
    // It is on the rep's screen because every ceiling is a percentage. It is not
    // beside the money the customer reads, for the same reason no other discount
    // figure is. The terms block below states 50% and 100% down payments, which are
    // contractual terms rather than anything to do with what this quote was
    // discounted by — so the assertion is scoped to the priced table.
    const { draft, ev } = await fixture({ flatDiscount: 500 });
    const { container } = render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" />);
    const table = container.querySelector('table')!;
    expect(table.textContent).not.toMatch(/%/);
    expect(table.textContent).not.toMatch(new RegExp(String(ev.totalDiscount)));
  });
});

/* REPORTED: "when something requires a down payment it doesn't say what the down
   payment comes out to." The policy was stated twice and computed nowhere — the terms
   paragraph says "50% down on orders over $50,000" and rule R-085 says the same thing
   in other words when the total crosses it. Neither is a number. */
describe('a down payment', () => {
  it('states what it comes to, not just the policy', async () => {
    const { draft, ev } = await fixture();
    // The seeded quote is well under the threshold, so make one that is over it.
    const big = { ...ev, orderTotal: 62_400 } as Evaluation;
    render(<QuoteDocument draft={draft} ev={big} quoteNo="Q-2026-0731" />);
    const block = screen.getByText(/Due with order/i).closest('section')!;
    expect(within(block).getByText(new RegExp(money(31_200).replace('.', '\\.')))).toBeTruthy();
    // And says where the figure came from, so it does not read as a new charge.
    expect(within(block).getByText(/50% of/i)).toBeTruthy();
  });

  it('says nothing on an order below the threshold', async () => {
    const { draft, ev } = await fixture();
    const small = { ...ev, orderTotal: 49_999 } as Evaluation;
    render(<QuoteDocument draft={draft} ev={small} quoteNo="Q-2026-0731" />);
    expect(screen.queryByText(/Due with order/i)).toBeNull();
  });

  it('asks for half of what was bought, not half of what was offered', async () => {
    /* Optional lines are out of orderTotal and so out of this. Asking a customer for
       50% of something they have not committed to buying is worse than not asking. */
    const base = await fixture();
    const last = base.draft.lines[base.draft.lines.length - 1];
    const { draft, ev } = await fixture({
      lines: base.draft.lines.map((l) =>
        (l.itemNo === last.itemNo ? { ...l, optional: true } : l)),
    });
    const over = { ...ev, orderTotal: 80_000 } as Evaluation;
    render(<QuoteDocument draft={draft} ev={over} quoteNo="Q-2026-0731" />);
    const block = screen.getByText(/Due with order/i).closest('section')!;
    expect(within(block).getByText(new RegExp(money(40_000).replace('.', '\\.')))).toBeTruthy();
    // Not half of the total plus the optional line.
    const wrong = money(40_000 + (over.optionalNet ?? 0) / 2);
    expect(within(block).queryByText(new RegExp(wrong.replace('.', '\\.')))).toBeNull();
  });
});

describe('a monthly payment', () => {
  const withFinancing = (over: Partial<NonNullable<DocumentSettings['financing']>>) => ({
    ...DEFAULT_DOCUMENT,
    financing: { ...DEFAULT_DOCUMENT.financing!, show: true, ...over },
  });

  it('works the payment out from the term and the rate', async () => {
    const { draft, ev } = await fixture();
    // The standard amortising payment, stated here independently of the component.
    const P = ev.orderTotal, r = 0.089 / 12, n = 60;
    const expected = Math.round(((P * r) / (1 - (1 + r) ** -n)) * 100) / 100;

    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: 0.089, months: 60 })} />);
    const block = screen.getByText(/Or from/i).closest('section')!;
    expect(within(block).getByText(new RegExp(money(expected).replace('.', '\\.')))).toBeTruthy();
  });

  /* REPORTED: "the financing is going based on the total order amount when it should
     be the principal after the down payment."

     It was, and every test here passed anyway: the seeded quote totals about $13,000,
     which is under the $50,000 the down payment starts at, so no deposit was ever taken
     off and the two figures agreed by never being tested together. A monthly that is
     double the truth is the worst number on a quote — it is the one a customer takes to
     their board. */
  it('finances the balance after the down payment, not the whole order', async () => {
    const { draft, ev } = await fixture();
    const over = { ...ev, orderTotal: 62_400 } as Evaluation;
    const deposit = 31_200;                       // 50% of 62,400
    const r = 0.089 / 12, n = 60;
    const onBalance = Math.round((((over.orderTotal - deposit) * r) / (1 - (1 + r) ** -n)) * 100) / 100;
    const onTotal = Math.round(((over.orderTotal * r) / (1 - (1 + r) ** -n)) * 100) / 100;
    expect(onTotal).toBeGreaterThan(onBalance);   // the two really are different

    render(<QuoteDocument draft={draft} ev={over} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: 0.089, months: 60 })} />);
    const block = screen.getByText(/Or from/i).closest('section')!;
    expect(within(block).getByText(new RegExp(money(onBalance).replace('.', '\.')))).toBeTruthy();
    expect(within(block).queryByText(new RegExp(money(onTotal).replace('.', '\.')))).toBeNull();
  });

  it('says what the monthly is a monthly on', async () => {
    /* A payment sitting under a total reads as the total spread over the term. With a
       deposit taken first the two do not divide into each other, and a customer who
       tries is entitled to think one of the numbers is wrong. */
    const { draft, ev } = await fixture();
    const over = { ...ev, orderTotal: 62_400 } as Evaluation;
    render(<QuoteDocument draft={draft} ev={over} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: 0.089, months: 60 })} />);
    const block = screen.getByText(/Or from/i).closest('section')!;
    expect(within(block).getByText(/financed, after the/i)).toBeTruthy();
    expect(within(block).getByText(new RegExp(money(31_200).replace('.', '\.')))).toBeTruthy();
  });

  it('leaves the sentence off when nothing is due up front', async () => {
    const { draft, ev } = await fixture();     // well under the threshold
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: 0.089, months: 60 })} />);
    const block = screen.getByText(/Or from/i).closest('section')!;
    expect(within(block).queryByText(/financed, after the/i)).toBeNull();
  });

  it('uses a monthly typed in, rather than recomputing it', async () => {
    // Where the leasing company quoted a figure, that IS the figure. Recomputing it
    // from a rounded rate would put a different number on the page than the one the
    // customer was given.
    const { draft, ev } = await fixture();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: 0.089, months: 60, monthly: 299 })} />);
    const block = screen.getByText(/Or from/i).closest('section')!;
    expect(within(block).getByText(/299\.00/)).toBeTruthy();
  });

  it('handles an interest-free term without dividing by zero', async () => {
    const { draft, ev } = await fixture();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: 0, months: 12 })} />);
    const block = screen.getByText(/Or from/i).closest('section')!;
    expect(within(block).getByText(new RegExp(money(
      Math.round((ev.orderTotal / 12) * 100) / 100).replace('.', '\\.')))).toBeTruthy();
  });

  it('says nothing at all when there is no rate and no figure', async () => {
    // An empty financing block on a commercial document is worse than none.
    const { draft, ev } = await fixture();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: null, monthly: null })} />);
    expect(screen.queryByText(/Or from/i)).toBeNull();
  });

  it('prints the conditions with the figure', async () => {
    const { draft, ev } = await fixture();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731"
                          settings={withFinancing({ apr: 0.089, months: 60 })} />);
    expect(screen.getByText(/subject to credit approval/i)).toBeTruthy();
    expect(screen.getByText(/Not an offer of finance/i)).toBeTruthy();
  });

  it('is off unless somebody turns it on', async () => {
    const { draft, ev } = await fixture();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731"
                          settings={DEFAULT_DOCUMENT} />);
    expect(screen.queryByText(/Or from/i)).toBeNull();
  });
});
