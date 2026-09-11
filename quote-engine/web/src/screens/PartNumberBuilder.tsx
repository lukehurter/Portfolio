import { useMemo, useState } from 'react';
import { CIJ_7300 } from '../api/cij7300';
import {
  compose, conflicts, decode, describe, isAvailable, type Selection,
} from '../engine/partNumber';

/**
 * Build a Corvus 7300 part number, or read one somebody sent you.
 *
 * A Corvus part number is a printer already filled — model, printhead, conduit and ink
 * in one code — so it is composed rather than looked up. The same shape as the laser
 * configurator, and the reason the CIJ book holds 947 rows for nine machines.
 *
 * It composes and it does not price. No price page carries the 7300 series, so what
 * a rep gets from this is the correct number to ask for a price WITH, which is the
 * thing that is actually hard. Saying so is the point; a configurator that quietly
 * produced no total would read as broken.
 *
 * Both directions, because the guidance this is built from is titled "how to
 * INTERPRET" — a rep is at least as likely to be handed a part number as to need one.
 */
export function PartNumberBuilder() {
  const conf = CIJ_7300;
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Selection>({});
  const [typed, setTyped] = useState('');

  const problems = useMemo(() => conflicts(sel, conf), [sel, conf]);
  const partNo = compose(sel, conf);
  const decoded = useMemo(() => (typed.trim() ? decode(typed, conf) : null), [typed, conf]);

  /* A choice the rest of the selection has just ruled out does not stay chosen.
     Leaving it would compose a part number nobody can order while every dropdown
     looked answered — see the laser configurator, which learnt this first. */
  function choose(key: string, code: string) {
    setSel((prev) => {
      const next: Selection = { ...prev, [key]: code || undefined };
      for (const p of conf.positions) {
        if (p.key === key) continue;
        const held = next[p.key as keyof Selection];
        if (held && !isAvailable(p.key, held, { ...next, [p.key]: undefined }, conf)) {
          delete next[p.key as keyof Selection];
        }
      }
      return next;
    });
  }

  return (
    <div className="mt-2 border-t border-steel-200 pt-2">
      <button type="button" className="btn-inline text-2xs" aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        {open ? 'Close the part number builder' : 'Build or read a part number'}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <p className="text-2xs text-steel-600">
            <span className="num">{conf.format}</span> — a Corvus part number is the
            printer already filled, so it is composed rather than looked up. This does
            not price it: no price page carries the series yet.
          </p>

          {/* ---------------------------------------------------------- build */}
          <div className="grid gap-2 sm:grid-cols-2">
            {conf.positions.map((p) => {
              const held = sel[p.key as keyof Selection] ?? '';
              return (
                <label key={p.key} className="min-w-0 block">
                  <span className="block text-2xs font-semibold text-steel-700">
                    {p.label}
                  </span>
                  <select
                    className="field mt-0.5 w-full text-xs"
                    value={held}
                    onChange={(e) => choose(p.key, e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {p.options.map((o) => {
                      /* Shown and disabled rather than hidden, with the sheet's own
                         sentence for why. A rep looking for the 6 m conduit needs to
                         learn that the Prism cannot have one — an option that
                         silently vanishes teaches nothing and reads as a bug. */
                      const ok = isAvailable(p.key, o.code,
                        { ...sel, [p.key]: undefined }, conf);
                      return (
                        <option key={o.code} value={o.code} disabled={!ok}>
                          {o.code} — {o.label}{!ok && o.why ? ` (${o.why})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {p.note && (
                    <span className="mt-0.5 block text-2xs text-steel-500">{p.note}</span>
                  )}
                </label>
              );
            })}
          </div>

          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="readout-sm num">{partNo ?? '—'}</span>
            <span className="text-2xs text-steel-600">
              {partNo ? describe(sel, conf) : 'Answer all four to compose a part number.'}
            </span>
          </p>

          {problems.length > 0 && (
            <ul className="space-y-1">
              {problems.map((c, i) => (
                <li key={i} className="text-2xs text-alert-700">
                  <span className="num">{c.code}</span> {c.label} — {c.why}
                </li>
              ))}
            </ul>
          )}

          {/* --------------------------------------------------------- read */}
          <div className="border-t border-steel-200 pt-2">
            <label className="block">
              <span className="block text-2xs font-semibold text-steel-700">
                Or read one somebody sent you
              </span>
              <input className="field num mt-0.5 w-full text-xs" value={typed}
                     placeholder={conf.example}
                     onChange={(e) => setTyped(e.target.value)} />
            </label>

            {typed.trim() && !decoded && (
              <p className="mt-1 text-2xs text-steel-600">
                Not a 7300-series number. This reads{' '}
                <span className="num">{conf.format}</span> only — the 6400 series shares
                the grammar but has its own ink codes and a suffix, so it is not read here.
              </p>
            )}

            {decoded && (
              <div className="mt-1.5">
                <dl className="divide-y divide-steel-200">
                  {decoded.reads.map((r) => (
                    <div key={r.key}
                         className="grid grid-cols-1 gap-x-3 py-1 sm:grid-cols-[8rem_minmax(0,1fr)]">
                      <dt className="text-2xs text-steel-600">
                        {r.label} <span className="num">{r.code}</span>
                      </dt>
                      <dd className="text-2xs text-steel-900">{r.means}</dd>
                    </div>
                  ))}
                </dl>
                {decoded.unknown.length > 0 && (
                  <p className="mt-1 text-2xs text-signal-800">
                    Not on the sheet:{' '}
                    {decoded.unknown.map((u) => `${u.label} ${u.code}`).join(', ')}.
                  </p>
                )}
                {decoded.conflicts.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {decoded.conflicts.map((c, i) => (
                      <li key={i} className="text-2xs text-alert-700">
                        This cannot be ordered as written — {c.why}
                      </li>
                    ))}
                  </ul>
                )}
                {decoded.conflicts.length === 0 && decoded.unknown.length === 0 && (
                  <p className="mt-1 text-2xs text-fit-800">
                    Every position is on the sheet and nothing conflicts.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
