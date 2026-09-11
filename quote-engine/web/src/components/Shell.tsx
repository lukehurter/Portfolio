import { useEffect, useRef, type ReactNode } from 'react';
import { AXIM_LOGO_WHITE } from '../assets/logo';
import { usePublishedHeight } from './usePublishedHeight';
import { toHash, useApp, type Route } from '../state/app';
import { QuickFind } from './QuickFind';
import { ThemeToggle } from './Theme';
import { IS_PREVIEW, type Role } from '../api';

/**
 * Nav icons, drawn rather than borrowed.
 *
 * One stroke weight, one 20-unit box, currentColor throughout, so they sit at the
 * same visual weight as the label beside them. No icon library and no glyph
 * characters: a ▸ or an emoji takes its weight and baseline from whatever font
 * resolved, which is not a decision this interface gets to make.
 *
 * Each says what the section is, in the subject's own terms rather than in
 * generic-dashboard terms: a quote is a document, an order is a box in transit,
 * a rule is a set of conditions with a verdict, classification is sorting into
 * bins.
 */
const ICONS: Record<string, React.ReactNode> = {
  // A document with lines of type — a quote.
  quotes: (
    <>
      <path d="M4.5 2.5h8l3 3v12h-11z" />
      <path d="M12.5 2.5v3h3" />
      <path d="M7 9h6M7 12h6M7 15h3.5" />
    </>
  ),
  // A case on a conveyor: what an open order physically is.
  orders: (
    <>
      <path d="M3 6.5 10 3.5l7 3v7l-7 3-7-3z" />
      <path d="M3 6.5 10 9.5l7-3M10 9.5v7" />
    </>
  ),
  // Three readings of different heights against a baseline: a distribution, which is
  // what almost every panel on that page draws. Not a pie, and not a magnifying glass.
  analytics: (
    <>
      <path d="M3 16.5h14" />
      <path d="M6 16.5v-5M10 16.5v-9M14 16.5v-3" />
    </>
  ),
  // Two conditions and the line that decides between them.
  rules: (
    <>
      <path d="M3.5 5.5h7M3.5 10h7M3.5 14.5h7" />
      <path d="M13.5 4.5v11" />
      <path d="M13.5 8.5 16.5 8.5M13.5 13 16.5 13" />
    </>
  ),
  // Sorting into bins — which is what classifying a part is.
  mappings: (
    <>
      <path d="M2.5 12.5h5v5h-5zM12.5 12.5h5v5h-5z" />
      <path d="M10 2.5v5" />
      <path d="M5 12.5V9.5h10v3" />
    </>
  ),
  priceBook: (
    <>
      <path d="M4 2.5h9l3.5 3.5v11.5H4z" />
      <path d="M12.5 2.5V6H16" />
      <path d="M7 10.5h6M7 13.5h6" />
    </>
  ),
};

const NAV: { route: Route; label: string; roles: Role[]; hint: string; icon: string }[] = [
  { route: { name: 'quotes' },   label: 'Quotes',   roles: ['rep', 'approver', 'admin'], hint: 'Build and track quotes', icon: 'quotes' },
  { route: { name: 'orders' },   label: 'Open orders', roles: ['rep', 'approver', 'admin'], hint: 'Where is a customer order', icon: 'orders' },
  /* Readable by everyone, editable by an admin — the screens enforce that
     themselves. A rep who cannot reach the rule behind a recommendation cannot
     defend the quote they are sending, which is the point of the tool. */
  { route: { name: 'analytics' }, label: 'Analytics', roles: ['rep', 'approver', 'admin'], hint: 'What is quoted, and what was asked for', icon: 'analytics' },
  { route: { name: 'rules' },    label: 'Rules',    roles: ['rep', 'approver', 'admin'], hint: 'Why the tool says what it says', icon: 'rules' },
  { route: { name: 'mappings' }, label: 'Classify', roles: ['rep', 'approver', 'admin'], hint: 'Technology and type for every part', icon: 'mappings' },
];

