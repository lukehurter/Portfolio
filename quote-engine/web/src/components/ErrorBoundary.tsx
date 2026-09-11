import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Something threw during render. Say so, and offer a way back.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Without a boundary, one error anywhere in the tree unmounts the whole
 * application and leaves a white page. Reported from use: the browser's German
 * auto-translation was on, adding a machine to a quote turned the page white, and
 * nothing short of restarting the browser brought it back. A rep in that state has
 * lost the quote they were building and has no idea why.
 *
 * ── The translation case in particular ──────────────────────────────────────
 *
 * Chrome's page translation rewrites text nodes in place — it splits them and wraps
 * the pieces in its own <font> elements. React still holds references to the nodes it
 * created, so the next time it tries to update or remove one of them the node is no
 * longer where React believes it is, and removeChild throws NotFoundError. It is a
 * known and long-standing interaction, it is not specific to this app, and no amount
 * of care inside a component prevents it.
 *
 * What can be done is refuse to lose the rep's work over it. The boundary catches the
 * error, keeps the shell, and offers a reload — and because the draft is on the
 * server the moment it is saved, "Save often" is real advice rather than a platitude.
 *
 * A boundary is a class because React has no hook form of componentDidCatch. That is
 * the only reason this file has a class in it.
 */

interface State {
  error: Error | null;
  translated: boolean;
}

/** Is the page being machine-translated right now? */
function pageIsTranslated(): boolean {
  const html = document.documentElement;
  return html.classList.contains('translated-ltr')
    || html.classList.contains('translated-rtl')
    || !!document.querySelector('font[_msttexthash], font[style*="vertical-align"]')
    || !!document.querySelector('.goog-te-banner-frame, ya-tr-span');
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, translated: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Left in deliberately. This is the one console message worth having in
    // production, because it is the only record of what a rep saw.
    console.error('CPQ crashed during render', error, info.componentStack);
    this.setState({ translated: pageIsTranslated() });
  }

  render() {
    const { error, translated } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-lg p-8">
        <section className="panel">
          <header className="panel-head">
            <h2 className="h-display text-sm">Something went wrong on this screen</h2>
          </header>
          <div className="space-y-3 p-4">
            <p className="text-sm text-steel-800">
              The screen stopped rather than showing you something that might be wrong.
              Anything you had saved is on the server and is not affected.
            </p>

            {translated && (
              /* Named, because the fix is not in this application and a rep who does
                 not know that will keep hitting it. */
              <p className="border border-signal-200 bg-signal-100 px-3 py-2 text-2xs leading-snug text-signal-800">
                The browser is translating this page. Page translation rewrites the
                text as it goes and that is what this app trips over — it is a known
                problem between the two and not something this tool can catch in
                advance. Turning translation off for this site stops it happening.
              </p>
            )}

            <p className="text-2xs text-steel-600">
              {error.message || String(error)}
            </p>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm"
                      onClick={() => window.location.reload()}>
                Reload the page
              </button>
              <button type="button" className="btn-quiet text-sm"
                      onClick={() => { window.location.hash = '#/quotes'; window.location.reload(); }}>
                Back to quotes
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }
}
