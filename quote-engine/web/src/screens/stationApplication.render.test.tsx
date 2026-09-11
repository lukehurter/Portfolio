// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppProvider } from '../state/app';
import { QuoteBuilder } from './QuoteBuilder';

/**
 * A second application is the SAME application, not a cut-down one.
 *
 * The second solution used to get a reduced panel: the twenty-eight questions in the
 * customer questionnaire's own grouping, with no paste box, no parser, no file import
 * and no questionnaire to send. Everything a rep does at the start of a quote — paste
 * the enquiry, press Read it, import the answers the customer emailed back — existed
 * for the first station and nowhere else, so building the second was a different job
 * done by hand.
 *
 * REPORTED: "for additional applications, I want the same parser and import function,
 * the full same layout as the first application you do."
 *
 * These assert the controls a rep actually reaches for, in the station's own panel,
 * rather than the markup around them. A snapshot would have passed the whole time the
 * panel was wrong.
 */

beforeAll(() => {
  // The builder measures the chrome to publish --chrome-h, and jsdom has no layout.
  globalThis.ResizeObserver ??= class {
    observe() {} unobserve() {} disconnect() {}
  } as never;
  globalThis.scrollTo ??= (() => {}) as never;
});
afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) => render(<AppProvider>{ui}</AppProvider>);

const settled = async (re: RegExp) => {
  await waitFor(() => expect(screen.getAllByText(re).length).toBeGreaterThan(0),
    { timeout: 8000 });
};

/** The station's own application panel, found by its legend. */
const stationPanel = () => {
  const legend = screen.getAllByText(/The application at this station/)[0];
  return legend.closest('.band') as HTMLElement;
};

/** Open the builder on a saved quote and add a second station to it. */
async function twoStations() {
  const user = userEvent.setup({ delay: null });
  wrap(<QuoteBuilder quoteNo="Q-2026-0731" />);
  await settled(/Who is it for/);

  /* Waits for the CONTROL, not for the page. The quote loads asynchronously and the
     builder paints its empty state first, so waiting on a heading that is there from
     the first frame gets you the screen before the quote reaches it. */
  const add = await screen.findByRole('button', { name: /Add another solution/ },
    { timeout: 8000 });
  await user.click(add);
  /* CIJ deliberately — the same book the first station uses. A solution used to BE a
     price book, so this was the combination that could not be expressed at all. */
  await waitFor(() => expect(
    screen.getAllByRole('button', { name: /^CIJ/ }).length).toBeGreaterThan(0));
  await user.click(screen.getAllByRole('button', { name: /^CIJ/ })[0]);
  await settled(/The application at this station/);
  return user;
}

describe('the application at a second station', () => {
  it('offers the parser, the import and the questionnaire, exactly as the first does', async () => {
    const user = await twoStations();
    const panel = within(stationPanel());

    expect(panel.getByText(/Paste the customer's email, or describe the line/),
      'no paste box at the station').toBeTruthy();
    expect(panel.getByRole('button', { name: /Read it/ }),
      'no parser at the station').toBeTruthy();
    expect(panel.getByText(/Import a file/),
      'no file import at the station').toBeTruthy();
    expect(panel.getByRole('button', { name: /Make a questionnaire to send/ }),
      'no questionnaire at the station').toBeTruthy();

    /* And it is the station's OWN, not the quote's reached through a loose query.
       The quote's step is collapsed at this point, so exactly one paste box is on the
       page and the assertions above have been reading the station's. Opening the
       quote's application gives two — one per application, which is the whole claim. */
    expect(screen.getAllByPlaceholderText(/We need to code date and lot/).length,
      'the station has no paste box of its own').toBe(1);

    await user.click(screen.getAllByRole('button', { name: /The application/ })[0]);
    await waitFor(() => expect(
      screen.getAllByPlaceholderText(/We need to code date and lot/).length,
      'the quote and the station are sharing one application').toBe(2));
  });

  it('lays the fields out the way the first application does', async () => {
    /* The same fields in the same order, including the "any / does not matter"
       answers — which the reduced panel had no way to express at all, so a station
       could not say the customer had no constraint on something. */
    await twoStations();
    const panel = within(stationPanel());

    for (const label of [/Substrate/, /Surface/, /Line speed/, /Throw distance/,
      /Character height/, /What has to be printed/, /Environment/]) {
      expect(panel.getAllByText(label).length, `${label} missing at the station`)
        .toBeGreaterThan(0);
    }
    expect(panel.getAllByText(/Any \/ does not matter/).length,
      'the station cannot say a field is unconstrained').toBeGreaterThan(0);
  });

  it('reads an enquiry into the station without touching the quote', async () => {
    /* The point of the parser being here. What it reads belongs to THIS station: a
       coder on the bottle and an applicator on the case are marking different things,
       and the whole reason a station has its own application is that one answer cannot
       serve both. */
    const user = await twoStations();
    const panel = within(stationPanel());

    const box = panel.getByPlaceholderText(/We need to code date and lot/);
    await user.type(box, 'Marking white film at 120 feet per minute.');
    await user.click(panel.getByRole('button', { name: /Read it/ }));

    await waitFor(() => {
      const speeds = screen.getAllByDisplayValue('120');
      expect(speeds.length, 'the station did not take the speed').toBeGreaterThan(0);
    }, { timeout: 4000 });

    /* And the quote still says what it always said. The seeded quote runs at 620 fpm;
       reading an enquiry at one station must not rewrite the line everything else on
       the quote is graded against.

       Its section has to be opened to be asserted on — a collapsed step renders no
       inputs, so querying for the value without this passes or fails on whether the
       step happens to be open rather than on what the quote holds. */
    /* A Step's accessible name carries its summary as well as its title, so this is
       matched loosely and by DOM order — the station's own panel is a legend and a
       Hide button, not a step, so there is nothing else for it to catch. */
    await user.click(screen.getAllByRole('button', { name: /The application/ })[0]);
    await waitFor(() => {
      expect(screen.getAllByDisplayValue('620').length,
        'reading at the station overwrote the quote').toBeGreaterThan(0);
    }, { timeout: 4000 });
    expect(screen.getAllByDisplayValue('120').length,
      'the station lost its own answer').toBeGreaterThan(0);
  });
});
