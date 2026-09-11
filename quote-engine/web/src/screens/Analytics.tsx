import { useMemo } from 'react';
import { api, type Analytics as AnalyticsData, type AnalyticsField } from '../api';
import { ErrorNote, Panel, RuleCodeChip, Skeleton } from '../components/ui';
import {
  Bullet, Histogram, Ranked, Scatter, SplitBar, Strip, Tally, Waffle,
  type ChartTone, type ScatterPoint,
} from '../components/charts';
import { useApp, useAsync } from '../state/app';

/*
  THESIS: the application profile is the only record Axim has of what customers
  ASKED for, and it has never been read twice. This page reads it. It refuses the
  arrangement where a CPQ dashboard reports only on money.
  OWN-WORLD: the app's own instrument panel, unchanged — square sheets, hairline
  rules, legend bands, mono figures. Cool hues measure and warm hues judge: the
  distributions are steps of the instrument blue by band, and gold, green and the
  alert red are spent only where the sheet says something is wrong.
  STORY: a manager sees what is being asked for, an admin sees which questions the
  grading depends on and nobody answers, and both leave with something to change.
  FIRST VIEWPORT: four readings on the sheet, then "What customers are asking for"
  as ruled distributions; the questions-against-rules table follows.
  FORM: KPI tiles over a chart grid — candidate 1 of seven, the category standard,
  chosen by the user against the roll (surface seed 696114c3, which assigned 5).
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
  review, the verdict, and DESIGN.md.
*/

/**
 * What the quote set says, and what the enquiries behind it say.
 *
 * WHY THIS PAGE EXISTS
 *
 * Orbit records what was sold. The application profile is the only record of what was
 * ASKED FOR — 28 structured answers about a production line, per quote, including every
 * enquiry that went nowhere. Until now it existed to grade one configuration and was
 * then never read again.
 *
 * The two readings that are not available anywhere else sit in "The questions, and the
 * rules that read them": a field sixteen rules depend on that reps answer a tenth of
 * the time means the grading is running on air, and a field everybody answers that no
 * rule reads is a question asked for nothing. Both are actionable and neither is
 * visible from a quote.
 *
 * EVERY READING STATES ITS n
 *
 * Nobody knows the volume yet, so the denominator is on every panel and beside every
 * distribution. There was also a threshold below which shares were withheld and a
 * banner explained why; it was removed as unwanted. The `of n` beside each panel is
 * what remains, and it is doing that job — a reader who sees "3 of 5" is not going to
 * mistake 60% for a fact about the market.
 *
 * WHAT IT IS NOT
 *
 * Planning Analytics. That project answers where the stock is and when a line can ship,
 * against a star schema live in production. Nothing here reads a promise date or an
 * open order, so nothing here needs a freshness note — and if that ever changes, the
 * note is mandatory, because those numbers are up to a day old.
 */
export function Analytics() {
  const { session } = useApp();
  const a = useAsync(() => api.getAnalytics(), []);

  return (
    /* The frame every other screen uses: a bare `space-y-3` column with the title
       at `text-xl`. This had `wrap py-4` -- `wrap` is not a class this app defines,
       and the `py-4` doubled the shell's own padding -- over a title one step down
       at `text-lg`. So Analytics sat lower and read smaller than Quotes, Rules,
       Classification and Open orders. REPORTED: "some elements dont even match the
       other pages like the title".

       The standfirst went with it. No other screen carries one, and what it said --
       that every reading names the quote count behind it -- each panel already says
       for itself in its `Aside`. */
    <div className="space-y-3">
      <div>
        <h1 className="h-display text-xl">Analytics</h1>
      </div>

      {a.loading && <Skeleton rows={8} />}
      {a.error && <ErrorNote message={a.error} onRetry={a.reload} />}
      {a.data && <Board data={a.data} isAdmin={session?.role === 'admin'} />}
    </div>
  );
}

/**
 * How many bands one distribution draws before the tail becomes a sentence.
 *
 * Eight. Substrate produced twenty, seventeen of them a single quote — a list of every
 * material anybody has mentioned, occupying three panels' worth of height to say
 * almost nothing. A bar chart stops being one somewhere around here.
 */
