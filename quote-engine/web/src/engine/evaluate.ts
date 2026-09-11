import type {
  DiscountCategory, Evaluation, FitAssessment, Item, QuoteDraft, QuoteLine,
  QuoteTraceEntry, RequiredApproval, Rule, RuleTrigger,
} from '../api/types';

/**
 * The rule engine.
 *
 * ── Where this really runs ──────────────────────────────────────────────────
 * In production the authority is `api/engine.py`. A rep must not be able to
 * reach a price the server did not sanction, and the trace has to be written by
 * whatever produced the numbers, so the browser never evaluates a real quote.
 *
 * This copy exists so the preview build works with no backend, and so the
 * algorithm can be read in one file. It is deliberately a port of the same
 * steps in the same order. `../../../engine-cases.json` holds worked examples
 * that BOTH implementations are tested against, so if the two drift apart a
 * test fails rather than a customer receiving the wrong number.
 *
 * ── The order of evaluation, and why it is this order ───────────────────────
 *  1. Price     — list price × quantity, from Orbit. The tool stores no price.
 *  2. Discount  — the category discount the rep asked for, per line.
 *  3. Caps      — item caps pull an individual line back. Caps run AFTER the
 *                 category discount because a cap is a ceiling on the result,
 *                 not an alternative to it.
 *  4. Structure — requires / requireOneOf / excludes / duplicate. These read
 *                 the line set, so they must run after it is final.
 *  5. Eligibility — every condition must hold. The trace names the ones that
 *                 failed, because "no" without "which" is useless to a rep.
 *  6. Fit       — the application profile against applicationFit rules.
 *  7. Approvals — what exceeds a stated ceiling. Last, because it needs the
 *                 final discounts.
 *
 * A rule outside its effective dates never fires, at any step. That is the one
 * thing the spreadsheets could not do, and the reason a lapsed promotion sat on
 * the live CIJ sheet for seven months.
 */

export interface EngineInput {
  draft: QuoteDraft;
  items: Item[];
  rules: Rule[];
  categories: DiscountCategory[];
  /** ISO date; injected rather than read from the clock so tests are stable */
  today: string;
}

/**
 * Rounding is HALF UP, on the decimal value, and both engines must do it the same way.
 *
 * This was `Math.round(n * 100) / 100` — half up on the BINARY float — while
 * api/engine.py used `round(Decimal(str(n)), 2)`, which is half-to-EVEN. So the two
 * engines priced the same line two ways whenever a figure landed exactly on a half:
 * a $5.00 part at 17.5% came to $4.13 here and $4.12 from the service. Sweeping
 * ordinary prices and discounts finds it in the millions of combinations, not in a
 * corner. engine-cases.json could not catch it because every fixture price in it was
 * a round hundred, so no case ever produced a half. There are cases now that do.
 *
 * Two separate things were wrong, and the fix has to address both:
 *
 *  - HALF EVEN vs HALF UP. Half up is the commercial convention for money; a customer
 *    reading a quote expects half a cent to go up, and an invoice rounded to even
 *    looks wrong. So Python moved to half up rather than this side moving to even.
 *
 *  - BINARY vs DECIMAL. `n * 100` is evaluated in doubles, and the halves that matter
 *    are decimal halves. 1.005 * 100 is 100.49999999999999 in binary, so plain
 *    Math.round returned 1.00 for it while a person — and Decimal — reads 1.005 and
 *    says 1.01.
 *
 * So the rounding below never multiplies. Scaling by a power of ten to get the digits
 * into range is the obvious fix and it is wrong for the same reason as the original:
 * `Number('12.524999999999999e2')` is 1252.5, because the shifted value is rounded to
 * the nearest double on the way, and Math.round then reads a tie that the decimal
 * never had. Measured — it left 43,808 disagreements across a 13-million-value sweep.
 *
 * Instead the digits are taken from String(n) — the shortest round-tripping decimal,
 * exactly what Python's str(float) produces — and divided as integers, so the two
 * engines round the same digits by the same rule and nothing is ever approximated in
 * between.
 */
const roundDp = (n: number, dp: number): number => {
  if (!Number.isFinite(n)) return n;
  // Away from zero on a tie, which is what ROUND_HALF_UP means for negatives too.
  // The sign is taken off and put back rather than trusted to Math.round, which
  // rounds -0.5 towards +0: marginPct is negative whenever cost exceeds the net.
  const sign = n < 0 ? -1 : 1;

  // String(n) is either '12.5', '1e-7' or '1.5e+21'; all three reduce to a digit
  // string and a decimal exponent, so the value is digits x 10**-scale exactly.
  const [mantissa, exponent] = String(Math.abs(n)).split(/[eE]/);
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - (exponent === undefined ? 0 : Number(exponent));

  // Already exact at this many places, so there is nothing to decide.
  if (scale <= dp) return n;

  const divisor = 10n ** BigInt(scale - dp);
  const digits = BigInt(`${whole}${fraction}`);
  const carry = (digits % divisor) * 2n >= divisor ? 1n : 0n;
  return sign * Number(`${digits / divisor + carry}e-${dp}`);
};

const round2 = (n: number) => roundDp(n, 2);
const round4 = (n: number) => roundDp(n, 4);

/** A rule only fires inside its effective window. */
function inEffect(r: Rule, today: string): boolean {
  if (!r.isActive) return false;
  if (r.effectiveFrom && today < r.effectiveFrom) return false;
  if (r.effectiveTo && today > r.effectiveTo) return false;
  return true;
}

