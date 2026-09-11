import type { CpqApi } from './types';

/**
 * What `@preview-api` resolves to in a production build.
 *
 * The mock used to be a static import guarded by `__CPQ_PREVIEW__ ? mock : http`.
 * A constant-false ternary looks like it removes the branch, and it does not:
 * mock.ts computes module-level constants from the catalogue, so Rollup cannot
 * treat it as side-effect free and keeps the whole graph. Measured on the real
 * build, that put 282 KB of invented prices, verbatim rule wording and a
 * client-side role switch into a 616 KB production bundle.
 *
 * So the exclusion is a build-time module swap rather than a runtime check. In a
 * production build the mock is not in the module graph at all, and neither are
 * catalog.ts, gaps.ts, taxonomy.ts or appRules.ts. See vite.config.ts.
 *
 * Nothing should ever reach these methods — `api` is `httpApi` whenever this file
 * is the one that resolved. If one is called, that is a wiring bug worth a loud
 * failure rather than a silent empty result.
 */
export const mockApi: CpqApi = new Proxy({} as CpqApi, {
  get(_target, prop) {
    return () => {
      throw new Error(
        `The mock API is not present in a production build (called ${String(prop)}). `
        + 'This build talks to the FastAPI service; reaching for the mock means '
        + 'something imported it directly instead of using `api` from src/api.',
      );
    };
  },
});
