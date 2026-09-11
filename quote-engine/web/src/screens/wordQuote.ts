import { DEFAULT_DOCUMENT, type DocumentSettings, type Evaluation, type QuoteDraft } from '../api';
import {
  AXIM_LOGO_PNG_BASE64, AXIM_LOGO_PNG_HEIGHT, AXIM_LOGO_PNG_WIDTH,
} from '../api/logoRaster';
import { specsFor } from '../api/specs';
import { PRINT_QUALITY_WORD } from '../api/words';
import { downPayment, financingOffer } from './documentMoney';
import { FIELD_LABEL } from '../engine/parseApplication';

/**
 * The quote as a Word document a rep can put in front of a customer.
 *
 * ── Why this is not the screen's HTML ───────────────────────────────────────
 *
 * The first version cloned the rendered `.quote-doc` and wrapped it in a small
 * stylesheet. It was reported as "really shitty" and it was: Word has no flexbox and
 * no CSS grid, so every layout in that markup collapsed. The letterhead — logo left,
 * quote number right — became two stacked blocks. "Prepared for" and "Application"
 * stacked. The application restatement, a three-column grid on screen, came out as
 * eighteen lines in a row. Tailwind's classes mean nothing in Word either, so what
 * survived was unstyled text in roughly the wrong order.
 *
 * A document for Word has to be built the way Word lays a document out, which is
 * tables with explicit widths, and from the DATA rather than from the DOM. That is
 * what this does. It is more code than a clone and it is the only version that
 * produces something a customer can be shown.
 *
 * ── Why Word at all ─────────────────────────────────────────────────────────
 *
 * Asked for so the sales team can add their own photographs and paragraphs to a quote
 * before it goes out. Word is the right tool for that and Publisher is not: everyone
 * has it, everyone can already edit it, and a .doc opens on a phone. What was wrong
 * was the file this app was handing them, not the choice of program.
 *
 * The output is Word HTML rather than a real .docx, deliberately. A .docx is a zip of
 * XML parts and would mean a packaging library in a build whose whole point is that it
 * is one openable file with no dependencies. Word opens this, styles it, prints it,
 * and — the part that matters — lets a rep click anywhere and insert a picture.
 */

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (v: number | null | undefined) =>
  (v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const day = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Word measures in points and inches. Everything below is stated in one or the other. */
const RULE = '1pt solid #B6BEC4';
const HAIR = '0.5pt solid #DCE1E5';
const NAVY = '#023B74';

/* The letterhead image, and why this file emits MHTML.
   The app's wordmark is an SVG data URI, which is right everywhere except here: Word
   cannot render SVG at all, so the letterhead came out as Word's broken-image
   placeholder. REPORTED as "the word doc has an error for the logo".

   Base64 data: URIs in an <img> are barely better — Word's HTML import accepts them in
   some versions and refuses them in others, which is the kind of thing that works on
   the machine you tested it on.

   So the document is MHTML: one multipart/related file with the HTML in one part and
   the PNG in another, referenced by a plain relative name. That is the format Word
   itself writes when it saves a web page, it embeds properly, and the file stays a
   single thing a rep can attach to an email. */
const LOGO_PART = 'axim-logo.png';
const BOUNDARY = '----=_NextPart_Axim_CPQ';

/** Wrap a Word HTML document and its one image into a single MHTML file. */
function mhtml(html: string): string {
  const b64 = (t: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(t)))
      .replace(/(.{76})/g, '$1\r\n');
  return [
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${BOUNDARY}"; type="text/html"`,
    '',
    `--${BOUNDARY}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    'Content-Location: file:///C:/quote/quote.htm',
    '',
    // Base64 rather than 8bit: the terms block is one very long line and MIME parts
    // are meant to wrap at 998 characters. Encoding sidesteps the whole question.
    b64(html),
    '',
    `--${BOUNDARY}`,
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    `Content-Location: file:///C:/quote/${LOGO_PART}`,
    '',
    AXIM_LOGO_PNG_BASE64.replace(/(.{76})/g, '$1\r\n'),
    '',
    `--${BOUNDARY}--`,
    '',
  ].join('\r\n');
}

