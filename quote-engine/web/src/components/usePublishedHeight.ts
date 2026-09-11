import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Call back whenever an element's laid-out height changes, and once immediately.
 *
 * The scheduling is the whole value of this function, and every line of it is a bug
 * that was hit: the write is kept out of the observer callback, the frame is raced
 * against a timer because requestAnimationFrame does not run in a tab that is not
 * painting, and the window's resize and the tab's visibilitychange are listened to
 * as well. Both hooks below need exactly that and differ only in where the number
 * goes, so it is written once — a second copy of this had already been written for
 * the customer copy's page height and had quietly dropped the timer, which meant it
 * worked on a visible tab and never updated on a hidden one.
 *
 * Returns its own teardown.
 */
function onHeightChange(el: HTMLElement, publish: (h: number) => void): () => void {
  let last = -1;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const read = () => {
    const h = el.offsetHeight;
    if (h === last) return;
    last = h;
    publish(h);
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = requestAnimationFrame(read);
    timer = setTimeout(read, 200);
  };

  read();
  const ro = new ResizeObserver(schedule);
  ro.observe(el);
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    ro.disconnect();
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', schedule);
  };
}

/**
 * An element's laid-out height, as a number that re-renders when it changes.
 *
 * `offsetHeight`, so a CSS transform on the element does not affect it — which is the
 * point at the one place this is used. The customer copy's sheet is drawn at 1:1 and
 * scaled to fit, and the wrapper around it has to reserve the SCALED height because a
 * transform does not affect layout. Reserving one page of it clipped every quote that
 * ran to two, with the overflow hidden and no way to scroll to it.
 */
export function useMeasuredHeight(
  ref: RefObject<HTMLElement | null>,
  fallback: number,
): number {
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return onHeightChange(el, (h) => setHeight(h || fallback));
  }, [ref, fallback]);
  return height;
}

/**
 * Publish an element's measured height as a CSS custom property on <html>.
 *
 * ── Why anything measures at all ────────────────────────────────────────────
 *
 * Two bars stick to the top of the quote builder: the app chrome, and the status band
 * under it. Anything that sticks below them has to know how tall they are, and both
 * were hard-coded — 3.25rem for the chrome, 5.5rem for the band. Neither is a
 * constant. The chrome grows when the preview notice wraps, shrinks when the notice is
 * absent in production, and changes again when the nav strip wraps on a phone. The
 * band grows with the number of findings on the quote.
 *
 * When the guess ran short, the sticky pane below sat too high and its first row went
 * under the bar above it. That is the "top of the right panes gets cut off" bug, and
 * no amount of tuning the constant fixes it, because the right number depends on the
 * viewport and the contents.
 *
 * ── Why it does not write from inside the observer ──────────────────────────
 *
 * Writing a custom property on <html> from inside a ResizeObserver callback invalidates
 * layout, which re-notifies the observer in the same delivery cycle. Chrome reports
 * that as "ResizeObserver loop completed with undelivered notifications". Harmless in
 * itself, but it was the only error in the console, and a console with one permanent
 * error in it is a console nobody reads.
 *
 * ── Why rAF alone is not enough ─────────────────────────────────────────────
 *
 * requestAnimationFrame does not run in a tab that is not painting — a background tab,
 * a throttled one, a headless render. In that state the observer's write never lands
 * and the property keeps whatever value it had when the tab was last visible, which is
 * the wrong number for the size the window is now. It is exactly the stale value that
 * a returning user sees for the first frames after switching back.
 *
 * So the frame is raced against a timer, which is not throttled the same way. Whichever
 * arrives first publishes; the other finds the height unchanged and does nothing. The
 * window's own resize event is listened to as well, because a viewport change is the
 * case where being stale is most visible and ResizeObserver delivery is least certain.
 */
export function usePublishedHeight(
  ref: RefObject<HTMLElement | null>,
  property: `--${string}`,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The property is deliberately not cleared on teardown: whatever is measured next
    // publishes over it, and removing it would collapse every offset that depends on
    // it to its fallback for a frame.
    return onHeightChange(el, (h) => {
      document.documentElement.style.setProperty(property, `${h}px`);
    });
  }, [ref, property]);
}
