import { useEffect, useState } from 'react';
import { api, type Evaluation, type ItemPromise, type Quote } from '../api';
import {
  APPROVAL_STATUS_WORD, PROMISE_MODE_WORD, QUOTE_STATUS_WORD, TRACE_STATUS_WORD, word,
} from '../api/words';
import { PICK_WORD } from './QuoteBuilder';
import { isCovered } from '../api/approvals';
import { useApp, useAsync } from '../state/app';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  AgainstTheApplication,
  ErrorNote, FreshnessNote, Panel, RuleCodeChip, Skeleton, Status, money, pct, shortDate,
} from '../components/ui';
import { FIELD_LABEL } from '../engine/parseApplication';
import { SendDialog } from './QuoteBuilder';
import { draftFromQuote, type QuoteDraft, type QuoteTraceEntry } from '../api';

const TRACE_TONE = {
  satisfied: 'ok', action: 'active', warning: 'warn', blocked: 'block', info: 'info',
} as const;

/** A saved quote in the shape the engine and the dialog both read. */

export function QuoteDetail({ quoteNo }: { quoteNo: string }) {
  const { go, session, notify } = useApp();
  const loaded = useAsync(() => api.getQuote(quoteNo), [quoteNo]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [deciding, setDeciding] = useState<number | null>(null);
  /** Per approval, what the approver is writing. Cleared once the decision lands. */
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  /* Two questions this screen asks before it does something it cannot take back.
     Both go through the app's own dialog rather than window.confirm — see
     ConfirmDialog, and useUnsavedGuard for the argument. */
  const [asking, setAsking] = useState<'delete' | 'lost' | 'sentOutside' | null>(null);
  /* What the rep says about a quote they sent themselves. */
  const [outsideTo, setOutsideTo] = useState('');
  const [outsideNote, setOutsideNote] = useState('');
  const [outsideFile, setOutsideFile] =
    useState<{ name: string; type: string; size: number; dataUrl: string } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);

  const q = quote ?? loaded.data;
  const canDecide = session?.role === 'approver' || session?.role === 'admin';
  /* A refusal stops the send until the terms change, and the button says so instead
     of throwing when pressed. The API refuses it too — this is the courtesy, not the
     control. */
  const declined = !!q?.approvals.some((a) => a.status === 'declined');

  /* What the rules make of this quote as it stands now.
     Not q.approvals: those are created when a quote is submitted, so on a draft the
     list is empty and the screen concluded that nothing needed approving — which is
     how a rep ended up typing a customer's address into a dialog that was about to
     send the quote to their manager. */
  const [live, setLive] = useState<Evaluation | null>(null);
  useEffect(() => {
    if (!q) return;
    let alive = true;
    api.evaluateDraft(draftFromQuote(q)).then((r) => { if (alive) setLive(r); });
    return () => { alive = false; };
  }, [q]);

  /* Outstanding decisions first, because a decision already asked for is the one
     that matters; otherwise what a fresh submit would ask for. */
  const pending = (q?.approvals ?? []).filter((a) => a.status === 'pending');
  /* Outstanding, not merely required. The rules still require an approval for a 45%
     discount after somebody has approved it — what changed is that there is now a
     decision on file. Asking "does this quote require approval" left an approved
     quote asking for approval for ever, and it could never be sent. */
  const unanswered = (live?.requiredApprovals ?? [])
    .filter((r) => !isCovered(r, q?.approvals ?? []));
  const needsApproval = pending.length > 0 || unanswered.length > 0;

  if (loaded.loading) return <Panel title="Quote"><Skeleton rows={8} /></Panel>;
  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />;
  if (!q) return null;

  async function decide(approvalId: number, decision: 'approved' | 'declined') {
    setDeciding(approvalId);
    try {
      const next = await api.decideApproval(
        q!.quoteNo, approvalId, decision, (notes[approvalId] ?? '').trim());
      setQuote(next);
      setNotes((n) => { const { [approvalId]: _drop, ...rest } = n; return rest; });
      notify(decision === 'approved'
        ? 'Approved. The rep can send it.'
        : 'Declined. The rep sees your note on the quote.');
    } finally {
      setDeciding(null);
    }
  }

  async function send(to: string, note: string) {
    setSending(true);
    try {
      // The server re-evaluates before it accepts this, so a quote drafted
      // against a rule that has since changed is caught here rather than
      // reaching the customer.
      const next = await api.submitQuote(q!.quoteNo, to, note);
      setQuote(next);
      setReview(false);
      notify(next.status === 'pendingApproval'
        ? 'Sent for approval.'
        : `${next.quoteNo} sent to ${to}.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  }

  /**
   * Act on a rule from the record of it firing.
   *
   * On the builder the same button adds the part in place. Here the quote is
   * already saved, so it writes the part on and opens the editor — the rep still
   * has to look at what changed and re-price, which is why it lands in the
   * builder rather than quietly saving and staying put.
   */
  async function applyFix(fix: NonNullable<QuoteTraceEntry['fix']>) {
    setSending(true);
    try {
      const next: QuoteDraft = {
        ...asDraft,
        lines: [
          ...asDraft.lines,
          ...fix.filter((f) => !asDraft.lines.some((l) => l.itemNo === f.itemNo))
            .map((f) => ({ itemNo: f.itemNo, quantity: f.quantity, discountPct: null })),
        ],
      };
      await api.saveQuote(q!.quoteNo, next);
      notify(`Added to ${q!.quoteNo}. Check the price before you send it.`);
      go({ name: 'editQuote', quoteNo: q!.quoteNo });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not add that.');
    } finally { setSending(false); }
  }

  /* The saved quote as a draft, so the review dialog can price and show it. This
     screen used to submit straight to the server: no review, no recipient, no
     covering note — so the gate only ever protected quotes sent from the builder. */
  const asDraft: QuoteDraft = draftFromQuote(q);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-quiet text-xs" onClick={() => go({ name: 'quotes' })}>
            ← All quotes
          </button>
          <h1 className="h-display text-xl">{q.quoteNo}</h1>
          <Status inline tone={q.approvalsPending ? 'warn' : 'ok'}>
            {q.approvalsPending
              ? `${q.approvalsPending} approval pending`
              : word(QUOTE_STATUS_WORD, q.status)}
          </Status>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Destructive first, and on its own side of a rule.
              It used to sit between "Customer copy" and "Start a copy", two buttons
              away from "Review and send" — the one irreversible action in the row,
              in the middle of the reversible ones. */}
          {q.status === 'draft' && (
            <>
              <button type="button" className="btn-danger text-sm" disabled={sending}
                      onClick={() => setAsking('delete')}>
                Delete
              </button>
              <span aria-hidden className="mx-1 hidden h-5 w-px bg-steel-300 sm:block" />
            </>
          )}
          {/* The end of a quote that did not win.
              `lost` has been in the status list since the beginning with nothing able
              to set it, so a quote reached "sent" and stayed there for ever —
              reported as exactly that. Not on a draft: a draft has never been in
              front of the customer, so there is nothing to lose and Delete is the
              honest verb. */}
          {(q.status === 'sent' || q.status === 'approved' || q.status === 'pendingApproval') && (
            <button type="button" className="btn-quiet text-sm" disabled={sending}
                    onClick={() => { setLostReason(''); setAsking('lost'); }}>
              Mark as lost
            </button>
          )}
          {/* Sent by the rep, from their own mail.
              A rep who has spent twenty minutes putting photographs into the Word
              document is not going to throw it away and press Send here — they send
              it from Outlook, and the quote sits saying "approved" for ever. This is
              how they tell the system what they did. Offered only where sending is
              the next thing that happens. */}
          {(q.status === 'approved' || q.status === 'draft') && !declined && (
            <button type="button" className="btn-quiet text-sm" disabled={sending}
                    title="Record a quote you sent yourself, from your own email"
                    onClick={() => {
                      setOutsideTo(q.recipientEmail ?? '');
                      setOutsideNote('');
                      setOutsideFile(null);
                      setAsking('sentOutside');
                    }}>
              I sent this myself
            </button>
          )}
          {q.status === 'lost' && (
            <button type="button" className="btn-quiet text-sm" disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.reopenQuote(q.quoteNo);
                        notify(`${q.quoteNo} is open again.`);
                        loaded.reload();
                      } catch (e) {
                        notify(e instanceof Error ? e.message : 'Could not reopen it.');
                      } finally { setBusy(false); }
                    }}>
              Reopen
            </button>
          )}
          <button type="button" className="btn-quiet text-sm"
                  onClick={() => go({ name: 'quoteDocument', quoteNo: q.quoteNo })}>
            Customer copy
          </button>
          <button type="button" className="btn-quiet text-sm" disabled={sending}
                  onClick={async () => {
                    setSending(true);
                    try {
                      const copy = await api.duplicateQuote(q.quoteNo);
                      notify(`${copy.quoteNo} started from ${q.quoteNo}.`);
                      go({ name: 'editQuote', quoteNo: copy.quoteNo });
                    } catch (e) {
                      notify(e instanceof Error ? e.message : 'Could not duplicate.');
                    } finally { setSending(false); }
                  }}>
            Start a copy
          </button>
          <button type="button" className="btn-quiet text-sm"
                  onClick={() => go({ name: 'editQuote', quoteNo: q.quoteNo })}>
            Edit
          </button>
          {/* Reviewing is not sending. This used to be disabled while an approval
              was outstanding, which is the state a rep most wants to look at the
              quote in — so it opens, and the dialog gates the send itself off the
              approvals it is given. */}
          <button type="button" className="btn-primary text-sm"
                  disabled={sending || declined}
                  title={declined
                    ? 'Change the quote first — the approver refused these terms'
                    : needsApproval
                      ? 'This quote needs approval before it can go to the customer'
                      : undefined}
                  onClick={() => setReview(true)}>
            {declined ? 'Declined'
              : needsApproval ? 'Send for approval'
                : q.status === 'sent' ? 'Send again'
                  : 'Review and send'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-3">
          <Panel collapsible title="Lines" aside={<span className="text-2xs text-steel-600">all figures USD</span>}>
            {/* Stacked on a phone. The extended net leads, because that is the figure
                being read out; the arithmetic behind it sits underneath in the order
                it happens — list, discount, net unit. A capped line keeps its rule
                chip, which is the one thing here nobody should have to go and find. */}
            <ul className="divide-y divide-steel-100 md:hidden">
              {q.lines.map((l) => (
                <li key={l.lineNo}
                    className={`px-4 py-3 ${l.cappedByRule ? 'bg-signal-100/50' : ''}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="num text-xs font-semibold text-steel-900">{l.itemNo}</span>
                    <span className="num text-xs font-semibold text-steel-900">
                      {money(l.extendedNet)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs leading-snug text-steel-700">{l.description}</p>
                  <p className="num mt-1.5 text-2xs text-steel-600">
                    <span className="num">{l.quantity}</span>
                    {' × '}
                    {money(l.listPrice)}
                    {' less '}
                    <span className={l.cappedByRule ? 'font-semibold text-signal-800' : ''}>
                      {pct(l.appliedDiscount)}
                    </span>
                    {' = '}
                    {money(l.netUnit)}
                    {' each'}
                  </p>
                  {l.cappedByRule && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs text-signal-800">
                      Category discount {pct(l.categoryDiscount)}, limited to{' '}
                      {pct(l.appliedDiscount)} by
                      <RuleCodeChip code={l.cappedByRule} tone="warn" />
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="tbl min-w-[46rem]">
                <thead>
                  <tr>
                    <th className="n">Qty</th>
                    <th>Part</th>
                    <th>Description</th>
                    <th className="n">List</th>
                    <th className="n">Disc</th>
                    <th className="n">Net unit</th>
                    <th className="n">Ext net</th>
                  </tr>
                </thead>
                <tbody>
                  {q.lines.map((l) => (
                    <tr key={l.lineNo} className={l.cappedByRule ? 'bg-signal-100/50' : ''}>
                      <td className="n">{l.quantity}</td>
                      <td className="num text-steel-700">{l.itemNo}</td>
                      <td>
                        <span className="text-steel-900">{l.description}</span>
                        {l.cappedByRule && (
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-signal-800">
                            Category discount {pct(l.categoryDiscount)}, limited to {pct(l.appliedDiscount)} by
                            <RuleCodeChip code={l.cappedByRule} tone="warn" />
                          </span>
                        )}
                      </td>
                      <td className="n">{money(l.listPrice)}</td>
                      <td className={`n ${l.cappedByRule ? 'font-semibold text-signal-800' : ''}`}>
                        {pct(l.appliedDiscount)}
                      </td>
                      <td className="n">{money(l.netUnit)}</td>
                      <td className="n font-medium">{money(l.extendedNet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/*
            The application this quote was priced against.

            It has always been saved — createQuote and saveQuote both write it, and
            cpq.quote carries all 28 columns — and this screen never showed it, which
            is indistinguishable from it not saving. It is also the thing every fit
            rule read, so a quote that cannot show its application cannot be
            defended six months later.
          */}
          <ApplicationRecord quote={q} />

          {/* The datasheet findings, which the quote has carried all along —
              saveQuote has always stored ev.fit. This screen simply never rendered
              it, so the grading was visible while it was advice and gone once it
              was the record. */}
          <AgainstTheApplication fit={q.fit} solutions={q.solutions}
                                 onRuleClick={(ruleCode) => go({ name: 'rule', ruleCode })} />

          <Availability quote={q} />

          <Panel collapsible title="Why the quote says what it says"
                 aside={<span className="text-2xs text-steel-600">recorded with the quote, not looked up later</span>}>
            <ul className="divide-y divide-steel-100">
              {q.trace.map((t) => (
                <li key={t.ruleCode} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-steel-900">{t.headline}</p>
                    {/* The rule first, then its verdict. Reversed from how this read
                        before, so the verdict is the last thing in the row and its mark
                        lands on the list's own edge — measured at five different x
                        positions when the variable-width rule code trailed it. It also
                        reads the way it is said: R-114 says blocked. */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <RuleCodeChip code={t.ruleCode} tone={TRACE_TONE[t.status]}
                                    onClick={() => go({ name: 'rule', ruleCode: t.ruleCode })} />
                      <Status compact tone={TRACE_TONE[t.status]}>{word(TRACE_STATUS_WORD, t.status)}</Status>
                    </div>
                  </div>
                  <p className="mt-1 text-2xs text-steel-600">
                    {t.ruleSummary}
                    {t.sourceRef && <> · <span className="num cite">{t.sourceRef}</span></>}
                    {t.author && <> · {t.author}</>}
                  </p>
                  {/* Same affordance as the builder, and for the same reason: the
                      rule knows the part number, so nobody should have to copy it
                      out of a sentence. Not offered once the quote has gone out. */}
                  {(() => {
                    /* A sent quote is still editable — a customer asking for a
                       change is the ordinary case — so its findings stay actionable.
                       A won one is history and is left alone. */
                    const open = q.status !== 'won';
                    if (!open) return null;
                    if (t.fix?.length) {
                      return (
                        <button type="button" className="btn-quiet mt-1.5 text-2xs" disabled={sending}
                                onClick={() => void applyFix(t.fix!)}>
                          {t.fix.length === 1
                            ? `Add ${t.fix[0].quantity} × ${t.fix[0].description ?? t.fix[0].itemNo}`
                            : `Add all ${t.fix.length}`}
                        </button>
                      );
                    }
                    /* The rule named a kind of part, not a part number — a mount, a
                       consumable, an installation. There is no single right answer to
                       add, so this opens the quote for editing with the parts list
                       already filtered to that kind. The builder gained this and the
                       saved quote did not, which meant the same finding was actionable
                       while drafting and a dead end once saved — and the saved quote is
                       the one somebody comes back to. */
                    if (t.pickRole) {
                      return (
                        <button type="button" className="btn-quiet mt-1.5 text-2xs"
                                onClick={() => go({ name: 'editQuote', quoteNo: q.quoteNo,
                                                    pickRole: t.pickRole })}>
                          {PICK_WORD[t.pickRole] ?? `Find ${t.pickRole}`}
                        </button>
                      );
                    }
                    if (t.status === 'action' || t.status === 'warning') {
                      return (
                        <p className="mt-1.5 text-2xs italic text-steel-500">
                          Nothing to add.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-3 xl:sticky xl:top-[3.5rem] xl:self-start">
          <Panel collapsible title="Summary">
            <dl className="divide-y divide-steel-100">
              {[
                ['Extended list', money(q.extendedList)],
                ['Extended net', money(q.extendedNet)],
                ['Order total', money(q.orderTotal)],
                ['Blended discount', pct(q.totalDiscount)],
                ['Margin', pct(q.marginPct)],
              ].map(([k, v], i) => (
                <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <dt className={`text-xs ${i === 2 ? 'font-semibold text-steel-900' : 'text-steel-600'}`}>{k}</dt>
                  <dd className={`num text-sm ${i === 2 ? 'font-semibold text-steel-900' : 'text-steel-800'}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {q.approvals.length > 0 && (
            <Panel collapsible title="Approvals">
              {/* What the rep said, at the top of the thing the approver reads.
                  This was typed into the send dialog — the rep's screen — and shown
                  nowhere else. An approver opens the quote and looks here, so the
                  case for the discount was the one thing missing from the place the
                  decision is made. */}
              {q.approvalNote && (
                <blockquote className="border-b border-rule bg-navy-50 px-4 py-3">
                  <p className="label">Why the rep is asking</p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-steel-900">
                    {q.approvalNote}
                  </p>
                  <footer className="mt-1.5 text-2xs text-steel-600">
                    {q.repDisplay ?? 'the rep'}
                    {q.updatedAt ? ` · ${shortDate(q.updatedAt)}` : ''}
                  </footer>
                </blockquote>
              )}
              <ul className="divide-y divide-steel-100">
                {q.approvals.map((a) => (
                  <li key={a.approvalId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-steel-900">
                        {pct(a.requestedPct)} requested against a stated {pct(a.statedMax)}
                      </p>
                      <Status inline tone={a.status === 'pending' ? 'warn' : a.status === 'approved' ? 'ok' : 'block'}>
                        {word(APPROVAL_STATUS_WORD, a.status)}
                      </Status>
                    </div>
                    <p className="mt-1 text-2xs text-steel-600">{a.reason}</p>
                    <p className="mt-1.5 text-2xs text-steel-700">
                      Routed to <span className="font-semibold">{a.approverDisplay}</span>
                      {' · '}
                      {{ override: 'set by an admin', entraManager: 'from the Microsoft 365 reporting line',
                         technology: 'technology fallback', unroutable: 'not resolved' }[a.resolvedBy]}
                    </p>
                    {a.ruleCode && (
                      <p className="mt-1.5">
                        <RuleCodeChip code={a.ruleCode} tone="active"
                                      onClick={() => go({ name: 'rule', ruleCode: a.ruleCode! })} />
                      </p>
                    )}
                    {/* What the approver said, kept with the decision.
                        A decline is something the rep has to act on, and "declined"
                        on its own does not say whether the discount was too deep or
                        the month was wrong — so the reason travelled by email and
                        never reached the quote. */}
                    {a.status !== 'pending' && a.note && (
                      <blockquote className="mt-2 border-l-2 border-steel-300 bg-steel-50 px-3 py-2">
                        <p className="text-2xs leading-snug text-steel-800">{a.note}</p>
                        <footer className="mt-1 text-2xs text-steel-600">
                          {a.approverDisplay ?? 'the approver'}
                          {a.decidedAt ? ` · ${shortDate(a.decidedAt)}` : ''}
                        </footer>
                      </blockquote>
                    )}
                    {canDecide && a.status === 'pending' && (
                      <div className="mt-2.5 space-y-2">
                        <label className="block">
                          <span className="label">
                            Note to the rep
                            <span className="ml-1 font-normal normal-case tracking-normal text-steel-500">
                              — required to decline
                            </span>
                          </span>
                          <textarea
                            className="field mt-0.5 h-16 resize-y text-xs"
                            placeholder="Why, and what would make it approvable."
                            value={notes[a.approvalId] ?? ''}
                            onChange={(e) =>
                              setNotes((n) => ({ ...n, [a.approvalId]: e.target.value }))}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button type="button" className="btn-primary text-xs"
                                  disabled={deciding === a.approvalId}
                                  onClick={() => void decide(a.approvalId, 'approved')}>
                            Approve
                          </button>
                          {/* A decline without a reason is the thing this is here to
                              stop, so the button says so rather than failing later. */}
                          <button type="button" className="btn-danger text-xs"
                                  disabled={deciding === a.approvalId
                                    || !(notes[a.approvalId] ?? '').trim()}
                                  title={(notes[a.approvalId] ?? '').trim()
                                    ? undefined : 'Write a note first'}
                                  onClick={() => void decide(a.approvalId, 'declined')}>
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel collapsible title="Header">
            <dl className="divide-y divide-steel-100 text-xs">
              {[
                ['Customer', q.customerName ?? '—'],
                ['Line', q.lineName ?? '—'],
                ['Technology', q.technologyCode],
                ['Rep', q.repDisplay ?? q.repUsername],
                // Only once it has been sent. Before that there is nothing to report,
                // and "Copied to" on a draft reads as a claim that it already went.
                ...(q.recipientEmail ? [['Sent to', q.recipientEmail]] : []),
                ...(q.copiedTo?.length ? [['Copied to', q.copiedTo.join(', ')]] : []),
                // How it went, when it did not go through the tool.
                ...(q.sentOutside
                  ? [['Sent', `by the rep on ${shortDate(q.sentOutside.at)}`]] : []),
                ...(q.sentOutside?.note ? [['Note', q.sentOutside.note]] : []),
                /* Why it stopped. REPORTED: "the stuff you type also doesn't appear to
                   go anywhere you can reference" — it was stored on the quote and
                   nothing ever showed it, which makes asking for it a waste of the
                   rep's time. */
                ...(q.status === 'lost' && q.outcomeReason
                  ? [['Lost because', q.outcomeReason]] : []),
                ['Updated', shortDate(q.updatedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <dt className="text-steel-600">{k}</dt>
                  <dd className="text-right text-steel-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      {/* Same gate the builder uses: what is going out, to whom, and with what note.
          The evaluation shown is the one the quote already carries, because a saved
          quote has been priced — and submit re-evaluates server-side anyway, which is
          what catches a quote drafted against a rule that has since changed. */}
      {review && (
        <SendDialog
          quoteApprovals={q.approvals}
          draft={asDraft}
          ev={{
            lines: q.lines, trace: q.trace, fit: q.fit ?? [],
            /* Outstanding decisions if there are any, otherwise what pressing send
               would ask for. Reading only the recorded ones made a draft look like it
               needed nothing, which is the whole bug this fixes. */
            requiredApprovals: pending.length
              ? pending.map((a) => ({
                ruleCode: a.ruleCode, reason: a.reason, requestedPct: a.requestedPct,
                statedMax: a.statedMax, approverRole: a.approverDisplay,
              }))
              : unanswered,
            extendedList: q.extendedList ?? 0, extendedNet: q.extendedNet ?? 0,
            totalDiscount: q.totalDiscount ?? 0, orderTotal: q.orderTotal ?? 0,
            marginPct: q.marginPct, marginNote: q.marginNote ?? null,
            blocked: q.blocked ?? false,
          }}
          quoteNo={q.quoteNo}
          busy={sending}
          onClose={() => setReview(false)}
          onSend={(to, note) => void send(to, note)}
        />
      )}

      {/* Both of the questions this screen has to ask before it does something
          irreversible, in the app's own dialog. window.confirm can be switched off
          per site, suppressed by the frame, or auto-dismissed, and the page cannot
          tell — which on a Delete button means the quote goes without anybody having
          said yes. Reported: "you made a custom 'the quote has not been saved'
          dialogue, can you make one for the deletion dialogue?" */}
      {asking === 'delete' && (
        <ConfirmDialog
          title={`Delete ${q.quoteNo}?`}
          body={<p>The quote and everything on it goes. This cannot be undone.</p>}
          confirmLabel="Delete it"
          busy={busy}
          onCancel={() => setAsking(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await api.deleteQuote(q.quoteNo);
              notify(`${q.quoteNo} deleted.`);
              go({ name: 'quotes' });
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Could not delete.');
            } finally { setBusy(false); setAsking(null); }
          }}
        />
      )}

      {asking === 'sentOutside' && (
        <ConfirmDialog
          title={`Record ${q.quoteNo} as sent`}
          body={(
            <div className="space-y-2">
              <p>
                For a quote you sent from your own email. It moves to sent and the
                figures on it are locked in as the ones you quoted.
              </p>
              <label className="block">
                <span className="label">Who you sent it to</span>
                <input className="field mt-1 text-sm" type="email" autoFocus
                       placeholder="name@customer.com"
                       value={outsideTo}
                       onChange={(e) => setOutsideTo(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Anything worth recording</span>
                <input className="field mt-1 text-sm"
                       placeholder="e.g. sent with the line drawings attached."
                       value={outsideNote}
                       onChange={(e) => setOutsideNote(e.target.value)} />
              </label>
              {/* The version the customer actually has.
                  This is the one the system cannot regenerate — it has their
                  photographs and their wording in it — and it is the one that
                  matters when somebody asks in six months what we sent. */}
              <label className="block">
                <span className="label">The copy you sent, if you have it</span>
                <input type="file" className="mt-1 w-full text-2xs"
                       accept=".doc,.docx,.pdf,.htm,.html"
                       onChange={async (e) => {
                         const f = e.target.files?.[0];
                         if (!f) { setOutsideFile(null); return; }
                         if (f.size > 8 * 1024 * 1024) {
                           notify('That file is over 8 MB — attach it to the record another way.');
                           return;
                         }
                         const dataUrl = await new Promise<string>((res, rej) => {
                           const r = new FileReader();
                           r.onload = () => res(String(r.result));
                           r.onerror = () => rej(r.error);
                           r.readAsDataURL(f);
                         });
                         setOutsideFile({ name: f.name, type: f.type, size: f.size, dataUrl });
                       }} />
                {outsideFile && (
                  <span className="mt-1 block text-2xs text-steel-600">
                    {outsideFile.name} · {Math.round(outsideFile.size / 1024)} KB
                  </span>
                )}
              </label>
            </div>
          )}
          confirmLabel="Record it as sent"
          cancelLabel="Not yet"
          busy={busy}
          onCancel={() => setAsking(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              const next = await api.markSentOutside(q.quoteNo, {
                to: outsideTo, note: outsideNote, file: outsideFile,
              });
              setQuote(next);
              notify(`${q.quoteNo} recorded as sent to ${next.sentOutside?.to ?? outsideTo}.`);
              setAsking(null);
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Could not record it.');
            } finally { setBusy(false); }
          }}
        />
      )}

      {asking === 'lost' && (
        <ConfirmDialog
          title={`Mark ${q.quoteNo} as lost?`}
          body={(
            <div className="space-y-2">
              <p>
                It stops being open work and keeps everything on it — what the customer
                was told, what was approved, and why it stopped. You can reopen it.
              </p>
              <label className="block">
                <span className="label">Why, in a line</span>
                <textarea
                  className="field mt-1 h-16 resize-y text-sm"
                  autoFocus
                  placeholder="e.g. went with the incumbent on price."
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                />
              </label>
            </div>
          )}
          confirmLabel="Mark it lost"
          busy={busy}
          onCancel={() => setAsking(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              const next = await api.markQuoteLost(q.quoteNo, lostReason);
              setQuote(next);
              notify(`${q.quoteNo} marked lost.`);
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Could not mark it lost.');
            } finally { setBusy(false); setAsking(null); }
          }}
        />
      )}
    </div>
  );
}

/**
 * When can the customer actually have this?
 *
 * One row per quote line, plus the date the whole order can ship - which is the
 * slowest line, not the fastest. Each date carries the reason Planning
 * Analytics gave, because "week of the 12th" is only useful in a customer
 * conversation if the rep can say why.
 */
/**
 * What was captured about the line, as stored on the quote.
 *
 * Only the answered fields. A saved quote is a record, and twenty-eight rows of
 * "not stated" is not a record of anything — the count in the header says how much
 * of the profile was filled in, which is the honest summary of how much the fit
 * grading had to work with.
 */
function ApplicationRecord({ quote }: { quote: Quote }) {
  const p = quote.profile;
  if (!p) return null;
  const unconstrained = new Set<string>(quote.noConstraint ?? []);
  const answered = (Object.keys(p) as (keyof typeof p)[])
    .filter((k) => p[k] !== null && p[k] !== undefined && p[k] !== '');

  return (
    <Panel strong title="The application it was priced against"
           aside={<span className="num text-2xs text-steel-600">
             {answered.length} of 28 answered
           </span>}>
      {answered.length === 0 ? (
        <p className="px-4 py-4 text-xs text-steel-600">
          Nothing was captured about the line, so no fit rule could read anything.
          Every machine on this quote went on ungraded.
        </p>
      ) : (
        <dl className="divide-y divide-steel-100">
          {answered.map((k) => (
            <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
              <dt className="text-2xs uppercase tracking-wider text-steel-600">
                {FIELD_LABEL[k]}
              </dt>
              <dd className="num min-w-0 text-right text-xs text-steel-900">{String(p[k])}</dd>
            </div>
          ))}
          {[...unconstrained].map((k) => (
            <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
              <dt className="text-2xs uppercase tracking-wider text-steel-600">
                {FIELD_LABEL[k as keyof typeof p]}
              </dt>
              <dd className="text-right text-xs text-steel-600">
                no constraint — rules reading it were silenced
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

function Availability({ quote }: { quote: Quote }) {
  const [rows, setRows] = useState<ItemPromise[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all(quote.lines.map((l) => api.getItemPromise(l.itemNo, l.quantity)))
      .then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [quote]);

  if (!rows) return <Panel collapsible title="When can they have it"><Skeleton rows={4} /></Panel>;

  const dated = rows.map((r) => r.covering?.promisedDt).filter(Boolean) as string[];
  const uncovered = rows.length - dated.length;
  const sortedDates = dated.slice().sort();
  const shipDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;

  return (
    <Panel
      collapsible
      title="When can they have it"
      aside={<span className="text-2xs text-steel-600">the slowest line sets the ship date</span>}
    >
      <div className="border-b border-rule bg-steel-50 px-4 py-3">
        <p className="label">Complete order ready</p>
        <p className="readout-sm mt-1">
          {shipDate ? shortDate(shipDate) : 'not yet datable'}
        </p>
        {uncovered > 0 && (
          <p className="mt-0.5 text-2xs text-signal-800">
            {uncovered} line{uncovered === 1 ? '' : 's'} have no supply covering the quantity yet, so
            this is the best of the rest rather than a complete answer.
          </p>
        )}
      </div>

      <ul className="divide-y divide-steel-100">
        {rows.map((r, i) => {
          const line = quote.lines[i];
          const open = expanded === r.itemNo;
          return (
            <li key={r.itemNo + i}>
              <div className="flex items-start gap-3 px-4 py-2.5">
                <span className="num w-8 shrink-0 text-right text-xs text-steel-600">{line.quantity}</span>
                <span className="min-w-0 flex-1">
                  <span className="num block text-xs text-steel-900">{r.itemNo}</span>
                  <span className="block truncate text-2xs text-steel-600">{r.description}</span>
                </span>
                <span className="shrink-0 text-right">
                  {r.covering ? (
                    <>
                      <span className="num block text-xs font-semibold text-steel-900">
                        {shortDate(r.covering.promisedDt)}
                      </span>
                      <span className="block text-2xs text-steel-600">
                        {word(PROMISE_MODE_WORD, r.covering.promiseMode)}
                      </span>
                    </>
                  ) : (
                    /* The same slot holds a promised date on every other line, so this
                       is not at a trailing edge and there is no strip to join — the
                       inline form, which is a mark and a word and no wash. It was a
                       bare gold span, and once every state around it had become a
                       reading it was the one that had not. */
                    <Status inline tone="warn">no cover yet</Status>
                  )}
                </span>
                {r.ladder.length > 1 && (
                  <button type="button" className="btn-quiet shrink-0 text-2xs" aria-expanded={open}
                          onClick={() => setExpanded(open ? null : r.itemNo)}>
                    {open ? 'Hide' : 'Options'}
                  </button>
                )}
              </div>

              {r.covering?.explanation && (
                <p className="px-4 pb-2 pl-14 text-2xs leading-snug text-steel-600">
                  {r.covering.explanation}
                </p>
              )}

              {open && (
                <div className="border-t border-steel-100 bg-steel-50 px-4 py-2 pl-14">
                  <p className="label mb-1.5">If they can take a partial shipment</p>
                  <ul className="space-y-1">
                    {r.ladder.map((rung) => (
                      <li key={rung.ladderSeq} className="flex items-baseline gap-2 text-2xs">
                        <span className="num w-20 shrink-0 font-semibold text-steel-800">
                          {shortDate(rung.promisedDt)}
                        </span>
                        <span className="num w-16 shrink-0 text-steel-700">{rung.atpQty} units</span>
                        <span className="text-steel-600">{rung.explanation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-rule px-4 py-2">
        <FreshnessNote asOf={rows[0]?.asOf ?? new Date().toISOString()}
                       freshness={rows[0]?.freshness ?? 'current'} />
      </div>
    </Panel>
  );
}