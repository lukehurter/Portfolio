import type {
  Analytics,
  Requirement,
  ClassifiedItem, DocumentSettings,
  BookFit,
  CpqApi, CustomerHit, DiscountCategory, Evaluation, Item, ItemPromise, ItemToClassify,
  OpenOrder, ProductLineMapping, Quote, QuoteSummary, Rule, RuleAuditEntry, RuleSummary,
  Session, SuggestResult, Technology, ValidationResult,
} from './types';

/**
 * The real client. Authentication is handled by the reverse proxy (Windows
 * integrated auth), so requests carry credentials and the app never sees a
 * password. A 401/403 is a genuine authorisation failure, not a login prompt.
 */

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail: unknown = null;
    try { detail = await res.json(); } catch { /* body may be empty or html */ }
    throw Object.assign(new Error(`${res.status} ${res.statusText}`), { status: res.status, detail });
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
};

export const httpApi: CpqApi = {
  getSession: () => req<Session>('/session'),
  setPreviewRole: () => { /* the real API takes the role from AD; nothing to switch */ },

  listTechnologies: () => req<Technology[]>('/technologies'),
  getDocumentDefaults: () => req<DocumentSettings>('/document-defaults'),
  saveDocumentDefaults: (d) =>
    req<DocumentSettings>('/document-defaults', { method: 'PUT', body: JSON.stringify(d) }),
  /* POST, not GET: the application profile is a dozen fields and one of them is a
     free-text substrate. A query string would truncate it and put a customer's
     line description in a server log. */
  recommendBooks: (profile, noConstraint) =>
    req<BookFit[]>('/technologies/fit', {
      method: 'POST', body: JSON.stringify({ profile, noConstraint }),
    }),
  listDiscountCategories: () => req<DiscountCategory[]>('/discount-categories'),

  listRules: (p = {}) => req<RuleSummary[]>(`/rules${qs(p)}`),
  getRule: (code) => req<Rule>(`/rules/${encodeURIComponent(code)}`),
  validateRule: (rule) => req<ValidationResult>('/rules/validate', { method: 'POST', body: JSON.stringify(rule) }),
  saveRule: (rule) => req<Rule>(`/rules/${encodeURIComponent(rule.ruleCode)}`, { method: 'PUT', body: JSON.stringify(rule) }),
  getRuleAudit: (code) => req<RuleAuditEntry[]>(`/rules/${encodeURIComponent(code)}/audit`),

  nextRuleCode: (prefix) =>
    req<string>(`/rules/next-code?prefix=${encodeURIComponent(prefix)}`),

  searchItems: (p) => req<Item[]>(`/items${qs(p)}`),
  /* POST, because it creates the item. A configured laser has no part number until
     somebody configures it, so the server makes one before it can be quoted. */
  addConfiguredItem: (item) =>
    req<Item>('/items/configured', { method: 'POST', body: JSON.stringify(item) }),

  listItemRoles: () => req<{ name: string; count: number }[]>('/items/roles'),
  listRequirements: (technologyCode) =>
    req<Requirement[]>(
      `/rules/requirements?technology=${encodeURIComponent(technologyCode)}`),
  addTechnology: (code, name) =>
    req<void>('/technologies', { method: 'POST', body: JSON.stringify({ code, name }) }),
  removeTechnology: (code) =>
    req<void>(`/technologies/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  addItemRole: (name) =>
    req<void>('/items/roles', { method: 'POST', body: JSON.stringify({ name }) }),
  removeItemRole: (name) =>
    req<void>(`/items/roles/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  listCategories: (technology) =>
    req<{ category: string; count: number }[]>(
      `/items/categories?technology=${encodeURIComponent(technology)}`),

  addCategory: (name) =>
    req<void>('/items/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  removeCategory: (name) =>
    req<void>(`/items/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  listProductLines: () => req<ProductLineMapping[]>('/product-lines'),
  saveProductLines: (rows) =>
    req<ProductLineMapping[]>('/product-lines', { method: 'PUT', body: JSON.stringify(rows) }),

  listClassification: (p = {}) =>
    req<{ items: ClassifiedItem[]; total: number; counts: Record<string, number> }>(
      `/classification${qs(p)}`),
  clearOverrides: (itemNos) =>
    req<{ cleared: number }>('/classification/items', {
      method: 'DELETE', body: JSON.stringify(itemNos),
    }),
  classifyItems: (rows) =>
    req<{ saved: number }>('/classification/items',
      { method: 'PUT', body: JSON.stringify(rows) }),

  listQuotes: (p = {}) => req<QuoteSummary[]>(`/quotes${qs(p)}`),
  /* Scoped by the service to what the caller may see, never narrowed here — a
     browser-side filter on an aggregate is a filter an attacker skips. */
  getAnalytics: () => req<Analytics>('/analytics'),
  getQuote: (no) => req<Quote>(`/quotes/${encodeURIComponent(no)}`),
  decideApproval: (no, approvalId, decision, note) =>
    req<Quote>(`/quotes/${encodeURIComponent(no)}/approvals/${approvalId}`, {
      method: 'POST', body: JSON.stringify({ decision, note }),
    }),

  // The builder. Note that every one of these is a POST that returns the
  // server's own numbers — there is no endpoint that accepts a price.
  evaluateDraft: (draft) =>
    req<Evaluation>('/quotes/evaluate', { method: 'POST', body: JSON.stringify(draft) }),
  suggestItems: (r) =>
    req<SuggestResult>('/quotes/suggest', { method: 'POST', body: JSON.stringify(r) }),
  createQuote: (draft) => req<Quote>('/quotes', { method: 'POST', body: JSON.stringify(draft) }),
  saveQuote: (no, draft) =>
    req<Quote>(`/quotes/${encodeURIComponent(no)}`, { method: 'PUT', body: JSON.stringify(draft) }),
  submitQuote: (no, to, note) =>
    req<Quote>(`/quotes/${encodeURIComponent(no)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ recipientEmail: to ?? null, coveringNote: note ?? null }),
    }),
  duplicateQuote: (no) =>
    req<Quote>(`/quotes/${encodeURIComponent(no)}/duplicate`, { method: 'POST' }),
  deleteQuote: (no) =>
    req<void>(`/quotes/${encodeURIComponent(no)}`, { method: 'DELETE' }),

  markSentOutside: (no, details) =>
    req<Quote>(`/quotes/${encodeURIComponent(no)}/sent-outside`,
      { method: 'POST', body: JSON.stringify(details) }),

  markQuoteLost: (no, reason) =>
    req<Quote>(`/quotes/${encodeURIComponent(no)}/lost`,
      { method: 'POST', body: JSON.stringify({ reason }) }),
  reopenQuote: (no) =>
    req<Quote>(`/quotes/${encodeURIComponent(no)}/reopen`, { method: 'POST' }),

  getItemPromise: (itemNo, qty) =>
    req<ItemPromise>(`/items/${encodeURIComponent(itemNo)}/promise${qs({ qty })}`),
  searchCustomers: (q) => req<CustomerHit[]>(`/customers${qs({ q })}`),
  listOpenOrders: (customerNo) =>
    req<OpenOrder[]>(`/customers/${encodeURIComponent(customerNo)}/open-orders`),
};
