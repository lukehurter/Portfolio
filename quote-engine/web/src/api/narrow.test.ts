import { describe, expect, it } from 'vitest';
import { mockApi as api } from './mock';
import { EMPTY_PROFILE } from './types';

/**
 * The application narrows what is offered.
 *
 * REPORTED: "it has non-porous and porous printers / inks when it should be porous
 * like the application. It has other colors of ink when it stated black."
 *
 * Both facts were in the profile and neither reached the suggestion. This is
 * narrowing, not grading — nothing is being said against the part, it simply is not
 * an answer to this application.
 */
const porousBlack = { ...EMPTY_PROFILE, porosity: 'porous' as const, inkType: 'black' };

describe('narrowing by the application', () => {
  it('offers no non-porous machine for a porous pack', async () => {
    const r = await api.suggestItems({ technologyCode: 'CIJ', profile: porousBlack, limit: 200 });
    const bad = r.items.filter((i) => /non-porous/i.test(JSON.stringify(i)));
    expect(bad).toEqual([]);
  });

  it('offers no colour the customer did not ask for', async () => {
    const r = await api.suggestItems({
      technologyCode: 'CIJ', profile: porousBlack, roles: ['ink', 'consumable'], limit: 200,
    });
    expect(r.items.length).toBeGreaterThan(0);
    const colours = new Set(r.items.map((i) => i.description));
    for (const d of colours) expect(d).not.toMatch(/\b(blue|yellow|red|green|purple|brown)\b/i);
  });

  it('keeps parts that say nothing about either', async () => {
    // A bracket has no Surface and no Color. Silence is not disagreement, and a
    // filter that dropped it would leave the rep with nothing to mount the head on.
    const r = await api.suggestItems({
      technologyCode: 'CIJ', profile: porousBlack, roles: ['accessory'], limit: 200,
    });
    expect(r.items.length).toBeGreaterThan(10);
  });

  it('narrows nothing when the application says nothing', async () => {
    const open = await api.suggestItems({
      technologyCode: 'CIJ', profile: EMPTY_PROFILE, roles: ['ink'], limit: 200 });
    const narrowed = await api.suggestItems({
      technologyCode: 'CIJ', profile: porousBlack, roles: ['ink'], limit: 200 });
    expect(open.total).toBeGreaterThan(narrowed.total);
  });
});
