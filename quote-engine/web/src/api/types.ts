/**
 * The API contract.
 *
 * These shapes mirror the tables in ../../sql. The UI is written against this
 * and nothing else, so the mock and the real FastAPI service are
 * interchangeable — swapping them is one line in ./index.ts.
 */

export type Role = 'rep' | 'approver' | 'admin';

export interface Session {
  username: string;
  displayName: string;
  role: Role;
  /**
   * Why the user has this role — shown in the account menu, never inferred.
   *
   * `entraGroup` is a Microsoft 365 group the person is in. It was `adGroup`, an
   * on-premises Active Directory group read from a header the Windows-auth proxy
   * set; IT will not have the app work that way, so the identity comes from Entra
   * ID as a validated token instead. Everything downstream of "who is calling and
   * which groups" is unchanged by that.
   */
  roleSource: 'entraGroup' | 'override';
  /**
   * How a customer reaches this person, from the same Entra ID token as the name.
   *
   * The quote goes out over the rep's name and used to give a customer no way to
   * answer it — a document with a "Prepared by" line and nothing under it is asking
   * the customer to go and find the email it came in on.
   *
   * Both are nullable and both are simply omitted when absent. A directory with no
   * phone number on a record is normal, and a plausible-looking number on a document
   * a customer will actually dial is worse than a gap.
   */
  email: string | null;
  phone: string | null;
  approver: {
    username: string; displayName: string; resolvedBy: ApproverSource;
    /** Where the copy of a sent quote goes. Null means it cannot be sent to them. */
    email?: string | null;
  } | null;
}

export type ApproverSource = 'override' | 'entraManager' | 'technology' | 'unroutable';

/**
 * The sentinel technology: an item that belongs to every price book.
 *
 * A promotion, a service offering or a training day is not CIJ or laser — it is sold
 * alongside whatever the customer is buying. Until now technology was mandatory for a
 * quotable item, so those had to be filed under one book and became invisible in the
 * other six, or filed under none and became unquotable.
 */
export const ALL_TECHNOLOGIES = 'ALL';

export interface Technology {
  code: string;
  name: string;
  ruleCount: number;
  itemCount: number;
  /**
   * How many of those items are machines.
   *
   * The chooser offered "VIJ · 3 items" and "TIJ · 1 items", and picking either
   * landed on an empty machine list — the count was of everything in the technology,
   * so it promised a machine that was not there and understated the gap. A rep needs
   * both figures: what is pickable now, and how much else the book carries.
   */
  machineCount: number;
}

/**
 * How well a price book suits the application the rep has already described.
 *
 * The chooser used to offer "CIJ · 947 machines · 1,157 parts". A rep does not
 * choose a technology by how many part numbers it has; they choose it by whether
 * it can code this pack at this speed, and the tool had that answer and was not
 * saying it. Counting is not recommending.
 *
 * `strong` counts machines a datasheet positively endorses for this application —
 * not machines nothing is known against, which is why notAssessed is carried
 * separately rather than folded in with them.
 */
export interface BookFit {
  technologyCode: string;
  strong: number;
  caveat: number;
  notAssessed: number;
  notRecommended: number;
  /** true when the book holds machines and every one of them is ruled out */
  allRuledOut: boolean;
}

export type RuleType =
  | 'requires' | 'excludes' | 'duplicate' | 'eligibility'
  | 'substitution' | 'applicationFit' | 'approval' | 'discountCap' | 'note'
  /**
   * What the application rules out BEFORE anything is graded.
   *
   * ASKED: "do the rules drive the application fit logic or is there a hidden layer
   * in code?" Grading was always entirely rule-driven; this was the hidden layer.
   * Two comparisons removed candidates before any rule saw them — on a porous,
   * black-ink application, 284 of 947 CIJ printer configurations and half the VIJ
   * book — with no rule code, no citation and nothing on the screen.
   *
   * It still narrows rather than grades, because grading 284 rules-out rows puts
   * back the noise the narrowing exists to remove. See data/application-narrowing.md.
   */
  | 'narrowing';

export type Severity = 'info' | 'warn' | 'block';

export interface RuleTrigger {
  id?: number;
  /**
   * 'total' compares the order total against compareValue, which is how a rule
   * like "orders of $50,000 or more need 50% down" says what it actually means
   * rather than firing on every quote.
   */
  /**
   * 'model' matches the item's Product Type from the hierarchy — 6420, 5400
   * IP65, PH4. That is how a specification-derived rule names what it applies
   * to: the 6400 datasheet states a speed ceiling for the 6400, not for a list
   * of part numbers, and there are 468 part numbers in the Corvus 6400 line.
   */
  /**
   * On a 'role' trigger, compareOp 'ne' inverts it: it engages when NOTHING on the
   * quote has that role. Two of them ANDed — a printer present, an accessory
   * absent — is how a rule says "this machine is going out with nothing to mount
   * it on", which nothing could express before.
   */
  /**
   * 'itemCategory' matches the hierarchy's own word for what a part IS — Stands,
   * Conveyor, Tamp Pad, Ribbon, Brackets. Distinct from 'category', which matches
   * Orbit's product category code, because the two answer different questions and a
   * rule author needs to be able to say which one they mean.
   *
   * It is the trigger that makes the deeper classification worth having: R-091 is a
   * note about custom PAD sizes and could only be expressed as "any accessory", so it
   * fired on every bracket, stand and conveyor on a PALM quote.
   */
  triggerType: 'item' | 'role' | 'category' | 'itemCategory' | 'attribute' | 'model'
    | 'profile' | 'total' | 'always';
  itemNo?: string;
  itemRole?: string;
  prodCat?: string;
  attrName?: string;
  attrValue?: string;
  profileField?: string;
  /**
   * 'in' compares against a comma-separated list. Datasheets state one figure
   * for several models at once — "6400/6410: 3 lines" — and writing that as
   * 'includes 89' silently catches the 6440 as well, which is how a rule saying
   * "only the 6440 is IP65" ended up applying to the 6440.
   */
  compareOp?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'includesAny'
    | 'in'
    /**
     * The profile field names one of compareValue's colour words.
     *
     * By word, not by substring: "black ink" names black, "blackcurrant juice"
     * does not. Only a `narrowing` rule uses it, and only to decide whether the
     * rule engages at all — which colour was named is the matcher's business.
     */
    | 'matchesColour';
  compareValue?: string;
  minCount?: number;
}

export interface RuleAction {
  id?: number;
  /**
   * 'pickOne' names a set of alternatives. It is the mirror of 'requireOneOf':
   * that one speaks up when none of the set is quoted, this one when more than one
   * is. Five printhead poles of different lengths are a choice, not a kit, and
   * quoting all five went through silently.
   */
  actionType:
    | 'require' | 'requireOneOf' | 'pickOne' | 'exclude' | 'warn'
    | 'substitute' | 'cap' | 'approve' | 'grade' | 'allowance' | 'narrow';
  itemNo?: string;
  /**
   * Which comparison a `narrow` action uses.
   *
   * Named rather than spelt in trigger primitives because both comparisons are more
   * particular than any compareOp: "Non-porous" contains the word "porous", and
   * "black" has to match "Black Thermo" without matching "Sky Blue". The rule carries
   * the what and the why; this says which comparison implements it.
   */
  matcher?: 'porosity' | 'inkColour';
  /** The item attribute the matcher narrows on — Surface, Color. */
  attribute?: string;
  /**
   * Item roles whose DESCRIPTION may also be read, comma separated.
   *
   * The catalogue is not uniform about where a fact lives: all 947 CIJ printers carry
   * Color as an attribute and not one CIJ ink does. Scoped by role, because the words
   * are only reliable where they are part of how the part is named — a bracket called
   * "Blue Handle" is not a blue ink.
   */
  denyRoles?: string;
  quantity?: number;
  maxDiscount?: number;
  fitGrade?: 'good' | 'caveat' | 'notRecommended';
  approverRole?: string;
  allowanceAmt?: number;
  message?: string;
  remedy?: string;
}

