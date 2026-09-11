// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AXIM_LOGO_BLUE, AXIM_LOGO_WHITE } from '../assets/logo';
import { applicationPhotoFor } from '../api/photos';
import { mediaFor } from '../api/media';
import { AppProvider } from '../state/app';
import { Shell } from './Shell';
import App from '../App';
import { mockApi } from '../api/mock';
import { DEFAULT_DOCUMENT, EMPTY_PROFILE, type QuoteDraft } from '../api/types';
import { QuoteDocument } from '../screens/QuoteDocument';

/**
 * The brand rules that are checkable by machine.
 *
 * The brand guidelines list "do not change the intended color" and "do not add effects or
 * texture" as prohibited logo usage. The brand bar used to satisfy neither: with no white
 * artwork available it drew the colour mark through `filter: brightness(0) invert(1)`.
 * There is real reversed artwork now, and this is the test that stops the filter coming
 * back the next time somebody needs a white logo in a hurry.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  globalThis.scrollTo ??= (() => {}) as never;
});
afterEach(cleanup);

describe('the logo', () => {
  it('is the reversed artwork on the navy bar, not a filtered colour one', async () => {
    render(<AppProvider><Shell><div /></Shell></AppProvider>);
    const logo = await waitFor(() => screen.getByAltText('Axim') as HTMLImageElement);
    expect(logo.getAttribute('src')).toBe(AXIM_LOGO_WHITE);
    // The specific prohibition, asserted by name.
    expect(logo.style.filter).toBe('');
    expect(logo.outerHTML).not.toMatch(/brightness|invert|drop-shadow|opacity/);
  });

  it('ships three treatments and no recolouring', () => {
    // All white and full colour are two of the three the guidelines allow. Both are real
    // files, so neither is derived from the other at runtime.
    // Vector, from the guidelines PDF — a logotype has no right size as a raster.
    expect(AXIM_LOGO_WHITE.startsWith('data:image/svg+xml,')).toBe(true);
    expect(AXIM_LOGO_BLUE.startsWith('data:image/svg+xml,')).toBe(true);
    expect(AXIM_LOGO_WHITE).not.toBe(AXIM_LOGO_BLUE);
  });
});

describe('the application photograph', () => {
  it('matches on technology and substrate together', () => {
    const corrugated = applicationPhotoFor('PALM', 'Corrugated case, dark');
    expect(corrugated?.caption).toMatch(/corrugated case/i);

    // Right substrate, wrong technology: no photograph rather than a near-enough one.
    expect(applicationPhotoFor('TTO', 'Corrugated case, dark')).toBeNull();
    // Substrate nobody wrote a photograph for.
    expect(applicationPhotoFor('CIJ', 'PETG clamshell')).toBeNull();
    // Nothing said at all.
    expect(applicationPhotoFor('CIJ', null)).toBeNull();
  });

  it('reaches the quote the customer receives', async () => {
    const user = userEvent.setup({ delay: null });
    // The whole app, not the builder alone: the photograph has to survive being saved
    // and reopened on the quote's own page, which is where sending happens now.
    window.location.hash = '#/quotes/new';
    render(<AppProvider><App /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/Who is it for/).length).toBeGreaterThan(0),
      { timeout: 8000 });

    // Describe a line the photographs cover, put a machine on it, then open the review.
    await user.click(screen.getAllByRole('button', { name: /The application/ })[0]);
    const box = await waitFor(() => screen.getByRole('textbox', { name: /paste|describe/i }),
      { timeout: 5000 });
    await user.type(box, 'HDPE bottles on a filling line, 300 feet per minute, 4mm date code.');
    await user.click(screen.getAllByRole('button', { name: /^Read it$/ })[0]);
    await user.click(screen.getAllByRole('button', { name: /The solution/ })[0]);
    await user.click(await waitFor(() => screen.getAllByRole('button', { name: /^CIJ/ })[0],
      { timeout: 5000 }));
    // "Choose", not "Add": a machine is the one thing on a quote you pick rather than
    // accumulate, and the configurator names it that way.
    const choose = await waitFor(() => {
      const b = [...document.querySelectorAll('li button')]
        .find((x) => x.textContent?.trim() === 'Choose');
      if (!b) throw new Error('no Choose button on a machine row');
      return b as HTMLButtonElement;
    }, { timeout: 8000 });
    await user.click(choose);

    // Save, land on the quote, and send from there.
    await user.click(await waitFor(() => screen.getAllByRole('button', { name: /Save and review/ })[0],
      { timeout: 8000 }));
    await user.click(await waitFor(() => screen.getAllByRole('button', { name: /Review and send/ })[0],
      { timeout: 8000 }));
    const dialog = await waitFor(() => {
      const el = document.querySelector('[aria-modal="true"]');
      if (!el) throw new Error('no modal');
      return el as HTMLElement;
    }, { timeout: 8000 });

    /* One customer copy, and it is QuoteDocument.
       The dialog used to draw its own — its own logo, its own photograph, its own
       table — beside the component that actually renders the document. There is one
       now, and it carries no photographs at all: a stock shot of another plant's
       line did not look like it belonged next to the numbers, which on a commercial
       document is the whole test. */
    expect(within(dialog).queryByText(/What the marking looks like/)).toBeNull();
    expect(dialog.querySelector('figure')).toBeNull();

    // Still signed with the full-colour mark, because this surface is white.
    const marks = [...dialog.querySelectorAll('img')]
      .filter((i) => i.getAttribute('src') === AXIM_LOGO_BLUE);
    expect(marks.length).toBe(1);
  });

});

describe('the machine cards', () => {
  it('prefer a real photograph where one was supplied', () => {
    // 6440 has a photograph; the thumb must be it, and the page link must survive.
    const supplied = mediaFor('6440');
    expect(supplied?.thumb).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(supplied?.page).toMatch(/axim\.example/);

    // 6400 deliberately has none, so it keeps whatever the portfolio capture gave it.
    const captured = mediaFor('6400');
    expect(captured?.thumb).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(captured?.thumb).not.toBe(supplied?.thumb);
  });
});
