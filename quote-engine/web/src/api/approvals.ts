/**
 * What counts as an outstanding approval.
 *
 * Shared, because the quote screen, the customer-copy screen and the send dialog
 * all have to reach the same answer as the server. When they did not, an approved
 * quote read as still needing approval on every screen and could never be sent.
 */
/**
 * Is this requirement already answered?
 *
 * Same rule as the server: an approver said yes to terms, not to a quote in
 * perpetuity, so a decision covers a requirement when it is the same rule at the same
 * requested discount. Deepen the discount and it needs asking again.
 */
export function isCovered(
  required: { ruleCode: string | null; requestedPct: number | null },
  decided: { ruleCode: string | null; requestedPct: number | null; status: string }[],
): boolean {
  return decided.some((d) => d.status === 'approved'
    && d.ruleCode === required.ruleCode
    && d.requestedPct === required.requestedPct);
}