export interface RuleCondition {
  id?: number;
  seq: number;
  label: string;
  conditionKind: 'attribute' | 'item' | 'flag' | 'term';
  attrName?: string;
  attrValue?: string;
  itemNo?: string;
  flagName?: string;
}

export interface Rule {
  ruleCode: string;
  technologyCode: string | null;
  ruleType: RuleType;
  summary: string;
  detail: string | null;
  sourceRef: string | null;
  author: string | null;
  severity: Severity;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  triggers: RuleTrigger[];
  actions: RuleAction[];
  conditions: RuleCondition[];
  updatedBy?: string | null;
  updatedAt?: string | null;
}

/** What the admin screen shows before you open a rule. */
export interface RuleSummary {
  ruleCode: string;
  technologyCode: string | null;
  ruleType: RuleType;
  summary: string;
  author: string | null;
  sourceRef: string | null;
  severity: Severity;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** how many quote lines this rule has fired on in the last 90 days */
  firedCount: number;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  field: string;
  message: string;
}

/** A rule is never saved without passing this. */
export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface RuleAuditEntry {
  auditId: number;
  action: string;
  changedBy: string;
  changedAt: string;
  summary: string;
}

/** An item as Orbit knows it, plus what the tool adds. */
export interface Item {
  itemNo: string;
  description: string;
  prodCat: string;
  prodCatDesc: string;
  /**
   * What kind of part this is, a level below its role.
   *
   * Asked for by the sales team: an "accessory" is 145 things on the PALM book and
   * knowing that much does not help anybody quote. The hierarchy has always carried
   * the answer in its Product Type column — Stands, Conveyor, Conveyor Mount,
   * Brackets, Scanner, Floor Mount, Ribbon, Solvents — and the build was reading that
   * column for the model and discarding the half of it that names a kind of part.
   *
   * Null where nothing said. Not guessed from the description: a category invented
   * from a word in a part name is a filter that quietly hides the parts it got wrong.
   */
  category?: string | null;
  technologyCode: string;
  itemRole: string;
  discountCatCode: string;
  listPrice: number | null;
  /** Orbit standard cost. Null for items that carry none — margin then cannot be stated. */
  stdCost?: number | null;
  /** Product Type from the hierarchy: 6420, 5400 IP65, PH4. What rules match on. */
  model?: string;
  /** which source classified this item — 'manual' | 'hierarchy' | 'pricePage' */
  classSource?: string;
  uom: string;
  isActive: boolean;
  attributes: Record<string, string>;
  /** from the captured product pages, when the item maps to a catalogued product */
  imageFile?: string;
}

/**
 * An item whose classification needs a person — and only those.
 *
 * `unclassified` — nothing knows what it is. `unearnedMachine` — the product line
 * says printer and nothing names a model, so it resolved to `part`; promote it or
 * leave it, and either answer removes the row.
 *
 * `fallback` used to be here: 740 items typed from the price-page sheet they sat
 * on. It was the wrong list, and a review said so precisely — if a row is already
 * correct you cannot shorten the list without making it wrong. Those items are
 * still visible as `classSource` on the item itself, which is where distrusting one
 * belongs; they are not a queue anybody can finish.
 *
 * Nothing is hidden to tidy this up: Orbit is the superset, and a tool that
 * silently omits a part somebody sells is worse than one that admits the gap.
 */
export type ReviewReason = 'unclassified' | 'unearnedMachine';

/**
 * Whether an item's classification is settled.
 *
 * `needsTechnology` and `needsType` are separate because they are different questions
 * with different answers, and a part can be missing one without the other. `unearned`
 * is the machine claim nothing supports: the line says printer and no model names it.
 */
export type ClassifyStatus =
  | 'classified' | 'needsTechnology' | 'needsType' | 'unearned'
  /**
   * A hand-classification that now says exactly what the sources say.
   *
   * An override beats the hierarchy for ever, which is right when a person knows
   * better and wrong once the data catches up: fix a product line and every override
   * made before it silently keeps winning, so the tool obeys a decision nobody
   * remembers making. These are the ones safe to drop.
   */
  | 'redundantOverride';

export interface ClassifiedItem {
  itemNo: string;
  description: string;
  technologyCode: string | null;
  itemRole: string | null;
  /** The kind of part, a level below the role. Editable here like the rest. */
  category?: string | null;
  status: ClassifyStatus;
  /** which source decided it — 'manual' | 'hierarchy' | 'pricePage' */
  classSource?: string | null;
  listPrice?: number | null;
}

export interface ItemToClassify {
  itemNo: string;
  description: string;
  /** what it resolves to today, if anything */
  technologyCode: string | null;
  itemRole: string | null;
  why: ReviewReason;
  listPrice?: number | null;
  prodCat?: string | null;
  /** set when the hierarchy knows the part but its Product Line is unmapped */
  hierarchyLine?: string | null;
}

/** A classification a person entered. Always beats the hierarchy. */
export interface ItemClassification {
  itemNo: string;
  technologyCode: string | null;
  itemRole: string;
  /**
   * The kind of part, a level below the role — Stands, Conveyor, Tamp Pad.
   *
   * Reclassifying could set the technology and the role and not this, so the deeper
   * classification was something the build decided and nobody could correct. Every
   * part of the taxonomy has to be reachable from this screen or the screen is not
   * the place the taxonomy lives.
   */
  category?: string | null;
  isQuotable: boolean;
  reason?: string | null;
}

/** Product Line → technology and type: the whole taxonomy, in 43 rows. */
export interface ProductLineMapping {
  productLine: string;
  productClass: string | null;
  technologyCode: string | null;
  itemRole: string;
  isQuotable: boolean;
  confidence: 'confirmed' | 'assumed';
  notes?: string | null;
  itemCount: number;
}

/**
 * The roles the tool understands. Shown as a picker, never typed.
 *
 * `part` is the deliberately unspecific one, and it is not a gap in the vocabulary —
 * it is the answer to a question the data cannot settle. A machine has to earn the
 * `printer` role by carrying a model; something that does not carry one is a part of
 * some kind, and guessing which kind is how "Handclean Hand Cleaner" came to be a
 * printer priced at $46,400 in the first place. So it says only what is known, and
 * the classify worklist is where a person makes it specific.
 */
/**
 * What a part IS, at the level the rules read.
 *
 * The shipped set. It is a starting point rather than a closed list: a structure rule
 * says "a printer is on the quote and no accessory is", so the vocabulary belongs to
 * the business, and the app can add to it — see listItemRoles, which is what every
 * screen should read. This constant is the seed and the fallback.
 */
export const ITEM_ROLES = [
  'printer', 'printhead', 'ink', 'consumable', 'accessory', 'spare', 'service',
  'warranty', 'promo', 'part',
];

export interface DiscountCategory {
  code: string;
  displayName: string;
  maxDiscount: number | null;
}

/**
 * Where a quote has got to.
 *
 * `approved` was missing, and its absence was a real defect rather than a tidiness one:
 * with nowhere to go, an approved quote was pushed back to `draft` — indistinguishable
 * from one that had never been submitted — and a declined quote was left sitting in
 * `pendingApproval` for ever. The approver's two decisions produced, between them,
 * exactly the wrong pair of transitions.
 *
 *   draft ──submit──> pendingApproval ──approve──> approved ──send──> sent
 *                            └────────decline────> draft
 *
 * A quote needing no approval goes straight from draft to sent.
 */
