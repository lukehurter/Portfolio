import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from '../api/appRules';
import { CATALOG } from '../api/catalog';
import { EMPTY_PROFILE } from '../api/types';
import { evaluate } from './evaluate';
import { decode } from './partNumber';

/**
 * The supplied 7300 starter package, as a test.
 *
 * Seven lines a rep would actually quote, given 21 August 2026. It is the only
 * end-to-end example of a complete CIJ system this repository has, and running it
 * turned up that the completeness check was asking the wrong question — so it stays
 * as the case that proves the answer.
 *
 *   Printer               K410-U0-17-CVS   7300 IP55 PH4 MIDI 2M
 *   Printhead stand       YD40176
 *   Photo eye / trigger   0210879
 *   Trolley               FA62102          (not in the catalogue)
 *   Startup ink           JZT1227/6E
 *   Startup solvent       ZHC8871/8H
 *   Cleaning fluid        EG02464/E
 */

const PACKAGE = ['YD40176', '0210879', 'JZT1227/6E', 'ZHC8871/8H', 'EG02464/E'];
const printer = CATALOG.find((i) => i.technologyCode === 'CIJ' && i.itemRole === 'printer')!;

function said(itemNos: string[]): string[] {
  const ev = evaluate({
    draft: {
      quoteNo: 'starter', technologyCode: 'CIJ', customerName: '', lineName: null,
      customerNo: null, flags: {}, categoryDiscounts: {}, noConstraint: [],
      lines: itemNos.map((n) => ({ itemNo: n, quantity: 1 })),
      profile: { ...EMPTY_PROFILE },
    },
    items: CATALOG, rules: APPLICATION_RULES, categories: [], today: '2026-08-21',
  } as never);
  return (ev.trace ?? []).map((t: { ruleCode: string }) => t.ruleCode);
}

describe('the 7300 starter package', () => {
  it('reads its printer part number with nothing left over', () => {
    const d = decode('K410-U0-17-CVS')!;
    expect(d, 'the supplied part number must decode').toBeTruthy();
    expect(d.unknown, 'every position is on the sheet').toEqual([]);
    expect(d.conflicts, 'and nothing about it conflicts').toEqual([]);
    // The supplied description is "7300 IP55 PH4 MIDI 2M".
    expect(d.reads.map((r) => r.means)).toEqual([
      '7300 printer',
      'PH4 Standard (62 microns)',
      '2 m straight',
      'Other dye-based inks',
    ]);
  });

  it('has five of its six accessories already in the catalogue', () => {
    for (const pn of PACKAGE) {
      const item = CATALOG.find((i) => i.itemNo === pn);
      expect(item, `${pn} should be in the catalogue`).toBeTruthy();
      expect(item!.technologyCode, pn).toBe('CIJ');
    }
    // The trolley is not, and that is a gap in the catalogue rather than in the
    // series: it is an accessory that ought to be quotable today.
    expect(CATALOG.find((i) => i.itemNo === 'FA62102'),
      'FA62102 has appeared — drop it from the known gaps').toBeUndefined();
  });

  it('does not tell a quote with ink on it that it has no ink', () => {
    /* The bug this package found. Q-BARE-CONSUMABLE-CIJ triggered on the role
       `consumable` and said "nothing to print with"; ink carries the role `ink`. */
    expect(said([printer.itemNo, 'JZT1227/6E']), 'ink is on this quote')
      .not.toContain('Q-BARE-INK-CIJ');
  });

  it('does tell a quote with no ink that it has no ink', () => {
    // The other half, which used to pass in silence.
    expect(said([printer.itemNo, 'ZHC8871/8H']), 'solvent but no ink')
      .toContain('Q-BARE-INK-CIJ');
  });

  it('asks for solvent separately from ink', () => {
    expect(said([printer.itemNo, 'JZT1227/6E']), 'ink but no solvent')
      .toContain('Q-BARE-CONSUMABLE-CIJ');
    expect(said([printer.itemNo, 'JZT1227/6E', 'ZHC8871/8H']), 'both')
      .not.toContain('Q-BARE-CONSUMABLE-CIJ');
  });

  it('is quiet about completeness once the package is on the quote', () => {
    /* Everything except installation, which the package does not carry and the tool
       is right to mention — Q-BARE-INSTALL is a separate judgement and stays. */
    const codes = said([printer.itemNo, ...PACKAGE]).filter((c) => c.startsWith('Q-BARE'));
    expect(codes).toEqual(['Q-BARE-INSTALL']);
  });
});
