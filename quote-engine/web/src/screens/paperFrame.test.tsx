// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PaperFrame } from './QuoteDocumentScreen';

/**
 * The customer copy is taller than a page, and you have to be able to see all of it.
 *
 * REPORTED: "on the customer copy editor, if you check every checkbox, the copy
 * overflows and you can't see it all." The sheet is drawn at 1:1 and scaled to fit,
 * and because a transform does not affect layout the wrapper around it has to reserve
 * the scaled height itself. It reserved exactly one page, and the frame hides vertical
 * overflow on purpose — setting one axis to auto makes the other compute to auto and
 * steals 15px — so everything past page one was cut off with nothing to scroll to.
 *
 * This is asserted here rather than in a browser because the reserved height is only
 * correct once a ResizeObserver has delivered, and observers and requestAnimationFrame
 * are both throttled in a tab that is not painting. Measuring it in a hidden preview
 * showed a stale reservation and a correct one is indistinguishable from a broken one
 * — so the delivery is driven directly instead.
 */

const observers: (() => void)[] = [];

beforeAll(() => {
  globalThis.ResizeObserver = class {
    constructor(private cb: () => void) { observers.push(() => this.cb()); }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  // jsdom lays nothing out, so offsetHeight is 0 everywhere. The sheet's height is
  // the input under test, so it is the one thing stubbed.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('paper-sheet') ? Number(this.dataset.testH ?? 0) : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true, get: () => 1200,      // wide enough that scale is 1
  });
});

/* Explicitly, because this project runs vitest without globals, so Testing
   Library's own auto-cleanup afterEach never registers. Without it every render
   stays in document.body and `document.querySelector('.paper-sheet')` below finds
   the FIRST test's detached sheet — which is its own small lesson, since that is
   exactly how the first version of this test passed while measuring nothing. */
afterEach(() => { cleanup(); observers.length = 0; });

function reservedHeight(): number {
  const fit = document.querySelector('.paper-fit') as HTMLElement;
  return Number.parseFloat(fit.style.height);
}

/** Grow the sheet and let the observer deliver, the way a real layout would. */
function growSheetTo(px: number) {
  const sheet = document.querySelector('.paper-sheet') as HTMLElement;
  sheet.dataset.testH = String(px);
  act(() => {
    observers.forEach((fire) => fire());
    vi.advanceTimersByTime(250);     // the timer that races the frame
  });
}

describe('the customer copy preview', () => {
  it('reserves a whole page for a document that does not fill one', () => {
    vi.useFakeTimers();
    render(<PaperFrame><div /></PaperFrame>);
    growSheetTo(700);
    // Short is still a sheet of paper: 1056 plus the 1px border either side.
    expect(reservedHeight()).toBe(1058);
    expect(document.querySelectorAll('.paper-guide')).toHaveLength(0);
    vi.useRealTimers();
  });

  it('reserves the whole document when it runs past one page', () => {
    vi.useFakeTimers();
    render(<PaperFrame><div /></PaperFrame>);
    growSheetTo(2400);
    /* The number that was wrong. Reserving 1058 here hid 1342px of quote — the totals,
       the terms and the signature block — behind an overflow nobody could scroll. */
    expect(reservedHeight()).toBe(2402);
    vi.useRealTimers();
  });

  it('says how many pages it prints to, and marks where they break', () => {
    vi.useFakeTimers();
    render(<PaperFrame><div /></PaperFrame>);
    growSheetTo(2400);                        // 1056 * 2 = 2112, so this is three
    expect(screen.getByText(/3 pages when it prints/)).toBeTruthy();
    expect(document.querySelectorAll('.paper-guide')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('does not claim a second page for a few pixels of rounding', () => {
    vi.useFakeTimers();
    render(<PaperFrame><div /></PaperFrame>);
    growSheetTo(1058);      // the real measurement of a one-page quote, borders in
    expect(screen.queryByText(/pages when it prints/)).toBeNull();
    expect(document.querySelectorAll('.paper-guide')).toHaveLength(0);
    vi.useRealTimers();
  });
});
