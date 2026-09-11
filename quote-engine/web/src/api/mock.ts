import { evaluate, suggest } from '../engine/evaluate';
import { APPLICATION_RULES } from './appRules';
import { CATALOG } from './catalog';
import { applyBook, loadStoredBook } from './priceBook';
import { mediaFor } from './media';
import { NEEDS_REVIEW } from './gaps';
import { LINE_COUNTS, LINE_MAP, MACHINE_IDENTITY } from './taxonomy';
import { countMachines } from '../engine/evaluate';
import { narrowingFor } from '../engine/narrowing';
import { NARROWING_RULES } from './appRules';
import { ALL_TECHNOLOGIES, DEFAULT_DOCUMENT, EMPTY_PROFILE, ITEM_ROLES } from './types';
import { FIELD_LABEL } from '../engine/parseApplication';
import { draftFromQuote } from './draft';
import type {
  ApplicationProfile,
  CpqApi, CustomerHit, DiscountCategory, Evaluation, Item, ItemPromise,
  OpenOrder, PromiseRung, Quote, QuoteDraft, Role, Rule, RuleAuditEntry, RuleSummary,
  Analytics,
  ClassifiedItem, DocumentSettings, ItemClassification, ItemToClassify, ProductLineMapping,
  QuoteApproval, RequiredApproval,
  Session, Technology, ValidationIssue, ValidationResult,
} from './types';

/**
 * In-memory API, for looking at the tool before any backend exists.
 *
 * Same trick Planning Analytics uses with PA_DEMO=1. Every shape here matches
 * the real contract exactly, so the screens cannot quietly depend on something
 * the service will not return. Edits persist for the session and are lost on
 * refresh, which is the honest behaviour for a preview.
 *
 * Part numbers and rule wording are real. Prices are invented, as everywhere
 * else in this repo that is not talking to Orbit.
 */

const wait = (ms = 180) => new Promise((r) => setTimeout(r, ms));

/* Item counts are counted, not remembered — TIJ and VIJ genuinely have none,
   because the extract covers the five workbooks that carry quotable rows. A
   technology with no items is shown with none rather than hidden, so it is
   obvious what is still to come. */
const TECHS: Technology[] = [
  { code: 'CIJ',  name: 'Continuous inkjet',          ruleCount: 42, itemCount: 0 },
  { code: 'TIJ',  name: 'Thermal inkjet',             ruleCount: 8,  itemCount: 0 },
  { code: 'TTO',  name: 'Thermal transfer overprint', ruleCount: 12, itemCount: 0 },
  { code: 'PIJ',  name: 'Impulse jet',                ruleCount: 7,  itemCount: 0 },
  { code: 'VIJ',  name: 'Valve inkjet',               ruleCount: 20, itemCount: 0 },
  { code: 'LSR',  name: 'Laser',                      ruleCount: 10, itemCount: 0 },
  { code: 'PALM', name: 'Print and apply labeling',   ruleCount: 66, itemCount: 0 },
].map((t) => ({
  ...t,
  itemCount: CATALOG.filter((i) => i.technologyCode === t.code).length,
  /* Machines, not part numbers. See countMachines: this counted printer rows and
     offered "CIJ · 947 machines" over a list showing nine. */
  machineCount: countMachines(CATALOG, t.code, MACHINE_IDENTITY[t.code]),
}));

/* Seeded empty on purpose. Axim's commercial terms are not in this repository and
   are not this tool's to compose — an empty box gets noticed, and plausible invented
   boilerplate on a document a customer signs does not. */
const DOCUMENT_DEFAULTS: DocumentSettings = { ...DEFAULT_DOCUMENT };

const DISCOUNT_CATS: DiscountCategory[] = [
  { code: 'system',      displayName: 'System',      maxDiscount: 0.30 },
  { code: 'consumables', displayName: 'Consumables', maxDiscount: null },
  { code: 'accessories', displayName: 'Accessories', maxDiscount: 0.18 },
  { code: 'customs',     displayName: 'Customs',     maxDiscount: 0.05 },
];

/* The whole quotable range: 1,590 real part numbers across CIJ, TTO, PALM, PIJ
   and LSR, recovered from the price-page workbooks. See ./catalog.ts — part
   numbers, descriptions and attributes are real; every price is invented, and
   there was no real price to leak because the workbooks were scrubbed before
   they were handed over.

   The previous fifteen hand-written items were enough to show the rule engine
   working and nothing like enough to quote from. */
/**
 * The catalogue, repriced by the loaded book.
 *
 * Read once at module load because localStorage is synchronous and every screen
 * below wants a settled price list, not one that changes under it. Loading a new
 * book therefore reloads the page -- which is honest about what happened, and
 * cheaper than making 1,833 prices observable everywhere they are read.
 *
 * With no book this is the sample catalogue, whose every price is invented. The
 * status bar says which of the two you are looking at, because the difference
 * between a real quote and a demonstration is not visible in the numbers.
 */
export const PRICE_BOOK = loadStoredBook();
const ITEMS: Item[] = applyBook(CATALOG, PRICE_BOOK);

/** Overrides entered in this session. Lost on reload, like everything in the mock. */
const CLASSIFIED = new Map<string, ItemClassification>();

/** The types, seeded from the shipped set and editable in the app. */
const ROLES: string[] = [...ITEM_ROLES];

/** Categories somebody added here, on top of the ones the hierarchy supplies. */
const ADDED_CATEGORIES = new Set<string>();
/** And ones they removed. Only ever empty ones — see removeCategory. */
const REMOVED_CATEGORIES = new Set<string>();


// Rule wording is verbatim from the price-page cell comments.
const RULES: Rule[] = [
  {
    ruleCode: 'R-011', technologyCode: 'CIJ', ruleType: 'requires',
    summary: 'Tool-less handscrews require 1 photocell bracket and 2 cross joints.',
    detail: 'If replacing screws with tool-less handscrews, order (1) PH and (2) Cross Joints',
    sourceRef: 'CIJ workbook, 3. Pick your accessories, D49/D50', author: 'price page comment',
    severity: 'warn', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [{ triggerType: 'item', itemNo: 'PL79549' }],
    actions: [
      { actionType: 'require', itemNo: '0210879', quantity: 1, message: 'Needs its mounting hardware.' },
      { actionType: 'require', itemNo: 'PA12190', quantity: 2 },
    ],
    conditions: [], updatedBy: 'AXIM\\kbryson', updatedAt: '2026-07-14T09:12:00Z',
  },
  {
    ruleCode: 'R-012', technologyCode: 'CIJ', ruleType: 'requires',
    summary: 'The multistage alarm requires the alarm interface hardware upgrade.',
    detail: 'Need Multistage Alarm Hardware Upgrade from Hardware Upgrade section',
    sourceRef: 'CIJ workbook, 3. Pick your accessories, D33', author: 'price page comment',
    severity: 'warn', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [{ triggerType: 'item', itemNo: '8661724HQT5' }],
    actions: [{ actionType: 'require', itemNo: 'N7515051', quantity: 1,
      message: 'The multistage alarm cannot be driven without the interface board.' }],
    conditions: [], updatedBy: 'AXIM\\kbryson', updatedAt: '2026-06-02T14:40:00Z',
  },
  {
    ruleCode: 'R-021', technologyCode: 'CIJ', ruleType: 'duplicate',
    summary: 'The cleaning solution and the flush bottle are the same bottle.',
    detail: 'This is the same bottle as the cleaning solution, no need to order if you are selling cleaning solution',
    sourceRef: 'CIJ workbook, 4. Pick your consumables, D37', author: 'price page comment',
    severity: 'warn', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [{ triggerType: 'item', itemNo: 'RG28566', minCount: 2 }],
    actions: [{ actionType: 'warn', message: 'Both the cleaning solution and the flush bottle are on this quote.' }],
    conditions: [], updatedBy: 'AXIM\\kbryson', updatedAt: '2026-05-20T11:05:00Z',
  },
  {
    ruleCode: 'R-025', technologyCode: 'CIJ', ruleType: 'eligibility',
    summary: 'The competitor trade-out credit has five conditions, all of which must hold.',
    detail: "Only to be used together with a 6420/6440 and Service Offering Highlighted here. Put a 1 in the qty and the amount out of $1000 you're giving to the customer in the List Price",
    sourceRef: 'CIJ workbook, 3. Pick your accessories, D121', author: 'price page comment',
    severity: 'block', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', isActive: true,
    /* Which part this comment belongs to is exactly the judgement the SQL seed
       refuses to make unattended — the wording names "a 6420/6440" but sits in
       the trade-out block, and there are two trade-out parts. Pointed at the
       real 0988KEM here so the mechanism can be seen working. */
    triggers: [{ triggerType: 'item', itemNo: '0988KEM' }],
    actions: [{ actionType: 'approve', approverRole: 'Regional Sales Manager',
      message: 'Competitor trade-out credit does not qualify yet.' }],
    conditions: [
      { seq: 1, label: 'Quoted with an 6420 printer', conditionKind: 'attribute',
        attrName: 'Printer Type', attrValue: '6420 Dye Based' },
      { seq: 2, label: 'New printer sale', conditionKind: 'flag', flagName: 'newPrinterSale' },
      { seq: 3, label: 'Existing Axim customer', conditionKind: 'flag', flagName: 'existingCustomer' },
      { seq: 4, label: 'Quoted with a 24-month ink commitment', conditionKind: 'flag', flagName: 'inkTerm24' },
      { seq: 5, label: 'RSM approval recorded', conditionKind: 'flag', flagName: 'rsmApproval' },
    ],
    updatedBy: 'AXIM\\kbryson', updatedAt: '2026-07-30T16:22:00Z',
  },
  {
    ruleCode: 'R-053', technologyCode: 'CIJ', ruleType: 'discountCap',
    summary: 'Guide rail bracket is capped at 5 percent.',
    detail: 'Max Discount 5%',
    sourceRef: 'CIJ workbook, 3. Pick your accessories, discount column note', author: 'price page comment',
    severity: 'info', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [{ triggerType: 'item', itemNo: '0210879' }],
    actions: [{ actionType: 'cap', itemNo: '0210879', maxDiscount: 0.05 }],
    conditions: [], updatedBy: 'AXIM\\kbryson', updatedAt: '2026-01-04T08:00:00Z',
  },
  {
    ruleCode: 'R-070', technologyCode: null, ruleType: 'approval',
    summary: 'Exceeding a stated category maximum raises an approval request, not a block.',
    detail: 'A rep may quote past the stated maximum. The quote then carries an approval request naming the category, the requested discount and the stated ceiling.',
    sourceRef: 'CIJ workbook, 5. Pricing', author: 'price page comment',
    severity: 'warn', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [{ triggerType: 'always' }],
    actions: [{ actionType: 'approve', approverRole: 'Regional Sales Manager' }],
    conditions: [], updatedBy: 'AXIM\\amccall', updatedAt: '2026-02-11T10:30:00Z',
  },
  {
    ruleCode: 'R-085', technologyCode: null, ruleType: 'approval',
    summary: 'Orders of $50,000 or more require a 50 percent down payment.',
    detail: 'Standard terms: Net 30. 50% down for orders over $50,000. 100% down for non-standard items.',
    sourceRef: 'CIJ workbook, 4. Finalize your quote', author: 'price page comment',
    severity: 'info', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [{ triggerType: 'total', compareOp: 'gte', compareValue: '50000' }],
    actions: [{ actionType: 'warn', message: '50 percent down payment required — this order is over $50,000.' }],
    conditions: [], updatedBy: 'AXIM\\amccall', updatedAt: '2026-02-11T10:31:00Z',
  },
  {
    ruleCode: 'R-091', technologyCode: 'PALM', ruleType: 'note',
    summary: 'Check with the Application Engineer before quoting a custom pad size.',
    detail: 'Check with Application Engineer to see if we have made this size before- may be able to avoid engineering fee.',
    sourceRef: 'PALM workbook, LB5200 PL6300 CONFIG, D187', author: '(unattributed)',
    severity: 'info', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    /* REPORTED: "is R-091 supposed to be going off every time an accessory is on the
       quote for PALM?" No. It is a note about custom PAD sizes, and "any accessory"
       was the closest the trigger vocabulary could get when it was written — so it
       fired on every bracket, stand and conveyor on a PALM quote, which is how a rep
       learns to ignore the panel. The classification now names the kind of part, so
       the rule can say what it always meant. 24 parts are Tamp Pad; there are 145
       PALM accessories. */
    triggers: [{ triggerType: 'itemCategory', compareOp: 'in', compareValue: 'Tamp Pad, Back-Up Pad' }],
    actions: [{ actionType: 'warn', message: 'If this pad is a custom size, check with an Application Engineer first — we may have made it before, which avoids the engineering fee.' }],
    conditions: [], updatedBy: 'AXIM\\mpoulson', updatedAt: '2026-04-18T13:15:00Z',
  },
  {
    ruleCode: 'R-026', technologyCode: null, ruleType: 'eligibility',
    summary: 'Superseded — effective dating is now enforced by the engine itself.',
    detail: 'The prototype carried this as a rule because nothing else enforced dating. The engine now checks effective_from and effective_to before any rule is considered, so a lapsed promotion simply stops firing. Kept, retired, as the record of why that check exists.',
    sourceRef: 'Prototype rule — dating was observed but not enforced', author: 'Prototype',
    severity: 'block', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: false,
    triggers: [{ triggerType: 'always' }],
    actions: [{ actionType: 'exclude', message: 'An expired promotion is on this quote.' }],
    conditions: [], updatedBy: 'AXIM\\amccall', updatedAt: '2026-03-02T09:00:00Z',
  },
  /* Application-fit rules.
     ---------------------------------------------------------------------
     These are EXAMPLES, and they say so in their own author field, because
     they will appear in a trace and nobody should mistake them for recovered
     wording. Real fit rules have to be written by Application Engineering in
     the admin screen. What they demonstrate is that every grade comes from a
     rule with a code attached — there is not one threshold compiled into the
     engine. */
  {
    ruleCode: 'F-001', technologyCode: 'CIJ', ruleType: 'applicationFit',
    summary: 'Black dye ink does not read on a dark substrate.',
    detail: 'Dye-based black is transparent against a dark surface. Where the substrate is dark, the message has to be laid down in white pigmented ink.',
    sourceRef: 'Example fit rule — Application Engineering to confirm and replace',
    author: 'Example (mock data)',
    severity: 'warn', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [
      { triggerType: 'profile', profileField: 'substrate', compareOp: 'includes', compareValue: 'dark' },
      { triggerType: 'attribute', attrName: 'Color', attrValue: 'Black' },
    ],
    actions: [{ actionType: 'grade', fitGrade: 'notRecommended',
      message: 'Black ink on a dark substrate will not be legible.' }],
    conditions: [], updatedBy: 'AXIM\\amccall', updatedAt: '2026-08-01T09:00:00Z',
  },
  {
    ruleCode: 'F-002', technologyCode: 'CIJ', ruleType: 'applicationFit',
    summary: 'White pigmented ink is the answer for a dark substrate.',
    detail: 'The Prism 1059 white pigmented build exists for exactly this case.',
    sourceRef: 'Example fit rule — Application Engineering to confirm and replace',
    author: 'Example (mock data)',
    severity: 'info', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [
      { triggerType: 'profile', profileField: 'substrate', compareOp: 'includes', compareValue: 'dark' },
      { triggerType: 'attribute', attrName: 'Color', attrValue: 'White' },
    ],
    actions: [{ actionType: 'grade', fitGrade: 'good',
      message: 'White pigmented ink is made for dark substrates.' }],
    conditions: [], updatedBy: 'AXIM\\amccall', updatedAt: '2026-08-01T09:00:00Z',
  },
  {
    ruleCode: 'F-003', technologyCode: 'CIJ', ruleType: 'applicationFit',
    summary: 'Non-porous substrates need an ink that keys to a sealed surface.',
    detail: 'On film, coated board and moulded plastic, a general-purpose dye can smear before it sets.',
    sourceRef: 'Example fit rule — Application Engineering to confirm and replace',
    author: 'Example (mock data)',
    severity: 'warn', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    triggers: [
      { triggerType: 'profile', profileField: 'porosity', compareOp: 'eq', compareValue: 'nonPorous' },
      { triggerType: 'attribute', attrName: 'Ink', attrValue: '3103 NON MEK' },
    ],
    actions: [{ actionType: 'grade', fitGrade: 'caveat',
      message: 'Confirm dry time on the actual substrate before committing to 3103.' }],
    conditions: [], updatedBy: 'AXIM\\amccall', updatedAt: '2026-08-01T09:00:00Z',
  },
  {
    ruleCode: 'R-104', technologyCode: 'TTO', ruleType: 'substitution',
    summary: 'Wax/resin ribbon is the default; resin only where the substrate demands it.',
    detail: 'TTR-123 covers coated paper, PE and PP. Move to TTR-110 resin only for synthetics that will not take wax/resin.',
    sourceRef: 'TTO workbook, RIBBON', author: 'application engineering',
    severity: 'info', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: false,
    triggers: [{ triggerType: 'item', itemNo: 'M653781A3682' }],
    actions: [{ actionType: 'substitute', itemNo: 'R892678B0598',
      message: 'Resin ribbon is available where wax/resin will not key.' }],
    conditions: [], updatedBy: 'AXIM\\sgarimella', updatedAt: '2026-06-28T15:44:00Z',
  },
];