const MAX_BANDS = 8;

/** The order a quote moves through, which is not the order of how many are in each. */
const LIFECYCLE: AnalyticsData['pipeline'][number]['status'][] = [
  'draft', 'pendingApproval', 'approved', 'sent', 'won', 'lost', 'expired',
];

/**
 * The pipeline's one use of colour, and it is a state rather than a category.
 *
 * Won and lost are outcomes and read as such; everything in flight is the instrument
 * blue at one weight. Colour is never the only channel — every segment is labelled
 * with its name and count directly beneath.
 */
function statusTone(label: string): string {
  if (label === 'Won') return 'bg-fit-700';
  if (label === 'Lost') return 'bg-alert-700';
  if (label === 'Awaiting approval') return 'bg-signal-600';
  return 'bg-instr-600';
}

function Board({ data, isAdmin }: { data: AnalyticsData; isAdmin: boolean }) {
  /* The fields worth a distribution, in the order the application asks them. A free
     text field has as many answers as it has quotes, so it carries no bands and
     appears only in the table below, where its fill rate is the reading that matters. */
  const distributions = useMemo(
    () => data.application.filter((f) => f.bands.length > 0), [data.application]);

  /* The two lists that are the point of the page. Ordered by how far apart the two
     numbers are, so the worst mismatch is the first row a reader meets. */
  const mismatches = useMemo(() => {
    const scored = data.application
      .filter((f) => f.ruleCount > 0 || f.answered > 0)
      .map((f) => ({
        ...f,
        /* Rules the grading leans on, against how often the question is answered.
           Both normalised to the quote count so a field is comparable with a field. */
        thin: f.ruleCount > 0 && data.quotes > 0
          ? f.ruleCount * (1 - f.answered / data.quotes) : 0,
      }));
    return scored.sort((x, y) => y.thin - x.thin || y.ruleCount - x.ruleCount);
  }, [data.application, data.quotes]);

  /* Only questions a rule actually reads. A field with no rule has nothing to plot
     against and would sit in a column on the floor, adding ink and no reading. */
  const scatter = useMemo<ScatterPoint[]>(
    () => data.application
      .filter((f) => f.ruleCount > 0)
      .map((f) => {
        const x = data.quotes > 0 ? f.answered / data.quotes : 0;
        return { label: f.label, x, y: f.ruleCount, flagged: f.ruleCount >= 3 && x < 0.5 };
      }),
    [data.application, data.quotes]);

  if (data.quotes === 0) {
    return (
      <Panel title="Nothing to report yet">
        <p className="px-3 py-10 text-center text-xs leading-relaxed text-steel-600">
          No quotes are visible to you, so there is nothing to count.
          <br />
          This page fills in as quotes are raised — it needs no setting up.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {/* The readings, as lit wells. One value per block: two competing readouts in
          one block is how a panel stops saying which number it exists to report. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile value={data.quotes} legend={`quotes · ${scopeWord(data.scope)}`} />
        <Tile value={data.described}
              legend={`captured an application, of ${data.quotes}`} />
        <Tile value={data.medianAnswered} of="28"
              legend="questions answered, median"
              /* 28 is a real, holdable total, so the part of it is drawn rather than
                 asserted — a reader sees at a glance how much of the form is empty. */
              figure={<Waffle filled={data.medianAnswered} total={28} />} />
        {/* The one tile that is a job rather than a count, so it is the one tile
            that takes a colour -- and only while there is something waiting. */}
        <Tile value={data.approvals.pending} legend="approvals waiting"
              tone={data.approvals.pending > 0 ? 'text-signal-700' : undefined} />
      </div>


      {/* ---------------------------------------------- what is being asked for */}
      <Panel title="What customers are asking for"
             aside={<Aside n={data.quotes} />}>
        {FORM_BANDS.map(({ form, legend, cols, tone }) => {
          const inBand = distributions.filter((f) => formOf(f) === form);
          if (inBand.length === 0) return null;
          return (
            <section key={form} className="band first:border-t-0">
              <p className="band-legend">
                <span>{legend}</span>
                {/* Counted in questions, not as a fraction. "2 of 14" on a band used
                    the same grammar as the "30 of 30" beside every field, where it
                    means answered of quotes -- one panel, one phrasing, two meanings. */}
                <span className="num !tracking-normal text-steel-600">
                  {inBand.length} questions
                </span>
              </p>
              <div className={`grid gap-x-6 gap-y-5 px-4 pb-4 pt-1 ${cols}`}>
                {inBand.map((f) => (
                  <FieldPanel key={f.field} field={f} quotes={data.quotes} tone={tone} />
                ))}
              </div>
            </section>
          );
        })}
      </Panel>

      {/* ------------------------------------- the reading nothing else can give */}
      <Panel title="The questions, and the rules that read them"
             aside={<span className="text-2xs text-steel-600">
               fill rate against rule dependence
             </span>}>
        <p className="border-b border-rule px-4 py-2.5 text-2xs leading-relaxed text-steel-700">
          A question the grading leans on and reps rarely answer means the verdicts are
          running on air. A question everybody answers that no rule reads is a question
          asked for nothing. Both are here, worst first.
        </p>
        {/* The shape of the problem, then the numbers. Two variables only make a
            relationship in two dimensions; the table under this is the precise form
            and the accessible one, and neither replaces the other. */}
        {/* The chart column is sized to the chart. Given a `1fr` it was a 544px
            drawing centred in a 950px cell, so it sat in 400px of empty sheet while
            the notes beside it wrapped every line. */}
        <div className="grid items-start gap-5 border-b border-rule px-4 py-3 lg:grid-cols-[minmax(0,39rem)_minmax(0,1fr)]">
          <Scatter points={scatter} />
          {/* The same finding in words, beside the picture rather than under it —
              it fills the space a centred chart leaves and it is the reading for
              anyone who does not read charts. */}
          <div>
            <p className="label mb-1.5">Read by many, answered by few</p>
            {scatter.filter((p) => p.flagged).length === 0 ? (
              <p className="text-2xs leading-relaxed text-steel-600">
                Nothing is in that corner. Every question the rules lean on is answered
                on at least half of quotes.
              </p>
            ) : (
              <ul className="space-y-1">
                {scatter.filter((p) => p.flagged)
                  .sort((a, b) => b.y - a.y)
                  .map((p) => (
                    <li key={p.label} className="text-2xs leading-snug text-steel-700">
                      <b className="num text-alert-800">{p.y}</b> rules read{' '}
                      <b className="text-steel-900">{p.label}</b>, answered on{' '}
                      <span className="num">{Math.round(p.x * 100)}%</span> of quotes
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[34rem]">
            <colgroup>
              <col style={{ width: '30%' }} /><col style={{ width: '34%' }} />
              <col style={{ width: '12%' }} /><col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Question</th>
                {/* No heading: the bar and the count beside it are one fact drawn
                    twice, and heading both of them "Answered" read as two columns
                    measuring different things. */}
                <th><span className="sr-only">Fill rate</span></th>
                <th className="n">Answered</th>
                <th className="n">Any</th>
                <th className="n">Rules</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((f) => (
                <tr key={f.field}>
                  <td>
                    <span className="block text-2xs leading-snug text-steel-900">{f.label}</span>
                    <Verdict answered={f.answered} rules={f.ruleCount} quotes={data.quotes} />
                  </td>
                  <td>
                    <Meter value={f.answered} total={data.quotes} rules={f.ruleCount} />
                  </td>
                  <td className="n">{f.answered}</td>
                  <td className="n">{f.noConstraint || <Dash />}</td>
                  <td className="n">{f.ruleCount || <Dash />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* --------------------------------------------------------- the quote set */}
      {/* `items-start`, so a four-row table beside a twelve-row list is four rows
          tall. Stretched to match its neighbour it carried 500px of empty sheet. */}
      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Panel title="Where the quotes are" aside={<Aside n={data.quotes} />}>
          <div className="p-4">
            {/* In the order a quote MOVES through, not by size. A pipeline sorted by
                count is a bar chart of statuses; in lifecycle order the same strip
                shows where work is piling up. */}
            <Strip tone={statusTone}
                   bands={LIFECYCLE
                     .map((st) => data.pipeline.find((p) => p.status === st))
                     .filter((p): p is typeof data.pipeline[number] => Boolean(p))
                     .map((p) => ({ label: statusWord(p.status), count: p.count }))} />
          </div>
        </Panel>

        <Panel title="Discount asked for"
               aside={<span className="text-2xs text-steel-600">against the stated maximum</span>}>
          <div className="space-y-4 p-4">
            {data.discounts.filter((d) => d.bands.length > 0).map((d) => (
              <div key={d.code}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="label">{d.displayName}</span>
                  {d.overCeiling > 0 && (
                    <b className="num text-2xs text-alert-800">
                      {d.overCeiling} past the maximum
                    </b>
                  )}
                </div>
                <Bullet bands={d.bands} over={d.overCeiling}
                        ceilingLabel={d.ceiling == null ? 'no stated maximum'
                          : `maximum ${Math.round(d.ceiling * 100)}%`} />
              </div>
            ))}
            {data.discounts.every((d) => d.bands.length === 0) && (
              <p className="py-6 text-center text-2xs text-steel-600">
                No discount has been asked for on any visible quote.
              </p>
            )}
          </div>
        </Panel>
      </div>

      {/* ------------------------------------------------------ rules, for admin */}
      {isAdmin && (
        <div className="grid items-start gap-3 xl:grid-cols-2">
          <Panel title="What the rules did"
                 aside={<span className="text-2xs text-steel-600">from the stored trace</span>}>
            {data.rules.length === 0 ? (
              <p className="px-3 py-8 text-center text-2xs text-steel-600">
                No rule has spoken on a visible quote yet.
              </p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr><th>Rule</th><th className="n">Quotes</th><th className="n">Blocked</th></tr>
                </thead>
                <tbody>
                  {data.rules.map((r) => (
                    <tr key={r.ruleCode}>
                      <td>
                        {/* A rule code is a link to the rule, here as everywhere else.
                            Citing one as plain text makes this the only screen in the
                            app where reading a finding and reading the rule behind it
                            are two different jobs. */}
                        <RuleCodeChip code={r.ruleCode} />
                        <span className="mt-0.5 block text-2xs leading-snug text-steel-700">
                          {r.summary}
                        </span>
                      </td>
                      <td className="n">{r.fired}</td>
                      <td className="n">{r.blocked || <Dash />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Live rules that have never fired"
                 aside={<span className="num text-2xs text-steel-600">
                   {data.neverFired.length}
                 </span>}>
            <p className="border-b border-rule px-4 py-2.5 text-2xs leading-relaxed text-steel-700">
              Active, and no visible quote has ever met their conditions. Either the
              quotes have not come up yet, or the rule cannot fire as written.
            </p>
            {data.neverFired.length === 0 ? (
              <p className="px-3 py-8 text-center text-2xs text-steel-600">
                Every live rule has fired at least once.
              </p>
            ) : (
              <ul className="divide-y divide-steel-100">
                {data.neverFired.map((r) => (
                  <li key={r.ruleCode} className="px-4 py-2">
                    <RuleCodeChip code={r.ruleCode} />
                    <span className="mt-0.5 block text-2xs leading-snug text-steel-700">
                      {r.summary}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- the parts */

/**
 * One reading, on the sheet rather than in a well.
 *
 * `.readout` — the recessed navy well with cyan figures — is the app's lead-figure
 * device, and four of them in a row was the first thing tried here. Reported: the dark
 * ground is wrong for these. It is: a well is for the ONE value a block exists to
 * report, and a row of four wells is four things each claiming to be the one. On a
 * page that is nothing but readings, the figure carries itself.
 *
 * `.readout-light` is the system's own answer to that — the same value at the same
 * size, stated on the sheet — so this uses it rather than inventing a third form.
 */
function Tile({ value, legend, of, figure, tone }: {
  value: number; legend: string; of?: string; figure?: React.ReactNode; tone?: string;
}) {
  return (
    /* The legend sits on the floor of the tile rather than under a reserved blank
       line. `min-h-[2.4em]` held two lines open for captions that mostly need one,
       which put a dead band across the bottom of every tile in the row; pushed down
       instead, the four captions share a baseline because the tiles are the same
       height, not because each one carries the same padding.

       `items-start` keeps the figure from centring itself against the number: the
       waffle is four rows tall, so centred it dragged its own reading down out of
       line with the three beside it. */
    <div className="panel flex min-h-[4.5rem] flex-col justify-between gap-2 px-4 py-3">
      {/* The reading does not break across lines. In a half-width tile at 375px
          "8 / 28" wrapped after the solidus and dropped the 28 onto its own line
          beside the waffle, so the one figure on the tile read as two. */}
      <span className="flex items-start justify-between gap-2">
        <span className={`readout-light whitespace-nowrap ${tone ?? ''}`}>
          {value.toLocaleString()}
          {of && <span className="ml-1 text-sm text-steel-500">/ {of}</span>}
        </span>
        {figure && <span className="shrink-0">{figure}</span>}
      </span>
      <p className="label !normal-case !tracking-normal !text-steel-600">{legend}</p>
    </div>
  );
}

/**
 * One question's answers, in whichever form the answers are.
 *
 * The form is not a style choice — it is the only honest reading of each shape. A
 * scale keeps its order and gets columns; two answers are one proportion and get one
 * split strip; overlapping answers cannot be a share of anything and get counted; and
 * a long tail gets ranked stems, which carry the same lengths at a fraction of the ink
 * that made a page of solid bars unreadable.
 */
function FieldPanel({ field, quotes, tone }: {
  field: AnalyticsField; quotes: number; tone: ChartTone;
}) {
  const { bands } = field;
  const form = formOf(field);
  const shown = bands.slice(0, MAX_BANDS);
  const tail = bands.length - shown.length;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="label">{field.label}</span>
        <span className="num text-2xs text-steel-600">{field.answered} of {quotes}</span>
      </div>

      {form === 'scale' ? <Histogram bands={bands} tone={tone} />
        : field.multi ? <Tally bands={shown} tone={tone} />
        : form === 'split' ? <SplitBar bands={bands} tone={tone} />
        : <Ranked bands={shown} total={quotes} tail={tail || undefined} tone={tone} />}

      {field.multi && (
        <p className="mt-1.5 text-[10px] leading-snug text-steel-600">
          A line can be more than one of these, so these count past the quotes.
        </p>
      )}
    </div>
  );
}

/**
 * Which of the three shapes a question's answers take.
 *
 * `FieldPanel` picks its drawing from this and the sheet groups by it, so the two
 * cannot come to disagree about what a field is.
 */
type Form = 'list' | 'scale' | 'split';

function formOf(f: AnalyticsField): Form {
  if (f.ordered) return 'scale';
  if (f.multi) return 'list';
  return f.bands.length === 2 ? 'split' : 'list';
}

/**
 * The sheet divides by the shape of the answer, not by the order the form asks.
 *
 * Laid out in asking order, a three-column grid sized every row to its tallest cell:
 * substrate's ranked list stood beside two one-bar splits and left two holes about
 * 380px deep, and the panel came out more than half empty sheet. Grouped by form,
 * every cell in a row is the same drawing, so every row is the same height and the
 * holes have nowhere to open.
 *
 * It also says something asking-order did not: these questions take three kinds of
 * answer, and each kind is read a different way. Order within a band is still the
 * order the application asks.
 */
const FORM_BANDS: { form: Form; legend: string; cols: string; tone: ChartTone }[] = [
  { form: 'list', legend: 'Named answers', cols: 'sm:grid-cols-2', tone: 'deep' },
  { form: 'scale', legend: 'Measured, in bands', cols: 'sm:grid-cols-2 xl:grid-cols-3', tone: 'mid' },
  { form: 'split', legend: 'One of two', cols: 'sm:grid-cols-2 xl:grid-cols-3', tone: 'cyan' },
];

/**
 * What this row says about the grading, as one word.
 *
 * `Meter` colours by it and `Verdict` writes it out, from this one function, so the
 * bar and the sentence beside it can never disagree about which rows are the
 * problem ones.
 */
type Finding = 'thin' | 'unread' | 'sound' | 'plain';

function finding(answered: number, rules: number, quotes: number): Finding {
  if (quotes === 0) return 'plain';
  const share = answered / quotes;
  if (rules >= 3 && share < 0.4) return 'thin';
  if (rules === 0 && share > 0.6) return 'unread';
  if (rules > 0 && share >= 0.6) return 'sound';
  return 'plain';
}

/**
 * The fill-rate bar, in the colour of what it found.
 *
 * This is where the sheet's warm hues are spent, and the only place they mean
 * anything: twenty rows of identical blue made the two findings the page exists for
 * something you had to read every line to find. Red is grading running on air, gold
 * is a question asked for nothing, green is a question the rules read and the reps
 * answer. Colour is not the only channel -- the count, the rule count and the
 * `Verdict` sentence all state the same thing, and `plain` rows stay blue.
 */
const METER: Record<Finding, { fill: string; track: string }> = {
  thin: { fill: 'bg-alert-600', track: 'bg-alert-600/15' },
  unread: { fill: 'bg-signal-600', track: 'bg-signal-600/15' },
  sound: { fill: 'bg-fit-600', track: 'bg-fit-600/15' },
  plain: { fill: 'bg-instr-600', track: 'bg-instr-600/15' },
};

function Meter({ value, total, rules }: {
  value: number; total: number; rules: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const m = METER[finding(value, rules, total)];
  return (
    <span className={`block h-1.5 ${m.track}`}
          role="img"
          aria-label={`answered on ${value} of ${total} quotes`}>
      {/* Zero draws nothing. A one-percent floor gave an unanswered question a visible
          nub, so a field no quote has ever filled in looked like a field one had. */}
      <span className={`block h-full ${m.fill}`}
            style={{ width: value > 0 ? `${Math.max(1, pct)}%` : 0 }} />
    </span>
  );
}

/**
 * What this row actually means, in words.
 *
 * The two numbers beside each other are the finding, and a reader should not have to
 * do the division to see it. Only stated where it is true — most rows are neither
 * thing and get nothing, because a verdict on every row is a verdict on none.
 */
function Verdict({ answered, rules, quotes }: {
  answered: number; rules: number; quotes: number;
}) {
  const share = quotes > 0 ? answered / quotes : 0;
  switch (finding(answered, rules, quotes)) {
    case 'thin':
      return (
        <span className="mt-0.5 block text-[10px] leading-snug text-alert-800">
          {rules} rules read this, and {Math.round(share * 100)}% of quotes answer it
        </span>
      );
    case 'unread':
      return (
        <span className="mt-0.5 block text-[10px] leading-snug text-signal-800">
          asked on most quotes, read by no rule
        </span>
      );
    /* `sound` says nothing. The bar is green and that is the whole message; a
       sentence on every healthy row is a verdict on none, which is why only the
       two faults were ever worded. */
    default:
      return null;
  }
}

const Dash = () => <span className="text-steel-500" aria-label="none">—</span>;

function Aside({ n }: { n: number }) {
  return <span className="num text-2xs text-steel-600">{n} quotes</span>;
}

function scopeWord(scope: AnalyticsData['scope']) {
  return scope === 'mine' ? 'yours' : scope === 'team' ? 'your team' : 'everyone';
}

function statusWord(status: string) {
  return ({
    draft: 'Draft', pendingApproval: 'Awaiting approval', approved: 'Approved',
    sent: 'Sent', won: 'Won', lost: 'Lost', expired: 'Expired',
  } as Record<string, string>)[status] ?? status;
}
