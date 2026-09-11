// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../state/app';
import { QuoteBuilder } from './QuoteBuilder';
import { QuoteDetail } from './QuoteDetail';

/**
 * The claims that keep breaking, held by a test that actually renders.
 *
 * Everything in this repository was tested at the engine and API level, 135 tests of
 * it, and three faults still shipped green in one week: the review dialog was never
 * rendered, the fit panel was absent from the saved quote, and seeded profiles
 * declared below their use crashed the app on load. Each was invisible to a suite
 * that never mounts a component.
 *
 * These are deliberately about behaviour a rep would notice, not about markup. No
 * snapshots — a snapshot would have passed through all three faults too.
 */

beforeAll(() => {
  // The builder measures the chrome to publish --chrome-h, and jsdom has no layout.
  globalThis.ResizeObserver ??= class {
    observe() {} unobserve() {} disconnect() {}
  } as never;
  globalThis.scrollTo ??= (() => {}) as never;
});

// Testing Library only auto-cleans when vitest globals are on, and they are off here.
// Without this, the second test in the file queries the first test's DOM — which is how
// a QuoteDetail test came back showing the builder's sections.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const wrap = (ui: React.ReactNode) => render(<AppProvider>{ui}</AppProvider>);

/**
 * The preview API waits ~300ms per call, so the first paint is a skeleton.
 *
 * getAllByText, because a section's name is on both its heading and its disclosure
 * button — waiting for a unique match waits forever.
 */
/**
 * A section's disclosure button.
 *
 * Its name also appears on the rail once the quote has content, so the query has to
 * take the first in DOM order rather than insist on a unique match.
 */
const section = (name: RegExp) => screen.getAllByRole('button', { name })[0];

const settled = async (re: RegExp) => {
  await waitFor(() => expect(screen.getAllByText(re).length).toBeGreaterThan(0), { timeout: 8000 });
};

describe('the quote builder', () => {
  it('opens on who it is for, and on that alone', async () => {
    wrap(<QuoteBuilder />);
    await settled(/Who is it for/);

    // Three steps. What is on the quote and the discount live in the rail now, beside
    // the total they move, rather than as sections you scroll past the work to reach.
    const sections = ['Who is it for', 'The application', 'The solution'];
    const open = sections.filter((name) =>
      section(new RegExp(name)).getAttribute('aria-expanded') === 'true');
    expect(open).toEqual(['Who is it for']);
  });

  it('reveals the application once a customer is chosen, and does not close it again', async () => {
    const user = userEvent.setup({ delay: null });
    wrap(<QuoteBuilder />);
    await settled(/Who is it for/);

    await user.type(screen.getAllByLabelText('Customer')[0], 'Midwest');
    const hit = await waitFor(() => screen.getByRole('button', { name: /Midwest Foods/ }), { timeout: 8000 });
    await user.click(hit);
    // The section is not complete until the quote has a name to recognise it by, so
    // the reveal waits for this too — picking a customer alone does not advance.
    await user.type(screen.getByLabelText(/line or application name/i), 'Bagger 4');

    await waitFor(() => {
      expect(section(/The application/)
        .getAttribute('aria-expanded')).toBe('true');
    }, { timeout: 5000 });
    // Revealing the next section must not close the one behind it — typing in a
    // section that closes under you was reported from the screen.
    expect(section(/Who is it for/)
      .getAttribute('aria-expanded')).toBe('true');
  });

  it('grades a machine against the application, with the rule code', async () => {
    const user = userEvent.setup({ delay: null });
    wrap(<QuoteBuilder />);
    await settled(/Who is it for/);

    await user.click(section(/The application/));
    const box = await waitFor(() => screen.getByRole('textbox', { name: /paste|describe/i }), { timeout: 5000 });
    await user.type(box, 'Corrugated cases at 190 feet per minute, 8mm date code.');
    await user.click(screen.getAllByRole('button', { name: /^Read it$/ })[0]);

    await user.click(section(/The solution/));
    await user.click(await waitFor(() => screen.getAllByRole('button', { name: /^CIJ/ })[0], { timeout: 5000 }));

    // A case coder is exactly what A-TECH-CIJ-SECONDARY has an opinion about, and
    // that opinion has to reach the card rather than staying in the engine.
    const card = await waitFor(() => screen.getAllByText(/A-TECH-CIJ-SECONDARY/)[0], { timeout: 8000 });
    expect(card).toBeTruthy();
    expect(screen.getAllByText(/with a caveat/i).length).toBeGreaterThan(0);
  });
});

