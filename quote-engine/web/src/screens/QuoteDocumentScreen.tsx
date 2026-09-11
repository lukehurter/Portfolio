import { useEffect, useRef, useState } from 'react';
import {
  api, DEFAULT_DOCUMENT, draftFromQuote,
  type DocumentSettings, type Evaluation, type Quote,
} from '../api';
import { useApp, useAsync } from '../state/app';
import { ErrorNote, Field, Panel, Skeleton } from '../components/ui';
import { isCovered } from '../api/approvals';
import { SendDialog } from './QuoteBuilder';
import { UnsavedPromptView } from '../components/UnsavedPrompt';
import { useMeasuredHeight } from '../components/usePublishedHeight';
import { useUnsavedGuard } from '../components/useUnsavedGuard';
import { QuoteDocument } from './QuoteDocument';
import { wordQuote } from './wordQuote';
import { specsFor } from '../api/specs';

/**
 * The customer's copy, on its own page, with the controls beside it.
 *
 * It used to be a tab inside the send dialog, which made it the one thing in the tool
 * you could not link to, bookmark, or show somebody. Asked three times to see what a
 * quote looks like and could not answer without a screen recording.
 *
 * A page also gives the settings somewhere to live. Everything here changes the
 * document while you watch it: nobody can judge a validity period or an intro
 * paragraph from a form field, and the whole question is what the customer sees.
 *
 * Terms and the address block save as the company default. Validity, the intro and
 * the three layout switches stay on this quote — a ninety-day validity on a capital
 * machine and a two-week one on a promotional price are both right, and neither is a
 * default worth arguing about.
 */