export function wordQuote({ draft, ev, quoteNo, repName, repEmail, repPhone, settings }: {
  draft: QuoteDraft;
  ev: Evaluation | null;
  quoteNo?: string;
  repName?: string | null;
  repEmail?: string | null;
  repPhone?: string | null;
  settings?: DocumentSettings | null;
}): string {
  const d = { ...DEFAULT_DOCUMENT, ...(settings ?? {}), ...(draft.document ?? {}) };
  const today = new Date();
  const expires = new Date(today.getTime() + d.validDays * 86400_000);
  const all = ev?.lines ?? [];
  const lines = all.filter((l) => !l.optional);
  const optional = all.filter((l) => l.optional);
  const cols = d.showUnitPrices ? 5 : 4;

  /* ---------------------------------------------------------------- letterhead
     A two-cell table, because that is how Word puts one thing left and another
     right. The logo is a plain relative name resolved against the MHTML part beside
     it — see mhtml() for why it is not a data URI. */
  const head = `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr>
    <td width="55%" style="padding:0 0 10pt 0;vertical-align:top">
      <img src="${LOGO_PART}" alt="Axim" width="190" height="${
        Math.round(190 * AXIM_LOGO_PNG_HEIGHT / AXIM_LOGO_PNG_WIDTH)}"
           style="width:190px"/>
      <div style="font-size:7.5pt;color:#4F585F;margin-top:6pt;line-height:11pt">
        ${esc(d.footer).replace(/\n/g, '<br/>')}
      </div>
    </td>
    <td width="45%" style="padding:0 0 10pt 0;vertical-align:top;text-align:right">
      <div style="font-size:15pt;font-weight:bold;color:${NAVY};letter-spacing:-0.3pt">Quotation</div>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-left:auto;margin-top:4pt">
        ${quoteNo ? row2('Quote', esc(quoteNo), true) : ''}
        ${row2('Date', day(today))}
        ${row2('Valid until', day(expires))}
      </table>
    </td>
  </tr>
</table>
<div style="border-bottom:1.5pt solid ${NAVY};font-size:1pt;margin-bottom:12pt">&nbsp;</div>`;

  /* ------------------------------------------------------------------ who, what */
  const application = d.showApplication ? `
    <td width="50%" style="vertical-align:top;padding:0 0 0 12pt">
      <div style="${LABEL}">Application</div>
      <div style="font-size:11pt;font-weight:bold;color:${NAVY};margin-top:2pt">
        ${esc(draft.lineName ?? '—')}</div>
    </td>` : '<td width="50%"></td>';

  const parties = `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14pt">
  <tr>
    <td width="50%" style="vertical-align:top">
      <div style="${LABEL}">Prepared for</div>
      <div style="font-size:11pt;font-weight:bold;color:${NAVY};margin-top:2pt">
        ${esc(draft.customerName ?? draft.newCustomer?.companyName ?? '—')}</div>
      ${draft.newCustomer?.contactName ? `<div style="font-size:9pt">${esc(draft.newCustomer.contactName)}</div>` : ''}
      ${draft.recipientEmail ? `<div style="font-size:9pt;color:#3B444B">${esc(draft.recipientEmail)}</div>` : ''}
    </td>
    ${application}
  </tr>
</table>`;

  /* ------------------------------------------------------- the application, in full */
  const restated = restatement(draft);
  const appBlock = (d.showApplication && restated.length)
    ? `<div style="${LABEL};margin-bottom:4pt">The application this was priced against</div>
       <table width="100%" cellpadding="0" cellspacing="0"
              style="border-collapse:collapse;margin-bottom:14pt;border-top:${HAIR};border-bottom:${HAIR}">
         ${pairRows(restated)}
       </table>`
    : '';

  /* ------------------------------------------------------------------ the lines */
  const lineRows = lines.length ? lines.map((l) => `
  <tr>
    <td style="${CELL};width:36pt">${esc(l.quantity)}</td>
    <td style="${CELL};width:96pt;font-family:Consolas,'Courier New',monospace">${esc(l.itemNo)}</td>
    <td style="${CELL}">${esc(l.description)}</td>
    ${d.showUnitPrices ? `<td style="${CELL};text-align:right;width:70pt">${money(l.netUnit)}</td>` : ''}
    <td style="${CELL};text-align:right;width:80pt;font-weight:bold">${money(l.extendedNet)}</td>
  </tr>`).join('')
    : `<tr><td colspan="${cols}" style="${CELL};text-align:center;color:#6B747B">No lines on this quote.</td></tr>`;

  const discountRow = (ev?.flatDiscountApplied ?? 0) > 0 ? `
  <tr>
    <td colspan="${cols - 1}" style="${CELL};text-align:right;border-bottom:none">Less discount</td>
    <td style="${CELL};text-align:right;border-bottom:none">&#8722;${money(ev!.flatDiscountApplied)}</td>
  </tr>` : '';

  const table = `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr>
    <td style="${HEAD};width:36pt">Qty</td>
    <td style="${HEAD};width:96pt">Part</td>
    <td style="${HEAD}">Description</td>
    ${d.showUnitPrices ? `<td style="${HEAD};text-align:right;width:70pt">Unit</td>` : ''}
    <td style="${HEAD};text-align:right;width:80pt">Amount</td>
  </tr>
  ${lineRows}
  ${discountRow}
  <tr>
    <td colspan="${cols - 1}" style="${CELL};border-top:1.5pt solid ${NAVY};border-bottom:none;
        text-align:right;font-weight:bold">Total</td>
    <td style="${CELL};border-top:1.5pt solid ${NAVY};border-bottom:none;text-align:right;
        font-size:12pt;font-weight:bold;color:${NAVY}">${money(ev?.orderTotal ?? 0)}</td>
  </tr>
</table>
<div style="font-size:7.5pt;color:#4F585F;margin-top:4pt">
  All figures USD. Freight, installation and applicable taxes are quoted separately
  unless a line above states otherwise.
</div>`;

  /* -------------------------------------------------------------- also available */
  const optionalBlock = optional.length ? `
<div style="${LABEL};margin-top:16pt;margin-bottom:4pt">Also available, not included above</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  ${optional.map((l) => `
  <tr>
    <td style="${CELL};width:36pt">${esc(l.quantity)}</td>
    <td style="${CELL};width:96pt;font-family:Consolas,'Courier New',monospace">${esc(l.itemNo)}</td>
    <td style="${CELL}">${esc(l.description)}</td>
    ${d.showUnitPrices ? `<td style="${CELL};text-align:right;width:70pt">${money(l.netUnit)}</td>` : ''}
    <td style="${CELL};text-align:right;width:80pt;font-weight:bold">${money(l.extendedNet)}</td>
  </tr>`).join('')}
  <tr>
    <td colspan="${cols - 1}" style="${CELL};border-bottom:none;text-align:right;font-size:8pt;color:#4F585F">
      If taken, in addition to the total above</td>
    <td style="${CELL};border-bottom:none;text-align:right;font-weight:bold">${money(ev?.optionalNet ?? 0)}</td>
  </tr>
</table>` : '';

  /* ------------------------------------------------------------- down payment */
  /* The same figure the on-screen copy states, computed the same way. A Word file a
     rep has already emailed is the version the customer keeps, so a number that only
     the preview knows is a number the customer never sees. */
  const downPay = downPayment(d, ev?.orderTotal ?? 0);
  const downBlock = downPay ? `
<table width="100%" cellpadding="0" cellspacing="0"
       style="border-collapse:collapse;margin-top:10pt;border-top:${HAIR}">
  <tr>
    <td style="${LABEL};padding-top:5pt">Due with order</td>
    <td style="text-align:right;font-size:11pt;font-weight:bold;color:${NAVY};padding-top:5pt">
      ${money(downPay.amount)}</td>
  </tr>
  <tr>
    <td colspan="2" style="font-size:8pt;color:#4F585F;padding-top:2pt">
      ${Math.round(downPay.pct * 100)}% of ${money(ev?.orderTotal ?? 0)}, on orders of
      ${money(downPay.overAmount)} or more. The balance falls due on the terms below.</td>
  </tr>
</table>` : '';

  /* ------------------------------------------------------------------ financing */
  const offer = financingOffer(d, ev?.orderTotal ?? 0);
  const finBlock = offer != null ? `
<table width="100%" cellpadding="0" cellspacing="0"
       style="border-collapse:collapse;margin-top:16pt;border:${HAIR};background:#F5F7F8">
  <tr><td style="padding:8pt 10pt">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr>
        <td style="${LABEL}">Or from</td>
        <td style="text-align:right;font-size:13pt;font-weight:bold;color:${NAVY}">
          ${money(offer.monthly)}<span style="font-size:8pt;font-weight:normal;color:#4F585F">
          per month &#215; ${esc(d.financing!.months)}</span>
        </td>
      </tr>
    </table>
    ${offer.deposit > 0
      ? `<div style="font-size:8pt;color:#4F585F;margin-top:3pt">On ${money(offer.financed)}
         financed, after the ${money(offer.deposit)} due with the order.</div>`
      : ''}
    ${d.financing!.note.trim()
      ? `<div style="font-size:7.5pt;color:#4F585F;margin-top:4pt;line-height:11pt">${esc(d.financing!.note)}</div>`
      : ''}
  </td></tr>
</table>` : '';

  /* ----------------------------------------------------------------- datasheets */
  const sheets = d.showDatasheet
    ? lines.filter((l) => l.itemRole === 'printer' && specsFor(l.model)).map((l) => {
      const spec = specsFor(l.model)!;
      return `
<div style="margin-top:16pt">
  <div style="${LABEL};margin-bottom:4pt">Specification &#8212; ${esc(l.model)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${pairRows(Object.entries(spec.specs))}
  </table>
</div>`;
    }).join('')
    : '';

  /* --------------------------------------------------------------------- terms */
  const terms = `
<div style="border-top:${HAIR};margin-top:18pt;padding-top:8pt">
  <div style="${LABEL};margin-bottom:3pt">Terms and conditions</div>
  <div style="font-size:7.5pt;color:#3B444B;line-height:11pt">
    ${esc(d.terms).replace(/\n/g, '<br/>')}
  </div>
</div>`;

  const prepared = `
<div style="border-top:${HAIR};margin-top:14pt;padding-top:8pt;font-size:8pt;color:#3B444B">
  <div style="font-weight:bold;color:${NAVY}">Prepared by</div>
  <div style="font-weight:bold">${esc(repName ?? '—')}</div>
  ${repEmail ? `<div>${esc(repEmail)}</div>` : ''}
  ${repPhone ? `<div>${esc(repPhone)}</div>` : ''}
</div>`;

  /* The mso block is what makes Word treat this as a document rather than a web page:
     Letter paper, real margins, print view. Without it the file opens in Web Layout
     with no page edges, which is the first thing anybody notices. */
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>${esc(quoteNo ?? 'Quotation')}</title>
<!--[if gte mso 9]><xml>
 <w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>
 <w:DoNotOptimizeForBrowser/></w:WordDocument>
</xml><![endif]-->
<style>
  @page Section1 { size: 8.5in 11.0in; margin: 0.6in 0.6in 0.7in 0.6in; }
  div.Section1 { page: Section1; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 9.5pt; color: #1B2226; }
  table { border-collapse: collapse; }
  p { margin: 0 0 6pt 0; }
</style>
</head>
<body><div class="Section1">
${head}
${parties}
${d.intro.trim() ? `<p style="font-size:9.5pt;line-height:14pt">${esc(d.intro).replace(/\n/g, '<br/>')}</p>` : ''}
${appBlock}
${table}
${optionalBlock}
${downBlock}
${finBlock}
${sheets}
${terms}
${prepared}
</div></body></html>`;

  return mhtml(html);
}

/* ------------------------------------------------------------------ fragments */

const LABEL = 'font-size:7.5pt;font-weight:bold;color:#4F585F;'
  + 'text-transform:uppercase;letter-spacing:0.4pt';
const HEAD = 'font-size:7.5pt;font-weight:bold;color:#4F585F;text-transform:uppercase;'
  + `letter-spacing:0.4pt;padding:5pt 6pt;border-top:${RULE};border-bottom:${RULE}`;
/* Rows stay whole; blocks do not.
   A twenty-row specification is taller than what is left of a page more often than
   not, and page-break-inside:avoid on the whole block pushes the entire table to the
   next page and leaves a hand's width of white behind it. Keeping the ROWS together
   is the part that matters — a label on one page and its value on the next is the
   only break that actually reads wrong.

   Column widths go on the FIRST row of a table, not on the body rows: Word takes a
   table's columns from the first row it meets. They were on the body cells while the
   header row expressed no opinion, so Word sized the columns off the wrong row and
   the body rows then argued with the result. */
const CELL = `padding:5pt 6pt;border-bottom:${HAIR};vertical-align:top;`
  + 'page-break-inside:avoid';

function row2(label: string, value: string, mono = false): string {
  return `<tr>
    <td style="font-size:8pt;color:#4F585F;padding:0 8pt 1pt 0;text-align:right">${label}</td>
    <td style="font-size:8pt;padding:0 0 1pt 0;text-align:right${
      mono ? ";font-family:Consolas,'Courier New',monospace;font-weight:bold" : ''}">${value}</td>
  </tr>`;
}

/** Two columns of label/value, wrapped so a long list reads as a block rather than a
    column a page and a half tall. */
function pairRows(pairs: [string, string][]): string {
  const out: string[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const [a, b] = [pairs[i], pairs[i + 1]];
    out.push(`<tr>
      <td style="${CELL};width:22%;font-size:8pt;color:#4F585F">${esc(a[0])}</td>
      <td style="${CELL};width:28%;font-size:8pt">${esc(a[1])}</td>
      <td style="${CELL};width:22%;font-size:8pt;color:#4F585F">${b ? esc(b[0]) : ''}</td>
      <td style="${CELL};width:28%;font-size:8pt">${b ? esc(b[1]) : ''}</td>
    </tr>`);
  }
  return out.join('');
}

/** The same restatement the screen prints, in the same order and with the same units. */
function restatement(draft: QuoteDraft): [string, string][] {
  const P = draft.profile;
  if (!P) return [];
  const mm = (v: number | null | undefined) => (v == null ? null : `${v} mm`);
  return ([
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
}

/** Mirrors the screen: a typed figure wins, otherwise the amortising payment. */

