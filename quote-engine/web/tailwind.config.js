/** @type {import('tailwindcss').Config} */

// Axim brand. Single definition lives in ../../BRAND.md; this is its
// Tailwind expression, identical to the one the prototype uses so the two never
// drift. Brand hues carry fills; the darkened steps carry small text.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*  Navy, anchored on the brand.
            900 is #023B74 — the figure in BRAND.md. It was not in this scale at all:
            the ramp had been built around #032D59, a colour that appears nowhere in
            the brand guidelines, so every navy surface in the app was a near-miss of
            the one navy Axim actually publishes.

            The rest of the dark end moved with it rather than staying put. 600 and
            700 are hairlines drawn ON navy and 300 is text ON navy; lifting the
            surface and leaving them behind would have dissolved both. Same relative
            lightness steps as before, re-struck around the real anchor.            */
        navy: { 950: 'rgb(var(--c-navy-950) / <alpha-value>)', 900: 'rgb(var(--c-navy-900) / <alpha-value>)', 800: 'rgb(var(--c-navy-800) / <alpha-value>)', 700: 'rgb(var(--c-navy-700) / <alpha-value>)', 600: 'rgb(var(--c-navy-600) / <alpha-value>)', 500: 'rgb(var(--c-navy-500) / <alpha-value>)', 300: 'rgb(var(--c-navy-300) / <alpha-value>)', 100: 'rgb(var(--c-navy-100) / <alpha-value>)', 50: 'rgb(var(--c-navy-50) / <alpha-value>)' },
        steel: { 900: 'rgb(var(--c-steel-900) / <alpha-value>)', 800: 'rgb(var(--c-steel-800) / <alpha-value>)', 700: 'rgb(var(--c-steel-700) / <alpha-value>)', 600: 'rgb(var(--c-steel-600) / <alpha-value>)', 500: 'rgb(var(--c-steel-500) / <alpha-value>)', 400: 'rgb(var(--c-steel-400) / <alpha-value>)', 300: 'rgb(var(--c-steel-300) / <alpha-value>)', 200: 'rgb(var(--c-steel-200) / <alpha-value>)', 100: 'rgb(var(--c-steel-100) / <alpha-value>)', 50: 'rgb(var(--c-steel-50) / <alpha-value>)' },
        instr: { 800: 'rgb(var(--c-instr-800) / <alpha-value>)', 700: 'rgb(var(--c-instr-700) / <alpha-value>)', 600: 'rgb(var(--c-instr-600) / <alpha-value>)', 500: 'rgb(var(--c-instr-500) / <alpha-value>)', 400: 'rgb(var(--c-instr-400) / <alpha-value>)', 300: 'rgb(var(--c-instr-300) / <alpha-value>)', 200: 'rgb(var(--c-instr-200) / <alpha-value>)', 100: 'rgb(var(--c-instr-100) / <alpha-value>)' },
        signal: { 800: 'rgb(var(--c-signal-800) / <alpha-value>)', 700: 'rgb(var(--c-signal-700) / <alpha-value>)', 600: 'rgb(var(--c-signal-600) / <alpha-value>)', 500: 'rgb(var(--c-signal-500) / <alpha-value>)', 200: 'rgb(var(--c-signal-200) / <alpha-value>)', 100: 'rgb(var(--c-signal-100) / <alpha-value>)' },
        fit: { 800: 'rgb(var(--c-fit-800) / <alpha-value>)', 700: 'rgb(var(--c-fit-700) / <alpha-value>)', 600: 'rgb(var(--c-fit-600) / <alpha-value>)', 200: 'rgb(var(--c-fit-200) / <alpha-value>)', 100: 'rgb(var(--c-fit-100) / <alpha-value>)' },
        alert: { 800: 'rgb(var(--c-alert-800) / <alpha-value>)', 700: 'rgb(var(--c-alert-700) / <alpha-value>)', 600: 'rgb(var(--c-alert-600) / <alpha-value>)', 200: 'rgb(var(--c-alert-200) / <alpha-value>)', 100: 'rgb(var(--c-alert-100) / <alpha-value>)' },
        ground: 'rgb(var(--c-ground) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        rule: 'rgb(var(--c-rule) / <alpha-value>)',
        band: 'rgb(var(--c-band) / <alpha-value>)',
        heading: 'rgb(var(--c-heading) / <alpha-value>)',
        edge: 'rgb(var(--c-edge) / <alpha-value>)',
        fascia: { alert: 'rgb(var(--c-fascia-alert) / <alpha-value>)', signal: 'rgb(var(--c-fascia-signal) / <alpha-value>)', fit: 'rgb(var(--c-fascia-fit) / <alpha-value>)' },
        paper: 'rgb(var(--c-ground) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Open Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Open Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      fontSize: { '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }] },
      borderRadius: { DEFAULT: '5px', md: '6px', lg: '8px' },
      boxShadow: {
        panel: '0 1px 2px rgba(2,59,116,.05), 0 0 0 1px rgba(2,59,116,.06)',
        lift: '0 8px 40px rgba(2,44,87,.18)',
        rail: '1px 0 0 rgba(2,59,116,.08)',
      },
      // dropdown sits above page content but below the sticky brand bar, so an
      // open combobox list never covers the navigation.
      zIndex: { dropdown: '20', sticky: '30', backdrop: '40', drawer: '50', modal: '60', toast: '70' },
    },
  },
  plugins: [],
};