interface Ctx {
  qty: Map<string, number>;
  items: Map<string, Item>;
  draft: QuoteDraft;
  attrs: Set<string>; // "Name=Value" for every attribute on every quoted item
  /** net order total, available from step 4 onward; 0 while lines are being priced */
  total: number;
}

/**
 * Triggers are ANDed.
 *
 * A rule with two triggers means "when both hold", not "when either does".
 * That is what lets a fit rule say *this printer* and *this substrate* in one
 * rule instead of two that cannot see each other. A rule with no trigger never
 * fires — `validate` rejects that before it can be saved, but the engine must
 * not depend on validation having run.
 */
function engaged(r: Rule, c: Ctx): boolean {
  return r.triggers.length > 0 && r.triggers.every((t) => fires(t, c));
}

/** Does this trigger engage against the current quote? */
function fires(t: RuleTrigger, c: Ctx): boolean {
  switch (t.triggerType) {
    case 'always':
      return true;
    case 'item':
      return !!t.itemNo && (c.qty.get(t.itemNo) ?? 0) >= (t.minCount ?? 1);
    case 'role': {
      // How many DISTINCT items on the quote have this role. Distinct, not total
      // quantity: six of one ink is a year's supply, six different service items is
      // somebody adding the whole list.
      const n = [...c.qty.keys()].filter((k) => c.items.get(k)?.itemRole === t.itemRole).length;
      // 'ne' inverts it: engages when NOTHING quoted has this role. That is what
      // lets a rule say "a printer, and no accessory" — a printer going out with
      // nothing to mount it on, which no trigger could express before.
      if (t.compareOp === 'ne') return n === 0;
      return n >= (t.minCount ?? 1);
    }
    case 'category':
      return [...c.qty.keys()].some((n) => c.items.get(n)?.prodCat === t.prodCat);
    case 'itemCategory':
      // The hierarchy's own word for the kind of part. compareOp defaults to eq so
      // the common case reads as one value, and 'in' takes a list for the rules that
      // mean "a pad or a back-up pad".
      return [...c.qty.keys()].some((n) =>
        compare(c.items.get(n)?.category ?? null, t.compareOp ?? 'eq', t.compareValue));
    case 'attribute':
      return !!t.attrName && c.attrs.has(`${t.attrName}=${t.attrValue}`);
    case 'model':
      // Any quoted item whose model matches. compareOp defaults to eq; a
      // datasheet that states one ceiling for "6400/6410" becomes two rules or
      // one 'includes', not a list of 468 part numbers.
      return [...c.qty.keys()].some((n) =>
        compare(c.items.get(n)?.model ?? null, t.compareOp ?? 'eq', t.compareValue));
    case 'profile': {
      // A field the customer has no constraint on stops every rule that reads
      // it. "Any throw distance" has to mean the throw-distance rules go quiet,
      // not that they evaluate against a blank and quietly exclude machines.
      const field = t.profileField as keyof QuoteDraft['profile'] | undefined;
      if (field && (c.draft.noConstraint ?? []).includes(field)) return false;
      return compare(profileValue(c.draft, t.profileField), t.compareOp, t.compareValue);
    }
    case 'total':
      return compare(c.total, t.compareOp ?? 'gte', t.compareValue);
    default:
      return false;
  }
}

/**
 * How tall the finished mark is — which is not how much room there is to print it in.
 *
 * The print-height rules used to grade against markingWindowMm, and that field is the
 * space AVAILABLE on the pack. Read that way the arithmetic runs backwards: a 6-inch
 * clear panel ruled out every head that prints less than 6 inches, so the roomier the
 * product the fewer machines would take it, and a case with a whole blank side came
 * back with nothing recommended. Reported from use, and the field label said as much
 * the whole time — "height available to print in".
 *
 * What those rules want is the height of the code itself, and nobody is asked for it,
 * because it is not an independent fact: it is the character height times the number
 * of lines. So it is derived rather than added as a question.
 *
 * Line spacing is deliberately NOT added. A multi-line mark is taller than the sum of
 * its characters, so this understates — which makes it a floor, and every rule using
 * it asks "is the mark already taller than the head", where a floor is the safe side.
 * A mark that fails this test fails it however the leading is set.
 */
function markHeightMm(draft: QuoteDraft): number | null {
  // "Any character height" has to silence the rules derived from it too, or the
  // shrug is honoured for the field and ignored for everything computed off it.
  if ((draft.noConstraint ?? []).includes('charHeightMm')) return null;
  const p = (draft.profile ?? {}) as unknown as Record<string, string | number | null>;
  const ch = Number(p.charHeightMm);
  if (!Number.isFinite(ch) || ch <= 0) return null;
  const lines = Number(p.linesOfPrint);
  return ch * (Number.isFinite(lines) && lines >= 1 ? lines : 1);
}

/**
 * Fields a rule may trigger on that nobody is asked for.
 *
 * Exported so the rule editor can offer them. A derived field that the engines
 * understand and the editor does not is a rule an author cannot read back: the shipped
 * rule displays "Choose…" for its own trigger, and the tool is calling a working rule
 * unconfigured. The editor's test asserts this list and FIELD_LABEL together cover
 * every profileField in the shipped rules.
 */
/* Declared in api/derivedFields.ts and re-exported here for the engine's own
   callers. It moved because the rule editor wanted this constant and nothing else,
   and reaching it through this module pulled the whole pricing engine into the
   production bundle. */
export { DERIVED_FIELDS } from '../api/derivedFields';

/** Fields a rule may trigger on, plus the ones computed from them. */
export function profileValue(draft: QuoteDraft, field?: string): string | number | null {
  if (!field) return null;
  if (field === 'markHeightMm') return markHeightMm(draft);
  const p = (draft.profile ?? {}) as unknown as Record<string, string | number | null>;
  return p[field] ?? null;
}

