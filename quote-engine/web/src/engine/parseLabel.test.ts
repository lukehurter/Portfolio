import { describe, expect, it } from 'vitest';
import { parseApplication } from './parseApplication';

/**
 * The label size, read out of the enquiry.
 *
 * Eighteen rules across six machines turn on these two fields — every applicator and
 * every print engine states a label limit — so a field the parser cannot fill is a
 * field a rep fills by hand, which mostly means a field nobody fills.
 *
 * The case that matters most is the one where both sizes are in the sentence. "4x6
 * labels onto a 12x8x6 case" is two pairs of numbers, and taking one for the other
 * would grade the applicator against the case.
 */
describe('label size', () => {
  it('reads a labelled pair, width first', () => {
    const r = parseApplication('We apply 4 x 6 inch labels to the side of the case.');
    expect(r.profile.labelWidthMm).toBeCloseTo(101.6, 1);
    expect(r.profile.labelLengthMm).toBeCloseTo(152.4, 1);
  });

  it('does not take the pack size for the label size', () => {
    const r = parseApplication(
      'We apply 4 x 6 inch labels onto 12x8x6 cases at 60 a minute.');
    expect(r.profile.labelWidthMm, 'label width').toBeCloseTo(101.6, 1);
    expect(r.profile.labelLengthMm, 'label length').toBeCloseTo(152.4, 1);
    // The case is 12 inches, and it must not have become the label.
    expect(r.profile.labelWidthMm).not.toBeCloseTo(304.8, 1);
  });

  it('leaves the label empty when nothing says label', () => {
    /* A bare "4 x 6" is a pack far more often than a label. Guessing wrong here puts
       a machine in front of a rep for the wrong reason, which is worse than an empty
       field they can fill. */
    const r = parseApplication('Cases are 4 x 6 and run at 100 fpm.');
    // Absent, not zero: the parser sets only what it read, the way every other
    // field here behaves.
    expect(r.profile.labelWidthMm).toBeUndefined();
    expect(r.profile.labelLengthMm).toBeUndefined();
  });

  it('reads one named dimension either way round', () => {
    const a = parseApplication('We run a 100mm wide label on that line.');
    expect(a.profile.labelWidthMm).toBe(100);

    const b = parseApplication('The label is 6 inches wide.');
    expect(b.profile.labelWidthMm).toBeCloseTo(152.4, 1);
  });

  it('says where it read it from', () => {
    // Every parsed field carries its evidence, so a rep can see what the tool read
    // rather than being told a number appeared.
    const r = parseApplication('We apply 4 x 6 inch labels.');
    expect(r.evidence.labelWidthMm).toMatch(/4/);
    expect(r.evidence.labelLengthMm).toMatch(/6/);
  });

  it('takes millimetres as millimetres', () => {
    const r = parseApplication('100 x 150 mm labels, 30 a minute.');
    expect(r.profile.labelWidthMm).toBe(100);
    expect(r.profile.labelLengthMm).toBe(150);
  });
});
