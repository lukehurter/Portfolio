// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useState } from 'react';

afterEach(cleanup);

/**
 * A dialog you can type in.
 *
 * REPORTED: "when marking something as lost, after every character that is typed in
 * the dialogue auto selects the cancel button so it's impossible to type anything
 * there."
 *
 * useModal listed onClose in its effect dependencies. Every caller writes that inline
 * — onCancel={() => setAsking(null)} — so it was a new function on every render, so
 * any state change inside the dialog tore the effect down and rebuilt it, and
 * rebuilding it set focus back to the default control. One keystroke, one re-render,
 * focus gone.
 *
 * This is the test that would have caught it, and it is written the way the bug was
 * met: type more than one character.
 */
function TypingDialog({ onConfirm }: { onConfirm: (v: string) => void }) {
  const [text, setText] = useState('');
  return (
    <ConfirmDialog
      title="Mark as lost?"
      body={(
        <label>
          Why
          <textarea aria-label="Why" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
      confirmLabel="Mark it lost"
      // Inline on purpose: this is exactly how every caller writes it, and a stable
      // callback here would test a shape the app does not use.
      onCancel={() => {}}
      onConfirm={() => onConfirm(text)}
    />
  );
}

describe('typing in a confirm dialog', () => {
  it('keeps focus in the box for the whole sentence', async () => {
    const user = userEvent.setup();
    render(<TypingDialog onConfirm={() => {}} />);
    const box = screen.getByLabelText('Why') as HTMLTextAreaElement;
    box.focus();
    await user.type(box, 'Went with the incumbent on price');
    expect(box.value).toBe('Went with the incumbent on price');
    expect(document.activeElement).toBe(box);
  });

  it('hands the whole reason to the caller', async () => {
    // The other half of the same report: what is typed has to reach the API, not
    // just the textarea.
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<TypingDialog onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText('Why'), 'No budget');
    await user.click(screen.getByRole('button', { name: /Mark it lost/ }));
    expect(onConfirm).toHaveBeenCalledWith('No budget');
  });

  it('still lands focus on the safe answer when it opens', async () => {
    // The behaviour the dependency list was there to produce, kept.
    render(<TypingDialog onConfirm={() => {}} />);
    expect((document.activeElement as HTMLElement)?.textContent).toMatch(/Cancel/);
  });

  it('still closes on Escape after the callback identity has changed', async () => {
    // The ref has to read the CURRENT callback, or holding it across renders would
    // trade one bug for a staler one.
    const user = userEvent.setup();
    let closed = 0;
    function Host() {
      const [n, setN] = useState(0);
      return (
        <ConfirmDialog
          title="t" body={<button onClick={() => setN(n + 1)}>bump {n}</button>}
          confirmLabel="go" onCancel={() => { closed += 1; }} onConfirm={() => {}} />
      );
    }
    render(<Host />);
    await user.click(screen.getByRole('button', { name: /bump/ }));
    await user.keyboard('{Escape}');
    expect(closed).toBe(1);
  });
});