export type QuoteStatus =
  'draft' | 'pendingApproval' | 'approved' | 'sent' | 'won' | 'lost' | 'expired';

export interface QuoteSummary {
  quoteNo: string;
  technologyCode: string;
  status: QuoteStatus;
  customerName: string | null;
  lineName: string | null;
  repUsername: string;
  repDisplay: string | null;
  orderTotal: number | null;
  lineCount: number;
  updatedAt: string;
  approvalsPending: number;
  /**
   * Why the rep is asking, for an approver triaging their queue.
   *
   * On the summary rather than only the quote, because the whole point of a queue is
   * deciding what to open. "45% against a stated 30%" says what is being asked; only
   * this says whether it is worth granting.
   */
  approvalNote?: string | null;
  /** The deepest discount asked for, so the queue can be read at a glance. */
  requestedPct?: number | null;
}

/**
 * How the customer's copy is laid out and what it says.
 *
 * Per quote, because a two-week validity on a promotional price and a ninety-day one
 * on a capital machine are both correct and neither is a default worth arguing about.
 * `terms` and `footer` carry a company-wide default a rep can override for one quote
 * without changing it for everybody.
 */
export interface DocumentSettings {
  /** How many days the quote stands. */
  validDays: number;
  /** A paragraph above the table, in the rep's own words. */
  intro: string;
  /**
   * Axim's commercial terms.
   *
   * The wording is Axim's, taken off the terms block on the price-page quotes and
   * condensed — the source said the incorporation-by-reference paragraph twice, once
   * naming axim.example and once axim.example/terms-of-sale. The operative sentence
   * is kept close to the original because it is the one doing legal work; everything
   * around it is shorter. A rep can still override it for one quote.
   */
  terms: string;
  /** The address block under the logo. */
  footer: string;

  /**
   * A monthly figure alongside the price, for a customer who leases.
   *
   * Asked for by the sales team. Axim offers leasing and a rep was quoting the
   * monthly by hand off the side of a desk, which is how two numbers for one machine
   * end up in front of the same customer.
   *
   * Nothing here is a rate this tool knows. The rep enters the term and the rate the
   * leasing company actually quoted, and the arithmetic is the standard amortising
   * payment — a formula, not a product fact. It is off by default and prints with the
   * conditions on it, because an indicative monthly that reads as an offer is the one
   * thing on a quote that can turn into an argument about what was promised.
   */
  financing?: {
    show: boolean;
    /** Term in months, as quoted by the leasing company. */
    months: number;
    /** Annual percentage rate as a fraction, e.g. 0.089. Null uses `monthly`. */
    apr: number | null;
    /** A monthly figure typed straight in, when the leasing company gave one. */
    monthly: number | null;
    /** The conditions, in the rep's words. Printed under the figure. */
    note: string;
  } | null;

  /**
   * When a down payment is due, and how much of the total it is.
   *
   * REPORTED: "when something requires a down payment it doesn't say what the down
   * payment comes out to." The policy was stated in two places and computed in
   * neither — the terms paragraph above says "50% down on orders over $50,000" and
   * rule R-085 fires to say the same thing in different words, and a rep reading
   * either still had to work out half of the total themselves and type it into an
   * email. A customer reading the quote had no figure at all.
   *
   * Structured rather than left in the terms sentence so the sentence and the figure
   * come from one definition. The numbers are Axim's, not this tool's: 50% over
   * $50,000 is stated in the CIJ workbook's "Finalize your quote" sheet and again in
   * the VIJ workbook (seeded as W-164, "System downpayment is 1/2 of order total for
   * amounts over $50K").
   *
   * The other half of the policy — 100% down on non-standard and build-special items
   * over $2,000, W-165 — is deliberately NOT computed. Nothing in the catalogue marks
   * an item non-standard; there are configure-to-order rows and one row labelled
   * Build Special, and neither is the same question. Guessing which lines it applies
   * to would put a wrong figure on a quote, so the terms state that rule in words and
   * only this one is worked out.
   */
  downPayment?: {
    /** Fraction of the order total, e.g. 0.5. */
    pct: number;
    /** Order totals at or above this figure require it. */
    overAmount: number;
  } | null;

  /** The application the quote was priced against, restated for the customer. */
  showApplication: boolean;
  /** Per-unit prices, or line totals alone. */
  showUnitPrices: boolean;
  /**
   * The specification of the machine being bought, printed with the quote.
   *
   * The photographs came off this document because a stock shot of another plant's
   * line did not look like it belonged beside the numbers. What a customer actually
   * wanted from them is the thing this replaces: what is this machine, and can it do
   * what we discussed. Every figure is the vendor page's own wording, cited to it.
   */
  showDatasheet: boolean;
}

export const DEFAULT_DOCUMENT: DocumentSettings = {
  validDays: 30,
  intro: '',
  downPayment: { pct: 0.5, overAmount: 50000 },
  terms: [
    'Payment: Net 30. 50% down on orders over $50,000; 100% down on non-standard items.',
    'F.O.B. Ashfield, IL.',
    'Delivery: 1–4 weeks from receipt and acceptance of your PO, depending on model. '
      + 'Non-standard and value-add items, 4–6 weeks or longer; lead time is confirmed on '
      + 'the order acknowledgement.',
    'Warranty information: www.axim.example',
    '',
    'Sales by HIG Axim, a division of Harrow Industrial Inc. (“HIG”), of its products '
      + 'and services are expressly limited to and made conditional on acceptance of its '
      + 'current Terms and Conditions of Sale, found at '
      + 'https://www.axim.example/terms-of-sale, which are incorporated herein by '
      + 'reference. Any additional or different terms are hereby rejected. Commencement of '
      + 'work by HIG, or acceptance of delivery of products by purchaser, constitutes '
      + 'purchaser’s acceptance of the Terms.',
    '',
    'Remit to: Axim, An HIG Company · PO Box 4120, Ashfield, IL 60600',
  ].join('\n'),
  // The Earth City address was here and is wrong — it is the old building. The terms
  // block above has said F.O.B. St. Charles the whole time, so the document was
  // quoting shipping from one address and printing another under the logo.
  footer: 'Axim, an HIG company\n120 Foundry Road, Ashfield, IL 60600',
  showApplication: true,
  showUnitPrices: true,
  showDatasheet: false,
  /* Off, and empty. A default term or a default rate would be this tool inventing a
     commercial term; the only honest starting point is the rep entering what they
     were quoted. */
  financing: {
    show: false, months: 60, apr: null, monthly: null,
    note: 'Indicative monthly payment, subject to credit approval and the leasing '
      + "company's final terms. Not an offer of finance.",
  },
};

export interface QuoteLine {
  lineNo: number;
  itemNo: string;
  description: string;
  /**
   * What the item is, carried on the priced line.
   *
   * The configurator reads it to know which requirements a quote already satisfies,
   * and a screen should not re-derive a classification the engine already looked up —
   * doing so is how two answers to "is this a machine" come to exist.
   */
  itemRole: string | null;
  /** Which price book the item came from. Null for a part the catalogue has lost. */
  technologyCode: string | null;
  /** Which solution this line serves, carried through so a screen need not re-derive it. */
  solutionId: string | null;
  model: string | null;
  quantity: number;
  /** Priced and graded like any other line, and left out of the totals. */
  optional?: boolean;
  listPrice: number | null;
  discountCatCode: string | null;
  categoryDiscount: number | null;
  appliedDiscount: number | null;
  cappedByRule: string | null;
  netUnit: number | null;
  extendedList: number | null;
  extendedNet: number | null;
}

