import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';

/**
 * A quote that did not win has somewhere to go.
 *
 * REPORTED: "how do you 'lose' a quote? I don't see a way to mark a quote as lost if
 * the customer didn't want to go through with it. The quote will stay in 'sent'
 * status forever?"
 *
 * It would have. `lost` and `won` have been in QuoteStatus since the beginning and
 * nothing in the app could set either, so `sent` was a terminal state — every quote
 * ever sent stayed on the open list, and the list stopped meaning anything.
 */
const draft = (discount = 0.1) => ({
  technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
  profile: {}, noConstraint: [], flags: {},
  categoryDiscounts: { system: discount },
  lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
} as never);

describe('losing a quote', () => {
  it('takes a sent quote out of open work, with the reason', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(draft());
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    expect(sent.status).toBe('sent');

    const lost = await api.markQuoteLost(sent.quoteNo, 'Went with the incumbent on price.');
    expect(lost.status).toBe('lost');
    expect(lost.outcomeReason).toBe('Went with the incumbent on price.');
    expect(lost.closedAt).toBeTruthy();
  });

  it('keeps everything the quote said', async () => {
    // Losing is not deleting. What the customer was told is the part worth having
    // six months later, which is the whole reason this is a status and not a delete.
    api.setPreviewRole('rep');
    const created = await api.createQuote(draft());
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', 'Here it is.');
    const lost = await api.markQuoteLost(sent.quoteNo, 'No budget this year.');
    expect(lost.recipientEmail).toBe('buyer@test.example');
    expect(lost.lines.length).toBe(sent.lines.length);
    expect(lost.copiedTo).toEqual(sent.copiedTo);
  });

  it('puts it back where it was, not back to draft', async () => {
    // A quote that had been approved is still approved. Reopening it must not ask
    // the approver the same question again.
    api.setPreviewRole('rep');
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    expect(submitted.status).toBe('pendingApproval');

    const lost = await api.markQuoteLost(submitted.quoteNo, 'Project shelved.');
    expect(lost.status).toBe('lost');
    const back = await api.reopenQuote(lost.quoteNo);
    expect(back.status).toBe('pendingApproval');
    expect(back.closedAt ?? null).toBeNull();
  });

  it('refuses a draft, because a draft has never been in front of anybody', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(draft());
    await expect(api.markQuoteLost(created.quoteNo, 'x')).rejects.toThrow(/draft/i);
  });

  it('is idempotent', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(draft());
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    const once = await api.markQuoteLost(sent.quoteNo, 'first');
    const twice = await api.markQuoteLost(sent.quoteNo, 'second');
    // The second call must not overwrite the status it should be restoring to.
    expect(twice.statusBeforeClose).toBe(once.statusBeforeClose);
    expect(twice.outcomeReason).toBe('first');
  });
});
