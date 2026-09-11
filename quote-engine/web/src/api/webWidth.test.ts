import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import { CATALOG } from './catalog';
import { EMPTY_PROFILE } from './types';

/**
 * The LB5200 comes in two web widths, and the tool can now tell them apart.
 *
 * The rule that turns on this could only ever caution, and said so in its own detail:
 * the catalogue recorded the web width in the description text — "LB5200 Left-Handed-
 * Narrow Web" — and not as an attribute a trigger could read, so ruling out on a guess
 * at the description would have been the tool inventing a fact it did not hold.
 *
 * build_classification.py derives `Web Width` from that same description now. So a
 * label over 6 inches rules the narrow web machine out instead of cautioning about it,
 * and — the half that matters just as much — stops cautioning the wide web machine
 * about a limit it does not have.
 */

const NARROW = '649215K5Q-T11';       // LB5200 Right-Handed- Narrow Web
const WIDE = '504634F6C-V67';         // LB5200 Right-Handed- Wide Web

/** 7 inches, between the narrow web's 6 and the wide web's 9. */
const SEVEN_INCH = 177.8;

async function gradeOf(itemNo: string, labelWidthMm: number) {
  const ev = await mockApi.evaluateDraft({
    technologyCode: 'PALM', customerNo: null, customerName: 'Web Co',
    lineName: 'Line 1', noConstraint: [], flags: {}, categoryDiscounts: {},
    profile: { ...EMPTY_PROFILE, labelWidthMm },
    lines: [{ itemNo, quantity: 1 }],
  } as never);
  return ev.fit.find((f) => f.itemNo === itemNo);
}

describe('the web width the catalogue now records', () => {
  it('is on both machines, derived from what the description already said', () => {
    const narrow = CATALOG.find((i) => i.itemNo === NARROW);
    const wide = CATALOG.find((i) => i.itemNo === WIDE);
    expect(narrow?.attributes['Web Width']).toBe('Narrow');
    expect(wide?.attributes['Web Width']).toBe('Wide');
    // Not invented: the words are in the row a rep reads.
    expect(narrow?.description).toMatch(/narrow web/i);
    expect(wide?.description).toMatch(/wide web/i);
  });

  it('is not guessed onto a machine that does not state one', () => {
    /* The two PL6300 "No Engine" bases carry no web width, because their descriptions
       do not state one. An attribute invented for them would be worse than none. */
    const bare = CATALOG.filter((i) => /No Engine/i.test(i.description));
    expect(bare.length).toBeGreaterThan(0);
    for (const i of bare) expect(i.attributes['Web Width']).toBeUndefined();
  });

  it('rules the narrow web machine out past 6 inches, rather than cautioning', async () => {
    const fit = await gradeOf(NARROW, SEVEN_INCH);
    expect(fit?.grade, 'a 7 inch label on a 6 inch machine is not a caveat')
      .toBe('notRecommended');
    expect(fit?.reasons.map((r) => r.ruleCode)).toContain('A-PALM-LA7-LBL-WIDEWEB');
  });

  it('leaves the wide web machine alone at the same width', async () => {
    /* The half that was actually wrong before: the caveat fired on every LB5200 row,
       so a rep who had correctly quoted the wide web machine was warned about a limit
       it does not have. */
    const fit = await gradeOf(WIDE, SEVEN_INCH);
    expect(fit?.grade).not.toBe('notRecommended');
    expect(fit?.reasons.map((r) => r.ruleCode)).not.toContain('A-PALM-LA7-LBL-WIDEWEB');
  });

  it('still rules both out past 9 inches, which no LB5200 is rated for', async () => {
    for (const itemNo of [NARROW, WIDE]) {
      const fit = await gradeOf(itemNo, 250);
      expect(fit?.grade, itemNo).toBe('notRecommended');
      expect(fit?.reasons.map((r) => r.ruleCode)).toContain('A-PALM-LA7-LBL-WIDE');
    }
  });

  it('says nothing to either machine under 6 inches', async () => {
    for (const itemNo of [NARROW, WIDE]) {
      const fit = await gradeOf(itemNo, 101.6);   // 4 inches
      expect(fit?.reasons.map((r) => r.ruleCode), itemNo)
        .not.toContain('A-PALM-LA7-LBL-WIDEWEB');
    }
  });
});
