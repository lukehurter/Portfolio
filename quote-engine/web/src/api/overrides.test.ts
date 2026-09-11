import { afterEach, describe, expect, it } from 'vitest';
import { mockApi } from './mock';

/**
 * An override that has outlived its reason.
 *
 * A hand-classification beats the hierarchy for ever, which is right while a person
 * knows better and wrong the moment the data catches up. Fix a product line and every
 * override written before it silently keeps winning, so the tool goes on obeying a
 * decision nobody remembers making and no screen ever showed. They accumulate in the
 * one direction that cannot be noticed: quietly, and only in the parts somebody
 * already cared enough to correct.
 *
 * Overrides live in module state in the preview, so each test clears what it wrote.
 * Without that the second test inherits the first one's override and fails on it,
 * which says nothing about the code.
 */

const touched: string[] = [];

afterEach(async () => {
  if (touched.length) await mockApi.clearOverrides(touched.splice(0));
});

describe('a redundant override', () => {
  it('is flagged once it agrees with the sources', async () => {
    const before = await mockApi.listClassification({ status: 'classified', limit: 1 });
    const item = before.items[0];
    expect(item, 'need a classified item').toBeDefined();

    // Write an override saying exactly what the item already says.
    await mockApi.classifyItems([{
      itemNo: item.itemNo,
      technologyCode: item.technologyCode,
      itemRole: item.itemRole!,
      isQuotable: true,
      reason: 'confirmed',
    }]);
    touched.push(item.itemNo);

    const after = await mockApi.listClassification({ status: 'redundantOverride', limit: 500 });
    expect(after.items.map((i) => i.itemNo)).toContain(item.itemNo);
  });

  it('is not flagged when it genuinely changes the answer', async () => {
    const rows = await mockApi.listClassification({ status: 'classified', limit: 40 });
    const item = rows.items.find((i) => !!i.itemRole);
    expect(item).toBeDefined();

    // A role the item does not already have, derived rather than assumed: hard-coding
    // one and happening to pick the item's own role makes this test pass by accident.
    const different = item!.itemRole === 'spare' ? 'accessory' : 'spare';
    await mockApi.classifyItems([{
      itemNo: item!.itemNo,
      technologyCode: item!.technologyCode,
      itemRole: different,
      isQuotable: true,
      reason: 'a person decided otherwise',
    }]);
    touched.push(item!.itemNo);

    const redundant = await mockApi.listClassification({ status: 'redundantOverride', limit: 500 });
    expect(redundant.items.map((i) => i.itemNo)).not.toContain(item!.itemNo);
  });

  it('can be dropped, letting the hierarchy answer again', async () => {
    const rows = await mockApi.listClassification({ status: 'classified', limit: 1 });
    const item = rows.items[0];
    await mockApi.classifyItems([{
      itemNo: item.itemNo, technologyCode: item.technologyCode,
      itemRole: item.itemRole!, isQuotable: true, reason: 'confirmed',
    }]);

    const r = await mockApi.clearOverrides([item.itemNo]);
    expect(r.cleared).toBe(1);

    const after = await mockApi.listClassification({ status: 'redundantOverride', limit: 500 });
    expect(after.items.map((i) => i.itemNo)).not.toContain(item.itemNo);
  });
});
