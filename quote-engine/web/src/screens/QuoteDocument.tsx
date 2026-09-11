import {
  DEFAULT_DOCUMENT,
  type DocumentSettings, type Evaluation, type QuoteDraft,
} from '../api';
import { AXIM_LOGO_BLUE } from '../assets/logo';
import { shortDate } from '../components/ui';
import { Fragment } from 'react';
import { specsFor } from '../api/specs';
import { PRINT_QUALITY_WORD, TECHNOLOGY_WORD } from '../api/words';
import { downPayment, financingOffer } from './documentMoney';
import { FIELD_LABEL } from '../engine/parseApplication';

/**
 * The document the customer actually receives.
 *
 * The review dialog previewed the CONTENTS of a quote — the lines, the totals, what
 * needed approval. Useful to the rep, and not the thing being sent. A customer
 * receives a document, and nobody had ever looked at that document because it did
 * not exist.
 *
 * ── What is deliberately NOT on here ────────────────────────────────────────
 *
 * List price, the discount percentage, the discount category breakdown, margin,
 * standard cost, rule codes, approval state, and the internal trace. Every one of
 * those is a fact about how Axim priced the quote rather than about what the
 * customer is buying, and several of them are facts a customer should not have. A
 * quote that shows a 35% discount invites a conversation about 40%.
 *
 * The customer sees the price they pay. That is the number that means something to
 * them, and it is the only price on the page.
 *
 * ── Why print rather than a generated file ─────────────────────────────────
 *
 * The browser's own PDF writer produces a better document than anything this app
 * could assemble: real fonts, selectable text, correct pagination, and no
 * dependency in a build that has to stay a single openable file. "Save as PDF" is
 * the destination in the print dialog on every platform the reps use.
 *
 * ── The terms ───────────────────────────────────────────────────────────────
 *
 * The terms are Axim's own, off the block that sits on the price-page quotes,
 * condensed and carried in DEFAULT_DOCUMENT. Nothing here is invented: this slot was
 * empty for as long as there was no supplied wording, because a plausible-looking
 * invented paragraph on a document a customer receives is worse than a visible gap.
 *
 * A rep can rewrite it for one quote without changing it for anyone else, and if they
 * clear it the box goes back to saying it is missing.
 */