function compare(left: string | number | null, op?: RuleTrigger['compareOp'], right?: string): boolean {
  if (left == null || right == null) return false;
  const ln = typeof left === 'number' ? left : Number(left);
  const rn = Number(right);
  const numeric = !Number.isNaN(ln) && !Number.isNaN(rn);
  switch (op ?? 'eq') {
    case 'eq': return String(left).toLowerCase() === right.toLowerCase();
    case 'ne': return String(left).toLowerCase() !== right.toLowerCase();
    case 'gt': return numeric && ln > rn;
    case 'gte': return numeric && ln >= rn;
    case 'lt': return numeric && ln < rn;
    case 'lte': return numeric && ln <= rn;
    case 'includes': return String(left).toLowerCase().includes(right.toLowerCase());
    // See engine.py: one rule for a family of substrates, and no negated form.
    case 'includesAny': return right.toLowerCase().split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .some((v) => String(left).toLowerCase().includes(v));
    case 'in': return right.split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
      .includes(String(left).toLowerCase());
    default: return false;
  }
}

export function evaluate(input: EngineInput): Evaluation {
  const { draft, items, rules, categories, today } = input;

  const itemsBy = new Map(items.map((i) => [i.itemNo, i]));
  const qty = new Map<string, number>();
  for (const l of draft.lines) qty.set(l.itemNo, (qty.get(l.itemNo) ?? 0) + l.quantity);

  const attrs = new Set<string>();
  for (const n of qty.keys())
    for (const [k, v] of Object.entries(itemsBy.get(n)?.attributes ?? {})) attrs.add(`${k}=${v}`);

  const ctx: Ctx = { qty, items: itemsBy, draft, attrs, total: 0 };
  /* A rule belongs to one technology or to all of them. Without this filter a PALM
     rule about custom pad sizes turns up on a CIJ quote, which is how a rep learns to
     stop reading the trace.

     The books are the ones ON the quote rather than the one it was started in. A quote
     can carry a coder at one station and an applicator at another, and when the filter
     was the draft's single technologyCode the applicator was priced, totalled, printed
     on the customer's copy and never graded — silence that looks like approval. What
     stops the pad-size rule reaching a CIJ printer is gradeFit, which grades an item
     by its own book; that is where the check belongs, because it is a statement about
     the item and not about the quote. */
  const books = booksOnQuote(draft, itemsBy);
  const live = rules.filter(
    (r) => inEffect(r, today) && (r.technologyCode === null || books.has(r.technologyCode)),
  );
  const trace: QuoteTraceEntry[] = [];
  const approvals: RequiredApproval[] = [];

  /**
   * Every finding leaves with a way to act on it, or with nothing pretending to be
   * one.
   *
   * `fix` is for a rule that names exact parts. Where a rule names a KIND of part
   * instead — "no stand, bracket or mount on this quote" — the kind is already in
   * its trigger, as a role the quote is missing. Reading it off there means a
   * picker appears for any rule written that way, including ones nobody has
   * written yet, and means the remedy can never disagree with the condition that
   * produced it.
   */
  const missingRole = (r: Rule): string | undefined =>
    r.triggers.find((t) => t.triggerType === 'role' && t.compareOp === 'ne')?.itemRole;

  const say = (r: Rule, status: QuoteTraceEntry['status'], headline: string,
               fix?: QuoteTraceEntry['fix']) => {
    const pickRole = fix?.length ? undefined : missingRole(r);
    trace.push({
      ruleCode: r.ruleCode, ruleSummary: r.summary, sourceRef: r.sourceRef,
      author: r.author, status, headline, ...(fix?.length ? { fix } : {}),
      ...(pickRole ? { pickRole } : {}),
    });
  };

  /* 1–3. Price, discount, caps ---------------------------------------------- */

  // Every cap that applies to an item, from any rule that is firing.
  const caps = new Map<string, { pct: number; ruleCode: string }>();
  for (const r of live) {
    if (!engaged(r, ctx)) continue;
    for (const a of r.actions) {
      if (a.actionType !== 'cap' || !a.itemNo || a.maxDiscount == null) continue;
      const held = caps.get(a.itemNo);
      // The tightest cap wins. Two rules capping the same part is a policy
      // question, but quoting the looser of the two is never the safe reading.
      if (!held || a.maxDiscount < held.pct) caps.set(a.itemNo, { pct: a.maxDiscount, ruleCode: r.ruleCode });
    }
  }

  /* A draft that omits categoryDiscounts is valid input — nothing has been discounted
     yet — and this read used to crash on it while the Python engine, which uses a
     defaulted get, carried on. A client sending a minimal draft would have got a
     working answer from the service and a white screen from the preview. */
  const askedDiscounts = draft.categoryDiscounts ?? {};

  const lines: QuoteLine[] = draft.lines.map((dl, idx) => {
    const item = itemsBy.get(dl.itemNo);
    const listPrice = item?.listPrice ?? null;
    const catCode = item?.discountCatCode ?? null;
    const asked = catCode ? askedDiscounts[catCode] ?? 0 : 0;
    const cap = caps.get(dl.itemNo);
    const applied = cap && cap.pct < asked ? cap.pct : asked;
    const netUnit = listPrice == null ? null : round4(listPrice * (1 - applied));
    return {
      lineNo: idx + 1,
      itemNo: dl.itemNo,
      description: item?.description ?? dl.itemNo,
      /* What the item IS, carried on the priced line. The configurator reads it to
         know which requirements a quote already satisfies, and a screen should not
         have to re-derive a classification the engine already looked up. */
      itemRole: item?.itemRole ?? null,
      /* Which station this line serves, carried on the priced line so a screen can
         group by solution without re-deriving it. */
      solutionId: dl.solutionId ?? null,
      /* And which book it came from, so a quote carrying two solutions can show them
         apart. Derived here rather than on the screen for the same reason as the role:
         one lookup, one answer. */
      technologyCode: item?.technologyCode ?? null,
      model: item?.model ?? null,
      quantity: dl.quantity,
      optional: dl.optional === true,
      listPrice,
      discountCatCode: catCode,
      categoryDiscount: asked,
      appliedDiscount: applied,
      cappedByRule: cap && cap.pct < asked ? cap.ruleCode : null,
      netUnit,
      extendedList: listPrice == null ? null : round2(listPrice * dl.quantity),
      extendedNet: netUnit == null ? null : round2(netUnit * dl.quantity),
    };
  });

  for (const [itemNo, cap] of caps) {
    const hit = lines.find((l) => l.itemNo === itemNo && l.cappedByRule === cap.ruleCode);
    if (!hit) continue;
    const r = live.find((x) => x.ruleCode === cap.ruleCode)!;
    say(r, 'warning', `${hit.description}: ${pct(hit.categoryDiscount ?? 0)} requested, held to ${pct(cap.pct)}.`);
  }

  /* 4. Structure ------------------------------------------------------------ */

  // Lines are priced, so a rule may now ask about the order value.
  ctx.total = round2(lines.reduce((s, l) => s + (l.extendedNet ?? 0), 0));

  let blocked = false;

  for (const r of live) {
    if (!engaged(r, ctx)) continue;

    for (const a of r.actions) {
      switch (a.actionType) {
        case 'require': {
          if (!a.itemNo) break;
          const have = qty.get(a.itemNo) ?? 0;
          const need = a.quantity ?? 1;
          if (have >= need) {
            say(r, 'satisfied', `${label(a.itemNo, itemsBy)} is on the quote.`);
          } else {
            // The rule knows the part and the shortfall, so it hands them over.
            // A rep should not have to read a sentence, memorise a part number and
            // go and search for it — that round trip is where the prototype's
            // one-click fix went missing.
            say(r, 'action',
              `Add ${need - have} × ${label(a.itemNo, itemsBy)}${a.message ? ` — ${a.message}` : ''}`,
              [{ itemNo: a.itemNo, quantity: need - have,
                 description: itemsBy.get(a.itemNo)?.description ?? null }]);
          }
          break;
        }
        case 'pickOne': {
          // The mirror of requireOneOf: that speaks up when none of the set is
          // quoted, this when more than one is. Five printhead poles of different
          // lengths are a choice, not a kit.
          const set = r.actions.filter((x) => x.actionType === 'pickOne' && x.itemNo);
          if (a !== set[0]) break;
          const on = set.filter((x) => (qty.get(x.itemNo!) ?? 0) > 0);
          if (on.length > 1) {
            say(r, 'warning',
              a.message
                ?? `Only one of these is normally needed, and ${on.length} are on the quote: `
                   + `${on.map((x) => label(x.itemNo!, itemsBy)).join(', ')}.`);
          }
          break;
        }
        case 'requireOneOf': {
          const options = r.actions.filter((x) => x.actionType === 'requireOneOf' && x.itemNo);
          const met = options.some((x) => (qty.get(x.itemNo!) ?? 0) > 0);
          if (a === options[0]) {
            say(r, met ? 'satisfied' : 'action',
              met ? 'One of the accepted options is on the quote.'
                  : `Add one of: ${options.map((x) => label(x.itemNo!, itemsBy)).join(', ')}.`);
          }
          break;
        }
        case 'exclude': {
          // An exclude action must name what it excludes. One that names
          // nothing would block every quote it engages on, which is never what
          // the author meant — `validate` rejects it on save, and the engine
          // refuses to act on it in case an older row slipped through.
          if (!a.itemNo) break;
          if ((qty.get(a.itemNo) ?? 0) > 0) {
            blocked = true;
            say(r, 'blocked', a.message ?? `${label(a.itemNo, itemsBy)} cannot be quoted here.`);
          }
          break;
        }
        case 'warn':
          say(r, 'warning', a.message ?? r.summary);
          break;
        case 'substitute':
          say(r, 'info',
            `${a.message ?? 'An alternative exists'}${a.itemNo ? ` — ${label(a.itemNo, itemsBy)}` : ''}.`);
          break;
        case 'allowance':
          if (a.allowanceAmt != null) say(r, 'info', `Allowance of ${money(a.allowanceAmt)} applies.`);
          break;
        default:
          break;
      }
    }

    /* 5. Eligibility ------------------------------------------------------- */

    if (r.conditions.length) {
      const failed = r.conditions.filter((c) => !holds(c, ctx));
      if (failed.length === 0) {
        say(r, 'satisfied', `All ${r.conditions.length} conditions hold.`);
      } else {
        const which = failed.map((c) => c.label).join('; ');
        if (r.severity === 'block') {
          blocked = true;
          say(r, 'blocked', `${failed.length} of ${r.conditions.length} conditions not met — ${which}.`);
        } else {
          say(r, 'warning', `Not met: ${which}.`);
        }
        const ap = r.actions.find((x) => x.actionType === 'approve');
        if (ap) approvals.push({
          ruleCode: r.ruleCode,
          reason: ap.message ?? r.summary,
          requestedPct: null, statedMax: null,
          approverRole: ap.approverRole ?? null,
        });
      }
    }
  }

  /* 6. Fit ------------------------------------------------------------------ */

  /* One assessment per (solution, item), in the order the lines were added. The same
     item at two stations is two rows, because the two stations can answer the
     application differently and get different answers. */
  const targets: FitTarget[] = [];
  for (const l of draft.lines) {
    const pair: FitTarget = [l.solutionId ?? null, l.itemNo];
    if (!targets.some((t) => t[0] === pair[0] && t[1] === pair[1])) targets.push(pair);
  }
  const fit = gradeFit(live, ctx, targets);

  /* 7. Approvals ------------------------------------------------------------ */

  const capsByCat = new Map(categories.map((c) => [c.code, c.maxDiscount]));
  const approvalRule = live.find((r) => r.ruleType === 'approval'
    && r.actions.some((a) => a.actionType === 'approve'));

  for (const [code, askedPct] of Object.entries(draft.categoryDiscounts ?? {})) {
    const ceiling = capsByCat.get(code);
    if (ceiling == null || askedPct <= ceiling) continue;
    // Used on no line, so it is not a real request.
    if (!lines.some((l) => l.discountCatCode === code)) continue;
    const cat = categories.find((c) => c.code === code)!;
    approvals.push({
      ruleCode: approvalRule?.ruleCode ?? null,
      reason: `${cat.displayName} discount of ${pct(askedPct)} is past the stated maximum of ${pct(ceiling)}.`,
      requestedPct: askedPct,
      statedMax: ceiling,
      approverRole: approvalRule?.actions.find((a) => a.actionType === 'approve')?.approverRole
        ?? 'Regional Sales Manager',
    });
    if (approvalRule) say(approvalRule, 'action',
      `${cat.displayName} discount ${pct(askedPct)} is past the stated ${pct(ceiling)}.`);
  }

  /* Totals ------------------------------------------------------------------ */

  /* Committed lines only. An optional line is a price the customer may or may not
     take, so adding it to the order total states a number nobody has agreed to — and
     it would flow into the margin and the discount percentage as well, which are the
     two figures a manager reads before approving. */
  const committed = lines.filter((l) => !l.optional);
  const optionalLines = lines.filter((l) => l.optional);
  const extendedList = round2(committed.reduce((s, l) => s + (l.extendedList ?? 0), 0));
  const netOfLines = round2(committed.reduce((s, l) => s + (l.extendedNet ?? 0), 0));
  const optionalNet = round2(optionalLines.reduce((s, l) => s + (l.extendedNet ?? 0), 0));

  /* Money off the order, after the percentages.
     Clamped at the net, because an amount larger than the quote is a typo and a
     negative order total is not a thing a rep should be able to send. */
  const askedFlat = Math.max(0, draft.flatDiscount ?? 0);
  const flatDiscountApplied = round2(Math.min(askedFlat, netOfLines));
  const extendedNet = round2(netOfLines - flatDiscountApplied);
  /* Stated as a percentage whatever it was entered as. The rules are written in
     percentages and so is every ceiling, so a flat amount that takes the quote past
     one has to show up here or it is a way round the approval. */
  const totalDiscount = extendedList > 0 ? round4(1 - extendedNet / extendedList) : 0;

  // Margin needs standard cost from Orbit. If any line lacks one, the figure
  // would be wrong rather than approximate, so it is withheld and said so.
  const missingCost = committed.filter((l) => itemsBy.get(l.itemNo)?.stdCost == null);
  let marginPct: number | null = null;
  let marginNote: string | null = null;
  if (missingCost.length === 0 && extendedNet > 0) {
    const cost = committed.reduce(
      (s, l) => s + (itemsBy.get(l.itemNo)!.stdCost ?? 0) * l.quantity, 0);
    marginPct = round4((extendedNet - cost) / extendedNet);
  } else if (missingCost.length > 0) {
    marginNote = missingCost.length === committed.length
      ? 'No standard cost in Orbit for these items, so margin cannot be stated.'
      : `${missingCost.length} of ${committed.length} lines carry no standard cost, so margin would be overstated.`;
  }

  return {
    lines, trace, requiredApprovals: approvals, fit,
    extendedList, extendedNet, totalDiscount,
    flatDiscountApplied, optionalNet,
    orderTotal: extendedNet,
    marginPct, marginNote,
    blocked,
  };
}

