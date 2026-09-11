import { describe, expect, it } from 'vitest';
import { mediaFor } from '../api/media';
import { MODEL_PHOTOS } from '../api/photos';

/**
 * The instrument's own devices, present and wired.
 *
 * `.readout` — the class the whole visual world is named after — was declared with the
 * design system and then called by nothing: every screen reached for `.readout-sm`
 * instead, and the app read flat because it had quietly opted out of its own strongest
 * move. These cover the half of that work which is data rather than CSS.
 */

describe('machine photography', () => {
  it('carries a hero size, not only a 96px thumbnail', () => {
    const models = Object.keys(MODEL_PHOTOS);
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      const m = MODEL_PHOTOS[model];
      expect(m.thumb.startsWith('data:image/svg+xml;base64,'), `${model} thumb`).toBe(true);
      expect(m.hero?.startsWith('data:image/svg+xml;base64,'), `${model} hero`).toBe(true);
      // A hero no bigger than the thumbnail is a thumbnail with a longer name.
      expect(m.hero.length, `${model} hero is not larger than its thumb`)
        .toBeGreaterThan(m.thumb.length * 1.5);
    }
  });

  it('reaches the screen through mediaFor', () => {
    const model = Object.keys(MODEL_PHOTOS)[0];
    expect(mediaFor(model)?.hero).toBeTruthy();
  });

  it('stays absent for a model whose only image is a captured web page', () => {
    // Enlarging one is a screenshot of a screenshot. Those keep the thumbnail, and the
    // well states the absence rather than stretching what it has.
    for (const model of ['5400', '6400']) {
      if (MODEL_PHOTOS[model]) continue;
      expect(mediaFor(model)?.hero, `${model} should have no hero`).toBeUndefined();
    }
  });
});