function NavIcon({ name }: { name: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" width="17" height="17"
         className="shrink-0" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { session, route, go, setRole, toast } = useApp();
  /* IS_PREVIEW, not the context value.
     Reading it through React context makes it a runtime property Rollup cannot
     reason about, so the sample-data banner and the role switch stayed in the
     production bundle as unreachable markup. Read as a module constant it folds
     to `false && …` and the markup is gone. */
  const isPreview = IS_PREVIEW;
  const role = session?.role ?? 'rep';
  const visible = NAV.filter((n) => n.roles.includes(role));

  /* The chrome's real height, for everything that sticks below it. Measured, not
     assumed — usePublishedHeight says why at length. */
  const chrome = useRef<HTMLElement>(null);
  usePublishedHeight(chrome, '--chrome-h');

  return (
    // id so a modal can hide the whole shell from assistive tech while it is open.
    <div id="app-shell" className="flex min-h-screen flex-col">
      {/* brand bar */}
      <header ref={chrome}
              className="fascia sticky top-0 z-sticky flex items-center gap-x-2.5 bg-navy-900 px-3 py-2 text-navy-100 sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:px-4">
        <div className="flex items-center gap-2.5">
          {/* The reversed artwork, not a filtered colour one. It used to be drawn with
              brightness(0) invert(1), which flattens every pixel to black and inverts
              it — close, but the dots feeding into the D are the only subtle part of
              this mark and they came out as whatever the arithmetic gave. */}
          <img
            src={AXIM_LOGO_WHITE}
            alt="Axim"
            className="h-5 w-auto sm:h-9"
          />
          {/* The wordmark is 8:1, so at any legible height it is most of a phone's
              width. Everything that shares this row has to earn its place, and on a
              phone the rail below already says which screen you are on. */}
          <span className="hidden rounded border border-navy-600 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-navy-300 sm:inline">
            CPQ
          </span>
        </div>

        {/* fascia-signal, not signal-200. The status ramps invert in dark mode — the
            100 and 200 steps stop being pale washes and become deep fills — which is
            right everywhere they sit behind content, and wrong here, because this chip
            is on the fascia and the fascia is navy in both themes. The amber went to
            #4A3A14 on navy and the banner read as an empty outline. */}
        {isPreview && (
          <p className="flex shrink-0 items-center gap-1.5 rounded border border-signal-600 bg-navy-950 px-1.5 py-0.5 text-2xs font-semibold text-fascia-signal sm:order-none sm:gap-2 sm:px-2.5 sm:py-1">
            <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-signal-500" />
            {/* The full sentence needs a full line, and on a phone that line cost more
                height than the entire bar. The short form says the one thing a rep has
                to know; the rest is on the About panel. */}
            <span className="sm:hidden">Preview</span>
            <span className="hidden sm:inline">
              Demo build &mdash; fictional company, invented catalogue, nothing saved.{' '}
              <a href="../../case-studies/02-the-planning-platform.md"
                 className="underline underline-offset-2 hover:text-white">
                What this is
              </a>
            </span>
          </p>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <QuickFind />
          <ThemeToggle />
          {isPreview && (
            <label className="flex items-center gap-1.5 text-2xs text-navy-300">
              {/* The words cost a whole row on a phone; the control says what it is. */}
              <span className="hidden sm:inline">View as</span>
              <select
                aria-label="View as"
                className="rounded border border-navy-600 bg-navy-950 px-1.5 py-1 text-2xs font-semibold text-white"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="rep">Rep</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          )}
          {/* Two lines of provenance is right at a desk and is a third of the bar on
              a phone, where the rep already knows who they are. */}
          <span className="hidden text-right text-2xs leading-tight sm:block">
            <span className="block font-semibold text-white">{session?.displayName ?? '—'}</span>
            <span className="block text-navy-300">
              {role}
              {session?.roleSource === 'entraGroup' && ' · from a Microsoft 365 group'}
            </span>
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Rail on a desk, strip on a phone.
            A fixed 192px rail left about 150px of content on a 375px screen,
            which is not a narrow layout — it is an unusable one. Below md the
            sections run horizontally instead and scroll if they have to. */}
        <nav
          aria-label="Sections"
          style={{ top: 'var(--chrome-h, 3.25rem)' }}
          className="fascia-rail w-full shrink-0 border-b-2 border-instr-400 bg-navy-900 py-2 text-navy-100 md:sticky md:h-[calc(100vh-var(--chrome-h,3.25rem))] md:w-48 md:self-start md:overflow-y-auto md:border-b-0 md:border-r md:border-navy-800 md:py-3"
        >
          <ul className="flex gap-1 overflow-x-auto px-2 md:block md:space-y-0.5 md:overflow-visible">
            {visible.map((n) => {
              const active = n.route.name === route.name
                || (n.route.name === 'rules' && (route.name === 'rule' || route.name === 'newRule'))
                || (n.route.name === 'quotes' && route.name === 'quote')
                || (n.route.name === 'orders' && route.name === 'orders');
              return (
                <li key={n.label} className="shrink-0 md:shrink">
                  {/* An anchor, not a button. These were buttons, which meant no
                      middle-click, no open-in-new-tab, no visited state and nothing
                      for a screen reader to treat as navigation — for the four
                      controls that are purely navigation. The click is still handled
                      so the router does the work, and the href makes it a real link
                      when the browser wants one.

                      Active is a cyan bar and a lit label, the way a panel marks the
                      mode it is in. On navy a white pill would punch a hole in the
                      rail; the bar reads at a glance without doing that. */}
                  <a
                    href={toHash(n.route)}
                    aria-current={active ? 'page' : undefined}
                    onClick={(e) => {
                      // Let the browser handle a modified click: that is the whole
                      // point of it being a link.
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      go(n.route);
                    }}
                    title={n.hint}
                    className={`nav-link flex w-full items-center gap-2.5 whitespace-nowrap border-l-2 px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                      active
                        ? 'border-instr-400 bg-navy-800 text-white'
                        : 'border-transparent text-navy-100 hover:bg-navy-800 hover:text-white'}`}
                  >
                    <NavIcon name={n.icon} />
                    {n.label}
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Reference, not navigation — it costs a phone a third of the screen
              for something the rep can read on the quote itself. */}
          {session?.approver && (
            <div className="mx-2 mt-5 hidden border border-navy-800 bg-navy-950 px-2.5 py-2 md:block">
              <p className="text-2xs font-semibold uppercase tracking-wider text-navy-300">
                Your approver
              </p>
              <p className="mt-0.5 text-xs font-semibold text-white">{session.approver.displayName}</p>
              <p className="mt-0.5 text-2xs text-navy-300">
                {{ override: 'set by an admin', entraManager: 'from the Microsoft 365 reporting line',
                   technology: 'technology fallback', unroutable: 'not resolved' }[session.approver.resolvedBy]}
              </p>
            </div>
          )}
        </nav>

        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>

      {/* The live region is always in the tree, and only its text changes.
          Inserting a role="status" element at the same moment as its message is the
          shape screen readers most often miss — the region has to be observed before
          it can be observed changing. Everything the tool tells a rep comes through
          here: saved, sent, approved, and "could not save". */}
      <div role="status" aria-live="polite" aria-atomic="true"
           className={toast
             ? 'slide-in fixed bottom-5 right-5 z-toast rounded-md border border-fit-200 bg-fit-100 px-4 py-2.5 shadow-lift'
             : 'sr-only'}>
        {toast && <p className="text-xs font-semibold text-fit-800">{toast}</p>}
      </div>
    </div>
  );
}
