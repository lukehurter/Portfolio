import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/app';

/**
 * Stop a half-built quote leaving by accident.
 *
 * ── What happens without it ─────────────────────────────────────────────────
 *
 * The builder holds the whole draft in memory until somebody presses Save. A quote
 * is twenty minutes of work — the customer, twenty-eight application answers, a
 * machine and everything it needs — and the side button on a mouse is one click from
 * the browser's Back. There was nothing between those two facts.
 *
 * ── The two ways out ────────────────────────────────────────────────────────
 *
 * Leaving the app entirely — closing the tab, reloading, typing a new address — is
 * `beforeunload`. The browser shows its own wording there and the page gets no say.
 *
 * Moving inside the app is a hash change, which is what the Back button produces here
 * and what every link in the tool produces too. That one is ours to ask about, and it
 * fires AFTER the address has already changed, so declining means putting the old
 * address back — which fires a second hash change that has to be ignored, or the
 * question would be asked again about the answer to itself.
 *
 * ── Why the question is asked in the app and not by window.confirm ──────────
 *
 * It used to call `window.confirm`. That was reported three times as "it does not
 * warn", and never reproduced here — which is the problem with `confirm`: it is
 * suppressed on cross-origin and sandboxed frames, it can be switched off per-site in
 * Chrome and Firefox with a checkbox the user may not remember ticking, some
 * environments auto-dismiss it, and nothing on the page can tell that any of that
 * happened. A dialog that silently does not appear is worse than none, because the
 * code looks correct and the work is still gone.
 *
 * So the prompt is rendered by the app. It cannot be suppressed, it looks like the
 * rest of the tool, and it can be seen in a test. `beforeunload` stays native because
 * there is no alternative for it — but that path only loses a tab, and this one is
 * the one a mouse button reaches.
 */
export interface UnsavedPrompt {
  /** The address the rep was heading for, or null when nothing is pending. */
  pending: string | null;
  /** Let it go: restore the destination and stop guarding it. */
  leave: () => void;
  /** Stay where they are. */
  stay: () => void;
  /**
   * Let the next navigation through without asking.
   *
   * For the screen's own Save-then-go: saving makes the draft clean, but the flag
   * this guard reads is set during render and `go` is called before that render
   * happens — so the guard would stop the app leaving a quote it had just written.
   * Called deliberately, immediately before navigating.
   */
  allowNext: () => void;
}

export function useUnsavedGuard(dirty: boolean): UnsavedPrompt {
  /* Read through refs so the listeners register once and still see the current
     answer. Re-registering on every keystroke of a draft would be listener churn on
     the busiest screen in the tool. */
  const isDirty = useRef(dirty);
  isDirty.current = dirty;

  const [pending, setPending] = useState<string | null>(null);
  const { blockNavigation } = useApp();
  /** Set while letting an answered navigation through, so it is not re-asked. */
  const allowing = useRef(false);

  /* Registered with the router rather than listening for the change.
     Listening lost the race: the provider's own hashchange handler runs first, sets
     the route, and unmounts the screen this is guarding — which takes the draft and
     this prompt with it. Asked first, nothing unmounts and there is still something
     to save. */
  useEffect(() => blockNavigation((wanted) => {
    if (allowing.current) { allowing.current = false; return false; }
    if (!isDirty.current) return false;
    setPending(wanted);
    return true;
  }), [blockNavigation]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty.current) return;
      // Both, deliberately: browsers disagree about which one arms the dialog, and
      // none of them lets the page choose the wording. This is the only path where
      // the browser's own dialog is the only option — closing a tab.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const leave = useCallback(() => {
    const wanted = pending;
    setPending(null);
    if (wanted === null) return;
    /* The router put the address back when it refused, so assigning the wanted one
       really does change it and really does fire the event the router listens for.
       The flag lets that one through without asking again. */
    allowing.current = true;
    window.location.hash = wanted;
  }, [pending]);

  const stay = useCallback(() => setPending(null), []);

  const allowNext = useCallback(() => { allowing.current = true; }, []);

  return { pending, leave, stay, allowNext };
}
