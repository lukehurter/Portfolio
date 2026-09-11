import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { mediaFor } from './media';
import { specsFor } from './specs';

/**
 * Every machine answers the same three questions.
 *
 * REPORTED: "the CIJ machines are in the right format concerning the website and
 * datasheet/spec, they have data in the app, a link to the site, and a link to the
 * datasheet / spec, the other machines do not have this same format."
 *
 * The audit behind this turned up something worth recording: only the 6400 had an
 * in-app specification. The 6440, 6420, 6410 and the four PLUS models had a page and
 * a datasheet and no figures — exactly the shape being complained about.
 *
 * The links are now uniform. The figures are not, and cannot honestly be: the capture
 * carries a specification table for 22 models and the 6400 series datasheet covers
 * four machines that differ from each other, which is what several fit rules turn on.
 */
const models = [...new Set(CATALOG
  .filter((i) => i.itemRole === 'printer' && i.model)
  .map((i) => i.model as string))];

/* There is no exception any more.
   Kestrel's engines were skipped in the first pass because nobody had checked their
   pages; told where to look, they are documented on the same terms as the rest. The
   set stays, empty, because the next machine somebody cannot document should have to
   be named here rather than quietly dropped from the assertions. */
const NO_VENDOR_DATA = new Set<string>();

describe('machine documentation', () => {
  it('gives every machine a product page', () => {
    for (const m of models) {
      if (NO_VENDOR_DATA.has(m)) continue;
      expect(mediaFor(m)?.page, m).toBeTruthy();
    }
  });

  it('gives every machine a link to its specification', () => {
    for (const m of models) {
      if (NO_VENDOR_DATA.has(m)) continue;
      const doc = mediaFor(m)?.docUrl;
      expect(doc, m).toBeTruthy();
      expect(doc, m).toMatch(/^https:\/\//);
    }
  });

  it('never links the product page and calls it a document', () => {
    /* REPORTED: "The TIJ datasheet link is taking me to the product page instead of
       the datasheet... Same issue with a lot of the datasheet links."

       Six models were doing this. It was never a typo — the August capture looked for
       hrefs ending in .pdf, and axim.example serves its documents through a module
       whose links end in an entry id, so the documents were not found and a product
       page was put in the slot as the nearest available thing. This assertion is the
       part that stays after the capture is fixed. */
    for (const m of models) {
      const media = mediaFor(m)!;
      expect(media.docUrl, m).not.toBe(media.page);
      expect(media.brochureUrl ?? null, m).not.toBe(media.page);
    }
  });

  it('says what each document is, so the link can be labelled', () => {
    /* A brochure is not a datasheet, and Kestrel publishes its specifications as a web
       page rather than a PDF. Calling all three "datasheet (PDF)" is how a rep sends a
       customer a brochure believing it was a spec. */
    for (const m of models) {
      const media = mediaFor(m)!;
      if (!media.docUrl) continue;
      expect(['datasheet', 'brochure', 'specification'], m).toContain(media.docKind);
      // Anything called a PDF has to be one. The site's own document module serves a
      // PDF from a URL ending in an entry id, so that counts; nothing else does.
      if (media.docKind !== 'specification') {
        expect(media.docUrl, m).toMatch(/\.pdf$|Download\.aspx\?EntryId=\d+/i);
      }
    }
  });

  it('prefers the datasheet over the brochure where a page has both', () => {
    /* The 6400 offered its brochure while its technical datasheet sat in the same
       list, because the chooser took the first thing matching a loose pattern. */
    const cij = mediaFor('6400')!;
    expect(cij.doc).toMatch(/technical datasheet/i);
    expect(cij.brochure).toMatch(/brochure/i);
    expect(cij.docUrl).not.toBe(cij.brochureUrl);
  });

  it('gives the thermal inkjet heads the document that was reported missing', () => {
    // The exact link from the report, for the exact machine in it.
    for (const m of ['HP 0.5"', 'HP 1.0"']) {
      const media = mediaFor(m)!;
      expect(media.docUrl, m).toMatch(/Download\.aspx\?EntryId=\d+/);
      expect(media.docKind, m).toBe('brochure');
      expect(media.specUrl, m).toContain('#lt-');
    }
    expect(mediaFor('HP 0.5"')!.docUrl).toContain('EntryId=1437');
  });

  it('names the document rather than just linking it', () => {
    for (const m of models) {
      if (NO_VENDOR_DATA.has(m)) continue;
      expect(mediaFor(m)?.doc, m).toBeTruthy();
    }
  });

  it('never offers the same link twice under two names', () => {
    /* A page can carry a deep link to its specification table AND a document that IS a
       specification; nothing does both today, and if something starts to, the links row
       would read "specifications ... specifications" and this should fail first. */
    for (const m of models) {
      const media = mediaFor(m)!;
      if (media.docKind !== 'specification') continue;
      expect(media.specUrl ?? null, m).toBeNull();
    }
  });

  it('has figures for the Palisade engines, from Palisade', () => {
    for (const m of ['PE311', 'PE321']) {
      const s = specsFor(m)!;
      expect(s, m).toBeTruthy();
      expect(Object.keys(s.specs).length).toBeGreaterThan(4);
      expect(s.page).toContain('palisade.example');
    }
  });

  it('has figures for every machine now', () => {
    // The first version of this asserted the opposite — that the 6440 had none —
    // because axim.example publishes no table for it. Corvus does, and Kestrel publishes
    // the NX engines, and the answer to "the data is available" was to go and get it.
    for (const m of models) expect(specsFor(m), m).toBeTruthy();
  });

  it(`keeps each model's figures its own`, () => {
    // The reason there were no figures for the 6440 is that the 6400's are not the
    // 6440's, and nothing here is carried across. The 6400 tops out at 574 fpm on a
    // single line and the 6440 at 1,791; a rule turns on that difference.
    const a = JSON.stringify(specsFor('6400')!.specs);
    const b = JSON.stringify(specsFor('6440')!.specs);
    expect(a).not.toBe(b);
    expect(specsFor('6440')!.specs['Ingress protection']).toContain('IP65');
  });
});
