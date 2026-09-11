// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildQuestionnaire, parseQuestionnaire } from './questionnaire';

/**
 * The end-to-end check: fill the form a customer is sent, and read what it produces.
 *
 * The unit tests either side of this prove the writer emits HTML and the reader parses a
 * block. Neither proves that the script INSIDE the generated file produces a block the
 * reader understands — and that script is the one piece nothing else in the codebase
 * imports, type-checks or exercises. It ships as a string.
 *
 * So this loads the real generated document, fills it the way a customer would, runs its own
 * button, and hands the result to the importer.
 */

function open(html: string): Document {
  document.documentElement.innerHTML = html
    .replace(/^<!doctype html>/i, '')
    .replace(/<\/?html[^>]*>/gi, '');
  // jsdom does not run scripts injected via innerHTML, so the page's own script is
  // re-executed here exactly as written.
  for (const s of Array.from(document.querySelectorAll('script'))) {
    const fn = new Function(s.textContent ?? '');
    fn.call(window);
  }
  return document;
}

describe('a customer filling the form', () => {
  it('produces answers the tool reads back', () => {
    const doc = open(buildQuestionnaire({ quoteNo: 'Q-2026-0731', customerName: 'Midwest Foods' }));

    (doc.querySelector('[data-key="substrate"]') as HTMLInputElement).value = 'corrugated case';
    (doc.querySelector('[data-key="porosity"]') as HTMLSelectElement).value = 'porous';
    (doc.querySelector('[data-key="lineSpeedFpm"]') as HTMLInputElement).value = '300';
    (doc.querySelector('[data-key="linesOfPrint"]') as HTMLInputElement).value = '2';
    // Inches on the form; the block must carry millimetres.
    (doc.querySelector('[data-key="charHeightMm"]') as HTMLInputElement).value = '0.25';
    // A checkbox group.
    /* By value, not by position. This ticked checks[1] and meant "dusty"; the
       questionnaire now takes its options from ENVIRONMENT_OPTIONS, where position 1
       is condensation. A test that depends on the order of a list it does not own
       fails for a reason that has nothing to do with what it is testing. */
    const dusty = doc.querySelector(
      '[data-key="environment"] input[value="high particulate or dust"]');
    expect(dusty, 'the dusty option must exist to be ticked').toBeTruthy();
    (dusty as HTMLInputElement).checked = true;

    (doc.getElementById('show') as HTMLButtonElement).click();
    const emitted = (doc.getElementById('out') as HTMLTextAreaElement).value;

    const { profile, found, quoteNo } = parseQuestionnaire(emitted);
    expect(quoteNo).toBe('Q-2026-0731');
    expect(profile.substrate).toBe('corrugated case');
    expect(profile.porosity).toBe('porous');
    expect(profile.lineSpeedFpm).toBe(300);
    expect(profile.linesOfPrint).toBe(2);
    // 0.25in = 6.35mm, rounded to one decimal by the form.
    expect(profile.charHeightMm).toBeCloseTo(6.4, 1);
    expect(profile.environment).toContain('dust');
    // Untouched fields stay out of it entirely.
    expect(found).not.toContain('throwDistMm');
    expect('throwDistMm' in profile).toBe(false);
  });

  it('emits nothing but the markers when the customer answers nothing', () => {
    const doc = open(buildQuestionnaire({}));
    (doc.getElementById('show') as HTMLButtonElement).click();
    const emitted = (doc.getElementById('out') as HTMLTextAreaElement).value;
    const { found } = parseQuestionnaire(emitted);
    expect(found).toEqual([]);
    // And it is still a well-formed block rather than an empty string, so a rep who
    // gets it back can tell the difference between "answered nothing" and "form broke".
    expect(emitted).toMatch(/AXIM APPLICATION ANSWERS/);
  });
});
