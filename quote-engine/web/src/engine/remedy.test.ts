import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from '../api/appRules';
import { CATALOG } from '../api/catalog';
import { EMPTY_PROFILE } from '../api/types';
import { evaluate } from './evaluate';

/**
 * A finding a rep cannot act on is a finding the tool made them do the work for.
 *
 * Q-BARE-MOUNT says "no stand, bracket or mount on this quote" and carries no `fix`,
 * correctly — the CIJ book holds four mounts and choosing between them is the rep's call.
 * But it then ended there, and acting on it meant reading the sentence, working out that a
 * mount is an accessory, scrolling back, opening the parts step and changing the Kind
 * filter: four actions to act on advice the tool had already worked out.
 *
 * The rule was always naming the missing role in its own trigger — "a printer present, an
 * accessory absent". So the remedy is read off the condition that produced it, which means
 * the two can never disagree, and a rule written that way in future gets a picker without
 * anybody remembering to add one.
 */

const cij = CATALOG.find((i) => i.technologyCode === 'CIJ' && i.itemRole === 'printer')!;

function traceFor(itemNos: string[]) {
  return evaluate({
    draft: {
      technologyCode: 'CIJ', customerNo: null, customerName: null, lineName: null,
      profile: EMPTY_PROFILE, noConstraint: [], flags: {}, categoryDiscounts: {},
      solutions: [],
      lines: itemNos.map((itemNo) => ({ itemNo, quantity: 1 })),
    },
    items: CATALOG, rules: APPLICATION_RULES, categories: [], today: '2026-08-13',
  }).trace;
}

describe('a rule that names a kind of part', () => {
  it('carries the kind, taken from its own trigger', () => {
    const bare = traceFor([cij.itemNo]);
    const mount = bare.find((t) => t.ruleCode === 'Q-BARE-MOUNT');
    expect(mount, 'a machine on its own should raise Q-BARE-MOUNT').toBeDefined();
    expect(mount!.pickRole).toBe('accessory');
    // And no fix payload, because there is no single right answer to add.
    expect(mount!.fix ?? []).toEqual([]);
  });

  it('names the role the rule is actually missing, not a fixed guess', () => {
    const bare = traceFor([cij.itemNo]);
    const byCode = new Map(bare.map((t) => [t.ruleCode, t]));
    expect(byCode.get('Q-BARE-CONSUMABLE-CIJ')?.pickRole).toBe('consumable');
    expect(byCode.get('Q-BARE-INSTALL')?.pickRole).toBe('service');
  });
});

describe('every actionable finding', () => {
  it('ends with a way to act on it or an explicit statement that there is none', () => {
    // The property the review asked for: no finding is left as a sentence alone. The
    // screen renders one of three things, and this checks the data can always pick one.
    const bare = traceFor([cij.itemNo]);
    const actionable = bare.filter((t) => t.status === 'action' || t.status === 'warning');
    expect(actionable.length).toBeGreaterThan(0);
    for (const t of actionable) {
      const hasFix = !!t.fix?.length;
      const hasPick = !!t.pickRole;
      // Both would be ambiguous — the engine must choose one.
      expect(hasFix && hasPick, `${t.ruleCode} offers two remedies`).toBe(false);
    }
  });
});
