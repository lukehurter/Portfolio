import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from './appRules';
import { mockApi as api } from './mock';
import { EMPTY_PROFILE } from './types';
import type { ApplicationProfile, Rule } from './types';

/**
 * The rules written from the spec sheets and the product pages, against real items.
 *
 * A rule that cannot reach the thing it grades is decoration, and that is not a
 * theoretical worry here: fifteen laser rules were written and none of them could fire,
 * because a configured laser reported the wrong model. So each of these picks a real
 * catalogue item, describes a line, and checks that the rule the document supports is
 * the one that speaks.
 */

const rules = APPLICATION_RULES as Rule[];

/**
 * A quotable item of this model.
 *
 * Some of these models are not in the preview catalogue, and that is a fact about the
 * preview rather than about the rules. The catalogue is what the price pages quote, and
 * the CIJ price page enumerates only the 6400 family — the 5400's 944 hierarchy parts
 * have never appeared on one, so they sit in the 17,858 the preview leaves out. The
 * XL Series is absent for the same reason.
 *
 * In production those parts are quotable the moment Orbit carries a price. So where
 * the catalogue has the model the real item is used, and where it does not one is
 * registered with that model — which tests the claim being made either way: given a
 * 5400, does the rule written from its product page fire?
 */
async function itemOf(technology: string, model: string) {
  const items = await api.searchItems({ technology, role: 'printer', limit: 400 });
  const hit = items.find((i) => i.model === model);
  if (hit) return hit.itemNo;

  const made = await api.addConfiguredItem({
    itemNo: `TEST-${model.replace(/[^A-Za-z0-9]/g, '')}`,
    description: `${model} for coverage`,
    technologyCode: technology, listPrice: 20000, model,
  });
  return made.itemNo;
}

async function gradeFor(technology: string, itemNo: string, profile: Partial<ApplicationProfile>) {
  const ev = await api.evaluateDraft({
    technologyCode: technology, customerNo: null, customerName: 'Test Co', lineName: 'L1',
    profile: { ...EMPTY_PROFILE, ...profile },
    noConstraint: [], flags: {}, categoryDiscounts: {},
    lines: [{ itemNo, quantity: 1 }],
  } as never);
  const fit = ev.fit.find((f) => f.itemNo === itemNo);
  return { grade: fit?.grade, codes: (fit?.reasons ?? []).map((r) => r.ruleCode) };
}

describe('every rule cites something that exists', () => {
  it('names a real file for each citation', () => {
    // The generator enforces this too; asserted here so the guarantee is visible from
    // the test suite rather than only inside a build script.
    const uncited = rules.filter((r) => !r.sourceRef || !r.sourceRef.trim());
    expect(uncited.map((r) => r.ruleCode), 'a rule with no citation').toEqual([]);
  });

  it('names an author for each', () => {
    const anonymous = rules.filter((r) => !r.author || !r.author.trim());
    expect(anonymous.map((r) => r.ruleCode)).toEqual([]);
  });
});

describe('the 5400, which had no rules at all', () => {
  it('stops at its own speed ceiling, not the 6400 range’s', async () => {
    const item = await itemOf('CIJ', '5400');
    const over = await gradeFor('CIJ', item, { lineSpeedFpm: 1400 });
    expect(over.codes, '1,230 fpm is the published figure').toContain('A-CIJ-SPD-5400');

    const under = await gradeFor('CIJ', item, { lineSpeedFpm: 1000 });
    expect(under.codes).not.toContain('A-CIJ-SPD-5400');
  });

  it('prints taller than any 6400, and says so at 13.7 mm', async () => {
    const item = await itemOf('CIJ', '5400');
    const { codes } = await gradeFor('CIJ', item, { charHeightMm: 14 });
    expect(codes).toContain('A-CIJ-CHR-5400-MAX');
  });

  it('is the answer below the 6400 range’s 1.8 mm floor', async () => {
    const item = await itemOf('CIJ', '5400');
    const { codes } = await gradeFor('CIJ', item, { charHeightMm: 1.2 });
    expect(codes).toContain('A-CIJ-CHR-5400-MIN');
  });

  it('wants the IP65 version for washdown, and the Prism already is one', async () => {
    const plain = await itemOf('CIJ', '5400');
    const wash = await gradeFor('CIJ', plain, { environment: 'washdown' });
    expect(wash.codes).toContain('A-CIJ-IP-5400');

    const spectrum = await itemOf('CIJ', '5400 Prism');
    const ok = await gradeFor('CIJ', spectrum, { environment: 'washdown' });
    expect(ok.codes, 'the Prism is IP65 as standard').toContain('A-CIJ-IP-5400-OK');
  });

  it('flags condensation, which its humidity rating excludes', async () => {
    const item = await itemOf('CIJ', '5400');
    const { codes } = await gradeFor('CIJ', item, { environment: 'condensation or humidity' });
    expect(codes).toContain('A-CIJ-HUMID-5400');
  });
});

