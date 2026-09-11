import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * Where a modal belongs in the document: beside the shell, not inside it.
 *
 * Every modal here is rendered by a screen, and every screen is inside `#app-shell`.
 * So when a modal set `aria-hidden` on the shell — which is the correct thing to do,
 * to tell assistive tech the page behind is not currently part of the document — it
 * was hiding itself along with everything else. A screen reader was told there was
 * nothing on the page at all.
 *
 * It went unnoticed because it is invisible: the dialog looks right, works with a
 * mouse, and reads as nothing. It surfaced when the unsaved-changes prompt was given
 * the same treatment as the send dialog and a test that looks the page up the way a
 * screen reader does could no longer find it.
 *
 * A portal puts the modal at the end of <body>, so hiding the shell hides the page and
 * leaves the dialog. It also means the modal is not inside any transformed or
 * overflow-hidden ancestor, which is the other thing that quietly breaks fixed
 * positioning.
 */
export function ModalLayer({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
