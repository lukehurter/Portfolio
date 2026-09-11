import { describe, expect, it } from 'vitest';
import { CIJ_7300 } from '../api/cij7300';
import { compose, conflicts, decode, describe as say, isAvailable } from './partNumber';

/**
 * A Corvus 7300 part number, read and written.
 *
 * The compatibility rules on the supplied sheet are the whole value of this: a part
 * number that composes but cannot be ordered is worse than no configurator, because
 * it looks like an answer. Every case below is one of the sheet's own sentences.
 */
describe('composing', () => {
  it('produces the documented format', () => {
    expect(compose({ printer: '4', printhead: 'W', length: '2', ink: '72' }))
      .toBe('K414-W2-72-CVS');
    expect(CIJ_7300.example).toBe('K414-W2-72-CVS');
  });

  it('says nothing until every position is answered', () => {
    expect(compose({ printer: '4', printhead: 'W', length: '2' })).toBeNull();
    expect(compose({})).toBeNull();
  });

  it('puts the Prism at 6, not 5', () => {
    // The sheet's own note, and the 6400 series agrees: P896 is the 6440 Prism.
    expect(compose({ printer: '6', printhead: 'D', length: '0', ink: '67' }))
      .toBe('K416-D0-67-CVS');
  });
});

describe('the compatibility rules', () => {
  it('keeps a right-angled conduit away from an HP-resistant printhead', () => {
    // "2 m right-angled; unavailable with HP-resistant conduits"
    for (const head of ['X', '2']) {
      for (const len of ['1', '3', '7']) {
        expect(isAvailable('length', len, { printhead: head }), `${head}+${len}`)
          .toBe(false);
      }
      expect(isAvailable('length', '0', { printhead: head }), `${head}+0`).toBe(true);
      expect(isAvailable('length', '2', { printhead: head }), `${head}+2`).toBe(true);
    }
  });

  it('keeps 6 m away from the Prism and the Compact', () => {
    // "6 m straight; unavailable with Corvus 7340 Prism or PH4 Compact"
    expect(isAvailable('length', '6', { printer: '6' })).toBe(false);
    for (const mini of ['1', '2', '3']) {
      expect(isAvailable('length', '6', { printhead: mini }), mini).toBe(false);
    }
    expect(isAvailable('length', '6', { printer: '4', printhead: 'U' })).toBe(true);
  });

  it('only lets the Prism printheads onto a Prism', () => {
    for (const head of ['H', 'D', '3']) {
      expect(isAvailable('printhead', head, { printer: '4' }), head).toBe(false);
      expect(isAvailable('printhead', head, { printer: '6' }), head).toBe(true);
    }
    // And the ordinary heads are not restricted by model.
    expect(isAvailable('printhead', 'U', { printer: '0' })).toBe(true);
  });

  it('holds the Prism Standard and Compact to 1316 ink', () => {
    // "for Prism printers; 1316 ink only"
    for (const head of ['H', '3']) {
      expect(isAvailable('printhead', head, { printer: '6', ink: '17' }), head).toBe(false);
      expect(isAvailable('printhead', head, { printer: '6', ink: '74' }), head).toBe(true);
    }
  });

  it('requires a Standard Plus for soft-pigmented ink', () => {
    // "Requires PH4 Standard Plus"
    expect(isAvailable('ink', '72', { printhead: 'W' })).toBe(true);
    expect(isAvailable('ink', '72', { printhead: 'U' })).toBe(false);
    expect(isAvailable('ink', '72', { printhead: '1' })).toBe(false);
  });

  it('requires a Prism and its Standard Plus for hard-pigmented ink', () => {
    // "Requires Prism plus PH4 Standard Plus for Prism"
    expect(isAvailable('ink', '67', { printer: '6', printhead: 'D' })).toBe(true);
    expect(isAvailable('ink', '67', { printer: '4', printhead: 'D' })).toBe(false);
    expect(isAvailable('ink', '67', { printer: '6', printhead: 'W' })).toBe(false);
  });

  it('requires a Prism and a Standard or Compact for 1316 Brilliant White', () => {
    // "Requires a Prism printer and an PH4 Standard or Compact printhead"
    expect(isAvailable('ink', '74', { printer: '6', printhead: 'H' })).toBe(true);
    expect(isAvailable('ink', '74', { printer: '6', printhead: '3' })).toBe(true);
    expect(isAvailable('ink', '74', { printer: '6', printhead: 'D' })).toBe(false);
  });

  it('keeps UV-readable ink off the Standard Plus', () => {
    // "For PH4 Standard or PH4 Compact"
    expect(isAvailable('ink', '27', { printhead: 'U' })).toBe(true);
    expect(isAvailable('ink', '27', { printhead: '1' })).toBe(true);
    expect(isAvailable('ink', '27', { printhead: 'W' })).toBe(false);
    expect(isAvailable('ink', '27', { printhead: 'D' })).toBe(false);
  });

  it('does not object to a decision nobody has made yet', () => {
    /* A constraint against an unanswered position is a decision still to come, not a
       conflict. Reporting it would make an empty form look like a mistake. */
    expect(conflicts({ ink: '67' })).toEqual([]);
    expect(conflicts({ printhead: 'H' })).toEqual([]);
    expect(conflicts({})).toEqual([]);
  });

  it('reaches the same answer whichever order the form is filled', () => {
    /* The rules run in every direction — the ink can rule out the printhead as
       readily as the printhead rules out the ink — so a rep who starts from the ink
       must not get a different form from one who starts from the machine. */
    const a = conflicts({ printhead: 'W', ink: '67', printer: '6' });
    const b = conflicts({ ink: '67', printer: '6', printhead: 'W' });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('decoding', () => {
  it('reads the worked example back', () => {
    const d = decode('K414-W2-72-CVS')!;
    expect(d).toBeTruthy();
    expect(d.selection).toEqual({ printer: '4', printhead: 'W', length: '2', ink: '72' });
    expect(d.conflicts).toEqual([]);
    expect(d.reads.map((r) => r.means)).toEqual([
      '7340 printer',
      'PH4 Standard Plus (75 microns)',
      '4 m straight',
      'Soft-pigmented: 1009, 1033, 1079, 1088',
    ]);
  });

  it('takes a part number the way it arrives in an email', () => {
    for (const written of ['k414-w2-72-cvs', 'K414 W2 72 CVS', 'K414W272CVS']) {
      expect(decode(written)?.partNo, written).toBe('K414-W2-72-CVS');
    }
  });

  it('is not fooled by another series', () => {
    // The 6400 shares the grammar and is not this configurator's to read: it has a
    // suffix position and 43 specific ink codes rather than five categories.
    expect(decode('Z167N714HJU')).toBeNull();
    expect(decode('L465E651BXABFUSAXX')).toBeNull();
    expect(decode('')).toBeNull();
  });

  it('reports a code the sheet does not list rather than inventing one', () => {
    const d = decode('K415-Z9-99-CVS')!;
    expect(d.unknown.map((u) => u.code)).toEqual(['5', 'Z', '9', '99']);
    expect(d.reads).toEqual([]);
  });

  it('flags a part number that cannot be ordered', () => {
    // A Prism head on a 7340, which the sheet does not allow.
    const d = decode('K414-D0-17-CVS')!;
    expect(d.conflicts.length).toBeGreaterThan(0);
    expect(d.conflicts[0].why).toMatch(/Prism/i);
  });

  it('says what it is in a sentence', () => {
    expect(say({ printer: '6', printhead: 'D', length: '2', ink: '67' }))
      .toBe('7340 Prism printer, PH4 Standard Plus (75 microns) for Prism printers, '
        + '4 m straight, Hard-pigmented: 1043, 1053, 1059, 1069, 1306, 1311, 1320');
  });
});
