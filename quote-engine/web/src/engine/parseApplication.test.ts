import { describe, expect, it } from 'vitest';
import { SUBSTRATE_NAMES, parseApplication, missingKeyFields } from './parseApplication';
import { EMPTY_PROFILE, ENVIRONMENT_OPTIONS } from '../api/types';

/**
 * Real enquiry wording.
 *
 * The parser is only worth having if it copes with how people actually write, so
 * every case is phrased the way an email would be rather than the way a form
 * would be. Several were reported from use rather than imagined here, and those
 * are marked.
 */

const p = (s: string) => parseApplication(s);

describe('substrate', () => {
  it('does not read "pet food" as a PET bottle', () => {
    // REPORTED. /\bpet\b/ won on order alone and "bags" never got a say.
    const r = p('We print onto pet food bags, 12kg.');
    expect(r.profile.substrate).not.toBe('PET bottle');
    expect(r.profile.substrate).toBe('Polyethylene bag');
    expect(r.profile.porosity).toBe('nonPorous');
  });

  it('reads the packaging machine as the substrate when the enquiry names one', () => {
    // A VFFS line is film, whatever is going into the bag.
    const r = p('pet food on a VFFS line');
    expect(r.profile.substrate).toBe('Flow-wrap film');
    expect(r.profile.porosity).toBe('nonPorous');
  });

  it('still reads a real PET bottle', () => {
    expect(p('500ml PET bottles').profile.substrate).toBe('PET bottle');
    expect(p('polyethylene terephthalate preforms').profile.substrate).toBe('PET bottle');
  });

  it('weighs competing signals rather than taking the first', () => {
    expect(p('dark corrugated cases').profile.substrate).toBe('Dark corrugated');
    expect(p('plain corrugated cases').profile.substrate).toBe('Corrugated case');
    expect(p('shrink wrapped trays').profile.substrate).toBe('Shrink film');
    expect(p('aluminium cans').profile.substrate).toBe('Aluminium can');
    expect(p('aluminium extrusion billets').profile.substrate).toBe('Extruded aluminium');
  });

  it('does not read a question opener as a material', () => {
    // REPORTED shape: a bare /\bcans?\b/ read "Can you quote..." as a metal can.
    const r = p('Can you send me a price please?');
    expect(r.profile.substrate).toBeUndefined();
    expect(r.filled).toBe(0);
  });

  it('takes an explicit porosity statement over the material default', () => {
    const r = p('coated corrugated, treat it as non-porous');
    expect(r.profile.porosity).toBe('nonPorous');
  });

  it('offers a substrate list the parser itself agrees with', () => {
    expect(SUBSTRATE_NAMES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(SUBSTRATE_NAMES).size).toBe(SUBSTRATE_NAMES.length);
    for (const name of SUBSTRATE_NAMES) expect(name.trim()).toBe(name);
  });
});

