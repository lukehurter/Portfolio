import type { AnalyticsBand } from '../api';

/**
 * The drawing vocabulary for the analytics page.
 *
 * WHY MORE THAN ONE FORM
 *
 * Every panel started as the same horizontal bar and it was reported as ugly, which it
 * was — but the deeper fault was that one form cannot be right for six shapes of data.
 * A bar list sorted by count destroys an axis: a speed distribution drawn that way puts
 * "574 – 1,433 fpm" between "under 200" and "over 1,433", which is not a chart of
 * anything. A two-way split drawn as two bars asks the reader to compare two lengths
 * when the answer is one proportion. A multi-select drawn as a share of a whole states
 * a whole that does not exist.
 *
 * So the form is chosen by the shape of the data, and each of these exists because
 * something on the page has that shape:
 *
 *   Histogram    a scale, in its own order          speed, height, throw, throughput
 *   SplitBar     exactly two answers                surface, guide rails, sample tested
 *   Ranked       many answers with a long tail      substrate
 *   Tally        overlapping answers, no whole      environment
 *   Waffle       a part of a fixed total            questions answered, of 28
 *   Bullet       a value against a stated target    discount against its ceiling
 *   Scatter      two variables, one relationship    fill rate against rule dependence
 *   Strip        composition in a fixed order       the pipeline
 *
 * THREE RULES NONE OF THEM BREAK
 *
 * The value is always written, never revealed on hover — a number a keyboard user
 * cannot reach is not reported. Colour never carries the meaning; length, position and
 * count do, and every mark is the same instrument blue unless a threshold is being
 * named. And the track behind a mark is a tint of the mark, never a grey: `navy-100`
 * does not invert, so in the dark theme it came out brighter than the bar and a count
 * of one read as a long lit line.
 */

/**
 * The hue a distribution is drawn in.
 *
 * Cool measures, warm judges. Everything on the analytics sheet that reports HOW
 * MANY is a step of the instrument blue, and the brand's warm hues -- gold, green,
 * the alert red -- are kept for the places that report whether something is WRONG,
 * so a colour never has to mean two things on one page. The three steps here say
 * which of the sheet's three bands a chart belongs to, restating a division the
 * band legend already prints; no bar's colour is the only thing telling you what
 * it is, and no bar's colour implies good or bad.
 *
 * The page was a single flat blue end to end, which used a fifth of a palette that
 * publishes five hues. REPORTED: "give this page more color you have plenty in
 * brand you haven't touched".
 */
export type ChartTone = 'deep' | 'mid' | 'cyan';

/* The track is alpha of its own fill, so it stays subordinate in both themes. */
const TONE: Record<ChartTone, { fill: string; track: string }> = {
  deep: { fill: 'bg-instr-700', track: 'bg-instr-700/15' },
  mid: { fill: 'bg-instr-500', track: 'bg-instr-500/15' },
  cyan: { fill: 'bg-instr-400', track: 'bg-instr-400/20' },
};

/* ------------------------------------------------------------------ histogram */

/**
 * A scale, drawn in its own order.
 *
 * Columns rather than rows, because the axis runs left to right and a reader already
 * knows to read a number line that way. Empty bands are kept: an unpopulated "over
 * 1,433 fpm" is the statement that nothing goes that fast, and dropping it redraws the
 * axis without saying so.
 */
