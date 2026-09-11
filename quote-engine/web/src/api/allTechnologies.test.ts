import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import { ALL_TECHNOLOGIES } from './types';

/**
 * An item that belongs to every price book.
 *
 * Technology was mandatory and singular, so a promotion, a service offering or a training
 * day had two bad options: file it under one technology and go missing from the other six,
 * or file it under none and become unquotable. The catalogue shows the consequence —
 * "Single Day Installation: Mon-Fri" appears four times, once under VIJ, PALM, LSR and TTO,
 * because the alternative was for three of those books not to sell installation.
 *
 * ALL is a technology an item can carry, meaning every book. Whether Axim's real
 * installation is one SKU or seven is not something this repository knows, so nothing in
 * the catalogue was collapsed — the mechanism is here and a person decides.
 */

describe('an item marked as applying to all technologies', () => {
  it('is offered in every price book', async () => {
    // Any service item. CIJ has none of its own, which is the problem in miniature:
    // installation exists under VIJ, PALM, LSR and TTO and not under the book that
    // sells the most machines.
    const [item] = await mockApi.searchItems({ role: 'service', limit: 1 });
    expect(item, 'need a service item to test with').toBeDefined();

    await mockApi.classifyItems([{
      itemNo: item.itemNo,
      technologyCode: ALL_TECHNOLOGIES,
      itemRole: 'service',
      isQuotable: true,
      reason: 'sold alongside any technology',
    }]);

    for (const tech of ['CIJ', 'LSR', 'TTO', 'PALM', 'PIJ', 'TIJ', 'VIJ']) {
      const hits = await mockApi.searchItems({ technology: tech, q: item.itemNo });
      expect(hits.map((h) => h.itemNo), `missing from ${tech}`).toContain(item.itemNo);
    }
  });

  it('is not offered as a price book to quote in', async () => {
    // A rep picks a technology to quote in, and "all of them" is not one of those.
    const techs = await mockApi.listTechnologies();
    expect(techs.map((t) => t.code)).not.toContain(ALL_TECHNOLOGIES);
  });
});

describe('the classification list', () => {
  it('shows everything, not only what is unresolved', async () => {
    const all = await mockApi.listClassification({ status: 'all', limit: 5000 });
    const settled = await mockApi.listClassification({ status: 'classified', limit: 5000 });
    expect(all.total).toBeGreaterThan(settled.total);
    expect(settled.total).toBeGreaterThan(100);
  });

  it('separates the two reasons a classification is missing', async () => {
    // "No technology" and "no type" are different questions with different answers, and
    // a part can be missing one without the other.
    const c = (await mockApi.listClassification({ status: 'all', limit: 1 })).counts;
    for (const k of ['classified', 'needsTechnology', 'needsType', 'unearned']) {
      expect(c[k], `${k} not counted`).toBeGreaterThanOrEqual(0);
    }
  });

  it('filters by technology and by type together', async () => {
    const r = await mockApi.listClassification({
      status: 'all', technology: 'CIJ', role: 'consumable', limit: 5000,
    });
    expect(r.items.length).toBeGreaterThan(0);
    for (const i of r.items) {
      expect(i.technologyCode).toBe('CIJ');
      expect(i.itemRole).toBe('consumable');
    }
  });
});
