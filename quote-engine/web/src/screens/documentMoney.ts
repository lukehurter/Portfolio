import type { DocumentSettings } from '../api';

/**
 * The figures the customer's copy states that are not line prices.
 *
 * There are two surfaces for one document — the page a rep reads on screen and the
 * Word file they email — and a number computed twice is a number that can disagree
 * with itself. The monthly payment was written out in both and had already drifted
 * into two shapes of the same arithmetic; the down payment is put here rather than
 * being the third copy of that mistake.
 *
 * Neither of these is a product fact. Both are arithmetic on figures somebody else
 * supplied: the leasing company's rate and Axim's published terms.
 */

/** A down payment, where the order is large enough for the terms to require one. */
export interface DownPayment {
  /** Fraction of the total, as configured. */
  pct: number;
  /** The threshold this order met. */
  overAmount: number;
  /** The money, rounded to the cent. */
  amount: number;
}

/**
 * What the down payment comes to, or null where none is due.
 *
 * REPORTED: "when something requires a down payment it doesn't say what the down
 * payment comes out to." Nothing computed it. The terms paragraph states the policy —
 * "50% down on orders over $50,000" — and rule R-085 restates it in other words when
 * the total crosses the line, and between them a rep still had to work out half of
 * the total by hand and the customer was given no figure at all.
 *
 * `total` is the order total, which already excludes optional lines. That is
 * deliberate: asking for half of something the customer has not committed to buying
 * is worse than not asking.
 */
export function downPayment(d: DocumentSettings, total: number): DownPayment | null {
  const policy = d.downPayment;
  if (!policy || !(policy.pct > 0) || !(total > 0)) return null;
  /* At or above, not above. Rule R-085 triggers on `total gte 50000` and the terms
     sentence says "over $50,000"; an order of exactly $50,000 has to land on one side
     of that and the rule is the thing that fires, so it lands where the rule puts it. */
  if (total < policy.overAmount) return null;
  return { ...policy, amount: Math.round(total * policy.pct * 100) / 100 };
}

/** A monthly figure, and what it is a monthly figure ON. */
export interface FinancingOffer {
  /** The payment, per month, for `months`. */
  monthly: number;
  /** The amount being financed: the order total less any down payment. */
  financed: number;
  /** The down payment taken off first, or 0. */
  deposit: number;
  /** True when the rep typed the figure in rather than it being computed. */
  quoted: boolean;
}

/**
 * The monthly, where the rep asked for one.
 *
 * REPORTED: "the financing is going based on the total order amount when it should be
 * the principal after the down payment." It was, and that is a real overstatement of
 * the payment — on a $62,400 order at 8.9% over 60 months it quoted $1,292 a month
 * against the $646 the customer would actually be financing after paying half up front.
 * A monthly on a quote is the number a customer takes to their board, and one that is
 * double the truth is worse than no number at all.
 *
 * The subtraction happens here rather than at the two call sites. Both surfaces draw
 * the same document and a figure computed twice is a figure that can disagree with
 * itself — which is how it was wrong in the first place, since the down payment was
 * added next to the total and the financing block was left reading the total.
 *
 * A typed figure still wins over a computed one: where the leasing company quoted a
 * monthly outright, that IS the number. They quoted it knowing the structure, and
 * recomputing it from an APR the rep rounded would put a different figure on the page
 * than the one the customer was told. It is returned unchanged and flagged `quoted`,
 * so the page can state what it applies to without implying this tool worked it out.
 */
export function financingOffer(d: DocumentSettings, total: number): FinancingOffer | null {
  const fin = d.financing;
  if (!fin?.show || !total) return null;

  const deposit = downPayment(d, total)?.amount ?? 0;
  const financed = Math.round((total - deposit) * 100) / 100;

  if (fin.monthly != null && fin.monthly > 0) {
    return { monthly: fin.monthly, financed, deposit, quoted: true };
  }
  if (fin.apr == null || !(fin.months > 0)) return null;
  /* Nothing left to finance. A down payment can only be a fraction of the total under
     the policy above, so this is unreachable today; it is here because a policy edited
     to 100% would otherwise divide a customer's payment out of nothing. */
  if (financed <= 0) return null;

  const r = fin.apr / 12;
  const payment = r === 0
    ? financed / fin.months
    : (financed * r) / (1 - (1 + r) ** -fin.months);
  return { monthly: Math.round(payment * 100) / 100, financed, deposit, quoted: false };
}