export interface QuoteTraceEntry {
  ruleCode: string;
  ruleSummary: string;
  sourceRef: string | null;
  author: string | null;
  status: 'satisfied' | 'action' | 'warning' | 'blocked' | 'info';
  headline: string;
  /**
   * The parts that would satisfy this finding, when it names them exactly.
   *
   * A `requires` rule knows the part number and the quantity it is missing, so the
   * rep should not have to read the sentence, remember a part number and go and
   * search for it. Present only where the fix is unambiguous: a `requireOneOf` is
   * a choice, and a choice is the rep's to make.
   */
  fix?: { itemNo: string; quantity: number; description: string | null }[];
  /**
   * The kind of part that would answer this finding, when the rule names a kind
   * rather than a part number.
   *
   * Q-BARE-MOUNT says "no stand, bracket or mount on this quote" and there is no
   * `fix` payload for it, because there is no single part to add — the CIJ book
   * carries four mounts and choosing between them is the rep's call. So the rule
   * told the rep something true and left them to go and find it, which is the
   * complaint a production-readiness review made: rules that tell without helping.
   *
   * Nothing new had to be authored to fix that. The rule already names the missing
   * role in its own trigger — "a printer present, an accessory absent" — so this
   * is read straight off it, and any future rule written the same way gets a
   * picker without anybody remembering to add one.
   */
  pickRole?: string;
}

export interface QuoteApproval {
  approvalId: number;
  ruleCode: string | null;
  reason: string;
  requestedPct: number | null;
  statedMax: number | null;
  approverUser: string | null;
  approverDisplay: string | null;
  resolvedBy: ApproverSource;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
  /**
   * What the approver said, in their own words.
   *
   * A decline is a decision the rep has to act on, and "declined" alone does not
   * say whether the discount was too deep, the wrong customer, or the wrong month
   * — so the reason travelled by email or Teams and never reached the quote. It is
   * held here with the decision, where the next person to open the quote finds it.
   * Optional on an approval and expected on a decline.
   */
  note?: string | null;
  /** When the decision was made. Null while pending. */
  decidedAt?: string | null;
}

/**
 * The application, captured once. These are the columns on cpq.quote, so a rule
 * trigger of type 'profile' names one of these fields directly.
 */
/**
 * The application, captured once.
 *
 * Scoped from the price-page workbooks themselves: every technology carries a
 * `CUSTOMER & CAE INFO`, `CUST AND APP INFO` or `App Analysis` sheet, and between
 * them they are the list of things a CAE is expected to establish before an order
 * is accepted. Those sheets are the requirement, so the fields below are theirs
 * rather than a guess at what matters.
 *
 * Deliberately NOT here: customer, quote number, PO, bill-to and ship-to, RSM and
 * FSE names. Those sit on the same sheets but they are quote and account metadata,
 * not facts about the line — the tool already holds them elsewhere or gets them
 * from Orbit.
 *
 * The eleven Y/N environment questions the sheets ask are one multi-value field
 * rather than eleven booleans. On paper a tick box is the only option; in a tool
 * the same information is a list, and the fit rules read it with `includes`.
 *
 * Temperatures are Fahrenheit because both sources are: the sheets say
 * "min/max (Fahrenheit)" and the Corvus 6400 datasheet states 41-113°F.
 */
/**
 * What the printed code has to be good enough for, coarsest first.
 *
 * Four steps rather than a number, because these are the four a customer can answer
 * without being asked to know what 300 dpi means. Each maps to a figure a datasheet
 * states, and the mapping is in the rules where it can be cited.
 */
export type PrintQuality = 'humanReadable' | 'scannable' | 'graded' | 'graphics';

export interface ApplicationProfile {
  // ---- what is being marked
  substrate: string | null;
  porosity: 'porous' | 'nonPorous' | 'semiPorous' | 'unknown' | null;
  productWidthMm: number | null;
  productLengthMm: number | null;
  productTempF: number | null;

  // ---- the line it runs on
  lineSpeedFpm: number | null;
  /** Products per minute. Not the same as line speed, and both sheets ask both. */
  throughputPpm: number | null;
  productSpacingMm: number | null;
  /**
   * The label, not the product.
   *
   * Every figure a print engine publishes is about the label — media width 13 to
   * 131 mm on an K84X — and the applicators state label width and length as their
   * own limits. Without these two fields none of it could become a rule, which is
   * why four quotable machines had a specification on the screen and nothing the
   * grader could use.
   */
  labelWidthMm: number | null;
  labelLengthMm: number | null;
  conveyor: 'new' | 'existing' | null;
  /** "Distance from product to PH is critical for quality hi-res print." */
  guideRails: 'yes' | 'no' | null;
  productMotion: 'moving' | 'stationary' | null;

  // ---- the code that has to be printed
  charHeightMm: number | null;
  throwDistMm: number | null;
  linesOfPrint: number | null;
  /** Marking window, or the longest code that has to fit. */
  markingWindowMm: number | null;
  messageContent: string | null;
  barcodeRequirements: string | null;
  /**
   * What the print has to be good enough for.
   *
   * Not a dpi figure. Sixteen rules reasoned about resolution through proxies — line
   * speed, the barcode box, air at the printhead — because nothing here said what the
   * code was for, so the trade-off every one of those rules describes had no side to
   * come down on. A customer does not know dpi; they know whether the code gets
   * scanned, verified, or read by a person.
   *
   * The mapping to figures lives in the rules, each citing the machine's own
   * specification: the valve jets are 8 x 25 and 9 x 25 DPI, the thermal jets
   * 300 x 300.
   */
  printQuality: PrintQuality | null;
  inkType: string | null;
  dryTimeSeconds: number | null;

  // ---- the environment
  environment: string | null;
  ambientTempMinF: number | null;
  ambientTempMaxF: number | null;

  // ---- what the CAE still has to establish
  adhesionRequirements: string | null;
  sampleTested: 'yes' | 'no' | null;
  notes: string | null;
}

export const EMPTY_PROFILE: ApplicationProfile = {
  substrate: null, porosity: null,
  productWidthMm: null, productLengthMm: null, productTempF: null,
  lineSpeedFpm: null, throughputPpm: null, productSpacingMm: null,
  labelWidthMm: null, labelLengthMm: null,
  conveyor: null, guideRails: null, productMotion: null,
  charHeightMm: null, throwDistMm: null, linesOfPrint: null,
  markingWindowMm: null, messageContent: null, barcodeRequirements: null,
  printQuality: null,
  inkType: null, dryTimeSeconds: null,
  environment: null, ambientTempMinF: null, ambientTempMaxF: null,
  adhesionRequirements: null, sampleTested: null, notes: null,
};

/**
 * The environment questions, from the sheets' own wording.
 *
 * Every one of these is a Y/N box on at least one App Analysis form, and several
 * carry a stated consequence — washdown says outright that TIJ and VIJ
 * controllers, ink systems and printheads are not IP rated.
 */

export const ENVIRONMENT_OPTIONS = [
  'washdown', 'condensation or humidity', 'refrigerated', 'open air building',
  'food grade', 'high particulate or dust', 'static', 'vibration',
  'air turbulence near printhead', 'glue strands or angel hair',
  'high temperature', 'clean room', 'outdoor',
] as const;

