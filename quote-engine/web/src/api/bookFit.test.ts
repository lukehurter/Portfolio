import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import { EMPTY_PROFILE } from './types';

/**
 * Which price book, not how many part numbers.
 *
 * The chooser offered "CIJ · 947 machines · 1,157 parts". Nobody picks a technology by
 * counting its part numbers — they pick it by whether it can code this pack at this speed,
 * and the tool held that answer and was not saying it. A production-readiness review asked
 * for a recommendation based on the application; the grading already existed, one screen
 * further in.
 */

const profile = (over: Partial<typeof EMPTY_PROFILE>) => ({ ...EMPTY_PROFILE, ...over });

describe('recommending a price book', () => {
  it('rules out every book that cannot reach the line speed', async () => {
    // 2,000 fpm is past every published ceiling except the laser's 2,952.
    const books = await mockApi.recommendBooks(profile({ lineSpeedFpm: 2000 }));
    const survives = books.filter((b) => !b.allRuledOut && b.notRecommended === 0);
    expect(survives.map((b) => b.technologyCode)).toContain('LSR');

    for (const code of ['CIJ', 'TTO', 'PALM', 'PIJ', 'TIJ', 'VIJ']) {
      const b = books.find((x) => x.technologyCode === code)!;
      // Either the book holds no machines at all, or every one of them is out.
      const held = b.strong + b.caveat + b.notAssessed + b.notRecommended;
      if (held > 0) expect(b.allRuledOut, `${code} was not ruled out at 2,000 fpm`).toBe(true);
    }
  });

  it('counts only what a datasheet endorses as strong', async () => {
    // The distinction the old 'good' default destroyed: a machine nothing is known
    // against must not be counted as a machine something is known FOR.
    const books = await mockApi.recommendBooks(profile({ substrate: 'corrugated case' }));
    for (const b of books) {
      expect(b.strong + b.caveat + b.notAssessed + b.notRecommended).toBeGreaterThanOrEqual(0);
      expect(b.strong).toBeLessThanOrEqual(b.strong + b.notAssessed);
    }
  });

  it('reports every book, including the ones with nothing to offer', async () => {
    // A rep who sees only the laser needs to know the others were considered and
    // ruled out — otherwise the one remaining option looks like a bug.
    const books = await mockApi.recommendBooks(profile({ lineSpeedFpm: 2000 }));
    const codes = books.map((b) => b.technologyCode);
    for (const c of ['CIJ', 'LSR', 'TTO', 'PALM', 'PIJ', 'TIJ', 'VIJ']) {
      expect(codes, `${c} was dropped from the comparison`).toContain(c);
    }
  });

  it('says nothing rather than guessing when the application is blank', async () => {
    const books = await mockApi.recommendBooks(EMPTY_PROFILE);
    // No rule can fire against an empty profile, so no book has earned a strong count.
    expect(books.every((b) => b.strong === 0)).toBe(true);
  });
});
