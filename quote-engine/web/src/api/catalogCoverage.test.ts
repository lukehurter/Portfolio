import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';

/**
 * Every technology a rep can pick has to have something to pick.
 *
 * The tool offered seven price books and had machines for four of them. Nobody
 * noticed for a while, because an empty machine list reads as "nothing matched your
 * filters" rather than "this technology was never extracted". It was the latter: the
 * first price-page extract only harvested sheets whose names it recognised, and the
 * thermal jet and valve jet books name theirs differently.
 *
 * This is a coverage assertion rather than an exact count, so re-extracting or
 * reclassifying does not break it — but a technology losing its machines does.
 */
describe('catalogue coverage', () => {
  const printers = CATALOG.filter((i) => i.itemRole === 'printer' && i.isActive);
  const byTech = new Map<string, number>();
  for (const i of printers) byTech.set(i.technologyCode, (byTech.get(i.technologyCode) ?? 0) + 1);

  it.each(['CIJ', 'TTO', 'PALM', 'PIJ', 'TIJ', 'VIJ'])('%s has a machine to quote', (tech) => {
    expect(byTech.get(tech) ?? 0).toBeGreaterThan(0);
  });

  /**
   * The laser is the exception, and it is not an extraction gap.
   *
   * The LSR price pages carry the extraction, stands and consumables; every machine
   * row on them reads "THIS WILL BE PROVIDED BY PSE and/or AE". The machine itself
   * lives in a separate configurator workbook that assembles one part number out of
   * option codes, so there is no list to put in a list. `ENGINEERED` in
   * QuoteBuilder.tsx says that on screen, and `data/laser-configurator.md` records
   * what building it would take.
   */
  it('has laser parts to quote, even with no laser to pick', () => {
    expect(byTech.get('LSR') ?? 0).toBe(0);
    expect(CATALOG.filter((i) => i.technologyCode === 'LSR').length).toBeGreaterThan(20);
  });

  it('never files a fume extractor or a hose as a machine', () => {
    const wrong = printers.filter((i) =>
      /fume extractor|hose|cuff|t-fitting|usb to serial|power strip/i.test(i.description));
    expect(wrong.map((i) => `${i.itemNo} ${i.description}`)).toEqual([]);
  });
});
