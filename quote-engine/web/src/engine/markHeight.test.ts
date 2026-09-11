import { describe, expect, it } from 'vitest';
import { DERIVED_FIELDS, profileValue } from './evaluate';
import { EMPTY_PROFILE, type QuoteDraft } from '../api/types';

/**
 * The marking window is room, not a requirement.
 *
 * REPORTED: "the label says height available to print in. My interpretation is the
 * available surface area to print in, but the rules interpret it as the height of the
 * print itself and exclude the printer that would be able to do it."
 *
 * Exactly so. Every print-height rule read markingWindowMm and ruled out any head
 * shorter than it — so the more room a pack had, the fewer machines would take it, and
 * a case with a clear side came back with nothing recommended.
 */
const draft = (profile: Partial<typeof EMPTY_PROFILE>, noConstraint: string[] = []) =>
  ({ profile: { ...EMPTY_PROFILE, ...profile }, noConstraint } as unknown as QuoteDraft);

describe('mark height', () => {
  it('is the character height when the message is one line', () => {
    expect(profileValue(draft({ charHeightMm: 10 }), 'markHeightMm')).toBe(10);
  });

  it('multiplies by the lines of print', () => {
    expect(profileValue(draft({ charHeightMm: 10, linesOfPrint: 3 }), 'markHeightMm')).toBe(30);
  });

  it('is unknown without a character height', () => {
    expect(profileValue(draft({ linesOfPrint: 3 }), 'markHeightMm')).toBeNull();
  });

  it('goes quiet when the character height is unconstrained', () => {
    // The shrug has to carry to what is derived from the field, or it is honoured
    // for the question and ignored for the rules that depend on it.
    expect(profileValue(draft({ charHeightMm: 10 }, ['charHeightMm']), 'markHeightMm')).toBeNull();
  });

  it('ignores the marking window entirely', () => {
    // The window is how much room there is. It has no bearing on how tall the code is.
    expect(profileValue(draft({ charHeightMm: 6, markingWindowMm: 200 }), 'markHeightMm')).toBe(6);
  });

  it('resolves every field it declares', () => {
    // DERIVED_FIELDS is what the rule editor offers. A name listed there and not
    // handled here is a trigger an author can pick that can never fire.
    const full = draft({ charHeightMm: 8, linesOfPrint: 2 });
    for (const field of Object.keys(DERIVED_FIELDS)) {
      expect(profileValue(full, field), field).not.toBeNull();
    }
  });
});
