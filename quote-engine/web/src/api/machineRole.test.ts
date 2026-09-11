import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';

/**
 * The machine category has to contain machines.
 *
 * `printer` used to be a default: a part got it if its Product Line mapped to one and no
 * keyword in a deny-list argued it out. A deny-list can only describe the mistakes already
 * found, so everything it had never been told about kept the role — and because the demo
 * price bands key off role, "Handclean Hand Cleaner" was offered as a machine at $46,400.
 * "Scanner, Hand Data Logic, RS232" arrived the same way. A production-readiness review
 * found them, which means a customer could have.
 *
 * The role is now earned rather than assumed: a machine carries a model. This test is the
 * floor under that, and it is deliberately a property rather than a list of the two parts
 * somebody happened to notice — a list would pass again the moment a third one appeared.
 */

describe('the machine category', () => {
  it('contains nothing without a model', () => {
    const modelless = CATALOG
      .filter((i) => i.itemRole === 'printer' && !i.model)
      .map((i) => `${i.itemNo} ${i.description}`);
    expect(modelless).toEqual([]);
  });

  it('still holds the machines, so the floor did not empty the room', () => {
    // The failure this guards is over-correction: a stricter test that demotes everything
    // would pass the check above and leave the tool with nothing to recommend.
    const machines = CATALOG.filter((i) => i.itemRole === 'printer');
    expect(machines.length).toBeGreaterThan(900);

    // And every technology the tool grades has to keep some, or its fit rules have
    // nothing to fire on — the defect that hid 17 lasers behind fume extractors.
    for (const tech of ['CIJ', 'TTO', 'PALM', 'TIJ', 'PIJ', 'VIJ']) {
      const n = machines.filter((m) => m.technologyCode === tech).length;
      expect(n, `${tech} has no machines left`).toBeGreaterThan(0);
    }
  });

  it('does not offer the two parts the review caught', () => {
    for (const itemNo of ['8653400', '9476684']) {
      const item = CATALOG.find((i) => i.itemNo === itemNo);
      expect(item, `${itemNo} vanished from the catalogue`).toBeDefined();
      expect(item!.itemRole).not.toBe('printer');
    }
  });
});
