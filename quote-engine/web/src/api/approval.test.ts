import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';
import { isCovered } from './approvals';

/**
 * The approver's two decisions have to move the quote in opposite directions.
 *
 * Reported in a production-readiness review and confirmed in the code: approving set the
 * status to `draft`, and declining had no branch at all, so it stayed in
 * `pendingApproval`. Between them that is exactly backwards — the approver's yes pushed
 * the quote back to the start and their no left it stuck.
 */
describe('an approval decision', () => {
  it('approving moves the quote forward to approved', async () => {
    const q = await api.getQuote('Q-2026-0731');
    expect(q.status).toBe('pendingApproval');
    expect(q.approvals.length).toBeGreaterThan(0);
    const after = await api.decideApproval(q.quoteNo, q.approvals[0].approvalId, 'approved', '');
    expect(after.status).toBe('approved');
    expect(after.approvalsPending).toBe(0);
  });

  it('declining sends it back to the rep as a draft', async () => {
    const created = await api.createQuote({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
      profile: {}, noConstraint: [], flags: {},
      categoryDiscounts: { system: 0.45 },
      lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
    } as never);
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    expect(sent.status).toBe('pendingApproval');
    const after = await api.decideApproval(sent.quoteNo, sent.approvals[0].approvalId, 'declined', 'Too deep.');
    expect(after.status).toBe('draft');
  });
});

/**
 * An approval already granted is not asked for again.
 *
 * Reported after use: approve a quote, then send it as the rep, and it went straight
 * back to awaiting approval. `submitQuote` rebuilt the approval list from the
 * evaluation on every send, so the approver's decision was replaced by a fresh
 * `pending` record of the very same requirement and the quote could never leave.
 */
describe('sending a quote that has been approved', () => {
  const draft = (discount: number) => ({
    technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
    profile: {}, noConstraint: [], flags: {},
    categoryDiscounts: { system: discount },
    lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
  } as never);

  it('goes out rather than back into the queue', async () => {
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    expect(submitted.status).toBe('pendingApproval');

    const approved = await api.decideApproval(
      submitted.quoteNo, submitted.approvals[0].approvalId, 'approved', 'Fine at this volume.');
    expect(approved.status).toBe('approved');

    const sent = await api.submitQuote(approved.quoteNo, 'buyer@test.example', '');
    expect(sent.status, 'an approved quote that is sent is sent').toBe('sent');
    expect(sent.approvalsPending).toBe(0);
    // The decision itself survives, so the record of who allowed it is not lost.
    expect(sent.approvals[0].status).toBe('approved');
    expect(sent.approvals[0].note).toBe('Fine at this volume.');
  });

  it('asks again when the rep deepens the discount after approval', async () => {
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    await api.decideApproval(
      submitted.quoteNo, submitted.approvals[0].approvalId, 'approved', 'ok');

    // The approval was for 45%. This is not that quote any more.
    await api.saveQuote(submitted.quoteNo, draft(0.6));
    const again = await api.submitQuote(submitted.quoteNo, 'buyer@test.example', '');
    expect(again.status, 'different terms need a new decision').toBe('pendingApproval');
    expect(again.approvals.some((a) => a.status === 'pending')).toBe(true);
  });

  it('will not send a declined quote', async () => {
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    const declined = await api.decideApproval(
      submitted.quoteNo, submitted.approvals[0].approvalId, 'declined', 'Too deep for a first order.');
    expect(declined.status).toBe('draft');

    /* Refused at the API, not merely marked. A status of 'draft' was not a gate:
       the send still succeeded, so a rep could be told no and send it anyway. */
    await expect(api.submitQuote(submitted.quoteNo, 'buyer@test.example', ''))
      .rejects.toThrow(/declined this quote/i);
    // And the reason the approver gave travels with the refusal.
    await expect(api.submitQuote(submitted.quoteNo, 'buyer@test.example', ''))
      .rejects.toThrow(/Too deep for a first order/);
    expect((await api.getQuote(submitted.quoteNo)).status).toBe('draft');
  });

  it('goes back for a new decision once the rep changes the terms', async () => {
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    await api.decideApproval(
      submitted.quoteNo, submitted.approvals[0].approvalId, 'declined', 'Too deep.');

    /* A decline is about the terms it was given, not about the quote forever. Bring
       the discount down and it is a different quote — one nobody has ruled on. */
    await api.saveQuote(submitted.quoteNo, draft(0.3));
    const again = await api.submitQuote(submitted.quoteNo, 'buyer@test.example', '');
    expect(again.status).not.toBe('draft');
    expect(again.approvals.every((a) => a.status !== 'declined'),
      'the old refusal does not follow the new terms').toBe(true);
  });

  it('keeps the approver note where the rep will read it', async () => {
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    const decided = await api.decideApproval(
      submitted.quoteNo, submitted.approvals[0].approvalId, 'declined',
      '  Not at 45% on a first order. 30% goes through today.  ');
    expect(decided.approvals[0].note).toBe('Not at 45% on a first order. 30% goes through today.');
    expect(decided.approvals[0].decidedAt).toBeTruthy();
  });
});

