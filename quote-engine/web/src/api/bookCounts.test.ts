import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { mockApi } from './mock';
import { MACHINE_IDENTITY } from './taxonomy';
import { EMPTY_PROFILE } from './types';
import { countMachines, suggest } from '../engine/evaluate';

/**
 * The number on the price-book chip is the number of rows underneath it.
 *
 * ASKED: "why does cij say 947 machines 1155 parts?" Because it counted part numbers
 * with a role of printer, and a Corvus SKU is a printer ALREADY FILLED — machine,
 * printhead, ink and colour in one number. Eight machines times six printheads times
 * forty-eight inks is 947 rows. The list underneath collapsed them back to nine and
 * had done for weeks; the chip above it never learnt.
 *
 * This is the third time a counter and a list have disagreed about the same question:
 *
 *   "VIJ says 8 good when there's only 4"   the book counter graded machines the list
 *                                           then dropped for porosity
 *   "947 machines"                          the book counter counted configurations
 *                                           the list then grouped
 *
 * Both were fixed by making the counter do what the list does. This asserts it for
 * every book rather than for the one that was reported, because the next one will be
 * a book nobody looked at.
 */
describe('the price book chip', () => {
  it('counts the machines the list will show, for every book', async () => {
    const techs = await mockApi.listTechnologies();
    expect(techs.length, 'no books to check').toBeGreaterThan(4);

    for (const t of techs) {
      const rows = suggest({
        draft: { technologyCode: t.code, profile: { ...EMPTY_PROFILE } },
        identity: MACHINE_IDENTITY[t.code],
        items: CATALOG, rules: [], categories: [], today: '2026-08-20',
      } as Parameters<typeof suggest>[0]).length;
      expect(t.machineCount, `${t.code}: the chip says ${t.machineCount} machines and `
        + `the list shows ${rows}`).toBe(rows);
    }
  });

  it('does not call a configuration a machine', async () => {
    /* The CIJ book is the case that made this visible and the one that would regress
       first: it is the only book with an identity, so it is the only one where the
       two numbers can differ at all. */
    const techs = await mockApi.listTechnologies();
    const cij = techs.find((t) => t.code === 'CIJ')!;
    const printerRows = CATALOG.filter(
      (i) => i.technologyCode === 'CIJ' && i.itemRole === 'printer' && i.isActive).length;

    expect(printerRows, 'the CIJ book should still hold hundreds of configurations')
      .toBeGreaterThan(500);
    expect(cij.machineCount, 'and the chip should not be reporting them as machines')
      .toBeLessThan(30);
  });

  it('counts an ungrouped book as it stands', () => {
    /* A book with no identity attributes has nothing to collapse on, and every row is
       its own machine — which is what those books already showed. The count must not
       change for them, or fixing CIJ would have quietly broken the other six. */
    for (const code of ['TIJ', 'TTO', 'PIJ', 'VIJ', 'PALM']) {
      const raw = CATALOG.filter(
        (i) => i.technologyCode === code && i.itemRole === 'printer' && i.isActive).length;
      expect(countMachines(CATALOG, code, MACHINE_IDENTITY[code]), code).toBe(raw);
    }
  });

  it('leaves an item that carries no identity standing on its own', () => {
    /* Treating "absent" as a value put every such item in one bucket together: two
       machines that merely both lack a Printer Type are not the same machine, and
       collapsing them would hide one behind the other. */
    const items = [
      { itemNo: 'A', technologyCode: 'X', itemRole: 'printer', isActive: true,
        attributes: { 'Printer Type': '6400 Dye Based' } },
      { itemNo: 'B', technologyCode: 'X', itemRole: 'printer', isActive: true,
        attributes: { 'Printer Type': '6400 Dye Based' } },
      { itemNo: 'C', technologyCode: 'X', itemRole: 'printer', isActive: true,
        attributes: {} },
      { itemNo: 'D', technologyCode: 'X', itemRole: 'printer', isActive: true,
        attributes: {} },
    ] as never;
    // A and B are one machine; C and D carry no identity and stand alone. Three.
    expect(countMachines(items, 'X', ['Printer Type'])).toBe(3);
  });
});