/** What the rep asks for. Never prices — the server decides those. */
export interface DraftLine {
  itemNo: string;
  quantity: number;
  /**
   * Which solution this line serves.
   *
   * A line used to belong to a solution by its item's technology, which is why a
   * solution could not be anything but a price book. Now it says so, and two CIJ
   * coders at two stations keep their lines and their applications apart.
   *
   * Null on a quote that predates solutions, and on the parts that belong to the
   * quote rather than to a station — freight, an installation day, a training
   * course. Those grade against the quote's own application, which is the same
   * answer they got before.
   */
  solutionId?: string | null;
  /**
   * Offered, not bought.
   *
   * A rep quoting a line usually wants to put two or three things in front of the
   * customer that they are not committing to — a second printhead, a year of ink, a
   * training day — without those figures landing in the total the customer reads as
   * the price. Asked for by the sales team.
   *
   * An optional line is priced exactly like any other and graded by exactly the same
   * rules; it is only kept out of the totals, and it appears under its own heading on
   * the customer's copy so nobody has to guess which figure is the price.
   */
  optional?: boolean;
}

/**
 * One solution on a quote: a station, its application, and the lines that serve it.
 *
 * WHY THE APPLICATION IS SPARSE AND INHERITS
 *
 * A quote holds one application, which is honest for what is true of the line and the
 * room — speed, throughput, spacing, conveyor, guide rails, ambient range, environment
 * — and wrong for what is true of a position on it. The date code on the bottle is not
 * the height of the text on the case label, and the printhead is not the same distance
 * from both.
 *
 * So `profile` here holds only what this solution answers DIFFERENTLY. A field absent
 * from it means "as the quote says", which is the common case and should cost nothing
 * to state — and it stays LINKED, so correcting the line speed once corrects it
 * everywhere it was never overridden. A straight copy gives two answers for one
 * conveyor and no way to tell which is stale.
 *
 * EVERY question can be answered per solution. There was a curated list of fourteen
 * and it was wrong four times: a coder marks the bottle and an applicator labels the
 * shipping case, so product width, length, temperature and motion are not facts about
 * the line at all. A judgement about somebody else's products, baked into a constant
 * where a wrong entry silently forces a shared answer, is the failure this exists to
 * remove.
 */
export interface Solution {
  /**
   * Stable for the life of the quote, and the key everything else joins on.
   *
   * Not the technology code, and not the array index. The code cannot be a key once
   * two solutions may share a book, and an index changes the moment a rep deletes the
   * solution above — which would silently re-point every line and every answer at the
   * wrong station.
   */
  id: string;
  /**
   * What the rep will recognise this station by: "Line 3 — case coder".
   *
   * Null means it has not been named, and the screen falls back to the quote's own
   * line name so a single-solution quote never has to say the same thing twice.
   */
  name: string | null;
  /** Which price book this solution is quoted from. Two solutions may share one. */
  technologyCode: string;
  /** Only what this station answers differently from the quote. See above. */
  profile?: Partial<ApplicationProfile>;
  /**
   * Fields THIS station's customer has no constraint on.
   *
   * Not inherited field-by-field the way `profile` is, because a list is answered as
   * a whole: absent means "as the quote says", and present — even empty — means this
   * station has been asked the question itself. Ticking "any throw distance" on the
   * case labeller must not silence the throw-distance rules on the bottle coder.
   */
  noConstraint?: (keyof ApplicationProfile)[];
}

export interface QuoteDraft {
  technologyCode: string;
  customerNo: string | null;
  customerName: string | null;
  /**
   * Set instead of customerNo when the customer is not in Orbit yet.
   *
   * The quote carries a temporary key, `NEW-<quote no>`, and is flagged on screen
   * and on the internal copy of the PDF. It cannot be marked won until a real
   * Orbit number replaces it — a won quote against a customer that does not exist
   * is a number nobody can reconcile, and it would be found at month end by
   * somebody who was not there when it was raised.
   */
  newCustomer?: NewCustomer | null;
  lineName: string | null;
  profile: ApplicationProfile;
  /**
   * Profile fields the customer has no constraint on.
   *
   * Not the same as blank. Blank means nobody has asked yet, and the rep should
   * go and find out. Unconstrained means the answer is in and it is "anything",
   * so no rule may narrow the machine list on that field. Keeping them apart is
   * the difference between "still needed: throw distance" and silence.
   */
  noConstraint?: (keyof ApplicationProfile)[];
  /** answers to eligibility conditions of kind 'flag', keyed by flagName */
  flags: Record<string, boolean>;
  /** requested discount per discount category, 0–1 */
  categoryDiscounts: Record<string, number>;
  /**
   * A flat amount off the order, in dollars, after the category discounts.
   *
   * Asked for by the sales team: a negotiation ends at "call it forty thousand" far
   * more often than at a percentage, and a rep was having to solve for the percentage
   * that produces the number they had already agreed.
   *
   * It is money off the order rather than off a line, which is what "take two grand
   * off" means, and the quote still states the percentage it works out to — both
   * because that is what the discount rules are written in and because a rep needs to
   * see when a round number has quietly taken them past their ceiling. It does: the
   * effective discount is what the approval check reads, so this is not a way around
   * it.
   */
  flatDiscount?: number | null;
  /**
   * The solutions on this quote, in the order a rep built them.
   *
   * A solution is one station: a name, a price book, its own application, and the
   * lines that answer it. Every one is built the same way — name it, answer the
   * application, configure it — and the first is not special.
   *
   * THIS USED TO BE KEYED BY PRICE BOOK, which made a solution and a technology the
   * same thing. Two stations both wanting a CIJ coder could not be written down: the
   * second had nowhere to live, and the control for adding one hid every book already
   * in use. A quote for two production lines is the ordinary case, not the exotic one.
   *
   * REPORTED: "adding another solution to a quote is a half-done process. It should
   * literally be the same process as the first solution. Except, it may be a different
   * line or application name."
   */
  solutions: Solution[];
  lines: DraftLine[];
  /** how the customer's copy looks; absent means the company default */
  document?: DocumentSettings | null;
  /** where the quote is going, and the note that goes with it */
  recipientEmail?: string | null;
  coveringNote?: string | null;
  /**
   * What the rep said to the approver, and only to them.
   *
   * Separate from coveringNote, which is the paragraph the customer reads. These
   * were one field: a rep explaining why a discount was worth granting — the
   * competitor, the volume, what the customer had threatened — wrote it into the
   * note that would later be sent to that customer. Two audiences, two fields.
   */
  approvalNote?: string | null;
}

/** How well an item suits the captured application, and why. */
export interface FitAssessment {
  itemNo: string;
  description: string;
  /**
   * Which solution this assessment is for.
   *
   * An item is graded once per SOLUTION, not once per quote, because two stations can
   * answer the application differently and the same printhead can be right at one and
   * wrong at the other. So the same item number may appear twice with two grades, and
   * this is what tells them apart.
   *
   * Null where the grading is not about a station: `suggest`, and lines that belong to
   * the quote rather than to a solution.
   */
  solutionId?: string | null;
  /** printer, ink, accessory, service … so a caller can group without a second lookup */
  itemRole?: string | null;
  /**
   * 'notAssessed' means no fit rule engaged this item — not that it passed.
   * The distinction is the whole point: it used to grade 'good', so a machine
   * nobody had written a rule about was indistinguishable on screen from one a
   * datasheet endorses.
   */
  grade: 'good' | 'caveat' | 'notAssessed' | 'notRecommended';
  /**
   * Why this grade, with the citation the grade rests on.
   *
   * `author` and `sourceRef` are carried here for the same reason the quote trace
   * carries them: a rep asked "why not the 6400?" has to be able to name the
   * document. They were missing until a critique found that the pricing rules cite
   * and the fit rules — the actual product differentiator — did not.
   */
  reasons: { ruleCode: string; text: string; author?: string | null; sourceRef?: string | null }[];
  /**
   * The machine, where the item names one. Carried through so a card can show
   * the product and link to its page — a rep comparing eight part numbers that
   * differ by one character should not have to guess which is which.
   */
  model?: string | null;
  /**
   * List price, from Orbit. The machine list showed none at all, so a rep chose
   * between 947 configurations without the one number the customer will ask about
   * first. Null where Orbit carries no price — shown as such, never as zero.
   */
  listPrice?: number | null;
  /**
   * How many orderable configurations of this machine this row stands for.
   *
   * A Corvus SKU is a printer already filled — printer, printhead, ink and colour in
   * one part number — so the CIJ book answers "which machine" with 947 rows for
   * nine machines. Where MACHINE_IDENTITY names the attributes that say which
   * machine a row is, the rest collapse into the best-graded one and this counts
   * them. Absent means the row is a machine on its own terms, which is how every
   * other technology's book is already written.
   */
  variants?: number;
  /**
   * The attribute values that made this row a machine rather than a configuration,
   * e.g. { 'Printer Type': '6420 Dye Based' }. Set with `variants`; it is what lets
   * the list offer "see all 105" without knowing anything about Corvus part numbers.
   */
  identity?: Record<string, string>;
}

