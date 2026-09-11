import { describe, expect, it } from 'vitest';
import { mockApi } from '../api/mock';
import { DEFAULT_DOCUMENT, EMPTY_PROFILE } from '../api/types';
import { wordQuote } from './wordQuote';

/**
 * The Word document is built, not scraped.
 *
 * REPORTED: "the word and excel exports are really shitty... it needs to be
 * presentable to a customer." The old one cloned the rendered sheet, and Word has no
 * flexbox and no grid, so the letterhead, the two-column header and the application
 * grid all collapsed into stacked text.
 *
 * What is asserted here is the difference between a document and a dump: page setup,
 * a letterhead, real tables, and the same figures the screen shows.
 */
async function fixture(over: Record<string, unknown> = {}) {
  const q = await mockApi.getQuote('Q-2026-0731');
  const draft = {
    technologyCode: q.technologyCode, customerNo: q.customerNo ?? null,
    customerName: q.customerName ?? null, lineName: q.lineName ?? null,
    profile: q.profile ?? EMPTY_PROFILE, noConstraint: [], flags: {},
    categoryDiscounts: q.categoryDiscounts ?? {},
    lines: q.lines.map((l) => ({ itemNo: l.itemNo, quantity: l.quantity })),
    ...over,
  } as never as import('../api/types').QuoteDraft;
  const ev = await mockApi.evaluateDraft(draft);
  return { draft, ev };
}

/**
 * The document is MHTML now: one multipart/related file with the HTML in one part and
 * the letterhead PNG in another. Word cannot render SVG, which is what the letterhead
 * used to be — reported as "the word doc has an error for the logo".
 *
 * These tests read the HTML back out of the envelope, which also checks the envelope.
 */
function htmlOf(mht: string): string {
  const parts = mht.split(/--=*_NextPart_Axim_CPQ/);
  const htmlPart = parts.find((p) => /Content-Type: text[/]html/i.test(p))!;
  // Headers, one blank line, then the base64 body.
  const body = htmlPart.split('\r\n\r\n').slice(1).join('');
  return Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64').toString('utf8');
}

describe('the Word envelope', () => {
  it('is one multipart file with the logo inside it', async () => {
    const { draft, ev } = await fixture();
    const mht = wordQuote({ draft, ev, quoteNo: 'Q' });
    expect(mht).toMatch(/^MIME-Version: 1\.0/);
    expect(mht).toContain('multipart/related');
    expect(mht).toContain('Content-Type: image/png');
    expect(mht).toContain('axim-logo.png');
    expect(mht.trimEnd().endsWith('--')).toBe(true);
  });

  it('carries no SVG anywhere, because Word cannot draw one', async () => {
    const { draft, ev } = await fixture();
    const mht = wordQuote({ draft, ev, quoteNo: 'Q' });
    expect(mht).not.toContain('image/svg');
    expect(htmlOf(mht)).not.toContain('svg');
  });

  it('references the logo by name rather than embedding a data URI', async () => {
    const { draft, ev } = await fixture();
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q' }));
    expect(html).toMatch(/<img[^>]+src="axim-logo\.png"/);
    expect(html).not.toMatch(/<img[^>]+src="data:/);
  });
});

describe('the Word quote', () => {
  it('is a Word document, not a web page', async () => {
    const { draft, ev } = await fixture();
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q-2026-0731' }));
    // Without these Word opens it in Web Layout with no page edges, which is the
    // first thing anybody notices about a bad export.
    expect(html).toContain('urn:schemas-microsoft-com:office:word');
    expect(html).toContain('@page Section1');
    expect(html).toContain('size: 8.5in 11.0in');
    expect(html).toContain('class="Section1"');
  });

  it('lays out with tables, because Word has no flexbox', async () => {
    const { draft, ev } = await fixture();
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q-2026-0731' }));
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).not.toMatch(/display:\s*grid/);
    // And no Tailwind, which is what the clone was carrying and Word ignores.
    expect(html).not.toMatch(/class="[^"]*\b(?:flex|grid|mt-\d|text-2xs)\b/);
  });

  it('carries the letterhead and the logo', async () => {
    const { draft, ev } = await fixture();
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q-2026-0731' }));
    expect(html).toContain('Quotation');
    // By name, not by data URI — the image lives in the MHTML part beside it.
    expect(html).toMatch(/<img[^>]+src="axim-logo\.png"/);
    expect(html).toContain('120 Foundry Road');
  });

  it('shows the same money the screen does', async () => {
    const { draft, ev } = await fixture();
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q-2026-0731' }));
    const total = ev.orderTotal.toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(html).toContain(`$${total}`);
    for (const l of ev.lines) expect(html).toContain(l.itemNo);
  });

  it('keeps optional lines out of the total and under their own heading', async () => {
    const base = await fixture();
    const last = base.draft.lines[base.draft.lines.length - 1];
    const { draft, ev } = await fixture({
      lines: base.draft.lines.map((l) =>
        (l.itemNo === last.itemNo ? { ...l, optional: true } : l)),
    });
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q-2026-0731' }));
    expect(html).toContain('Also available, not included above');
    expect(html).toContain('If taken, in addition to the total above');
  });

  it('states an amount off rather than quietly lowering the total', async () => {
    const { draft, ev } = await fixture({ flatDiscount: 500 });
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q-2026-0731' }));
    expect(html).toContain('Less discount');
  });

  it('prints the monthly on the same arithmetic as the screen', async () => {
    const { draft, ev } = await fixture();
    const html = htmlOf(wordQuote({
      draft, ev, quoteNo: 'Q',
      settings: { ...DEFAULT_DOCUMENT,
        financing: { ...DEFAULT_DOCUMENT.financing!, show: true, apr: 0.089, months: 60 } },
    }));
    const r = 0.089 / 12;
    const expected = Math.round(((ev.orderTotal * r) / (1 - (1 + r) ** -60)) * 100) / 100;
    expect(html).toContain(expected.toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    expect(html).toContain('subject to credit approval');
  });

  it('escapes what it is given', async () => {
    // A customer name is free text and this file is markup.
    const { draft, ev } = await fixture({ customerName: 'A <script>alert(1)</script> & Co' });
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; Co');
  });

  it('never puts the discount percentage or margin on it', async () => {
    // Same rule as the screen: the customer sees the price they pay.
    const { draft, ev } = await fixture({ flatDiscount: 500 });
    const html = htmlOf(wordQuote({ draft, ev, quoteNo: 'Q' }));
    const body = html.slice(html.indexOf('<body'));
    expect(body).not.toMatch(/margin[^:-]*:\s*\d+(\.\d+)?%/i);
    expect(body).not.toContain(String(ev.totalDiscount));
  });
});
