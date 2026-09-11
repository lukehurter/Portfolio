import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import { draftFromQuote } from './draft';
import { EMPTY_PROFILE, type PrintQuality } from './types';

/**
 * What the print has to be good enough for.
 *
 * Sixteen rules already reasoned about resolution and every one triggered on a proxy —
 * line speed, the barcode box, air at the printhead — because nothing in the application
 * said what the code was FOR. So each of them could describe the trade between
 * resolution and speed and none could come down on a side.
 *
 * The figures are in the machines' own specifications: the valve jets resolve 9 x 25 and
 * 8 x 25 DPI, the thermal jets 300 x 300. More than thirty times across the web, and the
 * only thing separating them on a quote was whether somebody had typed something into
 * the barcode box.
 */

const IV9 = '5760370';            // an IV9 valve jet printhead, if the catalogue has one
const HP = 'HP 0.5"';

async function grade(itemNo: string, printQuality: PrintQuality, over?: object) {
  const ev = await mockApi.evaluateDraft({
    technologyCode: 'VIJ', customerNo: null, customerName: 'Quality Co',
    lineName: 'Line 1', noConstraint: [], flags: {}, categoryDiscounts: {},
    profile: { ...EMPTY_PROFILE, printQuality, ...(over ?? {}) },
    lines: [{ itemNo, quantity: 1 }],
  } as never);
  return ev.fit.find((f) => f.itemNo === itemNo);
}

/** Any quotable machine of a given model, since part numbers move. */
async function machineOf(model: string) {
  const { CATALOG } = await import('./catalog');
  return CATALOG.find((i) => i.model === model
    && (i.itemRole === 'printer' || i.itemRole === 'printhead') && i.isActive);
}

describe('the print quality the application now asks for', () => {
  it('is carried through a save and a reopen', async () => {
    const created = await mockApi.createQuote({
      technologyCode: 'VIJ', customerNo: null, customerName: 'Quality Co',
      lineName: 'Line 1', noConstraint: [], flags: {}, categoryDiscounts: {},
      profile: { ...EMPTY_PROFILE, printQuality: 'graded' },
      lines: [],
    } as never);
    const reopened = await mockApi.getQuote(created.quoteNo);
    expect(reopened.profile?.printQuality, 'the saved quote lost it').toBe('graded');
    expect(draftFromQuote(reopened).profile.printQuality,
      'rebuilding the draft lost it').toBe('graded');
  });

  it('rules the valve jet out for a graded code or a logo', async () => {
    const m = await machineOf('IV9');
    expect(m, 'no IV9 in the catalogue to grade').toBeTruthy();
    for (const q of ['graded', 'graphics'] as PrintQuality[]) {
      const fit = await grade(m!.itemNo, q);
      expect(fit?.grade, q).toBe('notRecommended');
      expect(fit?.reasons.map((r) => r.ruleCode)).toContain('A-VIJ-QUALITY-GRAPHICS');
    }
  });

  it('cautions rather than refuses for a code that only has to scan', async () => {
    /* Valve jets do print scannable linear codes. Whether THIS one scans depends on the
       symbology, the X dimension and the substrate, none of which the datasheet
       settles — so this is a caveat, not a refusal. */
    const m = await machineOf('IV9');
    const fit = await grade(m!.itemNo, 'scannable');
    expect(fit?.grade).toBe('caveat');
    expect(fit?.reasons.map((r) => r.ruleCode)).toContain('A-VIJ-QUALITY-SCANNABLE');
  });

  it('says nothing to the valve jet about a code a person reads', async () => {
    const m = await machineOf('IV9');
    const fit = await grade(m!.itemNo, 'humanReadable');
    const codes = fit?.reasons.map((r) => r.ruleCode) ?? [];
    expect(codes).not.toContain('A-VIJ-QUALITY-GRAPHICS');
    expect(codes).not.toContain('A-VIJ-QUALITY-SCANNABLE');
  });

  it('leaves every valve jet alone when nobody has answered', async () => {
    /* Null is "not asked", not "a date code is fine". A rep who has not reached this
       question must not have machines graded as though they had. */
    const m = await machineOf('IV9');
    const ev = await mockApi.evaluateDraft({
      technologyCode: 'VIJ', customerNo: null, customerName: 'Quality Co',
      lineName: 'Line 1', noConstraint: [], flags: {}, categoryDiscounts: {},
      profile: { ...EMPTY_PROFILE },
      lines: [{ itemNo: m!.itemNo, quantity: 1 }],
    } as never);
    const codes = ev.fit.find((f) => f.itemNo === m!.itemNo)?.reasons
      .map((r) => r.ruleCode) ?? [];
    expect(codes.filter((c) => c.includes('QUALITY'))).toEqual([]);
  });

  it('every print-quality rule cites a resolution figure from a datasheet', async () => {
    const { APPLICATION_RULES } = await import('./appRules');
    const rules = APPLICATION_RULES.filter((r) => r.ruleCode.includes('-QUALITY-'));
    expect(rules.length).toBeGreaterThanOrEqual(4);
    for (const r of rules) {
      expect(r.sourceRef, `${r.ruleCode} cites nothing`).toBeTruthy();
      expect(r.detail, `${r.ruleCode} states no figure`).toMatch(/\d+\s*x\s*\d+\s*DPI|\d+\s*DPI/i);
    }
  });
});