describe('numbers and units', () => {
  it('reads inches as inches, not millimetres', () => {
    // A throw read as 12mm when the customer said 12 inches is a different machine.
    expect(p('printhead sits 2 inches off the case').profile.throwDistMm).toBeCloseTo(50.8, 1);
    expect(p('1/2 inch characters').profile.charHeightMm).toBeCloseTo(12.7, 1);
    expect(p('10mm characters').profile.charHeightMm).toBe(10);
  });

  it('takes the top of a range, because sizing for the slow end is how a quote fails', () => {
    expect(p('running 300-450 fpm').profile.lineSpeedFpm).toBe(450);
    expect(p('up to 600 fpm').profile.lineSpeedFpm).toBe(600);
    expect(p('running 300-450 per minute').profile.throughputPpm).toBe(450);
  });

  it('reads line speed however feet per minute is written', () => {
    expect(p('450 fpm').profile.lineSpeedFpm).toBe(450);
    expect(p('runs at 380 ft/min').profile.lineSpeedFpm).toBe(380);
    expect(p('conveyor does 500 feet per minute').profile.lineSpeedFpm).toBe(500);
    expect(p('line speed 450').profile.lineSpeedFpm).toBe(450);
  });

  it('keeps products per minute out of the line speed field', () => {
    // A case count is not a distance. Every datasheet limit the fit rules grade
    // against is in FPM, so putting 120 cases/min in lineSpeedFpm made the engine
    // compare a throughput to a speed and pass lines it should have questioned.
    const cases = p('120 cases per minute');
    expect(cases.profile.throughputPpm).toBe(120);
    expect(cases.profile.lineSpeedFpm).toBeUndefined();

    const bare = p('about 300 a minute');
    expect(bare.profile.throughputPpm).toBe(300);
    expect(bare.profile.lineSpeedFpm).toBeUndefined();

    expect(p('240 ppm').profile.throughputPpm).toBe(240);
  });

  it('reads both figures when the enquiry gives both', () => {
    const r = p('belt runs 200 fpm carrying 90 cartons per minute');
    expect(r.profile.lineSpeedFpm).toBe(200);
    expect(r.profile.throughputPpm).toBe(90);
  });

  it('separates the room temperature from the pack temperature', () => {
    // The datasheets rate the machine against the room. A rule reading the pack
    // temperature would be citing a figure about something else entirely.
    const r = p('ambient 40 to 110F in that bay');
    expect(r.profile.ambientTempMinF).toBe(40);
    expect(r.profile.ambientTempMaxF).toBe(110);

    expect(p('ambient runs 105F near the oven').profile.ambientTempMaxF).toBe(105);
  });

  it('reads how much print is wanted', () => {
    expect(p('they want 3 lines of print').profile.linesOfPrint).toBe(3);
    expect(p('print on two lines').profile.linesOfPrint).toBe(2);
  });

  it('does not read a character count as a character height', () => {
    // REPORTED from the built preview. "up to 24 characters per line" set the
    // character height to 24mm — nearly an inch of type — and every machine was
    // then graded against it. A bare number before "characters" is a count.
    const r = p('Two lines of print, up to 24 characters per line. Characters around 8mm.');
    expect(r.profile.charHeightMm).toBe(8);

    expect(p('30 characters per line').profile.charHeightMm).toBeUndefined();
  });

  it('does not let "printhead" stand in for "print"', () => {
    // REPORTED from the built preview. "printhead would sit 5mm off the case"
    // set the character height to 5mm as well as the throw distance, because the
    // lead-in word "print" matched inside "printhead".
    const r = p('the printhead would sit 5mm off the case. Characters around 8mm.');
    expect(r.profile.throwDistMm).toBe(5);
    expect(r.profile.charHeightMm).toBe(8);
  });

  it('reads the marking window, which the print-height rules need', () => {
    expect(p('marking window is 45mm').profile.markingWindowMm).toBe(45);
    expect(p('print area of 2 inches').profile.markingWindowMm).toBeCloseTo(50.8, 1);
    // Not the same question as character height, and both can appear at once.
    const r = p('marking window is 100mm, characters 10mm');
    expect(r.profile.markingWindowMm).toBe(100);
    expect(r.profile.charHeightMm).toBe(10);
  });

  it('never reads a bare number as a length', () => {
    expect(p('does not say how tall the characters are').profile.charHeightMm).toBeUndefined();
  });
});

describe('the line itself', () => {
  it('reads the conveyor and whether the product is held in place', () => {
    expect(p('going onto a new conveyor').profile.conveyor).toBe('new');
    expect(p('fitting to their existing conveyor').profile.conveyor).toBe('existing');
    expect(p('guide rails already fitted').profile.guideRails).toBe('yes');
    expect(p('no guide rails on that line').profile.guideRails).toBe('no');
  });

  it('reads whether the product is moving or stopped', () => {
    expect(p('printing while stationary').profile.productMotion).toBe('stationary');
    expect(p('indexing conveyor').profile.productMotion).toBe('moving');
    expect(p('marks them on the move').profile.productMotion).toBe('moving');
  });
});

describe('environment vocabulary', () => {
  it('only ever produces values the picker offers', () => {
    // The substrate list once drifted from the patterns that fill it, so a parsed
    // value could not be selected by hand. The same must not happen here.
    const offered = new Set<string>(ENVIRONMENT_OPTIONS);
    const enquiry = 'Washdown daily, condensation on the packs, refrigerated store, '
      + 'open air building, food grade line, heavy corrugate dust, static problems, '
      + 'vibration in the conveyor, fans near the printhead, glue strands, '
      + 'high temperature by the oven, clean room next door, outdoors in the yard.';
    const found = (p(enquiry).profile.environment ?? '').split(',').map(s => s.trim()).filter(Boolean);
    expect(found.length).toBeGreaterThan(6);
    for (const value of found) expect(offered.has(value)).toBe(true);
  });
});

describe('negation', () => {
  it('does not set an environment the enquiry rules out', () => {
    expect(p('daily washdown').profile.environment).toContain('washdown');
    expect(p('no washdown in this area').profile.environment ?? '').not.toContain('washdown');
    expect(p('not a dusty plant').profile.environment ?? '').not.toContain('particulate');
  });
});

