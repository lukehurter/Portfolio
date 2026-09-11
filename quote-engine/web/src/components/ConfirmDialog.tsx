import { useRef } from 'react';
import { ModalLayer } from './ModalLayer';
import { useModal } from './useModal';

/**
 * "Are you sure?", asked by the app rather than by the browser.
 *
 * The unsaved-changes prompt has been the app's own dialog for a while, for reasons
 * set out in useUnsavedGuard: a native `window.confirm` can be switched off per site,
 * suppressed by the frame, or auto-dismissed, and the calling page cannot tell — so
 * the guard reads as correct and the work still goes.
 *
 * Deleting a quote was still on `window.confirm`, which is the one place in the app
 * where that failure mode destroys something. Reported: "you made a custom 'the quote
 * has not been saved' dialogue, can you make one for the deletion dialogue?" — and
 * the same argument applies to anything else that throws work away, so this is
 * general rather than a second copy of the first one.
 *
 * The shape follows the unsaved prompt deliberately. Two dialogs that ask the same
 * kind of question should look like the same question: navy fascia, the danger on
 * the right, and the safe answer holding focus.
 */
export function ConfirmDialog({
  title, body, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, busy,
}: {
  title: string;
  /** What will actually happen. One sentence, in the rep's terms. */
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** True while the action is in flight, so it cannot be fired twice. */
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  /* Escape cancels, and focus lands on cancel. The safe answer is the default: this
     appears because somebody pressed something they may not have meant to, and the
     second reflex should not destroy anything either. */
  useModal({ panel, onClose: onCancel, focusFirst: '[data-cancel]' });

  return (
    <ModalLayer>
      <div className="fixed inset-0 z-modal flex items-center justify-center bg-navy-950/50 p-4">
        <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
             className="w-full max-w-md rounded-md border border-edge bg-surface shadow-lift">
          <header className="fascia border-b-2 border-instr-400 bg-navy-900 px-4 py-2.5 text-white">
            <h2 id="confirm-title" className="h-display text-base text-white">{title}</h2>
          </header>
          <div className="space-y-3 p-4">
            <div className="text-sm text-steel-800">{body}</div>
            <div className="flex flex-wrap justify-end gap-2">
              <button data-cancel type="button" className="btn-primary text-sm"
                      onClick={onCancel} disabled={busy}>
                {cancelLabel}
              </button>
              <button type="button" className="btn-danger text-sm"
                      onClick={onConfirm} disabled={busy}>
                {busy ? 'Working…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}
