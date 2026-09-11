// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { mockApi } from '../api/mock';
import { DEFAULT_DOCUMENT, EMPTY_PROFILE } from '../api/types';
import type { Evaluation, QuoteDraft } from '../api/types';
import { QuoteDocument } from './QuoteDocument';

/**
 * The customer's copy must not carry Axim's arithmetic.
 *
 * The review dialog previewed the CONTENTS of a quote — lines, totals, what needed
 * approval. Useful to the rep, and not the thing being sent; a customer receives a
 * document, and nobody had looked at that document because it did not exist.
 *
 * When one was built, the risk moved rather than disappearing. Every figure the app knows
 * is one careless binding away from a page a customer reads, and the expensive ones are
 * margin, standard cost and the discount percentage. A quote showing 35% off invites a
 * conversation about 40%; a quote showing margin invites a different conversation entirely.
 *
 * So this test asserts absence, which is the only way to test a leak that has not happened
 * yet.
 */

afterEach(cleanup);

async function fixture(): Promise<{ draft: QuoteDraft; ev: Evaluation }> {
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
  };
  const ev = await mockApi.evaluateDraft(draft);
  return { draft, ev };
}

describe('the customer copy', () => {
  it('shows what they pay and what they are buying', async () => {
    const { draft, ev } = await fixture();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" repName="D. Ruiz" />);

    expect(screen.getByText('Quotation')).toBeTruthy();
    expect(screen.getAllByText(/Q-2026-0731/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Midwest Foods/).length).toBeGreaterThan(0);
    // Every line the quote holds is on the page the customer gets.
    for (const l of ev.lines) {
      expect(screen.getAllByText(l.itemNo).length, `${l.itemNo} missing`).toBeGreaterThan(0);
    }
  });

  it('carries no discount, margin or list price', async () => {
    const { draft, ev } = await fixture();
    const { container } = render(
      <QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" repName="D. Ruiz" />,
    );
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/discount/i);
    expect(text).not.toMatch(/margin/i);
    expect(text).not.toMatch(/list price/i);
    expect(text).not.toMatch(/\bcost\b/i);
    expect(text).not.toMatch(/approval/i);

    // And no rule codes: the trace is how Axim priced it, not what was bought.
    expect(text).not.toMatch(/\b[AQRF]-[A-Z0-9-]{3,}\b/);

    // The list price of a discounted line must not appear anywhere on the page.
    const discounted = ev.lines.find((l) => l.netUnit != null && l.listPrice != null
      && l.netUnit !== l.listPrice);
    if (discounted) {
      const list = discounted.listPrice!.toLocaleString('en-US', { minimumFractionDigits: 2 });
      expect(text.includes(list), `list price ${list} leaked onto the customer copy`).toBe(false);
    }
  });

  it('carries the supplied terms, and nothing beyond them', async () => {
    const { draft, ev } = await fixture();
    const { container } = render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" />);
    const slot = container.querySelector('.terms-slot');
    expect(slot, 'the terms slot must exist so its absence is visible').toBeTruthy();
    const said = slot!.textContent ?? '';

    // The commercial facts off the price-page terms block, and the sentence that does
    // the legal work.
    expect(said).toMatch(/Net 30/);
    expect(said).toMatch(/50% down on orders over \$50,000/);
    expect(said).toMatch(/F\.O\.B\. Ashfield, IL/);
    expect(said).toMatch(/axim\.example\/terms-of-sale/);
    expect(said).toMatch(/incorporated herein by reference/);

    /* The point of the original empty slot: no invented commercial term reaches a
       customer. Now that there is supplied wording, the guard is that nothing outside it
       has crept in — none of these appear anywhere in what Axim provided, and each
       one is a promise this tool has no standing to make. */
    expect(said).not.toMatch(/liabilit|indemnif|arbitrat|governing law|restocking|cancellation fee|guarantee/i);
  });

  it('shows a visible gap if a rep clears the terms', async () => {
    const { draft, ev } = await fixture();
    const { container } = render(
      <QuoteDocument draft={{ ...draft, document: { ...DEFAULT_DOCUMENT, terms: '' } }}
                     ev={ev} quoteNo="Q-2026-0731" />);
    expect(container.querySelector('.terms-slot')!.textContent).toMatch(/to be inserted/i);
  });

  it('marks a prospect for the file copy only', async () => {
    const { draft, ev } = await fixture();
    const prospect: QuoteDraft = {
      ...draft, customerNo: null, customerName: 'Bay State Bottling',
      newCustomer: { companyName: 'Bay State Bottling', contactName: 'A. Nunes',
        email: 'a@baystate.example', city: 'Fall River', state: 'MA' },
    };
    const { container } = render(<QuoteDocument draft={prospect} ev={ev} quoteNo="Q-2026-0900" />);
    const mark = container.querySelector('.internal-only');
    expect(mark, 'a prospect quote must be recognisable on the rep file copy').toBeTruthy();
    // .internal-only is hidden by the print stylesheet, so it never reaches the customer.
    expect(mark!.textContent).toMatch(/INTERNAL/);
  });
});