/**
 * Narrowing the machine list.
 *
 * A CIJ price book enumerates every printer/ink/colour combination — 1,157 of
 * them. Grading all of them and shipping the lot to the browser to filter would
 * be both slow and useless to read, so the narrowing happens where the
 * catalogue is.
 */
export interface SuggestRequest {
  technologyCode: string;
  profile: ApplicationProfile;
  /** attribute name → chosen value, e.g. { 'Printer Type': '6420 Dye Based' } */
  attributes?: Record<string, string>;
  q?: string;
  limit?: number;
  /**
   * Which kinds of part to suggest. Machines when absent.
   *
   * Suggestion used to mean "which machine", and stopped the moment one was on the
   * quote — so the panel that does the thinking disappeared exactly when the rep
   * started assembling the rest of the solution, and every ink, bracket, photocell
   * and service kit after that was found by knowing what to search for.
   */
  roles?: string[];
  /** Parts already on the quote, so a rule keyed to the machine can engage. */
  lines?: DraftLine[];
}

/** A role a complete quote needs, and the rule that says so. */
export interface Requirement {
  role: string;
  ruleCode: string;
  summary: string;
  sourceRef: string | null;
  author: string | null;
}

export interface SuggestResult {
  items: FitAssessment[];
  /** how many matched before the limit, so the UI can say "8 of 214" */
  total: number;
  /** the attribute values worth offering as filters for this technology */
  facets: Record<string, string[]>;
  /**
   * What the application ruled out before anything was graded, and which rule did it.
   *
   * ASKED: "do the rules drive the application fit logic or is there a hidden layer
   * in code?" This was the hidden layer — a machine the enquiry ruled out was simply
   * absent, with no code and no citation, and on a porous black-ink enquiry that was
   * 284 of 947 CIJ configurations. The narrowing still happens, because grading 284
   * ruled-out rows is the noise it exists to remove; it says so now.
   */
  narrowed?: NarrowingApplied[];
}

/** One narrowing rule and what it took. See engine/narrowing.ts. */
export interface NarrowingApplied {
  ruleCode: string;
  summary: string;
  detail: string | null;
  sourceRef: string | null;
  author: string | null;
  attribute: string;
  kept: string[];
  /** The word the application supplied: 'porous', 'black'. */
  matched: string;
  /** How many rows it removed from the list a rep sees. */
  removed?: number;
  /**
   * How many orderable configurations it removed.
   *
   * Differs from `removed` wherever the list collapses configurations of one machine:
   * the CIJ list shows 8 machines standing for 947 configurations, and the porosity
   * rule takes 284 of those without taking a machine, because every machine is sold
   * in both fills.
   */
  removedOptions?: number;
}

/** An approval the evaluation says is needed. Not yet an approval record. */
export interface RequiredApproval {
  ruleCode: string | null;
  reason: string;
  requestedPct: number | null;
  statedMax: number | null;
  approverRole: string | null;
}

/**
 * The result of running the rules over a draft.
 *
 * The client never computes any of this. A rep must not be able to arrive at a
 * price the server did not sanction, and the trace has to be recorded by
 * whatever produced the numbers — otherwise it is a story about the quote
 * rather than a record of it.
 */
export interface Evaluation {
  lines: QuoteLine[];
  trace: QuoteTraceEntry[];
  requiredApprovals: RequiredApproval[];
  fit: FitAssessment[];
  extendedList: number;
  extendedNet: number;
  /** The flat amount actually applied, after clamping to the net. */
  flatDiscountApplied?: number;
  /** Optional lines, totalled separately so a screen never has to sum them itself. */
  optionalNet?: number;
  totalDiscount: number;
  orderTotal: number;
  marginPct: number | null;
  /** why margin is absent, when it is — never show a blank and let it be read as zero */
  marginNote: string | null;
  /** true when a blocking rule fired; the quote cannot be sent */
  blocked: boolean;
}

export interface Quote extends QuoteSummary {
  /** How the customer's copy is laid out. Null takes the company default. */
  document?: DocumentSettings | null;
  lines: QuoteLine[];
  trace: QuoteTraceEntry[];
  approvals: QuoteApproval[];
  extendedList: number | null;
  extendedNet: number | null;
  totalDiscount: number | null;
  marginPct: number | null;
  marginNote?: string | null;
  profile?: ApplicationProfile;
  /**
   * Fields the customer has no constraint on, as stored.
   *
   * Returned by get_quote from cpq.quote.no_constraint. It was missing from this
   * type, so reopening a quote silently dropped it and every rule the rep had
   * deliberately silenced fired again.
   */
  noConstraint?: (keyof ApplicationProfile)[];
  flags?: Record<string, boolean>;
  categoryDiscounts?: Record<string, number>;
  flatDiscount?: number | null;
  /**
   * The stations on this quote, as saved. See Solution.
   *
   * Absent on a quote raised before solutions existed: every line then falls back to
   * the quote's own application, which is the answer it had at the time.
   */
  solutions?: Solution[];
  fit?: FitAssessment[];
  blocked?: boolean;
  customerNo?: string | null;
  /** Who it went to and what was said, once sent. */
  recipientEmail?: string | null;
  coveringNote?: string | null;
  /**
   * Who else received it, recorded at the moment it was sent.
   *
   * The rep's manager is copied on every quote that leaves the building, not only
   * ones that needed a discount approved — a manager who only ever sees the
   * exceptions has no view of what their line is quoting.
   *
   * Stored on the quote rather than resolved when the quote is read, because the
   * reporting line moves. Six months from now this has to say who actually got it,
   * not who would get it if it were sent today.
   */
  copiedTo?: string[] | null;
  /**
   * Sent by the rep, from their own mail, and recorded here afterwards.
   *
   * REPORTED: "a lot of sales people want to edit their quote and add pictures and
   * whatever before they send it out, they are likely going to need to send it from
   * outside of the CPQ system, but the system is going to need them to send it via
   * the system so it gets marked as sent."
   *
   * Both halves of that are true and they pull against each other, so the tool has to
   * give way. A rep who has spent twenty minutes putting photographs into a Word
   * document is not going to throw it away and press Send here; what actually happens
   * is they send it from Outlook and the quote sits in the system saying `approved`
   * for ever. A status nobody maintains is a status nobody can report on.
   *
   * So this is the quote's own account of having gone out by another route: who it
   * went to, when, and — where the rep attaches it — the file the customer actually
   * received, which is the version that matters six months later and is the one the
   * system cannot regenerate.
   */
  sentOutside?: {
    /** ISO timestamp of when the rep says it went. */
    at: string;
    /** Who they say it went to. Free text: it may be four people and a phone call. */
    to: string;
    /** Why it did not go through the tool, in their words. Optional. */
    note?: string | null;
    /** The file they actually sent, where they attached it. */
    file?: { name: string; type: string; size: number; dataUrl: string } | null;
  } | null;
  /**
   * Why it did not close, and where it was when it stopped.
   *
   * `lost` and `won` have been in QuoteStatus since the beginning and nothing could
   * ever set them, so a quote reached `sent` and stayed there for ever. Reported:
   * "how do you lose a quote? The quote will stay in sent status forever?"
   *
   * The previous status is kept so losing one is reversible. A rep who marks the
   * wrong quote should not have to remember whether it had been approved.
   */
  outcomeReason?: string | null;
  closedAt?: string | null;
  statusBeforeClose?: QuoteStatus | null;
  /**
   * What the rep said to the approver, and only to them.
   *
   * Separate from coveringNote, which is the paragraph the customer reads. These
   * were one field: a rep explaining why a discount was worth granting — the
   * competitor, the volume, what the customer had threatened — wrote it into the
   * note that would later be sent to that customer. Two audiences, two fields.
   */
  approvalNote?: string | null;
}

