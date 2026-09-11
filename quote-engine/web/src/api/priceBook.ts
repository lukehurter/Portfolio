/**
 * The price book: the money, from a sheet, loaded on the rep's own machine.
 *
 * WHY THE MONEY AND ONLY THE MONEY
 *
 * `catalog.ts` already carries 1,833 parts whose numbers, descriptions, technology,
 * type and model are REAL — they came out of the product hierarchy. The one thing in
 * it that is invented is every price, because the price-page workbooks were scrubbed
 * before they were handed over. So the book replaces prices and nothing else. It is
 * about sixty kilobytes rather than a second copy of the catalogue, and a part keeps
 * its classification whether or not anybody has priced it.
 *
 * WHY IT IS NOT BUILT INTO THE APP
 *
 * Real list prices and standard costs are Axim's commercial terms. Compiled into
 * the app file they would travel wherever that file travels, including onto a download
 * page, and no guard here would catch it — the bundle audit looks for the price-page
 * workbooks leaking, not for a build carrying the same figures. Kept in a sheet, they
 * live behind whatever permission the sheet has and the app file stays free of them.
 *
 * That is also the access model. Who can open the sheet is who can quote with real
 * prices, and who can open a sheet carrying stdCost is who can see margin. There is no
 * role check in this app because there is no server to check one, and the sheet's own
 * permissions are a better answer than a role a client could set for itself.
 *
 * WHY A PASTE AND NOT A FETCH
 *
 * A page opened from disk cannot read a file next to it — measured in Edge from
 * file://, `fetch` of a sibling fails outright. It can hold what a person picked,
 * though: localStorage survives between sessions there, opaque origin and all, and a
 * 1,590-part book is 212 KB against a limit that took 2.7 MB without complaint. So the
 * rep picks the sheet once and the app remembers it.
 */
import type { Item } from './types';

/** Bumped when the shape changes, so an old book is refused rather than misread. */
export const BOOK_FORMAT = 1;

export interface PriceBook {
  /** The day the sheet was refreshed from Orbit, as the sheet states it. */
  asOf: string;
  prices: Map<string, { listPrice: number | null; stdCost: number | null }>;
  /** Stated maximum per discount category. Absent means no stated ceiling. */
  ceilings: Map<string, number>;
  caps: { ruleCode: string; itemNo: string; maxDiscount: number }[];
}

export interface BookLoad {
  book: PriceBook | null;
  /** Everything wrong with it, in the order a person would fix them. */
  problems: string[];
  /** What it contains, for the screen to state rather than imply. */
  counts: { prices: number; ceilings: number; caps: number };
}

const SECTIONS = ['[PRICES]', '[CATEGORIES]', '[CAPS]'] as const;

/**
 * Read a book out of what Excel puts on the clipboard, or a saved .txt/.tsv.
 *
 * Tab-separated because that is what copying a range out of Excel produces, so the
 * paste path needs no conversion step and no library. Refuses rather than guesses:
 * a book that half-loads is worse than one that does not load, because the quote it
 * prices looks exactly like a quote priced from a complete one.
 */
