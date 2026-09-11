import { describe, expect, it } from 'vitest';
import { ANNOUNCED, ANNOUNCED_SPECS, announcedFor } from './announced';
import { CATALOG } from './catalog';
import { specsFor } from './specs';

/**
 * Machines that exist and cannot be quoted.
 *
 * REPORTED: "Also you can add the corvus 9000 series. Here is the brochure / specs /
 * datasheet." The 9000 Series is real and no price page carries it, so it is here
 * rather than in the catalogue. These assertions are the ones that keep that honest:
 * an announced machine must have no part number anywhere, and must lose its entry the
 * moment it gets one.
 */
describe('announced machines', () => {
  it('belongs to a price book that exists', () => {
    // From the catalogue, which is where a price book comes from at all.
    const books = new Set(CATALOG.map((i) => i.technologyCode));
    for (const a of ANNOUNCED) expect(books, a.name).toContain(a.technologyCode);
  });

  it('is not in the catalogue — that is the whole point', () => {
    /* If a part number turns up for one of these, the announcement is stale: the
       machine is quotable and this entry should be deleted rather than shown
       alongside its own orderable rows. */
    const quotable = new Set(CATALOG.map((i) => i.model).filter(Boolean));
    for (const a of ANNOUNCED) {
      for (const m of a.models) {
        expect(quotable.has(m), `${m} is now in the catalogue — drop it from announced-machines.json`)
          .toBe(false);
      }
    }
  });

  it('gives every model its figures', () => {
    for (const a of ANNOUNCED) {
      for (const m of a.models) {
        const s = specsFor(m);
        expect(s, m).toBeTruthy();
        expect(Object.keys(s!.specs).length, m).toBeGreaterThan(6);
        // Named, so a figure can be checked against the document it came from.
        expect(s!.page, m).toMatch(/^.+ — https:\/\//);
      }
    }
  });

  it('says why it cannot be quoted, rather than looking broken', () => {
    for (const a of ANNOUNCED) {
      expect(a.whyNotQuotable.length, a.name).toBeGreaterThan(20);
      expect(a.summary.length, a.name).toBeGreaterThan(20);
      expect(a.page, a.name).toMatch(/^https:\/\//);
    }
  });

  it('links documents that are documents', () => {
    for (const a of ANNOUNCED) {
      expect(a.documents.length, a.name).toBeGreaterThan(0);
      for (const d of a.documents) {
        expect(d.url, d.name).toMatch(/^https:\/\//);
        expect(d.url, d.name).not.toBe(a.page);
        if (d.kind !== 'specification') expect(d.url, d.name).toMatch(/\.pdf$/i);
      }
    }
  });

  it.skipIf(ANNOUNCED.length === 0)(
    'converts m/s to fpm correctly, because nobody checks a number by eye', () => {
    /* Every speed is written "2.83 m/s / 557 fpm (Standard)". The metres are transcribed
       and the feet are computed, so a mismatch means the transcription was edited by
       hand — which is how a quote ends up promising a line speed the machine does not
       reach. */
    let checked = 0;
    for (const specs of Object.values(ANNOUNCED_SPECS)) {
      for (const value of Object.values(specs.specs)) {
        for (const [, ms, fpm] of value.matchAll(/([\d.]+) m\/s \/ ([\d,]+) fpm/g)) {
          const expected = Math.round(Number(ms) * 196.8503937);
          expect(Number(fpm.replace(/,/g, '')), `${ms} m/s`).toBe(expected);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('keeps each 9000-series model its own', () => {
    /* The brochure's table merges cells across models and the columns were resolved by
       measuring, not by reading order. These four are the ones a merge error would
       flatten: the 7340s are IP65 and the rest IP55, and only the Prism runs hard
       pigmented ink. */
    expect(specsFor('7300')!.specs['Ingress protection']).toBe('IP55');
    expect(specsFor('7320')!.specs['Ingress protection']).toBe('IP55');
    expect(specsFor('7340')!.specs['Ingress protection']).toBe('IP65');
    expect(specsFor('7340 Prism')!.specs['Ink range']).toMatch(/hard pigmented/i);
    expect(specsFor('7300')!.specs['Lines of print']).toBe('Up to 3');
    expect(specsFor('7340')!.specs['Lines of print']).toBe('Up to 6');
  });

  it('is found by the book a rep is working in', () => {
    for (const a of ANNOUNCED) {
      expect(announcedFor(a.technologyCode).map((x) => x.name)).toContain(a.name);
    }
    expect(announcedFor('NOSUCHBOOK')).toHaveLength(0);
    expect(announcedFor(null)).toHaveLength(0);
  });

  it('is empty, and that is the healthy state', () => {
    /* The Corvus 9000 Series lived here from 20 to 21 August, between its brochure
       arriving and its price page arriving. The register earned its keep in that day
       and is supposed to be empty the rest of the time — a machine belongs here only
       while it is real and unpriceable.

       Kept rather than deleted because the next announcement will need it, and
       because the machinery around it is what made the handover clean: the test that
       an announced model must not be in the catalogue is what said "the price page
       has landed, retire this". */
    expect(ANNOUNCED.length, 'something is announced — check it is still unpriceable')
      .toBe(0);
  });
});
