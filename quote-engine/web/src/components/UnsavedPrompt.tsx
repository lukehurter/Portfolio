import { useRef } from 'react';
import { ModalLayer } from './ModalLayer';
import { useModal } from './useModal';
import type { UnsavedPrompt as Prompt } from './useUnsavedGuard';

/**
 * "You have not saved this. Leave anyway?" — asked by the app, not by the browser.
 *
 * See useUnsavedGuard for why this is not `window.confirm`. The short of it: a native
 * confirm can be switched off per site, suppressed by the frame, or auto-dismissed,
 * and the page cannot tell — so the guard looked correct and the work still went.
 *
 * Drop it into any screen that holds unsaved state:
 *
 *     const guard = useUnsavedGuard(dirty);
 *     <UnsavedPromptView prompt={guard} what="quote" />
 */
export function UnsavedPromptView({ prompt, what }: {
  prompt: Prompt;
  /** What is at stake, in the rep's words: "quote", "customer copy". */
  what: string;
}) {
  const { pending, leave, stay } = prompt;

  if (pending === null) return null;
  return <Asked leave={leave} stay={stay} what={what} />;
}

/* Split so the modal hook runs only while the dialog exists — a hook cannot be
   called conditionally, and a trap that installs itself when nothing is open would
   hold focus on a page with no dialog on it. */
function Asked({ leave, stay, what }: {
  leave: () => void; stay: () => void; what: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  /* Escape means stay, and focus lands on Stay. The safe answer is the default: this
     appears because somebody pressed something they may not have meant to, and the
     second reflex should not throw the work away either. */
  useModal({ panel, onClose: stay, focusFirst: '[data-stay]' });

  return (
    <ModalLayer>
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-navy-950/50 p-4">
      <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title"
           className="w-full max-w-md rounded-md border border-edge bg-surface shadow-lift">
        <header className="fascia border-b-2 border-instr-400 bg-navy-900 px-4 py-2.5 text-white">
          <h2 id="unsaved-title" className="h-display text-base text-white">
            This {what} has not been saved
          </h2>
        </header>
        <div className="space-y-3 p-4">
          <p className="text-sm text-steel-800">
            Everything since the last save will be lost.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button data-stay type="button" className="btn-primary text-sm" onClick={stay}>
              Stay on this page
            </button>
            <button type="button" className="btn-danger text-sm" onClick={leave}>
              Leave and lose it
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalLayer>
  );
}
