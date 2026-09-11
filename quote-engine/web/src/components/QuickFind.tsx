import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type CustomerHit, type QuoteSummary } from '../api';
import { useApp } from '../state/app';
import { Status } from './ui';

/**
 * Ctrl-K, or the button in the bar.
 *
 * The most time-critical thing this tool does is answer a phone call: a
 * customer wants to know where their order is, and the rep is listening rather
 * than navigating. Two keystrokes to a customer's open orders is the difference
 * between answering and calling back.
 *
 * Deliberately a dialog rather than an inline panel — it takes the whole
 * attention for the two seconds it exists, then gets out of the way.
 */
type Hit =
  | { kind: 'customer'; id: string; title: string; sub: string; late: number }
  | { kind: 'quote'; id: string; title: string; sub: string; late: number };

export function QuickFind() {
  const { go } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd-K anywhere, Escape to leave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 20); }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = window.setTimeout(() => {
      void Promise.all([api.searchCustomers(q), api.listQuotes({ q })]).then(([c, s]) => {
        if (!alive) return;
        setCustomers(c.slice(0, 6));
        setQuotes(s.slice(0, 5));
        setCursor(0);
      });
    }, 130);
    return () => { alive = false; window.clearTimeout(t); };
  }, [q, open]);

  const hits = useMemo<Hit[]>(() => [
    ...customers.map((c) => ({
      kind: 'customer' as const, id: c.customerNo, title: c.customerName,
      sub: `${c.customerNo} · ${c.openOrders} open order${c.openOrders === 1 ? '' : 's'}`,
      late: c.lateOrders,
    })),
    ...quotes.map((s) => ({
      kind: 'quote' as const, id: s.quoteNo, title: s.quoteNo,
      sub: `${s.customerName ?? 'no customer'} · ${s.lineName ?? ''}`,
      late: 0,
    })),
  ], [customers, quotes]);

  function choose(h: Hit) {
    setOpen(false);
    setQ('');
    if (h.kind === 'customer') go({ name: 'orders', customerNo: h.id });
    else go({ name: 'quote', quoteNo: h.id });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded border border-navy-600 bg-navy-950 px-2.5 py-1 text-2xs text-navy-300 transition-colors hover:border-instr-400 hover:text-white md:flex"
      >
        <span>Find a customer or quote</span>
        <kbd className="rounded border border-navy-600 px-1 py-0.5 font-mono text-[10px] text-navy-300">
          Ctrl K
        </kbd>
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-backdrop bg-navy-950/50" onClick={() => setOpen(false)} aria-hidden />
      <div
        role="dialog"
        aria-label="Find a customer or quote"
        className="slide-in fixed left-1/2 top-24 z-modal w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-rule bg-surface shadow-lift"
      >
        <input
          ref={inputRef}
          className="w-full border-b border-rule px-4 py-3 text-sm text-steel-900 outline-none placeholder:text-steel-500"
          placeholder="Customer name, account number, or quote…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); choose(hits[cursor]); }
          }}
        />

        {hits.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-steel-600">
            {q ? 'Nothing matches that.' : 'Start typing. Customers go straight to their open orders.'}
          </p>
        ) : (
          <ul className="max-h-80 overflow-auto">
            {hits.map((h, i) => (
              <li key={h.kind + h.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(h)}
                  aria-current={i === cursor ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    i === cursor ? 'bg-instr-100' : 'hover:bg-steel-50'}`}
                >
                  <Status compact tone={h.kind === 'customer' ? 'active' : 'info'}>
                    {h.kind === 'customer' ? 'Customer' : 'Quote'}
                  </Status>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-steel-900">{h.title}</span>
                    <span className="block truncate text-2xs text-steel-600">{h.sub}</span>
                  </span>
                  {h.late > 0 && <Status compact tone="block">{h.late} late</Status>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-rule bg-steel-50 px-4 py-2 text-2xs text-steel-600">
          <span className="num">↑↓</span> to move · <span className="num">Enter</span> to open ·
          {' '}<span className="num">Esc</span> to close
        </p>
      </div>
    </>
  );
}
