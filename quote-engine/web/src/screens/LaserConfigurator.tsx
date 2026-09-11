import { useEffect, useMemo, useState } from 'react';
import { CONFIGURATORS, composePartNumber, type Configurator } from '../api/configurators';
import { Field, Segmented, money } from '../components/ui';

/**
 * Configure a Corvus laser, and get the part number it is ordered as.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * Every other technology in this tool has a machine list, because every other price
 * book enumerates its machines. The laser book does not: a Corvus laser has no part
 * number until it is configured, and its price page is a form rather than a list. So
 * the extractor that fills the catalogue found nothing on it, LSR had 36 parts and no
 * machines, and picking laser landed a rep on an empty screen.
 *
 * The decisions are the product. `L465E651BXABFUSAXX` is thirteen of them in a row —
 * the tube, the marking head, the lens, the umbilical, the beam turning unit, the
 * country kit — and this asks the same thirteen questions the workbook asks, in the
 * same order, from the same option lists.
 *
 * ── What is honest here and what is not ─────────────────────────────────────
 *
 * The part number is real: data/build_configurators.py reproduces the workbook's own
 * worked example character for character before it will write the option data out,
 * so the string this composes is the string that would be ordered.
 *
 * The price is not. The configurator workbook in this repository is the scrubbed
 * copy — every DLP and cost column in it is zero — so a configured laser is priced
 * the way the rest of the preview is priced: invented, deterministic, and said to be
 * invented on the face of the control. Real prices come from Orbit at quote time.
 */

/* A deterministic invented price, the same arithmetic the catalogue generator uses.
   A laser configuration that changed price every time it was rebuilt would read as
   broken rather than as unpriced. */
function inventedPrice(partNo: string): number {
  let h = 2166136261;
  for (const ch of partNo) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const [lo, hi] = [24000, 96000];
  const raw = lo + (h % (hi - lo));
  return Math.round(raw / 100) * 100;
}

/**
 * Which machine a configuration is, in the words the datasheets use.
 *
 * A part number does not say. `L465E651BXABFUSAXX` is a CSL60 and `FSL20-254-...` is
 * an FSL20, and the fit rules are written against those names because that is how the
 * spec sheets state their figures — IP54 for the CSL10 and IP65 optional for the
 * CSL30, 50°F for the fibre lasers and 41°F for the scribing ones.
 *
 * The family is the configurator's own code; the power is the first thing its laser
 * option says. Without this the model was the first three characters of the part
 * number, which matched no rule at all.
 */
export function laserModel(conf: Configurator, picked: Record<string, string>): string {
  const labelOf = (positionLabel: string) => {
    const p = conf.positions.find((x) => x.label.startsWith(positionLabel));
    return p?.options.find((o) => o.code === picked[p.label])?.label ?? '';
  };
  const watts = (labelOf('Laser/System') || labelOf('Power')).match(/(\d+)\s*W/i);
  return watts ? `${conf.code}${watts[1]}` : conf.code;
}