/**
 * A refusal has to be escapable.
 *
 * Declining stopped the send, which was right. But saving recomputed the quote and
 * left the approvals alone, so the declined record outlived the terms it was about:
 * a rep who did exactly what the approver asked still could not resubmit.
 */
describe('after a decline', () => {
  const draft = (discount: number) => ({
    technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
    profile: {}, noConstraint: [], flags: {},
    categoryDiscounts: { system: discount },
    lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
  } as never);

  it('lets the rep do what was asked and send again', async () => {
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    await api.decideApproval(submitted.quoteNo, submitted.approvals[0].approvalId,
      'declined', '30% would go through.');
    await expect(api.submitQuote(submitted.quoteNo, 'buyer@test.example', ''))
      .rejects.toThrow(/declined/i);

    // Do what the approver asked.
    const saved = await api.saveQuote(submitted.quoteNo, draft(0.3));
    expect(saved.approvals.some((a) => a.status === 'declined'),
      'the old refusal does not survive the change it asked for').toBe(false);

    const again = await api.submitQuote(submitted.quoteNo, 'buyer@test.example', '');
    expect(again.status).not.toBe('draft');
  });

  it('keeps a decision that still describes the quote', async () => {
    /* The mirror of the case above: saving must not throw away an approval that is
       still about these terms, or pressing Save would quietly re-open a settled
       question. */
    const created = await api.createQuote(draft(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    await api.decideApproval(submitted.quoteNo, submitted.approvals[0].approvalId,
      'approved', 'Fine.');

    const saved = await api.saveQuote(submitted.quoteNo, draft(0.45));
    expect(saved.approvals.some((a) => a.status === 'approved')).toBe(true);

    const sent = await api.submitQuote(submitted.quoteNo, 'buyer@test.example', '');
    expect(sent.status).toBe('sent');
  });
});

/**
 * An approved quote is sendable, and the screens have to agree that it is.
 *
 * The rules still require an approval for a 45% discount after somebody has approved
 * it — the requirement does not go away, the decision is what changed. Every screen
 * asked "does this require approval", so an approved quote said "Send for approval"
 * for ever and the address field was never offered. It could not be sent at all.
 */
describe('what counts as outstanding', () => {
  const required = { ruleCode: 'R-DISC', requestedPct: 0.45 };

  it('a granted decision covers the requirement it was granted for', () => {
    expect(isCovered(required, [
      { ruleCode: 'R-DISC', requestedPct: 0.45, status: 'approved' },
    ])).toBe(true);
  });

  it('a decision at different terms covers nothing', () => {
    expect(isCovered(required, [
      { ruleCode: 'R-DISC', requestedPct: 0.30, status: 'approved' },
    ]), 'approving 30% does not approve 45%').toBe(false);
  });

  it('a pending or declined record is not cover', () => {
    expect(isCovered(required, [
      { ruleCode: 'R-DISC', requestedPct: 0.45, status: 'pending' },
    ])).toBe(false);
    expect(isCovered(required, [
      { ruleCode: 'R-DISC', requestedPct: 0.45, status: 'declined' },
    ])).toBe(false);
  });

  it('sends to the customer once the approval is in', async () => {
    const draft = {
      technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
      profile: {}, noConstraint: [], flags: {},
      categoryDiscounts: { system: 0.45 },
      lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
    } as never;

    const created = await api.createQuote(draft);
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', 'Competitor at 45%.');
    expect(submitted.status).toBe('pendingApproval');
    // The rep's case goes to the approver, not into the customer's covering letter.
    expect(submitted.approvalNote).toBe('Competitor at 45%.');
    expect(submitted.coveringNote ?? '').not.toBe('Competitor at 45%.');

    const approved = await api.decideApproval(
      submitted.quoteNo, submitted.approvals[0].approvalId, 'approved', 'Fine.');
    expect(approved.status).toBe('approved');

    // Nothing is outstanding now, so the quote goes out.
    const live = await api.evaluateDraft(draft);
    const outstanding = live.requiredApprovals
      .filter((r) => !isCovered(r, approved.approvals));
    expect(outstanding, 'an approved quote has nothing outstanding').toEqual([]);

    const sent = await api.submitQuote(approved.quoteNo, 'buyer@test.example', 'Thanks for your time.');
    expect(sent.status).toBe('sent');
    // And now the note IS the customer's, because that is who it went to.
    expect(sent.coveringNote).toBe('Thanks for your time.');
    expect(sent.approvalNote, 'the internal case is kept, not overwritten')
      .toBe('Competitor at 45%.');
  });
});

/**
 * The manager sees every quote, not only the ones that needed them.
 *
 * REPORTED as a question — "is the manager automatically cc'd onto every quote? They
 * need to be" — and the answer was no. The reporting line was consulted when a
 * discount needed approving and at no other time, so a manager's view of what their
 * line was quoting consisted entirely of its exceptions.
 */
describe('the manager copy', () => {
  const quote = (discount: number) => ({
    technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
    profile: {}, noConstraint: [], flags: {},
    categoryDiscounts: { system: discount },
    lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
  } as never);

  it('copies the manager on a quote that needed no approval', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.10));
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    expect(sent.status).toBe('sent');
    expect(sent.copiedTo).toEqual(['kbryson@axim.example']);
  });

  it('does not record a copy while it is still waiting on one', async () => {
    // Going for approval is not going to the customer, and a Copied to line on a
    // quote that has not been sent says it has.
    api.setPreviewRole('rep');
    const created = await api.createQuote(quote(0.45));
    const submitted = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    expect(submitted.status).toBe('pendingApproval');
    expect(submitted.copiedTo ?? null).toBeNull();
  });

  it('still sends when the reporting line resolves to nobody', async () => {
    // An admin has no approver above them in the preview. The quote has to leave
    // anyway — a customer waiting on a document is not the place to enforce an org
    // chart.
    api.setPreviewRole('admin');
    const created = await api.createQuote(quote(0.10));
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    expect(sent.status).toBe('sent');
    expect(sent.copiedTo ?? null).toBeNull();
    api.setPreviewRole('rep');
  });
});

