import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';

/**
 * The taxonomy belongs to the business, not to the build.
 *
 * REPORTED across three messages: the categories could not be set from a desk, there
 * was no way to see what was filed under one, and "there also needs to be a way to
 * add / remove technology and type in the app itself."
 *
 * One rule holds all three together: a value can be removed only when nothing is
 * filed under it. A vocabulary entry that disappears from under a part leaves the
 * part saying nothing at all, and nobody notices until a filter comes back empty.
 */
describe('price books', () => {
  it('can be added and removed while empty', async () => {
    await api.addTechnology('XYZ', 'Test book');
    expect((await api.listTechnologies()).map((t) => t.code)).toContain('XYZ');
    await api.removeTechnology('XYZ');
    expect((await api.listTechnologies()).map((t) => t.code)).not.toContain('XYZ');
  });

  it('refuses a code that is not shaped like one', async () => {
    await expect(api.addTechnology('a', 'x')).rejects.toThrow(/2 to 8 capitals/i);
  });

  it('will not remove one that still has parts in it', async () => {
    await expect(api.removeTechnology('CIJ')).rejects.toThrow(/parts are in CIJ/i);
  });

  it('will not touch the ALL sentinel', async () => {
    await expect(api.removeTechnology('ALL')).rejects.toThrow(/reserved/i);
    await expect(api.addTechnology('ALL', 'x')).rejects.toThrow(/reserved/i);
  });
});

describe('types', () => {
  it('can be added and removed while unused', async () => {
    await api.addItemRole('fixture');
    expect((await api.listItemRoles()).map((r) => r.name)).toContain('fixture');
    await api.removeItemRole('fixture');
    expect((await api.listItemRoles()).map((r) => r.name)).not.toContain('fixture');
  });

  it('will not remove one that parts are typed as', async () => {
    await expect(api.removeItemRole('printer')).rejects.toThrow(/typed as printer/i);
  });

  it('will not remove one a rule reads', async () => {
    // Structure rules say "a printer is on the quote and no accessory is". Dropping
    // a type out from under a rule leaves the rule unable to fire and looking fine.
    await expect(api.removeItemRole('accessory')).rejects.toThrow(/typed as accessory|read the type/i);
  });
});

describe('finding what is in a category', () => {
  it('filters the classification list by one', async () => {
    // Solvents, not Inks: "Inks" was a category that merely repeated the type `ink`
    // and has been dropped for that reason. Solvents sits on parts typed part and
    // consumable, so it says something the type does not.
    const found = await api.listClassification({ category: 'Solvents', limit: 500 });
    expect(found.items.length).toBeGreaterThan(0);
    for (const i of found.items) expect(i.category).toBe('Solvents');
  });

  it('finds the parts nothing has been filed under', async () => {
    // The list somebody actually needs when they add a category.
    const none = await api.listClassification({ category: '__none', limit: 50 });
    expect(none.items.length).toBeGreaterThan(0);
    for (const i of none.items) expect(i.category ?? null).toBeNull();
  });
});

/**
 * A category says what a type cannot.
 *
 * REPORTED: "there shouldn't be ink in type and ink in category for example, it only
 * needs one." Right, and it costs more than tidiness — "Inks" sat at the top of the
 * category list on 87 parts every one of which was already typed `ink`, pushing
 * Solvents, Conveyor and Brackets down a list a rep is scanning, which is the whole
 * reason the category level exists.
 */
describe('categories do not repeat types', () => {
  it('ships none that are just a type again', async () => {
    const cats = await api.listCategories('');
    const roles = (await api.listItemRoles()).map((r) => r.name);
    for (const c of cats) {
      const norm = c.category.toLowerCase()
        .replace(/^(cij|tto|tij|vij|pij|palm|laser|alp)\s+/, '').replace(/s$/, '');
      expect(roles, c.category).not.toContain(norm);
    }
  });

  it('refuses a new one that repeats a type', async () => {
    // The build strips these out; this is what stops them being typed back in.
    await expect(api.addCategory('Inks')).rejects.toThrow(/already a type/i);
    await expect(api.addCategory('printhead')).rejects.toThrow(/already a type/i);
  });

  it('still allows a category that merely contains a type word', async () => {
    // "Ink Delivery System" is not "ink" — it names a thing the type cannot.
    await api.addCategory('Ink Filters');
    expect((await api.listCategories('')).map((c) => c.category)).toContain('Ink Filters');
    await api.removeCategory('Ink Filters');
  });
});

/**
 * Every vocabulary panel counts what is filed under it.
 *
 * REPORTED: "types in the classify screen have a red remove and don't show the count
 * of parts in it, it should be grayed out like everything else if there are still
 * things assigned in there." The types list was a bare array of names, so the panel
 * had no count to disable on — a red Remove that looks live and then refuses.
 */
describe('vocabulary counts', () => {
  it('counts the parts under every type', async () => {
    const roles = await api.listItemRoles();
    expect(roles.find((r) => r.name === 'printer')!.count).toBeGreaterThan(0);
    expect(roles.find((r) => r.name === 'ink')!.count).toBeGreaterThan(0);
    for (const r of roles) expect(typeof r.count, r.name).toBe('number');
  });

  it('counts the parts in every price book', async () => {
    for (const t of await api.listTechnologies()) {
      expect(typeof t.itemCount, t.code).toBe('number');
    }
    expect((await api.listTechnologies()).find((t) => t.code === 'CIJ')!.itemCount)
      .toBeGreaterThan(0);
  });

  it('counts nothing under a type nobody uses, so it can be removed', async () => {
    await api.addItemRole('fixture');
    const added = (await api.listItemRoles()).find((r) => r.name === 'fixture')!;
    expect(added.count).toBe(0);
    await api.removeItemRole('fixture');
  });
});
