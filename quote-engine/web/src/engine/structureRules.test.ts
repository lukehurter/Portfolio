import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { APPLICATION_RULES } from '../api/appRules';
import { CATALOG } from '../api/catalog';
import { EMPTY_PROFILE, type QuoteDraft } from '../api/types';

const draft = (lines: { itemNo: string; quantity: number }[]): QuoteDraft => ({
  technologyCode: 'CIJ',
  customerNo: null, customerName: 'Test', lineName: null,
  profile: { ...EMPTY_PROFILE }, noConstraint: [], flags: {},
  categoryDiscounts: {}, solutions: [], lines,
  recipientEmail: null, coveringNote: null,
});

const run = (lines: { itemNo: string; quantity: number }[], tech = 'CIJ') =>
  evaluate({
    draft: { ...draft(lines), technologyCode: tech }, items: CATALOG,
    rules: APPLICATION_RULES, categories: [], today: '2026-08-07',
  }).trace.map((t) => t.ruleCode);

/** The first n parts of a role in a technology, as a draft would carry them. */
const someOf = (tech: string, role: string, n: number) =>
  CATALOG.filter((i) => i.technologyCode === tech && i.itemRole === role)
    .slice(0, n).map((i) => ({ itemNo: i.itemNo, quantity: 1 }));

/**
 * The structure rules, against the real rule set and the real catalogue.
 *
 * engine-cases.json proves the mechanisms — role inversion, pickOne — on fixtures.
 * This proves the shipped rules actually fire on shipped parts, which fixtures
 * cannot: structure-rules.json names part numbers directly, so if a part leaves the
 * catalogue the rule naming it is dead and nothing else would notice. A failure
 * here means either the rule or the catalogue moved, and both are worth being told
 * about.
 */
describe('the real structure rules against the real catalogue', () => {
  it('does not ask a laser for something to print with', () => {
    /* REPORTED: "make sure it is compatible with laser machines, because currently
       it is giving a warning for not having consumables when I guess it doesn't need
       any."

       Q-BARE-CONSUMABLE was scoped to every price book, and a laser marks with
       light. So a laser quote carried a warning for ever, with nothing that could be
       added to clear it — the worst kind of finding, because the only way to make it
       go away is to learn to ignore the panel. */
    /* A laser is configured rather than picked, so its part number is registered at
       quote time with itemRole 'printer' — every structure rule that says "a printer
       is on the quote" has to see it, which is right and is also how it walked into
       this one. Built here the way the configurator builds it. */
    const laser = {
      itemNo: 'L46CSL60-TEST', description: 'CSL60 laser, configured',
      prodCat: 'LSR-PRI', prodCatDesc: 'LSR printer', technologyCode: 'LSR',
      itemRole: 'printer', discountCatCode: 'system', listPrice: 42000, stdCost: null,
      model: 'CSL60', classSource: 'configurator', uom: 'EA', isActive: true,
      attributes: {},
    } as unknown as (typeof CATALOG)[number];
    const codes = evaluate({
      draft: { ...draft([{ itemNo: laser.itemNo, quantity: 1 }]), technologyCode: 'LSR' },
      items: [...CATALOG, laser], rules: APPLICATION_RULES, categories: [],
      today: '2026-08-07',
    }).trace.map((t) => t.ruleCode);
    expect(codes.filter((c) => c.startsWith('Q-BARE-CONSUMABLE'))).toEqual([]);
    // And the catalogue agrees there is nothing to add: LSR carries no consumable at
    // all, so the warning was one a rep could never clear.
    expect(CATALOG.filter((i) => i.technologyCode === 'LSR' && i.itemRole === 'consumable'))
      .toEqual([]);
  });

  it('still asks every technology that does consume something', () => {
    // The rule is not gone, it is scoped. Six books mark with a consumable and each
    // keeps its own copy; only the laser is exempt, and only because it earns it.
    for (const tech of ['CIJ', 'TIJ', 'VIJ', 'PIJ', 'TTO', 'PALM']) {
      const machine = CATALOG.find((i) => i.technologyCode === tech && i.itemRole === 'printer');
      expect(machine, `${tech} has a machine in the preview catalogue`).toBeTruthy();
      if (!machine) continue;
      const codes = run([{ itemNo: machine.itemNo, quantity: 1 }], tech);
      expect(codes, tech).toContain(`Q-BARE-CONSUMABLE-${tech}`);
    }
  });

  it('questions a printer quoted on its own', () => {
    const codes = run([{ itemNo: 'Z167N714HJU', quantity: 1 }]);
    expect(codes).toContain('Q-BARE-MOUNT');
    expect(codes).toContain('Q-BARE-CONSUMABLE-CIJ');
    expect(codes).toContain('Q-BARE-INSTALL');
  });

  it('stops asking for a mount once one is on the quote', () => {
    const codes = run([
      { itemNo: 'Z167N714HJU', quantity: 1 },
      { itemNo: 'YD40176', quantity: 1 },
    ]);
    expect(codes).not.toContain('Q-BARE-MOUNT');
  });

  it('questions two poles where one length is needed', () => {
    const codes = run([
      { itemNo: 'Z167N714HJU', quantity: 1 },
      { itemNo: '797711', quantity: 1 },
      { itemNo: '091570', quantity: 1 },
    ]);
    expect(codes).toContain('Q-ONE-POLE');
  });

  it('says nothing when one pole is chosen', () => {
    const codes = run([
      { itemNo: 'Z167N714HJU', quantity: 1 },
      { itemNo: '797711', quantity: 1 },
    ]);
    expect(codes).not.toContain('Q-ONE-POLE');
  });

  it('questions a heap of service items', () => {
    // The reported case: all the service lines added at once. PALM carries five in
    // the preview catalogue; CIJ carries none, which is why this is not a CIJ quote.
    const svc = someOf('PALM', 'service', 3);
    expect(svc.length).toBe(3);
    expect(run(svc, 'PALM')).toContain('Q-MANY-SERVICE');
  });

  it('questions a heap of spares', () => {
    const spares = someOf('PALM', 'spare', 4);
    expect(spares.length).toBe(4);
    expect(run(spares, 'PALM')).toContain('Q-MANY-SPARE');
  });

  it('counts distinct parts, not quantity', () => {
    // Nine of one spare is a stocking decision, not a heap.
    const one = someOf('PALM', 'spare', 1).map((l) => ({ ...l, quantity: 9 }));
    expect(run(one, 'PALM')).not.toContain('Q-MANY-SPARE');
  });

  it('does not question a normal quote', () => {
    // A printer, a mount, an ink and an install: nothing here is a heap.
    const codes = run([
      { itemNo: 'Z167N714HJU', quantity: 1 },
      { itemNo: 'YD40176', quantity: 1 },
    ]);
    for (const code of ['Q-MANY-SERVICE', 'Q-MANY-SPARE', 'Q-MANY-ACCESSORY', 'Q-MANY-CONSUMABLE']) {
      expect(codes).not.toContain(code);
    }
  });

  it('questions every bracket added at once', () => {
    const codes = run([
      { itemNo: 'YD40176', quantity: 1 },
      { itemNo: 'ZF24718', quantity: 1 },
      { itemNo: 'HB41301', quantity: 1 },
    ]);
    expect(codes).toContain('Q-ONE-BRACKET');
  });
});