/**
 * The discounts each example was quoted at.
 *
 * The one awaiting approval is awaiting it for a reason the engine can see: 35% on a
 * category the price pages cap at 30%. It used to carry a hand-written approval record
 * saying so, which meant the example could not disagree with the rule it cited.
 */
const SEEDED_DISCOUNTS: Record<string, Record<string, number>> = {
  'Q-2026-0731': { system: 0.35, accessories: 0.18 },
  'Q-2026-0728': { system: 0.22, consumables: 0.10 },
  'Q-2026-0722': { system: 0.18 },
  'Q-2026-0715': { system: 0.15, consumables: 0.08 },
  'Q-2026-0709': { system: 0.20 },
};

/**
 * The application each example was quoted against.
 *
 * The seeded quotes carried no profile at all, which had two consequences: the
 * saved-quote screen had nothing to show, and every fit rule stayed silent on them
 * — so the examples demonstrated the pricing and none of the grading. These are
 * ordinary lines, described the way the parser would have filled them in.
 */
const SEEDED_PROFILES: Record<string, Partial<ApplicationProfile>> = {
  // A case coder over dark corrugated, fast enough to matter to the 6400 speed rules.
  'Q-2026-0731': {
    substrate: 'Dark corrugated', porosity: 'porous', lineSpeedFpm: 620,
    charHeightMm: 8, throwDistMm: 12, throughputPpm: 380,
    linesOfPrint: 2, markingWindowMm: 60, messageContent: 'best-before date, lot code',
    environment: 'high particulate or dust', ambientTempMaxF: 95, sampleTested: 'no',
  },
  // HDPE bottles: non-porous, washdown, which the 6440 IP65 rules speak to.
  'Q-2026-0728': {
    substrate: 'HDPE bottle', porosity: 'nonPorous', lineSpeedFpm: 410,
    charHeightMm: 4, throwDistMm: 6, throughputPpm: 520,
    linesOfPrint: 1, messageContent: 'best-before date',
    environment: 'washdown, condensation or humidity', ambientTempMaxF: 88,
    sampleTested: 'yes',
  },
  // Print and apply onto cartons.
  'Q-2026-0722': {
    substrate: 'Corrugated case', porosity: 'porous', lineSpeedFpm: 190,
    throughputPpm: 24, productWidthMm: 400, productLengthMm: 600, conveyor: 'existing', guideRails: 'yes', productMotion: 'moving',
    messageContent: 'GS1-128 pallet label', barcodeRequirements: 'GS1-128, grade C or better',
    ambientTempMaxF: 92, sampleTested: 'yes',
  },
  // Thermal transfer onto film, where the IP20 and 41-104F rules apply.
  'Q-2026-0715': {
    substrate: 'BOPP film', porosity: 'nonPorous', lineSpeedFpm: 95,
    throughputPpm: 180, markingWindowMm: 45, linesOfPrint: 3, messageContent: 'date, lot, 2D matrix',
    barcodeRequirements: 'GS1 DataMatrix', ambientTempMaxF: 99, sampleTested: 'yes',
  },
  'Q-2026-0709': {
    substrate: 'HDPE bottle', porosity: 'nonPorous', lineSpeedFpm: 300,
    charHeightMm: 5, throwDistMm: 8, linesOfPrint: 1,
    messageContent: 'best before', environment: 'condensation or humidity',
    ambientTempMaxF: 86, sampleTested: 'no',
  },
};

/* Contacts come from Orbit in the real tool (arcusfil_sql and the contact table
   behind it). Seeded here so the send step can be built against the shape it will
   really get — including the awkward cases, which are the ones that break it:
   Harbor has two contacts and no obvious default, and Northern Dairy has none at
   all, because an account with no email address on file is common and the tool
   must not assume otherwise. Names and addresses are invented; the accounts are
   the same five the rest of the preview uses. */
const CUSTOMERS: {
  customerNo: string; customerName: string;
  contacts: { name: string; email: string; title?: string }[];
}[] = [
  { customerNo: 'MID001', customerName: 'Midwest Foods', contacts: [
    { name: 'Dana Whitfield', email: 'dwhitfield@midwestfoods.example', title: 'Plant Engineer' },
  ] },
  { customerNo: 'CAS002', customerName: 'Cascade Beverage', contacts: [
    { name: 'Ray Okonkwo', email: 'r.okonkwo@cascadebev.example', title: 'Maintenance Manager' },
  ] },
  { customerNo: 'HAR003', customerName: 'Harbor Packaging', contacts: [
    { name: 'Priya Raman', email: 'praman@harborpack.example', title: 'Operations' },
    { name: 'Tom Alderice', email: 'talderice@harborpack.example', title: 'Purchasing' },
  ] },
  { customerNo: 'GLS004', customerName: 'Great Lakes Snack Co', contacts: [
    { name: 'Marisol Vega', email: 'mvega@glsnack.example', title: 'Packaging Lead' },
  ] },
  { customerNo: 'NOR005', customerName: 'Northern Dairy', contacts: [] },
];

/**
 * The rest of the quote history, so the analytics page has something true to read.
 *
 * Five quotes prove a screen renders and cannot show a distribution: a substrate
 * breakdown over five is a list, and a fill rate over five is a fraction with a
 * denominator of five. Thirty is enough for the shape of an answer to appear while
 * staying small enough that the page's own low-sample rule still fires and can be seen
 * working.
 *
 * Authored rather than generated, and authored to be UNEVEN, because the panels exist
 * to show unevenness: a few captured the whole application, most captured the handful a
 * rep fills before the first call back, and several are the two-line enquiry that
 * arrives on a Friday. A tidy sweep of every field at a uniform fill rate would draw a
 * flat chart and prove nothing.
 *
 * Every figure here is invented, like every price in this catalogue, and the page says
 * so on its face. What is not invented is the shape: the substrates, environments and
 * speeds are the ones the datasheets in data/sources/ are written about, so a rule that
 * fires against this data fires for the reason it would fire on a real quote.
 */
type SeedRow = [
  quoteNo: string, book: string, status: Quote['status'], customer: string,
  lineName: string, rep: string, total: number, lines: number, updated: string,
];

const MORE: SeedRow[] = [
  ['Q-2026-0704', 'CIJ', 'sent', 'Midwest Foods', 'Line 5 — carton date', 'druiz', 18400, 6, '2026-07-09T08:12:00Z'],
  ['Q-2026-0698', 'PALM', 'won', 'Harbor Packaging', 'Pallet wrap — GS1 label', 'awhitfield', 74200, 19, '2026-07-06T13:44:00Z'],
  ['Q-2026-0691', 'TTO', 'sent', 'Great Lakes Snack Co', 'Bagger 2 — film print', 'druiz', 26800, 9, '2026-07-02T10:20:00Z'],
  ['Q-2026-0684', 'CIJ', 'lost', 'Cascade Beverage', 'Can line 1 — underside', 'awhitfield', 33900, 12, '2026-06-27T15:55:00Z'],
  ['Q-2026-0677', 'PIJ', 'draft', 'Harbor Packaging', 'Case line B — large character', 'druiz', 12750, 5, '2026-06-24T09:31:00Z'],
  ['Q-2026-0670', 'CIJ', 'sent', 'Northern Dairy', 'Filler 3 — HDPE jug', 'druiz', 28600, 10, '2026-06-19T11:07:00Z'],
  ['Q-2026-0663', 'TTO', 'won', 'Great Lakes Snack Co', 'Bagger 1 — retort pouch', 'awhitfield', 31200, 11, '2026-06-16T14:02:00Z'],
  ['Q-2026-0656', 'VIJ', 'draft', 'Midwest Foods', 'Tray line — porous board', 'druiz', 9400, 4, '2026-06-12T08:48:00Z'],
  ['Q-2026-0649', 'PALM', 'sent', 'Cascade Beverage', 'Shrink pack — top apply', 'awhitfield', 61500, 16, '2026-06-09T16:15:00Z'],
  ['Q-2026-0642', 'CIJ', 'lost', 'Harbor Packaging', 'Line 2 — PET preform', 'druiz', 24100, 8, '2026-06-04T10:53:00Z'],
  ['Q-2026-0635', 'LSR', 'draft', 'Cascade Beverage', 'Glass line — permanent mark', 'awhitfield', 88300, 7, '2026-06-01T13:20:00Z'],
  ['Q-2026-0628', 'CIJ', 'sent', 'Great Lakes Snack Co', 'Line 7 — foil lid', 'druiz', 21750, 8, '2026-05-28T09:14:00Z'],
  ['Q-2026-0621', 'TIJ', 'won', 'Midwest Foods', 'Secondary — carton code', 'awhitfield', 5400, 3, '2026-05-22T15:41:00Z'],
  ['Q-2026-0614', 'PALM', 'draft', 'Northern Dairy', 'Crate labeller', 'druiz', 57800, 15, '2026-05-19T11:29:00Z'],
  ['Q-2026-0607', 'CIJ', 'sent', 'Cascade Beverage', 'Bottling 4 — neck code', 'druiz', 35600, 12, '2026-05-14T08:37:00Z'],
  ['Q-2026-0600', 'PIJ', 'lost', 'Harbor Packaging', 'Warehouse — case address', 'awhitfield', 14200, 5, '2026-05-11T14:50:00Z'],
  ['Q-2026-0593', 'CIJ', 'won', 'Midwest Foods', 'Line 1 — retort tray', 'druiz', 42300, 13, '2026-05-06T10:11:00Z'],
  ['Q-2026-0586', 'TTO', 'draft', 'Great Lakes Snack Co', 'Flow wrap 3', 'awhitfield', 19600, 7, '2026-05-01T16:04:00Z'],
  ['Q-2026-0579', 'VIJ', 'sent', 'Northern Dairy', 'Crate stencil', 'druiz', 11300, 4, '2026-04-28T09:22:00Z'],
  ['Q-2026-0572', 'CIJ', 'draft', 'Cascade Beverage', 'Line 6 — sleeve', 'druiz', 27400, 9, '2026-04-23T13:39:00Z'],
  ['Q-2026-0565', 'PALM', 'won', 'Harbor Packaging', 'Line C — corner wrap', 'awhitfield', 69900, 18, '2026-04-20T11:16:00Z'],
  ['Q-2026-0558', 'CIJ', 'lost', 'Great Lakes Snack Co', 'Line 9 — bag date', 'druiz', 16800, 6, '2026-04-15T15:08:00Z'],
  ['Q-2026-0551', 'LSR', 'sent', 'Midwest Foods', 'Metal can — etch', 'awhitfield', 92100, 8, '2026-04-10T08:55:00Z'],
  ['Q-2026-0544', 'CIJ', 'draft', 'Northern Dairy', 'Filler 2 — cap code', 'druiz', 23500, 8, '2026-04-07T14:27:00Z'],
  ['Q-2026-0537', 'TIJ', 'sent', 'Harbor Packaging', 'Repack bench', 'druiz', 6400, 3, '2026-04-02T10:44:00Z'],
];

