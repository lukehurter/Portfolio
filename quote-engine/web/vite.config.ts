import { fileURLToPath } from 'node:url';
// vitest/config re-exports vite's defineConfig and adds the `test` block to its
// type, so the config stays one file with one export.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Two build targets from one source.
//
//   npm run build          -> normal assets, served by the FastAPI service.
//   npm run build:preview  -> one self-contained HTML file that opens by
//                             double-click, for looking at the thing before any
//                             backend exists. Same code, mock data source.
//
// The preview build is why base is './' and why singlefile is conditional: an
// external module script cannot be fetched over file://, but an inline one runs.
//
// Tests count as preview. They exercise the screens against the mock catalogue and
// the seeded quotes, so `npx vitest` has to resolve @preview-api and __CPQ_PREVIEW__
// the same way the preview build does — otherwise a render test mounts a screen that
// tries to fetch /api/session and times out, which is exactly how this was found.
const preview = process.env.CPQ_PREVIEW === '1' || !!process.env.VITEST;

export default defineConfig({
  base: preview ? './' : '/',
  plugins: [react(), ...(preview ? [viteSingleFile()] : [])],
  define: {
    __CPQ_PREVIEW__: JSON.stringify(preview),
  },
  resolve: {
    alias: {
      // The mock is excluded from production by swapping the module, not by a
      // runtime flag. `__CPQ_PREVIEW__ ? mock : http` left the mock in the graph
      // — mock.ts has module-level side effects, so it cannot be tree-shaken —
      // and a measured production build carried 282 KB of invented prices,
      // verbatim rule wording and a client-side role switch. Now the sample data
      // is only ever compiled into the build that is meant to have it.
      '@preview-api': preview
        ? here('./src/api/mock.ts')
        : here('./src/api/noPreview.ts'),
    },
  },
  build: {
    target: 'es2020',
    reportCompressedSize: false,
    ...(preview ? { assetsInlineLimit: 100000000, cssCodeSplit: false } : {}),
  },
  // Node by default, jsdom only where a file asks for it with a
  // `@vitest-environment jsdom` docblock. Deliberate rather than a blanket jsdom: the
  // engine and rule suites are pure functions over data and run faster without one,
  // and keeping them in node means a test that reaches for `document` by accident
  // fails rather than quietly passing.
  test: {
    environment: 'node',
    testTimeout: 20000,
  },
  server: {
    proxy: {
      // dev against a live API without CORS gymnastics
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