function holds(c: { conditionKind: string; attrName?: string; attrValue?: string; itemNo?: string; flagName?: string }, ctx: Ctx): boolean {
  switch (c.conditionKind) {
    case 'attribute': return !!c.attrName && ctx.attrs.has(`${c.attrName}=${c.attrValue}`);
    case 'item': return !!c.itemNo && (ctx.qty.get(c.itemNo) ?? 0) > 0;
    case 'flag':
    case 'term': return !!c.flagName && (ctx.draft.flags ?? {})[c.flagName] === true;
    default: return false;
  }
}

/**
 * Sort order, and the escalation order within an assessed item.
 *
 * 'notAssessed' sits after 'caveat' deliberately. A caveat is a machine somebody
 * examined and had a qualified opinion about; notAssessed is a machine nobody has
 * examined. A known small problem is a better thing to offer a customer than an
 * unknown, so the qualified answer ranks above the silent one.
 *
 * It never participates in escalation — an item is assessed or it is not, and
 * gradeFit tracks that separately rather than reading it off this table.
 */
const FIT_ORDER = { good: 0, caveat: 1, notAssessed: 2, notRecommended: 3 } as const;

/**
 * Fit grading. Every grade comes from a rule someone wrote, with its code
 * attached — there are no thresholds compiled into this file.
 *
 * An item nobody has written a fit rule about grades 'notAssessed'. This used to
 * be 'good', with a comment calling it honest because it meant "nothing is known
 * against it". That reasoning was sound and the result was not: the screen has no
 * way to draw the difference between a machine a datasheet endorses and a machine
 * nobody has ever written a rule about, so 947 CIJ printers came back as good
 * fits. A reviewer asked for 10,000,000 fpm and still got recommendations.
 *
 * Absence of evidence needs its own grade, or it silently becomes evidence of
 * absence — in the direction that puts an unsuitable machine in front of a
 * customer.
 *

 * Each item is graded in a context containing ONLY itself.
 *
 * That matters. Fit asks "does this item suit the application", so an attribute
 * trigger has to mean the candidate's own attribute. Graded against the whole
 * quote, a rule reading `Color = Black` sees the union of every line's
 * attributes, and a black printer sitting on the quote condemns the white one
 * beside it — which is precisely backwards, since the white one is the answer.
 */
