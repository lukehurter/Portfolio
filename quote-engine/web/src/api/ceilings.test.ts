import { describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from './appRules';
import { CATALOG } from './catalog';
import { specsFor } from './specs';
import type { Rule } from './types';

/**
 * No rule refuses below a figure the tool itself shows on the same screen.
 *
 * Two rules were doing exactly that, found one after the other:
 *
 *   A-TTO-BAR-107  refused a mark above 107 mm as past "the widest thermal bar
 *                  published in the T400 series". The document it cited states 160 mm
 *                  for the T406e and 213 mm for the T408 in the same table.
 *   A-CIJ-CHR-MAX  refused a character above 11.94 mm for the 6420 and 6440. The Corvus
 *                  datasheets for both state 1.8 to 20 mm, and the tool prints that
 *                  range in the specification panel beside the refusal.
 *
 * Both were written by reading one row of one document. Neither test suite noticed,
 * because a rule that refuses too early breaks nothing — it just quietly loses the
 * sale, and the only person who finds out is a rep who does not believe the tool.
 *
 * So: for every rule that REFUSES above a number, if the machines it names have a
 * published figure for that same quantity, the refusal may not sit below it. A caveat
 * is always allowed — saying "check the printhead" above a narrower figure from
 * another document is honest. A refusal is not.
 */

/**
 * Profile field -> the spec rows that state the same quantity, and how to read it.
 *
 * `units` is a list because half these documents are in inches and half in
 * millimetres, sometimes in the same table. The detector caught the CIJ character
 * height bug and missed the Thorne T400 one purely because the T400 sheet states
 * "2.1 x 3\" ... up to 8.4 x 6.1\"" and this only read mm — a detector that reads one
 * unit finds the bugs written in that unit, which is the worst kind of green.
 */
const MM_PER_INCH = 25.4;
const QUANTITY: Record<string, { rows: RegExp; units: { re: RegExp; scale: number }[] }> = {
  charHeightMm: {
    rows: /character height/i,
    units: [{ re: /([\d.]+)\s*mm/gi, scale: 1 },
            { re: /([\d.]+)\s*(?:"|inches|in\b)/gi, scale: MM_PER_INCH }],
  },
  markHeightMm: {
    rows: /character height|print area|thermal bar/i,
    units: [{ re: /([\d.]+)\s*mm/gi, scale: 1 },
            { re: /([\d.]+)\s*(?:"|inches|in\b)/gi, scale: MM_PER_INCH }],
  },
  lineSpeedFpm: {
    rows: /max speed|line speed|print speed/i,
    units: [{ re: /([\d,]+)\s*fpm/gi, scale: 1 },
            { re: /([\d,]+)\s*(?:ft\/min|feet per minute)/gi, scale: 1 }],
  },
};

/**
 * The biggest figure the spec table states for this quantity ON THIS MACHINE.
 *
 * Two refinements, each of which the first version got wrong and reported as a bug:
 *
 * QUALIFIER. The Ridgeline states "Print speed, text: up to 250 fpm" and "Print speed,
 * barcode: up to 150 fpm". A-PIJ-SPD-BARCODE refuses above 150 and is exactly right;
 * comparing it against the text row said it refused 100 fpm too early.
 *
 * MODEL. One spec cell often enumerates the whole range — "6400: up to 574 fpm
 * 6410/6420: up to 1,433 fpm 6440: up to 1,791 fpm". Taking the largest number in the
 * cell said the 6400's own 574 fpm refusal contradicted the 6440's figure.
 */
const QUALIFIERS = ['barcode', 'text'];

function published(model: string, field: string, rule: Rule):
    { max: number; min: number; row: string } | null {
  const q = QUANTITY[field];
  const specs = specsFor(model);
  if (!q || !specs) return null;

  const said = `${rule.summary} ${rule.detail ?? ''} `
    + rule.actions.map((a) => a.message ?? '').join(' ');
  const asks = QUALIFIERS.find((w) => new RegExp(`\\b${w}`, 'i').test(said));

  let best: { max: number; min: number; row: string } | null = null;
  for (const [key, text] of Object.entries(specs.specs)) {
    if (!q.rows.test(key)) continue;
    // A row qualified differently from the rule is a different quantity.
    const rowQualifier = QUALIFIERS.find((w) => new RegExp(`\\b${w}`, 'i').test(key));
    if (rowQualifier && asks && rowQualifier !== asks) continue;
    if (rowQualifier && !asks) continue;

    /* A cell that enumerates models answers only for the one being asked about.
       Split on the model names it mentions and keep the segment that names this
       machine; a cell that names no model answers for all of them. */
    const mentions = [...new Set([...text.matchAll(/\b\d{4}[A-Za-z+]*\b/g)].map((m) => m[0]))];
    let scope: string = text;
    if (mentions.length > 1 && mentions.some((m) => model.includes(m) || m === model)) {
      const parts = text.split(/(?=\b\d{4}[A-Za-z+]*\s*[:/])/);
      const mine = parts.filter((p) => new RegExp(`\\b${model}\\b`).test(p));
      if (mine.length) scope = mine.join(' ');
      // Nothing matched: the cell names other models and not this one, so it is
      // answering about them. Better to say nothing than to read another machine's
      // figure as this one's.
      else scope = '';
    }

    /* A print area is stated "height x width". Only the first of each pair is a
       mark height; the second is how wide the print is, or in continuous mode how far
       the substrate runs — 39 inches on an T400, which is not a character. */
    if (/print area|thermal bar/i.test(key) && /\d\s*x\s*\d/i.test(scope)) {
      // The unit is usually written once, after the width, and governs both.
      scope = [...scope.matchAll(
        /([\d.]+)\s*(mm|"|inches|in\b)?\s*x\s*[\d.]+\s*(mm|"|inches|in\b)?/gi)]
        .map((m) => `${m[1]} ${m[2] ?? m[3] ?? ''}`)
        .join(' ');
    }

    /* "1.8 to 20 mm" states the unit once, at the end, and it governs both ends.
       Without carrying it back there is no minimum to read at all. */
    scope = scope.replace(
      /([\d.]+)\s*(?:to|-|–)\s*([\d.]+)\s*(mm|"|inches|in\b|fpm)/gi,
      (_m, lo, hi, unit) => `${lo} ${unit} ${hi} ${unit}`);

    for (const { re, scale } of q.units) {
      for (const [, raw] of scope.matchAll(re)) {
        const n = Number(raw.replace(/,/g, '')) * scale;
        if (!Number.isFinite(n)) continue;
        const v = Math.round(n * 10) / 10;
        best = best
          ? { max: Math.max(best.max, v), min: Math.min(best.min, v), row: best.row }
          : { max: v, min: v, row: `${key}: ${scope.trim()}` };
      }
    }
  }
  return best;
}

/** Every model a rule's model triggers name. */
function modelsNamed(r: Rule): string[] {
  const named = r.triggers
    .filter((t) => t.triggerType === 'model')
    .flatMap((t) => String(t.compareValue ?? '').split(',').map((v) => v.trim()))
    .filter(Boolean);
  if (named.length === 0) return [];
  const all = [...new Set(CATALOG.map((i) => i.model).filter(Boolean))] as string[];
  // A trigger says 'includes T400' and the catalogue model is 'T400 Series'.
  return all.filter((m) => named.some((n) => m === n || m.includes(n)));
}

const REFUSALS = (APPLICATION_RULES as Rule[]).filter((r) =>
  r.ruleType === 'applicationFit'
  && r.isActive
  && r.actions.some((a) => a.actionType === 'grade' && a.fitGrade === 'notRecommended')
  && r.triggers.some((t) => t.triggerType === 'profile' && t.compareOp === 'gt'
    && QUANTITY[t.profileField ?? '']));

describe('rule ceilings', () => {
  it('has refusals to check', () => {
    // If this ever hits zero the test has stopped looking rather than passed.
    expect(REFUSALS.length).toBeGreaterThan(4);
  });

  it('never refuses below a figure the tool publishes for the same machine', () => {
    const wrong: string[] = [];
    for (const r of REFUSALS) {
      const trigger = r.triggers.find((t) => t.triggerType === 'profile'
        && t.compareOp === 'gt' && QUANTITY[t.profileField ?? '']);
      const field = trigger!.profileField!;
      const ceiling = Number(trigger!.compareValue);
      if (!Number.isFinite(ceiling)) continue;
      for (const model of modelsNamed(r)) {
        const p = published(model, field, r);
        if (!p) continue;
        // A rounding difference is not a contradiction; a machine printing twice as
        // tall as the refusal is.
        if (p.max > ceiling * 1.02) {
          wrong.push(`${r.ruleCode} refuses ${field} above ${ceiling}, but ${model} `
            + `publishes ${p.max} — ${p.row}`);
        }
      }
    }
    expect(wrong, 'a refusal below a published figure').toEqual([]);
  });

  it('never refuses below a published minimum either', () => {
    /* The mirror case. A floor sitting OVER a published minimum tells a rep the
       character is too small for a machine whose own sheet says it is not — the same
       lost sale from the other end. */
    const floors = (APPLICATION_RULES as Rule[]).filter((r) =>
      r.ruleType === 'applicationFit'
      && r.isActive
      && r.actions.some((a) => a.actionType === 'grade' && a.fitGrade === 'notRecommended')
      && r.triggers.some((t) => t.triggerType === 'profile' && t.compareOp === 'lt'
        && QUANTITY[t.profileField ?? '']));
    expect(floors.length, 'nothing to check means the test stopped looking')
      .toBeGreaterThan(0);

    const wrong: string[] = [];
    for (const r of floors) {
      const trigger = r.triggers.find((t) => t.triggerType === 'profile'
        && t.compareOp === 'lt' && QUANTITY[t.profileField ?? '']);
      const field = trigger!.profileField!;
      const floor = Number(trigger!.compareValue);
      if (!Number.isFinite(floor)) continue;
      for (const model of modelsNamed(r)) {
        const p = published(model, field, r);
        if (!p) continue;
        if (p.min < floor * 0.98) {
          wrong.push(`${r.ruleCode} refuses ${field} below ${floor}, but ${model} `
            + `publishes down to ${p.min} — ${p.row}`);
        }
      }
    }
    expect(wrong, 'a refusal above a published minimum').toEqual([]);
  });
});
