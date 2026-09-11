import type { CpqApi } from './types';
// Resolved by vite.config.ts: the real mock in a preview build, a throwing stub
// in production. A `__CPQ_PREVIEW__ ? mock : http` ternary did NOT keep the mock
// out — mock.ts has module-level side effects, so Rollup kept the whole graph and
// shipped 282 KB of invented prices and verbatim rule wording to production. The
// swap happens at resolve time now, so there is nothing to shake out.
import { mockApi } from '@preview-api';
import { httpApi } from './http';

/**
 * One switch. The preview build ships the in-memory API so the tool can be
 * looked at with no backend; every other build talks to the FastAPI service.
 *
 * Screens import `api` and never learn which one they got.
 */
export const api: CpqApi = __CPQ_PREVIEW__ ? mockApi : httpApi;
export const IS_PREVIEW = __CPQ_PREVIEW__;
export * from './types';
export { draftFromQuote } from './draft';