/**
 * Does this rule say anything about the item, or only about the application?
 *
 * A trigger on the item number, the model or an attribute means the rule is about
 * a particular thing. A rule with only profile triggers describes the technology,
 * and grading every consumable and accessory against it produces findings that are
 * true of the book and meaningless about the part.
 */
function aboutTheItem(r: Rule): boolean {
  return r.triggers.some((t) => t.triggerType === 'item'
    || t.triggerType === 'model' || t.triggerType === 'attribute');
}

/**
 * Every price book a quote draws on: the one it was started in, and the book of
 * anything actually on it.
 *
 * `ALL` is not a book of its own — a service offering or a promotion belongs to every
 * quote — so it is left out rather than widening the rule set by a whole technology.
 */
function booksOnQuote(
  draft: Pick<QuoteDraft, 'technologyCode' | 'lines'>,
  items: Map<string, Item>,
): Set<string> {
  const books = new Set<string>([draft.technologyCode]);
  for (const l of draft.lines ?? []) {
    const tech = items.get(l.itemNo)?.technologyCode;
    if (tech && tech !== 'ALL') books.add(tech);
  }
  return books;
}

/**
 * The draft as one solution sees it: the quote's application with that solution's own
 * answers laid over the top.
 *
 * Absent means "as the quote says", so an ordinary quote merges nothing and is
 * unchanged. The engine does not know which fields are station-level and does not need
 * to — it merges what it is given.
 */
