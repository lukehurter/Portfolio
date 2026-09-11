/**
 * Profile fields the engines compute rather than ask for.
 *
 * Its own module, and not in engine/evaluate.ts where it started, because of what
 * importing it costs. The rule editor wants this one small constant and nothing else
 * from the engine — and pulling it out of evaluate.ts dragged the whole pricing
 * engine into the production bundle, which is 40 KB of code that has no business
 * being there.
 *
 * That mattered for more than size. The service is the authority on every number a
 * customer sees — "the client sends intent, the server returns the numbers" — and a
 * production build that ships a second implementation of the pricing makes that a
 * statement of intent rather than a fact about the artifact. It is a fact again.
 *
 * The engine imports this; nothing imports the engine to reach it.
 *
 * Held equal with the Python side by api/tests/test_validation.py, which reads this
 * file: a field the rule editor offers and the engine cannot compute is a rule an
 * author can write and the tool will silently never fire.
 */
export const DERIVED_FIELDS: Record<string, string> = {
  markHeightMm: 'mark height, character height × lines',
};
