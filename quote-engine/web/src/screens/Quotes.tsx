import { useState } from 'react';
import { api, type QuoteStatus } from '../api';
import { QUOTE_STATUS_WORD, word } from '../api/words';
import { useApp, useAsync } from '../state/app';
import { Empty, ErrorNote, Panel, Segmented, Skeleton, Status, Toolbar, money, pct, shortDate } from '../components/ui';

const STATUS_TONE: Record<QuoteStatus, string> = {
  draft: 'muted', pendingApproval: 'warn', approved: 'ok', sent: 'active', won: 'ok',
  lost: 'muted', expired: 'block',
};
/* The words live in api/words.ts now. This map was here and the quote DETAIL screen had
   none, which is how the same status read "Awaiting approval" in the list and
   "PENDINGAPPROVAL" on the quote itself. */

/**
 * Starting a quote is what this tool is FOR, so it gets the top of the screen
 * rather than a button in the corner.
 *
 * Three doors, equally weighted, as the prototype had them. Experienced reps do
 * not start from a wizard — most start from last quarter's quote for the same
 * account, or from a printer they have already decided to sell. Burying two of
 * those behind the third is how a tool ends up being used for one thing.
 */
function StartAQuote({ recent }: { recent: { quoteNo: string; customerName: string | null; lineName: string | null }[] }) {
  const { go, notify } = useApp();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  /* Copies, rather than opening. The door used to navigate to the original,
     which meant editing last quarter's record instead of starting from it. */
  async function copyFrom(quoteNo: string) {
    setBusy(true);
    try {
      const copy = await api.duplicateQuote(quoteNo);
      notify(`${copy.quoteNo} started from ${quoteNo}.`);
      go({ name: 'editQuote', quoteNo: copy.quoteNo });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not copy that quote.');
    } finally { setBusy(false); setPicking(false); }
  }

  const doors = [
    {
      title: 'Describe the application',
      body: 'Paste the customer’s email. The tool reads it, grades the machines against it and shows which rule produced each answer.',
      action: 'Start from an enquiry',
      primary: true,
      onClick: () => go({ name: 'newQuote' }),
    },
    {
      title: 'Start from a previous quote',
      body: 'Same account, same line, new season. Copies the configuration and the application into a new quote.',
      action: picking ? 'Pick one' : 'Choose a quote',
      primary: false,
      onClick: () => setPicking((v) => !v),
    },
    {
      title: 'Start from a machine',
      body: 'For when you already know what you are selling. Opens on the machine list, with the rules still checking as you go.',
      action: 'Pick a machine',
      primary: false,
      // Not the same destination as the enquiry door. It used to be, which is what
      // made this one pointless — two doors into the identical screen.
      onClick: () => go({ name: 'newQuote', start: 'machine' }),
    },
  ];

  return (
    <Panel title="Start a quote">
      {/* Three panes of one sheet, divided by rules — not three bordered boxes
          inside a bordered panel, which is a card inside a card. Priority is
          carried by fill, which is how an instrument marks the action it expects.

          The fill is navy. It was instr-700, a mid blue that sat close enough to the
          two white panes beside it to read as a tint rather than a choice — and this
          is the door the tool is built around: describing the application is what
          produces the grades, the ranking and the price book. Navy is the deepest
          colour in the brand, so the pane the tool wants opened is the one that
          carries it. */}
      <div className="grid divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {doors.map((d) => (
          <button
            key={d.title}
            type="button"
            onClick={d.onClick}
            className={`group flex min-w-0 flex-col p-4 text-left transition-colors ${
              d.primary
                ? 'bg-navy-900 text-white hover:bg-navy-800'
                : 'bg-surface hover:bg-navy-50'}`}
          >
            <span className={`h-display text-sm ${d.primary ? 'text-white' : ''}`}>{d.title}</span>
            <span className={`mt-1.5 flex-1 text-xs leading-relaxed ${
              d.primary ? 'text-navy-100' : 'text-steel-600'}`}>
              {d.body}
            </span>
            <span className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${
              d.primary ? 'text-white' : 'text-instr-700'}`}>
              {d.action}
              {/* Drawn, in the same stroke as the disclosure chevron, rather than
                  a → character whose weight and baseline belong to the font. */}
              <svg aria-hidden viewBox="0 0 14 12" width="13" height="11"
                   className="shrink-0 transition-transform group-hover:translate-x-0.5">
                <path d="M1 6h10.5M8 2.5 11.5 6 8 9.5" fill="none" stroke="currentColor"
                      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {picking && (
        <div className="border-t border-rule">
          {recent.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-steel-600">
              No previous quote to copy yet.
            </p>
          ) : (
            <ul className="divide-y divide-steel-100">
              {recent.slice(0, 8).map((r) => (
                <li key={r.quoteNo}>
                  <button type="button" disabled={busy} onClick={() => copyFrom(r.quoteNo)}
                          className="grid w-full grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-left hover:bg-steel-50 disabled:opacity-60">
                    <span className="num text-xs font-semibold text-steel-900">{r.quoteNo}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-steel-900">{r.customerName}</span>
                      <span className="block truncate text-2xs text-steel-600">{r.lineName}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

export function Quotes() {
  const { go, session } = useApp();
  const [status, setStatus] = useState<QuoteStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const quotes = useAsync(() => api.listQuotes({ status, q }), [status, q]);

  const isApprover = session?.role === 'approver' || session?.role === 'admin';
  const awaiting = (quotes.data ?? []).filter((x) => x.approvalsPending > 0);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="h-display text-xl">Quotes</h1>
      </div>

      <StartAQuote recent={quotes.data ?? []} />

      {isApprover && awaiting.length > 0 && (
        <Panel title={`Waiting on you (${awaiting.length})`}>
          <ul className="divide-y divide-steel-100">
            {awaiting.map((x) => (
              <li key={x.quoteNo}>
                {/* Four things inline needs the width of a desk. At 375px it
                    squeezed "Midwest Foods" to "Midwe…" and wrapped the line name
                    over four lines, so on a phone it stacks — the same shape the
                    quotes list below it uses. */}
                <button type="button" onClick={() => go({ name: 'quote', quoteNo: x.quoteNo })}
                        className="flex w-full flex-col gap-1.5 px-4 py-2.5 text-left hover:bg-signal-100/60 sm:flex-row sm:items-center sm:gap-3">
                  <span className="flex items-baseline justify-between gap-3 sm:justify-start">
                    <span className="num text-xs font-semibold text-steel-900">{x.quoteNo}</span>
                    <span className="sm:hidden"><Status tone="warn">{x.approvalsPending} to decide</Status></span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-steel-800">{x.customerName}</span>
                    <span className="block truncate text-2xs text-steel-600">{x.lineName}</span>
                    {/* Why, not just how much. An approver's queue is a list of
                        decisions, and "45% against a stated 30%" says what is being
                        asked while only the rep's own sentence says whether it is
                        worth granting. */}
                    {x.approvalNote && (
                      <span className="mt-0.5 block truncate text-2xs italic text-steel-700">
                        “{x.approvalNote}”
                      </span>
                    )}
                  </span>
                  {x.requestedPct != null && (
                    <span className="num shrink-0 text-xs font-semibold text-signal-800">
                      {pct(x.requestedPct)}
                    </span>
                  )}
                  <span className="num text-xs text-steel-700">{money(x.orderTotal)}</span>
                  <span className="hidden sm:block">
                    <Status tone="warn">{x.approvalsPending} to decide</Status>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <Toolbar>
          <input className="field max-w-xs text-sm" type="search" aria-label="Search quotes"
                 placeholder="Search quote number, customer, line…"
                 value={q} onChange={(e) => setQ(e.target.value)} />
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'draft', label: 'Draft' },
              { value: 'pendingApproval', label: 'Awaiting approval' },
              { value: 'sent', label: 'Sent' },
              { value: 'won', label: 'Won' },
            ]}
          />
          <span className="num ml-auto text-2xs text-steel-600">
            {quotes.data ? `${quotes.data.length} quotes` : ''}
          </span>
        </Toolbar>

        {quotes.loading && <Skeleton rows={6} />}
        {quotes.error && <ErrorNote message={quotes.error} onRetry={quotes.reload} />}

        {quotes.data && quotes.data.length === 0 && (
          <Empty
            title="Nothing here yet"
            action={<button type="button" className="btn-primary text-sm"
                            onClick={() => go({ name: 'newQuote' })}>Start a quote</button>}
          >
            A quote starts from the application — what the line runs, how fast, onto what. The tool
            grades the configuration against that and shows you which rule produced each answer.
          </Empty>
        )}

        {/* On a phone, one quote per row rather than a 52rem table dragged sideways.
            The order is the order the question gets asked: which quote, whose, how
            much, and where it has got to. Not a card — a card would put a border
            around each and turn a list into a grid of boxes. */}
        {quotes.data && quotes.data.length > 0 && (
          <ul className="divide-y divide-steel-100 md:hidden">
            {quotes.data.map((x) => (
              <li key={x.quoteNo}>
                <button
                  type="button"
                  onClick={() => go({ name: 'quote', quoteNo: x.quoteNo })}
                  className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-instr-100/40"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="num text-xs font-semibold text-steel-900">{x.quoteNo}</span>
                    {/* compact on the phone: the record list gives this row to the quote
                        number, and a two-line readout on a baseline-aligned row sits wrong. */}
                    <Status compact tone={STATUS_TONE[x.status]}>{word(QUOTE_STATUS_WORD, x.status)}</Status>
                  </span>
                  <span className="block min-w-0">
                    <span className="block truncate text-sm text-steel-900">
                      {x.customerName ?? '—'}
                    </span>
                    <span className="block truncate text-2xs text-steel-600">{x.lineName}</span>
                  </span>
                  <span className="flex items-baseline justify-between gap-3 text-2xs text-steel-600">
                    <span className="num text-xs font-semibold text-steel-900">
                      {money(x.orderTotal)}
                    </span>
                    <span>
                      <span className="num">{x.technologyCode}</span>
                      {' · '}
                      <span className="num">{x.lineCount}</span> lines
                      {' · '}
                      {shortDate(x.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {quotes.data && quotes.data.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="tbl min-w-[52rem]">
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Customer</th>
                  <th>Tech</th>
                  <th className="n">Lines</th>
                  <th className="n">Order total</th>
                  <th>Updated</th>
                  <th className="n">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* A row you can reach. It was <tr onClick> with no tabIndex, no role and
                    no key handler, so the main way into a quote worked only with a mouse.
                    The quote number is the affordance, so it carries the button. */}
                {quotes.data.map((x) => (
                  <tr key={x.quoteNo} className="pick"
                      onClick={() => go({ name: 'quote', quoteNo: x.quoteNo })}>
                    <td className="num font-semibold text-steel-900">
                      <button type="button" className="text-left hover:underline"
                              onClick={(e) => { e.stopPropagation(); go({ name: 'quote', quoteNo: x.quoteNo }); }}>
                        {x.quoteNo}
                      </button>
                    </td>
                    <td>
                      <span className="block text-steel-900">{x.customerName ?? '—'}</span>
                      <span className="block text-2xs text-steel-600">{x.lineName}</span>
                    </td>
                    <td className="num text-steel-700">{x.technologyCode}</td>
                    <td className="n text-steel-700">{x.lineCount}</td>
                    <td className="n text-steel-900">{money(x.orderTotal)}</td>
                    <td className="text-steel-600">{shortDate(x.updatedAt)}</td>
                    <td className="stat-cell">
                      <Status tone={STATUS_TONE[x.status]}>{word(QUOTE_STATUS_WORD, x.status)}</Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
