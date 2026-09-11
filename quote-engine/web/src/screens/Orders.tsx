import { useEffect, useState } from 'react';
import { api, type CustomerHit, type OpenOrder } from '../api';
import { useAsync } from '../state/app';
import {
  DueDate, Empty, ErrorNote, FreshnessNote, Panel, Skeleton, Status, shortDate,
} from '../components/ui';

/**
 * The phone-is-ringing screen.
 *
 * A customer calls and asks where their order is. The rep has seconds, not
 * minutes, so this opens focused on a customer search and answers the question
 * at three depths: which orders are open, when each will be ready, and — if
 * pressed — why that date and not an earlier one.
 */
export function Orders({ customerNo }: { customerNo: string | null }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(customerNo);

  const allCustomers = useAsync(() => api.searchCustomers(q), [q]);

  /* Only accounts with something open.
     This screen exists to answer "where is my order", and half the list was
     accounts showing "0 open" — rows that cannot answer it. A customer whose
     orders have all shipped is not a search result here; they are a quote.
     Searching by name still reaches them, because a rep typing a name wants to
     know the answer is "nothing outstanding" rather than "no such customer". */
  const customers = {
    ...allCustomers,
    data: allCustomers.data?.filter((c) => c.openOrders > 0 || q.trim().length > 0),
  };
  const hiddenIdle = (allCustomers.data ?? []).filter((c) => c.openOrders === 0).length;
  const orders = useAsync(
    async () => (selected ? api.listOpenOrders(selected) : []),
    [selected],
  );

  useEffect(() => { if (customerNo) setSelected(customerNo); }, [customerNo]);

  const chosen = (customers.data ?? []).find((c) => c.customerNo === selected);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="h-display text-xl">Open orders</h1>
      </div>

      <div className="grid gap-3 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Panel title="Customer" className="min-w-0">
          <div className="border-b border-rule p-3">
            <input
              className="field text-sm"
              type="search"
              autoFocus
              aria-label="Search customers"
              placeholder="Customer name or number…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {customers.loading && <Skeleton rows={4} />}
          {customers.error && <ErrorNote message={customers.error} onRetry={customers.reload} />}
          {customers.data && customers.data.length === 0 && (
            <Empty title={q.trim() ? 'No customer matches that' : 'Nothing outstanding anywhere'}>
              {q.trim()
                ? 'Search by account number or any part of the name.'
                : 'No account has an open order. Search a name to check a specific one.'}
            </Empty>
          )}
          {!q.trim() && hiddenIdle > 0 && (customers.data?.length ?? 0) > 0 && (
            <p className="border-b border-rule px-3 py-2 text-2xs text-steel-600">
              {hiddenIdle} account{hiddenIdle === 1 ? '' : 's'} with nothing outstanding
              {hiddenIdle === 1 ? ' is' : ' are'} not listed. Search a name to reach{' '}
              {hiddenIdle === 1 ? 'it' : 'them'}.
            </p>
          )}
          {customers.data && customers.data.length > 0 && (
            <ul className="divide-y divide-steel-100">
              {customers.data.map((c: CustomerHit) => {
                const on = c.customerNo === selected;
                return (
                  <li key={c.customerNo}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => setSelected(c.customerNo)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        on ? 'bg-instr-100' : 'hover:bg-steel-50'}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-steel-900">
                          {c.customerName}
                        </span>
                        <span className="num block text-2xs text-steel-600">{c.customerNo}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="num text-2xs text-steel-700">{c.openOrders} open</span>
                        {c.lateOrders > 0 && <Status tone="block">{c.lateOrders} late</Status>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="min-w-0 space-y-3">
          {!selected && (
            <Panel>
              <Empty title="Pick a customer">
                Their open orders appear here with a committed date, an expected ready date, and the
                reason behind it — enough to answer the question without putting anyone on hold.
              </Empty>
            </Panel>
          )}

          {/* The skeleton is for having nothing to show, not for being busy.
              useAsync keeps the last answer while it fetches the next, so switching
              customers rendered an empty panel headed "Open orders" ABOVE the
              previous customer's cards — a blank table that appeared for a second
              every time. It shows only when there is genuinely nothing yet. */}
          {selected && orders.loading && !orders.data && (
            <Panel title="Open orders"><Skeleton rows={5} /></Panel>
          )}
          {selected && orders.error && <ErrorNote message={orders.error} onRetry={orders.reload} />}

          {/* And "nothing open" waits until that is actually known, rather than
              flashing between two customers who both have orders. */}
          {selected && !orders.loading && orders.data && orders.data.length === 0 && (
            <Panel>
              <Empty title={`${chosen?.customerName ?? 'This customer'} has nothing open`}>
                Every line they have ordered has shipped. Anything new starts as a quote.
              </Empty>
            </Panel>
          )}

          {/* Held on screen while the next answer arrives, and faded so it does not
              read as final. Replacing it with a blank was the worse of the two. */}
          <div className={orders.loading && orders.data ? 'opacity-50 transition-opacity' : ''}>
            {selected && orders.data?.map((o) => <OrderCard key={o.ordNo} order={o} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: OpenOrder }) {
  const [open, setOpen] = useState(true);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2.5">
          <span className="num">Order {order.ordNo}</span>
          {order.lateLines > 0
            ? <Status tone="block">{order.lateLines} line{order.lateLines === 1 ? '' : 's'} late</Status>
            : <Status tone="ok">on schedule</Status>}
        </span>
      }
      aside={
        <button type="button" className="btn-quiet text-xs" onClick={() => setOpen((v) => !v)}
                aria-expanded={open}>
          {open ? 'Hide lines' : `Show ${order.openLines} lines`}
        </button>
      }
    >
      {/* the answer, before any detail */}
      <div className="grid gap-4 border-b border-rule bg-steel-50 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="label">Expected ready</p>
          <p className="readout-sm mt-1">
            {order.expectedReadyDt ? shortDate(order.expectedReadyDt) : 'not yet datable'}
          </p>
          <p className="mt-0.5 text-2xs text-steel-600">
            the slowest line on the order decides this
          </p>
        </div>
        <div>
          <p className="label">Committed date</p>
          <p className="mt-0.5">
            <DueDate date={order.earliestDueDt} daysLate={order.worstDaysLate} />
          </p>
          <p className="mt-0.5 text-2xs text-steel-600">earliest line</p>
        </div>
        <div>
          <p className="label">Still outstanding</p>
          <p className="readout-sm mt-1">{order.qtyOpen}</p>
          <p className="mt-0.5 text-2xs text-steel-600">
            across {order.openLines} line{order.openLines === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* A phone gets the order lines stacked, because this is the screen a rep opens
          with a customer on the phone and a 44rem table is a two-handed job. Each
          line leads with the part and the date, which is the whole question; the
          promise explanation stays, because a date without its reason is a guess a
          rep would have to defend. */}
      {open && (
        <ul className="divide-y divide-steel-100 md:hidden">
          {order.lines.map((l) => (
            <li key={l.lineSeqNo}
                className={`px-4 py-3 ${l.isLate ? 'bg-alert-100/40' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="num text-xs font-semibold text-steel-900">{l.itemNo}</span>
                <Status compact tone={l.isLate ? 'block' : l.statusLabel === 'Picked' ? 'ok' : 'info'}>
                  {l.statusLabel}
                </Status>
              </div>
              <p className="mt-0.5 text-2xs leading-snug text-steel-600">{l.description}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-2xs">
                <div>
                  <dt className="text-steel-600">Open</dt>
                  <dd className="num text-xs text-steel-900">
                    {l.qtyOpen}
                    {l.qtyBackordered > 0 && (
                      <span className="ml-1 text-2xs text-signal-800">({l.qtyBackordered} b/o)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-steel-600">Committed</dt>
                  <dd><DueDate date={l.dueDt} daysLate={l.daysLate} /></dd>
                </div>
              </dl>
              <div className="mt-2">
                <p className="text-2xs text-steel-600">Expected ready</p>
                {l.ladderPromisedDt ? (
                  <>
                    <p className="num text-xs font-semibold text-steel-900">
                      {shortDate(l.ladderPromisedDt)}
                    </p>
                    {l.promiseExplanation && (
                      <p className="mt-0.5 text-2xs leading-snug text-steel-600">
                        {l.promiseExplanation}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-2xs text-steel-600">no supply covers this quantity yet</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="hidden overflow-x-auto md:block">
          <table className="tbl min-w-[44rem]">
            <thead>
              <tr>
                <th className="n">Line</th>
                <th>Part</th>
                <th className="n">Open</th>
                <th>Committed</th>
                <th>Expected ready</th>
                <th className="n">Status</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.lineSeqNo} className={l.isLate ? 'bg-alert-100/40' : ''}>
                  <td className="n text-steel-600">{l.lineSeqNo}</td>
                  <td>
                    <span className="num block text-steel-900">{l.itemNo}</span>
                    <span className="block text-2xs text-steel-600">{l.description}</span>
                  </td>
                  <td className="n">
                    {l.qtyOpen}
                    {l.qtyBackordered > 0 && (
                      <span className="ml-1 text-2xs text-signal-800">({l.qtyBackordered} b/o)</span>
                    )}
                  </td>
                  <td><DueDate date={l.dueDt} daysLate={l.daysLate} /></td>
                  <td>
                    {l.ladderPromisedDt ? (
                      <>
                        <span className="num block text-xs font-semibold text-steel-900">
                          {shortDate(l.ladderPromisedDt)}
                        </span>
                        {l.promiseExplanation && (
                          <span className="mt-0.5 block max-w-md text-2xs leading-snug text-steel-600">
                            {l.promiseExplanation}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-2xs text-steel-600">
                        no supply covers this quantity yet
                      </span>
                    )}
                  </td>
                  <td className="stat-cell">
                    <Status compact tone={l.isLate ? 'block' : l.statusLabel === 'Picked' ? 'ok' : 'info'}>
                      {l.statusLabel}
                    </Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-rule px-4 py-2">
        <FreshnessNote asOf={order.asOf} freshness={order.freshness} />
      </div>
    </Panel>
  );
}