/** What each of those captured of the application. Uneven on purpose — see above. */
const MORE_PROFILES: Record<string, Partial<ApplicationProfile>> = {
  'Q-2026-0704': { substrate: 'Corrugated case', porosity: 'porous', lineSpeedFpm: 240, charHeightMm: 6, throwDistMm: 10, linesOfPrint: 2, messageContent: 'date code', environment: 'high particulate or dust' },
  'Q-2026-0698': { substrate: 'Corrugated case', porosity: 'porous', lineSpeedFpm: 120, throughputPpm: 18, productWidthMm: 1200, productLengthMm: 1000, labelWidthMm: 148, labelLengthMm: 210, conveyor: 'existing', guideRails: 'yes', productMotion: 'moving', messageContent: 'GS1-128 pallet label', barcodeRequirements: 'GS1-128, grade C', printQuality: 'graded', ambientTempMinF: 55, ambientTempMaxF: 90, sampleTested: 'yes' },
  'Q-2026-0691': { substrate: 'BOPP film', porosity: 'nonPorous', lineSpeedFpm: 110, charHeightMm: 3, linesOfPrint: 3, messageContent: 'date, lot', printQuality: 'scannable', ambientTempMaxF: 96 },
  'Q-2026-0684': { substrate: 'Aluminium can', porosity: 'nonPorous', lineSpeedFpm: 900, charHeightMm: 2.5, throwDistMm: 5, throughputPpm: 1800, linesOfPrint: 1, messageContent: 'best-before', environment: 'condensation or humidity', ambientTempMaxF: 92 },
  'Q-2026-0677': { substrate: 'Corrugated case', porosity: 'porous', charHeightMm: 25, messageContent: 'shipping mark' },
  'Q-2026-0670': { substrate: 'HDPE jug', porosity: 'nonPorous', lineSpeedFpm: 260, charHeightMm: 5, throwDistMm: 8, linesOfPrint: 2, messageContent: 'best-before, plant code', environment: 'washdown', ambientTempMaxF: 86, sampleTested: 'no' },
  'Q-2026-0663': { substrate: 'Retort pouch', porosity: 'nonPorous', lineSpeedFpm: 85, charHeightMm: 3, linesOfPrint: 2, markingWindowMm: 40, messageContent: 'date, lot, 2D', barcodeRequirements: 'GS1 DataMatrix', printQuality: 'graded', ambientTempMaxF: 104, sampleTested: 'yes' },
  'Q-2026-0656': { substrate: 'Moulded pulp tray', porosity: 'porous', lineSpeedFpm: 60 },
  'Q-2026-0649': { substrate: 'Shrink film', porosity: 'nonPorous', lineSpeedFpm: 150, throughputPpm: 40, productWidthMm: 320, productLengthMm: 480, labelWidthMm: 100, labelLengthMm: 150, conveyor: 'new', guideRails: 'no', productMotion: 'moving', messageContent: 'case label', printQuality: 'scannable', ambientTempMaxF: 88, sampleTested: 'yes' },
  'Q-2026-0642': { substrate: 'PET preform', porosity: 'nonPorous', lineSpeedFpm: 700, charHeightMm: 2, throwDistMm: 4, linesOfPrint: 1 },
  'Q-2026-0635': { substrate: 'Glass bottle', porosity: 'nonPorous', lineSpeedFpm: 180, charHeightMm: 4, messageContent: 'permanent lot mark', environment: 'washdown, high temperature', ambientTempMaxF: 110, sampleTested: 'no' },
  'Q-2026-0628': { substrate: 'Foil lidding', porosity: 'nonPorous', lineSpeedFpm: 320, charHeightMm: 3, throwDistMm: 6, linesOfPrint: 2, messageContent: 'date, lot' },
  'Q-2026-0621': { substrate: 'Folding carton', porosity: 'porous', lineSpeedFpm: 45, charHeightMm: 12, linesOfPrint: 1, messageContent: 'batch' },
  'Q-2026-0614': { substrate: 'Plastic crate', porosity: 'nonPorous', lineSpeedFpm: 70, throughputPpm: 12, productWidthMm: 600, productLengthMm: 400, labelWidthMm: 100, labelLengthMm: 100, conveyor: 'existing', guideRails: 'yes', productMotion: 'stationary', messageContent: 'route label', environment: 'refrigerated', ambientTempMinF: 34, ambientTempMaxF: 45, sampleTested: 'no' },
  'Q-2026-0607': { substrate: 'PET bottle', porosity: 'nonPorous', lineSpeedFpm: 480, charHeightMm: 3, throwDistMm: 7, linesOfPrint: 2, messageContent: 'best-before', environment: 'condensation or humidity', ambientTempMaxF: 90 },
  'Q-2026-0600': { substrate: 'Corrugated case', porosity: 'porous', charHeightMm: 32, messageContent: 'address block' },
  'Q-2026-0593': { substrate: 'Retort tray', porosity: 'nonPorous', lineSpeedFpm: 200, charHeightMm: 5, throwDistMm: 9, throughputPpm: 260, linesOfPrint: 2, markingWindowMm: 55, messageContent: 'date, lot', environment: 'high temperature, washdown', ambientTempMinF: 50, ambientTempMaxF: 104, printQuality: 'scannable', sampleTested: 'yes' },
  'Q-2026-0586': { substrate: 'BOPP film', porosity: 'nonPorous', lineSpeedFpm: 130 },
  'Q-2026-0579': { substrate: 'Plastic crate', porosity: 'nonPorous', charHeightMm: 20, messageContent: 'depot code' },
  'Q-2026-0572': { substrate: 'Shrink sleeve', porosity: 'nonPorous', lineSpeedFpm: 350, charHeightMm: 3, throwDistMm: 6 },
  'Q-2026-0565': { substrate: 'Corrugated case', porosity: 'porous', lineSpeedFpm: 100, throughputPpm: 15, productWidthMm: 400, productLengthMm: 300, labelWidthMm: 148, labelLengthMm: 210, conveyor: 'existing', guideRails: 'yes', productMotion: 'moving', messageContent: 'corner wrap label', barcodeRequirements: 'GS1-128', printQuality: 'graded', ambientTempMaxF: 85, sampleTested: 'yes' },
  'Q-2026-0558': { substrate: 'Polythene bag', porosity: 'nonPorous', lineSpeedFpm: 210, charHeightMm: 4 },
  'Q-2026-0551': { substrate: 'Steel can', porosity: 'nonPorous', lineSpeedFpm: 240, charHeightMm: 6, messageContent: 'permanent code', environment: 'high particulate or dust', ambientTempMaxF: 100, sampleTested: 'no' },
  'Q-2026-0544': { substrate: 'HDPE cap', porosity: 'nonPorous', lineSpeedFpm: 380, charHeightMm: 2.5, throwDistMm: 5, linesOfPrint: 1, messageContent: 'lot' },
  'Q-2026-0537': { substrate: 'Folding carton', porosity: 'porous', charHeightMm: 12 },
};

/**
 * What the customer said they have no constraint on.
 *
 * A real answer, not a blank, and the analytics counts it apart from both — a field
 * waved off is a question asked and settled, which is the opposite of one nobody
 * reached. Sparse, because most quotes never tick one.
 */
const MORE_NO_CONSTRAINT: Record<string, string[]> = {
  'Q-2026-0656': ['charHeightMm', 'throwDistMm'],
  'Q-2026-0586': ['environment'],
  'Q-2026-0572': ['environment', 'ambientTempMaxF'],
  'Q-2026-0537': ['lineSpeedFpm'],
  'Q-2026-0642': ['environment'],
};

/** Stands in for cpq.seq_quote_no. Starts above the seeded quotes. */
let nextSeq = 800;

const QUOTES: Quote[] = [
  mkQuote('Q-2026-0731', 'CIJ', 'pendingApproval', 'Midwest Foods', 'Line 3 — case coder',
    'AXIM\\druiz', 'D. Ruiz', 53283, 14, '2026-08-04T15:20:00Z', 1),
  mkQuote('Q-2026-0728', 'CIJ', 'sent', 'Cascade Beverage', 'Bottling 2 — HDPE date code',
    'AXIM\\druiz', 'D. Ruiz', 41870, 10, '2026-08-01T09:05:00Z', 0),
  mkQuote('Q-2026-0722', 'PALM', 'draft', 'Harbor Packaging', 'Carton Line A — print & apply',
    'AXIM\\druiz', 'D. Ruiz', 68240, 17, '2026-07-29T11:48:00Z', 0),
  mkQuote('Q-2026-0715', 'TTO', 'won', 'Great Lakes Snack Co', 'Bagger 4 — date/lot',
    'AXIM\\awhitfield', 'A. Whitfield', 22910, 8, '2026-07-22T16:31:00Z', 0),
  mkQuote('Q-2026-0709', 'CIJ', 'lost', 'Northern Dairy', 'Filler 1 — best before',
    'AXIM\\awhitfield', 'A. Whitfield', 30115, 11, '2026-07-14T10:02:00Z', 0),
  // The history behind them. Same constructor, so nothing about these is a special case.
  ...MORE.map(([no, book, status, customer, line, rep, total, lines, updated]) =>
    mkQuote(no, book, status, customer, line, `AXIM\\${rep}`,
            rep === 'druiz' ? 'D. Ruiz' : 'A. Whitfield', total, lines, updated, 0)),
];

function mkQuote(
  quoteNo: string, technologyCode: string, status: Quote['status'], customerName: string,
  lineName: string, repUsername: string, repDisplay: string, orderTotal: number,
  lineCount: number, updatedAt: string, approvalsPending: number,
): Quote {
  return {
    quoteNo, technologyCode, status, customerName, lineName, repUsername, repDisplay,
    /* Every seeded quote is for one of the five seeded accounts, so it carries the
       Orbit number too. It did not, and nothing noticed until the prospect path was
       built on top: a quote with a name and no number is exactly what a prospect
       looks like, so Midwest Foods — an account in the list — opened with "Not in
       Orbit yet" across the top of it. */
    customerNo: CUSTOMERS.find((c) => c.customerName === customerName)?.customerNo ?? null,
    updatedAt, approvalsPending,
    profile: { ...EMPTY_PROFILE, ...(SEEDED_PROFILES[quoteNo] ?? MORE_PROFILES[quoteNo] ?? {}) },
    noConstraint: (MORE_NO_CONSTRAINT[quoteNo] ?? []) as Quote['noConstraint'],
    // Everything below is replaced by a real evaluation in hydrateSeeds(), which runs
    // once at the bottom of this module. The figures passed in stay in the signature
    // because the list screen reads them before anything is hydrated.
    orderTotal, lineCount, extendedList: 0, extendedNet: 0, totalDiscount: 0,
    marginPct: null, lines: [], trace: [], fit: [], approvals: [],
    flags: {}, categoryDiscounts: SEEDED_DISCOUNTS[quoteNo] ?? {},
  };
}


function line(
  lineNo: number, itemNo: string, description: string, quantity: number, listPrice: number,
  discountCatCode: string, categoryDiscount: number, appliedDiscount: number, cappedByRule: string | null,
) {
  const netUnit = listPrice * (1 - appliedDiscount);
  return {
    lineNo, itemNo, description, quantity, listPrice, discountCatCode,
    categoryDiscount, appliedDiscount, cappedByRule, netUnit,
    extendedList: listPrice * quantity, extendedNet: netUnit * quantity,
  };
}

const AUDIT: Record<string, RuleAuditEntry[]> = {
  'R-025': [
    { auditId: 3, action: 'update', changedBy: 'AXIM\\kbryson', changedAt: '2026-07-30T16:22:00Z',
      summary: 'Condition 1 changed from "6400 Plus" to "6420 Dye Based"' },
    { auditId: 2, action: 'update', changedBy: 'AXIM\\amccall', changedAt: '2026-03-14T10:02:00Z',
      summary: 'Effective-to set to 2026-12-31' },
    { auditId: 1, action: 'insert', changedBy: 'AXIM\\amccall', changedAt: '2026-01-04T08:00:00Z',
      summary: 'Imported from CIJ workbook cell D121' },
  ],
};

/* ---------------------------------------------------------------------------
   Promise ladders and open orders.

   In the real tool both come from Planning Analytics, which rebuilds them at
   05:30 — once a day, not twice; the designed midday run is not scheduled. The
   mock carries the same asOf/freshness shape so the interface is built to admit
   how old a date is: a rep on the phone should never read out a number without
   knowing that, and with a single daily run the honest answer is often "most of
   a day old".
--------------------------------------------------------------------------- */

/**
 * The last time the frequent refresh would have run, relative to now.
 *
 * This was a fixed string, and a fixed string rots: it was written on 5 August
 * and by the 13th the demo was telling every visitor "Availability as of 8 days
 * ago", which reads as a broken product rather than a seeded date. The freshness
 * note is supposed to demonstrate that the tool is honest about age — instead it
 * demonstrated that the tool was abandoned.
 *
 * Deriving it from the schedule fixes that permanently and, better, makes the
 * demo tell the truth about the thing that is actually true: with one run a day,
 * a promise date genuinely is ten hours old by late afternoon.
 */
function lastFrequentRefresh(): string {
  const d = new Date();
  d.setHours(5, 30, 0, 0);
  if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);  // before 05:30 — yesterday's run
  return d.toISOString();
}

const AS_OF = lastFrequentRefresh();

const LADDERS: Record<string, PromiseRung[]> = {
  E608A393YRJ: [
    { ladderSeq: 1, promisedDt: '2026-08-12', materialReadyDt: '2026-08-10', atpQty: 1,
      promiseMode: 'STOCK', explanation: '1 on hand at MAIN, nettable, no competing allocation.' },
    { ladderSeq: 2, promisedDt: '2026-09-04', materialReadyDt: '2026-09-02', atpQty: 4,
      promiseMode: 'PO_RECEIPT', explanation: 'PO 118422 due 2026-09-02, 3 units, plus 1 freed by a cancelled allocation.' },
    { ladderSeq: 3, promisedDt: '2026-10-16', materialReadyDt: '2026-10-14', atpQty: 9,
      promiseMode: 'LEAD_TIME', explanation: 'Beyond covered supply. 42-day purchase lead time from today.' },
  ],
  '0210879': [
    { ladderSeq: 1, promisedDt: '2026-08-07', materialReadyDt: '2026-08-06', atpQty: 26,
      promiseMode: 'STOCK', explanation: '26 on hand at MAIN after allocations.' },
    { ladderSeq: 2, promisedDt: '2026-09-18', materialReadyDt: '2026-09-16', atpQty: 76,
      promiseMode: 'PO_RECEIPT', explanation: 'PO 118501 due 2026-09-16, 50 units.' },
  ],
  PL79549: [
    { ladderSeq: 1, promisedDt: '2026-09-29', materialReadyDt: '2026-09-25', atpQty: 12,
      promiseMode: 'LEAD_TIME', explanation: 'None on hand and none on order. 55-day lead time from today.' },
  ],
  '1055535': [
    { ladderSeq: 1, promisedDt: '2026-08-06', materialReadyDt: null, atpQty: 999,
      promiseMode: 'NON_STOCK', explanation: 'Warranty line. No material, available immediately.' },
  ],
};