/**
 * Promise dates and open orders both come from Planning Analytics, which
 * rebuilds them on a schedule rather than live. Every response therefore
 * carries how old it is — a rep on the phone should know.
 */
export type Freshness = 'current' | 'stale' | 'failed';

export interface PromiseRung {
  ladderSeq: number;
  promisedDt: string;
  materialReadyDt: string | null;
  atpQty: number;
  promiseMode: string;
  explanation: string | null;
}

export interface ItemPromise {
  itemNo: string;
  description: string;
  purOrMfg: string | null;
  /** the rung that covers the quantity asked for, or null if none does */
  covering: PromiseRung | null;
  ladder: PromiseRung[];
  asOf: string;
  freshness: Freshness;
}

export interface OpenOrderLine {
  lineSeqNo: number;
  itemNo: string;
  description: string;
  qtyOpen: number;
  qtyBackordered: number;
  promiseDt: string | null;
  requestDt: string | null;
  dueDt: string | null;
  statusLabel: string;
  isLate: boolean;
  daysLate: number | null;
  ladderPromisedDt: string | null;
  promiseMode: string | null;
  promiseExplanation: string | null;
}

export interface OpenOrder {
  ordNo: string;
  ordType: string;
  customerNo: string;
  customerName: string;
  openLines: number;
  qtyOpen: number;
  earliestDueDt: string | null;
  expectedReadyDt: string | null;
  lateLines: number;
  worstDaysLate: number | null;
  lines: OpenOrderLine[];
  asOf: string;
  freshness: Freshness;
}

export interface CustomerHit {
  customerNo: string;
  customerName: string;
  openOrders: number;
  lateOrders: number;
  /**
   * The contact Orbit holds, so the rep does not retype an address the ERP
   * already knows — and, more to the point, does not mistype it.
   *
   * `contacts` is every contact on the account and `email` is the one to default
   * to. They are separate because an account with four contacts should not have
   * one of them silently chosen: the rep picks, and the default is only a
   * starting point. Null where Orbit holds no address, which is common enough
   * that the send step must handle it rather than assume.
   */
  email: string | null;
  contacts?: { name: string; email: string; title?: string | null }[];
}

/**
 * A customer who is not in Orbit yet.
 *
 * There was no path for one at all: the field searched the ERP and a rep quoting
 * a prospect had nowhere to put them. Sales does not wait for an account to be
 * created, so the tool has to hold the quote until the ERP catches up.
 *
 * Deliberately the smallest set that lets a quote be addressed and sent. Anything
 * more is asking a rep to do the credit team's data entry twice, and it will be
 * wrong the second time.
 */
export interface NewCustomer {
  companyName: string;
  contactName: string;
  email: string;
  city: string;
  state: string;
}

/** Everything the UI can ask for. The mock and the real client both satisfy it. */
/**
 * A bucket of answers, already counted.
 *
 * Bucketed on the SERVER, like everything else that decides a number here. A browser
 * choosing its own bands would draw a different chart from the same data depending on
 * which screen asked, and "what speeds are we asked to code at" would have two answers.
 */
export interface AnalyticsBand {
  label: string;
  count: number;
}

/**
 * One question of the application, and what the answers to it look like.
 *
 * The point of the page. `ruleCount` against `answered` is the reading that is not
 * available anywhere else: a field 16 rules depend on and reps answer a tenth of the
 * time means the grading is running on air, and a field everybody answers that no rule
 * reads is a question asked for nothing.
 */
export interface AnalyticsField {
  field: string;
  label: string;
  /** Quotes that gave this question an answer. */
  answered: number;
  /** Quotes that said the customer has no constraint on it — an answer, not a blank. */
  noConstraint: number;
  /** Shipped fit rules that trigger on this field. */
  ruleCount: number;
  /** The answers themselves, bucketed. Empty where the field is free text. */
  bands: AnalyticsBand[];
  /**
   * True when the bands are a SCALE and their order carries meaning.
   *
   * Speed, character height and throw distance band along a number line, so the
   * client must draw them in the order they arrive and must never sort them by
   * count — a speed distribution sorted by popularity reads as though 574 fpm sits
   * between "under 200" and "over 1,433", which is not a chart, it is a scramble.
   * A substrate list has no such order and is sorted by count on the way out.
   */
  ordered: boolean;
  /**
   * True when one quote can answer several bands at once.
   *
   * Only the environment: a line is dusty AND washed down. The bands then sum to
   * more than the quote count, so no share of a whole can be drawn from them and
   * the panel says so.
   */
  multi: boolean;
}

/**
 * What the whole quote set looks like, as one object.
 *
 * One call rather than one per panel: panels get added and moved, and a page that fires
 * nine requests to draw one screen fires nine on every filter change.
 *
 * Every count is already narrowed to what the caller may see — `cpq.fn_visible_quotes`,
 * the same rule every other read obeys. An aggregate is where that rule is easiest to
 * forget and most damaging to skip: a rep must not learn the company's revenue from a
 * total nobody thought to scope.
 */
export interface Analytics {
  /**
   * The denominator, and it is stated on every panel.
   *
   * Nobody knows yet how many quotes a month this will see. So the page never implies
   * a trend it cannot support: below `MIN_FOR_SHARES` it shows counts and says the
   * sample is small, rather than drawing a percentage over eleven quotes.
   */
  quotes: number;
  /** Whose quotes these are, in the caller's own words. */
  scope: 'mine' | 'team' | 'all';
  /** How many of those captured any application answer at all. */
  described: number;
  /** Median questions answered, of the 28 the application asks. */
  medianAnswered: number;
  application: AnalyticsField[];
  pipeline: { status: QuoteStatus; count: number; value: number }[];
  discounts: {
    code: string;
    displayName: string;
    /** The stated maximum, or null where the category has none. */
    ceiling: number | null;
    /** Quotes that asked for more than the ceiling. */
    overCeiling: number;
    bands: AnalyticsBand[];
  }[];
  approvals: {
    pending: number;
    approved: number;
    declined: number;
    /** Hours from request to decision, median. Null until something has been decided. */
    medianHours: number | null;
  };
  /** What the rules actually did, from the trace stored against every quote. */
  rules: { ruleCode: string; summary: string; fired: number; blocked: number }[];
  /** Rules that are live and have never fired on a visible quote. */
  neverFired: { ruleCode: string; summary: string }[];
}

