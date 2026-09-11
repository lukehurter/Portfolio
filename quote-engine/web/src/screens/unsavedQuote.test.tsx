// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AppProvider } from '../state/app';

/**
 * Backing out of a half-built quote asks first.
 *
 * The guard itself is covered in components/unsavedGuard.test.tsx. This is the wiring
 * — that the builder actually reports itself as dirty while a rep is working, through
 * the real screen and the real router. Reported twice from use before it was true, so
 * it is tested the way it is used rather than in the abstract.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  globalThis.scrollTo ??= (() => {}) as never;
});
beforeEach(() => { window.location.hash = '#/quotes/new'; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('leaving the quote builder', () => {
  it('asks before dropping work the rep has typed', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AppProvider><App /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/Who is it for/).length).toBeGreaterThan(0),
      { timeout: 8000 });

    // The one thing a rep types first, and the thing they would be sorriest to lose.
    await user.click(screen.getAllByRole('button', { name: /The application/ })[0]);
    const box = await waitFor(() => screen.getByRole('textbox', { name: /paste|describe/i }),
      { timeout: 5000 });
    await user.type(box, 'HDPE bottles, 300 fpm, 4mm date code.');
    await user.click(screen.getAllByRole('button', { name: /^Read it$/ })[0]);
    expect(screen.queryByRole('alertdialog'), 'nothing asked while working').toBeNull();

    window.location.hash = '#/quotes';
    await settle();

    await waitFor(() => expect(screen.queryByRole('alertdialog'),
      'backing out of a started quote must ask').toBeTruthy());
    expect(window.location.hash, 'the address is put back before asking').toBe('#/quotes/new');
  });

  it('says nothing about a quote nobody has touched', async () => {
    render(<AppProvider><App /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/Who is it for/).length).toBeGreaterThan(0),
      { timeout: 8000 });

    window.location.hash = '#/quotes';
    await settle();

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(window.location.hash).toBe('#/quotes');
  });
});
