import { useEffect, useRef, type RefObject } from 'react';

/**
 * What every modal in this tool has to do, in one place.
 *
 * The send dialog did all of this and the other two did none of it. That is the shape
 * of accessibility drift: the surface somebody worried about is correct, and the ones
 * added later quietly are not — so a keyboard user meets a different standard
 * depending on which dialog opened, which is worse than one consistent standard.
 *
 * Five things, and each of them is a real failure without it:
 *
 *   ESCAPE          a dialog you cannot leave without finding its Close button.
 *   FOCUS IN        opening a dialog and leaving focus on the page behind it means a
 *                   screen reader is still reading the page, not the dialog.
 *   FOCUS TRAPPED   the shell has over a hundred tabbable elements. Without a trap,
 *                   Tab walks straight out of the dialog and into them.
 *   SHELL HIDDEN    aria-hidden on the shell, so assistive tech is told the rest of
 *                   the page is not currently part of the document.
 *   FOCUS BACK      closing without restoring focus leaves it on <body>, and the next
 *                   Tab starts from the top of the page.
 *
 * The unsaved-changes prompt is the one that matters most: it is an alertdialog asking
 * a question that must be answered, and it was the one where Tab walked out.
 */
export function useModal({ panel, onClose, focusFirst }: {
  panel: RefObject<HTMLElement | null>;
  onClose: () => void;
  /**
   * A selector for what should hold focus on open. Falls back to the first focusable
   * thing, which is the right default for a dialog whose first control is its answer.
   */
  focusFirst?: string;
}) {
  /* The callback is held in a ref, and this is the whole point of the change.
     The effect below sets focus, and it used to list onClose in its dependencies.
     Every caller writes that inline — onCancel={() => setAsking(null)} — so it is a
     new function on every render, so any state change inside the dialog tore the
     effect down and rebuilt it, which moved focus back to the default control.

     On a dialog with a text box that is fatal: REPORTED as "after every character
     that is typed in the dialogue auto selects the cancel button so it's impossible
     to type anything there". One keystroke, one re-render, focus gone.

     A modal's setup belongs to its lifetime, not to its render. It runs once on open
     and once on close, and reads the current callback through the ref when a key is
     actually pressed. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const shell = document.getElementById('app-shell');
    const bodyOverflow = document.body.style.overflow;
    shell?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';

    const focusableIn = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),'
      + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];

    const box = panel.current;
    const wanted = focusFirst ? box?.querySelector<HTMLElement>(focusFirst) : null;
    (wanted ?? (box ? focusableIn(box)[0] : null))?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const focusable = focusableIn(panel.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const on = document.activeElement;
      if (e.shiftKey && (on === first || !panel.current.contains(on))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && on === last) {
        e.preventDefault(); first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      shell?.removeAttribute('aria-hidden');
      document.body.style.overflow = bodyOverflow;
      returnTo?.focus?.();
    };
    // Deliberately once: see closeRef above. `panel` is a ref and `focusFirst` is a
    // constant string at every call site, so neither would change anyway — listing
    // them only invited the next person to add a changing value to the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