export function parseBook(text: string): BookLoad {
  const problems: string[] = [];
  const counts = { prices: 0, ceilings: 0, caps: 0 };
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));

  const head = lines.find((l) => l.trim() !== '') ?? '';
  const hp = head.split('\t');
  if (!/^AXIM PRICE BOOK$/i.test((hp[0] ?? '').trim())) {
    return { book: null, counts, problems: ['This is not a Axim price book. The '
      + 'first line should read "AXIM PRICE BOOK".'] };
  }
  const format = Number(hp[1]);
  if (format !== BOOK_FORMAT) {
    return { book: null, counts, problems: [`This book is format ${hp[1] || '?'} and `
      + `this app reads format ${BOOK_FORMAT}. Re-export it from the current workbook.`] };
  }
  const asOf = (hp[2] ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    problems.push('The header carries no as-at date (YYYY-MM-DD), so the app cannot '
      + 'say how old these prices are.');
  }

  const prices = new Map<string, { listPrice: number | null; stdCost: number | null }>();
  const ceilings = new Map<string, number>();
  const caps: PriceBook['caps'] = [];

  let section = '';
  let headerSeen = false;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || i === lines.indexOf(head)) return;
    const upper = line.toUpperCase();
    if ((SECTIONS as readonly string[]).includes(upper)) {
      section = upper;
      headerSeen = false;
      return;
    }
    if (!section) return;
    const f = raw.split('\t').map((c) => c.trim());
    // The first row of a section is its column names, whatever they are called.
    if (!headerSeen) { headerSeen = true; return; }
    const at = `line ${i + 1}`;

    if (section === '[PRICES]') {
      const [itemNo, list, cost] = f;
      if (!itemNo) return;
      const lp = num(list), sc = num(cost);
      if (list !== '' && lp === null) { problems.push(`${at}: "${list}" is not a list price for ${itemNo}.`); return; }
      if (cost !== undefined && cost !== '' && sc === null) { problems.push(`${at}: "${cost}" is not a standard cost for ${itemNo}.`); return; }
      prices.set(itemNo, { listPrice: lp, stdCost: sc });
      counts.prices++;
    } else if (section === '[CATEGORIES]') {
      const [code, max] = f;
      if (!code) return;
      // A blank maximum is a real answer: that category has no stated ceiling and
      // nothing on it is ever raised for approval. Only a non-number is a problem.
      if (max === '' || max === undefined) return;
      const m = num(max);
      if (m === null) { problems.push(`${at}: "${max}" is not a maximum discount for ${code}.`); return; }
      ceilings.set(code, m);
      counts.ceilings++;
    } else if (section === '[CAPS]') {
      const [ruleCode, itemNo, max] = f;
      if (!ruleCode && !itemNo) return;
      const m = num(max);
      if (m === null) { problems.push(`${at}: cap ${ruleCode || '(unnamed)'} on ${itemNo || '(no part)'} has no usable maximum.`); return; }
      if (!itemNo) { problems.push(`${at}: cap ${ruleCode} names no part, so it can never apply.`); return; }
      caps.push({ ruleCode: ruleCode || 'cap', itemNo, maxDiscount: m });
      counts.caps++;
    }
  });

  if (counts.prices === 0) {
    problems.push('No prices in the book. Check the [PRICES] section is present and '
      + 'has a header row above the parts.');
  }
  return { book: problems.length && counts.prices === 0
    ? null
    : { asOf, prices, ceilings, caps }, problems, counts };
}

/**
 * A number as a sheet writes it: 1234.56, 1,234.56, $1,234.56, 30%, (12.34) for
 * negative, or blank for "no answer". Blank is null, not zero — the difference
 * between a part with no cost and a part that costs nothing is the difference
 * between withholding margin and stating a wrong one.
 */
function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === '') return null;
  const pct = s.endsWith('%');
  const neg = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[()%$,\s]/g, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  let n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (pct) n /= 100;
  return neg ? -n : n;
}

/**
 * The catalogue, repriced.
 *
 * A part the book does not price keeps everything else it has and loses its price, so
 * it still classifies and still appears in the worklist — it simply cannot be quoted.
 * That is the honest state for a part nobody has priced, and it is the state the
 * engine already handles: a line with no list price prices to nothing rather than to
 * zero, and margin is withheld rather than guessed.
 */
export function applyBook(catalog: Item[], book: PriceBook | null): Item[] {
  if (!book) return catalog;
  return catalog.map((item) => {
    const p = book.prices.get(item.itemNo);
    if (!p) return { ...item, listPrice: null, stdCost: null };
    return { ...item, listPrice: p.listPrice, stdCost: p.stdCost };
  });
}

/** How much of the catalogue the book actually reaches, for the screen to report. */
export function coverage(catalog: Item[], book: PriceBook | null) {
  if (!book) return { priced: 0, unpriced: catalog.length, unknown: 0, withCost: 0 };
  const known = new Set(catalog.map((i) => i.itemNo));
  let priced = 0, withCost = 0;
  for (const i of catalog) {
    const p = book.prices.get(i.itemNo);
    if (p && p.listPrice !== null) priced++;
    if (p && p.stdCost !== null) withCost++;
  }
  let unknown = 0;
  for (const k of book.prices.keys()) if (!known.has(k)) unknown++;
  return { priced, unpriced: catalog.length - priced, unknown, withCost };
}

/* ------------------------------------------------------------------ storage */

const KEY = 'axim.priceBook.v1';

/**
 * Read at module load, written when a book is picked, and that is the whole of it.
 *
 * Every access is wrapped: a managed machine can have site data switched off, and a
 * page from file:// has an opaque origin, so storage is a convenience that may not be
 * there. Where it is not, the rep picks the sheet each session — one extra click, not
 * a broken app, which is why the picker stays visible even once a book is cached.
 */
export function storedBookText(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function storeBookText(text: string): boolean {
  try { localStorage.setItem(KEY, text); return true; } catch { return false; }
}

export function clearStoredBook(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** The book this session is using, or null for sample prices. */
export function loadStoredBook(): PriceBook | null {
  const text = storedBookText();
  if (!text) return null;
  return parseBook(text).book;
}