export interface CpqApi {
  getSession(): Promise<Session>;
  setPreviewRole(role: Role): void; // preview build only; no-op against the real API

  listTechnologies(): Promise<Technology[]>;

  /** The company-wide default for the customer's copy: terms, address, layout. */
  getDocumentDefaults(): Promise<DocumentSettings>;
  saveDocumentDefaults(d: DocumentSettings): Promise<DocumentSettings>;
  recommendBooks(profile: ApplicationProfile,
                 noConstraint?: (keyof ApplicationProfile)[]): Promise<BookFit[]>;
  listDiscountCategories(): Promise<DiscountCategory[]>;

  listRules(params?: { technology?: string; type?: RuleType | 'all'; q?: string; includeInactive?: boolean }): Promise<RuleSummary[]>;
  getRule(ruleCode: string): Promise<Rule>;
  /**
   * `isNew` matters: a code that already exists is fine on the rule that owns it and
   * a collision on any other. Without it the check can only be "does this code exist",
   * which fails every edit of every rule.
   */
  validateRule(rule: Rule, opts?: { isNew?: boolean }): Promise<ValidationResult>;
  /** The next free code under a prefix — R-, A-CIJ-, Q- — for a new rule. */
  nextRuleCode(prefix: string): Promise<string>;
  saveRule(rule: Rule, opts?: { isNew?: boolean }): Promise<Rule>;
  getRuleAudit(ruleCode: string): Promise<RuleAuditEntry[]>;

  /** Every word in `q` must match somewhere — with 1,590 parts, substring is not enough. */
  searchItems(params: {
    technology?: string; role?: string; q?: string; limit?: number;
    /** The hierarchy's own sub-category: Stands, Conveyor, Brackets, Ribbon. */
    category?: string;
  }): Promise<Item[]>;
  /** Which sub-categories a book actually holds, with how many parts in each. */
  listCategories(technology: string): Promise<{ category: string; count: number }[]>;
  /** Every type a part may be given, with how many carry it. Editable — see addItemRole. */
  listItemRoles(): Promise<{ name: string; count: number }[]>;

  /**
   * What a complete quote in this book needs, from the rules as they stand now.
   *
   * Asked of the service rather than computed from a compiled-in copy of the rules.
   * The rules are edited from the Rules screen and live in the database; a front end
   * carrying its own snapshot would keep showing last deploy's requirements while
   * the Rules screen showed this morning's, and both would look right.
   */
  listRequirements(technologyCode: string): Promise<Requirement[]>;
  /** A new price book. Code is 2-8 capitals; ALL is reserved. */
  addTechnology(code: string, name: string): Promise<void>;
  /** Refused while any part or rule still belongs to it. */
  removeTechnology(code: string): Promise<void>;
  /** A new type of part. */
  addItemRole(name: string): Promise<void>;
  /** Refused while any part is typed as it, or any rule reads it. */
  removeItemRole(name: string): Promise<void>;
  /** Add an empty category so parts can be filed under it. */
  addCategory(name: string): Promise<void>;
  /**
   * Remove one. Refused while anything is classified under it — a category that
   * disappears from under a part leaves the part saying nothing at all.
   */
  removeCategory(name: string): Promise<void>;
  /**
   * Make a configured machine quotable.
   *
   * A Corvus laser has no part number until it is configured, so there is nothing in
   * the catalogue to look up and nothing for the engine to price. The composed part
   * number is registered first and quoted second — in production that is a Orbit
   * item created from the configuration, and here it joins the in-memory catalogue,
   * which is the same shape of fact.
   */
  addConfiguredItem(item: {
    itemNo: string; description: string; technologyCode: string;
    listPrice: number; model?: string; attributes?: Record<string, string>;
  }): Promise<Item>;

  /** The 43-row taxonomy. Editable because it is a business decision, not logic. */
  listProductLines(): Promise<ProductLineMapping[]>;
  saveProductLines(rows: ProductLineMapping[]): Promise<ProductLineMapping[]>;

  /**
   * Everything, classified or not.
   *
   * One list rather than a worklist beside a taxonomy: an item has a technology and a
   * type, that is the whole classification, and this is where all of it is seen and
   * changed. `status` filters to what still needs a person without hiding the rest.
   */
  listClassification(params?: {
    status?: ClassifyStatus | 'all'; technology?: string; role?: string;
    /** A category name, or '__none' for the parts nothing has been filed under. */
    category?: string;
    q?: string; limit?: number;
  }): Promise<{ items: ClassifiedItem[]; total: number; counts: Record<string, number> }>;
  /** Writes an override, which wins over every other source. */
  classifyItems(rows: ItemClassification[]): Promise<{ saved: number }>;
  /** Drops overrides, letting the hierarchy answer again. */
  clearOverrides(itemNos: string[]): Promise<{ cleared: number }>;

  listQuotes(params?: { mine?: boolean; status?: QuoteStatus | 'all'; q?: string }): Promise<QuoteSummary[]>;

  /**
   * Everything the analytics page draws, in one object, already scoped to the caller.
   *
   * Aggregated on the server for the same reason prices are: if the browser computes
   * it, the browser can be wrong about it — and `listQuotes` returns a page, so
   * anything summed here would summarise one page of quotes and look plausible while
   * being wrong.
   */
  getAnalytics(): Promise<Analytics>;
  getQuote(quoteNo: string): Promise<Quote>;
  decideApproval(quoteNo: string, approvalId: number, decision: 'approved' | 'declined', note: string): Promise<Quote>;

  /**
   * Run the rules over a draft without saving anything. This is what the
   * builder calls on every change — the rep sees the server's numbers as they
   * work, never numbers the browser made up.
   */
  evaluateDraft(draft: QuoteDraft): Promise<Evaluation>;
  /** Which items suit this application, graded by the applicationFit rules. */
  suggestItems(req: SuggestRequest): Promise<SuggestResult>;
  createQuote(draft: QuoteDraft): Promise<Quote>;
  saveQuote(quoteNo: string, draft: QuoteDraft): Promise<Quote>;
  /** Send it. Raises any approvals the evaluation asked for. */
  /** `to` and `note` are recorded on the quote: cpq.quote.recipient_email and
      covering_note. Optional only because an approval resubmit carries neither. */
  submitQuote(quoteNo: string, to?: string, note?: string): Promise<Quote>;
  /** A new quote built from an existing one. Never edits the original. */
  duplicateQuote(quoteNo: string): Promise<Quote>;
  /**
   * Only a draft can go. A sent quote is a record of what a customer was told,
   * so it is cancelled rather than deleted.
   */
  deleteQuote(quoteNo: string): Promise<void>;
  /**
   * Record a quote the rep sent themselves.
   *
   * Moves it to `sent` without composing anything, because it has already gone. The
   * manager copy is recorded the same as any other send: they are entitled to see
   * what left the building however it left.
   */
  markSentOutside(quoteNo: string, details: {
    to: string; note?: string | null;
    file?: { name: string; type: string; size: number; dataUrl: string } | null;
  }): Promise<Quote>;

  /** The customer said no. Reversible — see `reopenQuote`. */
  markQuoteLost(quoteNo: string, reason: string): Promise<Quote>;
  /** Put a lost quote back where it was. */
  reopenQuote(quoteNo: string): Promise<Quote>;

  /** When can the customer have it? Reads the Planning Analytics promise ladder. */
  getItemPromise(itemNo: string, qty: number): Promise<ItemPromise>;

  searchCustomers(q: string): Promise<CustomerHit[]>;
  listOpenOrders(customerNo: string): Promise<OpenOrder[]>;
}