export function Histogram({ bands, unit, tone = 'mid' }: {
  bands: AnalyticsBand[]; unit?: string; tone?: ChartTone;
}) {
  const t = TONE[tone];
  const max = Math.max(1, ...bands.map((b) => b.count));
  return (
    <div>
      {/* Every ancestor of a percentage height needs a definite height of its own.
          `items-end` sized each column to its content instead, so the bars resolved
          their height against `auto` and drew nothing at all — the panel rendered as
          a number, an axis, and five centimetres of white. The row is a fixed height,
          each column fills it, and the bar sits in a flex-1 well that therefore has
          a real height to be a percentage of. */}
      <div className="flex gap-1" style={{ height: '4.5rem' }}>
        {bands.map((b) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center">
            <span className="num text-2xs leading-none text-steel-900">{b.count}</span>
            <span className="mt-0.5 flex w-full flex-1 items-end">
              <span className={`block w-full ${t.track}`}
                    style={{ height: b.count > 0
                      ? `${Math.max(6, (b.count / max) * 100)}%` : '2px' }}>
                <span className={`block h-full w-full ${t.fill}`} />
              </span>
            </span>
          </div>
        ))}
      </div>
      {/* The axis labels sit under their own column and wrap rather than truncate:
          "574 – 1,433" clipped to "574 –" is a different number. */}
      <div className="mt-1 flex gap-1 border-t border-rule pt-1">
        {bands.map((b) => (
          <span key={b.label}
                className="min-w-0 flex-1 text-center text-[10px] leading-tight text-steel-600">
            {b.label}
          </span>
        ))}
      </div>
      {unit && <p className="mt-0.5 text-center text-[10px] text-steel-500">{unit}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ split bar */

/**
 * Exactly two answers, as one strip.
 *
 * Two bars would ask a reader to compare two lengths; the question is a single
 * proportion, so it is one bar divided once. The minor side keeps the same tint the
 * tracks use, so the division reads as one object rather than two colours competing.
 */
export function SplitBar({ bands, tone = 'mid' }: {
  bands: AnalyticsBand[]; tone?: ChartTone;
}) {
  const t = TONE[tone];
  const total = bands.reduce((n, b) => n + b.count, 0) || 1;
  const [first, second] = bands;
  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden" role="img"
           aria-label={bands.map((b) => `${b.label} ${b.count}`).join(', ')}>
        <span className={t.fill} style={{ width: `${(first.count / total) * 100}%` }} />
        <span className={t.track} style={{ width: `${((second?.count ?? 0) / total) * 100}%` }} />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        {bands.map((b, i) => (
          <span key={b.label}
                className={`text-[10px] leading-tight ${i === 0 ? 'text-steel-900' : 'text-steel-600'}`}>
            <b className="num">{b.count}</b> {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- ranked */

/**
 * Many answers with a long tail, as a dot on a stem.
 *
 * The bar's weight is what made a screen of these unreadable — twenty solid blocks is
 * a wall. A stem carries the same length at a fraction of the ink, and the dot puts
 * the eye on the end of it, which is where the value is.
 */
export function Ranked({ bands, total, tail, tone = 'mid' }: {
  bands: AnalyticsBand[]; total: number; tail?: number; tone?: ChartTone;
}) {
  const t = TONE[tone];
  const max = Math.max(1, ...bands.map((b) => b.count));
  return (
    <div>
      <ul className="space-y-1.5">
        {bands.map((b) => (
          <li key={b.label} className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2">
            {/* The stem is 3px because a 1px one cannot be made to behave, and two
                goes at making it behave were both wrong.

                Reported three times as lines of different thicknesses. The cause is
                rasterisation, not geometry: a 1px rule sitting on a device pixel is
                drawn solid, and one straddling two is spread across both at half
                intensity, which reads as a different weight. `leading-tight` is the
                unitless 1.25, so on `text-2xs` (11px) the label line came out
                13.75px and the pitch 28.75px -- every row landing on a different
                quarter of a pixel.

                Whole CSS pixels fixed nothing: 30px is 37.5 DEVICE pixels at the
                125% scaling Windows ships, so it came back on the machine this is
                read on while measuring clean at 2x. Whole DEVICE pixels cannot be
                had either -- browser zoom gives ratios like 1.1 and 1.4, and no
                integer CSS pitch is whole at an arbitrary one.

                So the hairline goes. At 3px a half-pixel of antialiasing is an edge,
                not the whole line: measured across seven ratios (1, 1.1, 1.25, 1.4,
                1.5, 1.75, 2) every stem draws the same number of device rows, and
                the worst ink spread between stems is 3% at 1.1 -- against the 1px
                version, where the drawn weight alternated by a factor of two.

                The pitch stays a multiple of 4 (14 + 12 in the value column and a
                1.5 gap makes 32) because it costs nothing and keeps every common
                ratio exact. Do not put `leading-tight` or `leading-snug` back: both
                are unitless and both compute to fractions here. And do not thin the
                stem again. */}
            <span className="min-w-0">
              <span className="block truncate text-2xs leading-[14px] text-steel-800" title={b.label}>
                {b.label}
              </span>
              <span className="mt-1 flex items-center" aria-hidden>
                <span className={`h-[3px] ${t.fill}`}
                      style={{ width: `calc(${Math.max(3, (b.count / max) * 100)}% - 5px)` }} />
                <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${t.fill}`} />
              </span>
            </span>
            <span className="num text-right text-2xs leading-[14px] text-steel-900">
              {b.count}
              {total > 0 && (
                <span className="block text-[10px] leading-[12px] text-steel-600">
                  {Math.round((b.count / total) * 100)}%
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {tail ? (
        <p className="mt-1.5 text-[10px] leading-snug text-steel-600">
          {tail} more, 1 quote each.
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- tally */

/**
 * Overlapping answers, counted rather than shared out.
 *
 * A line is dusty AND washed down, so these sum past the quote count and no
 * proportion of a whole can honestly be drawn. Cells, one per quote, say "eleven of
 * these" without implying "of a hundred per cent".
 */
export function Tally({ bands, tone = 'mid' }: {
  bands: AnalyticsBand[]; tone?: ChartTone;
}) {
  const t = TONE[tone];
  return (
    <ul className="space-y-1.5">
      {bands.map((b) => (
        <li key={b.label}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-2xs leading-tight text-steel-800"
                  title={b.label}>{b.label}</span>
            <span className="num shrink-0 text-2xs text-steel-900">{b.count}</span>
          </span>
          <span className="mt-1 flex flex-wrap gap-[3px]" aria-hidden>
            {Array.from({ length: b.count }, (_, i) => (
              <span key={i} className={`h-2 w-2 ${t.fill}`} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------- waffle */

/**
 * A part of a fixed, meaningful total.
 *
 * The application asks 28 questions and a quote answers some of them, so the whole is
 * a real quantity a reader can hold — twenty-eight cells, filled ones lit. A bar to
 * 28 would say the same thing and would not let anyone see, at a glance, that most of
 * the form is empty.
 */
export function Waffle({ filled, total, columns = 7, tone = 'cyan' }: {
  filled: number; total: number; columns?: number; tone?: ChartTone;
}) {
  const t = TONE[tone];
  return (
    <span className="inline-grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${columns}, 0.5rem)` }}
          role="img" aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i}
              className={`h-2 w-2 ${i < filled ? t.fill : t.track}`} />
      ))}
    </span>
  );
}

/* --------------------------------------------------------------------- bullet */

/**
 * A distribution against a stated threshold.
 *
 * The ceiling is the point of the panel, so it is a marker on the measure rather than
 * a number in a caption — and it is labelled in words as well as drawn, because a
 * threshold conveyed by position alone is a threshold a colour-blind reader has to
 * infer. Anything past it is drawn in the alert tone AND counted in text.
 */
export function Bullet({ bands, ceilingLabel, over }: {
  bands: AnalyticsBand[]; ceilingLabel: string; over: number;
}) {
  const total = bands.reduce((n, b) => n + b.count, 0) || 1;
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden" role="img"
           aria-label={bands.map((b) => `${b.label}: ${b.count}`).join(', ')}>
        {bands.map((b, i) => (
          <span key={b.label}
                className={i === bands.length - 1 && over > 0 ? 'bg-alert-700' : 'bg-instr-600'}
                style={{
                  width: `${(b.count / total) * 100}%`,
                  opacity: 1 - (i * 0.18),
                }} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex flex-wrap gap-x-3">
          {bands.map((b) => (
            <span key={b.label} className="text-[10px] leading-tight text-steel-600">
              <b className="num text-steel-900">{b.count}</b> {b.label}
            </span>
          ))}
        </span>
        <span className="num text-[10px] leading-tight text-steel-600">{ceilingLabel}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- strip */

/** Composition in a fixed order — the pipeline, in the order a quote moves through it. */
export function Strip({ bands, tone }: {
  bands: AnalyticsBand[]; tone?: (label: string) => string;
}) {
  const total = bands.reduce((n, b) => n + b.count, 0) || 1;
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden" role="img"
           aria-label={bands.map((b) => `${b.label} ${b.count}`).join(', ')}>
        {bands.map((b) => (
          <span key={b.label} className={tone?.(b.label) ?? 'bg-instr-600'}
                style={{ width: `${(b.count / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {bands.map((b) => (
          <li key={b.label} className="flex items-baseline gap-1.5 text-2xs text-steel-700">
            <span className={`mt-[3px] h-2 w-2 shrink-0 ${tone?.(b.label) ?? 'bg-instr-600'}`}
                  aria-hidden />
            <span className="min-w-0 flex-1 truncate">{b.label}</span>
            <span className="num text-steel-900">{b.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------- scatter */

export interface ScatterPoint {
  label: string;
  /** 0–1: how often the question is answered. */
  x: number;
  /** How many rules read it. */
  y: number;
  /** True where the combination is the finding, not just a position. */
  flagged: boolean;
}

/**
 * Two variables and the relationship between them.
 *
 * This is the page's whole argument and it was a table. The table is still underneath,
 * because a table is the accessible form and the precise one — but the SHAPE of the
 * problem only appears in two dimensions: rules on one axis, how often the question is
 * answered on the other, and the top-left corner is where the grading is leaning on
 * evidence nobody collects.
 *
 * The corner is drawn and named, so the finding is legible without reading a single
 * point, and flagged points are larger as well as darker — a reader who cannot see the
 * tone still sees the size.
 */
export function Scatter({ points }: { points: ScatterPoint[] }) {
  const maxY = Math.max(4, ...points.map((p) => p.y));
  /* A coordinate space close to the size it actually renders at, so the type is the
     size it says. At viewBox 320 stretched across a full-width panel every label came
     out at four times its stated size and the chart swallowed the page. */
  const w = 520, h = 260;
  const pad = { l: 46, r: 16, t: 20, b: 34 };
  const px = (x: number) => pad.l + x * (w - pad.l - pad.r);
  const py = (y: number) => h - pad.b - (y / maxY) * (h - pad.t - pad.b);

  /* Labels that do not land on each other.
     Six flagged questions clustered in one corner and their labels overlapped into an
     unreadable stack. Placed top-down with a minimum vertical gap, and pushed to the
     left of the point where the right edge is close, which is where the crowding is. */
  const flagged = points.filter((p) => p.flagged).sort((a, b) => b.y - a.y);
  /* Only the worst few carry a name. Every flagged point is still drawn larger and in
     the alert tone, and the table underneath names all of them with their figures —
     so nothing is hidden, and the chart stops being a word cloud. Six labels in one
     corner overlapped into an unreadable stack and then ran off the bottom axis. */
  const placed: number[] = [];
  const labelled = flagged.slice(0, 5).map((p) => {
    const floor = h - pad.b - 6;
    let y = Math.min(py(p.y) + 3, floor);
    /* Down first, then up — a label that cannot find room below the point looks for
       it above rather than walking off the chart. */
    while (placed.some((used) => Math.abs(used - y) < 13) && y < floor) y += 13;
    while (placed.some((used) => Math.abs(used - y) < 13) && y > pad.t + 8) y -= 13;
    placed.push(y);
    const right = px(p.x) < w - 150;
    const anchor: 'start' | 'end' = right ? 'start' : 'end';
    return { ...p, ty: y, tx: right ? px(p.x) + 8 : px(p.x) - 8, anchor };
  });
  const unlabelled = flagged.slice(5);

  return (
    /* Fills its column rather than centring inside it. The cell is sized to the
       chart now, so a cap here only reopened the gap it was meant to close -- and
       at 544px the viewBox scaled by 1.05, which set every label at 8px against an
       app whose smallest type is 11. */
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img"
         aria-label={`Rule dependence against how often each question is answered. ${
           labelled.length} questions are read by three or more rules and answered on
           fewer than half of quotes.`}>
      {/* The corner is drawn by its edge, not by a wash. A 6% alert fill tints white
          faintly but LIGHTENS dark navy, so in the dark theme this became the most
          prominent object in the chart -- a pale slab behind the points it was only
          meant to bracket. A dashed hairline carries the same weight in both, which
          is the rule the status marks already follow: the mark carries the colour,
          the wash only points at it. */}
      <rect x={px(0)} y={py(maxY)} width={px(0.5) - px(0)} height={py(0) - py(maxY)}
            className="fill-alert-700/[0.04] stroke-alert-700/35"
            strokeWidth="1" strokeDasharray="3 3" />
      <text x={px(0) + 5} y={py(maxY) + 11} className="fill-alert-800" style={{ fontSize: 9 }}>
        read by many, answered by few
      </text>

      <line x1={pad.l} y1={py(0)} x2={w - pad.r} y2={py(0)} className="stroke-rule" strokeWidth="1" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={py(0)} className="stroke-rule" strokeWidth="1" />

      {[0, 0.5, 1].map((t) => (
        <text key={t} x={px(t)} y={h - 18} textAnchor="middle"
              className="fill-steel-600" style={{ fontSize: 9 }}>{Math.round(t * 100)}%</text>
      ))}
      <text x={px(0.5)} y={h - 4} textAnchor="middle" className="fill-steel-600"
            style={{ fontSize: 9 }}>of quotes answer it</text>
      {[0, maxY].map((v) => (
        <text key={v} x={pad.l - 5} y={py(v) + 3} textAnchor="end"
              className="fill-steel-600" style={{ fontSize: 9 }}>{v}</text>
      ))}
      <text x={4} y={pad.t - 6} className="fill-steel-600" style={{ fontSize: 9 }}>rules</text>

      {points.filter((p) => !p.flagged).map((p) => (
        <circle key={p.label} cx={px(p.x)} cy={py(p.y)} r={3} className="fill-instr-600" />
      ))}
      {unlabelled.map((p) => (
        <circle key={p.label} cx={px(p.x)} cy={py(p.y)} r={4.5} className="fill-alert-700" />
      ))}
      {labelled.map((p) => (
        <g key={p.label}>
          {/* A leader where the label had to move off its point, so the pairing stays
              readable rather than being inferred from proximity. */}
          <line x1={px(p.x)} y1={py(p.y)} x2={p.tx + (p.anchor === 'start' ? -3 : 3)} y2={p.ty - 3}
                className="stroke-alert-700/40" strokeWidth="1" />
          <circle cx={px(p.x)} cy={py(p.y)} r={4.5} className="fill-alert-700" />
          <text x={p.tx} y={p.ty} textAnchor={p.anchor} className="fill-steel-800"
                style={{ fontSize: 10 }}>{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
