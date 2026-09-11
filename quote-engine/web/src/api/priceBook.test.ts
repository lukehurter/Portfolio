/**
 * The sheet and the app have to agree, and this is where that is proved.
 *
 * The workbook prices a quote with formulas; this app prices it with the TypeScript
 * engine. Both are supposed to return what `engine-cases.json` says, and the workbook
 * already proves its half — 48 of 48, recalculated in Excel. This proves the other
 * half over the SAME route the reps will use: the money goes out of a sheet, through
 * the book format, into the catalogue, and the 48 cases still come out right.
 *
 * Doing it end to end matters. A test that fed the engine fixture objects directly
 * would prove the engine, which is already proven; it would not notice a parser that
 * drops a thousands separator or reads a blank cost as zero, and both of those change
 * money on a quote without changing anything a person would see.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import cases from '../../../engine-cases.json';
import { evaluate } from '../engine/evaluate';
import { BOOK_FORMAT, applyBook, coverage, parseBook } from './priceBook';
import { EMPTY_PROFILE, type Item } from './types';

const fx = (cases as any).fixtures;

/** The fixtures written out the way the workbook's "For the app" sheet writes them. */
function bookFromFixtures(opts: { costs?: boolean; formatted?: boolean } = {}): string {
  const money = (n: number | null | undefined) => {
    if (n === null || n === undefined) return '';
    // Excel writes what its number format says, so the parser meets thousands
    // separators and currency symbols in the wild, not tidy machine numbers.
    return opts.formatted ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 }) : String(n);
  };
  const L: string[] = [`AXIM PRICE BOOK\t${BOOK_FORMAT}\t2026-09-04`];
  L.push('[PRICES]', 'itemNo\tlistPrice\tstdCost');
  for (const i of fx.items) {
    L.push(`${i.itemNo}\t${money(i.listPrice)}\t${opts.costs === false ? '' : money(i.stdCost)}`);
  }
  L.push('[CATEGORIES]', 'code\tmaxDiscount');
  for (const c of fx.categories) {
    L.push(`${c.code}\t${c.maxDiscount === null || c.maxDiscount === undefined ? '' : c.maxDiscount}`);
  }
  L.push('[CAPS]', 'ruleCode\titemNo\tmaxDiscount');
  for (const r of fx.rules) {
    for (const a of r.actions ?? []) {
      if (a.actionType === 'cap' && a.itemNo) L.push(`${r.ruleCode}\t${a.itemNo}\t${a.maxDiscount}`);
    }
  }
  return L.join('\n');
}

/** The fixture items with their money stripped, standing in for the catalogue. */
const priceless: Item[] = fx.items.map((i: any) => ({ ...i, listPrice: null, stdCost: null }));

describe('the price book carries the money the engine needs', () => {
  it('parses a book the workbook would write', () => {
    const { book, problems, counts } = parseBook(bookFromFixtures());
    expect(problems, problems.join(' / ')).toEqual([]);
    expect(book).not.toBeNull();
    expect(counts.prices).toBe(fx.items.length);
    expect(book!.asOf).toBe('2026-09-04');
  });

  it('reads money the way a sheet writes it, not the way a machine does', () => {
    const { book, problems } = parseBook(bookFromFixtures({ formatted: true }));
    expect(problems, problems.join(' / ')).toEqual([]);
    const p = book!.prices.get('T-PRINTER-A')!;
    expect(p.listPrice).toBe(10000);
    expect(p.stdCost).toBe(5000);
  });

  it('refuses a book it cannot read rather than half-loading it', () => {
    expect(parseBook('some other spreadsheet\t1\t2026-09-04').book).toBeNull();
    const older = parseBook(`AXIM PRICE BOOK\t${BOOK_FORMAT + 1}\t2026-09-04`);
    expect(older.book).toBeNull();
    expect(older.problems[0]).toMatch(/format/i);
  });

  it('keeps blank cost as absent, not as zero', () => {
    const { book } = parseBook(bookFromFixtures({ costs: false }));
    expect(book!.prices.get('T-PRINTER-A')!.stdCost).toBeNull();
    expect(book!.prices.get('T-PRINTER-A')!.listPrice).toBe(10000);
  });

  it('reports what it reaches, so a thin book is visible', () => {
    const { book } = parseBook(bookFromFixtures());
    const c = coverage(priceless, book);
    expect(c.priced).toBe(fx.items.filter((i: any) => i.listPrice !== null && i.listPrice !== undefined).length);
    expect(c.unknown).toBe(0);
  });
});

