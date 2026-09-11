import type { ApplicationProfile } from '../api/types';

/**
 * Reading an enquiry.
 *
 * A rep usually starts from an email. Retyping it into ten fields is the tedious
 * part of starting a quote, so this reads it and fills what it can.
 *
 * ── Why it scores instead of taking the first match ─────────────────────────
 * The first version walked an ordered list and took the first pattern that hit.
 * That is how "pet food bags" became a PET bottle: /\bpet\b/ appeared early and
 * won, and the word "bags" never got a say. Ordering can express "more specific
 * first", but it cannot weigh two signals against each other, and enquiry prose
 * is full of competing signals.
 *
 * So every candidate collects a score from all the words that support it, any
 * candidate with a disqualifying phrase is removed outright, and the winner is
 * the highest score. "pet food" now vetoes PET rather than merely losing.
 *
 * ── What it still is, and is not ────────────────────────────────────────────
 * Keyword matching. No model, no network. Plain language is a shortcut into a
 * structured profile, never a replacement for one: every field it fills stays
 * visible and editable, every field it cannot fill stays blank and asks, and
 * every filled field names the words that produced it. A rep must be able to
 * see that it read "cases" and concluded "corrugated case", and disagree.
 *
 * That matters more than accuracy. The fit rules downstream price real
 * equipment off these fields, so a parser a person can read and correct beats
 * one that is right more often but cannot be argued with.
 */

export type Porosity = ApplicationProfile['porosity'];

/** Which profile field a phrase filled, and the words that did it. */
export type Evidence = Partial<Record<keyof ApplicationProfile, string>>;

/** Something the enquiry asked for that is not a profile field. */
export interface Mention {
  query: string;
  label: string;
  words: string;
  role?: string;
}

export interface ParseResult {
  profile: Partial<ApplicationProfile>;
  evidence: Evidence;
  /** how many profile fields it managed to fill */
  filled: number;
  technologyCode: string | null;
  technologyWords: string | null;
  /**
   * Whether the enquiry NAMED the technology, or the technology was inferred.
   *
   * "We want a laser" and "CIJ" are named. "Code date and lot onto cases" is a job
   * description that happens to score for small-character coding, and it is much
   * weaker evidence than grading every machine in every book against the application
   * — which the tool also does, and which was being pre-empted by this guess.
   *
   * REPORTED: the sample enquiry chose CIJ with 0 good fits and 9 caveats while PIJ
   * had 6 good ones. The guess was not wrong so much as outranked.
   */
  technologyNamed: boolean;
  machineHint: string | null;
  machineWords: string | null;
  mentions: Mention[];
  /** fields the enquiry says are not a constraint — "any speed", "throw doesn't matter" */
  noConstraint: (keyof ApplicationProfile)[];
}

/* ------------------------------------------------------------------ helpers */

const first = (text: string, pattern: RegExp): string | null => text.match(pattern)?.[0] ?? null;

/** All matches, so a candidate can be supported by several separate phrases. */
function every(text: string, pattern: RegExp): string[] {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  return [...text.matchAll(re)].map((m) => m[0]);
}

interface Scored<T> { value: T; score: number; words: string[]; tier?: number }

/** Most specific reading first, and only then the weight of evidence. */
function best<T>(cands: Scored<T>[]): Scored<T> | null {
  let top: Scored<T> | null = null;
  for (const c of cands) {
    if (c.score <= 0) continue;
    if (!top) { top = c; continue; }
    const t = c.tier ?? 1;
    const bt = top.tier ?? 1;
    if (t > bt || (t === bt && c.score > top.score)) top = c;
  }
  return top;
}

/* --------------------------------------------------------------- substrates */

interface SubstrateSpec {
  name: string;
  porosity: Porosity;
  /** unambiguous naming of this material */
  strong?: RegExp;
  /** suggestive but shared with other materials */
  weak?: RegExp;
  /** if this appears, the candidate is wrong however many other hits it has */
  veto?: RegExp;
  /**
   * Specificity, not confidence. A higher tier with any support beats a lower
   * tier with more support.
   *
   * "dark corrugated cases" supports Corrugated case twice ("corrugated",
   * "cases") and Dark corrugated once, so on score alone the generic answer
   * wins — and the ink decision turns entirely on the word it threw away.
   * Counting hits cannot fix that; it is a question of which reading is more
   * specific, so specificity is ranked before weight of evidence.
   */
  tier?: number;
}

/**
 * Substrates a coding line actually runs.
 *
 * Grouped by what the ink has to key to, because that is what the fit rules
 * care about — porosity decides ink family before anything else does.
 */
const SUBSTRATES: SubstrateSpec[] = [
  // ---- porous: paper, board, sacks
  { name: 'Dark corrugated', tier: 2, porosity: 'porous',
    strong: /\b(?:dark|brown|kraft[- ]?brown|unbleached)\s+(?:corrugat\w*|case|cases|board|carton)/i },
  { name: 'Corrugated case', porosity: 'porous',
    strong: /\bcorrugat\w*|\bRSC\b|\bfibreboard\b|\bfiberboard\b/i,
    weak: /\bcases?\b|\bboxes\b|\bshipp\w+ (?:case|box|carton)/i },
  { name: 'Kraft paper', porosity: 'porous',
    strong: /\bkraft\b|\bmultiwall\b/i, weak: /\bpaper\b|\bsacks?\b|\bbales?\b/i },
  { name: 'Folding carton', tier: 2, porosity: 'porous',
    strong: /\bfolding carton\b|\bSBS board\b|\bpaperboard\b/i, weak: /\bcartons?\b/i },
  { name: 'Chipboard', porosity: 'porous', strong: /\bchipboard\b|\bgreyboard\b|\bgrayboard\b/i },
  { name: 'Moulded pulp', tier: 2, porosity: 'porous',
    strong: /\bmoulded pulp\b|\bmolded pulp\b|\begg (?:carton|tray)\b|\bfibre tray\b/i },
  { name: 'Paper label', porosity: 'porous', strong: /\bpaper label\b|\bgummed label\b/i },
  { name: 'Timber', porosity: 'porous',
    strong: /\btimber\b|\blumber\b|\bplywood\b|\bOSB\b|\bpallets?\b/i },
  { name: 'Gypsum board', porosity: 'porous',
    strong: /\bgypsum\b|\bplasterboard\b|\bdrywall\b/i },
  { name: 'Concrete block', porosity: 'porous',
    strong: /\bconcrete\b|\bbreeze ?block\b|\bcement\b|\bmasonry\b/i },
  { name: 'Textile', porosity: 'porous', strong: /\btextile\b|\bfabric\b|\bwebbing\b|\bcanvas\b/i },

  // ---- non-porous: rigid plastics
  { name: 'HDPE bottle', porosity: 'nonPorous',
    strong: /\bHDPE\b|\bhigh[- ]density polyethylene\b/i, weak: /\bjugs?\b|\bdrums?\b/i },
  { name: 'PET bottle', porosity: 'nonPorous',
    strong: /\bPET\b|\bpolyethylene terephthalate\b|\bpreforms?\b/i,
    weak: /\bbottles?\b/i,
    // "pet food", "pet treats", "pet care" are a market, not a material. This
    // is the false positive that made the old parser untrustworthy.
    veto: /\bpet\s+(?:food|foods|treat|treats|care|feed|snack|snacks|nutrition|owners?)\b|\bpet[- ]?food\b/i },
  { name: 'PP container', porosity: 'nonPorous',
    strong: /\bpolypropylene\b|\bPP\b(?!\s*E\b)/i, weak: /\btubs?\b|\bpots?\b|\bpails?\b/i },
  { name: 'PVC', porosity: 'nonPorous', strong: /\bPVC\b|\bvinyl\b|\bpolyvinyl\b/i },
  { name: 'Polystyrene', porosity: 'nonPorous', strong: /\bpolystyrene\b|\bEPS\b|\bPS\b(?!\s*I\b)/i },
  { name: 'Moulded plastic', porosity: 'nonPorous',
    strong: /\bmoulded plastic\b|\bmolded plastic\b|\binjection[- ]mould\w*|\binjection[- ]mold\w*/i,
    weak: /\bplastic\b|\bpolymer\b|\bresin part\b/i },
  { name: 'Blister pack', tier: 2, porosity: 'nonPorous',
    strong: /\bblister\b|\bthermoform\w*|\bclamshell\b/i },

  // ---- non-porous: films and flexibles
  { name: 'Shrink film', tier: 2, porosity: 'nonPorous',
    strong: /\bshrink\s*(?:film|wrap|sleeve|sleeving)\b|\bshrink[- ]wrapped\b/i },
  { name: 'Flow-wrap film', tier: 2, porosity: 'nonPorous',
    strong: /\bflow ?wrap\w*|\bhorizontal form fill\b|\bHFFS\b|\bVFFS\b|\bvertical form fill\b/i },
  { name: 'Laminate pouch', tier: 2, porosity: 'nonPorous',
    strong: /\blaminate\b|\bstand[- ]?up pouch\b|\bdoy ?pack\b|\bretort pouch\b/i,
    weak: /\bpouch\w*\b/i },
  { name: 'Foil laminate', tier: 2, porosity: 'nonPorous',
    strong: /\bfoil\b|\blidding\b|\balu(?:minium|minum) foil\b/i },
  { name: 'BOPP film', tier: 2, porosity: 'nonPorous', strong: /\bBOPP\b|\bOPP\b|\bbi[- ]?axially\b/i },
  { name: 'Polyethylene bag', porosity: 'nonPorous',
    strong: /\bLDPE\b|\bpoly ?bag\b|\bpolyethylene (?:bag|film|sack)\b/i,
    weak: /\bbags?\b|\bfilm\b|\bflexible\b|\bwrap\b|\bsachets?\b/i },
  { name: 'Woven PP sack', tier: 2, porosity: 'nonPorous',
    strong: /\bwoven (?:polypropylene|PP)\b|\bFIBC\b|\bbulk bag\b|\bbig bag\b/i },
  { name: 'Tyvek lid', tier: 2, porosity: 'nonPorous', strong: /\bTyvek\b|\bmedical (?:lid|pouch)\b/i },

  // ---- non-porous: glass, metal, other
  { name: 'Glass bottle', porosity: 'nonPorous',
    strong: /\bglass\b/i, weak: /\bjars?\b|\bvials?\b|\bampoules?\b/i },
  { name: 'Aluminium can', tier: 2, porosity: 'nonPorous',
    strong: /\b(?:alu(?:minium|minum)|beverage|drinks?)\s+cans?\b|\bcan ends?\b/i },
  { name: 'Steel can', tier: 2, porosity: 'nonPorous',
    strong: /\btinplate\b|\b(?:food|steel)\s+cans?\b/i, weak: /\btins?\b/i },
  { name: 'Extruded aluminium', porosity: 'nonPorous',
    strong: /\bextrud\w*|\bbillets?\b|\bprofiles?\b/i, weak: /\balu(?:minium|minum)\b/i },
  { name: 'Steel', porosity: 'nonPorous',
    strong: /\bsteel\b|\bgalvanis\w*|\bgalvaniz\w*|\bcoil\b/i, weak: /\bmetal\b/i },
  { name: 'Pipe or tube', porosity: 'nonPorous',
    strong: /\bpipes?\b|\btubing\b|\bconduit\b/i, weak: /\btubes?\b/i },
  { name: 'Cable', porosity: 'nonPorous', strong: /\bcable\b|\bwire\b|\bharness\b/i },
  { name: 'Rubber', porosity: 'nonPorous', strong: /\brubber\b|\belastomer\b|\btyres?\b|\btires?\b/i },
  { name: 'Ceramic tile', porosity: 'nonPorous', strong: /\bceramic\b|\btiles?\b|\bporcelain\b/i },
];

