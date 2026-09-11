import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { api, IS_PREVIEW, type Role, type Session } from '../api';

/**
 * Session and routing. No router library — the app has six destinations and a
 * hash is enough, while still giving the browser back button something real to
 * do (state preservation on back is a stated product expectation).
 */

export type Route =
  | { name: 'quotes' }
  | { name: 'quote'; quoteNo: string }
  /* The customer's copy, linkable. It used to be a tab inside a modal, which
     made it the one screen nobody could show anybody. */
  | { name: 'quoteDocument'; quoteNo: string }
  /* `start` says which section to open. The three doors on the quotes screen
     all landed on the same builder, which is why "start from a machine" felt
     pointless — it was identical to starting from an enquiry. */
  | { name: 'notFound'; attempted: string }
  | { name: 'newQuote'; start?: 'machine' }
  /* `pickRole` is the kind of part a finding sent the rep to find. A rule saying
     "no mount on this quote" is actionable on the saved quote only if following it
     lands on the mounts rather than on the builder's front door. */
  | { name: 'editQuote'; quoteNo: string; pickRole?: string }
  | { name: 'rules' }
  | { name: 'rule'; ruleCode: string }
  | { name: 'newRule' }
  | { name: 'mappings' }
  | { name: 'orders'; customerNo?: string }
  | { name: 'analytics' }
  ;

function parseHash(): Route {
  const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  const [head, arg] = h.split('/');
  if (head === 'rules' && arg === 'new') return { name: 'newRule' };
  if (head === 'rules' && arg) return { name: 'rule', ruleCode: arg };
  if (head === 'rules') return { name: 'rules' };
  if (head === 'quotes' && arg === 'new') {
    const [, , where] = h.split('/');
    return { name: 'newQuote', start: where === 'machine' ? 'machine' : undefined };
  }
  if (head === 'quotes' && arg && h.includes('/edit')) {
    const role = h.split('/edit/')[1];
    return { name: 'editQuote', quoteNo: arg, pickRole: role || undefined };
  }
  if (head === 'quotes' && arg && h.endsWith('/document'))
    return { name: 'quoteDocument', quoteNo: arg };
  if (head === 'quotes' && arg) return { name: 'quote', quoteNo: arg };
  if (head === 'orders') return { name: 'orders', customerNo: arg || undefined };
  if (head === 'analytics') return { name: 'analytics' };
  // The nav item reads "Classify", so #/classify is the obvious guess and it used to
  // land silently on the quotes list. An alias is kinder than a not-found page for a
  // route somebody was right to expect.
  if (head === 'mappings' || head === 'classify' || head === 'classification')
    return { name: 'mappings' };
  // Empty hash is the quotes list, which is the home screen. Anything else is a
  // stale bookmark or a typo, and saying so beats redirecting without a word —
  // silently showing the wrong screen is how somebody concludes the tool is broken.
  if (head === '' || head === 'quotes') return { name: 'quotes' };
  return { name: 'notFound', attempted: window.location.hash };
}

/** Exported so the nav can render a real href for the route it points at. */
export function toHash(r: Route): string {
  switch (r.name) {
    case 'analytics': return '#/analytics';
    case 'quotes':   return '#/quotes';
    case 'quote':    return `#/quotes/${encodeURIComponent(r.quoteNo)}`;
    case 'quoteDocument': return `#/quotes/${encodeURIComponent(r.quoteNo)}/document`;
    case 'newQuote': return r.start ? `#/quotes/new/${r.start}` : '#/quotes/new';
    case 'editQuote':return `#/quotes/${encodeURIComponent(r.quoteNo)}/edit`;
    case 'rules':    return '#/rules';
    case 'rule':     return `#/rules/${encodeURIComponent(r.ruleCode)}`;
    case 'newRule':  return '#/rules/new';
    case 'orders':   return r.customerNo ? `#/orders/${encodeURIComponent(r.customerNo)}` : '#/orders';
    case 'mappings': return '#/mappings';
    case 'notFound': return r.attempted;
  }
}

interface AppState {
  session: Session | null;
  loading: boolean;
  route: Route;
  go: (r: Route) => void;
  setRole: (r: Role) => void;
  isPreview: boolean;
  toast: string | null;
  notify: (message: string) => void;
  /**
   * Hold navigation until a screen says it may proceed.
   *
   * The screen returns true to block. It is consulted before the route changes —
   * both for a link inside the app and for the browser's Back button — because a
   * guard that only reacts afterwards has already lost: by then the screen it was
   * guarding has unmounted, taking its unsaved state and its own prompt with it.
   *
   * Returns the function that unregisters it.
   */
  blockNavigation: (ask: (wanted: string) => boolean) => () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<Route>(parseHash);
  const [toast, setToast] = useState<string | null>(null);

  /* What is currently refusing to be navigated away from, and where the router
     believes it is. A ref rather than state: the hashchange handler has to read the
     current answer without re-registering, and setting state here would be a render
     in the middle of deciding whether to render. */
  const blocker = useRef<((wanted: string) => boolean) | null>(null);
  const at = useRef(typeof window === 'undefined' ? '' : window.location.hash);
  const restoring = useRef(false);

  const blockNavigation = useCallback((ask: (wanted: string) => boolean) => {
    blocker.current = ask;
    return () => { if (blocker.current === ask) blocker.current = null; };
  }, []);

  useEffect(() => {
    const onHash = () => {
      if (restoring.current) {
        restoring.current = false;
        at.current = window.location.hash;
        return;
      }
      const wanted = window.location.hash;
      if (wanted !== at.current && blocker.current?.(wanted)) {
        // Refused. Put the address back and leave the route alone, so nothing
        // unmounts and the screen keeps both its state and its prompt.
        restoring.current = true;
        window.location.hash = at.current;
        return;
      }
      at.current = wanted;
      setRoute(parseHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSession(await api.getSession()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const go = useCallback((r: Route) => {
    const wanted = toHash(r);
    if (wanted !== at.current && blocker.current?.(wanted)) return;
    at.current = wanted;
    window.location.hash = wanted;
    setRoute(r);
  }, []);

  const setRole = useCallback((r: Role) => {
    api.setPreviewRole(r);
    void load();
  }, [load]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const value = useMemo<AppState>(
    () => ({ session, loading, route, go, setRole, isPreview: IS_PREVIEW, toast, notify,
             blockNavigation }),
    [session, loading, route, go, setRole, toast, notify, blockNavigation],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

/**
 * The app state where there is one, and null where there is not.
 *
 * For leaf components that would like to navigate but must not require it — a rule
 * chip is rendered inside the customer's copy and inside unit tests that mount a
 * single component, and neither has a provider. Throwing there would make a
 * presentational component impossible to render on its own.
 */
export function useAppOptional(): AppState | null {
  return useContext(Ctx);
}

/** Small async helper so every screen gets the same loading/error discipline. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | null; error: string | null; loading: boolean; reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { if (alive) setData(d); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
