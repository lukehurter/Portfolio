import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CIJ_7300 } from '../api/cij7300';
import { compose, conflicts, decode } from './partNumber';

/**
 * Every 7300 part number the price page lists, against the rules the sheet states.
 *
 * The compatibility rules were transcribed from guidance before there was anything to
 * check them against. The price page arrived afterwards with 133 real part numbers,
 * which makes this the test that matters: a rule that forbids a combination Axim
 * actually sells is worse than no rule, because it refuses a real order.
 *
 * It reads the extracted list rather than a copy of it, so adding a part number to
 * data/corvus-7300-items.json is enough to widen the check.
 */
const LIST = JSON.parse(readFileSync(
  new URL('../../../data/corvus-7300-items.json', import.meta.url), 'utf8'),
) as {
  counts: { items: number; orderable: number };
  items: { itemNo: string; description: string; availability: string; isActive: boolean;
           printer: string; printhead: string; length: string; ink: string }[];
};

describe('the real 7300 price list', () => {
  it('is there, and is not a handful of rows', () => {
    expect(LIST.items.length).toBe(LIST.counts.items);
    expect(LIST.items.length).toBeGreaterThan(100);
  });

  it('decodes every part number the price page sells', () => {
    const failed: string[] = [];
    for (const item of LIST.items) {
      const d = decode(item.itemNo);
      if (!d) { failed.push(`${item.itemNo} does not parse`); continue; }
      if (d.unknown.length) {
        failed.push(`${item.itemNo} uses codes not on the sheet: `
          + d.unknown.map((u) => `${u.label} ${u.code}`).join(', '));
      }
    }
    expect(failed, 'part numbers the configurator cannot read').toEqual([]);
  });

  it('permits every combination Axim actually sells', () => {
    /* The one that would really hurt. A constraint transcribed slightly too tightly
       shows a rep NOT RECOMMENDED against a machine on the price list. */
    const refused: string[] = [];
    for (const item of LIST.items) {
      const bad = conflicts({
        printer: item.printer, printhead: item.printhead,
        length: item.length, ink: item.ink,
      });
      if (bad.length) {
        refused.push(`${item.itemNo} (${item.description}) — ${bad.map((b) => b.why).join('; ')}`);
      }
    }
    expect(refused, 'real part numbers the rules refuse').toEqual([]);
  });

  it('rebuilds each part number from the positions it decoded', () => {
    for (const item of LIST.items) {
      expect(compose({
        printer: item.printer, printhead: item.printhead,
        length: item.length, ink: item.ink,
      }), item.itemNo).toBe(item.itemNo);
    }
  });

  it('agrees with the descriptions about the conduit', () => {
    /* The position a transcription slip survives silently, checked against the words
       the price page uses: "2M", "4M R/A", "6M". */
    const metres: Record<string, string> = { '0': '2', '1': '2', '2': '4', '3': '4', '6': '6', '7': '6' };
    const angled = new Set(['1', '3', '7']);
    let checked = 0;
    const wrong: string[] = [];
    for (const item of LIST.items) {
      const d = item.description.toUpperCase();
      if (!/\d\s*M\b/.test(d)) continue;
      checked += 1;
      if (!new RegExp(`\\b${metres[item.length]}\\s*M\\b`).test(d)) {
        wrong.push(`${item.itemNo}: length ${item.length} but "${item.description}"`);
      }
      if (angled.has(item.length) && !/R\/A|90D|RIGHT/.test(d)) {
        wrong.push(`${item.itemNo}: length ${item.length} is right-angled, "${item.description}" does not say so`);
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(wrong).toEqual([]);
  });

  it('confirms the Prism printheads are only ever on a Prism', () => {
    for (const item of LIST.items) {
      if (['H', 'D', '3'].includes(item.printhead)) {
        expect(item.printer, `${item.itemNo} has a Prism printhead`).toBe('6');
      }
      if (item.printer === '6') {
        expect(['H', 'D', '3'], `${item.itemNo} is a Prism`).toContain(item.printhead);
      }
    }
  });

  it('keeps the H printhead, which the workbook dropdown leaves out', () => {
    /* The supplied guidance lists eight printheads and the workbook's Validation
       Lists sheet offers seven — H, the PH4 Standard for Prism, is missing from the
       dropdown. The price list settles it: two parts use H, both on a Prism. A
       configurator built from the dropdown alone could not have read them. */
    const h = LIST.items.filter((i) => i.printhead === 'H');
    expect(h.length, 'H is used by real part numbers').toBeGreaterThan(0);
    expect(CIJ_7300.positions.find((p) => p.key === 'printhead')!.options
      .some((o) => o.code === 'H'), 'and the configurator knows it').toBe(true);
  });

  it('has far more inactive rows than orderable ones', () => {
    // 112 of 133. A catalogue ignoring this offers five times the machines that exist.
    expect(LIST.counts.orderable).toBeLessThan(LIST.items.length / 2);
    expect(LIST.items.filter((i) => i.isActive).length).toBe(LIST.counts.orderable);
  });
});
