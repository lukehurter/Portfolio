import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from './appRules';
import { SECTIONS } from './questionnaire';
import { ENVIRONMENT_OPTIONS, EMPTY_PROFILE } from './types';
import type { Rule } from './types';

/**
 * One vocabulary, spoken by the form, the rules and the customer's questionnaire.
 *
 * These three drifted apart without anything failing. The questionnaire asked for
 * 'high humidity' and 'cold or chilled'; every rule compares against 'condensation or
 * humidity' and 'refrigerated'. A customer ticking those boxes sent back answers that
 * imported cleanly, showed on the quote as captured, and matched no rule at all —
 * which is the worst kind of wrong, because everything looks like it worked.
 *
 * Nothing here checks wording. It checks that a value one part of the tool can produce
 * is a value the other parts can read.
 */

const rules = APPLICATION_RULES as Rule[];

/** Every value any rule compares a profile field against, by field. */
function comparedValues(field: string): string[] {
  const out = new Set<string>();
  for (const r of rules) {
    for (const t of r.triggers) {
      if (t.triggerType !== 'profile' || t.profileField !== field) continue;
      if (!t.compareValue) continue;
      // 'in' and 'includesAny' carry a comma-separated set; the rest carry one value.
      for (const v of t.compareValue.split(',')) out.add(v.trim());
    }
  }
  return [...out];
}

const question = (key: string) =>
  SECTIONS.flatMap((s) => s.questions).find((q) => q.key === key);

describe('the application vocabulary', () => {
  it('asks the customer about every environment a rule reads', () => {
    const asked = new Set((question('environment')?.options ?? []).map((o) => o.value));
    const unreachable = comparedValues('environment').filter((v) => !asked.has(v));
    expect(unreachable,
      'a rule reads an environment the questionnaire cannot produce').toEqual([]);
  });

  it('asks only for environments the tool knows', () => {
    const known = new Set<string>(ENVIRONMENT_OPTIONS);
    const invented = (question('environment')?.options ?? [])
      .map((o) => o.value).filter((v) => !known.has(v));
    expect(invented,
      'the questionnaire offers an environment nothing else in the tool has').toEqual([]);
  });

  it('can produce every porosity a rule reads', () => {
    /* This direction, not the other. A form value with no rule behind it is fine —
       porosity is on the quote for the rep to read whether or not a rule keys off it,
       and today only nonPorous does. A RULE that reads a value the form cannot
       produce is the failure, because that rule can never fire.

       'semiPorous' was exactly that: offered by the questionnaire, absent from the
       builder's own select, matched by nothing. */
    const asked = new Set((question('porosity')?.options ?? []).map((o) => o.value));
    const unreachable = comparedValues('porosity').filter((v) => !asked.has(v));
    expect(unreachable, 'a rule reads a porosity nothing can capture').toEqual([]);
  });

  it('asks about every field the profile carries, or says why not', () => {
    /* The two exceptions are the tool's own judgements rather than the customer's:
       which Axim ink to use, and the dry time that follows from it. A customer
       cannot answer either, and a form that asks unanswerable questions gets
       abandoned. */
    const exempt = new Set(['inkType', 'dryTimeSeconds']);
    const asked = new Set(SECTIONS.flatMap((s) => s.questions).map((q) => q.key as string));
    const missing = Object.keys(EMPTY_PROFILE)
      .filter((k) => !asked.has(k) && !exempt.has(k));
    expect(missing, 'a profile field nothing asks the customer about').toEqual([]);
  });

  it('reads back every field it asks for', () => {
    // The parser keys off the same names, so an asked field with no home on the
    // profile would be typed by a customer and dropped on import.
    const onProfile = new Set(Object.keys(EMPTY_PROFILE));
    const orphans = SECTIONS.flatMap((s) => s.questions)
      .map((q) => q.key as string).filter((k) => !onProfile.has(k));
    expect(orphans, 'the questionnaire asks for something the profile cannot hold').toEqual([]);
  });
});