describe('a saved quote', () => {
  it('shows the application it was priced against', async () => {
    wrap(<QuoteDetail quoteNo="Q-2026-0731" />);
    await settled(/The application it was priced against/);
    const panel = screen.getByText(/The application it was priced against/).closest('section')!;
    expect(within(panel).getByText(/Dark corrugated/)).toBeTruthy();
  });

  it('shows what the datasheets say about what is on it', async () => {
    // saveQuote has always stored ev.fit; this screen never rendered it, so the
    // grading vanished at the moment it became the record.
    wrap(<QuoteDetail quoteNo="Q-2026-0731" />);
    await settled(/Against the application/);
    const panel = screen.getByText(/Against the application/).closest('section')!;
    expect(within(panel).getAllByText(/^A-/).length).toBeGreaterThan(0);
  });

  it('opens the review dialog, and gates the send on the approval', async () => {
    const user = userEvent.setup({ delay: null });
    wrap(<QuoteDetail quoteNo="Q-2026-0731" />);
    /* The button itself says what pressing it does. It said "Review and send" on a
       quote that needs approving, so a rep learned the difference only after they
       had typed a customer's address into the dialog behind it. */
    await settled(/Send for approval/);

    await user.click(screen.getAllByRole('button', { name: /Send for approval/ })[0]);
    // The dialog is aria-modal rather than role=dialog, which is how it is queried
    // here so the test breaks if that changes rather than silently passing.
    const dialog = await waitFor(() => {
      const el = document.querySelector('[aria-modal="true"]');
      if (!el) throw new Error('no modal');
      return el as HTMLElement;
    }, { timeout: 8000 });
    /* Q-2026-0731 needs an approval, so this is not a send and must not look like
       one. It used to: the dialog said "Review before sending", asked for the
       customer's email, and the only sign that a manager was being asked instead of
       a customer being written to was one word on the button. */
    // The heading and the button agree, which is the whole point of the change.
    expect(within(dialog).getAllByText(/Send for approval/).length).toBeGreaterThan(1);
    expect(within(dialog).queryByText(/Review before sending/)).toBeNull();

    // No address field, because nothing is going to the customer yet.
    expect(within(dialog).queryByLabelText(/Send to/i),
      'an address field here is what made the two acts look alike').toBeNull();

    // It names who it goes to. That there is no address field says the rest —
    // stating it as well was the same fact five times in one dialog.
    expect(within(dialog).getAllByText(/Goes to /).length).toBeGreaterThan(0);

    // And it can be sent for approval without an address.
    expect((within(dialog).getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement)
      .disabled).toBe(false);
  });

  it('asks for the address only when the customer is the one receiving it', async () => {
    const user = userEvent.setup({ delay: null });
    // Q-2026-0722 carries no outstanding approval, so this really is a send.
    wrap(<QuoteDetail quoteNo="Q-2026-0722" />);
    await settled(/Review and send|Send again/);

    await user.click(screen.getAllByRole('button', { name: /Review and send|Send again/ })[0]);
    const dialog = await waitFor(() => {
      const el = document.querySelector('[aria-modal="true"]');
      if (!el) throw new Error('no modal');
      return el as HTMLElement;
    }, { timeout: 8000 });

    expect(within(dialog).getByText(/Review before sending/)).toBeTruthy();
    expect(within(dialog).getByLabelText(/Send to/i)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Send it to the customer/ })).toBeTruthy();
  });
});
