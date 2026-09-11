import { Fragment, useMemo, useState } from 'react';
import { api, type RuleSummary, type RuleType } from '../api';
import { useApp, useAsync } from '../state/app';
import { Empty, ErrorNote, Panel, RuleCodeChip, Segmented, Skeleton, Status, Toolbar, shortDate } from '../components/ui';

const TYPES: { value: RuleType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'requires', label: 'Requires' },
  { value: 'excludes', label: 'Excludes' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'substitution', label: 'Substitution' },
  { value: 'applicationFit', label: 'Application fit' },
  { value: 'approval', label: 'Approval' },
  { value: 'discountCap', label: 'Discount cap' },
  { value: 'note', label: 'Note' },
];

/** The open/closed marker on a group heading. */
function Caret({ open, small }: { open: boolean; small?: boolean }) {
  const n = small ? 8 : 10;
  return (
    <svg aria-hidden viewBox="0 0 10 10" width={n} height={n}
         className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
         fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 1.5 7 5 3 8.5" />
    </svg>
  );
}

export function Rules() {
  const { go, session } = useApp();
  const canEdit = session?.role === 'admin';
  const [tech, setTech] = useState('all');
  const [type, setType] = useState<RuleType | 'all'>('all');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'active' | 'all'>('active');

  const techs = useAsync(() => api.listTechnologies(), []);
  const rules = useAsync(
    () => api.listRules({ technology: tech, type, q, includeInactive: scope === 'all' }),
    [tech, type, q, scope],
  );

  /* Grouped by price book, in the order the technology list is already sorted in,
     so the groups appear in the same order everywhere in the tool. A rule with no
     technology applies to all of them and goes last, because it is the exception. */
  /* Two levels: the price book, then the kind of rule.
     A rule belongs to exactly one technology and has exactly one type, and that is
     how the business asks about them — "what does CIJ block", "what needs approval".
     One flat list of 66 made you read all of them to answer either question. */
  const grouped = useMemo(() => {
    const order = (techs.data ?? []).map((t) => t.code);
    const by = new Map<string, RuleSummary[]>();
    for (const r of rules.data ?? []) {
      const key = r.technologyCode ?? 'All technologies';
      by.set(key, [...(by.get(key) ?? []), r]);
    }
    const techOrder = ([a]: [string, unknown], [b]: [string, unknown]) => {
      if (a === 'All technologies') return 1;
      if (b === 'All technologies') return -1;
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    };
    return [...by.entries()].sort(techOrder).map(([tech, group]) => {
      const byType = new Map<string, RuleSummary[]>();
      for (const r of group) byType.set(r.ruleType, [...(byType.get(r.ruleType) ?? []), r]);
      return {
        tech,
        count: group.length,
        types: [...byType.entries()].sort(([a], [b]) => a.localeCompare(b)),
      };
    });
  }, [rules.data, techs.data]);

  /* Collapsed by key, rather than open by key: a filter that brings back a group
     nobody has touched should show it, and remembering what was folded away is the
     smaller surprise of the two. */
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const fold = (key: string) =>
    setFolded((f) => {
      const next = new Set(f);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const allKeys = grouped.flatMap((g) => [g.tech, ...g.types.map(([t]) => `${g.tech}/${t}`)]);
  const allFolded = allKeys.length > 0 && allKeys.every((k) => folded.has(k));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-display text-xl">Quoting rules</h1>
        </div>
        {/* Beside the page's own action, which is where the builder and the saved
            quote both put theirs. It was down in the filter toolbar, so the one
            control that changes the whole list sat among the ones that narrow it. */}
        <div className="flex items-center gap-2">
          <button type="button" className="btn-quiet text-xs"
                  onClick={() => setFolded(allFolded ? new Set() : new Set(allKeys))}>
            {allFolded ? 'Expand all' : 'Collapse all'}
          </button>
          {canEdit && (
            <button type="button" className="btn-primary text-sm" onClick={() => go({ name: 'newRule' })}>
              New rule
            </button>
          )}
        </div>
      </div>

      <Panel>
        <Toolbar>
          <input
            className="field max-w-xs text-sm"
            type="search"
            placeholder="Search code, wording, author…"
            aria-label="Search rules"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="field w-auto text-sm" aria-label="Technology"
                  value={tech} onChange={(e) => setTech(e.target.value)}>
            <option value="all">All technologies</option>
            {(techs.data ?? []).map((t) => (
              <option key={t.code} value={t.code}>{t.code} — {t.name}</option>
            ))}
          </select>
          <select className="field w-auto text-sm" aria-label="Rule type"
                  value={type} onChange={(e) => setType(e.target.value as RuleType | 'all')}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Segmented
            label="Scope"
            value={scope}
            onChange={setScope}
            options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'Including retired' }]}
          />
          <span className="num ml-auto text-2xs text-steel-600">
            {rules.data ? `${rules.data.length} rules` : ''}
          </span>
        </Toolbar>

        {rules.loading && <Skeleton rows={8} />}
        {rules.error && <ErrorNote message={rules.error} onRetry={rules.reload} />}

        {rules.data && rules.data.length === 0 && (
          <Empty title="No rules match that">
            Try clearing the search, or widening the technology filter. Rules that apply to every
            technology show under all of them.
          </Empty>
        )}

        {rules.data && rules.data.length > 0 && (
          <div className="overflow-x-auto">
            {/* Five columns, not seven. Source and author were columns of their own,
                and a 40-character citation took more width than the rule it cited —
                every summary wrapped to five lines. The citation now sits under the
                summary it belongs to, which is how provenance reads everywhere else
                in this tool. */}
            <table className="tbl min-w-[40rem]">
              <colgroup>
                <col className="w-[10rem]" />
                <col className="w-[7.5rem]" />
                <col />
                <col className="w-[5rem]" />
                <col className="w-[6rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>What it says, and where it came from</th>
                  <th className="n">Fired 90d</th>
                  <th className="n">Status</th>
                </tr>
              </thead>
              {/* Grouped by price book, one tbody each.
                  A rule belongs to exactly one technology and that is how the
                  business thinks about them, so 66 rules read as seven labelled
                  blocks rather than one undifferentiated list. The technology also
                  stops being repeated on every row, where it said the same thing
                  as the heading directly above it. */}
              {grouped.map(({ tech, count, types }) => {
                const techFolded = folded.has(tech);
                return (
                  <tbody key={tech}>
                    <tr className="group">
                      <th colSpan={5} scope="colgroup">
                        <button type="button" className="flex w-full items-center gap-2 text-left"
                                aria-expanded={!techFolded}
                                onClick={() => fold(tech)}>
                          <Caret open={!techFolded} />
                          {tech}
                          <span className="font-normal normal-case tracking-normal text-steel-600">
                            {count} rule{count === 1 ? '' : 's'}
                            {techFolded ? '' : ` · ${types.length} kind${types.length === 1 ? '' : 's'}`}
                          </span>
                        </button>
                      </th>
                    </tr>
                    {!techFolded && types.map(([type, group]) => {
                      const key = `${tech}/${type}`;
                      const typeFolded = folded.has(key);
                      return (
                        <Fragment key={key}>
                          <tr className="subgroup">
                            <td colSpan={5}>
                              <button type="button"
                                      className="flex w-full items-center gap-2 text-left text-2xs font-semibold text-steel-700"
                                      aria-expanded={!typeFolded}
                                      onClick={() => fold(key)}>
                                <Caret open={!typeFolded} small />
                                {TYPES.find((t) => t.value === type)?.label ?? type}
                                <span className="num font-normal text-steel-500">{group.length}</span>
                              </button>
                            </td>
                          </tr>
                          {!typeFolded && group.map((r) => (
                            <tr
                              key={r.ruleCode}
                              className="pick"
                              onClick={() => go({ name: 'rule', ruleCode: r.ruleCode })}
                            >
                              <td>
                                <RuleCodeChip code={r.ruleCode} tone={r.severity === 'block' ? 'block' : r.severity === 'warn' ? 'warn' : 'info'} />
                              </td>
                              <td className="text-steel-700">{r.ruleType}</td>
                              <td>
                                <span className="block font-medium text-steel-900">{r.summary}</span>
                                {r.effectiveTo && (
                                  <span className="mt-0.5 block text-2xs text-signal-800">
                                    ends {shortDate(r.effectiveTo)}
                                  </span>
                                )}
                                <span className="mt-1 block text-2xs leading-snug text-steel-600">
                                  <span className="num cite">{r.sourceRef ?? 'no source recorded'}</span>
                                  {r.author && <> · {r.author}</>}
                                </span>
                              </td>
                              <td className="n text-steel-700">{r.firedCount}</td>
                              <td className="stat-cell">
                                <Status compact tone={r.isActive ? 'ok' : 'muted'}>{r.isActive ? 'Active' : 'Retired'}</Status>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