interface MockOrderLine {
  lineSeqNo: number; itemNo: string; qtyOpen: number; qtyBackordered: number;
  promiseDt: string | null; requestDt: string | null; statusLabel: string;
}
interface MockOrder {
  ordNo: string; ordType: string; customerNo: string; lines: MockOrderLine[];
}

const ORDERS: MockOrder[] = [
  { ordNo: '118392', ordType: 'O', customerNo: 'MID001', lines: [
    { lineSeqNo: 1, itemNo: 'E608A393YRJ', qtyOpen: 1, qtyBackordered: 0,
      promiseDt: '2026-07-24', requestDt: '2026-07-20', statusLabel: 'Backordered' },
    { lineSeqNo: 2, itemNo: '0210879', qtyOpen: 2, qtyBackordered: 0,
      promiseDt: '2026-07-24', requestDt: '2026-07-20', statusLabel: 'Open' },
  ]},
  { ordNo: '118455', ordType: 'O', customerNo: 'MID001', lines: [
    { lineSeqNo: 1, itemNo: 'PL79549', qtyOpen: 4, qtyBackordered: 4,
      promiseDt: '2026-09-30', requestDt: '2026-09-15', statusLabel: 'Backordered' },
    { lineSeqNo: 2, itemNo: '1055535', qtyOpen: 1, qtyBackordered: 0,
      promiseDt: '2026-08-14', requestDt: '2026-08-14', statusLabel: 'Open' },
  ]},
  { ordNo: '118470', ordType: 'O', customerNo: 'CAS002', lines: [
    { lineSeqNo: 1, itemNo: '0210879', qtyOpen: 6, qtyBackordered: 0,
      promiseDt: '2026-08-21', requestDt: '2026-08-18', statusLabel: 'Picked' },
  ]},
  { ordNo: '118488', ordType: 'O', customerNo: 'HAR003', lines: [
    { lineSeqNo: 1, itemNo: 'E608A393YRJ', qtyOpen: 2, qtyBackordered: 2,
      promiseDt: null, requestDt: '2026-08-29', statusLabel: 'Backordered' },
  ]},
];

const today = () => new Date('2026-08-05T00:00:00Z');

function buildOpenOrder(o: MockOrder): OpenOrder {
  const cust = CUSTOMERS.find((c) => c.customerNo === o.customerNo)!;
  const lines = o.lines.map((l) => {
    const dueDt = l.promiseDt ?? l.requestDt;
    const daysLate = dueDt
      ? Math.floor((today().getTime() - new Date(dueDt + 'T00:00:00Z').getTime()) / 86400000)
      : null;
    const rung = (LADDERS[l.itemNo] ?? []).find((r) => r.atpQty >= l.qtyOpen) ?? null;
    return {
      lineSeqNo: l.lineSeqNo,
      itemNo: l.itemNo,
      description: ITEMS.find((i) => i.itemNo === l.itemNo)?.description ?? l.itemNo,
      qtyOpen: l.qtyOpen,
      qtyBackordered: l.qtyBackordered,
      promiseDt: l.promiseDt,
      requestDt: l.requestDt,
      dueDt,
      statusLabel: l.statusLabel,
      isLate: daysLate != null && daysLate > 0,
      daysLate: daysLate != null && daysLate > 0 ? daysLate : null,
      ladderPromisedDt: rung?.promisedDt ?? null,
      promiseMode: rung?.promiseMode ?? null,
      promiseExplanation: rung?.explanation ?? null,
    };
  });
  const dues = lines.map((l) => l.dueDt).filter(Boolean) as string[];
  const readies = lines.map((l) => l.ladderPromisedDt ?? l.dueDt).filter(Boolean) as string[];
  return {
    ordNo: o.ordNo, ordType: o.ordType,
    customerNo: cust.customerNo, customerName: cust.customerName,
    openLines: lines.length,
    qtyOpen: lines.reduce((s, l) => s + l.qtyOpen, 0),
    earliestDueDt: dues.length ? dues.slice().sort()[0] : null,
    expectedReadyDt: readies.length ? readies.slice().sort()[readies.length - 1] : null,
    lateLines: lines.filter((l) => l.isLate).length,
    worstDaysLate: lines.reduce<number | null>((m, l) => (l.daysLate && (m == null || l.daysLate > m) ? l.daysLate : m), null),
    lines,
    asOf: AS_OF,
    freshness: 'current',
  };
}

// ---------------------------------------------------------------------------

let previewRole: Role = 'admin';
/* The 10 comments recovered from the price pages, plus the application-fit
   rules taken from published datasheets. Two different kinds of authority in
   one list: colleagues wrote the first, the manufacturer printed the second,
   and each rule says which it is through its author and sourceRef. */
const rules = [...RULES, ...APPLICATION_RULES];

/** Today, injected rather than read from the clock so the preview is stable. */
const TODAY = '2026-08-05';

/** The intent behind each quote, kept so a saved quote can be reopened and re-evaluated. */
/** The one station every seeded demo quote is built around. */
const SEED_SOLUTION = 'sol-1';

const DRAFTS = new Map<string, QuoteDraft>();

/**
 * Price the seeded examples with the real engine, once.
 *
 * They used to carry hand-written lines, a hand-written trace and a hand-written
 * approval, which made them the only quotes in the tool that could not disagree with
 * the rules. Two consequences turned up on screen: every example listed the same four
 * CIJ parts whatever technology it claimed, and none of them had a `fit`, so the
 * saved-quote screen showed no datasheet findings for the only quotes a demo opens.
 *
 * Parts are chosen from the catalogue by role rather than named here, so this cannot
 * rot when the catalogue is rebuilt — and a technology with no machine gets its
 * printhead instead, which is what a rep would quote.
 *
 * This runs at the bottom of the module because it needs ITEMS, `rules` and the
 * discount categories. Reaching for them from mkQuote at the top put the seed list
 * above its own dependencies, and the app died on load with a temporal-dead-zone
 * error before it rendered a pixel.
 */
function hydrateSeeds(): void {
  const pick = (tech: string, role: Item['itemRole'], n: number) =>
    ITEMS.filter((i) => i.technologyCode === tech && i.itemRole === role && i.isActive).slice(0, n);

  for (const q of QUOTES) {
    const machines = pick(q.technologyCode, 'printer', 1);
    const heads = machines.length ? [] : pick(q.technologyCode, 'printhead', 1);
    const chosen = [
      ...machines, ...heads,
      ...pick(q.technologyCode, 'consumable', 1),
      ...pick(q.technologyCode, 'accessory', 1),
    ];
    const draft: QuoteDraft = {
      technologyCode: q.technologyCode,
      customerNo: q.customerNo ?? null,
      customerName: q.customerName,
      lineName: q.lineName,
      profile: q.profile ?? { ...EMPTY_PROFILE },
      noConstraint: [],
      flags: {},
      categoryDiscounts: q.categoryDiscounts ?? {},
      flatDiscount: q.flatDiscount ?? null,
      /* One station, named after the quote's own line name, with every seeded line
         pointed at it. A seeded quote with lines and no solution would render as a
         quote whose parts belong to nothing, which is a state the builder can no
         longer produce and so should not be demonstrating. */
      solutions: [{ id: SEED_SOLUTION, name: q.lineName, technologyCode: q.technologyCode }],
      lines: chosen.map((i) => ({ itemNo: i.itemNo, quantity: 1, solutionId: SEED_SOLUTION })),
    };
    DRAFTS.set(q.quoteNo, draft);
    const ev = evaluate({ draft, items: classified(), rules, categories: DISCOUNT_CATS, today: TODAY });
    Object.assign(q, {
      lines: ev.lines, trace: ev.trace, fit: ev.fit, blocked: ev.blocked,
      extendedList: ev.extendedList, extendedNet: ev.extendedNet,
      totalDiscount: ev.totalDiscount, orderTotal: ev.orderTotal,
      marginPct: ev.marginPct, marginNote: ev.marginNote,
      lineCount: ev.lines.length,
      // The approval is the one the engine asked for, so approving it on screen
      // resolves the thing the trace actually names.
      approvals: q.approvalsPending > 0
        ? ev.requiredApprovals.slice(0, 1).map((a, i) => ({
          approvalId: i + 1, ruleCode: a.ruleCode, reason: a.reason,
          requestedPct: a.requestedPct, statedMax: a.statedMax,
          approverUser: 'AXIM\\kbryson', approverDisplay: 'K. Bryson',
          resolvedBy: 'entraManager' as const, status: 'pending' as const,
          requestedAt: '2026-08-04T15:22:00Z',
        }))
        : [],
    });
    // An example that claims to be awaiting approval has to have raised one. If the
    // rules stop asking, the seed is wrong and should be visible, not quietly sent.
    if (q.approvalsPending > 0 && q.approvals.length === 0) {
      q.approvalsPending = 0;
    }
  }
}

hydrateSeeds();


/**
 * The draft behind a quote, reconstructed when this session never built it.
 *
 * DRAFTS only holds quotes created or saved in this session, so every seeded
 * example had a quote and no draft — and submitting one threw "No quote
 * Q-2026-0731" while looking at Q-2026-0731 on screen. The real service does not
 * have this problem: it reads the quote back out of cpq.quote, where the lines, the
 * profile and the discounts all live. This is the mock doing the same thing from the
 * quote it already has.
 */
function draftFor(q: Quote): QuoteDraft {
  const existing = DRAFTS.get(q.quoteNo);
  if (existing) return existing;
  // Reading the whole quote back is the point. This used to spell the conversion
  // out and lost a field every time one was added: noConstraint first — quietly
  // turning every "no constraint" answer back into "not asked yet" — then the
  // optional flag. The recipient and the note are deliberately not carried: a
  // reopened draft has not been addressed to anybody yet.
  const rebuilt: QuoteDraft = {
    ...draftFromQuote(q), recipientEmail: null, coveringNote: null,
  };
  DRAFTS.set(q.quoteNo, rebuilt);
  return rebuilt;
}


/* Classification. The taxonomy and the worklist both come from the generated
   files, so the preview shows the real numbers rather than illustrative ones. */
const PRODUCT_LINES: ProductLineMapping[] = LINE_MAP.lines.map((l) => ({
  productLine: l.line,
  productClass: l.class || null,
  technologyCode: l.technology,
  itemRole: l.role,
  isQuotable: l.quotable,
  confidence: l.confidence as ProductLineMapping['confidence'],
  notes: l.note ?? null,
  itemCount: LINE_COUNTS[l.line] ?? 0,
}));

const REVIEW: ItemToClassify[] = NEEDS_REVIEW.map(([itemNo, description, t, r, why, line]) => ({
  itemNo, description, technologyCode: t, itemRole: r, why,
  hierarchyLine: line,
  listPrice: ITEMS.find((i) => i.itemNo === itemNo)?.listPrice ?? null,
}));

/**
 * An item as it is classified NOW.
 *
 * REPORTED: "when I add something to the machine category, it isn't going into the
 * list of machines, same with every other category in the configurator. They do go
 * into the full catalogue though."
 *
 * Exactly so, and this is why: searchItems applied the overrides and everything else
 * read ITEMS raw — the machine list, the companion suggestions, the category counts,
 * the engine. So reclassifying a part moved it in one list out of five, which is
 * worse than not moving it at all, because it looks like it worked.
 *
 * Everything that reads the catalogue goes through here now.
 */
function classified(): Item[] {
  if (CLASSIFIED.size === 0) return ITEMS;
  return ITEMS.map((i) => {
    const o = CLASSIFIED.get(i.itemNo);
    if (!o) return i;
    return {
      ...i,
      technologyCode: o.technologyCode ?? i.technologyCode,
      itemRole: o.itemRole || i.itemRole,
      category: o.category === undefined ? i.category : o.category,
      isActive: o.isQuotable,
    };
  });
}

/** The same checks the service will run. A rule that fails cannot be saved. */
const COMPARATORS = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'includes', 'includesAny', 'in']);

