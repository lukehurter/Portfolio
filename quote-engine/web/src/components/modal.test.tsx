// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRef, useState } from 'react';
import { ModalLayer } from './ModalLayer';
import { useModal } from './useModal';

/**
 * The contract every modal in this tool keeps.
 *
 * It was kept by one of them. The send dialog trapped focus, hid the shell from
 * assistive tech and restored focus on close; the unsaved prompt and the quick find
 * did none of it — so a keyboard user met a different standard depending on which
 * dialog opened.
 *
 * And the one that did it had a bug the others' absence was hiding: every modal is
 * rendered by a screen, every screen is inside #app-shell, so setting aria-hidden on
 * the shell hid the dialog too. A screen reader was told the page was empty. These
 * assert the fix in the way that catches it — by looking the dialog up through the
 * accessibility tree, which is what ignores aria-hidden.
 */

function Dialog({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useModal({ panel, onClose, focusFirst: '[data-first]' });
  return (
    <ModalLayer>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Test dialog">
        <button data-first type="button">First</button>
        <button type="button">Second</button>
      </div>
    </ModalLayer>
  );
}

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <div id="app-shell">
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <a href="#somewhere">A link behind the dialog</a>
      {open && <Dialog onClose={() => setOpen(false)} />}
    </div>
  );
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(cleanup);

describe('a modal', () => {
  it('is reachable through the accessibility tree while the shell is hidden', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    /* getByRole walks the accessibility tree and skips aria-hidden subtrees, which is
       exactly what a screen reader does. Rendered inside the shell, this found
       nothing. */
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(document.getElementById('app-shell')?.getAttribute('aria-hidden')).toBe('true');
    // And the page behind is genuinely hidden, not merely covered.
    expect(screen.queryByRole('link', { name: /behind the dialog/ })).toBeNull();
  });

  it('takes focus, and gives it back on close', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' })));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement, 'focus goes back where it came from').toBe(opener);
  });

  it('keeps Tab inside itself', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    await user.tab();
    expect(document.activeElement).toBe(second);
    // Past the last one, back to the first rather than out into the page.
    await user.tab();
    expect(document.activeElement, 'Tab must not escape the dialog').toBe(first);
  });

  it('restores the page scroll lock when it closes', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
    expect(document.getElementById('app-shell')?.hasAttribute('aria-hidden')).toBe(false);
  });
});
