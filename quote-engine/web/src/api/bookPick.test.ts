import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';
import { parseApplication } from '../engine/parseApplication';
import { EMPTY_PROFILE } from './types';

/**
 * Which price book, and on what evidence.
 *
 * REPORTED, against the sample enquiry the placeholder shows: "it is suggesting CIJ
 * when it has 0 good and 9 with caveats. VIJ says 8 good when there's only 4. So it
 * should be showing PIJ with 6 good. The logic for picking it is supposed to be the
 * tech with the most good options."
 *
 * Two separate faults. The counts disagreed with the lists they described, and the
 * parser's guess was pre-empting the grading entirely.
 */
const MSG = 'We need to code date and lot onto corrugated cases, about 300 a minute, '
  + 'dusty plant, two shifts. 5mm characters.';

const profileOf = (text: string) => {
  const r = parseApplication(text);
  return { r, profile: { ...EMPTY_PROFILE, ...r.profile } as never };
};

describe('the book recommendation', () => {
  it('counts what the machine list will actually offer', async () => {
    // VIJ has eight machines the rules endorse and four of them are non-porous, so on
    // a porous pack the list shows four. The book said eight.
    const { r, profile } = profileOf(MSG);
    const books = await api.recommendBooks(profile, r.noConstraint as never);
    for (const b of books) {
      const list = await api.suggestItems({
        technologyCode: b.technologyCode, profile, limit: 400 });
      const good = list.items.filter((i) => i.grade === 'good').length;
      expect(b.strong, `${b.technologyCode} good`).toBe(good);
      const caveat = list.items.filter((i) => i.grade === 'caveat').length;
      expect(b.caveat, `${b.technologyCode} caveat`).toBe(caveat);
    }
  });

  it('puts PIJ ahead of CIJ for this application', async () => {
    const { r, profile } = profileOf(MSG);
    const books = await api.recommendBooks(profile, r.noConstraint as never);
    const by = new Map(books.map((b) => [b.technologyCode, b]));
    expect(by.get('PIJ')!.strong).toBeGreaterThan(0);
    expect(by.get('CIJ')!.strong).toBe(0);
    // The rule the chooser applies: most good options wins, and a book with none is
    // not a candidate at all.
    const best = [...books].filter((b) => b.strong > 0)
      .sort((a, b) => b.strong - a.strong || a.notRecommended - b.notRecommended)[0];
    expect(best.technologyCode).toBe('PIJ');
  });

  it('does not let a job description outrank the grading', async () => {
    // "Code date and lot" scores for CIJ on a weak pattern. That is a job that tends
    // to be done that way, not the customer naming a technology.
    const { r } = profileOf(MSG);
    expect(r.technologyCode).toBe('CIJ');
    expect(r.technologyNamed).toBe(false);
  });

  it('still takes the technology when the enquiry names one', async () => {
    for (const [text, code] of [
      ['we want a laser coder', 'LSR'],
      ['print and apply labels onto cases', 'PALM'],
      ['a Corvus 6440 please', 'CIJ'],
      ['thermal transfer overprinter on the flow wrapper', 'TTO'],
    ] as const) {
      const r = parseApplication(text);
      expect(r.technologyCode, text).toBe(code);
      expect(r.technologyNamed, text).toBe(true);
    }
  });
});
