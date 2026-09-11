import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from './appRules';
import { CATALOG } from './catalog';
import { mediaFor } from './media';
import { specsFor } from './specs';
import { EMPTY_PROFILE } from './types';
import { evaluate } from '../engine/evaluate';
import type { Rule } from './types';

/**
 * Every machine a rep can quote can be graded by something.
 *
 * ASKED: "Is every new spec / datasheet / brochure fully integrated with the rules and
 * application?" It was not, and the gap was invisible: six machines had a document
 * link, a specification table on the screen and no application-fit rule at all, so no
 * application could ever rule them in or out. They graded `notAssessed` for every
 * enquiry and sat wherever the tie-break put them.
 *
 * A document that reaches the screen and not the rule set is half-integrated, and
 * nothing failed when it was. This is what fails now.
 */

/** The rules that can reach this machine, asked of the engine rather than of the JSON. */
function rulesReaching(model: string): Rule[] {
  const item = CATALOG.find((i) => i.model === model && i.itemRole === 'printer');
  if (!item) return [];
  return (APPLICATION_RULES as Rule[]).filter((r) => {
    const named = r.triggers.filter((t) => t.triggerType === 'model');
    if (named.length === 0) return false;
    // Only the model triggers, so the question is "does this rule apply to this
    // machine at all" rather than "does it fire for some particular application".
    const out = evaluate({
      draft: {
        quoteNo: 'coverage', technologyCode: item.technologyCode, customerName: '',
        lines: [{ itemNo: item.itemNo, quantity: 1 }], profile: { ...EMPTY_PROFILE },
      } as never,
      items: [item], rules: [{ ...r, triggers: named, ruleType: 'applicationFit' }],
      categories: [], today: '2026-08-20',
    } as never);
    return (out.trace ?? []).some((t) => t.ruleCode === r.ruleCode)
      || (out.fit ?? []).some((f) => (f.reasons ?? []).some((x) => x.ruleCode === r.ruleCode));
  });
}

const MODELS = [...new Set(CATALOG
  .filter((i) => i.itemRole === 'printer' && i.model)
  .map((i) => i.model as string))].sort();

/**
 * Machines nobody can write a fit rule for yet, and the reason for each.
 *
 * A named exception, not a silent one: adding a machine here should feel like an
 * admission. Removing one is the goal.
 */
const NO_RULE_POSSIBLE: Record<string, string> = {
  /* Empty, and it took adding two profile fields to get here.
     The Kestrel engines lived in this list because every figure Kestrel publishes is about
     the label — media width 13 to 131 mm on an K84X — and the application profile had
     no label dimension to compare them to. That was a gap in the profile being read as
     a gap in the data.

     The list stays, empty, because the next machine somebody cannot write a rule for
     should have to be named here with a reason rather than quietly graded notAssessed
     for every enquiry. */
};

describe('rule coverage', () => {
  it('can grade every machine it can quote', () => {
    for (const m of MODELS) {
      if (NO_RULE_POSSIBLE[m]) continue;
      expect(rulesReaching(m).length, `${m} has no application-fit rule — a rep can quote `
        + 'it and no enquiry can rule it in or out').toBeGreaterThan(0);
    }
  });

  it('keeps the list of ungradeable machines honest', () => {
    /* An exception list is only worth having if something checks it, or it rots into a
       set of machines nobody has looked at since. So: every entry must still be
       quotable, must still have no rule, and must say why. */
    for (const [m, why] of Object.entries(NO_RULE_POSSIBLE)) {
      expect(MODELS, `${m} is no longer quotable — drop it from NO_RULE_POSSIBLE`).toContain(m);
      expect(rulesReaching(m).length,
        `${m} has rules now — drop it from NO_RULE_POSSIBLE`).toBe(0);
      expect(why.length, `${m} needs a reason`).toBeGreaterThan(10);
    }
    // The list is an admission and should stay short.
    expect(Object.keys(NO_RULE_POSSIBLE).length).toBeLessThan(4);
  });

  it("never grades one machine with another machine's figures", () => {
    /* FOUND while auditing this: A-TIJ-HEIGHT-1IN and A-TIJ-CHAIN-1IN carried no model
       trigger, so they graded the HP 0.5" head as well as the 1.0". A rep quoting a
       0.5" head for a 30 mm mark saw two contradictory reasons about the same machine,
       and above 101.6 mm the 1" rule was offering to chain heads that cannot reach it.

       The general form: a rule whose message names a specific head, model or figure
       has to name that model in a trigger. */
    const halfHead = rulesReaching('HP 0.5"').map((r) => r.ruleCode);
    const fullHead = rulesReaching('HP 1.0"').map((r) => r.ruleCode);
    expect(halfHead).toContain('A-TIJ-HEIGHT-HALF');
    expect(halfHead).not.toContain('A-TIJ-HEIGHT-1IN');
    expect(halfHead).not.toContain('A-TIJ-CHAIN-1IN');
    expect(fullHead).toContain('A-TIJ-HEIGHT-1IN');
    expect(fullHead).not.toContain('A-TIJ-HEIGHT-HALF');
  });

  it('cites a document for every figure it grades on', () => {
    for (const m of MODELS) {
      for (const r of rulesReaching(m)) {
        expect(r.sourceRef, `${r.ruleCode} (${m})`).toBeTruthy();
        expect(r.author, `${r.ruleCode} (${m})`).toBeTruthy();
      }
    }
  });

  it('shows a document for every machine it holds figures for', () => {
    // The other half of integration: figures on the screen with nothing to open.
    for (const m of MODELS) {
      if (!specsFor(m)) continue;
      expect(mediaFor(m)?.docUrl, m).toBeTruthy();
    }
  });
});