describe('no constraint', () => {
  it('separates "does not matter" from blank', () => {
    const r = p('Throw distance does not matter, we can mount anywhere.');
    expect(r.noConstraint).toContain('throwDistMm');
    expect(r.profile.throwDistMm).toBeUndefined();
  });

  it('keeps an unconstrained field out of "still needed"', () => {
    const r = p('Any line speed is fine.');
    expect(r.noConstraint).toContain('lineSpeedFpm');
    const missing = missingKeyFields({ ...EMPTY_PROFILE }, r.noConstraint);
    expect(missing).not.toContain('line speed');
    // A genuinely blank field is still chased.
    expect(missing).toContain('substrate');
  });

  it('does not let a stray number override "any"', () => {
    const r = p('Speed does not matter. Characters 8mm.');
    expect(r.noConstraint).toContain('lineSpeedFpm');
    expect(r.profile.lineSpeedFpm).toBeUndefined();
    expect(r.profile.charHeightMm).toBe(8);
  });
});

describe('which price book', () => {
  const tech = (s: string) => p(s).technologyCode;

  it('reads the technology from how the job is described', () => {
    expect(tech('we need a print and apply labeller for pallets')).toBe('PALM');
    expect(tech('looking at laser etching onto extruded profiles')).toBe('LSR');
    expect(tech('thermal transfer overprinting on a flow wrapper')).toBe('TTO');
    expect(tech('large character case printing, hi-res')).toBe('PIJ');
    expect(tech('thermal inkjet, cartridge based')).toBe('TIJ');
    expect(tech('valve jet onto sacks')).toBe('VIJ');
    expect(tech('small character date coding onto cases')).toBe('CIJ');
  });

  it('lets an explicit technology beat the generic description of the job', () => {
    // A laser or a labeller can put a date on a case too.
    expect(tech('laser date coding onto glass')).toBe('LSR');
    expect(tech('print and apply label with a date code')).toBe('PALM');
    expect(tech('ribbon overprint of the best before date')).toBe('TTO');
  });

  it('says nothing when the enquiry says nothing', () => {
    expect(tech('Can you quote for our new line please')).toBeNull();
  });
});

describe('the machine and the parts an enquiry names', () => {
  it('picks up a model so the machine list can be narrowed', () => {
    expect(p("we're looking at an 6420").machineHint).toBe('6420');
    expect(p('quote an LB5200 please').machineHint).toBe('LB5200');
    expect(p('a Corvus 5400 would suit').machineHint).toBe('5400');
    expect(p('no model mentioned').machineHint).toBeNull();
  });

  it('lists parts asked for by name, without adding any', () => {
    const r = p('We will need a stand, a photocell and guide rails, plus make-up fluid.');
    expect(r.mentions.map((m) => m.query).sort())
      .toEqual(['guide rail', 'make-up', 'photocell', 'stand']);
    for (const m of r.mentions) expect(m.words).toBeTruthy();
  });

  it('does not offer a part the enquiry rules out', () => {
    const r = p('No stand needed, it goes on the existing conveyor.');
    expect(r.mentions.map((m) => m.query)).not.toContain('stand');
    expect(r.mentions.map((m) => m.query)).toContain('conveyor');
  });

  it('does not repeat a part mentioned twice', () => {
    const r = p('a stand, and another stand for the second line');
    expect(r.mentions.filter((m) => m.query === 'stand')).toHaveLength(1);
  });
});

describe('a whole enquiry', () => {
  it('reads an email end to end and shows its working', () => {
    const r = p(
      "Hi Dan,\n\nWe're adding coding to a new line. Best before date and lot code onto "
      + 'dark corrugated cases, running 300-380 a minute. Fairly dusty plant, two shifts. '
      + 'Characters need to be around 8mm so they read from the aisle. Printhead would sit '
      + 'roughly 14mm off the case. Small character CIJ is what we have elsewhere.'
      + '\n\nThanks, Maria',
    );
    expect(r.technologyCode).toBe('CIJ');
    expect(r.profile.substrate).toBe('Dark corrugated');
    expect(r.profile.porosity).toBe('porous');
    // "300-380 a minute" is a count of cases, not a distance, so it is throughput.
    // Line speed stays blank and shows up in "still needed", which is the honest
    // outcome: nobody in this email said how fast the belt moves.
    expect(r.profile.throughputPpm).toBe(380);
    expect(r.profile.lineSpeedFpm).toBeUndefined();
    expect(r.profile.charHeightMm).toBe(8);
    expect(r.profile.throwDistMm).toBe(14);
    expect(r.profile.environment).toContain('high particulate or dust');
    expect(r.profile.messageContent).toContain('best-before');
    expect(r.profile.messageContent).toContain('lot');
    for (const k of Object.keys(r.profile)) expect(r.evidence[k as never]).toBeTruthy();
  });

  it('is safe on empty input', () => {
    for (const s of ['', '   ', '\n\n']) {
      const r = p(s);
      expect(r.filled).toBe(0);
      expect(r.technologyCode).toBeNull();
      expect(r.mentions).toEqual([]);
      expect(r.noConstraint).toEqual([]);
    }
  });
});