export function LaserConfigurator({ onChoose, chosen }: {
  /** The part number, what it is, its price, and which machine the rules should grade. */
  onChoose: (partNo: string, description: string, listPrice: number, model: string) => void;
  chosen: string | null;
}) {
  const [code, setCode] = useState(CONFIGURATORS[0]?.code ?? '');
  const conf: Configurator | undefined =
    CONFIGURATORS.find((c) => c.code === code) ?? CONFIGURATORS[0];

  /* The workbook's own worked example is the starting point, not an empty form.
     Thirteen empty dropdowns is a form; thirteen answered ones is a machine a rep can
     change their mind about, and every one of those answers is a real default. */
  const [picked, setPicked] = useState<Record<string, string>>(conf?.defaults ?? {});

  /* What each position may offer, given what has been answered above it.
     The workbook divides its lists under headings — "30 & 60 Watt Options", "FOR
     SHC60" — and those are compatibility: a 60 W tube does not take a 10 W marking
     head, and an SHC100 head does not take an SHC60 lens. The generator resolved each
     heading to the parent codes that permit it, so this is a set lookup. */
  const allowed = useMemo(() => {
    const out = new Map<string, typeof conf.positions[number]['options']>();
    if (!conf) return out;
    for (const p of conf.positions) {
      if (!p.dependsOn) { out.set(p.label, p.options); continue; }
      const parent = picked[p.dependsOn];
      out.set(p.label, p.options.filter(
        (o) => !o.requires || (parent != null && o.requires.includes(parent))));
    }
    return out;
  }, [conf, picked]);

  /* A choice that its parent has just ruled out does not stay selected.
     Leaving it would compose a part number that cannot be ordered, and the position
     it belongs to would look answered. Cleared, so the form asks again. */
  useEffect(() => {
    if (!conf) return;
    const drop: string[] = [];
    for (const p of conf.positions) {
      const code = picked[p.label];
      if (!code || !p.dependsOn) continue;
      if (!(allowed.get(p.label) ?? []).some((o) => o.code === code)) drop.push(p.label);
    }
    if (drop.length) {
      setPicked((cur) => {
        const next = { ...cur };
        for (const k of drop) delete next[k];
        return next;
      });
    }
  }, [conf, allowed, picked]);

  const partNo = useMemo(() => (conf ? composePartNumber(conf, picked) : ''), [conf, picked]);

  const description = useMemo(() => {
    if (!conf) return '';
    const said = conf.positions
      .filter((p) => !p.fixed)
      .map((p) => p.options.find((o) => o.code === picked[p.label])?.label)
      .filter(Boolean);
    return [conf.name, ...said].join(', ');
  }, [conf, picked]);

  if (!conf) return null;

  const incomplete = conf.positions.filter((p) => !p.fixed && !picked[p.label]);
  const price = inventedPrice(partNo);

  return (
    <section className="band">
      <div className="band-legend">
        <span>Configure the laser</span>
      </div>

      <div className="space-y-3 px-4 py-3">
        {/* Segmented, not two primary buttons.
            Which family you are configuring is a choice between alternatives, and the
            screen already has one primary action — the one that puts the machine on
            the quote. Two things styled as the primary action is two things competing
            to look like the next step. */}
        {CONFIGURATORS.length > 1 && (
          <Segmented
            label="Laser family"
            value={conf.code}
            onChange={(code) => {
              setCode(code);
              setPicked(CONFIGURATORS.find((c) => c.code === code)?.defaults ?? {});
            }}
            options={CONFIGURATORS.map((c) => ({ value: c.code, label: c.name }))}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {conf.positions.map((p) => {
            if (p.fixed) return null;
            /* One option is not a choice.
               Sensing and Fume Extractor each offer exactly one answer — the
               workbook has withdrawn the rest — and a dropdown you cannot change is
               a control that promises something it will not do. Stated instead, and
               it still contributes its code to the part number like any other
               position. */
            if ((allowed.get(p.label) ?? p.options).length === 1) {
              const only = (allowed.get(p.label) ?? p.options)[0];
              return (
                <Field key={p.label} label={p.label}>
                  <p className="truncate border border-steel-200 bg-steel-50 px-2.5 py-1.5
                                text-sm text-steel-700"
                     title={only.label}>
                    {only.label}
                  </p>
                </Field>
              );
            }
            /* The workbook groups options under headings — "30 & 60 Watt Options",
               "FOR SHC60" — and those headings are compatibility, not decoration: a
               60 W tube does not take a 10 W marking head. They are carried through
               as optgroups so the grouping survives into the control. */
            const options = allowed.get(p.label) ?? p.options;
            const hidden = p.options.length - options.length;
            const groups = new Map<string, typeof p.options>();
            for (const o of options) {
              const key = o.group ?? '';
              groups.set(key, [...(groups.get(key) ?? []), o]);
            }
            return (
              /* The compatibility count is the field's hint, where every other hint
                 in the tool sits — said rather than silently withheld, because a list
                 that quietly shortens just looks like a shorter list, and a rep
                 hunting for the SHC120 head needs to know the tube ruled it out. */
              <Field
                key={p.label}
                label={p.label}
                hint={hidden > 0 && p.dependsOn
                  ? `${hidden} not compatible with the ${p.dependsOn.toLowerCase()} chosen`
                  : undefined}
              >
                <select
                  className="field text-sm"
                  value={picked[p.label] ?? ''}
                  onChange={(e) => setPicked((s) => ({ ...s, [p.label]: e.target.value }))}
                >
                  <option value="">Choose…</option>
                  {[...groups.entries()].map(([g, options]) =>
                    g ? (
                      <optgroup key={g} label={g}>
                        {options.map((o) => (
                          <option key={o.code} value={o.code}>{o.label}</option>
                        ))}
                      </optgroup>
                    ) : (
                      options.map((o) => (
                        <option key={o.code} value={o.code}>{o.label}</option>
                      ))
                    ))}
                </select>
              </Field>
            );
          })}
        </div>

        {/* The workbook's own numbered notes.
            Standing notes, not attributed per option: the CSL block lists them
            without saying which selection carries which, and guessing the linkage
            would be putting words in Corvus's mouth on a document that decides what
            gets ordered. */}
        {Object.keys(conf.warnings).length > 0 && (
          <ul className="space-y-1 border border-signal-200 bg-signal-100 px-3 py-2">
            {Object.entries(conf.warnings).map(([id, text]) => (
              <li key={id} className="flex gap-2 text-2xs leading-snug text-signal-800">
                <span className="num shrink-0 font-semibold">{id}.</span>
                <span className="min-w-0">{text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-rule pt-3">
          <div className="min-w-0">
            <span className="label">Part number</span>
            <p className="readout-light mt-1 break-all text-xl">{partNo}</p>
            {incomplete.length > 0 && (
              <p className="mt-1 text-2xs text-signal-800">
                Still to answer: {incomplete.map((p) => p.label).join(', ')}.
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="readout-light block text-xl">{money(price)}</span>
            {/* Said on the control, not in a footnote. Every price in the preview is
                invented, and this is the one a rep would be most likely to believe,
                because it looks like it came out of a configurator. */}
            <span className="mt-0.5 block text-2xs text-steel-600">
              invented for the preview
            </span>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={incomplete.length > 0 || chosen === partNo}
            onClick={() => onChoose(partNo, description, price, laserModel(conf, picked))}
          >
            {chosen === partNo ? 'On the quote' : 'Put this on the quote'}
          </button>
        </div>
      </div>
    </section>
  );
}
