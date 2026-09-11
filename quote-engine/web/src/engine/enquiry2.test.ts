import { describe, expect, it } from 'vitest';
import { parseApplication } from './parseApplication';

/**
 * The second complete enquiry, read at once.
 *
 * REPORTED, verbatim, after the first round of parser work: "it still did not pick up
 * on 12x8x6. It did not pick up guide rails or conveyor. It did not pick up product
 * temperature."
 *
 * All three had the same shape of cause — a pattern written around the way I had
 * phrased my own example rather than the way the sentence actually arrives:
 *
 *   · the dimensions had to sit within twenty characters of the word "cases", and
 *     here the product is named in one sentence and measured in the next;
 *   · "rails" had to be "guide rails";
 *   · a conveyor had to be called "existing" rather than described as already there;
 *   · "room temperature" had to have "product is at" in front of it.
 *
 * Which is the argument for keeping cases like this one whole rather than reducing
 * them to the field that failed.
 */
const p = (s: string) => parseApplication(s);

const MSG = 'We need to code date and lot onto corrugated cases. About 300 a minute, '
  + 'dusty plant, two shifts, 5mm characters, 12 x 8 x 6, about 3 inches apart, '
  + 'room temperature, 40 feet per minute, throw distance does not matter, black ink. '
  + 'It needs to integrate into our current line which has rails and conveyors already.';

describe('the second enquiry', () => {
  it('reads every fact in it', () => {
    expect(p(MSG).profile).toMatchObject({
      substrate: 'Corrugated case', porosity: 'porous',
      lineSpeedFpm: 40, throughputPpm: 300, charHeightMm: 5,
      productLengthMm: 304.8, productWidthMm: 203.2,
      productSpacingMm: 76.2, productTempF: 70, inkType: 'black',
      conveyor: 'existing', guideRails: 'yes',
    });
  });

  it('honours the shrug on throw distance', () => {
    expect(p(MSG).noConstraint).toContain('throwDistMm');
  });
});

describe('dimensions with no unit on them', () => {
  it('takes the unit from the pack-scaled figures, not the character height', () => {
    // 5 mm type and 3 inch spacing in one sentence is normal. The type size is the
    // one length in a message that says nothing about how the rest of it is written,
    // and taking the lead from it made a case twelve millimetres long.
    const r = p('corrugated cases, 5mm characters, 12 x 8 x 6, about 3 inches apart');
    expect(r.profile.productLengthMm).toBe(304.8);
    expect(r.evidence.productLengthMm).toContain('inches');
  });

  it('says the unit was inferred', () => {
    expect(p('cases 12 x 8 x 6, 3 inches apart').evidence.productLengthMm)
      .toContain('from the rest of the enquiry');
  });

  it('does not say so when the figures carried it', () => {
    expect(p('cases 300 x 200 x 150 mm').evidence.productLengthMm)
      .not.toContain('from the rest of the enquiry');
  });

  it('reads dimensions stated a sentence away from the product', () => {
    const r = p('We code corrugated cases. Two shifts, 12 x 8 x 6 inches.');
    expect(r.profile.productLengthMm).toBe(304.8);
    expect(r.profile.productWidthMm).toBe(203.2);
  });

  it('still ignores three numbers in a message with no product in it', () => {
    expect(p('please quote 12 x 8 x 6 by Friday').profile.productLengthMm).toBeUndefined();
  });
});

describe('the line it runs on', () => {
  it('reads a conveyor described as already there', () => {
    expect(p('integrate into our current line').profile.conveyor).toBe('existing');
    expect(p('we have conveyors already').profile.conveyor).toBe('existing');
    expect(p('the existing conveyor').profile.conveyor).toBe('existing');
  });

  it('still reads a new one as new', () => {
    expect(p('a new conveyor is part of the project').profile.conveyor).toBe('new');
  });

  it('reads bare rails', () => {
    // On a packaging line there is nothing else rails could be.
    expect(p('the line has rails and conveyors').profile.guideRails).toBe('yes');
    expect(p('guide rails hold it').profile.guideRails).toBe('yes');
  });

  it('still reads their absence', () => {
    expect(p('no guide rails, packs can wander').profile.guideRails).toBe('no');
  });
});

describe('room temperature', () => {
  it('reads it stated on its own in a list', () => {
    // The lookahead used to reject any digit within twelve characters, so the next
    // fact in the sentence killed it: "room temperature, 40 feet per minute".
    const r = p('dusty plant, room temperature, 40 feet per minute');
    expect(r.profile.productTempF).toBe(70);
    expect(r.evidence.productTempF).toContain('taken as 70');
  });

  it('still leaves the room to the ambient fields', () => {
    const r = p('room temperature is 95F on the floor in summer');
    expect(r.profile.productTempF).toBeUndefined();
    expect(r.profile.ambientTempMaxF).toBe(95);
  });
});
