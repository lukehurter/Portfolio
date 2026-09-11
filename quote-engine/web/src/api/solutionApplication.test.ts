import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import { draftFromQuote } from './draft';
import { CATALOG } from './catalog';
import { SECTIONS } from './questionnaire';
import { EMPTY_PROFILE, type Solution } from './types';

/**
 * Each solution has the whole application, inheriting from the quote's.
 *
 * This was a curated list of fourteen questions a second station was allowed to differ
 * on. Asked why not just duplicate the application, and checking the split settled it
 * against me: a coder marks the BOTTLE and an applicator labels the shipping CASE, so
 * product width, length, temperature and motion are not facts about the line — and I had
 * classified all four as line-level, forcing both stations to share one pack size.
 *
 * There is no list now. Every question can be answered per solution, and a field nobody
 * touches stays LINKED to the quote's answer rather than being copied from it — which is
 * what a straight duplicate would do, and how a quote ends up with two line speeds for
 * one conveyor.
 *
 * Stations are identified by id, not by price book. A book could not tell two CIJ
 * coders apart, so the second had nowhere to put its answers.
 */

const machineOf = (tech: string, model?: string) =>
  CATALOG.find((i) => i.technologyCode === tech && i.isActive
    && (i.itemRole === 'printer' || i.itemRole === 'printhead')
    && (!model || i.model === model))!;

async function fitOf(lines: { itemNo: string; quantity: number; solutionId?: string }[],
                     profile: object, solutions: Solution[] = []) {
  return mockApi.evaluateDraft({
    technologyCode: 'CIJ', customerNo: null, customerName: 'Two Stations Co',
    lineName: 'Line 1', noConstraint: [], flags: {}, categoryDiscounts: {},
    profile: { ...EMPTY_PROFILE, ...profile },
    solutions,
    lines,
  } as never);
}

/** Matched on the station too: one item at two stations is two assessments. */
const codesFor = (ev: Awaited<ReturnType<typeof fitOf>>, itemNo: string,
                  solutionId?: string) =>
  (ev.fit.find((f) => f.itemNo === itemNo
    && (solutionId === undefined || f.solutionId === solutionId))?.reasons ?? [])
    .map((r) => r.ruleCode);

const station = (id: string, technologyCode: string, profile?: object): Solution =>
  ({ id, name: null, technologyCode, ...(profile ? { profile } : {}) } as Solution);