/**
 * The whole enquiry, read at once.
 *
 * REPORTED. This is the message a rep pasted in, verbatim, and the parser dropped
 * four of its facts on the floor and chose no price book. Each of the cases below
 * is one of those, and this one is all of them together — because the failure was
 * not any single pattern, it was that a sentence a customer would call complete
 * came back half read.
 */
describe('a complete enquiry', () => {
  const MSG = 'We need to code date and lot onto corrugated cases, about 300 a minute, '
    + 'dusty plant, two shifts, 5mm characters, 40 feet per minute, about 6 inches apart. '
    + 'The cases are 12x8x6 inches. Product is at room temperature, existing conveyor. '
    + 'We want black ink.';

  it('reads every fact in it', () => {
    const r = p(MSG);
    expect(r.profile).toMatchObject({
      substrate: 'Corrugated case', porosity: 'porous',
      lineSpeedFpm: 40, throughputPpm: 300, charHeightMm: 5,
      productLengthMm: 304.8, productWidthMm: 203.2,
      productSpacingMm: 152.4, productTempF: 70, inkType: 'black',
      conveyor: 'existing',
    });
    expect(r.profile.messageContent).toContain('date code');
    expect(r.profile.messageContent).toContain('lot or batch code');
    expect(r.profile.environment).toContain('high particulate or dust');
  });

  it('chooses a price book from the job rather than needing the technology named', () => {
    // "code date and lot onto cases" is a small-character job stated the way the
    // trade states it. It used to pick nothing at all.
    expect(p(MSG).technologyCode).toBe('CIJ');
  });
});

describe('product dimensions', () => {
  it('reads the compact form a box is actually written in', () => {
    const r = p('The cases are 12x8x6 inches.');
    expect(r.profile.productLengthMm).toBe(304.8);
    expect(r.profile.productWidthMm).toBe(203.2);
  });

  it('says which figure it took for which, because the order is a convention', () => {
    expect(r_evidence('The cases are 12x8x6 inches.', 'productWidthMm'))
      .toContain('length × width');
  });

  it('takes the unit from wherever it was stated', () => {
    expect(p('cartons 300 x 200 x 150 mm').profile.productLengthMm).toBe(300);
    expect(p('boxes 12" x 8" x 6"').profile.productWidthMm).toBe(203.2);
  });

  it('does not read three numbers that are not a product', () => {
    expect(p('quote 12x8x6 please').profile.productLengthMm).toBeUndefined();
  });

  it('leaves a named dimension alone', () => {
    // The explicit form is the better evidence; the compact form only fills gaps.
    const r = p('cases are 400mm wide, and they are 12x8x6 inches');
    expect(r.profile.productWidthMm).toBe(400);
  });
});

describe('product spacing', () => {
  it('reads the gap between packs', () => {
    expect(p('cases about 6 inches apart').profile.productSpacingMm).toBe(152.4);
    expect(p('spacing of 150mm').profile.productSpacingMm).toBe(150);
    expect(p('on 12 inch centres').profile.productSpacingMm).toBe(304.8);
  });

  it('does not take the head-to-product gap as the pack gap', () => {
    // "10mm gap" is the throw distance and has been read as one for longer than
    // this field has existed.
    const r = p('printhead sits with a 10mm gap');
    expect(r.profile.productSpacingMm).toBeUndefined();
    expect(r.profile.throwDistMm).toBe(10);
  });
});

describe('product temperature', () => {
  it('resolves room temperature and says that it resolved it', () => {
    const r = p('Product is at room temperature, existing conveyor.');
    expect(r.profile.productTempF).toBe(70);
    expect(r.evidence.productTempF).toContain('taken as 70');
  });

  it('reads a stated pack temperature', () => {
    expect(p('cases come off the oven at 180F').profile.productTempF).toBe(180);
    expect(p('the trays are 60C at the coder').profile.productTempF).toBe(140);
  });

  it('does not take the room temperature as the pack temperature', () => {
    const r = p('the room gets to 105F in summer');
    expect(r.profile.productTempF).toBeUndefined();
    expect(r.profile.ambientTempMaxF).toBe(105);
  });
});

describe('ink', () => {
  it('reads the colour', () => {
    expect(p('We want black ink.').profile.inkType).toBe('black');
    expect(p('ink should be white').profile.inkType).toBe('white');
  });

  it('reads the family without a colour', () => {
    expect(p('has to be MEK-free').profile.inkType).toBe('MEK-free');
  });

  it('reads both when both are stated', () => {
    expect(p('white pigmented ink please').profile.inkType).toBe('white, pigmented');
  });

  it('ignores a colour that is not the ink', () => {
    expect(p('dark corrugated cases on a white conveyor').profile.inkType).toBeUndefined();
  });
});

/** The evidence string for one field, for the tests that check the wording. */
function r_evidence(text: string, field: string): string {
  return (parseApplication(text).evidence as Record<string, string>)[field] ?? '';
}
