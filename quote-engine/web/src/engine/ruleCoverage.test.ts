import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from '../api/appRules';
import { EMPTY_PROFILE } from '../api/types';

/**
 * Which application questions the rules can actually answer.
 *
 * A review said the rules "are not robust enough for a production release", and the honest
 * response is not a number of rules — it is knowing which of the 28 questions the tool asks
 * a rep have any rule behind them. A field with no rule is a question the tool asks, stores,
 * prints on the quote, and then ignores when grading. That is worse than not asking.
 *
 * So this test does not assert "enough rules exist". It asserts that the coverage is
 * DECLARED: every profile field is either in COVERED, meaning a rule reads it, or in
 * UNANSWERED with a reason. A new field added without a decision fails here, and a rule
 * written for an unanswered field fails here too, which is what makes the list shrink rather
 * than rot.
 *
 * Three fields left the profile entirely on 21 August rather than sitting here — height,
 * shifts per day and characters per line. Nothing in any datasheet, spec sheet, brochure,
 * captured page or vendor document states a limit for any of them, and none is on
 * Axim's own App Analysis form. A reason for not grading a question is only worth
 * writing down if the question is worth asking.
 *
 * That form is why the rest survived. Product Temp, Product Spacing, Product Width,
 * Product Length, Dry Time and Permanence of Mark are all on it by name, so they are
 * questions Axim asks with every order and the tool asks them too. They stay here
 * until a document settles them.
 */

/* Fields with at least one rule reading them, verified below against the real rules. */
const COVERED = [
  'lineSpeedFpm', 'charHeightMm', 'environment', 'porosity', 'messageContent',
  'throwDistMm', 'markingWindowMm', 'ambientTempMaxF', 'ambientTempMinF', 'guideRails',
  'linesOfPrint', 'barcodeRequirements', 'substrate', 'throughputPpm',
  /* Read since 14 August: the XL Series needs 5 bar of clean air at the print
     position, which is a question about the line rather than the machine — and on a
     new conveyor it is a question nobody has answered yet. */
  'conveyor',
  /* Read since 20 August. The print-and-apply book could not be graded on the one
     thing every applicator and every print engine states a limit for, because the
     profile had no label dimension — which is why the Kestrel engines were quotable
     machines with a specification on the screen and no rule that could reach them.
     Eighteen rules across six machines now turn on these two. */
  'labelWidthMm', 'labelLengthMm',
  /* Read since 22 August. Sixteen rules already reasoned about resolution and every
     one of them triggered on a proxy — line speed, the barcode box, air at the
     printhead — because nothing said what the print had to be good enough FOR. So each
     could describe the trade between resolution and speed and none could come down on
     a side. The valve jets resolve 9 x 25 DPI and the thermal jets 300 x 300; that is
     the gap this question decides. */
  'printQuality',
  /* Read since 21 August. The print-and-apply sheets state the apply rate and then
     state what it depends on in the same row — "Dependent on Label Length, Print Speed
     and Product Spacing" — so the ceiling is conditional and the condition is a
     question the tool already asks. No minimum spacing is published anywhere, so
     A-PALM-SPACING-RATE states the dependency rather than grading a threshold nobody
     wrote down. */
  'productSpacingMm',
];

/**
 * Fields the datasheets do not settle, and why. Each is a real gap, not an oversight.
 *
 * This list is written by hand and checked against the rules, which is the point: when I
 * wrote it I put `substrate` and `throughputPpm` here, reasoning that substrate is handled a
 * level up in technology-fit-rules.json. Both are in fact read by rules that ship, and the
 * test below said so immediately. A hand-written list of gaps is only worth having if
 * something checks it.
 */
const UNANSWERED: Record<string, string> = {
  productWidthMm: 'no datasheet states a pack-width limit; the constraint is the mount',
  productLengthMm: 'no published limit',
  productTempF: 'ink datasheets state cure behaviour, not a pack-temperature ceiling',
  productMotion: 'T400 publishes both continuous and intermittent variants; no rule needed',
  inkType: 'chosen as a line item rather than constraining the machine',
  dryTimeSeconds: 'stated per ink, and inks are not yet modelled as constraints',
  adhesionRequirements: 'no published figure; a sample test answers it',
  sampleTested: 'a process fact about the enquiry, not a constraint on a machine',
  notes: 'free text, deliberately never a trigger',
};

describe('the application profile', () => {
  it('has every field either covered by a rule or declared unanswered', () => {
    const fields = Object.keys(EMPTY_PROFILE);
    const accounted = new Set([...COVERED, ...Object.keys(UNANSWERED)]);
    const undecided = fields.filter((f) => !accounted.has(f));
    expect(undecided, 'a profile field with no rule and no stated reason').toEqual([]);
  });

  it('does not claim coverage a rule does not provide', () => {
    const read = new Set(
      APPLICATION_RULES.flatMap((r) => r.triggers)
        .map((t) => t.profileField)
        .filter(Boolean) as string[],
    );
    const claimed = COVERED.filter((f) => !read.has(f));
    expect(claimed, 'listed as covered, but no rule reads it').toEqual([]);
  });

  it('moves a field out of UNANSWERED as soon as a rule reads it', () => {
    const read = new Set(
      APPLICATION_RULES.flatMap((r) => r.triggers)
        .map((t) => t.profileField)
        .filter(Boolean) as string[],
    );
    const stale = Object.keys(UNANSWERED).filter((f) => read.has(f));
    expect(stale, 'a rule now reads this; move it to COVERED').toEqual([]);
  });
});

describe('every technology', () => {
  it('has application rules, so no price book grades everything silently', () => {
    for (const tech of ['CIJ', 'LSR', 'TTO', 'PALM', 'PIJ', 'TIJ', 'VIJ']) {
      const n = APPLICATION_RULES.filter((r) => r.technologyCode === tech).length;
      expect(n, `${tech} has no application rules`).toBeGreaterThan(0);
    }
  });

  it('has a speed ceiling that is not scoped to one model', () => {
    // The defect behind the 10,000,000 fpm report: a ceiling naming the fastest model
    // says nothing about the rest of the book.
    for (const tech of ['CIJ', 'LSR', 'TTO', 'PALM', 'PIJ', 'TIJ', 'VIJ']) {
      const ceiling = APPLICATION_RULES.some((r) =>
        r.technologyCode === tech
        && r.actions.some((a) => a.fitGrade === 'notRecommended')
        && r.triggers.some((t) => t.profileField === 'lineSpeedFpm' && t.compareOp === 'gt')
        && !r.triggers.some((t) => t.triggerType === 'model' || t.triggerType === 'item'));
      expect(ceiling, `${tech} has no technology-wide speed ceiling`).toBe(true);
    }
  });
});
