import { CIJ_7300, type PartConfigurator, type PartOption } from '../api/cij7300';

/**
 * Reading and writing a Corvus CIJ part number.
 *
 * A Corvus part number is a printer already filled — model, printhead, conduit and ink
 * in one code — so K414-W2-72-CVS is four decisions strung together rather than a
 * name. That is the same shape the laser configurator assembles, and the reason the
 * CIJ book holds 947 rows for nine machines.
 *
 * Two directions, because a rep needs both. Composing answers "what do I order for
 * this application"; decoding answers "what did the customer send me", which is the
 * question the supplied guidance is actually titled after.
 *
 * The compatibility rules are the valuable part and they run in every direction: a
 * right-angled conduit rules out the HP-resistant printhead, the hard-pigmented ink
 * rules in the Prism, and the Prism printheads rule the ink down to one. So a
 * selection is checked as a whole rather than in the order the form was filled — see
 * `conflicts`.
 */

export interface Selection {
  printer?: string;
  printhead?: string;
  length?: string;
  ink?: string;
}

export interface Conflict {
  /** The position holding the option that cannot stand. */
  key: string;
  code: string;
  label: string;
  /** What it disagrees with, as the sheet states it. */
  why: string;
}

const KEYS = ['printer', 'printhead', 'length', 'ink'] as const;

function position(conf: PartConfigurator, key: string) {
  return conf.positions.find((p) => p.key === key);
}

export function optionFor(conf: PartConfigurator, key: string, code: string): PartOption | undefined {
  return position(conf, key)?.options.find((o) => o.code === code);
}

/**
 * Everything wrong with a selection, given what has been chosen so far.
 *
 * A constraint against a position nobody has answered is not a conflict — it is a
 * decision still to make. Only an option that disagrees with an ANSWER is reported,
 * which is what lets the form be filled in any order.
 */
export function conflicts(sel: Selection, conf: PartConfigurator = CIJ_7300): Conflict[] {
  const out: Conflict[] = [];
  for (const key of KEYS) {
    const code = sel[key];
    if (!code) continue;
    const opt = optionFor(conf, key, code);
    if (!opt) continue;

    for (const [other, allowed] of Object.entries(opt.requires ?? {})) {
      const chosen = sel[other as keyof Selection];
      if (chosen && !allowed.includes(chosen)) {
        out.push({ key, code, label: opt.label, why: opt.why ?? `Requires ${other} ${allowed.join(' or ')}.` });
      }
    }
    for (const [other, banned] of Object.entries(opt.excludes ?? {})) {
      const chosen = sel[other as keyof Selection];
      if (chosen && banned.includes(chosen)) {
        out.push({ key, code, label: opt.label, why: opt.why ?? `Not available with ${other} ${chosen}.` });
      }
    }
  }
  // One disagreement is reported once, from the position that states it.
  return out.filter((c, i) => out.findIndex(
    (d) => d.key === c.key && d.code === c.code && d.why === c.why) === i);
}

/** Whether this option can stand alongside everything else already chosen. */
export function isAvailable(
  key: string, code: string, sel: Selection, conf: PartConfigurator = CIJ_7300,
): boolean {
  const trial: Selection = { ...sel, [key]: code };
  return conflicts(trial, conf).every((c) => c.key !== key || c.code !== code);
}

/** The part number, or null while anything is unanswered. */
export function compose(sel: Selection, conf: PartConfigurator = CIJ_7300): string | null {
  if (KEYS.some((k) => !sel[k])) return null;
  return conf.format
    .replace('{printer}', sel.printer!)
    .replace('{printhead}', sel.printhead!)
    .replace('{length}', sel.length!)
    .replace('{ink}', sel.ink!);
}

export interface Decoded {
  partNo: string;
  selection: Selection;
  /** Position label -> what that code means. */
  reads: { key: string; label: string; code: string; means: string }[];
  /** Codes the sheet does not list, by position. */
  unknown: { key: string; label: string; code: string }[];
  conflicts: Conflict[];
}

/**
 * Read a part number back, or null when it is not this series at all.
 *
 * Tolerant of the separators and of case, because the number arrives in an email:
 * "p994 w2 72 lnx" is the same order as "K414-W2-72-CVS". Not tolerant of the
 * positions, which are fixed width and mean nothing if slid.
 */
export function decode(input: string, conf: PartConfigurator = CIJ_7300): Decoded | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = raw.match(/^K41(\d)([A-Z0-9])(\d)(\d{2})CVS$/);
  if (!m) return null;
  const [, printer, printhead, length, ink] = m;
  const selection: Selection = { printer, printhead, length, ink };

  const reads: Decoded['reads'] = [];
  const unknown: Decoded['unknown'] = [];
  for (const key of KEYS) {
    const p = position(conf, key)!;
    const code = selection[key]!;
    const opt = optionFor(conf, key, code);
    if (opt) reads.push({ key, label: p.label, code, means: opt.label });
    else unknown.push({ key, label: p.label, code });
  }
  return { partNo: compose(selection, conf) ?? raw, selection, reads, unknown,
           conflicts: conflicts(selection, conf) };
}

/**
 * A sentence for a part number, in the order a rep would say it.
 *
 * "7340 Prism, PH4 Standard Plus for Prism printers, 4 m straight, hard-pigmented".
 */
export function describe(sel: Selection, conf: PartConfigurator = CIJ_7300): string {
  return KEYS
    .map((k) => (sel[k] ? optionFor(conf, k, sel[k]!)?.label : undefined))
    .filter(Boolean)
    .join(', ');
}
