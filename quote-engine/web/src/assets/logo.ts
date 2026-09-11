/**
 * The Axim wordmark and the mark alone, as vector artwork.
 *
 * GENERATED-PORTFOLIO-ARTWORK — drawn for this copy, owned by this copy.
 *
 * The file this replaces held the real company's registered wordmark, lifted
 * path by path out of their brand guidelines PDF. Renaming the comment above it
 * changed nothing: a logo is artwork, not text, and a scrubber that reads words
 * cannot see a letterform drawn as a bezier. It rendered, correctly and in full,
 * at the top of every screen of a copy that had just been declared clean.
 *
 * So this is not a scrub of that file. It is a different drawing: a printhead of
 * four descending jets over the substrate passing beneath it, and AXIM set beside
 * it. Nothing here was traced from anything.
 *
 * TWO SOLID TONES, NO TRANSPARENCY. The dimmer parts are their own colour rather
 * than the main one at reduced alpha, because brand.render.test.tsx forbids
 * `opacity` anywhere in the rendered logo - it is how it proves the reversed mark
 * is real artwork and not the colour one run through a CSS filter. A fill-opacity
 * attribute inside the SVG trips that check, and it is right to: the rule is that
 * the two treatments are drawn, not derived.
 */

/* URL-encoded rather than base64: the same format the file this replaces used,
   and it needs no btoa, which the node half of the test run does not have. */
const svg = (body: string, w: number, h: number): string =>
  'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`);

/** The printhead: four jets stepping down over the line they are marking. */
const mark = (ink: string, dim: string): string =>
  `<g fill="${ink}">` +
  `<rect x="8" y="46" width="26" height="104" rx="13"/>` +
  `<rect x="52" y="66" width="26" height="84" rx="13"/>` +
  `<rect x="96" y="86" width="26" height="64" rx="13"/>` +
  `<rect x="140" y="106" width="26" height="44" rx="13"/>` +
  `</g>` +
  `<rect x="8" y="182" width="158" height="22" rx="11" fill="${dim}"/>`;

/** AXIM, drawn rather than set, so the file carries no font dependency. */
const word = (ink: string): string =>
  `<g fill="${ink}">` +
  `<path d="M232 204 L316 46 h34 l84 158 h-52 l-15-30 h-70 l-15 30z M319 132 h38 l-19-38z"/>` +
  `<path d="M462 46 h56 l40 54 40-54 h56 l-68 79 68 79 h-56 l-40-54-40 54 h-56 l68-79z"/>` +
  `<rect x="700" y="46" width="48" height="158" rx="6"/>` +
  `<path d="M792 204 V46 h58 l52 96 52-96 h58 v158 h-48 V128 l-44 76 h-36 l-44-76 v76z"/>` +
  `</g>`;

const strap = (dim: string): string =>
  `<g fill="${dim}" font-family="Segoe UI,system-ui,sans-serif"` +
  ` font-size="52" font-weight="500" letter-spacing="14">` +
  `<text x="1108" y="168">MARKING SYSTEMS</text></g>`;

const NAVY = '#0B2E4F';
const NAVY_DIM = '#5C7A94';   // the navy, lightened. Drawn, not faded.
const WHITE = '#FFFFFF';
const WHITE_DIM = '#B9CCDD';  // the header's own secondary text colour.

/** Full wordmark for a light ground. */
export const AXIM_LOGO_BLUE: string =
  svg(mark(NAVY, NAVY_DIM) + word(NAVY) + strap(NAVY_DIM), 2109, 261);

/** Full wordmark reversed, for the navy header and any dark surface. */
export const AXIM_LOGO_WHITE: string =
  svg(mark(WHITE, WHITE_DIM) + word(WHITE) + strap(WHITE_DIM), 2109, 261);

/** The mark on its own, square, for the favicon and the app icon. */
export const AXIM_MARK: string =
  svg(`<rect width="212" height="212" rx="44" fill="${NAVY}"/>` +
      `<g transform="translate(14,4)">${mark(WHITE, WHITE_DIM)}</g>`, 212, 212);