function draftFor(draft: QuoteDraft, solutionId: string | null): QuoteDraft {
  if (!solutionId) return draft;
  const sol = (draft.solutions ?? []).find((s) => s.id === solutionId);
  if (!sol) return draft;
  let out = draft;
  if (sol.profile && Object.keys(sol.profile).length > 0) {
    out = { ...out, profile: { ...out.profile, ...sol.profile } };
  }
  /* Answered as a whole rather than field by field: a station that has been asked
     carries its own list, and an empty list means "nothing is unconstrained here"
     rather than "ask the quote". Undefined is what means ask the quote. */
  if (sol.noConstraint !== undefined) out = { ...out, noConstraint: sol.noConstraint };
  return out;
}

/** One assessment per (solution, item). See the Python engine. */
type FitTarget = readonly [solutionId: string | null, itemNo: string];

function gradeFit(live: Rule[], base: Ctx, targets: readonly FitTarget[]): FitAssessment[] {
  return targets.map(([solutionId, itemNo]) => {
    const item = base.items.get(itemNo);
    /* This station's answers over the quote's. See draftFor.

       Graded per SOLUTION rather than per item, so the same printhead quoted at two
       stations is assessed twice against two applications. It used to be graded once
       for the whole quote against whichever profile its price book carried, which
       could not express two stations sharing a book at all. */
    const solo: Ctx = {
      ...base,
      draft: draftFor(base.draft, solutionId),
      qty: new Map([[itemNo, base.qty.get(itemNo) ?? 1]]),
      attrs: new Set(Object.entries(item?.attributes ?? {}).map(([k, v]) => `${k}=${v}`)),
    };

    const reasons: FitAssessment['reasons'] = [];
    let grade: FitAssessment['grade'] = 'good';
    let assessed = false;

    for (const r of live) {
      if (r.ruleType !== 'applicationFit') continue;
      /* This machine's own book. On a quote with a coder at one station and an
         applicator at another, both books' rules are live — and a rule from the other
         one has nothing to say about this part. */
      if (r.technologyCode !== null && item?.technologyCode !== 'ALL'
          && r.technologyCode !== item?.technologyCode) continue;
      // A rule that names nothing about the ITEM — only the application — is a
      // statement about the technology, not about this part. "Small character CIJ
      // is aimed at primary packs" is a reason not to choose CIJ for a case; it is
      // not a reason to grade the UPS battery backup on the quote NOT RECOMMENDED,
      // which is what a saved quote was showing. The same went for a service kit.
      // Three findings, two of them noise, is how a rep learns to skim the panel.
      if (!aboutTheItem(r) && item?.itemRole !== 'printer') continue;
      if (!engaged(r, solo)) continue;
      for (const a of r.actions) {
        if (a.actionType !== 'grade' || !a.fitGrade) continue;
        if (a.itemNo && a.itemNo !== itemNo) continue;
        assessed = true;
        if (FIT_ORDER[a.fitGrade] > FIT_ORDER[grade]) grade = a.fitGrade;
        reasons.push({ ruleCode: r.ruleCode, text: a.message ?? r.summary,
          author: r.author ?? null, sourceRef: r.sourceRef ?? null });
      }
    }
    return {
      itemNo,
      // Which station this grade is about. Two rows may share an item number.
      solutionId,
      description: item?.description ?? itemNo,
      grade: assessed ? grade : 'notAssessed', reasons,
      itemRole: item?.itemRole ?? null,
      model: item?.model ?? null,
      listPrice: item?.listPrice ?? null,
    };
  });
}

