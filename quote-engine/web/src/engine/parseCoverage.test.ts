import { describe, expect, it } from 'vitest';
import { parseApplication } from './parseApplication';

/**
 * The phrasings the parser is expected to read, as a list somebody can review.
 *
 * A keyword parser is only ever as good as the phrasings someone thought of, so the
 * list of phrasings is the interesting artefact — more useful to read than the
 * regular expressions, and the only way to see coverage without measuring it.
 *
 * Every row here was written the way a customer writes it. Twelve of them used to
 * miss, and the consequence was not a blank field: an enquiry saying "washes down
 * nightly with a hose" graded every TTO printer GOOD FIT, because `A-TTO-IP20` needs
 * `environment` to contain washdown and nothing had put it there.
 *
 * Adding a row is how you ask for coverage. If it fails, the parser needs the
 * phrasing — not the test.
 */
const READS: [field: string, sentence: string, expected: unknown][] = [
  // -- environment, the field that rules a technology out entirely
  ['environment', 'The crew washes down nightly with a hose.', /washdown/],
  ['environment', 'This is a washdown environment.', /washdown/],
  ['environment', 'Line is sanitised with caustic every shift.', /washdown/],
  ['environment', 'The area is hosed out at the end of each shift.', /washdown/],
  ['environment', 'It runs in a dusty warehouse.', /particulate|dust/],
  ['environment', 'Goes straight into a blast freezer.', /refrigerated/],

  // -- temperature. 104F is the threshold in four rules.
  ['ambientTempMaxF', 'The room gets to 105F in summer.', 105],
  ['ambientTempMaxF', 'Ambient reaches 105 degrees F.', 105],
  ['ambientTempMaxF', 'Up to 105°F on the floor.', 105],
  ['ambientTempMaxF', 'ambient runs 105F near the oven', 105],
  ['ambientTempMaxF', 'The room runs at 41C.', 106],
  ['ambientTempMinF', 'Ambient 40 to 110F in that bay.', 40],
  ['ambientTempMinF', 'It goes down to 10F in the cold store.', 10],

  // -- the barcode requirement, which two rules turn on
  ['barcodeRequirements', 'Barcode has to grade C or better per the customer spec.', /grade c or better/i],
  ['barcodeRequirements', 'We need a GS1-128 shipping label.', /GS1/i],
  ['barcodeRequirements', 'Codes must be verified to an A grade.', /verif|grade/i],
  ['barcodeRequirements', 'They scan every case, so it has to be scannable.', /scannab/i],

  // -- speed and throughput are different questions and both are asked
  ['lineSpeedFpm', 'The line runs at 95 ft/min.', 95],
  ['lineSpeedFpm', 'It runs 620 feet per minute.', 620],
  ['lineSpeedFpm', 'Belt speed is 180 m/min.', 591],
  ['throughputPpm', 'We run 240 bags a minute.', 240],
  ['throughputPpm', 'Throughput is 240 ppm.', 240],
  ['throughputPpm', '120 cases per minute down the line.', 120],
  ['throughputPpm', 'About 90 pouches a minute.', 90],

  // -- the measurements, each claimed by the noun that governs it
  ['charHeightMm', 'Characters need to be about 8mm tall.', 8],
  ['charHeightMm', 'we print an 8mm best-before date code', 8],
  ['markingWindowMm', 'The print area is 60mm across.', 60],
  ['throwDistMm', 'The head would sit 12mm off the case.', 12],
  ['linesOfPrint', 'Three lines of print.', 3],

  // -- the product itself
  ['substrate', 'Printing onto corrugated cases.', /corrugated/i],
  ['substrate', 'HDPE bottles, natural.', /HDPE/i],
  ['porosity', 'Printing onto corrugated cases.', 'porous'],
  ['productWidthMm', 'Cases are 400mm wide by 600 long and 300 tall.', 400],
  ['productLengthMm', 'Cases are 400mm wide by 600 long and 300 tall.', 600],

  // -- the line
  ['guideRails', 'There are no guide rails on that conveyor.', 'no'],
  ['conveyor', 'They have an existing conveyor we can mount to.', 'existing'],
  ['productMotion', 'The product stops for the print.', 'stationary'],
  ['productMotion', 'We code it on the fly.', 'moving'],
  ['messageContent', 'Best-before date and a lot code.', /lot|date/i],

  // -- whether anybody has proved it works yet
  ['sampleTested', 'We can send samples for testing.', 'no'],
  ['sampleTested', 'Samples were tested on our machine last month.', 'yes'],
];

describe('what the parser reads', () => {
  it.each(READS)('%s ← "%s"', (field, sentence, expected) => {
    const got = (parseApplication(sentence).profile as Record<string, unknown>)[field];
    if (expected instanceof RegExp) expect(String(got ?? '')).toMatch(expected);
    else if (typeof expected === 'number') expect(got).toBeCloseTo(expected, 0);
    else expect(got).toBe(expected);
  });

  /**
   * "Down to 35F" is a floor, not a ceiling.
   *
   * Found by building a case for A-VIJ-TEMP-COLD and reading what the parser had made
   * of it: HOT matched "room", the gap swallowed "goes down to", and 35 landed in
   * ambientTempMaxF as well. A chilled room reported a maximum of 35F, which nobody
   * had said and which would silence every heat rule for the right reason by accident.
   */
  it('does not read a cold floor as a hot ceiling', () => {
    const r = parseApplication('Cases in a chilled room, down to 35F, label applied.');
    expect(r.profile.ambientTempMinF).toBe(35);
    expect(r.profile.ambientTempMaxF).toBeUndefined();

    // A range still sets both, because a range states both.
    const both = parseApplication('Ambient 40 to 110F in that bay.');
    expect(both.profile.ambientTempMinF).toBe(40);
    expect(both.profile.ambientTempMaxF).toBe(110);
  });

  /**
   * "No preference on throw distance" is an answer, not a blank. It has to reach
   * noConstraint or the rep is told the application is still missing something the
   * customer has already settled.
   */
  it('takes "no preference" as an answer', () => {
    expect(parseApplication('No preference on throw distance.').noConstraint)
      .toContain('throwDistMm');
    expect(parseApplication('No preference on throw distance.').profile.throwDistMm)
      .toBeUndefined();
  });
});
