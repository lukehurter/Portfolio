import { ENVIRONMENT_OPTIONS } from '../api';

/**
 * The environment, picked rather than typed.
 *
 * This was a free-text box, and that quietly broke the rules that read it. A rule
 * asks whether the environment includes "washdown"; a rep who typed "wash down"
 * or "daily hosing" got no warning at all, and the quote looked clean because
 * nothing had fired. The values offered here are the ones the rules match and the
 * ones the parser produces, so the three cannot disagree.
 *
 * Anything already on the quote that is not in the list is kept and shown, so a
 * value typed before this existed is never silently dropped.
 */
export function EnvironmentPicker({ value, onChange }: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const chosen = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const known = new Set<string>(ENVIRONMENT_OPTIONS);
  const extras = chosen.filter((c) => !known.has(c));

  const toggle = (opt: string) => {
    const next = chosen.includes(opt)
      ? chosen.filter((c) => c !== opt)
      : [...chosen, opt];
    onChange(next.join(', ') || null);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {ENVIRONMENT_OPTIONS.map((opt) => {
          const on = chosen.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              data-tap="chip"
              onClick={() => toggle(opt)}
              className={`rounded border px-2 py-1 text-2xs font-semibold transition-colors ${
                on
                  ? 'border-instr-600 bg-instr-200 text-instr-800'
                  : 'border-steel-300 bg-surface text-steel-700 hover:bg-instr-100'}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {extras.length > 0 && (
        <p className="mt-1.5 text-2xs text-steel-600">
          Also on this quote, typed rather than picked:{' '}
          <span className="italic">{extras.join(', ')}</span>. The fit rules cannot read these.
        </p>
      )}
    </div>
  );
}