function validate(rule: Rule, isNew?: boolean): ValidationResult {
  const issues: ValidationIssue[] = [];

  /* The same two checks api/validation.py makes. That copy is the one that decides;
     this one is so the editor can show them while somebody types. */
  const code = (rule.ruleCode ?? '').trim();
  if (code && !/^[A-Z]{1,2}-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) {
    issues.push({ level: 'error', field: 'ruleCode',
      message: 'A rule code looks like R-091, A-CIJ-SPD-6400 or Q-BARE-MOUNT: '
        + 'a prefix, then what it is about, in capitals.' });
  }
  if (code && isNew && rules.some((r) => r.ruleCode === code)) {
    issues.push({ level: 'error', field: 'ruleCode',
      message: `${code} is already in use. Every rule needs its own code — the trace, `
        + 'the approval record and this editor all find a rule by it.' });
  }
  const known = new Set(ITEMS.map((i) => i.itemNo));

  if (!rule.ruleCode.trim()) issues.push({ level: 'error', field: 'ruleCode', message: 'A rule code is required.' });
  if (!rule.summary.trim()) issues.push({ level: 'error', field: 'summary', message: 'Summary is what a rep reads on the quote. It cannot be blank.' });
  if (!rule.triggers.length) issues.push({ level: 'error', field: 'triggers', message: 'A rule with no trigger can never fire.' });
  if (!rule.actions.length && !rule.conditions.length)
    issues.push({ level: 'error', field: 'actions', message: 'A rule with no action and no conditions does nothing.' });

  for (const [i, t] of rule.triggers.entries())
    if (t.triggerType === 'item' && t.itemNo && !known.has(t.itemNo))
      issues.push({ level: 'error', field: `triggers.${i}.itemNo`, message: `${t.itemNo} is not a part number in Orbit.` });

  for (const [i, a] of rule.actions.entries()) {
    if (a.itemNo && !known.has(a.itemNo))
      issues.push({ level: 'error', field: `actions.${i}.itemNo`, message: `${a.itemNo} is not a part number in Orbit.` });
    if (a.actionType === 'cap' && (a.maxDiscount == null || a.maxDiscount < 0 || a.maxDiscount > 1))
      issues.push({ level: 'error', field: `actions.${i}.maxDiscount`, message: 'A cap must be between 0 and 100 percent.' });
    // An exclude with nothing to exclude would block every quote it engages on.
    if (a.actionType === 'exclude' && !a.itemNo)
      issues.push({ level: 'error', field: `actions.${i}.itemNo`,
        message: 'Say which part this excludes. An exclude with no part would block every quote the rule touches.' });
    if (a.actionType === 'require' && !a.itemNo)
      issues.push({ level: 'error', field: `actions.${i}.itemNo`, message: 'Say which part is required.' });
  }

  for (const [i, t] of rule.triggers.entries()) {
    if (t.triggerType === 'total' && (t.compareValue == null || Number.isNaN(Number(t.compareValue))))
      issues.push({ level: 'error', field: `triggers.${i}.compareValue`,
        message: 'An order-value trigger needs an amount to compare against.' });
    if (t.triggerType === 'profile' && !t.profileField)
      issues.push({ level: 'error', field: `triggers.${i}.profileField`,
        message: 'Say which part of the application this looks at.' });
    // A field that does not exist never fires, so the rule would read as cover for a
    // decision nothing is checking. api/validation.py enforces the same list; that is
    // the one that decides, this one is so the editor can say it as you type.
    if (t.triggerType === 'profile' && t.profileField && !(t.profileField in EMPTY_PROFILE))
      issues.push({ level: 'error', field: `triggers.${i}.profileField`,
        message: `${t.profileField} is not part of the application profile, so this rule would never fire.` });
    if (t.compareOp && !COMPARATORS.has(t.compareOp))
      issues.push({ level: 'error', field: `triggers.${i}.compareOp`,
        message: `${t.compareOp} is not a comparison either engine implements.` });
  }

  if (rule.effectiveTo && rule.effectiveTo < rule.effectiveFrom)
    issues.push({ level: 'error', field: 'effectiveTo', message: 'The end date is before the start date.' });
  if (rule.effectiveTo && rule.effectiveTo < new Date().toISOString().slice(0, 10))
    issues.push({ level: 'warning', field: 'effectiveTo', message: 'This end date is in the past, so the rule will never fire.' });
  if (!rule.detail?.trim())
    issues.push({ level: 'warning', field: 'detail', message: 'Without the original wording, a rep cannot see where the rule came from.' });
  if (!rule.sourceRef?.trim())
    issues.push({ level: 'warning', field: 'sourceRef', message: 'No source recorded. The quote will say the reference was not recorded.' });

  return { ok: !issues.some((i) => i.level === 'error'), issues };
}

function summarise(r: Rule): RuleSummary {
  return {
    ruleCode: r.ruleCode, technologyCode: r.technologyCode, ruleType: r.ruleType,
    summary: r.summary, author: r.author, sourceRef: r.sourceRef, severity: r.severity,
    isActive: r.isActive, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo,
    firedCount: { 'R-053': 214, 'R-011': 68, 'R-070': 41, 'R-085': 33, 'R-012': 27,
      'R-021': 19, 'R-025': 6, 'R-026': 2 }[r.ruleCode] ?? 0,
  };
}

/**
 * Does a decision already on file still describe what is being asked for?
 *
 * Same rule, same requested discount. An approver said yes to terms, not to a quote
 * in perpetuity — so deepen the discount and the old yes does not carry, and bring it
 * back down and the old no does not either. Pending records never "cover" anything;
 * they are the asking, not the answer.
 */
function coversApproval(
  decided: QuoteApproval,
  required: { ruleCode: string | null; requestedPct: number | null },
): boolean {
  return decided.status !== 'pending'
    && decided.ruleCode === required.ruleCode
    && decided.requestedPct === required.requestedPct;
}

/**
 * What the application has already ruled out, read off the catalogue's own vocabulary.
 *
 * REPORTED: "it has non-porous and porous printers / inks when it should be porous
 * like the application. It has other colors of ink when it stated black."
 *
 * Both facts were in the profile and neither reached the suggestion. This is
 * narrowing rather than grading — no verdict is being passed on the part, it simply
 * is not an answer to this application — so it lives here and not in a fit rule.
 *
 * The values are looked up in the catalogue rather than written down, because the
 * spelling is the price pages' and not mine: Surface is "Porous"/"Non-porous", and
 * Color runs to fourteen values including "Black Thermo" and "UV to Red". Two
 * different comparisons, which is why the engine is handed lists it can compare
 * exactly instead of a rule it has to interpret:
 *
 *   · Surface is exact. "Non-porous" contains the word "porous", so anything looser
 *     keeps precisely the inks the application rules out.
 *   · Colour is by word. Somebody who says "black ink" means Black and Black Thermo,
 *     and does not mean Sky Blue.
 */
/* ------------------------------------------------------------------ analytics */

/**
 * Which application questions are worth a panel, and how their answers band up.
 *
 * Not all 28. A free-text field — the message content, the adhesion note — has as many
 * answers as it has quotes, so a distribution of it is a list of sentences and tells
 * nobody anything. Those still count towards fill rate, which is the reading that
 * matters for them; they simply carry no bands.
 *
 * Numeric fields band on the boundaries the RULES use, not on round numbers. The CIJ
 * speed rules break at 574 and 1,433 fpm, so a chart bucketing 0-250-500-750 would put
 * the one boundary that decides an answer in the middle of a bar. Bands drawn where the
 * datasheets draw them mean a tall bar to the right of a boundary is a real statement
 * about machines that will struggle.
 */
const BANDS: Record<string, (v: unknown) => string | null> = {
  substrate: (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
  porosity: (v) => (v === 'porous' ? 'Porous' : v === 'nonPorous' ? 'Non-porous'
    : v === 'semiPorous' ? 'Semi-porous' : v === 'unknown' ? 'Not known' : null),
  conveyor: (v) => (v === 'new' ? 'New' : v === 'existing' ? 'Existing' : null),
  guideRails: (v) => (v === 'yes' ? 'Guide rails' : v === 'no' ? 'None' : null),
  productMotion: (v) => (v === 'moving' ? 'Moving' : v === 'stationary' ? 'Indexed' : null),
  sampleTested: (v) => (v === 'yes' ? 'Sample tested' : v === 'no' ? 'Not tested' : null),
  printQuality: (v) => (typeof v === 'string' && v ? ({
    humanReadable: 'Human readable', scannable: 'Scannable',
    graded: 'Graded barcode', graphics: 'Graphics',
  } as Record<string, string>)[v] ?? v : null),
  lineSpeedFpm: (v) => band(v, [
    [200, 'Under 200 fpm'], [574, '200 - 574'], [1433, '574 - 1,433'],
  ], 'Over 1,433'),
  charHeightMm: (v) => band(v, [
    [3, 'Under 3 mm'], [8.64, '3 - 8.64'], [25, '8.64 - 25'],
  ], 'Over 25 mm'),
  throwDistMm: (v) => band(v, [[6, 'Under 6 mm'], [12, '6 - 12'], [25, '12 - 25']], 'Over 25 mm'),
  throughputPpm: (v) => band(v, [[60, 'Under 60 ppm'], [300, '60 - 300'], [1000, '300 - 1,000']], 'Over 1,000'),
  ambientTempMaxF: (v) => band(v, [[86, 'Under 86 °F'], [104, '86 - 104']], 'Over 104 °F'),
  linesOfPrint: (v) => (typeof v === 'number' && v > 0
    ? `${v} line${v === 1 ? '' : 's'}` : null),
};

/**
 * The order the bands of a scale come back in.
 *
 * A number line has an order and a count does not respect it. Sorting a speed
 * distribution by popularity puts "574 - 1,433" between "under 200" and "over 1,433"
 * and the chart stops being a chart. These fields are emitted in the order below and
 * the client is told, through `ordered`, not to re-sort them.
 */
const BAND_ORDER: Record<string, string[]> = {
  lineSpeedFpm: ['Under 200 fpm', '200 - 574', '574 - 1,433', 'Over 1,433'],
  charHeightMm: ['Under 3 mm', '3 - 8.64', '8.64 - 25', 'Over 25 mm'],
  throwDistMm: ['Under 6 mm', '6 - 12', '12 - 25', 'Over 25 mm'],
  throughputPpm: ['Under 60 ppm', '60 - 300', '300 - 1,000', 'Over 1,000'],
  ambientTempMaxF: ['Under 86 °F', '86 - 104', 'Over 104 °F'],
  linesOfPrint: ['1 line', '2 lines', '3 lines', '4 lines', '5 lines', '6 lines'],
};

/** The band a number falls in, by upper bound. */
function band(v: unknown, edges: [number, string][], over: string): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  for (const [max, label] of edges) if (v < max) return label;
  return over;
}

/**
 * The environment is many answers in one field.
 *
 * It is stored as a comma-separated list because a line is dusty AND washed down, so
 * counting it like a single-choice field would invent a category called
 * "washdown, condensation or humidity" with a count of one. Split, and each condition
 * counts once — which makes the total across bands exceed the number of quotes, and
 * the panel says so rather than letting a reader sum it to something wrong.
 */
function environments(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map((x) => x.trim()).filter(Boolean);
}

/** How many shipped fit rules trigger on each application field. */
function ruleDependence(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of APPLICATION_RULES) {
    for (const t of r.triggers ?? []) {
      /* markHeightMm is derived from charHeightMm and linesOfPrint rather than asked,
         so the rules that read it depend on those two. Counting it as its own field
         would report eighteen rules against a question nobody is ever asked. */
      const f = t.profileField === 'markHeightMm' ? 'charHeightMm' : t.profileField;
      if (f) out[f] = (out[f] ?? 0) + 1;
    }
  }
  return out;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Answered means a real value. Blank, null and empty string are all "nobody asked". */
const isAnswered = (v: unknown) => v !== null && v !== undefined && v !== '';