/**
 * What makes two rows the same machine, or null when this row is not grouped.
 *
 * Exported because the machine COUNT has to group the same way the machine LIST
 * does. It did not, and the price-book chip offered "CIJ · 947 machines" above a list
 * showing nine — 947 being the part numbers, because a Corvus SKU is a printer already
 * filled with a printhead, an ink and a colour. Reported as "why does cij say 947
 * machines 1155 parts", and the same shape as "VIJ says 8 good when there's only 4":
 * a counter and a list answering one question two ways.
 *
 * An item that does not carry the identity attributes is not grouped. Treating
 * "absent" as a value put every such item in one bucket together — two machines that
 * merely both lack a Printer Type are not the same machine, and collapsing them would
 * hide one behind the other.
 */
export function identityKey(
  attributes: Record<string, string>,
  groupOn: string[],
): string | null {
  if (!groupOn.length) return null;
  if (groupOn.some((k) => !attributes[k])) return null;
  // A NUL separator, not a space: attribute values are full of spaces
  // ("6400 Dye Based"), so a space would let two identities collide.
  return groupOn.map((k) => attributes[k] ?? '').join('\u0000');
}

/**
 * How many distinct machines a book holds, counted the way the list shows them.
 *
 * Not how many part numbers have a role of printer, which is what the chip used to
 * say. A rep choosing a price book is choosing between machines.
 */
export function countMachines(
  items: Item[],
  technologyCode: string,
  identity: string[] | undefined,
): number {
  const printers = items.filter(
    (i) => i.technologyCode === technologyCode && i.itemRole === 'printer' && i.isActive);
  const groupOn = identity ?? [];
  const seen = new Set<string>();
  let ungrouped = 0;
  for (const i of printers) {
    const key = identityKey(i.attributes ?? {}, groupOn);
    if (key == null) ungrouped += 1;
    else seen.add(key);
  }
  return seen.size + ungrouped;
}

/**
 * Items worth offering for a captured application, best fit first.
 *
 * `attributes` and `q` narrow the candidates BEFORE grading, which is the only
 * order that works: a CIJ book holds 1,157 printer configurations, and grading
 * all of them to throw most away is wasted work at the point a rep is typing.
 */
