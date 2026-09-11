import { useEffect, useState } from 'react';

/**
 * Light, dark, or whatever the machine is set to.
 *
 * Three states rather than two, and the third is the default. A rep who has told
 * Windows to go dark at sunset has already answered this question, and an app that
 * ignores that answer is asking them to answer it twice. So nothing is stamped on
 * <html> until somebody chooses, and until then the CSS follows prefers-color-scheme.
 *
 * The choice is stored, because a preference that resets on every load is not one.
 */
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'cpq.theme';

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    // Private browsing, or storage disabled by policy. Following the system is the
    // right answer when the stored one cannot be read.
    return 'system';
  }
}

/** Stamp the choice, or take the stamp off and let the system decide again. */
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  try { t === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, t); } catch {
    /* nothing to do: the theme still applies for this visit */
  }
}

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

const ICON: Record<Theme, React.ReactNode> = {
  // Drawn, not borrowed: one stroke weight and a 20-unit box, same as the nav icons.
  light: <><circle cx="10" cy="10" r="3.6" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M15.4 4.6L14 6M6 14l-1.4 1.4" /></>,
  dark: <path d="M15.5 11.4A6 6 0 0 1 8.6 4.5a6 6 0 1 0 6.9 6.9z" />,
  system: <><rect x="2.8" y="4" width="14.4" height="9.5" rx="1" /><path d="M7 16.5h6" /></>,
};

const SAID: Record<Theme, string> = {
  system: 'Following the system', light: 'Light', dark: 'Dark',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded border border-navy-600 bg-navy-950 px-1.5 py-1
                 text-2xs font-semibold text-navy-100 transition-colors hover:border-instr-400"
      onClick={() => setTheme(NEXT[theme])}
      /* The label says the state, not the action. "Dark" on a button that switches to
         light is the ambiguity every theme toggle has; saying what it currently IS,
         and what pressing it moves to, removes it. */
      title={`${SAID[theme]} — switch to ${SAID[NEXT[theme]].toLowerCase()}`}
      aria-label={`Appearance: ${SAID[theme]}. Switch to ${SAID[NEXT[theme]]}.`}
    >
      <svg aria-hidden viewBox="0 0 20 20" width="14" height="14" fill="none"
           stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {ICON[theme]}
      </svg>
      <span className="hidden sm:inline">{SAID[theme]}</span>
    </button>
  );
}