export function QuoteDocumentScreen({ quoteNo }: { quoteNo: string }) {
  const { session, notify, go } = useApp();
  const loaded = useAsync(() => api.getQuote(quoteNo), [quoteNo]);
  const defaults = useAsync(() => api.getDocumentDefaults(), []);

  const [d, setD] = useState<DocumentSettings | null>(null);
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [saving, setSaving] = useState(false);
  /* What was last written, so the page can say whether there is anything to write.
     Every control here edited local state and nothing wrote it anywhere: a rep set
     the validity, turned the photographs off, went back to the quote and found all
     of it gone. The only save on the page put the wording in the COMPANY default,
     which is the one change that should not be casual. */
  const [saved, setSaved] = useState<string | null>(null);

  const q: Quote | null = loaded.data ?? null;

  useEffect(() => {
    if (!defaults.data) return;
    const merged = { ...defaults.data, ...(q?.document ?? {}) };
    setD(merged);
    setSaved(JSON.stringify(merged));
  }, [defaults.data, q]);

  /* The document prices from the same engine the quote does, rather than reading the
     figures stored on the quote. A saved total and a re-priced one disagreeing is
     exactly the thing a customer would find. */
  useEffect(() => {
    if (!q) return;
    let live = true;
    const draft = draftFromQuote(q);
    api.evaluateDraft(draft).then((r) => { if (live) setEv(r); });
    return () => { live = false; };
  }, [q]);

  /* Above the early returns, because it is a hook.
     It sat below them, so the first render — while the quote was still loading —
     called fewer hooks than the second, and React threw "rendered more hooks than
     during the previous render" the moment the data arrived. The error boundary
     caught it, which is why it became a message rather than a white page, but the
     customer copy could not be opened at all. `d` is null until the settings load
     and the comparison already accounts for that. */
  const dirty = d != null && JSON.stringify(d) !== saved;
  const guard = useUnsavedGuard(dirty);

  /* Sending, from the screen where the quote's wording is settled.
     Same dialog as the quote page, so the approval gate, the refusal and the
     customer copy inside it are all the one implementation. */
  const [review, setReview] = useState(false);
  const [sending, setSending] = useState(false);
  const pending = (q?.approvals ?? []).filter((a) => a.status === 'pending');
  const declined = !!q?.approvals.some((a) => a.status === 'declined');
  const needsApproval = pending.length > 0
    || (ev?.requiredApprovals ?? []).some((r) => !isCovered(r, q?.approvals ?? []));

  async function send(to: string, note: string) {
    setSending(true);
    try {
      const next = await api.submitQuote(quoteNo, to, note);
      setReview(false);
      loaded.reload();
      notify(next.approvalsPending
        ? `${quoteNo} sent for approval.`
        : `${quoteNo} sent to ${to}.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not send.');
    } finally { setSending(false); }
  }

  if (loaded.loading || defaults.loading) return <Skeleton rows={8} />;
  if (loaded.error) return <ErrorNote message={loaded.error} onRetry={loaded.reload} />;
  if (!q || !d) return null;

  const draft = { ...draftFromQuote(q), document: d };
  const set = <K extends keyof DocumentSettings>(k: K, v: DocumentSettings[K]) =>
    setD((cur) => (cur ? { ...cur, [k]: v } : cur));
  /* Never null in the controls, so every field below has something to bind to. A
     quote saved before financing existed has no block at all. */
  const fin = d.financing ?? DEFAULT_DOCUMENT.financing!;
  /* Whether there is a specification to print at all. Only 22 models have one
     captured, so on most quotes this switch has nothing to do and should say so
     rather than tick and change nothing. */
  const haveSpecs = (ev?.lines ?? []).some((l) => l.itemRole === 'printer' && specsFor(l.model));

  /* On the quote, not on the company. Validity, the opening paragraph and the four
     layout switches belong to one quote — a ninety-day validity on a capital machine
     and a two-week one on a promotional price are both right. */
  async function saveToQuote() {
    if (!d || !q) return;
    setSaving(true);
    try {
      await api.saveQuote(quoteNo, { ...draftFromQuote(q), document: d });
      setSaved(JSON.stringify(d));
      loaded.reload();
      notify('Saved to this quote.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.');
    } finally { setSaving(false); }
  }

  /* Word and Excel, without a library.
     Asked for by the sales team: "export the customer quote into word / excel for
     further adjustments". The build is one openable HTML file with no dependencies
     and that is worth keeping, so neither of these pulls in a writer.

     Word opens HTML and keeps the layout, the table and the styling, and what it
     produces is a real editable document — which is what "further adjustments"
     means here. Excel gets CSV rather than a fake .xls: a rep adjusting a quote in
     Excel wants the numbers in cells, and CSV is the one format that opens with no
     warning about the extension not matching the contents.

     The internal-only marks are stripped on the way out, the same as they are in
     print. A file that leaves this app is a file that can be forwarded. */
  function download(name: string, mime: string, body: string) {
    const url = URL.createObjectURL(new Blob([body], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const fileStem = `${quoteNo}${q?.customerName ? ` — ${q.customerName}` : ''}`;

  /* One export, and it is Word.
     REPORTED: "the word and excel exports are really shitty. I only need one of them,
     preferably word, and it needs to be presentable to a customer. The sales people
     wanted the functionality so they can add their own pictures and stuff."

     The old one cloned the rendered sheet, which is why it was bad — Word has no
     flexbox and no grid, so every layout in that markup collapsed and Tailwind's
     classes meant nothing. wordQuote builds the document from the DATA, in tables,
     which is how Word lays a page out. See the note at the top of that file.

     Excel is gone rather than kept as a worse second option. It produced a list of
     numbers with no letterhead, which is not something anybody sends a customer, and
     "for further adjustments" means editing the quote, not the arithmetic. */
  function exportWord() {
    if (!q) { notify('Nothing to export yet.'); return; }
    const html = wordQuote({
      draft, ev, quoteNo,
      repName: session?.displayName ?? q.repDisplay,
      repEmail: session?.email, repPhone: session?.phone,
      settings: d,
    });
    const name = `${quoteNo}${q.customerName ? ` — ${q.customerName}` : ''}.doc`;
    const url = URL.createObjectURL(new Blob([html], { type: 'application/msword' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    notify('Word document downloaded. Open it to add photographs or change the wording.');
  }

  async function saveAsDefault() {
    if (!d) return;
    setSavingDefaults(true);
    try {
      await api.saveDocumentDefaults(d);
      notify('Saved as the default for every quote.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.');
    } finally { setSavingDefaults(false); }
  }

  return (
    <div className="space-y-3">
      {/* The same guard the builder has: this screen holds unsaved wording and
          layout in exactly the same way, and had nothing between it and Back. */}
      <UnsavedPromptView prompt={guard} what="customer copy" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-quiet text-xs"
                  onClick={() => go({ name: 'quote', quoteNo })}>
            ← {quoteNo}
          </button>
          <h1 className="h-display text-xl">What the customer receives</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-quiet text-sm" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button type="button" className="btn-quiet text-sm" onClick={exportWord}
                  title="An editable Word document — add photographs, change the wording">
            Download as Word
          </button>
          {/* Sent from the screen where the decision is made.
              This is where a rep settles how the quote reads; deciding it was right
              and then going back to the quote to press a different button is a trip
              for nothing. The dialog is the same one, so the approval gate and the
              refusal are the same too. */}
          <button type="button" className="btn-primary text-sm"
                  disabled={sending || declined}
                  title={declined
                    ? 'Change the quote first — the approver refused these terms'
                    : undefined}
                  onClick={() => setReview(true)}>
            {declined ? 'Declined'
              : needsApproval ? 'Send for approval'
                : q.status === 'sent' ? 'Send again'
                  : 'Review and send'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* The controls. Hidden when printing — see the print stylesheet.
            min-w-0 on both columns: a grid item defaults to min-width:auto, so a
            textarea's intrinsic width on one side and a fixed-width document on the
            other each push the page wider than a phone. */}
        <div className="min-w-0 space-y-3">
          <Panel title="Wording">
            <div className="space-y-3 p-4">
              <Field label="Opening paragraph"
                     hint="Above the table, in your words. Blank leaves it out.">
                <textarea className="field h-24 resize-y text-sm" value={d.intro}
                          placeholder="Thank you for the opportunity to quote…"
                          onChange={(e) => set('intro', e.target.value)} />
              </Field>
              <Field label="Terms and conditions"
                     hint="Axim's standard wording, off the price-page quotes.">
                <textarea className="field h-32 resize-y text-xs" value={d.terms}
                          placeholder="Paste the standard terms here."
                          onChange={(e) => set('terms', e.target.value)} />
              </Field>
              <Field label="Address block">
                <textarea className="field h-16 resize-y text-xs" value={d.footer}
                          onChange={(e) => set('footer', e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel title="Layout">
            <div className="space-y-3 p-4">
              <Field label="Valid for" hint="Days from today.">
                <input type="number" min={1} max={365}
                       className="field num w-24 text-sm" value={d.validDays}
                       onChange={(e) => set('validDays', Math.max(1, Number(e.target.value) || 1))} />
              </Field>
              {/* No photograph switches.
                  A stock photograph of another plant's line, on a document about this
                  customer's line, did not look like it belonged beside the numbers —
                  and on a commercial document that is the whole test. The library is
                  still there and the machine list still uses it, where a photograph
                  answers "which one is this". */}
              {([
                ['showApplication', 'Restate the application',
                  'The line, substrate and speed the quote was priced against.'],
                ['showUnitPrices', 'Show unit prices',
                  'Off shows line totals alone.'],
                ['showDatasheet', 'Print the machine specification',
                  haveSpecs
                    ? "The vendor page's own figures for the machine being bought, cited."
                    : 'No specification has been captured for the machine on this quote, '
                      + 'so there is nothing to print. Datasheets exist for 22 models.'],
              ] as const).map(([key, label, hint]) => (
                <label key={key} className={`flex items-start gap-2.5 ${
                  key === 'showDatasheet' && !haveSpecs ? 'opacity-60' : 'cursor-pointer'}`}>
                  {/* Disabled rather than silently doing nothing.
                      REPORTED as "the print the machine specification checkbox is not
                      working" — and on a quote whose machine is one of the 22 we have
                      captured, it does. On any other quote it ticks and the document
                      does not change, which is indistinguishable from broken. */}
                  <input type="checkbox" className="mt-0.5" checked={d[key]}
                         disabled={key === 'showDatasheet' && !haveSpecs}
                         onChange={(e) => set(key, e.target.checked)} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-steel-900">{label}</span>
                    <span className="block text-2xs text-steel-600">{hint}</span>
                  </span>
                </label>
              ))}

              {/* Leasing. Nothing here is a rate this tool knows — the rep enters the
                  term and the rate the leasing company quoted, and the payment is the
                  standard amortising formula on top of it. A default rate would be
                  this tool inventing a commercial term. */}
              <label className="flex cursor-pointer items-start gap-2.5 border-t border-rule pt-3">
                <input type="checkbox" className="mt-0.5" checked={fin.show}
                       onChange={(e) => set('financing', { ...fin, show: e.target.checked })} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-steel-900">
                    Show a monthly payment
                  </span>
                  <span className="block text-2xs text-steel-600">
                    For a customer who leases. Enter what the leasing company quoted.
                  </span>
                </span>
              </label>
              {fin.show && (
                <div className="space-y-2 pl-6">
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Term, months">
                      <input type="number" min={1} max={120} className="field num w-20 text-sm"
                             value={fin.months}
                             onChange={(e) => set('financing',
                               { ...fin, months: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>
                    <Field label="Rate, % a year">
                      <input type="number" min={0} step={0.1} className="field num w-24 text-sm"
                             value={fin.apr == null ? '' : Math.round(fin.apr * 1000) / 10}
                             placeholder="—"
                             onChange={(e) => {
                               const v = e.target.value.trim();
                               set('financing', { ...fin, apr: v === '' ? null : Number(v) / 100 });
                             }} />
                    </Field>
                    <Field label="Or the monthly">
                      <input type="number" min={0} step={1} className="field num w-28 text-sm"
                             value={fin.monthly ?? ''} placeholder="—"
                             onChange={(e) => {
                               const v = e.target.value.trim();
                               set('financing', { ...fin, monthly: v === '' ? null : Number(v) });
                             }} />
                    </Field>
                  </div>
                  <p className="text-2xs text-steel-600">
                    A monthly typed here is used as given. Otherwise it is worked out
                    from the term and the rate.{' '}
                    {/* Where the figure comes from today. Told that sales quote
                        financing through Dimension Funding, so the link is here rather
                        than in somebody's bookmarks — this tool holds no rates and is
                        not going to start.
                        The Axim page, not the front door: "Dimension funding has a
                        page for axim specifically, sorry sales sent me the generic
                        link." A rep landing on the generic site has to find Axim
                        again before they can quote anything. */}
                    <a href="https://leasing.example/axim/" target="_blank" rel="noreferrer"
                       className="text-instr-700 underline decoration-instr-300">
                      Dimension Funding
                    </a>{' '}
                    is where sales quote it.
                  </p>
                  <Field label="Conditions, printed under the figure">
                    <textarea className="field h-16 resize-y text-xs" value={fin.note}
                              onChange={(e) => set('financing', { ...fin, note: e.target.value })} />
                  </Field>
                </div>
              )}
            </div>
          </Panel>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs"
                    disabled={saving || !dirty} onClick={saveToQuote}>
              {dirty ? 'Save to this quote' : 'Saved'}
            </button>
            <button type="button" className="btn-quiet text-xs" disabled={savingDefaults}
                    onClick={saveAsDefault}>
              Save as the default for every quote
            </button>
            <button type="button" className="btn-quiet text-xs"
                    onClick={() => setD({ ...DEFAULT_DOCUMENT, ...(defaults.data ?? {}) })}>
              Reset
            </button>
          </div>
        </div>

        {/* The document, as a sheet of paper.
            It keeps 8.5x11 and scales to fit rather than reflowing, because a preview
            that rewraps is a preview of a different document: different line breaks, a
            different table, a different number of pages from the one the customer
            opens. Measured rather than guessed at — see PaperFrame. */}
        <PaperFrame>
          <QuoteDocument draft={draft} ev={ev} quoteNo={quoteNo} settings={d}
                         repName={session?.displayName ?? q.repDisplay}
                         repEmail={session?.email} repPhone={session?.phone} />
        </PaperFrame>
      </div>

      {review && (
        <SendDialog
          quoteApprovals={q.approvals}
          draft={draft}
          ev={ev}
          quoteNo={quoteNo}
          busy={sending}
          onClose={() => setReview(false)}
          onSend={(to, note) => void send(to, note)}
        />
      )}
    </div>
  );
}

/**
 * Holds a fixed-size page and scales it to the space available.
 *
 * The page is 816x1056 — US Letter at 96dpi — and never changes. This measures its
 * own width and applies a transform, so the preview is always the real document seen
 * from further away rather than a narrower document.
 */
/**
 * The smallest scale worth rendering words at.
 *
 * The document's smallest type is 11px, so 0.75 lands it at 8.25px — small, and
 * readable. At the 0.38 a phone was getting it came out at 4.19px, which is not a
 * small document but an illegible one.
 */
const LEGIBLE = 0.75;

/* US Letter at 96dpi, and the 1px border the preview draws around it. The transform
   scales the border box, so every place that reserves room for the sheet has to
   reserve the same number the fit divides by — they were 816 and 818, and the 2px
   difference was a scrollbar on a page that fitted. */
const SHEET_W = 816;
const SHEET_H = 1056;
const SHEET_BORDER = 2;
/** Rounding, borders and sub-pixel layout. Below this, the page has not overflowed. */
const PAGE_SLOP = 8;

export function PaperFrame({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  /* How tall the document actually is, which is not one page.
     REPORTED: "on the customer copy editor, if you check every checkbox, the copy
     overflows and you can't see it all." The wrapper below reserved exactly SHEET_H
     and this frame hides vertical overflow, so a document that ran past one page was
     cut off with nothing to scroll — and every switch in the panel adds to it, so
     turning them all on was the reliable way to lose the end of the quote.

     offsetHeight, so the scale transform on the sheet does not affect the reading —
     which also means this cannot feed back into the fit calculation the way an
     overflow-driven width would. That loop is documented below and was worth not
     re-creating. */
  const contentH = useMeasuredHeight(sheet, SHEET_H);
  /* Which job the reader is doing. Fitting answers "does this run to two pages";
     reading answers "what does it say". A wide screen does both at once and never
     shows the control; a phone cannot, and gets to choose. */
  const [preferFit, setPreferFit] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let frame = 0;
    const fit = () => {
      // 32px of gutter either side, and never enlarge: a document shown bigger than
      // it prints misleads in the other direction.
      const next = Math.min(1, (el.clientWidth - 32) / (SHEET_W + SHEET_BORDER));
      setFitScale(next > 0 ? next : 1);
    };
    fit();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, []);

  const tooNarrowToRead = fitScale < LEGIBLE;
  const scale = tooNarrowToRead && !preferFit ? LEGIBLE : fitScale;
  /* Never less than a page: a short quote still sits on a sheet of paper. */
  const paperH = Math.max(SHEET_H, contentH);
  /* A hair over a page is still a page. Measured in the browser, an ordinary one-page
     quote comes back as 1058 — the sheet's own 1px borders — and dividing that by 1056
     announced "2 pages when it prints" and drew a page break under the last line. */
  const pages = Math.max(1, Math.ceil((contentH - PAGE_SLOP) / SHEET_H));

  return (
    <div ref={box} className="paper-frame min-w-0 bg-steel-100 p-4">
      {pages > 1 && (
        /* Said out loud, because the switches in the panel beside this are what push
           a quote onto a second page and nothing else reports that they have. */
        <p className="mb-2 text-2xs text-steel-600">
          {pages} pages when it prints. The dashed rules are where the paper ends.
        </p>
      )}
      {tooNarrowToRead && (
        /* Only where the two answers differ, which is only on a narrow screen. */
        <p className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-2xs
                      text-steel-600">
          <span>
            {preferFit
              ? 'The whole page, too small to read.'
              : 'Readable size — the page is wider than the screen, so it scrolls.'}
          </span>
          <button type="button" className="btn-quiet text-2xs"
                  onClick={() => setPreferFit((v) => !v)}>
            {preferFit ? 'Readable size' : 'Fit the whole page'}
          </button>
        </p>
      )}
      {/* The wrapper reserves the SCALED height. Without it the container keeps the
          unscaled 1056px and leaves a long empty gap under the page, because a
          transform does not affect layout.

          Both wrappers are named, and named for the print stylesheet rather than for
          this component. The reset there used to reach the frame and its direct child
          and stop, one level short of the element actually carrying the transform and
          the border — so the document printed shrunk, inside a rule. Depth was the
          wrong thing to address them by; the names cannot drift the same way. */}
      {/* The scrolling happens HERE, one level inside the measured box.
          Put the overflow on the frame itself and the width it measures depends on
          the scale it produces: scale up, a scrollbar appears, clientWidth changes,
          the observer fires again. The browser throttles that loop rather than
          resolving it, and the page froze at whatever scale it had reached — 1.0 on
          a desktop, which is the one place the document had always fitted. */}
      {/* overflow-y hidden explicitly: setting one axis to auto makes the other
          compute to auto as well, and the vertical bar that appeared stole 15px of
          width — which made the horizontal content overflow that produced a
          horizontal bar, on a desktop where the page had always fitted. The height
          is reserved exactly by paper-fit, so nothing is clipped. */}
      <div className="paper-scroll overflow-x-auto overflow-y-hidden">
        {/* 818, not 816: the sheet carries a 1px border on each side and the
            transform scales the border box, so reserving the paper alone left a
            pixel of overflow and a scrollbar on a page that fitted. */}
        <div style={{ height: (paperH + SHEET_BORDER) * scale,
                      width: (SHEET_W + SHEET_BORDER) * scale }}
             className="paper-fit mx-auto" >
          <div ref={sheet}
               style={{ transform: `scale(${scale})`, transformOrigin: 'top left',
                        width: SHEET_W }}
               className="paper-sheet relative border border-rule shadow-lift">
            {children}
            {/* Where the paper runs out. The document is one continuous sheet on
                screen and several when it prints, and a rep sending a quote wants to
                know that the total landed on page 2 on its own. Hidden when printing:
                the real page breaks are the browser's to draw. */}
            {Array.from({ length: pages - 1 }, (_, i) => (
              <div key={i} aria-hidden="true"
                   className="paper-guide pointer-events-none absolute inset-x-0
                              border-t border-dashed border-steel-300"
                   style={{ top: (i + 1) * SHEET_H }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

