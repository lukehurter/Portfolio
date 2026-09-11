/** Injected by Vite's `define` at build time. */
declare const __CPQ_PREVIEW__: boolean;

/**
 * vite.config.ts reads one env var to choose the build target. Declaring just
 * that is lighter than pulling in all of @types/node for a single lookup.
 */
declare const process: { env: Record<string, string | undefined> };