/** Everything the substrate picker offers, so the list and the parser agree. */
export const SUBSTRATE_NAMES: string[] = SUBSTRATES.map((s) => s.name);

export function porosityFor(substrate: string | null): Porosity {
  return SUBSTRATES.find((s) => s.name === substrate)?.porosity ?? null;
}

/* ------------------------------------------------- technology, model, parts */

const TECHNOLOGY_PATTERNS: { code: string; strong?: RegExp; weak?: RegExp }[] = [
  { code: 'PALM',
    strong: /\bprint\s*(?:and|&|'?n'?)\s*apply\b|\bapplicator\b|\bLB\s?5200\b|\bPL\s?6300\b|\blabell?er\b/i,
    weak: /\blabels?\b|\blabell?ing\b|\bpallet\b/i },
  { code: 'LSR',
    strong: /\blasers?\b|\bCO2\b|\bablat\w*|\bCSL\s?\d*\b|\bFSL\s?\d*\b|\bfibre laser\b|\bfiber laser\b/i,
    weak: /\betch(?:ing|ed)?\b|\bpermanent mark\w*/i },
  { code: 'TTO',
    strong: /\bthermal\s*transfer\b|\bTTO\b|\bover[- ]?print\w*|\bNGT\s?\d?\b/i,
    weak: /\bribbons?\b|\bflow ?wrap\w*|\bbagger\b|\bVFFS\b|\bHFFS\b/i },
  { code: 'PIJ',
    strong: /\bpiezo\b|\bPIJ\b|\blarge\s*character\b|\bScanMark\b|\bMark\s*[24]\b|\bhi[- ]?res\b/i,
    weak: /\bhigh\s*resolution\b|\bcase print\w*/i },
  { code: 'TIJ',
    strong: /\bthermal\s*inkjet\b|\bTIJ\b|\bcartridge\b/i },
  { code: 'VIJ',
    strong: /\bvalve\s*jet\b|\bVIJ\b|\bdot\s*matrix\b|\blarge character valve\b/i },
  { code: 'CIJ',
    strong: /\bcontinuous\s*inkjet\b|\bCIJ\b|\bsmall\s*character\b|\b(?:Corvus\s*)?64[0-9]0\b|\b54[0-9]0\b|\b34[0-9]0\b/i,
    // "code date and lot onto cases" describes a small-character job as plainly as
    // "date coding" does, and only the second used to reach here — so the commonest
    // way an enquiry opens chose no price book at all.
    weak: /\bcase coder\b|\bdate cod\w+|\bbatch cod\w+|\bCorvus\b|\bcod(?:e|es|ing)\s+(?:the\s+)?(?:date|lot|batch)\b/i },
];

const MACHINE_PATTERNS: { pattern: RegExp; hint: string }[] = [
  { pattern: /\b6440\b/i, hint: '6440' }, { pattern: /\b6420\b/i, hint: '6420' },
  { pattern: /\b6410\b/i, hint: '6410' }, { pattern: /\b6400\b/i, hint: '6400' },
  { pattern: /\b5400\b/i, hint: '5400' }, { pattern: /\b3400\b/i, hint: '3400' },
  { pattern: /\bCJ250\b/i, hint: 'CJ250' },
  { pattern: /\bLB\s?5200\b/i, hint: 'LB5200' }, { pattern: /\bPL\s?6300\b/i, hint: 'PL6300' },
  { pattern: /\bNGT\s?(\d\+?e?)\b/i, hint: 'T400' },
  { pattern: /\bCSL\s?(\d+)\b/i, hint: 'CSL' }, { pattern: /\bSL\s?(\d+)\b/i, hint: 'SL' },
];

const MENTION_PATTERNS: { pattern: RegExp; query: string; label: string; role?: string }[] = [
  { pattern: /\bstands?\b|\bfloor mount\w*|\bpedestal\b/i, query: 'stand', label: 'A stand', role: 'accessory' },
  { pattern: /\bconveyors?\b/i, query: 'conveyor', label: 'A conveyor', role: 'accessory' },
  { pattern: /\bbrackets?\b|\bmount(?:ing)?\b/i, query: 'bracket', label: 'A mounting bracket', role: 'accessory' },
  { pattern: /\bphoto ?(?:cell|eye)\b|\bproduct sensor\b|\btrigger\b/i, query: 'photocell', label: 'A photocell', role: 'accessory' },
  { pattern: /\bencoder\b/i, query: 'encoder', label: 'An encoder', role: 'accessory' },
  { pattern: /\bbeacon\b|\balarms?\b|\bstack ?light\b|\bandon\b/i, query: 'alarm', label: 'An alarm beacon', role: 'accessory' },
  { pattern: /\bguard ?rails?\b|\bside rails?\b|\bguide ?rails?\b/i, query: 'guide rail', label: 'Guide rails', role: 'accessory' },
  { pattern: /\bmake[- ]?up\b|\bsolvent\b/i, query: 'make-up', label: 'Make-up fluid', role: 'consumable' },
  { pattern: /\bcleaning (?:fluid|solution)\b|\bflush\b/i, query: 'cleaning', label: 'Cleaning fluid', role: 'consumable' },
  { pattern: /\bspares?\b|\bservice kit\b|\bmaintenance kit\b/i, query: 'kit', label: 'A service kit', role: 'spare' },
  { pattern: /\bwarrant(?:y|ies)\b|\bextended cover\b/i, query: 'warranty', label: 'Extended warranty' },
  { pattern: /\bribbons?\b/i, query: 'ribbon', label: 'Ribbon', role: 'consumable' },
  { pattern: /\bpads?\b/i, query: 'pad', label: 'An applicator pad', role: 'accessory' },
  { pattern: /\binstallation\b|\bcommission\w*|\btraining\b/i, query: 'install', label: 'Installation or training', role: 'service' },
];