describe('the application at a station', () => {
  it('offers every question the quote asks, not a chosen few', () => {
    /* The point of the rebuild. The four I had wrong are the ones this asserts hardest:
       a coder on the bottle and an applicator on the case are marking different objects,
       so the pack is not a fact about the line. */
    const asked = SECTIONS.flatMap((s) => s.questions.map((q) => String(q.key)));
    for (const f of ['productWidthMm', 'productLengthMm', 'productTempF', 'productMotion',
                     'lineSpeedFpm', 'charHeightMm', 'substrate', 'printQuality']) {
      expect(asked, `${f} is not offered per solution`).toContain(f);
    }
    expect(asked.length).toBeGreaterThanOrEqual(20);
  });

  it('grades a station on its own answer', async () => {
    /* A-CIJ-CHR-6400 cautions past 8.64 mm. The first solution says 3; the CIJ station
       says 12 and is the only one that changes. */
    const cij = machineOf('CIJ', '6400'), tto = machineOf('TTO');
    const lines = [{ itemNo: cij.itemNo, quantity: 1, solutionId: 's1' },
                   { itemNo: tto.itemNo, quantity: 1, solutionId: 's2' }];

    const shared = await fitOf(lines, { charHeightMm: 3 },
      [station('s1', 'CIJ'), station('s2', 'TTO')]);
    const own = await fitOf(lines, { charHeightMm: 3 },
      [station('s1', 'CIJ', { charHeightMm: 12 }), station('s2', 'TTO')]);

    expect(codesFor(shared, cij.itemNo)).not.toContain('A-CIJ-CHR-6400');
    expect(codesFor(own, cij.itemNo), 'the station answer never reached a rule')
      .toContain('A-CIJ-CHR-6400');
    expect(codesFor(own, tto.itemNo)).toEqual(codesFor(shared, tto.itemNo));
  });

  it('stays linked rather than copied, so the first solution still drives it', async () => {
    /* The difference from duplicating. A station that has answered ONE question still
       follows the quote on every other — change the quote's character height and the
       station follows, because it never held a copy. */
    const cij = machineOf('CIJ', '6400');
    const lines = [{ itemNo: cij.itemNo, quantity: 1, solutionId: 's1' }];
    // Something else entirely, so the character height is still the quote's.
    const own = [station('s1', 'CIJ', { substrate: 'white film' })];

    const quiet = await fitOf(lines, { charHeightMm: 3 }, own);
    const loud = await fitOf(lines, { charHeightMm: 12 }, own);

    expect(codesFor(quiet, cij.itemNo)).not.toContain('A-CIJ-CHR-6400');
    expect(codesFor(loud, cij.itemNo), 'the station stopped following the quote')
      .toContain('A-CIJ-CHR-6400');
  });

  it('lets a station stop following, and start again', async () => {
    const cij = machineOf('CIJ', '6400');
    const lines = [{ itemNo: cij.itemNo, quantity: 1, solutionId: 's1' }];
    const line = { charHeightMm: 12 };                    // past the caveat

    const following = await fitOf(lines, line, [station('s1', 'CIJ')]);
    const ownAnswer = await fitOf(lines, line,
      [station('s1', 'CIJ', { charHeightMm: 3 })]);
    const backAgain = await fitOf(lines, line, [station('s1', 'CIJ', {})]);

    expect(codesFor(following, cij.itemNo)).toContain('A-CIJ-CHR-6400');
    expect(codesFor(ownAnswer, cij.itemNo), 'its own answer did not take')
      .not.toContain('A-CIJ-CHR-6400');
    expect(codesFor(backAgain, cij.itemNo), 'clearing it did not restore the link')
      .toContain('A-CIJ-CHR-6400');
  });

  it('leaves an ordinary one-solution quote exactly as it was', async () => {
    const cij = machineOf('CIJ', '6400');
    const lines = [{ itemNo: cij.itemNo, quantity: 1, solutionId: 's1' }];
    const without = await fitOf(lines, { charHeightMm: 12 });
    const withEmpty = await fitOf(lines, { charHeightMm: 12 }, [station('s1', 'CIJ')]);
    expect(codesFor(withEmpty, cij.itemNo)).toEqual(codesFor(without, cij.itemNo));
  });

  it('grades two stations on one price book apart', async () => {
    /* The case the old model could not hold at all. A solution WAS a price book, so a
       quote for two production lines that both need a CIJ coder collapsed into one
       station with one application. Same machine, two stations, two answers. */
    const cij = machineOf('CIJ', '6400');
    const ev = await fitOf(
      [{ itemNo: cij.itemNo, quantity: 1, solutionId: 's1' },
       { itemNo: cij.itemNo, quantity: 1, solutionId: 's2' }],
      { charHeightMm: 3 },
      [station('s1', 'CIJ'), station('s2', 'CIJ', { charHeightMm: 12 })]);

    expect(ev.fit.filter((f) => f.itemNo === cij.itemNo),
      'one machine at two stations should be assessed twice').toHaveLength(2);
    expect(codesFor(ev, cij.itemNo, 's1')).not.toContain('A-CIJ-CHR-6400');
    expect(codesFor(ev, cij.itemNo, 's2'), 'the second station reused the first answer')
      .toContain('A-CIJ-CHR-6400');
  });

  it('survives a save and a reopen', async () => {
    const created = await mockApi.createQuote({
      technologyCode: 'CIJ', customerNo: null, customerName: 'Two Stations Co',
      lineName: 'Line 1', noConstraint: [], flags: {}, categoryDiscounts: {},
      profile: { ...EMPTY_PROFILE, charHeightMm: 3, productWidthMm: 60 },
      // The pack a case labeller sees is not the pack the coder sees.
      solutions: [station('s1', 'CIJ'),
                  station('s2', 'PALM', { productWidthMm: 400, productLengthMm: 600 })],
      lines: [],
    } as never);
    const reopened = await mockApi.getQuote(created.quoteNo);
    expect(reopened.solutions?.find((x) => x.id === 's2')?.profile?.productWidthMm,
      'the saved quote lost it').toBe(400);
    expect(draftFromQuote(reopened).solutions.find((x) => x.id === 's2')
      ?.profile?.productLengthMm, 'rebuilding the draft lost it').toBe(600);
  });
});