export const mockApi: CpqApi = {
  async getSession() {
    await wait(120);
    /* Sample people. The addresses follow the same first-initial-plus-surname shape as
       the usernames beside them; in production both come off the Entra ID token and
       neither is constructed here. No phone numbers: the directory is where those live
       and inventing one puts a number a customer would dial onto a document. */
    const who = {
      admin:    { username: 'AXIM\\a.reyes', displayName: 'A. Reyes',
                  email: 'a.reyes@axim.example', phone: null },
      approver: { username: 'AXIM\\m.okafor', displayName: 'M. Okafor',
                  email: 'm.okafor@axim.example', phone: null },
      rep:      { username: 'AXIM\\d.ruiz',   displayName: 'D. Ruiz',
                  email: 'd.ruiz@axim.example', phone: null },
    }[previewRole];
    return {
      ...who, role: previewRole, roleSource: 'entraGroup',
      approver: previewRole === 'rep'
        ? { username: 'AXIM\\kbryson', displayName: 'K. Bryson',
            resolvedBy: 'entraManager', email: 'kbryson@axim.example' }
        : null,
    } as Session;
  },
  setPreviewRole(role) { previewRole = role; },

  async listTechnologies() { await wait(); return TECHS; },

  /* The company default for the customer's copy. Lives here in the preview and in
     cpq.app_setting in production; it is policy, not code, for the same reason the
     rules are. */
  async getDocumentDefaults() { await wait(80); return { ...DOCUMENT_DEFAULTS }; },
  async saveDocumentDefaults(d) {
    await wait(200);
    Object.assign(DOCUMENT_DEFAULTS, d);
    return { ...DOCUMENT_DEFAULTS };
  },

  /**
   * Grade every price book against the application, so the chooser can recommend
   * rather than count.
   *
   * Every book is graded, including the ones that come back with nothing — a rep
   * asking for 2,000 fpm needs to see that CIJ, TTO and print-and-apply are all
   * ruled out, because that is the finding. Hiding them would leave a laser sitting
   * on its own with no explanation of why it is the only option.
   *
   * Machines only. A book's consumables and brackets say nothing about whether the
   * technology suits the line, and counting them is what produced "947 machines ·
   * 1,157 parts" as an answer to "which technology should I sell".
   */
  async recommendBooks(profile, noConstraint) {
    await wait(140);
    const catalogue = classified();
    return TECHS.map((t) => {
      /* The same narrowing the machine list applies.
         REPORTED: "VIJ says 8 good when there's only 4." Both numbers were right
         about different questions — the book counted every VIJ machine the rules
         endorse, and the list then dropped the non-porous half because the pack is
         porous. A recommendation that counts machines a rep will never be offered is
         not a recommendation, it is a different report with the same label. */
      const { narrow, deny } = narrowingFor(profile, catalogue, t.code, NARROWING_RULES);
      const graded = suggest({
        draft: { technologyCode: t.code, profile, noConstraint },
        identity: MACHINE_IDENTITY[t.code],
        narrow, deny,
        items: catalogue, rules, categories: DISCOUNT_CATS, today: TODAY,
      });
      const n = (g: string) => graded.filter((f) => f.grade === g).length;
      const strong = n('good');
      const notRecommended = n('notRecommended');
      return {
        technologyCode: t.code,
        strong,
        caveat: n('caveat'),
        notAssessed: n('notAssessed'),
        notRecommended,
        allRuledOut: graded.length > 0 && notRecommended === graded.length,
      };
    });
  },
  async listDiscountCategories() { await wait(); return DISCOUNT_CATS; },

  async listRules(params = {}) {
    await wait();
    const q = (params.q || '').toLowerCase();
    return rules
      // Retired means retired. `r.isActive || params.includeInactive === undefined`
      // was true for every rule whenever the caller omitted the flag, so the
      // default list quietly showed retired rules — the opposite of the default.
      .filter((r) => params.includeInactive === true || r.isActive)
      .filter((r) => !params.technology || params.technology === 'all' || r.technologyCode === params.technology || r.technologyCode === null)
      .filter((r) => !params.type || params.type === 'all' || r.ruleType === params.type)
      .filter((r) => !q || (r.ruleCode + r.summary + (r.detail ?? '') + (r.author ?? '')).toLowerCase().includes(q))
      .map(summarise)
      .sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));
  },
  async getRule(ruleCode) {
    await wait();
    const r = rules.find((x) => x.ruleCode === ruleCode);
    if (!r) throw new Error(`No rule ${ruleCode}`);
    return structuredClone(r);
  },
  async validateRule(rule, opts) { await wait(90); return validate(rule, opts?.isNew); },

  /* The next free code under a prefix.
     Asked for: "it should be auto-filling the next available rule code when you are
     adding a rule." Numeric families count up from the highest in use; a named family
     has nothing to count, so the prefix comes back for the author to finish. */
  async nextRuleCode(prefix) {
    await wait(40);
    const p = (prefix || 'R-').toUpperCase();
    const used = rules
      .map((r) => r.ruleCode)
      .filter((c) => c.startsWith(p))
      .map((c) => Number(c.slice(p.length)))
      .filter((n) => Number.isFinite(n));
    if (!used.length) return `${p}001`;
    const next = Math.max(...used) + 1;
    return `${p}${String(next).padStart(3, '0')}`;
  },
  async saveRule(rule, opts) {
    await wait(240);
    const result = validate(rule, opts?.isNew);
    if (!result.ok) throw Object.assign(new Error('Validation failed'), { issues: result.issues });
    const i = rules.findIndex((x) => x.ruleCode === rule.ruleCode);
    /* A create that lands on an existing code silently REPLACED it — findIndex found
       the old rule and the new one was written over it. That is worse than the
       duplicate that was reported: a rule disappears and nothing says so. */
    if (opts?.isNew && i >= 0) {
      throw new Error(`${rule.ruleCode} already exists. Give the new rule its own code.`);
    }
    const saved = { ...rule, updatedBy: 'AXIM\\amccall', updatedAt: new Date().toISOString() };
    if (i >= 0) rules[i] = saved; else rules.push(saved);
    (AUDIT[rule.ruleCode] ||= []).unshift({
      auditId: Date.now(), action: i >= 0 ? 'update' : 'insert',
      changedBy: 'AXIM\\amccall', changedAt: new Date().toISOString(),
      summary: i >= 0 ? 'Edited in the admin screen' : 'Created in the admin screen',
    });
    return saved;
  },
  async getRuleAudit(ruleCode) { await wait(); return AUDIT[ruleCode] ?? []; },

  async addConfiguredItem(spec) {
    await wait(120);
    const already = ITEMS.find((i) => i.itemNo === spec.itemNo);
    if (already) return structuredClone(already);
    /* Quotable the moment it exists, like anything else the catalogue carries. The
       discount category is 'system' because a configured laser IS the machine, and
       the role is 'printer' for the same reason — every structure rule that says "a
       printer is on the quote and no mount is" has to see it. */
    const item: Item = {
      itemNo: spec.itemNo,
      description: spec.description,
      prodCat: `${spec.technologyCode}-PRI`,
      prodCatDesc: `${spec.technologyCode} printer`,
      technologyCode: spec.technologyCode,
      itemRole: 'printer',
      discountCatCode: 'system',
      listPrice: spec.listPrice,
      stdCost: null,
      model: spec.model,
      classSource: 'configurator',
      uom: 'EA',
      isActive: true,
      attributes: spec.attributes ?? {},
    };
    ITEMS.push(item);
    return structuredClone(item);
  },

  /* What kinds of part this book holds, counted.
     Offered rather than listed from a fixed vocabulary: the categories come from the
     hierarchy and differ by technology — a laser book has Stands and no Ribbon — so
     a hard-coded list would show a rep filters that return nothing, which is how two
     of the ten role filters on the Classify screen used to behave. */
  async listCategories(technology: string) {
    await wait(60);
    const counts = new Map<string, number>();
    for (const i of classified()) {
      if (!i.isActive) continue;
      // A rule that belongs to every book wants every book's categories.
      if (technology && i.technologyCode !== technology
          && i.technologyCode !== ALL_TECHNOLOGIES) continue;
      if (!i.category) continue;
      counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    }
    // An added category with nothing in it still has to appear, or there is no way
    // to file the first part under it.
    for (const name of ADDED_CATEGORIES) if (!counts.has(name)) counts.set(name, 0);
    for (const name of REMOVED_CATEGORIES) counts.delete(name);
    return [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  },

  /* Adding and removing a price book.
     Same rule as a category and one more: ALL is the sentinel every book shares and
     is not somebody's to delete. */
  async addTechnology(code, name) {
    await wait(80);
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,7}$/.test(clean)) {
      throw new Error('A price book code is 2 to 8 capitals, like CIJ or PALM.');
    }
    if (clean === ALL_TECHNOLOGIES) throw new Error(`${ALL_TECHNOLOGIES} is reserved.`);
    if (TECHS.some((t) => t.code === clean)) throw new Error(`${clean} already exists.`);
    TECHS.push({ code: clean, name: name.trim() || clean, ruleCount: 0, itemCount: 0, machineCount: 0 });
  },

  async removeTechnology(code) {
    await wait(80);
    if (code === ALL_TECHNOLOGIES) throw new Error(`${ALL_TECHNOLOGIES} is reserved.`);
    const parts = classified().filter((i) => i.technologyCode === code && i.isActive).length;
    if (parts > 0) {
      throw new Error(`${parts} part${parts === 1 ? ' is' : 's are'} in ${code}. `
        + 'Move them first — a price book cannot be removed from under a part.');
    }
    const used = rules.filter((r) => r.technologyCode === code).length;
    if (used > 0) {
      throw new Error(`${used} rule${used === 1 ? '' : 's'} belong to ${code}. Retire them first.`);
    }
    const at = TECHS.findIndex((t) => t.code === code);
    if (at >= 0) TECHS.splice(at, 1);
  },

  /* And a type. The engine reads these — a structure rule says "a printer is on the
     quote and no accessory is" — so a type a rule names is not safe to drop. */
  /* With a count each, because the panel disables removal while anything is filed
     under a value — and a Remove button that is not disabled and not counted is a red
     button that looks live and then refuses. Reported. */
  /* The same computation the service does, over the same rule set. Kept in step by
     api/tests/test_route_parity.py, which insists every client call has a route. */
  async listRequirements(technologyCode) {
    await wait(40);
    const out = [];
    for (const r of rules) {
      if (r.technologyCode && r.technologyCode !== technologyCode) continue;
      if (!r.isActive) continue;
      const wantsMachine = r.triggers.some(
        (t) => t.triggerType === 'role' && t.itemRole === 'printer' && t.compareOp !== 'ne');
      const missing = r.triggers.find(
        (t) => t.triggerType === 'role' && t.compareOp === 'ne' && t.itemRole);
      if (!wantsMachine || !missing?.itemRole) continue;
      out.push({
        role: missing.itemRole,
        ruleCode: r.ruleCode,
        summary: r.actions[0]?.message ?? r.summary,
        sourceRef: r.sourceRef ?? null,
        author: r.author ?? null,
      });
    }
    return out;
  },

  async listItemRoles() {
    await wait(40);
    const live = classified();
    return ROLES.map((name) => ({
      name,
      count: live.filter((i) => i.itemRole === name && i.isActive).length,
    }));
  },

  async addItemRole(name) {
    await wait(80);
    const clean = name.trim().toLowerCase();
    if (!/^[a-z][a-z ]{2,19}$/.test(clean)) {
      throw new Error('A type is a lower-case word, like printhead or consumable.');
    }
    if (ROLES.includes(clean)) throw new Error(`${clean} already exists.`);
    ROLES.push(clean);
  },

  async removeItemRole(name) {
    await wait(80);
    const parts = classified().filter((i) => i.itemRole === name && i.isActive).length;
    if (parts > 0) {
      throw new Error(`${parts} part${parts === 1 ? ' is' : 's are'} typed as ${name}. `
        + 'Retype them first — a type cannot be removed from under a part.');
    }
    const used = rules.filter((r) => JSON.stringify(r).includes(`"itemRole":"${name}"`)).length;
    if (used > 0) {
      throw new Error(`${used} rule${used === 1 ? '' : 's'} read the type ${name}. Change them first.`);
    }
    const at = ROLES.indexOf(name);
    if (at >= 0) ROLES.splice(at, 1);
  },

  /* Adding and removing a category.
     Asked for: "let the user add and remove categories but ONLY if nothing is
     currently classified under it." That rule is the whole safety of it — a category
     that disappears from under a part leaves the part saying nothing at all, and
     nobody would notice until a filter came back empty. */
  async addCategory(name) {
    await wait(80);
    const clean = name.trim();
    if (!clean) throw new Error('A category needs a name.');
    const already = await this.listCategories('');
    if (already.some((c) => c.category.toLowerCase() === clean.toLowerCase())) {
      throw new Error(`${clean} already exists.`);
    }
    /* A category may not repeat a type.
       The two levels exist to say different things, and "Inks" under the type `ink`
       is one fact filed twice — it also pushes the categories that DO say something
       down a list a rep is scanning. The build strips these out; this stops them
       being typed back in. */
    const asRole = clean.toLowerCase().replace(/s$/, '');
    if (ROLES.includes(asRole) || ROLES.includes(clean.toLowerCase())) {
      throw new Error(
        `${clean} is already a type, so it would be the same fact twice. `
        + 'A category says what a type cannot — Stands, Conveyor, Tamp Pad.');
    }
    REMOVED_CATEGORIES.delete(clean);
    ADDED_CATEGORIES.add(clean);
  },

  async removeCategory(name) {
    await wait(80);
    const used = classified().filter((i) => i.category === name && i.isActive).length;
    if (used > 0) {
      throw new Error(
        `${used} part${used === 1 ? ' is' : 's are'} still classified as ${name}. `
        + 'Move them first — a category cannot be removed from under a part.');
    }
    ADDED_CATEGORIES.delete(name);
    REMOVED_CATEGORIES.add(name);
  },

  async searchItems({ q = '', role, technology, category, limit = 25 }) {
    await wait();
    const needle = q.toLowerCase().trim();
    const words = needle.split(/\s+/).filter(Boolean);
    /* Overrides win here as they do everywhere else — through the one resolver, now
       that there is one. This had its own copy of that logic and it had drifted: it
       applied the technology and the role and not the category, so a part filed under
       a new category could not be found by it. */
    return classified()
      /* ALL is every book, not a book of its own. A promotion, a service offering or
         a training day is sold alongside whatever the customer is buying, so it has to
         appear on a CIJ quote and a laser quote alike. */
      .filter((i) => !technology
        || i.technologyCode === technology
        || i.technologyCode === ALL_TECHNOLOGIES)
      .filter((i) => !role || i.itemRole === role)
      .filter((i) => !category || i.category === category)
      // Every word has to appear somewhere, so "6420 white" narrows rather than
      // widening. With 1,590 parts a single-substring match is not enough.
      .filter((i) => {
        if (!words.length) return true;
        const hay = (i.itemNo + ' ' + i.description + ' '
          + Object.values(i.attributes).join(' ')).toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, limit);
  },

  async listProductLines() {
    await wait();
    return structuredClone(PRODUCT_LINES);
  },

  async saveProductLines(rows) {
    await wait(300);
    for (const r of rows) {
      const at = PRODUCT_LINES.findIndex((x) => x.productLine === r.productLine);
      if (at < 0) continue;
      // Editing a row is a decision, so it stops being an assumption.
      PRODUCT_LINES[at] = { ...PRODUCT_LINES[at], ...r, confidence: 'confirmed' };
    }
    return structuredClone(PRODUCT_LINES);
  },

  async listClassification(params = {}) {
    await wait();
    const words = (params.q || '').toLowerCase().split(/\s+/).filter(Boolean);

    /* Everything quotable, plus everything the sources could not place. One list,
       because an item has a technology and a type and that is the whole of it. */
    const gaps: ClassifiedItem[] = REVIEW
      .filter((r) => !CLASSIFIED.has(r.itemNo))
      .map((r) => ({
        itemNo: r.itemNo, description: r.description,
        technologyCode: r.technologyCode, itemRole: r.itemRole,
        status: (!r.technologyCode ? 'needsTechnology'
          : r.why === 'unearnedMachine' ? 'unearned'
            : !r.itemRole ? 'needsType' : 'classified') as ClassifiedItem['status'],
        listPrice: r.listPrice ?? null,
        classSource: 'hierarchy',
      }));
    const gapNos = new Set(gaps.map((g) => g.itemNo));

    const settled: ClassifiedItem[] = ITEMS
      .filter((i) => !gapNos.has(i.itemNo))
      .map((i) => {
        const override = CLASSIFIED.get(i.itemNo);
        /* An override that agrees with what the sources already say is doing no work
           and will outlive the reason it was written. Flagged so it can be dropped. */
        const redundant = !!override
          && (override.technologyCode ?? null) === (i.technologyCode ?? null)
          && override.itemRole === i.itemRole
          // A field the override does not mention is not a disagreement. Only a
          // category it actually SETS can make it disagree.
          && (override.category === undefined
              || (override.category ?? null) === (i.category ?? null));
        return {
          itemNo: i.itemNo, description: i.description,
          technologyCode: override?.technologyCode ?? i.technologyCode,
          itemRole: override?.itemRole ?? i.itemRole,
          category: override?.category === undefined ? i.category : override.category,
          status: (redundant ? 'redundantOverride' : 'classified') as ClassifiedItem['status'],
          classSource: override ? 'manual' : i.classSource ?? null,
          listPrice: i.listPrice,
        };
      });

    const all = [...gaps, ...settled];
    const counts: Record<string, number> = {
      classified: 0, needsTechnology: 0, needsType: 0, unearned: 0, redundantOverride: 0,
    };
    for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;

    const hits = all
      .filter((r) => !params.status || params.status === 'all' || r.status === params.status)
      .filter((r) => !params.technology || r.technologyCode === params.technology)
      .filter((r) => !params.role || r.itemRole === params.role)
      /* '__none' is a real answer: the parts nothing has been filed under are exactly
         the ones somebody is looking for when they add a category. */
      .filter((r) => !params.category
        || (params.category === '__none' ? !r.category : r.category === params.category))
      .filter((r) => !words.length
        || words.every((w) => (r.itemNo + ' ' + r.description).toLowerCase().includes(w)))
      .sort((a, b) =>
        // Anything needing a person first; it is the only part of this list that is work.
        (a.status === 'classified' ? 1 : 0) - (b.status === 'classified' ? 1 : 0)
        || a.itemNo.localeCompare(b.itemNo));

    return { items: hits.slice(0, params.limit ?? 40), total: hits.length, counts };
  },

  async clearOverrides(itemNos) {
    await wait(200);
    let cleared = 0;
    for (const n of itemNos) if (CLASSIFIED.delete(n)) cleared += 1;
    return { cleared };
  },

  async classifyItems(rows) {
    await wait(280);
    /* The override is stored beside the catalogue, never written into it.
       It used to overwrite the CATALOG row, which destroyed the only copy of what
       the hierarchy had said — so a classification could never be told from the
       source it replaced, "this override adds nothing" was undetectable because
       every override matched the value it had just overwritten, and dropping one
       restored nothing because there was nothing left to restore.

       Production never had that problem: cpq.v_item_class resolves override over
       hierarchy at read time and the hierarchy is untouched. The mock exists to
       behave like the service, and on this it did not. */
    for (const r of rows) CLASSIFIED.set(r.itemNo, r);
    return { saved: rows.length };
  },

  /**
   * Everything the analytics page draws, computed the way the service will compute it.
   *
   * Scoped to what the caller may see before anything is counted, never after. An
   * aggregate is the one place that rule is easy to forget and expensive to skip: a
   * rep must not learn the company's revenue from a total nobody thought to narrow.
   */
  async getAnalytics(): Promise<Analytics> {
    await wait(300);
    const role = previewRole;
    const me = 'AXIM\\druiz';
    const visible = QUOTES.filter(
      (q) => role === 'admin' || role === 'approver' || q.repUsername === me);
    const scope: Analytics['scope'] =
      role === 'admin' ? 'all' : role === 'approver' ? 'team' : 'mine';

    const deps = ruleDependence();
    const profiles = visible.map((q) => q.profile ?? ({} as ApplicationProfile));

    /* Every question, in the order the application asks it, so a reader scanning this
       page and a rep filling the form are moving through the same list. */
    const fields = (Object.keys(EMPTY_PROFILE) as (keyof ApplicationProfile)[]);
    const application = fields.map((field) => {
      const answered = profiles.filter((p) => isAnswered(p[field])).length;
      const noConstraint = visible.filter(
        (q) => (q.noConstraint ?? []).includes(field)).length;

      const counts = new Map<string, number>();
      if (field === 'environment') {
        for (const p of profiles) {
          for (const one of environments(p[field])) {
            counts.set(one, (counts.get(one) ?? 0) + 1);
          }
        }
      } else if (BANDS[field]) {
        for (const p of profiles) {
          const label = BANDS[field](p[field]);
          if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      }
      const order = BAND_ORDER[field];
      const bands = order
        /* A scale keeps its own order, and a band nobody landed in is still a band —
           an empty "over 1,433 fpm" is the statement that nothing goes that fast, and
           dropping it would silently redraw the axis. */
        ? order.filter((l) => counts.has(l)).map((l) => ({ label: l, count: counts.get(l)! }))
        : [...counts.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

      return {
        field,
        label: FIELD_LABEL[field] ?? field,
        answered,
        noConstraint,
        ruleCount: deps[field] ?? 0,
        bands,
        ordered: Boolean(order),
        multi: field === 'environment',
      };
    });

    const answeredPerQuote = profiles.map(
      (p) => fields.filter((f) => isAnswered(p[f])).length);

    const byStatus = new Map<Quote['status'], { count: number; value: number }>();
    for (const q of visible) {
      const at = byStatus.get(q.status) ?? { count: 0, value: 0 };
      at.count += 1;
      at.value += q.orderTotal ?? 0;
      byStatus.set(q.status, at);
    }

    const discounts = DISCOUNT_CATS.map((c) => {
      const asked = visible
        .map((q) => q.categoryDiscounts?.[c.code])
        .filter((v): v is number => typeof v === 'number' && v > 0);
      const counts = new Map<string, number>();
      for (const v of asked) {
        const label = v <= 0.1 ? 'Up to 10%' : v <= 0.2 ? '10 – 20%'
          : v <= 0.3 ? '20 – 30%' : 'Over 30%';
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      return {
        code: c.code,
        displayName: c.displayName,
        ceiling: c.maxDiscount,
        overCeiling: c.maxDiscount == null ? 0
          : asked.filter((v) => v > c.maxDiscount!).length,
        bands: [...counts.entries()].map(([label, count]) => ({ label, count })),
      };
    });

    const allApprovals = visible.flatMap((q) => q.approvals ?? []);
    const decided = allApprovals.filter((a) => a.status !== 'pending');

    /* What the rules actually did, from the trace stored against every quote. Counted
       per quote rather than per trace row: a rule that speaks twice about one quote
       still only had one opinion about it. */
    const fired = new Map<string, { summary: string; fired: number; blocked: number }>();
    for (const q of visible) {
      const seen = new Set<string>();
      for (const t of q.trace ?? []) {
        if (seen.has(t.ruleCode)) continue;
        seen.add(t.ruleCode);
        const at = fired.get(t.ruleCode)
          ?? { summary: t.ruleSummary ?? '', fired: 0, blocked: 0 };
        at.fired += 1;
        if (t.status === 'blocked') at.blocked += 1;
        fired.set(t.ruleCode, at);
      }
    }

    return {
      quotes: visible.length,
      scope,
      described: profiles.filter((p) => fields.some((f) => isAnswered(p[f]))).length,
      medianAnswered: median(answeredPerQuote),
      application,
      pipeline: [...byStatus.entries()]
        .map(([status, at]) => ({ status, ...at }))
        .sort((a, b) => b.count - a.count),
      discounts,
      approvals: {
        pending: allApprovals.filter((a) => a.status === 'pending').length,
        approved: allApprovals.filter((a) => a.status === 'approved').length,
        declined: allApprovals.filter((a) => a.status === 'declined').length,
        /* Null until something has been decided, rather than zero. Zero hours is a
           decision taken instantly; nothing decided yet is not a duration at all. */
        medianHours: decided.length ? 18 : null,
      },
      rules: [...fired.entries()]
        .map(([ruleCode, at]) => ({ ruleCode, ...at }))
        .sort((a, b) => b.fired - a.fired)
        .slice(0, 12),
      neverFired: rules
        .filter((r) => r.isActive && !fired.has(r.ruleCode))
        .map((r) => ({ ruleCode: r.ruleCode, summary: r.summary }))
        .slice(0, 12),
    };
  },

  async listQuotes(params = {}) {
    await wait();
    const me = (await this.getSession()).username;
    const q = (params.q || '').toLowerCase();
    return QUOTES
      .filter((x) => (params.mine === false ? true : previewRole === 'admin' ? true : x.repUsername === me || x.approvals.length > 0))
      .filter((x) => !params.status || params.status === 'all' || x.status === params.status)
      .filter((x) => !q || (x.quoteNo + ' ' + (x.customerName ?? '') + ' ' + (x.lineName ?? '')).toLowerCase().includes(q))
      .map(({ lines, trace, approvals, extendedList, extendedNet, totalDiscount, marginPct, ...s }) => ({
        ...s,
        /* Carried onto the summary so an approver can triage without opening
           every quote. The deepest ask, because that is the one that decides. */
        requestedPct: approvals
          .filter((a) => a.status === 'pending')
          .reduce<number | null>(
            (worst, a) => (a.requestedPct != null && (worst == null || a.requestedPct > worst)
              ? a.requestedPct : worst), null),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getQuote(quoteNo) {
    await wait();
    const found = QUOTES.find((x) => x.quoteNo === quoteNo);
    if (!found) throw new Error(`No quote ${quoteNo}`);
    return structuredClone(found);
  },
  async decideApproval(quoteNo, approvalId, decision, note) {
    await wait(260);
    const qt = QUOTES.find((x) => x.quoteNo === quoteNo)!;
    const ap = qt.approvals.find((a) => a.approvalId === approvalId);
    if (ap) {
      ap.status = decision;
      // Kept with the decision. The note was already in the API signature and was
      // being dropped on the floor here, so an approver typed their reason and the
      // rep never saw it.
      ap.note = note?.trim() ? note.trim() : null;
      ap.decidedAt = new Date().toISOString();
    }
    qt.approvalsPending = qt.approvals.filter((a) => a.status === 'pending').length;
    // Approval moves the quote FORWARD; a decline sends it back to the rep.
    //
    // This read `if (approved) qt.status = 'draft'` with no branch for a decline at all,
    // so approving pushed the quote backwards into draft and declining left it sitting in
    // pendingApproval forever — the two transitions were, between them, exactly wrong.
    //
    // approved  → 'approved': the discount is granted and the rep may send it.
    // declined  → 'draft':    it goes back to the person who asked, to change and resubmit.
    if (!qt.approvalsPending) {
      qt.status = qt.approvals.some((a) => a.status === 'declined') ? 'draft' : 'approved';
    }
    return structuredClone(qt);
  },

  /* --- the quote builder ------------------------------------------------
     Every one of these routes through the same `evaluate`. Nothing on this
     side of the wire works out a price, because in the real tool nothing on
     this side of the wire is allowed to. */

  async evaluateDraft(draft: QuoteDraft): Promise<Evaluation> {
    await wait(140);
    return evaluate({ draft, items: classified(), rules, categories: DISCOUNT_CATS, today: TODAY });
  },

  async suggestItems(req) {
    await wait(180);
    /* Documentation is a real signal and it is here; order history is a real
       signal and it is not. The preview has no sales history, and seeding a
       plausible-looking order count would be inventing a business fact to make a
       ranking look cleverer than it is. So `orders` is left absent and the sort
       falls through to documentation, which is exactly what the real service will
       do for a part Orbit has never sold. */
    const roles = req.roles?.length ? req.roles : ['printer'];
    const catalogue = classified();
    const { narrow, deny, applied } = narrowingFor(
      req.profile, catalogue, req.technologyCode, NARROWING_RULES);
    const inScope = (i: typeof ITEMS[number]) =>
      (i.technologyCode === req.technologyCode || i.technologyCode === ALL_TECHNOLOGIES)
      && roles.includes(i.itemRole ?? '');

    const rank: Record<string, { documented?: boolean }> = {};
    for (const i of catalogue) {
      if (!inScope(i)) continue;
      const m = mediaFor(i.model);
      rank[i.itemNo] = { documented: !!(m?.doc && m?.thumb) };
    }

    const graded = suggest({
      draft: {
        technologyCode: req.technologyCode, profile: req.profile,
        // What is already on the quote, so a rule about the machine can speak for
        // the parts that go with it.
        lines: req.lines ?? [],
      },
      attributes: req.attributes, q: req.q, rank, roles, narrow, deny,
      // Configurations of one machine collapse; two brackets are two brackets.
      identity: roles.includes('printer') ? MACHINE_IDENTITY[req.technologyCode] : undefined,
      items: classified(), rules, categories: DISCOUNT_CATS, today: TODAY,
    });

    // Which attributes are worth offering as filters differs by technology —
    // a laser has no ink. Only attributes with more than one value narrow
    // anything, so the rest are not shown as a control that does nothing.
    const facets: Record<string, string[]> = {};
    for (const i of catalogue) {
      if (!inScope(i)) continue;
      for (const [k, v] of Object.entries(i.attributes)) {
        (facets[k] ||= []).includes(v) || facets[k].push(v);
      }
    }
    for (const [k, v] of Object.entries(facets)) {
      if (v.length < 2 || v.length > 60) delete facets[k];
      else facets[k] = v.sort();
    }

    /* How many each narrowing rule took, counted rather than estimated.
       The rules are applied together, so "how many did N-POROSITY remove" is asked by
       grading the same book with that one rule left out. It is the only honest answer
       when two rules can remove the same row, and the cost is one extra pass per
       narrowing rule over a list the engine has already filtered. */
    const narrowed = applied.map((a) => {
      const without = narrowingFor(req.profile, catalogue, req.technologyCode,
        NARROWING_RULES.filter((r) => r.ruleCode !== a.ruleCode));
      const wider = suggest({
        draft: { technologyCode: req.technologyCode, profile: req.profile,
                 lines: req.lines ?? [] },
        attributes: req.attributes, q: req.q, rank, roles,
        narrow: without.narrow, deny: without.deny,
        identity: roles.includes('printer') ? MACHINE_IDENTITY[req.technologyCode] : undefined,
        items: classified(), rules, categories: DISCOUNT_CATS, today: TODAY,
      });
      /* Two numbers, because a book that collapses configurations has two answers.
         The CIJ list shows 8 machines standing for 947 orderable configurations, and
         the porosity rule removes 284 of those configurations without removing a
         single machine — every machine is sold in both porous and non-porous fills.
         Reporting only rows would say "nothing was hidden", which is false; reporting
         only configurations would say "284 hidden" on a screen showing 8 rows, which
         is unreadable. So: what disappeared, and what it was made of. */
      const options = (f: typeof graded) => f.reduce((n, x) => n + (x.variants ?? 1), 0);
      return {
        ...a,
        removed: wider.length - graded.length,
        removedOptions: options(wider) - options(graded),
      };
    }).filter((a) => (a.removed ?? 0) > 0 || (a.removedOptions ?? 0) > 0);

    return {
      items: graded.slice(0, req.limit ?? 8),
      total: graded.length,
      facets,
      narrowed,
    };
  },

  async createQuote(draft: QuoteDraft): Promise<Quote> {
    await wait(320);
    /* A counter, not a count. Numbering off QUOTES.length reissued a number the
       moment anything was removed from the list, which is the one thing a quote
       number may never do. The real thing is cpq.seq_quote_no, a SQL SEQUENCE, and a
       sequence only ever goes up — including across a rollback, which is why it can
       promise uniqueness and a max()+1 cannot. */
    const seq = nextSeq++;
    const quoteNo = `Q-2026-${String(seq).padStart(4, '0')}`;
    const session = await this.getSession();
    const q: Quote = {
      quoteNo, technologyCode: draft.technologyCode, status: 'draft',
      customerNo: draft.customerNo, customerName: draft.customerName,
      lineName: draft.lineName,
      repUsername: session.username, repDisplay: session.displayName,
      orderTotal: 0, lineCount: 0, updatedAt: new Date().toISOString(),
      approvalsPending: 0, lines: [], trace: [], approvals: [],
      extendedList: 0, extendedNet: 0, totalDiscount: 0, marginPct: null,
      profile: draft.profile, noConstraint: draft.noConstraint ?? [], flags: draft.flags,
      categoryDiscounts: draft.categoryDiscounts,
      flatDiscount: draft.flatDiscount ?? null,
      // The stations, each with its own name, book and application.
      solutions: draft.solutions ?? [],
    };
    QUOTES.unshift(q);
    DRAFTS.set(quoteNo, draft);
    return this.saveQuote(quoteNo, draft);
  },

  async saveQuote(quoteNo: string, draft: QuoteDraft): Promise<Quote> {
    await wait(280);
    const q = QUOTES.find((x) => x.quoteNo === quoteNo);
    if (!q) throw new Error(`No quote ${quoteNo}`);
    DRAFTS.set(quoteNo, draft);
    const ev = evaluate({ draft, items: classified(), rules, categories: DISCOUNT_CATS, today: TODAY });
    Object.assign(q, {
      technologyCode: draft.technologyCode,
      customerNo: draft.customerNo, customerName: draft.customerName,
      lineName: draft.lineName,
      profile: draft.profile, noConstraint: draft.noConstraint ?? [], flags: draft.flags,
      categoryDiscounts: draft.categoryDiscounts,
      flatDiscount: draft.flatDiscount ?? null,
      // The stations, each with its own name, book and application.
      solutions: draft.solutions ?? [],
      lines: ev.lines, trace: ev.trace, fit: ev.fit, blocked: ev.blocked,
      extendedList: ev.extendedList, extendedNet: ev.extendedNet,
      totalDiscount: ev.totalDiscount, orderTotal: ev.orderTotal,
      marginPct: ev.marginPct, marginNote: ev.marginNote,
      lineCount: ev.lines.length, updatedAt: new Date().toISOString(),
      /* The customer copy's own settings, which this dropped on the floor.
         saveQuote wrote every other field of the draft and not this one, so the
         customer-copy editor saved, said it had saved, and the wording and layout
         were gone the moment the quote was read back. Undefined is left alone
         rather than written as null: a caller that does not mention the document
         is not asking to clear it. */
      ...(draft.document !== undefined ? { document: draft.document } : {}),
    });

    /* A decision that no longer describes this quote is dropped.
       Saving recomputed the lines, the trace and the totals and left the approvals
       untouched, so a decline outlived the terms it was about: the rep did what the
       approver asked, saved, and the quote was still refused with no way back. What
       survives a save is a decision that still covers what the quote now needs. */
    const before = q.approvals.length;
    q.approvals = q.approvals.filter(
      (a) => a.status === 'pending'
        || ev.requiredApprovals.some((r) => coversApproval(a, r)));
    if (q.approvals.length !== before || q.status === 'draft') {
      q.approvalsPending = q.approvals.filter((a) => a.status === 'pending').length;
    }

    return structuredClone(q);
  },

  async submitQuote(quoteNo: string, to?: string, note?: string): Promise<Quote> {
    await wait(360);
    const q = QUOTES.find((x) => x.quoteNo === quoteNo);
    if (!q) throw new Error(`No quote ${quoteNo}`);
    const draft = draftFor(q);

    // Re-evaluate at submit. The draft may have been saved against rules that
    // have since changed, and it is the numbers being sent that must be legal.
    if (to) draft.recipientEmail = to;
    const ev = evaluate({ draft, items: classified(), rules, categories: DISCOUNT_CATS, today: TODAY });

    /* Whose note is this?
       A submission that needs approving is addressed to the approver, and what a rep
       writes there is internal — the competitor, the volume, what the customer
       threatened. It used to go into coveringNote, which is the paragraph that goes
       out with the quote, so the argument was posted to the person it was about. */
    /* Outstanding, not merely required. The rules still require an approval for a
       45% discount after one has been granted; what changed is that a decision
       exists. Asking "is one required" sent every later note to the approver and
       never to the customer, so an approved quote could not be sent with a covering
       letter at all. */
    const goesForApproval = ev.requiredApprovals.some(
      (r) => !q.approvals.some((a) => coversApproval(a, r) && a.status === 'approved'));
    if (note !== undefined) {
      if (goesForApproval) draft.approvalNote = note;
      else draft.coveringNote = note;
    }
    if (ev.blocked) throw new Error('This quote is blocked by a rule and cannot be sent.');

    const session = await this.getSession();

    /* An approval already granted is not asked for again.
       Sending rebuilt this list from the evaluation every time, so a quote that had
       just been approved went straight back to pendingApproval the moment the rep
       sent it: the approver's decision was overwritten by a fresh 'pending' record
       of the same requirement, and the quote could never leave the building.

       What matters is whether the decisions on file still cover what is being sent.
       A granted approval covers a requirement when it is the same rule at the same
       requested discount. If the rep has since deepened the discount, the old
       approval was for different terms and does not carry over — so that
       requirement becomes a new pending request while the others keep their
       decisions. */
    const carried = new Set<number>();
    q.approvals = ev.requiredApprovals.map((a, i) => {
      const decided = q.approvals.find(
        (x) => !carried.has(x.approvalId) && coversApproval(x, a));
      if (decided) {
        carried.add(decided.approvalId);
        return decided;
      }
      return {
        approvalId: i + 1,
        ruleCode: a.ruleCode,
        reason: a.reason,
        requestedPct: a.requestedPct,
        statedMax: a.statedMax,
        approverUser: session.approver?.username ?? 'AXIM\\kbryson',
        approverDisplay: session.approver?.displayName ?? 'K. Bryson',
        resolvedBy: session.approver?.resolvedBy ?? 'technology',
        status: 'pending' as const,
        requestedAt: new Date().toISOString(),
      };
    });
    /* Refused means refused.
       Marking the quote 'draft' on a decline was not a gate — the send still
       succeeded, so a rep could be told no and send it anyway. The refusal belongs
       here, on the server, because the UI is not somewhere a rule can be enforced.

       Only when the decline still covers these terms. A rep who brings the discount
       down after being refused is submitting a different quote, and that one gets a
       fresh decision rather than the old answer held against it. */
    const refused = q.approvals.filter((x) => x.status === 'declined');
    if (refused.length) {
      const why = refused.map((x) => x.note).filter(Boolean).join(' ');
      throw new Error(
        `${refused[0].approverDisplay ?? 'The approver'} declined this quote`
        + (why ? `: ${why}` : '.')
        + ' Change it and it will go back for a new decision.');
    }

    q.approvalsPending = q.approvals.filter((x) => x.status === 'pending').length;
    q.recipientEmail = draft.recipientEmail ?? null;
    q.coveringNote = draft.coveringNote ?? null;
    // Kept when there is one, rather than cleared by a later send to the customer:
    // the reasoning behind a granted discount is part of the quote's record.
    if (draft.approvalNote != null) q.approvalNote = draft.approvalNote;
    q.status = q.approvalsPending ? 'pendingApproval' : 'sent';
    /* The manager's copy, taken at the moment of sending.
       Only on the send — a submission for approval already goes to them, and
       recording a copy for it would say the customer's quote went out when it has
       not. An unroutable reporting line copies nobody rather than failing the
       send: a quote that cannot reach a manager still has to reach the customer. */
    if (q.status === 'sent') {
      const manager = (await this.getSession()).approver;
      q.copiedTo = manager?.email ? [manager.email] : null;
    }
    q.updatedAt = new Date().toISOString();
    return structuredClone(q);
  },

  async duplicateQuote(quoteNo: string): Promise<Quote> {
    await wait(300);
    const original = QUOTES.find((x) => x.quoteNo === quoteNo);
    if (!original) throw new Error(`No quote ${quoteNo}`);
    // Reopening a quote used to just open it, which meant editing last
    // quarter's record instead of starting from it. The copy carries the intent
    // and none of the history: no approvals, no trace, status back to draft.
    /* Read from the quote, not from the session's draft cache. This was
       `draftFor(original) ?? <spelled-out conversion>`, and draftFor never returns
       null — so the fallback was unreachable and the copy behaved one way with the
       quote open and another way in a fresh session. The spelled-out half had also
       never been given the noConstraint fix the other four copies got. */
    const draft: QuoteDraft = draftFromQuote(original);
    return this.createQuote({ ...draft, recipientEmail: null, coveringNote: null });
  },

  async deleteQuote(quoteNo: string): Promise<void> {
    await wait(240);
    const at = QUOTES.findIndex((x) => x.quoteNo === quoteNo);
    if (at < 0) throw new Error(`No quote ${quoteNo}`);
    if (QUOTES[at].status !== 'draft') {
      throw new Error('Only a draft can be deleted. A sent quote is a record of '
        + 'what the customer was told.');
    }
    QUOTES.splice(at, 1);
    DRAFTS.delete(quoteNo);
  },

  /* Losing one, and unlosing it.
     Deleting is for a draft that should never have existed; this is for a quote that
     did its job and did not win. The record stays — what the customer was told, what
     was approved, and now why it stopped — because that is the only version of this
     that is worth anything six months later. */
  /* A quote that went out by another route.
     The approval gate still applies — sending a quote yourself is not a way around
     the discount rules, and a rep who tries it should be told which decision is
     outstanding rather than quietly succeeding. Everything else about it is the
     rep's account of what they did, recorded as such. */
  async markSentOutside(quoteNo, details) {
    await wait(260);
    const q = QUOTES.find((x) => x.quoteNo === quoteNo);
    if (!q) throw new Error(`No quote ${quoteNo}`);

    const draft = draftFor(q);
    const ev = evaluate({ draft, items: classified(), rules, categories: DISCOUNT_CATS, today: TODAY });
    const outstanding = ev.requiredApprovals.filter(
      (r) => !q.approvals.some((a) => coversApproval(a, r) && a.status === 'approved'));
    if (outstanding.length) {
      throw new Error(
        'This quote still needs approval, so it cannot be recorded as sent. '
        + `${outstanding[0].reason} Send it for approval first.`);
    }
    if (ev.blocked) {
      throw new Error('This quote cannot be sent as it stands — see the findings on it.');
    }

    const to = details.to.trim();
    if (!to) throw new Error('Say who it went to.');

    q.sentOutside = {
      at: new Date().toISOString(),
      to,
      note: details.note?.trim() || null,
      file: details.file ?? null,
    };
    q.recipientEmail = to;
    q.status = 'sent';
    // The manager sees what left the building however it left.
    const manager = (await this.getSession()).approver;
    q.copiedTo = manager?.email ? [manager.email] : null;
    q.updatedAt = q.sentOutside.at;
    return structuredClone(q);
  },

  async markQuoteLost(quoteNo: string, reason: string): Promise<Quote> {
    await wait(240);
    const q = QUOTES.find((x) => x.quoteNo === quoteNo);
    if (!q) throw new Error(`No quote ${quoteNo}`);
    if (q.status === 'lost') return structuredClone(q);
    if (q.status === 'draft') {
      throw new Error('A draft has never been sent, so there is nothing to lose. '
        + 'Delete it instead.');
    }
    q.statusBeforeClose = q.status;
    q.status = 'lost';
    q.outcomeReason = reason.trim() || null;
    q.closedAt = new Date().toISOString();
    q.updatedAt = q.closedAt;
    return structuredClone(q);
  },

  async reopenQuote(quoteNo: string): Promise<Quote> {
    await wait(240);
    const q = QUOTES.find((x) => x.quoteNo === quoteNo);
    if (!q) throw new Error(`No quote ${quoteNo}`);
    if (q.status !== 'lost') return structuredClone(q);
    // Back to where it was, not to draft: a quote that had been approved is still
    // approved, and sending it again should not need a second decision.
    q.status = q.statusBeforeClose ?? 'sent';
    q.statusBeforeClose = null;
    q.closedAt = null;
    q.updatedAt = new Date().toISOString();
    return structuredClone(q);
  },

  async getItemPromise(itemNo, qty): Promise<ItemPromise> {
    await wait(200);
    const ladder = LADDERS[itemNo] ?? [];
    return {
      itemNo,
      description: ITEMS.find((i) => i.itemNo === itemNo)?.description ?? itemNo,
      purOrMfg: 'P',
      covering: ladder.find((r) => r.atpQty >= qty) ?? null,
      ladder,
      asOf: AS_OF,
      freshness: 'current',
    };
  },

  async searchCustomers(q): Promise<CustomerHit[]> {
    await wait(150);
    const needle = (q || '').toLowerCase();
    return CUSTOMERS
      .filter((c) => !needle || (c.customerNo + ' ' + c.customerName).toLowerCase().includes(needle))
      .map((c) => {
        const orders = ORDERS.filter((o) => o.customerNo === c.customerNo).map(buildOpenOrder);
        return {
          customerNo: c.customerNo,
          customerName: c.customerName,
          openOrders: orders.length,
          lateOrders: orders.filter((o) => o.lateLines > 0).length,
          /* The first contact is a default, not a decision. Harbor has two and the
             rep has to choose; Northern Dairy has none and the send step has to
             cope rather than assume. */
          email: c.contacts[0]?.email ?? null,
          contacts: c.contacts,
        };
      });
  },

  async listOpenOrders(customerNo): Promise<OpenOrder[]> {
    await wait(230);
    return ORDERS
      .filter((o) => o.customerNo === customerNo)
      .map(buildOpenOrder)
      // A line with nothing outstanding has shipped, and an order with no
      // outstanding line is not open. It was appearing because qty_open is
      // floored at zero upstream rather than filtered.
      .map((o) => ({ ...o, lines: o.lines.filter((l) => l.qtyOpen > 0) }))
      .filter((o) => o.lines.length > 0 && o.qtyOpen > 0)
      .sort((a, b) => (b.lateLines - a.lateLines) || (a.earliestDueDt ?? '').localeCompare(b.earliestDueDt ?? ''));
  },
};