/* ----------------------------------------------------------------- numerics */

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

/** "12", "12.5", "3/8" — fractions appear whenever someone is thinking in inches. */
function num(raw: string): number | null {
  const frac = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const mixed = raw.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const MM_PER_INCH = 25.4;

/**
 * A length in millimetres, whatever unit it was written in.
 *
 * Half of all enquiries are in inches, and a throw distance read as 12 mm when
 * the customer said 12 inches is not a small error — it is a different machine.
 */
function lengthMm(value: string, unit: string | undefined): number | null {
  const n = num(value);
  if (n == null) return null;
  if (!unit) return n;
  const u = unit.toLowerCase();
  if (u.startsWith('in') || u === '"' || u === "''" || u === 'inch' || u === 'inches') {
    return Math.round(n * MM_PER_INCH * 10) / 10;
  }
  if (u.startsWith('cm')) return n * 10;
  return n;
}

const UNIT = String.raw`(mm|millimet(?:re|er)s?|cm|centimet(?:re|er)s?|in|ins|inch|inches|")`;

/**
 * Which unit this enquiry states PACK-SIZED lengths in.
 *
 * For the compact "12 x 8 x 6", which usually carries no unit at all. Character
 * heights are skipped deliberately: they are quoted in millimetres by people who
 * quote everything else in inches, so the type size is the one figure in a message
 * that says nothing about how the rest of it is written.
 */
function sizeUnit(text: string): string | undefined {
  const re = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${UNIT}`, 'gi');
  for (const m of text.matchAll(re)) {
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 16);
    if (/^\s*(?:tall\s+|high\s+)?(?:characters?|chars?|type|font)/i.test(after)) continue;
    return (m[2] ?? '').toLowerCase();
  }
  // Feet and inches anywhere else settle it too: a line quoted in feet per minute
  // is not a line whose cases are twelve millimetres across.
  if (/\b(?:feet|foot|ft|fpm|inch(?:es)?)\b/i.test(text)) return 'in';
  return undefined;
}


/** A range takes the top of it — sizing for the slower end of a line is how a quote fails. */
function fromRange(text: string, pattern: RegExp): { value: number; words: string } | null {
  const m = text.match(pattern);
  if (!m) return null;
  const lo = num(m[1]);
  const hi = m[2] ? num(m[2]) : null;
  if (lo == null) return null;
  return { value: hi != null ? Math.max(lo, hi) : lo, words: m[0].trim() };
}

/* -------------------------------------------------- "does not matter" fields */

/**
 * Phrases that mean "stop filtering on this".
 *
 * A blank field and an unconstrained field are not the same thing, and the
 * difference matters to a rep: blank means go and ask the customer, whereas
 * unconstrained means the answer is in and it is "anything". Only the first
 * should appear in "still needed".
 */
/**
 * "Anything", however it was written.
 *
 * A rep writes "no preference on throw distance" as readily as "throw distance
 * doesn't matter", and only the second used to reach here — so the first left the
 * field blank and the application went on reporting it as still needed when the
 * customer had already settled it. Written out per field, the phrase list also drifted:
 * two of the six entries had learnt "no preference" and the other four had not.
 */
const ANY = String.raw`any|does\s*n[o']?t matter|no constraint|no preference|not (?:specified|stated)|flexible|not (?:fussed|critical|important)|whatever`;

/** The field's own words and the shrug, in whichever order they were written. */
function eitherOrder(noun: string, extra = ''): RegExp {
  const shrug = ANY + extra;
  return new RegExp(
    String.raw`\b(?:${noun})\b[^.]{0,30}?\b(?:${shrug})\b`
    + String.raw`|\b(?:${shrug})\b[^.]{0,30}?\b(?:${noun})\b`
    + String.raw`|\bany\s+(?:${noun})\b`, 'i');
}

const NO_CONSTRAINT: { field: keyof ApplicationProfile; pattern: RegExp }[] = [
  { field: 'throwDistMm', pattern: eitherOrder(String.raw`throw\s*(?:distance)?`) },
  { field: 'charHeightMm', pattern: eitherOrder(String.raw`(?:character|print|code)\s*(?:height|size)`) },
  { field: 'lineSpeedFpm', pattern: eitherOrder(String.raw`(?:line\s*)?speed`, '|variable') },
  { field: 'substrate', pattern: eitherOrder(String.raw`substrates?|materials?`, String.raw`|vari(?:es|ous)|mixed`) },
  { field: 'environment',
    pattern: /\b(?:standard|normal|ordinary|nothing special|dry and clean)\s+(?:plant|environment|conditions|factory)\b|\benvironment\b[^.]{0,24}?\bnothing special\b/i },
];

/** Sentences that negate what follows, so "no washdown" does not set washdown. */
const NEGATORS = /\b(?:no|not|never|without|isn'?t|aren'?t|non)\b/i;

function isNegated(text: string, phrase: string): boolean {
  const at = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (at < 0) return false;
  // Look back a few words only — "no washdown" negates, an earlier "not sure
  // about the speed" in the same paragraph does not.
  const before = text.slice(Math.max(0, at - 24), at);
  return NEGATORS.test(before);
}

/* ------------------------------------------------------ environment, content */

/**
 * The environment questions, in the App Analysis forms' own terms.
 *
 * Every value here appears in ENVIRONMENT_OPTIONS, so the picker and the parser
 * cannot disagree — the same failure that let the substrate list drift from the
 * patterns that fill it.
 */
const ENVIRONMENT_PATTERNS: { text: string; pattern: RegExp }[] = [
  // A customer describes washdown by what the crew does, not by the word on the
  // datasheet: "washes down nightly with a hose", "hosed out", "wet cleaning". This
  // is the field that decides whether TTO is possible at all — the T400 is IP20 — so
  // missing the phrasing quietly turned a not-recommended into a good fit.
  { text: 'washdown',
    pattern: /\bwash(?:es|ed|ing)? ?[- ]?down\b|\bwash(?:es|ed) (?:down|out|it down)\b|\bhose[sd]?\b(?=[^.]{0,30}\b(?:down|out|clean|wash|nightly|daily|shift)\b)|\b(?:with|using) a hose\b|\bhose ?down\b|\bsanitation\b|\bsanitis\w+\b|\bsanitiz\w+\b|\bcaustic\b|\bwet clean\w*\b|\bCIP\b|\bclean(?:ed|ing)? (?:with|by) water\b|\bIP6[5-9]K?\b/i },
  { text: 'condensation or humidity', pattern: /\bcondens\w*|\bhumid\w*/i },
  { text: 'refrigerated', pattern: /\bfreezer\b|\bchilled\b|\bcold store\b|\brefrigerat\w*|\bsub[- ]?zero\b/i },
  { text: 'open air building', pattern: /\bopen air\b|\bunheated\b|\bno walls\b/i },
  { text: 'food grade', pattern: /\bfood grade\b|\bfood contact\b|\bMEK[- ]?free\b|\bno MEK\b|\blow odou?r\b|\brestricted solvent\w*/i },
  { text: 'high particulate or dust', pattern: /\bdust\w*|\bdirty\b|\bflour\b|\bpowder\b|\bparticulate\b/i },
  { text: 'static', pattern: /\bstatic\b/i },
  { text: 'vibration', pattern: /\bvibrat\w*/i },
  { text: 'air turbulence near printhead', pattern: /\bair turbulence\b|\bfans?\s+(?:near|at|by)\b|\bturbulent air\b|\bfast moving air\b/i },
  { text: 'glue strands or angel hair', pattern: /\bglue strands?\b|\bangel hair\b/i },
  { text: 'high temperature', pattern: /\bhigh temp\w*|\boven\b|\bretort\b|\bfurnace\b|\bkiln\b/i },
  { text: 'clean room', pattern: /\bclean ?room\b|\bGMP\b/i },
  { text: 'outdoor', pattern: /\boutdoors?\b|\byard\b|\bexposed to weather\b/i },
];

/**
 * The ink, in two halves.
 *
 * Colour and family are separate decisions and a customer states whichever one
 * they care about: "black ink" is a colour with no family, "MEK-free" is a family
 * with no colour, and "white MEK" is both. Read as one pattern list they compete;
 * read as two axes they combine, which is what the sentence actually said.
 *
 * The colour words have to be tied to the ink to count. "dark corrugated cases,
 * white label" is two colours and neither of them is the ink, so a bare colour
 * word is ignored unless "ink", "code", "print" or "mark" is within a few words
 * of it.
 */
const INK_COLOURS = String.raw`black|white|red|blue|green|yellow|orange|silver`;
const INK_FAMILIES: { text: string; pattern: RegExp }[] = [
  { text: 'MEK-free', pattern: /\bMEK[- ]?free\b|\bno MEK\b|\bwithout MEK\b/i },
  { text: 'MEK', pattern: /\bMEK\b(?![- ]?free)|\bmethyl ethyl ketone\b/i },
  { text: 'ethanol-based', pattern: /\bethanol\b|\balcohol[- ]based\b/i },
  { text: 'acetone-based', pattern: /\bacetone\b/i },
  { text: 'water-based', pattern: /\bwater[- ]based\b|\baqueous\b/i },
  { text: 'solvent-based', pattern: /\bsolvent[- ]based\b|\bsolvent ink\b/i },
  { text: 'pigmented', pattern: /\bpigment\w*/i },
  { text: 'dye-based', pattern: /\bdye[- ]?based\b|\bdye ink\b/i },
  { text: 'UV-readable', pattern: /\bUV[- ](?:readable|visible|fluoresc\w+)\b|\binvisible ink\b|\bsecurity ink\b/i },
  { text: 'food-grade', pattern: /\bfood[- ]grade ink\b|\blow[- ]migration\b|\bindirect food contact\b/i },
  { text: 'fast-drying', pattern: /\bfast[- ]dry\w*|\bquick[- ]dry\w*/i },
  { text: 'condensation-resistant', pattern: /\bcondensation[- ]resistant\b|\bwet[- ]surface ink\b/i },
  { text: 'high-adhesion', pattern: /\bhigh[- ]adhesion\b|\baggressive ink\b/i },
];

const CONTENT_PATTERNS: { text: string; pattern: RegExp }[] = [
  { text: 'best-before or expiry date', pattern: /\bbest before\b|\bBBE\b|\bexpiry\b|\bexpiration\b|\buse by\b|\bsell by\b/i },
  // "code date and lot" is how the job is described far more often than "date
  // code" is, and requiring the two words adjacent meant the commonest phrasing
  // in the trade read as a lot code with no date in it.
  { text: 'date code',
    pattern: /\bdate\s*cod\w+|\bjulian\b|\bdate stamp\b|\bcod(?:e|es|ing)\s+(?:the\s+)?(?:date|day)\b|\bdate\s*(?:and|&|\/|\+)\s*(?:lot|batch|time|shift)\b|\b(?:lot|batch)\s*(?:and|&|\/|\+)\s*date\b|\bprint\w*\s+(?:the\s+)?date\b/i },
  { text: 'lot or batch code', pattern: /\blots?\b|\bbatch\w*/i },
  { text: '2D matrix', pattern: /\bdata ?matrix\b|\b2D\b|\bQR\b/i },
  { text: 'barcode', pattern: /\bbar ?code\b|\bUPC\b|\bEAN\b|\bGS1\b|\bGTIN\b/i },
  { text: 'logo or graphic', pattern: /\blogos?\b|\bgraphic\w*/i },
  { text: 'sequential counter', pattern: /\bcounter\b|\bsequential\b|\bserial\w*/i },
  { text: 'text or description', pattern: /\bproduct name\b|\bingredients?\b/i },
  // "price" needs the printing context. On its own it matched "Can you send me
  // a price please?" and reported that the customer wants a price printed on
  // the pack — which is how an empty enquiry came back with a field filled.
  { text: 'weight or price', pattern: /\b(?:net |gross )?weight\b|\btare\b|\bprice mark\w*|\bprint\w*\s+(?:the\s+)?price\b|\bunit price\b/i },
];

/* -------------------------------------------------------------------- parse */

export function parseApplication(text: string): ParseResult {
  const profile: Partial<ApplicationProfile> = {};
  const evidence: Evidence = {};
  const noConstraint: (keyof ApplicationProfile)[] = [];

  const empty: ParseResult = {
    profile, evidence, filled: 0, technologyCode: null, technologyWords: null,
    technologyNamed: false,
    machineHint: null, machineWords: null, mentions: [], noConstraint,
  };
  if (!text.trim()) return empty;

  /* ---- fields the enquiry says are not a constraint. Read first, so a later
          numeric match cannot quietly contradict "any speed". */
  for (const nc of NO_CONSTRAINT) {
    if (nc.pattern.test(text)) noConstraint.push(nc.field);
  }
  const unconstrained = (f: keyof ApplicationProfile) => noConstraint.includes(f);

  /* ---- substrate, by score rather than by order */
  if (!unconstrained('substrate')) {
    const cands: Scored<SubstrateSpec>[] = SUBSTRATES.map((s) => {
      if (s.veto && s.veto.test(text)) return { value: s, score: 0, words: [] };
      const strong = s.strong ? every(text, s.strong) : [];
      const weak = s.weak ? every(text, s.weak) : [];
      const live = [...strong, ...weak].filter((w) => !isNegated(text, w));
      const score = live.filter((w) => strong.includes(w)).length * 10
        + live.filter((w) => weak.includes(w)).length * 4;
      return { value: s, score, words: live, tier: s.tier ?? 1 };
    });
    const won = best(cands);
    if (won) {
      profile.substrate = won.value.name;
      profile.porosity = won.value.porosity;
      evidence.substrate = won.words.join(', ');
      evidence.porosity = won.words[0];
    }
  }

  /* ---- an explicit porosity statement beats one inferred from the material */
  const explicitPorosity =
    /\bnon[- ]?porous\b/i.test(text) ? 'nonPorous'
    : /\b(?:porous|absorbent|uncoated)\b/i.test(text) ? 'porous'
    : null;
  if (explicitPorosity) {
    profile.porosity = explicitPorosity as Porosity;
    evidence.porosity = first(text, /\bnon[- ]?porous\b|\b(?:porous|absorbent|uncoated)\b/i) ?? undefined;
  }

  /* ---- line speed, in feet per minute, and only in feet per minute.
   *
   * This used to read "120 cases per minute" as 120 fpm. Both are "per minute"
   * and it looked harmless, but a case count is not a distance: the datasheet
   * limits this grades against are all in FPM, so the engine was comparing a
   * throughput to a speed and quietly passing lines it should have questioned.
   * Anything counted goes to throughputPpm below; only feet land here.
   *
   * Ranges take the top; "up to" is a ceiling, so also the top.
   */
  const FEET = String.raw`(?:fpm|ft\s*\/\s*min\w*|feet\s*(?:per|\/)\s*min\w*)`;
  const METRES = String.raw`(?:m\s*\/\s*min\w*|mpm\b|met(?:re|er)s?\s*(?:per|\/)\s*min\w*)`;
  if (!unconstrained('lineSpeedFpm')) {
    const speed =
      fromRange(text, new RegExp(String.raw`(\d{2,4})\s*(?:-|to|–)\s*(\d{2,4})\s*${FEET}`, 'i'))
      ?? fromRange(text, new RegExp(String.raw`(\d{2,4})\s*${FEET}`, 'i'))
      ?? fromRange(text, new RegExp(String.raw`(?:up to|max\w*|about|around|approx\w*|running|runs?|doing)\D{0,14}(\d{2,4})\s*${FEET}`, 'i'))
      // "line speed 450" names the field outright, so the unit is implied — but
      // only when no metric unit follows, or "belt speed is 180 m/min" reads as
      // 180 fpm. 180 m/min is 591 fpm, and the 6400 stops at 574: the machine
      // that cannot run the line looked comfortably inside its limit.
      ?? fromRange(text, new RegExp(String.raw`\b(?:line|belt|conveyor)\s*speed\b\D{0,12}(\d{2,4})(?!\d)(?!\s*${METRES})`, 'i'));
    if (speed) {
      profile.lineSpeedFpm = speed.value;
      evidence.lineSpeedFpm = speed.words;
    }

    // Metres per minute, converted. Every datasheet limit is in feet, so storing
    // a metric figure as written would understate the line by 3.28 times.
    if (profile.lineSpeedFpm == null) {
      const metric =
        fromRange(text, new RegExp(String.raw`(\d{2,4})\s*(?:-|to|–)\s*(\d{2,4})\s*${METRES}`, 'i'))
        ?? fromRange(text, new RegExp(String.raw`(\d{2,4})\s*${METRES}`, 'i'));
      if (metric) {
        profile.lineSpeedFpm = Math.round(metric.value * 3.28084);
        evidence.lineSpeedFpm = `${metric.words} (${Math.round(metric.value * 3.28084)} fpm)`;
      }
    }
  }

  /* ---- shifts */
  /* ---- character height. Units matter twice over.
   *
   * 8mm and 8 inches are different machines, and a bare number in front of
   * "characters" is not a height at all — it is a count. This read "up to 24
   * characters per line" as 24mm type, which is nearly an inch tall, and then
   * graded every machine against it. So the unit is required: no unit, no height.
   */
  if (!unconstrained('charHeightMm')) {
    const cm =
      // A noun has to GOVERN the figure. The lead-in used to include a bare
      // "print", so "the print area is 60mm across" recorded 60mm type — and
      // 60mm trips two datasheet rules, so a sentence about a print window came
      // back with every CIJ printer NOT RECOMMENDED. "print" now only counts
      // when "height" or "size" follows it.
      //
      // Figure first: "10mm characters", "8mm date code", "25mm high logo". Up
      // to three words may sit between, for "an 8mm best-before date code", but
      // they are skipped rather than matched, so no noun is invented — and the
      // skip may not cross a conjunction or another dimension word, or "print
      // window is 60mm wide and characters 8mm tall" hands 60 to the characters.
      text.match(new RegExp(String.raw`(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}\s*(?:tall\s+|high\s+)?(?:(?!and\b|or\b|by\b|with\b|wide\b|long\b|across\b|deep\b)[\w-]+\s+){0,3}?(?:characters?|chars?|text|type|font|logo|date|code)\b`, 'i'))
      // Bare "high" and "tall" keep working on their own: "25mm high".
      ?? text.match(new RegExp(String.raw`(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}\s*(?:tall|high)\b`, 'i'))
      // Noun first: "characters around 8mm". Not "code" or "print" alone — a
      // code is a date code far more often than a height, and "the code sits
      // 12mm off the case" is the throw distance.
      ?? text.match(new RegExp(String.raw`\b(?:characters?|chars?|type|font)\b\s*(?:height|size)?\D{0,20}?(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}`, 'i'))
      // The height said outright, the only way "print" or "code" may lead.
      ?? text.match(new RegExp(String.raw`\b(?:character|char|print|code|text|type|message)\s*(?:height|size)\D{0,16}?(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}`, 'i'));
    if (cm) {
      const v = lengthMm(cm[1], cm[2]);
      if (v != null) { profile.charHeightMm = v; evidence.charHeightMm = cm[0].trim(); }
    }
  }

  /* ---- throw distance. Almost nobody writes "throw distance". */
  if (!unconstrained('throwDistMm')) {
    const tm =
      text.match(new RegExp(String.raw`throw\s*(?:distance)?\D{0,16}?(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}`, 'i'))
      ?? text.match(new RegExp(String.raw`(?:print ?head|head|nozzle)\D{0,24}?(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}`, 'i'))
      ?? text.match(new RegExp(String.raw`(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}\s*(?:throw|standoff|stand ?off|gap|away|off|back)`, 'i'))
      ?? text.match(new RegExp(String.raw`(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}\s*(?:off|away from|back from|from)\s*(?:the\s*)?(?:product|surface|case|carton|pack|bottle|substrate|web)`, 'i'));
    if (tm) {
      const v = lengthMm(tm[1], tm[2]);
      if (v != null) { profile.throwDistMm = v; evidence.throwDistMm = tm[0].trim(); }
    }
  }

  /* ---- the marking window: how much height there is to print in.
   *
   * Asked for by name on every application sheet ("Size of Marking Window (or
   * max code length)"), and the only thing the Ridgeline print-height rules can
   * read — without it a 2-inch head and a 4-inch head grade identically.
   */
  if (!unconstrained('markingWindowMm')) {
    const mw =
      text.match(new RegExp(String.raw`marking\s*window\D{0,16}?(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}`, 'i'))
      ?? text.match(new RegExp(String.raw`(?:print|code|label|marking)\s*(?:area|window|zone|panel)\D{0,16}?(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}`, 'i'))
      ?? text.match(new RegExp(String.raw`(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*${UNIT}\s*(?:marking\s*window|print\s*(?:area|window))`, 'i'));
    if (mw) {
      const v = lengthMm(mw[1], mw[2]);
      if (v != null) { profile.markingWindowMm = v; evidence.markingWindowMm = mw[0].trim(); }
    }
  }

  /* ---- throughput, in products per minute.
   *
   * A different question from line speed, and every application analysis form
   * asks both. A slow belt of densely packed product and a fast belt of spaced
   * product print the same number of packs a minute and need different machines,
   * so neither figure implies the other without the spacing.
   *
   * The bare "300 a minute" lands here rather than in line speed: in packaging
   * the thing counted per minute is product, and where the writer did mean feet
   * they almost always say fpm. The evidence text shows which field took it, so a
   * rep who meant the other can see and move it.
   */
  // Whatever the plant counts. The list was short enough that "240 bags a minute"
  // missed, and a missed throughput is a machine chosen on the wrong figure.
  const COUNTED = String.raw`(?:products?|packs?|packages?|cases?|units?|items?|bottles?|cartons?|cans?|labels?|pieces?|parts?|bags?|pouch(?:es)?|sachets?|jars?|tubs?|trays?|boxes|containers?|cups?|lids?|bundles?|rolls?|sleeves?|cartridges?|widgets?)`;
  if (!unconstrained('throughputPpm')) {
    const ppm =
      fromRange(text, new RegExp(String.raw`(\d{1,4})\s*(?:-|to|–)\s*(\d{1,4})\s*(?:${COUNTED}\s*)?(?:ppm|(?:a|per|\/)\s*min\w*)`, 'i'))
      ?? fromRange(text, new RegExp(String.raw`(\d{1,4})\s*(?:ppm\b|${COUNTED}\s*(?:a|per|\/)\s*min\w*)`, 'i'))
      ?? fromRange(text, new RegExp(String.raw`(?:up to|max\w*|about|around|approx\w*|running|runs?|doing)?\D{0,14}?(\d{1,4})\s*(?:a|per|\/)\s*min\w*`, 'i'));
    if (ppm) {
      profile.throughputPpm = ppm.value;
      evidence.throughputPpm = ppm.words;
    }
  }

  /* ---- how many lines of print, and how long each may be. Written as a word as
          often as a digit — "two lines of text" is the commoner phrasing. */
  const WORD_COUNT: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  };
  const countFrom = (token: string) => WORD_COUNT[token.toLowerCase()] ?? Number(token);
  const NUM = String.raw`(\d{1,2}|one|two|three|four|five|six)`;
  // Never a bare "two lines": in a plant that means two production lines far more
  // often than two lines of print, and guessing wrong changes the machine.
  const lop = text.match(new RegExp(String.raw`${NUM}\s*lines?\s*of\s*(?:print|text|code|copy)`, 'i'))
    ?? text.match(new RegExp(String.raw`(?:print|printing|printed|code|coding|mark\w*)\s*(?:on|over|across|in)?\s*${NUM}\s*lines?`, 'i'));
  if (lop) {
    const n = countFrom(lop[1]);
    if (n >= 1 && n <= 12) {
      profile.linesOfPrint = n;
      evidence.linesOfPrint = lop[0].trim();
    }
  }

  const cpl = text.match(/(\d{1,3})\s*char\w*\s*(?:per|\/|a)\s*line/i);
  if (cpl) {
  }

  /* ---- ambient temperature.
   *
   * This used to require the literal word "ambient", which nobody writes. "The room
   * gets to 105F in summer" missed, and so did every Celsius figure — and 104F is
   * the threshold in four separate rules, so the miss was the difference between a
   * caveat and silence.
   *
   * Celsius is converted rather than stored, because the profile field is named
   * ambientTempMaxF and a rule comparing 41 against 104 would always pass.
   */
  const DEG = String.raw`(?:°\s*|deg(?:rees?)?\s*)?`;
  const HOT = String.raw`(?:ambient|room|floor|plant|air|shop ?floor|summer|it)`;
  const RISE = String.raw`(?:gets? (?:up )?to|reach(?:es)?|runs? (?:at|to)|peaks? at|up to|max\w*(?: of)?|as (?:high|hot) as|is|of|hits?)`;
  const toF = (n: number, unit: string) => (/c/i.test(unit) ? Math.round(n * 9 / 5 + 32) : n);

  const amb = text.match(new RegExp(String.raw`${HOT}\D{0,14}?(\d{1,3})\s*(?:-|to|–|\/)\s*(\d{1,3})\s*${DEG}(F|C)\b`, 'i'))
    ?? text.match(new RegExp(String.raw`(\d{1,3})\s*(?:-|to|–|\/)\s*(\d{1,3})\s*${DEG}(F|C)\b`, 'i'));
  if (amb) {
    profile.ambientTempMinF = toF(Number(amb[1]), amb[3]);
    profile.ambientTempMaxF = toF(Number(amb[2]), amb[3]);
    evidence.ambientTempMinF = amb[0].trim();
    evidence.ambientTempMaxF = amb[0].trim();
  } else {
    // The cold phrase is read FIRST, because "the room goes down to 35F" satisfies the
    // maximum pattern too — HOT matches "room", the gap swallows "goes down to", and the
    // figure lands in ambientTempMaxF. A chilled room then reported a MAXIMUM of 35F,
    // which is not what anybody said. Found by a rule firing on a case built to test it.
    const COLD_LEAD = String.raw`(?:as (?:low|cold) as|down to|minimum(?: of)?|as low)`;
    const cold =
      text.match(new RegExp(String.raw`${COLD_LEAD}\s*(-?\d{1,3})\s*${DEG}(F|C)\b`, 'i'))
      ?? text.match(new RegExp(String.raw`(?:freezer|chiller|cold ?store|refrigerat\w+)\D{0,16}?(-?\d{1,3})\s*${DEG}(F|C)\b`, 'i'));
    if (cold) {
      profile.ambientTempMinF = toF(Number(cold[1]), cold[2]);
      evidence.ambientTempMinF = cold[0].trim();
    }
    const one =
      text.match(new RegExp(String.raw`${HOT}(?!\D{0,16}?${COLD_LEAD})\D{0,16}?(\d{1,3})\s*${DEG}(F|C)\b`, 'i'))
      ?? text.match(new RegExp(String.raw`(?:${RISE})\s*(\d{1,3})\s*${DEG}(F|C)\b`, 'i'))
      ?? text.match(new RegExp(String.raw`(\d{1,3})\s*${DEG}(F|C)\b(?=[^.]{0,24}\b(?:in summer|on the floor|ambient|in the room)\b)`, 'i'));
    if (one) {
      profile.ambientTempMaxF = toF(Number(one[1]), one[2]);
      evidence.ambientTempMaxF = one[0].trim();
    }
  }

  /* ---- the barcode requirement, which is a sentence rather than a number.
   *
   * Never read at all before this, so the two rules that turn on it — print and
   * apply carrying the grade guarantee, valve jet being medium resolution — could
   * not fire from an enquiry however plainly the customer stated the grade.
   *
   * What is kept is the customer's own words, because "grade C or better per their
   * spec" is the thing a rep has to honour and paraphrasing it loses the "or
   * better".
   */
  const BARCODE = [
    /\b(?:grade\s*[a-d]|[a-d]\s*grade)\b(?:\s*or\s*(?:better|above|higher))?/i,
    /\bverif(?:ied|iable|ication)\b[^.]{0,30}/i,
    /\bGS1[- ]?(?:128|DataBar|DataMatrix)?\b/i,
    /\b(?:SSCC|SCC[- ]?14|ITF[- ]?14|UPC[- ]?A|EAN[- ]?(?:8|13)|Code\s*128)\b/i,
    /\b(?:2D|data ?matrix|QR)\s*(?:code|matrix)?\b(?=[^.]{0,40}\b(?:grade|scan\w*|verif\w*|standard|spec)\b)/i,
    /\bscannab\w+\b[^.]{0,24}/i,
  ];
  const barcode: string[] = [];
  for (const pattern of BARCODE) {
    const hit = first(text, pattern);
    if (hit && !isNegated(text, hit)) barcode.push(hit.trim());
  }
  if (barcode.length) {
    profile.barcodeRequirements = barcode.join(', ');
    evidence.barcodeRequirements = barcode[0];
  }

  /* ---- how big the LABEL is, which is a different pair of numbers.
          A print-and-apply enquiry names the label first — "4 x 6 labels", "a 100mm
          wide label" — and eighteen rules turn on it. Read on its own and never
          inferred from the pack: "4x6 labels onto a 12x8x6 case" is two pairs of
          numbers in one sentence, and taking one for the other would grade the
          applicator against the case.

          The word has to be there. A bare "4 x 6" is a pack far more often than a
          label, and guessing wrong here is worse than leaving the field empty for a
          rep to fill. */
  const LABEL_WORD = String.raw`labels?|labell?ing`;
  // "4 x 6 label", "4in x 6in labels", "4 by 6 inch label"
  const labelPair = text.match(new RegExp(
    String.raw`(\d+(?:\.\d+)?)\s*${UNIT}?\s*(?:x|by|\u00d7)\s*(\d+(?:\.\d+)?)\s*${UNIT}?`
    + String.raw`[^.]{0,20}?\b(?:${LABEL_WORD})\b`, 'i'));
  if (labelPair) {
    // Width first, the way a label is always quoted and ordered.
    const unit = labelPair[2] ?? labelPair[4] ?? sizeUnit(text);
    const w = lengthMm(labelPair[1], unit);
    const l = lengthMm(labelPair[3], unit);
    if (w != null) { profile.labelWidthMm = w; evidence.labelWidthMm = labelPair[0].trim(); }
    if (l != null) { profile.labelLengthMm = l; evidence.labelLengthMm = labelPair[0].trim(); }
  } else {
    // One dimension, named: "a 100mm wide label", "labels 6 inches wide".
    const named: [keyof ApplicationProfile, string][] = [
      ['labelWidthMm', String.raw`wide|width|across`],
      ['labelLengthMm', String.raw`long|length|tall|high|deep`],
    ];
    for (const [field, words] of named) {
      const m = text.match(new RegExp(
        String.raw`(\d+(?:\.\d+)?)\s*${UNIT}?\s*(?:${words})\b[^.]{0,20}?\b(?:${LABEL_WORD})\b`
        + String.raw`|\b(?:${LABEL_WORD})\b[^.]{0,20}?(\d+(?:\.\d+)?)\s*${UNIT}?\s*(?:${words})\b`,
        'i'));
      if (!m) continue;
      const value = m[1] ?? m[3];
      const unit = m[2] ?? m[4] ?? sizeUnit(text);
      const mm = lengthMm(value, unit);
      if (mm != null) {
        (profile as Record<string, unknown>)[field] = mm;
        evidence[field] = m[0].trim();
      }
    }
  }

  /* ---- how big the product is. Asked for on every application form as three
          figures, and written as one sentence: "400mm wide by 600 long, 300 tall". */
  const dims: [keyof ApplicationProfile, RegExp][] = [
    ['productWidthMm', new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${UNIT}\s*(?:wide|width|across)\b`, 'i')],
    ['productLengthMm', new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${UNIT}\s*(?:long|length|deep|depth)\b`, 'i')],
  ];
  // "400mm wide by 600 long and 300 tall" states the unit once. Whatever unit the
  // first figure carried governs the rest of the sentence.
  const dimUnit = text.match(new RegExp(String.raw`\d+(?:\.\d+)?\s*${UNIT}\s*(?:wide|long|tall|high|width|length|height|deep)`, 'i'))?.[1];
  const BARE_DIM: [keyof ApplicationProfile, RegExp][] = [
    ['productWidthMm', /(\d+(?:\.\d+)?)\s*(?:wide|width|across)\b/i],
    ['productLengthMm', /(\d+(?:\.\d+)?)\s*(?:long|length|deep|depth)\b/i],
  ];
  const isProductSized = /\b(?:product|case|carton|box|pack|bottle|jar|tray|bag|pouch|can|tub|it)s?\b[^.]{0,40}?\d/i.test(text)
    || /\d+(?:\.\d+)?\s*\w*\s*(?:wide|long|tall)\b[^.]{0,40}\b(?:wide|long|tall|deep)\b/i.test(text);
  if (isProductSized) {
    for (const [field, pattern] of dims) {
      const hit = text.match(pattern);
      if (hit) {
        const v = lengthMm(hit[1], hit[2]);
        if (v != null) {
          (profile as Record<string, unknown>)[field] = v;
          evidence[field] = hit[0].trim();
        }
      }
    }
    if (dimUnit) {
      for (const [field, pattern] of BARE_DIM) {
        if ((profile as Record<string, unknown>)[field] != null) continue;
        const hit = text.match(pattern);
        if (hit) {
          const v = lengthMm(hit[1], dimUnit);
          if (v != null) {
            (profile as Record<string, unknown>)[field] = v;
            evidence[field] = `${hit[0].trim()} (${dimUnit} from the first figure)`;
          }
        }
      }
    }
  }

  /* ---- the same three figures, written the way a box is actually written.
   *
   * The named form above wants the words wide, long and tall. Nobody types those
   * about a case — they type "12x8x6", because that is how a corrugated case is
   * stated everywhere else in their business, in the trade's order: length, then
   * width, then depth.
   *
   * That order is a convention, not something this sentence said, so it goes in
   * the evidence rather than being applied silently. A rep who meant width first
   * can see which figure went where and swap them, which is the whole bargain
   * this parser makes.
   *
   * Gated on a product noun for the same reason every other numeric here is: the
   * pattern is three numbers with crosses between them, and unguarded it would
   * read a part number, a pallet configuration or a date.
   */
  const PRODUCT_NOUN = String.raw`(?:products?|cases?|cartons?|boxes|box|packs?|packages?|bottles?|jars?|trays?|bags?|pouch(?:es)?|cans?|tubs?|containers?|bundles?|units?)`;
  const THREE = String.raw`(?<!\d)(\d+(?:\.\d+)?)\s*${UNIT}?\s*[x×*]\s*`
    + String.raw`(\d+(?:\.\d+)?)\s*${UNIT}?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*${UNIT}?`;
  /* Adjacent to the noun, or anywhere in an enquiry that names one.
     "corrugated cases. About 300 a minute, ... 12 x 8 x 6" states the product in
     one sentence and its size in the next, which is how people write; requiring the
     two within twenty characters of each other missed it entirely. The shape —
     three figures with crosses between them — is specific enough on its own once
     the enquiry has said what the product is. */
  const compact = text.match(new RegExp(String.raw`\b${PRODUCT_NOUN}\b[^.]{0,20}?` + THREE, 'i'))
    ?? (new RegExp(String.raw`\b${PRODUCT_NOUN}\b`, 'i').test(text)
        ? text.match(new RegExp(THREE, 'i'))
        : null);
  if (compact) {
    /* Stated once at the end far more often than on every figure — and often not
       at all, which is the case this used to read as millimetres. A 12 x 8 x 6 mm
       case is a sugar cube.

       The fallback is the unit the enquiry used for its other PACK-SCALED figure,
       not just any figure in it: a plant that measures its cases in inches will
       still specify 5 mm type, so the character height is the one length in the
       message that says nothing about how the rest of it is written. With nothing
       to go on the dimensions stay blank, because being wrong here is wrong by a
       factor of 25. */
    const stated = compact[6] ?? compact[4] ?? compact[2];
    const unit = stated ?? sizeUnit(text);
    const said = `${compact[0].trim()} (read as length × width × height`
      + (stated ? '' : `, in ${unit === 'in' ? 'inches' : unit ?? 'mm'} from the rest of the enquiry`)
      + ')';
    const three: [keyof ApplicationProfile, string][] = [
      ['productLengthMm', compact[1]], ['productWidthMm', compact[3]],
    ];
    for (const [field, raw] of three) {
      if ((profile as Record<string, unknown>)[field] != null) continue;
      const v = lengthMm(raw, unit);
      if (v != null) {
        (profile as Record<string, unknown>)[field] = v;
        evidence[field] = said;
      }
    }
  }

  /* ---- the gap between packs.
   *
   * Asked for on every application sheet and never read until now, which left the
   * one figure that reconciles the other two missing: a line running 40 fpm at 300
   * packs a minute is only consistent at a particular spacing, and without it
   * nothing can tell a plausible pair of numbers from a typo.
   *
   * "gap" is deliberately not a keyword on its own — the throw distance already
   * owns "10mm gap", meaning head to product. Only a gap stated BETWEEN packs
   * lands here; everything else has to say apart, spacing, pitch or centres.
   */
  if (!unconstrained('productSpacingMm')) {
    const NUMBER = String.raw`(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)`;
    const sp =
      text.match(new RegExp(String.raw`${NUMBER}\s*${UNIT}\s*(?:apart|between\s+(?:the\s+)?${PRODUCT_NOUN})`, 'i'))
      ?? text.match(new RegExp(String.raw`\b(?:spac(?:ed|ing)|pitch(?:ed)?|centres?|centers?)\D{0,16}?${NUMBER}\s*${UNIT}`, 'i'))
      ?? text.match(new RegExp(String.raw`${NUMBER}\s*${UNIT}\s*(?:spacing|pitch|centres?|centers?)`, 'i'))
      ?? text.match(new RegExp(String.raw`\bgap\s+between\s+(?:the\s+)?${PRODUCT_NOUN}\D{0,16}?${NUMBER}\s*${UNIT}`, 'i'));
    if (sp) {
      const v = lengthMm(sp[1], sp[2]);
      if (v != null) { profile.productSpacingMm = v; evidence.productSpacingMm = sp[0].trim(); }
    }
  }

  /* ---- how warm the pack is when it is marked.
   *
   * Distinct from the ambient temperature above, and confusable with it: "the room
   * gets to 105" and "the cases come off the oven at 180" are different constraints
   * on different rules. They are told apart by what governs the figure, so the
   * product nouns are required here and the ambient patterns keep their own.
   *
   * "Room temperature" is the commonest answer of all and carries no figure, so it
   * is resolved to 70°F — and the evidence says that it was resolved rather than
   * read, because a rep marking a chilled line has to be able to see the assumption
   * and overwrite it.
   */
  const HELD_AT = String.raw`(?:is|are|sits?|stays?|runs?|comes?|arrives?|leaves?)\b[^.]{0,12}?`;
  /* "room temperature" on its own, in a comma-separated list of facts, is how it
     is usually written — the "product is at" in front of it was my own example
     rather than anything a customer types. The only reading excluded is one with a
     figure after it, which is the room's temperature and belongs to ambient. */
  const roomTemp = text.match(
    /\b(?:at\s+)?(?:room|ambient)\s+temperature\b(?!\s*(?:is|of|reaches|gets|hits|runs|around|about|at)?\s*-?\d{1,3}\s*(?:°|deg)?\s*[FC]\b)/i);
  const productTemp =
    text.match(new RegExp(String.raw`\b(?:product|packs?|cases?|cartons?|box(?:es)?|bottles?|jars?|trays?|cans?)\b[^.]{0,20}?${HELD_AT}(-?\d{1,3})\s*${DEG}(F|C)\b`, 'i'))
    ?? text.match(new RegExp(String.raw`\b(?:straight |hot )?(?:off|out of|from)\s+the\s+(?:oven|retort|fryer|kiln|filler)\D{0,16}?(-?\d{1,3})\s*${DEG}(F|C)\b`, 'i'))
    ?? text.match(new RegExp(String.raw`\bhot[- ]fill\w*\D{0,16}?(-?\d{1,3})\s*${DEG}(F|C)\b`, 'i'));
  if (productTemp) {
    profile.productTempF = toF(Number(productTemp[1]), productTemp[2]);
    evidence.productTempF = productTemp[0].trim();
  } else if (roomTemp) {
    profile.productTempF = 70;
    evidence.productTempF = `${roomTemp[0].trim()} (taken as 70°F)`;
  }

  /* ---- the ink, colour and family. See INK_FAMILIES for why it is read as two
          axes rather than one list. */
  const inkColour = text.match(new RegExp(
    String.raw`\b(${INK_COLOURS})\b(?=[^.]{0,14}\b(?:ink|cod\w+|print\w*|mark\w*)\b)`
    + String.raw`|\b(?:ink|cod\w+|print\w*|mark\w*)\b[^.]{0,14}?\b(${INK_COLOURS})\b`, 'i'));
  const inkFamilies: string[] = [];
  const inkWords: string[] = [];
  for (const f of INK_FAMILIES) {
    const hit = first(text, f.pattern);
    if (hit && !inkFamilies.includes(f.text)) { inkFamilies.push(f.text); inkWords.push(hit); }
  }
  const inkParts = [
    ...(inkColour ? [(inkColour[1] ?? inkColour[2]).toLowerCase()] : []),
    ...inkFamilies,
  ];
  if (inkParts.length) {
    profile.inkType = inkParts.join(', ');
    evidence.inkType = [inkColour?.[0].trim(), ...inkWords].filter(Boolean).join(', ');
  }

  /* ---- whether a sample has been run. The answer a rep most wants on a hard
          substrate, and "we can send samples" means it has NOT been run yet. */
  const sampled = first(text, /\bsamples?\s*(?:were|have been|was|has been|are)\s*(?:run|tested|printed|trialled|trialed)\b|\bwe (?:have|'ve) (?:run|tested|trialled|trialed)\b|\btrial\s*(?:was|has been)\s*(?:run|done)\b/i);
  const canSample = first(text, /\b(?:can|could|will|happy to|able to)\s*(?:send|supply|provide|ship|post)\s*(?:you\s*)?(?:some\s*)?samples?\b|\bsamples? (?:are )?available\b|\bnot (?:yet )?(?:been )?tested\b|\bno samples? (?:run|tested)\b/i);
  if (sampled) {
    profile.sampleTested = 'yes';
    evidence.sampleTested = sampled.trim();
  } else if (canSample) {
    profile.sampleTested = 'no';
    evidence.sampleTested = canSample.trim();
  }

  /* ---- conveyor, guide rails, motion: stated plainly or not at all */
  /* Almost nobody writes "existing conveyor". They write that the line is already
     there — "integrate into our current line", "we have conveyors already" — and
     that is the same answer stated the way people state it. A conveyor named with
     no word either way is an existing one too: a conveyor that is part of the
     project gets said so, because it is a thing being bought. */
  const conv = text.match(/\b(new|existing)\s+conveyors?\b/i)
    ?? text.match(/\bconveyors?\b[^.]{0,20}?\b(new|existing)\b/i);
  const already = first(text,
    /\b(?:existing|current|our)\s+(?:production\s+)?(?:line|conveyors?|equipment)\b|\bconveyors?\b[^.]{0,24}?\balready\b|\balready\s+(?:has|have|got)\b[^.]{0,24}?\bconveyors?\b|\bintegrate\s+(?:in)?to\s+(?:our|the|an?)\s+(?:current|existing)\b/i);
  if (conv) {
    profile.conveyor = conv[1].toLowerCase() as ApplicationProfile['conveyor'];
    evidence.conveyor = conv[0].trim();
  } else if (already) {
    profile.conveyor = 'existing';
    evidence.conveyor = already.trim();
  }

  /* Bare "rails" counts. On a packaging line there is nothing else rails could be,
     and "our current line which has rails and conveyors" is the commonest way the
     answer arrives — it went unread because the pattern wanted the word "guide". */
  const rails = first(text, /\bguide ?rails?\b|\bside rails?\b|\brails?\b/i);
  if (rails) {
    profile.guideRails = isNegated(text, rails) ? 'no' : 'yes';
    evidence.guideRails = rails;
  }

  // Said outright, or said by describing what happens: "the product stops for the
  // print", "it dwells in front of the head". "Indexing" and "stop-start" stay on the
  // moving side, where they already were — the line moves in steps, and which side of
  // the question that belongs on is a judgement somebody made before me.
  const STILL = /\bstationary\b|\bstops? (?:for|to|at) (?:the )?(?:print|code|mark|label)\w*\b|\bstops? in front of\b|\bdwells?\b|\bat rest\b/i;
  const motion = first(text, STILL) ?? first(text, /\bindexing\b|\bindexed\b|\bstop[- ]?start\b/i);
  if (motion) {
    profile.productMotion = STILL.test(motion) ? 'stationary' : 'moving';
    evidence.productMotion = motion;
  } else {
    const MOVING = /\bon the move\b|\bon the fly\b|\bcontinuous(?:ly)? moving\b|\bwhile moving\b|\bwithout stopping\b|\bnever stops\b|\bin motion\b/i;
    if (MOVING.test(text)) {
      profile.productMotion = 'moving';
      evidence.productMotion = first(text, MOVING) ?? '';
    }
  }

  /* ---- what is printed, and the environment. Several can be true at once. */
  const content: string[] = [];
  const contentWords: string[] = [];
  for (const c of CONTENT_PATTERNS) {
    const hit = first(text, c.pattern);
    if (hit && !isNegated(text, hit) && !content.includes(c.text)) {
      content.push(c.text); contentWords.push(hit);
    }
  }
  if (content.length) {
    profile.messageContent = content.join(', ');
    evidence.messageContent = contentWords.join(', ');
  }

  if (!unconstrained('environment')) {
    const env: string[] = [];
    const envWords: string[] = [];
    for (const e of ENVIRONMENT_PATTERNS) {
      const hit = first(text, e.pattern);
      if (hit && !isNegated(text, hit) && !env.includes(e.text)) {
        env.push(e.text); envWords.push(hit);
      }
    }
    if (env.length) {
      profile.environment = env.join(', ');
      evidence.environment = envWords.join(', ');
    }
  }

  /* ---- which price book, by score. The generic description of the job must
          not beat an explicit naming of the technology. */
  const named = new Set<string>();
  const techCands: Scored<string>[] = TECHNOLOGY_PATTERNS.map((t) => {
    const strong = t.strong ? every(text, t.strong) : [];
    const weak = t.weak ? every(text, t.weak) : [];
    const live = [...strong, ...weak].filter((w) => !isNegated(text, w));
    // A strong pattern is the technology said out loud: "laser", "print and apply",
    // "6440". A weak one is a job that tends to be done that way.
    if (live.some((w) => strong.includes(w))) named.add(t.code);
    return {
      value: t.code, words: live,
      score: live.filter((w) => strong.includes(w)).length * 10
        + live.filter((w) => weak.includes(w)).length * 3,
    };
  });
  const tech = best(techCands);

  /* ---- a model named in the enquiry */
  let machineHint: string | null = null;
  let machineWords: string | null = null;
  for (const m of MACHINE_PATTERNS) {
    const hit = first(text, m.pattern);
    if (!hit) continue;
    machineHint = m.hint; machineWords = hit; break;
  }

  /* ---- parts asked for by name */
  const mentions: Mention[] = [];
  for (const m of MENTION_PATTERNS) {
    const hit = first(text, m.pattern);
    if (!hit || isNegated(text, hit)) continue;
    if (mentions.some((x) => x.query === m.query)) continue;
    mentions.push({ query: m.query, label: m.label, words: hit, role: m.role });
  }

  return {
    profile, evidence, filled: Object.keys(profile).length,
    technologyCode: tech?.value ?? null,
    technologyWords: tech ? tech.words.join(', ') : null,
    technologyNamed: !!tech && named.has(tech.value),
    machineHint, machineWords, mentions, noConstraint,
  };
}

/* ------------------------------------------------------------------ helpers */

export const FIELD_LABEL: Record<keyof ApplicationProfile, string> = {
  substrate: 'substrate',
  porosity: 'surface',
  productWidthMm: 'product width',
  labelWidthMm: 'label width',
  labelLengthMm: 'label length',
  productLengthMm: 'product length',
  productTempF: 'product temperature',
  lineSpeedFpm: 'line speed',
  throughputPpm: 'throughput',
  productSpacingMm: 'product spacing',
  conveyor: 'conveyor',
  guideRails: 'guide rails',
  productMotion: 'product moving or stationary',
  charHeightMm: 'character height',
  throwDistMm: 'throw distance',
  linesOfPrint: 'lines of print',
  markingWindowMm: 'room to print in',
  messageContent: 'what is printed',
  barcodeRequirements: 'barcode requirements',
  printQuality: 'print quality needed',
  inkType: 'ink',
  dryTimeSeconds: 'dry time',
  environment: 'environment',
  ambientTempMinF: 'minimum ambient',
  ambientTempMaxF: 'maximum ambient',
  adhesionRequirements: 'adhesion requirements',
  sampleTested: 'sample tested',
  notes: 'notes',
};

/** What the fit rules cannot grade without. Not a gate — it drives "still needed". */
const KEY_FIELDS: (keyof ApplicationProfile)[] = [
  'substrate', 'porosity', 'lineSpeedFpm', 'charHeightMm',
];

/**
 * Blank fields worth chasing.
 *
 * A field the customer has no constraint on is answered, not missing, so it is
 * excluded — otherwise the rep is told to go and ask a question they already
 * asked.
 */
export function missingKeyFields(
  profile: ApplicationProfile,
  noConstraint: (keyof ApplicationProfile)[] = [],
): string[] {
  return KEY_FIELDS
    .filter((f) => !noConstraint.includes(f))
    .filter((f) => profile[f] == null || profile[f] === '')
    .map((f) => FIELD_LABEL[f]);
}