export function suggest(
  input: Omit<EngineInput, 'draft'> & {
    draft: Pick<QuoteDraft, 'technologyCode' | 'profile'>
      & Pick<Partial<QuoteDraft>, 'noConstraint' | 'lines'>;
    attributes?: Record<string, string>;
    q?: string;
    /**
     * What to rank on once fit has spoken, per item number.
     *
     * `orders` is how many distinct sales orders included the part over a trailing
     * window, from Orbit's oelinhst_sql. Distinct orders rather than summed
     * quantity: one customer buying a thousand of something does not make it the
     * popular choice. It is absent in the preview, because there is no order
     * history here and inventing one would be inventing a business fact.
     *
     * `documented` is whether the model has a datasheet and a photograph. It is a
     * weak signal about the product and a strong one about the quote — a rep can
     * put a picture and a specification in front of a customer.
     */
    rank?: Record<string, { orders?: number; documented?: boolean }>;
    /**
     * The attributes that say WHICH MACHINE a row is.
     *
     * A Corvus part number is a printer already filled — printer, printhead, ink and
     * colour in one SKU — so nine machines, six printheads and forty-eight inks
     * arrive as 947 rows and "which machine" gets answered with a catalogue. Rows
     * sharing an identity collapse to the best-graded one, which carries how many
     * orderable configurations stand behind it.
     *
     * An identity attribute already being filtered on is not grouped on: once a rep
     * has said "6420 Dye Based", its configurations are exactly what they want to
     * see. The grouping lifts itself as the question narrows.
     */
    identity?: string[];
    /**
     * Which item roles to consider. Machines when absent.
     *
     * This function was machine-only, with the filter written inline, and the panel
     * calling it stopped asking the moment a machine was on the quote — so the tool
     * did its thinking about the hardest decision and then went quiet for the ink,
     * the photocell, the bracket and the service kit, which is most of the lines on
     * a real quote. The grading and ranking below are not specific to printers;
     * only the filter was.
     */
    roles?: string[];
    /**
     * Attribute values the application has already ruled out, per attribute name.
     *
     * Softer than `attributes`, and deliberately: that one is a filter a rep set, so
     * an item without the attribute fails it. This one is the application talking, so
     * an item WITHOUT the attribute is kept — a mounting bracket has no Surface and
     * saying nothing about porosity is not the same as disagreeing about it. Only an
     * item that carries the attribute and states a value not in the list is dropped.
     *
     * The lists are computed by the caller rather than matched here, because the
     * comparison differs by attribute and the difference matters: "Black Thermo" is
     * a black ink, and "Non-porous" contains the word "porous".
     */
    narrow?: Record<string, string[]>;
    /**
     * The same narrowing, for parts that state it in words instead of attributes.
     *
     * The catalogue is not uniform about where a fact lives, and pretending it is
     * would leave half the answer out: all 947 CIJ printers carry Color as an
     * attribute and not one CIJ ink does — an ink says "Black Semi-Pigmented 1009" in
     * its description and nothing else. Porosity is the mirror image: VIJ and PIJ
     * items carry a Surface attribute, and the ink lines that matter say
     * "Non-Porous (MEK)" in the description.
     *
     * Scoped by role, because the words are only reliable where they are part of how
     * the part is named. A bracket called "Blue Handle" is not a blue ink, and
     * dropping it would take away the thing the head mounts on.
     */
    deny?: { roles: string[]; patterns: string[] };
  },
): FitAssessment[] {
  const { items, rules, today } = input;
  const words = (input.q ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const wanted = new Set(input.roles?.length ? input.roles : ['printer']);
  const chosen = Object.entries(input.attributes ?? {}).filter(([, v]) => v);

  const candidates = items.filter((i) => {
    // ALL belongs to every book. It is rare for a machine and normal for the service
    // and promotion lines a rep adds to any quote.
    const book = i.technologyCode === input.draft.technologyCode || i.technologyCode === 'ALL';
    if (!book || !i.isActive) return false;
    if (!wanted.has(i.itemRole ?? '')) return false;
    for (const [name, value] of chosen) if (i.attributes[name] !== value) return false;
    for (const [name, allowed] of Object.entries(input.narrow ?? {})) {
      const have = i.attributes[name];
      if (have != null && !allowed.includes(have)) return false;
    }
    if (input.deny && input.deny.roles.includes(i.itemRole ?? '')
        && input.deny.patterns.some((w) => new RegExp(w, 'i').test(i.description))) {
      return false;
    }
    if (words.length) {
      const hay = (i.itemNo + ' ' + i.description + ' '
        + Object.values(i.attributes).join(' ')).toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  /* What is already on the quote.
     Grading a companion in an empty context makes every rule about the machine
     silent, and "what goes with an 6400" is exactly a rule about the machine. The
     lines are read for context only — nothing here prices them. */
  const onQuote = input.draft.lines ?? [];
  const itemsBy = new Map(items.map((i) => [i.itemNo, i]));
  const attrs = new Set<string>();
  for (const l of onQuote) {
    for (const [k, v] of Object.entries(itemsBy.get(l.itemNo)?.attributes ?? {})) {
      attrs.add(`${k}=${v}`);
    }
  }
  const ctx: Ctx = {
    qty: new Map(onQuote.map((l) => [l.itemNo, l.quantity])),
    items: itemsBy,
    draft: {
      ...input.draft, customerNo: null, customerName: null, lineName: null,
      flags: {}, categoryDiscounts: {}, lines: onQuote,
      /* Nothing here is graded for a station — `suggest` answers "which machine"
         against the quote's own application, and the caller narrows to one book
         before asking. So the stations are dropped rather than half-applied. */
      solutions: [],
    },
    attrs,
    total: 0,
  };
  const live = rules.filter(
    (r) => inEffect(r, today)
      && (r.technologyCode === null || r.technologyCode === input.draft.technologyCode),
  );

  // gradeFit already grades each item in a context containing only itself, so
  // suggestion is exactly "grade every candidate", best fit first.
  //
  // Then, in order, and every step of it is a fact rather than a preference:
  //
  //  1. FIT       what the datasheets say about this application. Nothing outranks
  //               it; a popular machine that cannot code the pack is not an answer.
  //  2. REASONS   within a grade, an item a rule positively endorses outranks one
  //               nothing is known about. This started mattering with the real
  //               catalogue — among 947 CIJ printers the vast majority have no fit
  //               rule at all, so without it they bury the one machine a rule
  //               actually recommends.
  //  3. ORDERS    how often it is really bought, from sales history. A machine the
  //               company sells every week is a safer recommendation than an
  //               equally-suitable one nobody has ordered since 2019 — parts
  //               availability, field familiarity and installation experience all
  //               follow the volume. Absent in the preview; see `rank`.
  //  4. DOCUMENTED whether the rep can put a datasheet and a photograph in front of
  //               the customer. Last, because it describes the quote rather than
  //               the machine.
  //  5. ITEM NO   so the order is stable and two runs never disagree.
  const rank = input.rank ?? {};
  const orders = (n: string) => rank[n]?.orders ?? 0;
  const documented = (n: string) => (rank[n]?.documented ? 1 : 0);
  // Nothing is on the quote yet, so no station owns these — they are graded against
  // the quote's own application.
  const ordered = gradeFit(live, ctx,
    candidates.map((c) => [null, c.itemNo] as FitTarget)).sort(
    (a, b) =>
      FIT_ORDER[a.grade] - FIT_ORDER[b.grade]
      || (b.reasons.length ? 1 : 0) - (a.reasons.length ? 1 : 0)
      || orders(b.itemNo) - orders(a.itemNo)
      || documented(b.itemNo) - documented(a.itemNo)
      || a.itemNo.localeCompare(b.itemNo),
  );

  // Collapse configurations of one machine, after the ordering has decided which of
  // them speaks for it — the representative has to be the best-fitting configuration,
  // not whichever happened to come first in the catalogue.
  const groupOn = (input.identity ?? []).filter((k) => !(input.attributes ?? {})[k]);
  if (!groupOn.length) return ordered;

  const out: FitAssessment[] = [];
  const first = new Map<string, FitAssessment>();
  for (const f of ordered) {
    const attrs = ctx.items.get(f.itemNo)?.attributes ?? {};
    const key = identityKey(attrs, groupOn);
    if (key == null) { out.push(f); continue; }
    const rep = first.get(key);
    if (rep) rep.variants = (rep.variants ?? 1) + 1;
    else {
      const made: FitAssessment = {
        ...f,
        variants: 1,
        identity: Object.fromEntries(groupOn.map((k) => [k, attrs[k] ?? ''])),
      };
      first.set(key, made);
      out.push(made);
    }
  }
  return out;
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (itemNo: string, items: Map<string, Item>) => {
  const i = items.get(itemNo);
  return i ? `${i.description} (${itemNo})` : itemNo;
};
