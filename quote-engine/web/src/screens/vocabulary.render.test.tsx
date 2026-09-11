// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppProvider } from '../state/app';
import { QuoteDetail } from './QuoteDetail';
import { Quotes } from './Quotes';

/**
 * No screen shouts a variable name.
 *
 * The status component uppercases its legend, and the quote header was given `q.status`
 * raw — so a quote awaiting a decision announced **PENDINGAPPROVAL** to the person
 * deciding it. (That component was `Tag`, a pill, and is now `Status`; the legend and
 * compact forms still uppercase, so the trap it set is still open.) The
 * quote LIST had a label map and the quote DETAIL did not, which is the shape of the bug:
 * not a missing feature, a vocabulary that lived in one screen instead of one module.
 *
 * The same header rendered `PO_RECEIPT` as the reason for a promise date — a column value
 * standing in for "on a purchase order", on the line a rep reads to a customer.
 *
 * So this test looks for the SHAPE rather than the two strings that were reported. A
 * screen that renders any camelCase or SNAKE_CASE token fails, including tokens nobody has
 * written yet.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  globalThis.scrollTo ??= (() => {}) as never;
});
afterEach(cleanup);

/** camelCase, snake_case or SCREAMING_SNAKE, as whole words. */
const CODE_SHAPED = /\b(?:[a-z]+[A-Z][a-zA-Z]*|[A-Za-z]+_[A-Za-z_]+)\b/;

/* Part numbers and file names are legitimately code-shaped and are not vocabulary:
   YD80771, Z167N714HJU, Axim-Corvus-6400-technical-datasheet.pdf, rule codes. */
const ALLOWED = [
  /^[A-Z0-9][A-Z0-9/-]*$/,              // part numbers, rule codes
  /\.(pdf|md|json|xlsm|xlsx)$/i,        // cited documents
  /^products\//,                        // portfolio paths in citations
];

/**
 * The rendered words, with element boundaries kept apart.
 *
 * `document.body.textContent` welds adjacent elements together — a heading ending "a quote"
 * followed by "Describe the application" becomes "quoteDescribe", which is camelCase to a
 * regex and nothing to a reader. Every text node is collected separately instead, so what
 * is tested is what a person actually sees.
 */
function visibleText(root: HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim();
    if (t) parts.push(t);
  }
  return parts.join(' | ');
}

function offenders(text: string): string[] {
  const out: string[] = [];
  for (const token of text.split(/\s+/)) {
    const bare = token.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!bare || !CODE_SHAPED.test(bare)) continue;
    if (ALLOWED.some((re) => re.test(bare))) continue;
    out.push(bare);
  }
  return [...new Set(out)];
}

describe('a quote awaiting approval', () => {
  it('says so in words, on the quote itself', async () => {
    render(<AppProvider><QuoteDetail quoteNo="Q-2026-0731" /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/Q-2026-0731/).length).toBeGreaterThan(0),
      { timeout: 8000 });
    const text = visibleText(document.body);
    expect(text).not.toMatch(/pendingApproval/i);
    expect(text).not.toMatch(/PO_RECEIPT|LEAD_TIME/);
  });

  it('renders no code-shaped token anywhere on the page', async () => {
    render(<AppProvider><QuoteDetail quoteNo="Q-2026-0731" /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/Q-2026-0731/).length).toBeGreaterThan(0),
      { timeout: 8000 });
    expect(offenders(visibleText(document.body))).toEqual([]);
  });
});

describe('the quote list', () => {
  it('renders no code-shaped token either', async () => {
    render(<AppProvider><Quotes /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/quote/i).length).toBeGreaterThan(0),
      { timeout: 8000 });
    expect(offenders(visibleText(document.body))).toEqual([]);
  });
});
