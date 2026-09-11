// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../state/app';
import { UnsavedPromptView } from './UnsavedPrompt';
import { useUnsavedGuard } from './useUnsavedGuard';

/**
 * The guard between twenty minutes of work and the side button on a mouse.
 *
 * It used to call `window.confirm`, and was reported three times as "it does not
 * warn" while every test of it passed — which is the problem with `confirm`: it can
 * be switched off per site, suppressed by the frame or auto-dismissed, and the page
 * cannot tell. These assert the thing a rep can actually see on screen.
 */

/* Inside a provider, because the guard registers with the router rather than
   listening for the change — see useUnsavedGuard for why that had to move. */
function Screen({ dirty }: { dirty: boolean }) {
  const guard = useUnsavedGuard(dirty);
  return (
    <>
      <div>builder</div>
      <UnsavedPromptView prompt={guard} what="quote" />
    </>
  );
}

function Guarded({ dirty }: { dirty: boolean }) {
  return <AppProvider><Screen dirty={dirty} /></AppProvider>;
}

beforeEach(() => { window.location.hash = '#/quotes/new'; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
});

const settle = () => new Promise((r) => setTimeout(r, 0));
const asked = () => screen.queryByRole('alertdialog');

describe('leaving a quote with unsaved changes', () => {
  it('shows the question, and stays put until it is answered', async () => {
    render(<Guarded dirty />);
    window.location.hash = '#/quotes';
    await settle();

    await waitFor(() => expect(asked()).toBeTruthy());
    expect(asked()!.textContent).toMatch(/has not been saved/i);
    expect(window.location.hash, 'the address is put back before asking').toBe('#/quotes/new');
  });

  it('stays when told to stay, and the prompt goes away', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Guarded dirty />);
    window.location.hash = '#/quotes';
    await settle();
    await waitFor(() => expect(asked()).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /stay on this page/i }));
    expect(asked()).toBeNull();
    expect(window.location.hash).toBe('#/quotes/new');
  });

  it('lets go when told to, and does not ask again on the way out', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Guarded dirty />);
    window.location.hash = '#/quotes';
    await settle();
    await waitFor(() => expect(asked()).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /leave and lose it/i }));
    await settle();
    expect(window.location.hash).toBe('#/quotes');
    expect(asked(), 'letting go must not re-ask about its own navigation').toBeNull();
  });

  it('says nothing when there is nothing to lose', async () => {
    render(<Guarded dirty={false} />);
    window.location.hash = '#/quotes';
    await settle();
    expect(asked()).toBeNull();
    expect(window.location.hash).toBe('#/quotes');
  });

  it('asks on the Back button, which is the one that catches people out', async () => {
    render(<Guarded dirty />);
    window.location.hash = '#/quotes/new/customer';
    await settle();

    window.history.back();
    await new Promise((r) => setTimeout(r, 60));

    await waitFor(() => expect(asked()).toBeTruthy());
  });

  it('arms the browser dialog for a reload or a closed tab', () => {
    render(<Guarded dirty />);
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented, 'beforeunload must be cancelled to arm it').toBe(true);
  });

  it('leaves the browser dialog alone when there is nothing to lose', () => {
    render(<Guarded dirty={false} />);
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
