import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';

/**
 * Reclassifying a part has to move it everywhere.
 *
 * REPORTED: "when I add something to the machine category, it isn't going into the
 * list of machines, same with every other category in the configurator. They do go
 * into the full catalogue though."
 *
 * searchItems applied the overrides and everything else read the catalogue raw — the
 * machine list, the companion suggestions, the category counts, the engine. So
 * reclassifying moved a part in one list out of five, which is worse than not moving
 * it at all, because it looks like it worked.
 */
describe('classification reaches every list', () => {
  it('puts a reclassified part into the machine list, not just the catalogue', async () => {
    const before = await api.suggestItems({
      technologyCode: 'CIJ', profile: {} as never, limit: 400 });
    // Something that is not a machine today.
    const acc = (await api.searchItems({ technology: 'CIJ', role: 'accessory', limit: 1 }))[0];
    expect(acc).toBeTruthy();
    expect(before.items.some((i) => i.itemNo === acc.itemNo)).toBe(false);

    await api.classifyItems([{
      itemNo: acc.itemNo, technologyCode: 'CIJ', itemRole: 'printer',
      isQuotable: true, reason: 'test',
    }]);

    const after = await api.suggestItems({
      technologyCode: 'CIJ', profile: {} as never, limit: 400 });
    expect(after.items.some((i) => i.itemNo === acc.itemNo)).toBe(true);
    // And in the catalogue, which was the one place it already worked.
    const found = await api.searchItems({ technology: 'CIJ', role: 'printer', q: acc.itemNo });
    expect(found.some((i) => i.itemNo === acc.itemNo)).toBe(true);
    await api.clearOverrides([acc.itemNo]);
  });

  it('moves a part between categories and the counts follow', async () => {
    const item = (await api.searchItems({ technology: 'CIJ', role: 'accessory', limit: 1 }))[0];
    await api.addCategory('Sensors');
    await api.classifyItems([{
      itemNo: item.itemNo, technologyCode: 'CIJ', itemRole: 'accessory',
      category: 'Sensors', isQuotable: true, reason: 'test',
    }]);
    const cats = await api.listCategories('CIJ');
    expect(cats.find((c) => c.category === 'Sensors')?.count).toBe(1);
    const filtered = await api.searchItems({ technology: 'CIJ', category: 'Sensors' });
    expect(filtered.map((i) => i.itemNo)).toContain(item.itemNo);
    await api.clearOverrides([item.itemNo]);
    await api.removeCategory('Sensors');
  });
});

describe('adding and removing a category', () => {
  it('shows a new one immediately, empty', async () => {
    await api.addCategory('Photo eyes');
    const cats = await api.listCategories('CIJ');
    expect(cats.find((c) => c.category === 'Photo eyes')?.count).toBe(0);
    await api.removeCategory('Photo eyes');
  });

  it('refuses a duplicate', async () => {
    await api.addCategory('Guarding');
    await expect(api.addCategory('guarding')).rejects.toThrow(/already exists/i);
    await api.removeCategory('Guarding');
  });

  it('refuses to remove one that still has parts under it', async () => {
    // The rule that makes this safe: a category removed from under a part leaves the
    // part saying nothing, and nobody notices until a filter comes back empty.
    const cats = await api.listCategories('CIJ');
    const used = cats.find((c) => c.count > 0)!;
    await expect(api.removeCategory(used.category)).rejects.toThrow(/still classified/i);
  });

  it('removes an empty one', async () => {
    await api.addCategory('Temporary');
    await api.removeCategory('Temporary');
    const cats = await api.listCategories('CIJ');
    expect(cats.map((c) => c.category)).not.toContain('Temporary');
  });
});