export function QuoteDocument({
  draft, ev, quoteNo, repName, repEmail, repPhone, settings,
}: {
  draft: QuoteDraft;
  ev: Evaluation | null;
  quoteNo?: string;
  repName?: string | null;
  repEmail?: string | null;
  repPhone?: string | null;
  /** Layout and wording. Absent falls back to the shipped default. */
  settings?: DocumentSettings | null;
}) {
  const d = { ...DEFAULT_DOCUMENT, ...(settings ?? {}), ...(draft.document ?? {}) };

  /* Every figure on this page, in dollars.
     There was a currency conversion here — a rate the rep typed, applied at the point
     of display — and it is gone because the business does not need it. The quote is
     priced, approved and ordered in the dollars Orbit holds, and now that is also
     the only way it reads. */
  const cash = (v: number | null | undefined) =>
    v == null ? '—' : `$${v.toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const today = new Date();
  const expires = new Date(today.getTime() + d.validDays * 86400_000);
  /* What the customer is buying, and what they are being offered.
     Kept apart on the page for the same reason they are kept apart in the total: a
     figure under "Total" that includes something the customer has not asked for is
     the one mistake on a quote that cannot be explained away afterwards. */
  const allLines = ev?.lines ?? [];
  const lines = allLines.filter((l) => !l.optional);
  const optional = allLines.filter((l) => l.optional);

  /* The solutions on this quote, in the order their first line was added.
     One quote can hold a coder at one station and an applicator at another. Run
     together they are one list with a stranger in it; the customer is the one person
     here who was not in the room when it was discussed, so the copy says which is
     which. `ALL` is not a solution — a service offering or a promotion belongs to
     whatever it was quoted beside — so those lines stay with the group above them. */
  const stations: { tech: string; lines: typeof lines }[] = [];
  for (const l of lines) {
    const tech = l.technologyCode && l.technologyCode !== 'ALL' ? l.technologyCode : null;
    const last = stations[stations.length - 1];
    if (tech && (!last || last.tech !== tech)) stations.push({ tech, lines: [l] });
    else if (last) last.lines.push(l);
    else stations.push({ tech: tech ?? '', lines: [l] });
  }
  const multiSolution = stations.filter((s) => s.tech).length > 1;
  const prospect = !draft.customerNo && !!draft.newCustomer;

  /* The down payment, where the order is big enough to need one. Shared with the
     Word export, so the file the customer keeps says what the screen said. */
  const down = downPayment(d, ev?.orderTotal ?? 0);

  /* The application, in the customer's own answers.
     Units are added back here because the profile stores millimetres and Fahrenheit
     and a customer reads neither as a bare number. Nothing is converted and nothing
     is inferred — an unanswered field is absent, not blank, because a printed row
     saying "—" tells the customer we did not ask. */
  const P = draft.profile ?? null;
  const mm = (v: number | null | undefined) => (v == null ? null : `${v} mm`);
  const restated: [string, string][] = !P ? [] : ([
    [FIELD_LABEL.substrate, P.substrate],
    [FIELD_LABEL.porosity, P.porosity === 'nonPorous' ? 'non-porous'
      : P.porosity === 'porous' ? 'porous' : null],
    [FIELD_LABEL.lineSpeedFpm, P.lineSpeedFpm == null ? null : `${P.lineSpeedFpm} fpm`],
    [FIELD_LABEL.throughputPpm, P.throughputPpm == null ? null : `${P.throughputPpm} a minute`],
    [FIELD_LABEL.productSpacingMm, mm(P.productSpacingMm)],
    ['product size', [P.productLengthMm, P.productWidthMm].every((v) => v != null)
      ? `${P.productLengthMm} × ${P.productWidthMm} mm` : null],
    [FIELD_LABEL.productTempF, P.productTempF == null ? null : `${P.productTempF} °F`],
    [FIELD_LABEL.charHeightMm, mm(P.charHeightMm)],
    [FIELD_LABEL.linesOfPrint, P.linesOfPrint == null ? null : String(P.linesOfPrint)],
    [FIELD_LABEL.markingWindowMm, mm(P.markingWindowMm)],
    [FIELD_LABEL.throwDistMm, mm(P.throwDistMm)],
    [FIELD_LABEL.messageContent, P.messageContent],
    [FIELD_LABEL.inkType, P.inkType],
    [FIELD_LABEL.barcodeRequirements, P.barcodeRequirements],
    [FIELD_LABEL.printQuality, PRINT_QUALITY_WORD[P.printQuality ?? ''] ?? null],
    [FIELD_LABEL.environment, P.environment],
    [FIELD_LABEL.conveyor, P.conveyor === 'existing' ? 'existing line'
      : P.conveyor === 'new' ? 'new conveyor' : null],
    [FIELD_LABEL.guideRails, P.guideRails === 'yes' ? 'yes' : P.guideRails === 'no' ? 'no' : null],
  ] as [string, string | null][]).filter((r): r is [string, string] => !!r[1]);

  /* The specification of what they are buying, from the vendor's own page.
     Only the machines: a bracket has no datasheet and listing one per line would bury
     the machine's under forty rows of accessory. */
  const datasheets = d.showDatasheet
    ? lines
      .map((l) => ({ line: l, specs: specsFor(l.model) }))
      .filter((x) => x.specs && x.line.itemRole === 'printer')
    : [];

  /* The monthly payment, if the rep asked for one.
     Worked out on what is actually being financed — the total less any down payment —
     which it was not: the deposit was added beside the total and this was left reading
     the total, so a $62,400 order quoted a monthly nearly double the real one.
     A typed figure still wins over a computed one: where the leasing company has quoted
     a monthly outright, that IS the number, and recomputing it from an APR the rep
     rounded would put a different figure on the page than the one the customer was
     told. With neither a rate nor a figure there is nothing to say, and the block
     does not appear rather than appearing empty. */
  const fin = d.financing?.show ? d.financing : null;
  const offer = financingOffer(d, ev?.orderTotal ?? 0);

  /* data-theme="light" on the sheet itself: this is paper. It is printed, it is sent,
     and a dark quote is not a thing anybody puts in front of a customer. The one
     surface in the app that does not follow the theme. */
  return (
    <article data-theme="light" className="quote-doc paper bg-surface p-10 text-steel-900">
      <header className="flex items-start justify-between gap-8 border-b-2 border-navy-900 pb-5">
        <div>
          <img src={AXIM_LOGO_BLUE} alt="Axim" className="h-8 w-auto" />
          <p className="mt-2 whitespace-pre-line text-2xs leading-relaxed text-steel-600">
            {d.footer}
          </p>
        </div>
        <div className="text-right">
          <h1 className="text-lg font-bold tracking-tight text-navy-900">Quotation</h1>
          <dl className="mt-1.5 space-y-0.5 text-2xs">
            {quoteNo && (
              <div className="flex justify-end gap-3">
                <dt className="text-steel-600">Quote</dt>
                <dd className="num font-semibold">{quoteNo}</dd>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <dt className="text-steel-600">Date</dt>
              <dd className="num">{shortDate(today.toISOString())}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-steel-600">Valid until</dt>
              <dd className="num">{shortDate(expires.toISOString())}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">Prepared for</h2>
          <p className="mt-1 text-sm font-semibold text-navy-900">
            {draft.customerName ?? draft.newCustomer?.companyName ?? '—'}
          </p>
          {draft.newCustomer?.contactName && (
            <p className="text-xs text-steel-800">{draft.newCustomer.contactName}</p>
          )}
          {draft.recipientEmail && <p className="text-xs text-steel-700">{draft.recipientEmail}</p>}
          {(draft.newCustomer?.city || draft.newCustomer?.state) && (
            <p className="text-xs text-steel-700">
              {[draft.newCustomer?.city, draft.newCustomer?.state].filter(Boolean).join(', ')}
            </p>
          )}
          {/* The customer's own copy says nothing about their ERP status — that is
              Axim's bookkeeping, not theirs. The internal copy is marked instead;
              see the print footer. */}
        </div>
        {d.showApplication && (
          <div>
            <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">Application</h2>
            <p className="mt-1 text-sm font-semibold text-navy-900">{draft.lineName ?? '—'}</p>
          </div>
        )}
      </section>

      {/* What the quote was priced against, in full.
          This was three lines — substrate, speed, and the line name — which is what
          fitted beside a photograph. With the photographs gone there is room for the
          thing the customer actually checks: that we understood their line. Every
          value is theirs, restated; nothing here is inferred at print time, and a
          field they never answered is simply absent rather than shown as a gap. */}
      {d.showApplication && restated.length > 0 && (
        <section className="mt-5 border-y border-steel-200 py-3">
          <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">
            The application this was priced against
          </h2>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-8 gap-y-0.5 sm:grid-cols-3">
            {restated.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-2 text-2xs">
                <dt className="text-steel-600">{label}</dt>
                <dd className="num text-right text-steel-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {d.intro.trim() && (
        <p className="mt-6 whitespace-pre-line text-xs leading-relaxed text-steel-800">
          {d.intro}
        </p>
      )}

      <table className="mt-7 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-steel-300 text-2xs uppercase tracking-wide text-steel-600">
            <th className="py-2 pr-3 text-left font-semibold">Qty</th>
            <th className="py-2 pr-3 text-left font-semibold">Part</th>
            <th className="py-2 pr-3 text-left font-semibold">Description</th>
            {d.showUnitPrices && <th className="py-2 pr-3 text-right font-semibold">Unit</th>}
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => (
            <Fragment key={station.tech || 'only'}>
              {/* Only when the quote actually holds more than one. A heading over the
                  only group is furniture. */}
              {multiSolution && station.tech && (
                <tr>
                  <td colSpan={d.showUnitPrices ? 5 : 4}
                      className="border-b border-steel-300 pt-4 pb-1 text-2xs
                                 font-semibold uppercase tracking-wide text-steel-600">
                    {TECHNOLOGY_WORD[station.tech] ?? station.tech}
                  </td>
                </tr>
              )}
              {station.lines.map((l) => (
            <tr key={l.itemNo} className="border-b border-steel-100 align-top">
              <td className="num py-2 pr-3">{l.quantity}</td>
              <td className="num py-2 pr-3 whitespace-nowrap">{l.itemNo}</td>
              <td className="py-2 pr-3">
                <span className="flex items-start gap-2.5">
                  <span className="min-w-0">{l.description}</span>
                </span>
              </td>
              {/* Net unit only. The list price and the discount that produced this
                  number are Axim's business, and printing them starts a
                  negotiation about the next five points. */}
              {d.showUnitPrices && (
                <td className="num py-2 pr-3 text-right align-top">{cash(l.netUnit)}</td>
              )}
              <td className="num py-2 text-right font-semibold">{cash(l.extendedNet)}</td>
            </tr>
              ))}
            </Fragment>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={d.showUnitPrices ? 5 : 4} className="py-6 text-center text-steel-500">
                No lines on this quote.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          {/* Money off, stated. A total that is simply lower than the lines add up to
              invites the customer to ask what happened to the difference, and the
              honest answer is worth showing: it is a discount, and it was given. */}
          {(ev?.flatDiscountApplied ?? 0) > 0 && (
            <tr>
              <td colSpan={d.showUnitPrices ? 4 : 3}
                  className="py-1.5 pr-3 text-right text-xs">Less discount</td>
              <td className="num py-1.5 text-right text-xs">
                −{cash(ev!.flatDiscountApplied)}
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-navy-900">
            <td colSpan={d.showUnitPrices ? 4 : 3}
                className="py-2.5 pr-3 text-right text-xs font-semibold">Total</td>
            <td className="num py-2.5 text-right text-sm font-bold text-navy-900">
              {cash(ev?.orderTotal ?? 0)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Offered, not included. Its own table and its own subtotal, under a heading
          that says what it is — so the number above stays the price. */}
      {optional.length > 0 && (
        <section className="mt-6">
          <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">
            Also available, not included above
          </h2>
          <table className="mt-1.5 w-full border-collapse text-xs">
            <tbody>
              {optional.map((l) => (
                <tr key={l.itemNo} className="border-b border-steel-100 align-top">
                  <td className="num py-2 pr-3 w-10">{l.quantity}</td>
                  <td className="num py-2 pr-3 whitespace-nowrap">{l.itemNo}</td>
                  <td className="py-2 pr-3">{l.description}</td>
                  {d.showUnitPrices && (
                    <td className="num py-2 pr-3 text-right">{cash(l.netUnit)}</td>
                  )}
                  <td className="num py-2 text-right font-semibold">{cash(l.extendedNet)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-steel-300">
                <td colSpan={d.showUnitPrices ? 4 : 3}
                    className="py-2 pr-3 text-right text-2xs text-steel-600">
                  If taken, in addition to the total above
                </td>
                <td className="num py-2 text-right text-xs font-semibold">
                  {cash(ev?.optionalNet ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
      {/* What is due when the order is placed, in dollars.
          REPORTED: "when something requires a down payment it doesn't say what the
          down payment comes out to." The terms below say "50% down on orders over
          $50,000", which is the policy and not a number — so the customer read a
          total, agreed to it, and found out what to pay on the invoice. The figure it
          works out to is stated here, next to the total it is half of. */}
      {down && (
        <section className="mt-4 border-t border-steel-300 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">
              Due with order
            </h2>
            <p className="num text-sm font-bold text-navy-900">{cash(down.amount)}</p>
          </div>
          <p className="mt-0.5 text-2xs text-steel-600">
            {Math.round(down.pct * 100)}% of {cash(ev?.orderTotal ?? 0)}, on orders of{' '}
            {cash(down.overAmount)} or more. The balance falls due on the terms below.
          </p>
        </section>
      )}
      <p className="mt-1.5 text-2xs text-steel-600">
        All figures USD. Freight, installation and applicable taxes are quoted separately
        unless a line above states otherwise.
      </p>


      {/* The monthly, when the rep has one to state.
          The payment is computed from the term and rate THEY entered — the standard
          amortising formula, which is arithmetic rather than a claim about anybody's
          credit terms. Where the leasing company gave a monthly outright, that figure
          is used as typed and nothing is computed at all. */}
      {fin && offer != null && (
        <section className="mt-6 border border-steel-200 bg-steel-50 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">
              Or from
            </h2>
            <p className="num text-base font-bold text-navy-900">
              {cash(offer.monthly)}<span className="text-2xs font-normal text-steel-600">
                {' '}per month × {fin.months}
              </span>
            </p>
          </div>
          {/* What the figure is a figure ON. A monthly sitting under a total reads as
              the total spread over the term, and with a down payment taken first it is
              not — so the amount being financed is named rather than left to be
              inferred from two numbers that do not divide into each other. */}
          {offer.deposit > 0 && (
            <p className="mt-1 text-2xs text-steel-600">
              On {cash(offer.financed)} financed, after the {cash(offer.deposit)} due
              with the order.
            </p>
          )}
          {fin.note.trim() && (
            <p className="mt-1.5 text-2xs leading-relaxed text-steel-600">{fin.note}</p>
          )}
        </section>
      )}

      {/* The machine's specification, printed with the quote.
          Every row is the vendor's own wording. The source is NOT named here: asked
          for, and right — a customer reading what they are buying does not need our
          filing reference, and a line of provenance under a spec table on a sales
          document reads as a disclaimer. The citation is still on the rep's screen,
          where somebody might actually have to defend the figure. */}
      {datasheets.map(({ line, specs }) => (
        <section key={line.itemNo} className="mt-6 spec-block">
          <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">
            Specification — {line.model}
          </h2>
          <dl className="mt-1.5 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {Object.entries(specs!.specs).map(([k, v]) => (
              <div key={k}
                   className="flex items-baseline justify-between gap-3 border-b border-steel-100 py-1 text-2xs">
                <dt className="text-steel-600">{k}</dt>
                <dd className="max-w-[55%] text-right text-steel-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {/* Terms. Filled by default now — see the note at the top of this file. The
          placeholder stays for the rep who clears the box. */}
      <section className="mt-8 border-t border-steel-200 pt-4">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-steel-600">
          Terms and conditions
        </h2>
        <div className="terms-slot mt-1.5 min-h-[3.5rem] whitespace-pre-line text-2xs leading-relaxed text-steel-700">
          {d.terms.trim() || (
            <span className="text-steel-500">
              [ Axim standard terms and conditions to be inserted — not held in this
              system. ]
            </span>
          )}
        </div>
      </section>

      <footer className="mt-8 flex items-end justify-between gap-8 border-t border-steel-200 pt-4">
        {/* Who to answer. A quote goes out over one person's name, and until now that
            was all it gave the customer — a name, and no way to reply to it that did
            not involve going back through the email it arrived in. Everything absent
            from the directory is simply left out. */}
        <div className="text-2xs text-steel-700">
          <p className="font-semibold text-navy-900">Prepared by</p>
          <p className="font-semibold text-steel-800">{repName ?? '—'}</p>
          {repEmail && <p><a href={`mailto:${repEmail}`} className="text-navy-700">{repEmail}</a></p>}
          {repPhone && <p className="num">{repPhone}</p>}
        </div>
        {prospect && (
          /* Internal marking, hidden from the customer's copy by print CSS. A quote
             against a customer who is not in the ERP has to be recognisable on paper
             six weeks later, when somebody is trying to work out why it will not
             close. */
          <p className="internal-only text-2xs font-semibold text-signal-900">
            INTERNAL: prospect — no Orbit account yet
          </p>
        )}
      </footer>
    </article>
  );
}
