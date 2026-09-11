// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mockApi } from '../api/mock';
import { CATALOG } from '../api/catalog';
import { EMPTY_PROFILE, type Evaluation, type QuoteDraft } from '../api';
import { QuoteDocument } from './QuoteDocument';

/**
 * One quote, two solutions.
 *
 * A quote carried a single technologyCode and the rules were chosen by it, so an
 * applicator added to a CIJ quote was priced, totalled, printed on the customer's copy —
 * and never graded, because no PALM rule was in the list. Silence that reads as approval.
 *
 * The books on a quote are live now, and each machine is graded by its own. The customer
 * copy names each solution, because a customer reading one list with a stranger in it is
 * the one person on this who was not in the room.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {} unobserve() {} disconnect() {}
  } as never;
});
afterEach(() => cleanup());

const machineOf = (tech: string) =>
  CATALOG.find((i) => i.technologyCode === tech && i.itemRole === 'printer' && i.isActive)!;

async function mixedQuote() {
  const cij = machineOf('CIJ');
  const palm = machineOf('PALM');
  const draft = {
    technologyCode: 'CIJ', customerNo: 'MID001', customerName: 'Midwest Foods',
    lineName: 'Line 3', noConstraint: [], flags: {}, categoryDiscounts: {},
    profile: { ...EMPTY_PROFILE, substrate: 'corrugated case' },
    lines: [{ itemNo: cij.itemNo, quantity: 1 }, { itemNo: palm.itemNo, quantity: 1 }],
  } as unknown as QuoteDraft;
  const ev: Evaluation = await mockApi.evaluateDraft(draft);
  return { draft, ev, cij, palm };
}

describe('a quote that carries two solutions', () => {
  it('prices and totals both books', async () => {
    const { ev, cij, palm } = await mixedQuote();
    expect(ev.lines.map((l) => l.itemNo)).toEqual([cij.itemNo, palm.itemNo]);
    expect(ev.orderTotal).toBeGreaterThan(0);
  });

  it('carries the book on every priced line', async () => {
    /* The screen should not have to re-derive a classification the engine looked up —
       the same reason the line already carries its role and its model. */
    const { ev, cij, palm } = await mixedQuote();
    expect(ev.lines.find((l) => l.itemNo === cij.itemNo)?.technologyCode).toBe('CIJ');
    expect(ev.lines.find((l) => l.itemNo === palm.itemNo)?.technologyCode).toBe('PALM');
  });

  it('grades the second solution instead of passing over it', async () => {
    /* The fault this fixes. A PALM machine on a CIJ quote used to come back with no
       assessment at all, because no PALM rule was ever in the list. */
    const { ev, palm } = await mixedQuote();
    const fit = ev.fit.find((f) => f.itemNo === palm.itemNo);
    expect(fit, 'the applicator was never assessed').toBeTruthy();
  });

  it('does not grade a machine by the other book', async () => {
    /* The reason the single-book filter existed: "a PALM rule about custom pad sizes
       turns up on a CIJ quote, which is how a rep learns to stop reading the trace."
       Still true, enforced per item now rather than per quote. */
    const { ev, cij, palm } = await mixedQuote();
    const byCode = (itemNo: string) => new Set(
      ev.fit.find((f) => f.itemNo === itemNo)?.reasons.map((r) => r.ruleCode) ?? []);
    const cijRules = byCode(cij.itemNo);
    const palmRules = byCode(palm.itemNo);
    for (const code of cijRules) expect(palmRules.has(code)).toBe(false);
  });

  it('names each solution on the customer copy', async () => {
    const { draft, ev } = await mixedQuote();
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" />);
    const table = screen.getAllByRole('table')[0];
    expect(within(table).getByText(/Continuous inkjet coder/i)).toBeTruthy();
    expect(within(table).getByText(/Print and apply labeller/i)).toBeTruthy();
  });

  it('says nothing about solutions when there is only one', async () => {
    /* A heading over the only group is furniture, and every ordinary quote is one
       solution. */
    const cij = machineOf('CIJ');
    const draft = {
      technologyCode: 'CIJ', customerNo: 'MID001', customerName: 'Midwest Foods',
      lineName: 'Line 3', noConstraint: [], flags: {}, categoryDiscounts: {},
      profile: { ...EMPTY_PROFILE },
      lines: [{ itemNo: cij.itemNo, quantity: 1 }],
    } as unknown as QuoteDraft;
    const ev: Evaluation = await mockApi.evaluateDraft(draft);
    render(<QuoteDocument draft={draft} ev={ev} quoteNo="Q-2026-0731" />);
    expect(screen.queryByText(/Continuous inkjet coder/i)).toBeNull();
  });
});
