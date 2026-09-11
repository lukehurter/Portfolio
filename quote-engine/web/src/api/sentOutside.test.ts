import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';

/**
 * A quote sent by the rep, from their own mail.
 *
 * REPORTED: "a lot of sales people want to edit their quote and add pictures and
 * whatever before they send it out, they are likely going to need to send it from
 * outside of the CPQ system, but the system is going to need them to send it via the
 * system so it gets marked as sent."
 *
 * Both halves are true and they pull against each other, so the tool gives way. What
 * actually happens otherwise is the rep sends it from Outlook and the quote says
 * `approved` for ever, and a status nobody maintains is a status nobody can report on.
 */
const quote = (discount: number) => ({
  technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
  profile: {}, noConstraint: [], flags: {},
  categoryDiscounts: { system: discount },
  lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
} as never);

describe('recording a quote the rep sent', () => {
  it('moves it to sent, with who and when', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.1));
    const sent = await api.markSentOutside(created.quoteNo, {
      to: 'buyer@test.example', note: 'sent with line drawings',
    });
    expect(sent.status).toBe('sent');
    expect(sent.sentOutside?.to).toBe('buyer@test.example');
    expect(sent.sentOutside?.note).toBe('sent with line drawings');
    expect(sent.sentOutside?.at).toBeTruthy();
    expect(sent.recipientEmail).toBe('buyer@test.example');
  });

  it('keeps the copy the customer actually received', async () => {
    // The one version the system cannot regenerate: it has their photographs and
    // their wording in it, and it is what matters when somebody asks in six months.
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.1));
    const sent = await api.markSentOutside(created.quoteNo, {
      to: 'buyer@test.example',
      file: { name: 'Q — Midwest.doc', type: 'application/msword', size: 40_000,
              dataUrl: 'data:application/msword;base64,AAAA' },
    });
    expect(sent.sentOutside?.file?.name).toBe('Q — Midwest.doc');
    expect(sent.sentOutside?.file?.dataUrl).toContain('base64');
  });

  it('copies the manager, the same as any other send', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.1));
    const sent = await api.markSentOutside(created.quoteNo, { to: 'buyer@test.example' });
    expect(sent.copiedTo).toEqual(['kbryson@axim.example']);
  });

  it('is not a way around approval', async () => {
    // The point that matters. Sending it yourself must not be the route a deep
    // discount takes to a customer without a decision on it.
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.45));
    await expect(api.markSentOutside(created.quoteNo, { to: 'buyer@test.example' }))
      .rejects.toThrow(/needs approval/i);
    const still = await api.getQuote(created.quoteNo);
    expect(still.status).not.toBe('sent');
  });

  it('works once the approval is on file', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    await api.decideApproval(
      submitted.quoteNo, submitted.approvals[0].approvalId, 'approved', 'fine');
    const sent = await api.markSentOutside(created.quoteNo, { to: 'buyer@test.example' });
    expect(sent.status).toBe('sent');
  });

  it('refuses without a recipient', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.1));
    await expect(api.markSentOutside(created.quoteNo, { to: '   ' }))
      .rejects.toThrow(/who it went to/i);
  });
});
