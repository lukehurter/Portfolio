import { isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import type { FitAssessment, Freshness, Severity, Solution } from '../api';
import { useAppOptional } from '../state/app';

export const money = (v: number | null | undefined) =>
  v == null ? '—' : (v < 0 ? '(' : '') + Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (v < 0 ? ')' : '');

export const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${Math.round(v * 1000) / 10}%`;

export const shortDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/** The open/closed marker on anything that folds. */
export function Caret({ open, small }: { open: boolean; small?: boolean }) {
  const n = small ? 8 : 10;
  return (
    <svg aria-hidden viewBox="0 0 10 10" width={n} height={n}
         className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
         fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 1.5 7 5 3 8.5" />
    </svg>
  );
}

export function Panel({ title, aside, children, className = '', strong, collapsible,
                        defaultOpen = true }: {
  title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string;
  /**
   * Reverse the heading band out in navy.
   *
   * For the one section on a screen that outranks the rest. On the saved quote that
   * is the application: every grade, recommendation and price is derived from it, so
   * if it is wrong everything below it is confidently wrong. Two strong bands on one
   * screen would make neither of them strong, so this is used once.
   */
  strong?: boolean;
  /**
   * The heading folds the section away.
   *
   * A saved quote is seven sections deep and a rep opening one is usually after a
   * single answer — what was approved, what the customer pays, which rule fired. The
   * ones they are not reading should be able to get out of the way.
   */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shown = !collapsible || open;
  return (
    <section className={`panel ${className}`}>
      {title !== undefined && (
        <header className={strong ? 'panel-head-strong' : 'panel-head'}>
          {collapsible ? (
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
                    className="flex min-w-0 items-center gap-2 text-left">
              <Caret open={open} />
              <h2 className="h-display truncate text-sm">{title}</h2>
            </button>
          ) : (
            <h2 className="h-display text-sm">{title}</h2>
          )}
          {aside}
        </header>
      )}
      {shown && children}
    </section>
  );
}

/* The old pill's fills, kept only for RuleCodeChip, which is a different object: a
   part number you can press, not a state you read. */
const TONE: Record<string, string> = {
  info:    'bg-steel-50 text-steel-700 border-steel-200',
  warn:    'bg-signal-100 text-signal-800 border-signal-200',
  block:   'bg-alert-100 text-alert-800 border-alert-200',
  ok:      'bg-fit-100 text-fit-800 border-fit-200',
  active:  'bg-instr-100 text-instr-800 border-instr-200',
  muted:   'bg-surface text-steel-600 border-steel-200',
};

const STAT: Record<string, string> = {
  info: 'stat-info', warn: 'stat-warn', block: 'stat-block',
  ok: 'stat-ok', active: 'stat-active', muted: 'stat-muted',
};

/** The text of whatever was passed as children, so a leading count can be found. */
function textOf(node: ReactNode): string {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

/** "3 to decide" -> ['3', 'to decide']. Anything else -> null. */
function splitCount(text: string): [string, string] | null {
  const m = /^\s*(\d[\d,]*)\s+(\S.*?)\s*$/.exec(text);
  return m ? [m[1], m[2]] : null;
}

/**
 * The state of something, as a reading.
 *
 * REPORTED: "Can you do a different design than the pills for things like the status
 * of things."
 *
 * What it replaces is a rounded, bordered, tinted pill used in all twenty-two places
 * the app states a status — the last rounded object in an interface whose rule is
 * that structure is square and only a pressable thing gets a radius. It also gave a
 * retired rule exactly as much voice as a late order, which is how 740 identical gold
 * chips became the loudest thing on the Classify screen.
 *
 * The key mark sits on the trailing edge and the field fades into it. Because a status
 * is the last thing in a row, the marks stack into one continuous strip down the outer
 * edge of a list however long the words are. That is the scanning gain, and it is the
 * reason this shape was chosen over four others: nothing else lines up, because every
 * label is a different length.
 *
 * A count becomes the reading with the words as its legend — the app's own readout
 * grammar. A state with no count is one line at the figure's size, not a legend under
 * an empty slot, because that read as a hollow version of a status that had a number.
 *
 * `compact` is the same language in less room: one line, legend size, a 3px mark. For
 * a dense table row or a phone, not for a different kind of fact.
 */
export function Status({ tone = 'info', compact, inline, children }: {
  tone?: keyof typeof STAT | string; compact?: boolean; inline?: boolean;
  children: ReactNode;
}) {
  const cls = `stat ${STAT[tone] ?? STAT.info}`;
  /* Not at the end of a row, so nothing to line up with and no edge for the mark to
     sit on. Measured at 838px from the nearest one in the quote header, where the row
     form was a coloured blob floating in the middle of a heading. */
  if (inline) {
    return <span translate="no" className={`${cls} stat-inline`}>{children}</span>;
  }
  const parts = compact ? null : splitCount(textOf(children));
  if (parts) {
    return (
      <span translate="no" className={`${cls} stat-n`}>
        <span className="stat-figure">{parts[0]}</span>
        <span className="stat-legend">{parts[1]}</span>
      </span>
    );
  }
  return (
    <span translate="no" className={`${cls} ${compact ? 'stat-compact' : 'stat-word'}`}>
      {children}
    </span>
  );
}



/**
 * A rule code, and a way to go and read it.
 *
 * The chip used to be inert unless a call site remembered to hand it an onClick, and
 * nine of the twelve did not — so a rep looking at "R-114 says this machine is not
 * recommended" could click the chip on a saved quote and not in the configurator,
 * with nothing on screen to say which was which. There is one destination for a rule
 * code, so the chip goes there by itself.
 *
 * `onClick` still overrides it, and outside a provider — the customer's copy, a unit
 * test mounting one component — it falls back to being plain text rather than
 * throwing.
 */
export function RuleCodeChip({ code, tone = 'info', onClick }: {
  code: string; tone?: string; onClick?: () => void;
}) {
  const app = useAppOptional();
  const cls = `rule-chip ${TONE[tone] ?? TONE.info}`;
  const act = onClick ?? (app ? () => app.go({ name: 'rule', ruleCode: code }) : undefined);
  if (!act) return <span translate="no" className={cls}>{code}</span>;
  return (
    <button type="button" translate="no" onClick={act}
            className={`${cls} hover:brightness-95`} title={`Open ${code}`}>
      <span aria-hidden className="inline-block h-2 w-px bg-current opacity-60" />
      {code}
    </button>
  );
}

export function Field({ label, hint, error, children, required }: {
  label: string; hint?: ReactNode; error?: string; children: ReactNode; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="ml-1 text-alert-700" aria-hidden>*</span>}
      </span>
      <span className="mt-1 block">{children}</span>
      {error
        ? <span className="mt-1 flex items-start gap-1.5 text-2xs font-medium text-alert-800">
            <span aria-hidden>✕</span>{error}
          </span>
        : hint && <span className="mt-1 block text-2xs text-steel-600">{hint}</span>}
    </label>
  );
}

/* Empty states teach the interface rather than announcing absence. */
export function Empty({ title, children, action }: {
  title: string; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="h-display text-sm">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-steel-600">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-steel-100" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skel h-4 w-16" />
          <div className="skel h-4 flex-1" style={{ maxWidth: `${45 + ((i * 13) % 35)}%` }} />
          <div className="skel h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 border border-alert-200 bg-alert-100 px-4 py-3">
      <p className="text-sm font-semibold text-alert-800">That did not load.</p>
      <p className="mt-1 text-xs text-steel-700">{message}</p>
      {onRetry && <button type="button" className="btn-quiet mt-2.5 text-xs" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/**
 * Promise dates come from a job that runs at 05:30, once a day, not live. A rep
 * reading a date to a customer on the phone needs to know how old it is, so
 * this appears next to every number that came from that job.
 *
 * One run a day is why this component matters more than it looks. "Availability
 * as of 10 hours ago" is a normal, correct afternoon reading, not a fault — the
 * tone stays `ok` because the job ran as scheduled. `stale` means it did not.
 */
export function FreshnessNote({ asOf, freshness }: { asOf: string; freshness: Freshness }) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(asOf).getTime()) / 60000));
  const age = mins < 90 ? `${mins} min ago`
    : mins < 60 * 36 ? `${Math.round(mins / 60)} hours ago`
    : `${Math.round(mins / 1440)} days ago`;
  const tone = freshness === 'current' ? 'ok' : freshness === 'stale' ? 'warn' : 'block';
  const label = freshness === 'current' ? `Availability as of ${age}`
    : freshness === 'stale' ? `Availability is ${age} — the overnight refresh may not have run`
    : 'Availability refresh failed — treat these dates as unreliable';
  return (
    <span className="inline-flex items-center gap-1.5">
      <Status inline tone={tone}>{freshness}</Status>
      <span className="text-2xs text-steel-600">{label}</span>
    </span>
  );
}

/** A due date that says plainly whether it has already passed. */
export function DueDate({ date, daysLate }: { date: string | null; daysLate: number | null }) {
  if (!date) return <span className="text-2xs text-steel-500">no committed date</span>;
  if (!daysLate || daysLate <= 0) return <span className="num text-xs text-steel-800">{shortDate(date)}</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="num text-xs font-semibold text-alert-800">{shortDate(date)}</span>
      <span className="text-2xs font-semibold text-alert-700">{daysLate}d late</span>
    </span>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-surface px-4 py-2.5">{children}</div>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    /* Wraps rather than running off the edge.
       inline-flex on a six-option group measured 463px inside a 341px panel at 375px:
       the last two options were simply not on screen, and the row they sat in had no
       scrollbar to say so. Wrapping costs a second line and shows every option. */
    <div role="group" aria-label={label}
         className="flex max-w-full flex-wrap rounded border border-steel-300 bg-surface p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`seg-btn flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              on ? 'bg-instr-100 text-instr-800' : 'text-steel-600 hover:bg-steel-50 hover:text-steel-900'}`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`num text-2xs ${on ? 'text-instr-600' : 'text-steel-500'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One reading on the status band.
 *
 * `lead` marks the figure the band exists to report — the order total. One lead
 * per band: two competing readouts is a dashboard, and this is not one.
 */
/**
 * A labelled reading on the fascia.
 *
 * `lead` marks the one a rep is actually watching, and it now gets the readout well
 * rather than a slightly larger cyan number. It also flashes when the value changes:
 * the order total moves while somebody is dragging a discount slider, and a figure
 * that changes silently in the corner of the eye is a figure nobody trusts.
 */
export function Reading({ label, value, lead = false }: {
  label: string; value: string; lead?: boolean;
}) {
  const [pulse, setPulse] = useState(0);
  const was = useRef(value);
  useEffect(() => {
    if (!lead || was.current === value) return;
    was.current = value;
    setPulse((n) => n + 1);
  }, [value, lead]);

  return (
    <div translate="no" className="flex items-baseline gap-2">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-navy-300">{label}</dt>
      {lead ? (
        // key forces the animation to restart on every change; without it the second
        // change in a row does nothing, which is the one a rep is most likely to miss.
        <dd key={pulse} className="readout readout-live text-base">{value}</dd>
      ) : (
        <dd className="num text-xs text-white">{value}</dd>
      )}
    </div>
  );
}

/**
 * What a fit grade should actually be called.
 *
 * `good` was labelled "good fit" whether a rule had endorsed the machine or no rule
 * had looked at it at all — and since a fit rule reads the application profile, an
 * empty profile means nothing fires and every printer in every technology comes back
 * a good fit. That is not a grading, it is the absence of one wearing a green chip,
 * and it is the fastest way to teach a rep that the grades mean nothing.
 *
 * A `good` with no reasons is now "not assessed", in a neutral tone. Green is
 * reserved for a machine a rule positively endorsed.
 *
 * That started here, as a label: the engine still said `good` and this function
 * declined to draw it green when no rule had spoken. The engine now says
 * `notAssessed` itself, which is where it belonged — a label cannot fix a sort
 * order, and ranking by grade was putting 947 unexamined machines level with the
 * ones a datasheet endorses. The reasonCount branch stays as the floor under an
 * engine that has not been redeployed yet, and costs one comparison.
 */
export function fitLabel(
  grade: 'good' | 'caveat' | 'notAssessed' | 'notRecommended',
  reasonCount: number,
): { text: string; tone: string } {
  if (grade === 'notRecommended') return { text: 'not recommended', tone: 'block' };
  if (grade === 'caveat') return { text: 'with a caveat', tone: 'warn' };
  if (grade === 'notAssessed') return { text: 'not assessed', tone: 'muted' };
  if (reasonCount > 0) return { text: 'good fit', tone: 'ok' };
  return { text: 'not assessed', tone: 'muted' };
}

/**
 * What the datasheets say about what is on the quote.
 *
 * Shared, because it belongs on two screens for one reason. The rules graded machines
 * while the rep browsed and then went silent the moment one was added — and once that
 * was fixed in the builder, the saved quote still showed nothing, so the grading
 * disappeared exactly when it stopped being advice and became the record. The record
 * is what gets argued about six months later, so it is the copy that matters most.
 *
 * Only what is not plainly fine is listed. A machine nothing speaks against does not
 * need a row saying so, and repeating it would bury the two rows that count.
 */
export function AgainstTheApplication({ fit, solutions, onRuleClick }: {
  fit: FitAssessment[] | undefined;
  /**
   * The stations on the quote, so findings can be filed under the one they are about.
   *
   * A quote with two applications produced one flat list, and a rep reading "not
   * recommended — no water protection" had no way to tell which station it was said
   * about. Worse where two stations quote the same machine and disagree: the same
   * description appeared twice with two verdicts and nothing between them.
   *
   * REPORTED: "there should be additional sections created under 'against the
   * application' when there's another application on the quote too."
   */
  solutions?: Solution[];
  onRuleClick?: (ruleCode: string) => void;
}) {
  const flagged = (fit ?? []).filter((f) => f.grade !== 'good' || f.reasons.length > 0);
  if (flagged.length === 0) return null;

  /* One section per station, but only where there is more than one to tell apart.
     On the ordinary quote the heading would be furniture above a single group. */
  const stations = (solutions ?? []).filter(
    (sol) => flagged.some((f) => f.solutionId === sol.id));
  const grouped = stations.length > 1;
  const groups: { key: string; label: string | null; rows: FitAssessment[] }[] = grouped
    ? [
      ...stations.map((sol, i) => ({
        key: sol.id,
        label: sol.name || `Solution ${i + 1}`,
        rows: flagged.filter((f) => f.solutionId === sol.id),
      })),
      /* Anything that belongs to the quote rather than to a station — freight, an
         installation day — rather than being dropped for having no section. */
      {
        key: '__quote',
        label: 'The quote',
        rows: flagged.filter((f) => !stations.some((sol) => sol.id === f.solutionId)),
      },
    ].filter((g) => g.rows.length > 0)
    : [{ key: '__all', label: null, rows: flagged }];

  return (
    <Panel title="Against the application"
           aside={<span className="text-2xs text-steel-600">from datasheets</span>}>
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && (
            <p className="border-b border-rule bg-navy-50 px-3 py-1.5 font-display text-2xs
                          font-bold uppercase tracking-widest text-heading">
              {group.label}
            </p>
          )}
          <ul className="divide-y divide-steel-100">
            {group.rows.map((f) => {
              const label = fitLabel(f.grade, f.reasons.length);
              return (
                /* Keyed by station as well as part: one machine quoted at two
                   stations is two findings with the same item number. */
                <li key={`${f.solutionId ?? ''}:${f.itemNo}`} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-2xs leading-snug text-steel-900">{f.description}</span>
                  <span className="num block text-2xs text-steel-600">{f.itemNo}</span>
                </span>
                <Status tone={label.tone}>{label.text}</Status>
              </div>
              <ul className="mt-1.5 space-y-1">
                {f.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-2xs text-steel-700">
                    <RuleCodeChip code={r.ruleCode}
                                  onClick={onRuleClick ? () => onRuleClick(r.ruleCode) : undefined} />
                    <span className="min-w-0 leading-snug">
                      {r.text}
                      {(r.author || r.sourceRef) && (
                        <span className="mt-0.5 block text-steel-500">
                          {r.author ?? 'author not recorded'}
                          {r.sourceRef ? ` · ${r.sourceRef}` : ' · source not recorded'}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Panel>
  );
}