/**
 * Approved means approved, whatever the rep touches next.
 *
 * REPORTED: "after a quote has been approved, if the rep makes any changes to the
 * customer copy it requires approval again."
 *
 * The API was already right — this asserts that, so the next person to touch
 * saveQuote finds out here. The defect was in SendDialog, which asked "does this
 * quote REQUIRE an approval" rather than "is one OUTSTANDING". A 45% quote requires
 * one for ever; approving it does not change the rules, it adds a decision.
 */
describe('editing an approved quote', () => {
  const deep = () => ({
    technologyCode: 'CIJ', customerNo: null, customerName: 'Test Co', lineName: 'L1',
    profile: {}, noConstraint: [], flags: {},
    categoryDiscounts: { system: 0.45 },
    lines: [{ itemNo: 'Z167N714HJU', quantity: 1 }],
  } as never);

  it('keeps the approval when only the customer copy changes', async () => {
    api.setPreviewRole('rep');
    const created = await api.createQuote(deep());
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    const ok = await api.decideApproval(
      sent.quoteNo, sent.approvals[0].approvalId, 'approved', 'fine');
    expect(ok.status).toBe('approved');

    const q = await api.getQuote(ok.quoteNo);
    const saved = await api.saveQuote(q.quoteNo, {
      technologyCode: q.technologyCode, customerNo: q.customerNo ?? null,
      customerName: q.customerName ?? null, lineName: q.lineName ?? null,
      profile: q.profile, noConstraint: q.noConstraint ?? [], flags: q.flags ?? {},
      categoryDiscounts: q.categoryDiscounts ?? {},
      lines: q.lines.map((l) => ({ itemNo: l.itemNo, quantity: l.quantity })),
      document: { validDays: 45 },
    } as never);

    expect(saved.status).toBe('approved');
    expect(saved.approvals.filter((a) => a.status === 'approved')).toHaveLength(1);
    // And the requirement it answers is still answered, which is what the dialog reads.
    const ev = await api.evaluateDraft({
      technologyCode: q.technologyCode, customerNo: null, customerName: null,
      lineName: null, profile: q.profile, noConstraint: [], flags: {},
      categoryDiscounts: q.categoryDiscounts ?? {},
      lines: q.lines.map((l) => ({ itemNo: l.itemNo, quantity: l.quantity })),
    } as never);
    expect(ev.requiredApprovals.filter((r) => !isCovered(r, saved.approvals))).toEqual([]);
  });

  it('does ask again when the discount actually moves', async () => {
    // The guard on the guard: silencing the re-ask must not silence a real one.
    api.setPreviewRole('rep');
    const created = await api.createQuote(deep());
    const sent = await api.submitQuote(created.quoteNo, 'buyer@test.example', '');
    const ok = await api.decideApproval(
      sent.quoteNo, sent.approvals[0].approvalId, 'approved', 'fine');
    const q = await api.getQuote(ok.quoteNo);
    const saved = await api.saveQuote(q.quoteNo, {
      technologyCode: q.technologyCode, customerNo: null, customerName: 'Test Co',
      lineName: null, profile: q.profile, noConstraint: [], flags: {},
      categoryDiscounts: { system: 0.55 },
      lines: q.lines.map((l) => ({ itemNo: l.itemNo, quantity: l.quantity })),
    } as never);
    const ev = await api.evaluateDraft({
      technologyCode: q.technologyCode, customerNo: null, customerName: null,
      lineName: null, profile: q.profile, noConstraint: [], flags: {},
      categoryDiscounts: { system: 0.55 },
      lines: q.lines.map((l) => ({ itemNo: l.itemNo, quantity: l.quantity })),
    } as never);
    expect(ev.requiredApprovals.filter((r) => !isCovered(r, saved.approvals)).length)
      .toBeGreaterThan(0);
  });
});