describe('every contract case still holds when the money comes from a sheet', () => {
  const { book, problems } = parseBook(bookFromFixtures());
  expect(problems).toEqual([]);
  const items = applyBook(priceless, book);

  for (const c of (cases as any).cases) {
    it(c.name, () => {
      const got = evaluate({
        draft: { ...c.draft, profile: { ...EMPTY_PROFILE, ...c.draft.profile } },
        items, rules: fx.rules, categories: fx.categories, today: fx.today,
      } as any);
      const e = c.expect;
      if (e.extendedList !== undefined) expect(got.extendedList).toBe(e.extendedList);
      if (e.orderTotal !== undefined) expect(got.orderTotal).toBe(e.orderTotal);
      if (e.extendedNet !== undefined) expect(got.extendedNet).toBe(e.extendedNet);
      if (e.totalDiscount !== undefined) expect(got.totalDiscount).toBe(e.totalDiscount);
      if (e.flatDiscountApplied !== undefined) expect(got.flatDiscountApplied).toBe(e.flatDiscountApplied);
      if (e.optionalNet !== undefined) expect(got.optionalNet).toBe(e.optionalNet);
      if (e.marginPct !== undefined) expect(got.marginPct).toBe(e.marginPct);
      if (e.blocked !== undefined) expect(got.blocked).toBe(e.blocked);
      for (const el of e.lines ?? []) {
        const line = got.lines.find((l: any) => l.itemNo === el.itemNo);
        expect(line, `no priced line for ${el.itemNo}`).toBeTruthy();
        if (el.appliedDiscount !== undefined) expect(line!.appliedDiscount).toBe(el.appliedDiscount);
        if (el.cappedByRule !== undefined) expect(line!.cappedByRule).toBe(el.cappedByRule);
        if (el.netUnit !== undefined) expect(line!.netUnit).toBe(el.netUnit);
        if (el.extendedNet !== undefined) expect(line!.extendedNet).toBe(el.extendedNet);
      }
    });
  }
});

describe('a book with no cost in it', () => {
  it('withholds margin rather than stating a wrong one', () => {
    const { book } = parseBook(bookFromFixtures({ costs: false }));
    const items = applyBook(priceless, book);
    const got = evaluate({
      draft: { technologyCode: 'CIJ', profile: { ...EMPTY_PROFILE }, flags: {},
               categoryDiscounts: { system: 0.18 },
               lines: [{ itemNo: 'T-PRINTER-A', quantity: 1 }] },
      items, rules: fx.rules, categories: fx.categories, today: fx.today,
    } as any);
    // The prices are still right; only the figure that needs cost is absent.
    expect(got.orderTotal).toBe(8200);
    expect(got.marginPct).toBeNull();
    expect(got.marginNote).toMatch(/standard cost/i);
  });
});

describe('the block the workbook actually exports', () => {
  /* Not a hand-written imitation of what Excel writes -- the real thing, pulled out of
     'For the app'!A6 after a full recalculation and committed beside this test. A
     format the app parses and the workbook does not emit is two formats. */
  const exported = readFileSync(
    new URL('./__fixtures__/exported-book.txt', import.meta.url), 'utf8');

  it('parses with no complaints', () => {
    const { book, problems, counts } = parseBook(exported);
    expect(problems, problems.join(' / ')).toEqual([]);
    expect(book).not.toBeNull();
    expect(counts.prices).toBe(fx.items.length);
    expect(counts.caps).toBe(2);
    expect(book!.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('carries the same money the fixtures do, to the cent', () => {
    const { book } = parseBook(exported);
    for (const i of fx.items) {
      const p = book!.prices.get(i.itemNo);
      expect(p, `missing ${i.itemNo}`).toBeTruthy();
      expect(p!.listPrice).toBe(i.listPrice ?? null);
      expect(p!.stdCost).toBe(i.stdCost ?? null);
    }
  });

  it('prices every case exactly as the fixtures do', () => {
    /* Every money figure any case states, not just the ones that state an order
       total -- most assert extendedNet or a per-line net instead, and a book that
       lost a price would show up there first. */
    const items = applyBook(priceless, parseBook(exported).book);
    const MONEY = ['extendedList', 'extendedNet', 'orderTotal', 'totalDiscount',
                   'flatDiscountApplied', 'optionalNet', 'marginPct'] as const;
    let compared = 0;
    for (const c of (cases as any).cases) {
      const got: any = evaluate({
        draft: { ...c.draft, profile: { ...EMPTY_PROFILE, ...c.draft.profile } },
        items, rules: fx.rules, categories: fx.categories, today: fx.today,
      } as any);
      for (const k of MONEY) {
        if (c.expect[k] !== undefined) { expect(got[k], `${c.name} / ${k}`).toBe(c.expect[k]); compared++; }
      }
      for (const el of c.expect.lines ?? []) {
        const line = got.lines.find((l: any) => l.itemNo === el.itemNo);
        if (el.netUnit !== undefined) { expect(line!.netUnit, c.name).toBe(el.netUnit); compared++; }
        if (el.extendedNet !== undefined) { expect(line!.extendedNet, c.name).toBe(el.extendedNet); compared++; }
      }
    }
    // A guard on the guard: if the cases ever stop asserting money, this test would
    // pass by comparing nothing at all.
    expect(compared, "60 money figures at the time of writing").toBeGreaterThan(50);
  });
});
