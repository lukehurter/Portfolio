import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { mediaFor } from './media';

/**
 * The Palisade print engines have a picture and a datasheet.
 *
 * REPORTED: "you are missing pictures for the PALISADE engines in PALM, they are the
 * PTR,ZE... in the part descriptions." They were never going to appear in a capture of
 * axim.example — a PE311 is a Palisade engine that goes inside a Axim applicator, so
 * Axim publishes the applicator and Palisade publishes the engine.
 */
describe('the Palisade engines', () => {
  const engines = CATALOG.filter((i) => /^PTR,\s*PE/i.test(i.description));

  it('are in the catalogue as machines', () => {
    expect(engines.length).toBeGreaterThan(0);
    for (const e of engines) expect(e.itemRole).toBe('printer');
  });

  it('every one of them has a photograph now', () => {
    for (const e of engines) {
      const m = mediaFor(e.model);
      expect(m, e.itemNo).toBeTruthy();
      expect(m!.thumb, e.itemNo).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(m!.hero, e.itemNo).toMatch(/^data:image\/svg\+xml;base64,/);
    }
  });

  it('points at Palisade for the page and the datasheet', () => {
    // Not axim.example: the citation has to be the site that actually publishes it.
    for (const model of ['PE311', 'PE321']) {
      const m = mediaFor(model)!;
      expect(m.page).toContain('palisade.example');
      expect(m.docUrl).toContain('palisade.example');
      expect(m.docUrl).toMatch(/\.pdf$/);
      expect(m.doc).toBeTruthy();
    }
  });

  it('documents the Kestrel engines from Kestrel', () => {
    // They were skipped in the first pass because nobody had checked their pages.
    // Documented now, and pointed at kestrel.example rather than at Palisade — a
    // borrowed link is a wrong link on a quote.
    for (const model of ['K84X', 'K86X']) {
      const m = mediaFor(model)!;
      expect(m.page, model).toContain('kestrel.example');
      expect(m.docUrl, model).toContain('kestrel.example');
      expect(m.thumb, model).toMatch(/^data:image\/svg\+xml;base64,/);
    }
  });
});