describe('a label has to fit the pack', () => {
  it('rules out print and apply where the clear area is under 12.7 mm', async () => {
    const item = await itemOf('PALM', 'PL6300/LS7100');
    const { grade, codes } = await gradeFor('PALM', item, { markingWindowMm: 8 });
    expect(codes, 'the smallest label either machine runs is half an inch')
      .toContain('A-PALM-LABEL-MIN');
    expect(grade).toBe('notRecommended');
  });

  it('leaves a pack with room alone', async () => {
    const item = await itemOf('PALM', 'PL6300/LS7100');
    const { codes } = await gradeFor('PALM', item, { markingWindowMm: 60 });
    expect(codes).not.toContain('A-PALM-LABEL-MIN');
  });
});

/**
 * The Plus series is not the standard series with a different name.
 *
 * Every 6400-family speed and character rule used to list the Plus models alongside
 * the standard ones and apply the standard sheet's figures to them. The Plus sheet
 * differs in both directions, so the tool was simultaneously too lax about speed and
 * too strict about character height — the second of which loses a quote the machine
 * could have won, quietly, with a NOT RECOMMENDED nobody would question.
 */
describe('the 6400 Plus series', () => {
  it('stops at 557 fpm where the standard 6400 reaches 574', async () => {
    const plus = await itemOf('CIJ', '6400PLUS');
    const std = await itemOf('CIJ', '6400');

    // 565 is between the two published figures.
    const onPlus = await gradeFor('CIJ', plus, { lineSpeedFpm: 565 });
    expect(onPlus.codes, 'the Plus sheet says 557').toContain('A-CIJ-PLUS-SPD-6400');

    const onStd = await gradeFor('CIJ', std, { lineSpeedFpm: 565 });
    expect(onStd.codes, 'the standard sheet says 574').not.toContain('A-CIJ-SPD-6400');
  });

  it('prints taller than the standard pair, and is no longer ruled out for it', async () => {
    const plus = await itemOf('CIJ', '6400PLUS');
    const std = await itemOf('CIJ', '6400');

    // 10 mm: inside the Plus range (to 10.7), past the standard one (8.6).
    const onPlus = await gradeFor('CIJ', plus, { charHeightMm: 10 });
    expect(onPlus.codes, 'the Plus prints to 10.7 mm').not.toContain('A-CIJ-CHR-6400');
    expect(onPlus.codes).not.toContain('A-CIJ-PLUS-CHR-6400');

    const onStd = await gradeFor('CIJ', std, { charHeightMm: 10 });
    expect(onStd.codes, 'the standard 6400 stops at 8.6 mm').toContain('A-CIJ-CHR-6400');
  });

  it('does not print as small as the standard series', async () => {
    const plus = await itemOf('CIJ', '6400PLUS');
    const { codes } = await gradeFor('CIJ', plus, { charHeightMm: 1.9 });
    expect(codes, 'the Plus starts at 2.1 mm').toContain('A-CIJ-PLUS-CHR-MIN');
  });

  it('is endorsed for carton coding, which the standard sheet does not publish', async () => {
    const plus = await itemOf('CIJ', '6440PLUS');
    const { codes } = await gradeFor('CIJ', plus, { substrate: 'corrugated case' });
    expect(codes).toContain('A-CIJ-PLUS-CARTON');
  });
});
