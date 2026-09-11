// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { APPLICATION_RULES } from '../api/appRules';
import { mockApi } from '../api/mock';
import { AppProvider } from '../state/app';
import { QuoteDetail } from './QuoteDetail';

/**
 * A fit grade has to name the document it rests on.
 *
 * PRODUCT.md's headline claim is that every machine grade cites a published
 * specification. A critique found the pricing rules citing correctly and the fit rules —
 * the actual differentiator, the ones a customer challenges — rendering a rule code and a
 * sentence with no author and no source. The data was there the whole time; the reason
 * type simply did not carry it out of the engine.
 *
 * This is the test that keeps it there, at both ends: the engine has to emit it and the
 * screen has to draw it.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  globalThis.scrollTo ??= (() => {}) as never;
});
afterEach(cleanup);

describe('a fit grade', () => {
  it('carries its citation out of the engine', async () => {
    const q = await mockApi.getQuote('Q-2026-0731');
    const reasons = (q.fit ?? []).flatMap((f) => f.reasons);
    expect(reasons.length).toBeGreaterThan(0);

    // Every reason that came from a rule with a source must carry it through.
    const byCode = new Map(APPLICATION_RULES.map((r) => [r.ruleCode, r]));
    for (const r of reasons) {
      const rule = byCode.get(r.ruleCode);
      if (!rule?.sourceRef) continue;
      expect(r.sourceRef, `${r.ruleCode} lost its sourceRef`).toBe(rule.sourceRef);
      expect(r.author, `${r.ruleCode} lost its author`).toBe(rule.author);
    }
  });

  it('shows the document on the saved quote, not just the rule code', async () => {
    render(<AppProvider><QuoteDetail quoteNo="Q-2026-0731" /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/Against the application/).length)
      .toBeGreaterThan(0), { timeout: 8000 });

    const panel = screen.getByText(/Against the application/).closest('section')!;
    // A-CIJ-SPD-6400 cites the Corvus 6400 technical datasheet. A rep reading this row
    // aloud has to be able to name that document.
    expect(within(panel).getAllByText(/datasheet/i).length).toBeGreaterThan(0);
    expect(panel.textContent).toMatch(/Axim-Corvus-6400-technical-datasheet/);
  });
});

describe('a collapsed section', () => {
  it('points aria-controls at an element that exists', async () => {
    // The panel id used to render only while open, so every collapsed section named a
    // target that getElementById could not find — an ARIA reference broken by the very
    // change that added aria-controls.
    const { QuoteBuilder } = await import('./QuoteBuilder');
    render(<AppProvider><QuoteBuilder /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/Who is it for/).length)
      .toBeGreaterThan(0), { timeout: 8000 });

    const controls = [...document.querySelectorAll('[aria-controls]')]
      .map((b) => b.getAttribute('aria-controls')!);
    expect(controls.length).toBeGreaterThan(1);
    const dangling = controls.filter((id) => document.getElementById(id) === null);
    expect(dangling).toEqual([]);
  });
});
