import { describe, expect, it } from 'vitest';
import { parseApplication } from './parseApplication';

const p = (t: string) => parseApplication(t).profile;

/**
 * A figure belongs to the noun that governs it.
 *
 * REPORTED by measurement, not from the screen: the character-height matcher led on a
 * bare "print", so any sentence with a millimetre figure after the word "print" set
 * the character height. "The print area is 60mm across" recorded 60mm type, which
 * trips `A-CIJ-CHR-6400` and `A-CIJ-CHR-MAX`, so a sentence about a print window came
 * back with every CIJ printer NOT RECOMMENDED — a confident wrong answer with a
 * datasheet citation beside it.
 *
 * These are the sentences that have to stay apart. Each figure may claim one field.
 */
describe('a measurement claims only the field its noun names', () => {
  it('does not read a print area as a character height', () => {
    expect(p('The print area is 60mm across.').charHeightMm).toBeUndefined();
    expect(p('The print area is 60mm across.').markingWindowMm).toBe(60);
    expect(p('print area of 2 inches').charHeightMm).toBeUndefined();
    expect(p('marking window is 45mm').charHeightMm).toBeUndefined();
  });

  it('keeps the two apart when both are stated', () => {
    const r = p('Print window is 60mm wide and characters 8mm tall.');
    expect(r.markingWindowMm).toBe(60);
    expect(r.charHeightMm).toBe(8);
  });

  it('still reads a height the ordinary ways', () => {
    expect(p('10mm characters').charHeightMm).toBe(10);
    expect(p('Characters around 8mm.').charHeightMm).toBe(8);
    expect(p('we print an 8mm best-before date code').charHeightMm).toBe(8);
    expect(p('We print a 25mm high logo.').charHeightMm).toBe(25);
    expect(p('character height 12mm').charHeightMm).toBe(12);
    expect(p('1/2 inch characters').charHeightMm).toBeCloseTo(12.7, 1);
  });

  it('does not take the throw distance for a height', () => {
    const r = p('The head sits 12mm off the case and prints 8mm characters.');
    expect(r.throwDistMm).toBe(12);
    expect(r.charHeightMm).toBe(8);
    // "the code sits 12mm off the case" is a distance, not 12mm type.
    expect(p('the code sits 12mm off the case').charHeightMm).toBeUndefined();
    expect(p('the printhead would sit 5mm off the case').charHeightMm).toBeUndefined();
  });

  it('never reads a bare number as a length', () => {
    expect(p('up to 24 characters per line').charHeightMm).toBeUndefined();
    expect(p('does not say how tall the characters are').charHeightMm).toBeUndefined();
  });
});
