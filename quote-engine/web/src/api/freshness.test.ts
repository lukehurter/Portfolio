import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';

/**
 * The freshness note has to be about the data, not about the seed.
 *
 * `asOf` was a fixed string — '2026-08-05T11:30:00Z'. It was accurate on the day it was
 * written and wrong on every day after, and by the time a production-readiness review
 * reached it the demo was announcing "Availability as of 8 days ago" beside every promise
 * date. The component was working perfectly: it was faithfully reporting a rotting
 * constant. A visitor cannot tell those two failures apart, and reads the product as
 * abandoned.
 *
 * Anything derived from the wall clock has to be derived from the wall clock, or it is a
 * timestamp that lies more each day it survives.
 */

const HOUR = 3600_000;

describe('the availability timestamp', () => {
  it('is never older than one refresh cycle, whenever the demo is opened', async () => {
    const p = await mockApi.getItemPromise('E608A393YRJ', 1);
    const ageHours = (Date.now() - new Date(p.asOf).getTime()) / HOUR;

    // One run a day: the oldest honest reading is just under 24 hours, taken in the
    // minutes before the next 05:30. Never negative — a refresh cannot be in the future.
    expect(ageHours).toBeGreaterThanOrEqual(0);
    expect(ageHours).toBeLessThan(24);
  });

  it('lands on the scheduled time, so the age it reports is the real one', async () => {
    const p = await mockApi.getItemPromise('E608A393YRJ', 1);
    const d = new Date(p.asOf);
    expect([d.getHours(), d.getMinutes()]).toEqual([5, 30]);
  });
});
