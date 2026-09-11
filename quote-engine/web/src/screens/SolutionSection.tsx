import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  api,
  type Evaluation, type FitAssessment, type Item, type NarrowingApplied,
  type QuoteDraft, type QuoteLine, type Requirement, type Rule,
} from '../api';
import { ITEM_ROLE_PLURAL } from '../api/words';
import { missingKeyFields } from '../engine/parseApplication';
import { useAsync } from '../state/app';
import {
  Caret, Empty, ErrorNote, RuleCodeChip, Skeleton, Status, fitLabel, money,
} from '../components/ui';
import { MachineHero, MachineLinks, MachineThumb } from './MachineMedia';
import { mediaFor } from '../api/media';
import { CONFIGURATORS } from '../api/configurators';
import { specsFor } from '../api/specs';
import { announcedFor } from '../api/announced';
import { PartNumberBuilder } from './PartNumberBuilder';
import { LaserConfigurator } from './LaserConfigurator';

/**
 * The solution: one machine and everything it needs.
 *
 * This was two steps — "Which machine" and "Configure the solution" — and a rep does
 * not experience it as two. They pick a coder and then find out what has to go with
 * it, and the second half was a part search with a Kind filter, which is a catalogue
 * rather than a configuration. The rules already knew what a bare machine was missing
 * and could only say so as a warning in a rail, three sections away from the parts
 * that would answer it.
 *
 * So the machine is chosen at the top and the rest of the sheet becomes a checklist
 * the machine itself generates: mounting, consumables, installation, each with the
 * rule that asks for it, its citation, and the parts that satisfy it. A requirement
 * that is met stays on the page rather than vanishing — a checklist that deletes its
 * completed items cannot be read as progress.
 *
 * The catalogue is still there, last, for a rep who already knows the part number.
 * Taking it away would make the tool slower than the spreadsheet for the person who
 * uses it most.
 */

/* Technologies whose machines are configured rather than listed.
   The laser book has no machine rows to offer because a Corvus laser has no part
   number until it is configured — so this is where the configurator goes, and the
   "nothing to offer yet" empty state was never the truth about laser. */
const CONFIGURED = new Set(CONFIGURATORS.map((c) => c.technology));

/**
 * What a complete solution needs, read off the rules rather than hard-coded.
 *
 * A structure rule that says "a printer is on the quote and nothing of kind X is"
 * names X in its own trigger. That is the requirement, and reading it here means a
 * rule written next year produces a band without anybody adding one.
 */
/* Asked of the service, not computed from a compiled-in copy of the rules.
   This walked APPLICATION_RULES, which is a constant baked into the JavaScript at
   build time. In the preview that is the whole rule set and correct; in production
   the rules live in the database and are edited from the Rules screen, so an admin
   who adds a structure rule changed nothing a rep saw until the front end was rebuilt
   and redeployed — while the Rules screen showed the new rule the whole time. Both
   looked like they were working. See api/main.py, /api/rules/requirements. */

/* ------------------------------------------------------------------ the machine */

function MachineRow({ f, chosen, onAdd, hoisted, onSeeVariants }: {
  f: FitAssessment;
  chosen: boolean;
  onAdd: () => void;
  hoisted: Set<string>;
  /** Narrow to this machine's own configurations, where it stands for several. */
  onSeeVariants?: () => void;
}) {
  const label = fitLabel(f.grade, f.reasons.length);
  const reasons = f.reasons.filter((r) => !hoisted.has(r.ruleCode));
  return (
    <li className="border-t border-rule first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 gap-3">
          <MachineThumb model={f.model} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-steel-900">{f.description}</p>
            <p className="num mt-0.5 text-2xs text-steel-600">{f.itemNo}</p>
            {/* One machine, many orderable fills. Saying so is the difference
                between "the best of 105 ways to order this printer" and a list
                that looks like 105 different printers. */}
            {(f.variants ?? 1) > 1 && (
              <p className="mt-1 text-2xs text-steel-600">
                Best fit of <span className="num">{f.variants}</span> ways to order this
                machine — printhead, ink and colour.{' '}
                {onSeeVariants && (
                  <button type="button" className="btn-inline text-2xs" onClick={onSeeVariants}>
                    See all {f.variants}
                  </button>
                )}
              </p>
            )}
            <MachineLinks model={f.model} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-right">
            <span className="readout-sm block">
              {f.listPrice != null ? money(f.listPrice) : '—'}
            </span>
            <span className="mt-0.5 block text-2xs text-steel-600">
              {f.listPrice != null ? 'list' : 'no price in Orbit'}
            </span>
          </span>
          <Status tone={label.tone}>{label.text}</Status>
          <button type="button" className="btn-primary text-2xs" disabled={chosen} onClick={onAdd}>
            {chosen ? 'Chosen' : 'Choose'}
          </button>
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="space-y-1 border-t border-steel-100 bg-steel-50 px-4 py-2">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-2xs text-steel-700">
              <RuleCodeChip code={r.ruleCode} />
              <span className="min-w-0">
                {r.text}
                {(r.author || r.sourceRef) && (
                  <span className="cite mt-0.5 block text-steel-500">
                    {r.author ?? 'author not recorded'}
                    {r.sourceRef ? ` · ${r.sourceRef}` : ' · source not recorded'}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

    </li>
  );
}

/**
 * One part in a picker: add it, or take it back off.
 *
 * `cols` differs between the two pickers — the catalogue shows the kind of part and
 * the requirement band does not, because the band is already a kind.
 */
function PickRow({ item, chosen, onAdd, onRemove, cols, extra, quantity, onQuantity }: {
  item: Item;
  chosen: boolean;
  onAdd: (itemNo: string) => void;
  onRemove: (itemNo: string) => void;
  cols: string;
  extra?: React.ReactNode;
  /** How many are on the quote, when it is on the quote. */
  quantity?: number;
  onQuantity?: (itemNo: string, q: number) => void;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-xs text-steel-900">{item.description}</span>
        <span className="num block truncate text-2xs text-steel-600">{item.itemNo}</span>
      </span>
      {extra}
      <span className="num text-right text-2xs text-steel-800">{money(item.listPrice)}</span>
    </>
  );

  if (chosen) {
    return (
      <li>
        <div className={`grid ${cols} items-center gap-3 bg-fit-100/40 px-3 py-2 text-left`}>
          {body}
          {/* The count, where the part is.
              REPORTED: "currently the only way to add more than one of a part is
              through the quote lines on the right pane. You should be able to add
              more on the configurator lines themselves." A rep choosing four brackets
              is looking at the brackets. */}
          <span className="flex items-center justify-end gap-2 text-right">
            {onQuantity && (
              <label className="flex items-center gap-1">
                <span className="sr-only">Quantity of {item.description}</span>
                <input type="number" min={1} inputMode="numeric" value={quantity ?? 1}
                       className="field num w-14 px-1.5 py-0.5 text-2xs"
                       onChange={(e) => onQuantity(item.itemNo, Number(e.target.value))} />
              </label>
            )}
            <button type="button" className="btn-inline text-2xs text-alert-700"
                    onClick={() => onRemove(item.itemNo)}
                    aria-label={`Remove ${item.description} from the quote`}>
              Remove
            </button>
          </span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <button type="button" onClick={() => onAdd(item.itemNo)}
              className={`pick grid w-full ${cols} items-center gap-3 px-3 py-2 text-left`}>
        {body}
        <span className="text-right text-2xs font-semibold text-instr-700">Add</span>
      </button>
    </li>
  );
}

/**
 * What axim.example says about the machine that has been chosen.
 *
 * The portfolio supplied a thumbnail and a link and nothing else while carrying full
 * specification tables. A rep who has committed to a machine is about to defend it to
 * a customer, and the figures that answer "why this one" were a page away.
 *
 * Folded by default: this is reference, not the decision. Six rows open, because six
 * is what fits beside the photograph without the section growing a scrollbar.
 */
/**
 * One place a rep looks for the specification, whatever form we hold it in.
 *
 * REPORTED: "why do some items have a datasheet link, and others have the datasheet
 * in the app?" Because two components answered the same question from two different
 * sources and neither knew about the other — MachineSpecs rendered a table for the
 * 22 models whose product page was captured, and MachineLinks rendered a PDF link for
 * the models with a published datasheet. Different machines have different
 * combinations of the two, so the answer moved around the card depending on which
 * machine you were looking at.
 *
 * It is one block now, in one position, and it always says the same three things in
 * the same order: what we can state here, where it came from, and what else exists to
 * open. A machine we hold nothing for says so, rather than showing nothing and
 * leaving a rep to wonder whether the panel failed to load.
 */
function MachineSpecs({ model }: { model?: string | null }) {
  const [open, setOpen] = useState(false);
  const found = specsFor(model);
  const media = mediaFor(model);
  if (!found && !media) return null;
  const rows = found ? Object.entries(found.specs) : [];
  const shown = open ? rows : rows.slice(0, 6);

  return (
    <div className="mt-2">
      {rows.length > 0 && (
        <dl className="divide-y divide-steel-100 border-t border-steel-100">
          {shown.map(([k, v]) => (
            <div key={k}
                 className="grid grid-cols-1 gap-x-3 py-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="text-2xs text-steel-600">{k}</dt>
              <dd className="text-2xs text-steel-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
        {rows.length > 6 && (
          <button type="button" className="btn-inline text-2xs"
                  onClick={() => setOpen((v) => !v)}>
            {open ? 'Fewer' : `All ${rows.length}`}
          </button>
        )}
        {rows.length === 0 && (
          /* Said plainly. The alternative is an empty space where the table is on
             every other machine, which reads as a bug rather than as an absence. */
          <span className="text-steel-600">
            No specification captured for this model — the source is below.
          </span>
        )}
        {media?.page && <DocLink href={media.page} title={media.name}>product page</DocLink>}
        {media?.specUrl && (
          <DocLink href={media.specUrl} title={`${media.name} specifications`}>
            specifications
          </DocLink>
        )}
        {media?.docUrl && (
          <DocLink href={media.docUrl} title={media.doc ?? undefined}>
            {media.docKind === 'specification' ? 'specifications' : `${media.docKind ?? 'document'} (PDF)`}
          </DocLink>
        )}
        {media?.brochureUrl && (
          <DocLink href={media.brochureUrl} title={media.brochure ?? undefined}>
            brochure (PDF)
          </DocLink>
        )}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- a requirement band */

/**
 * One link out to the manufacturer, labelled as what it actually is.
 *
 * REPORTED: "The TIJ datasheet link is taking me to the product page instead of the
 * datasheet... Same issue with a lot of the datasheet links." The link was wrong
 * because the capture had missed the documents, and the LABEL was wrong for a second
 * reason that would have outlived the fix: everything here was called "datasheet
 * (PDF)" whether it was a datasheet, a brochure, or a vendor's specifications web
 * page. A rep who clicks "datasheet" and gets a brochure sends the customer a
 * brochure. So the kind travels with the link — see ModelMedia.docKind.
 */
function DocLink({ href, title, children }: {
  href: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={title}
       className="text-steel-600 underline decoration-steel-300 hover:text-instr-700">
      {children}
    </a>
  );
}

/**
 * A machine the manufacturer has announced and Orbit cannot yet price.
 *
 * REPORTED: "Also you can add the corvus 9000 series. Here is the brochure / specs /
 * datasheet." It is added — here rather than in the machine list, because there is no
 * Orbit part number for it and no price. Putting it in the list would mean inventing
 * a part number, and an invented part number reaches a customer's quote; a rep asked
 * "do you sell the 7340 yet?" is better served by the real answer and the real
 * brochure than by a row that looks orderable and is not.
 *
 * It disappears on its own: the moment the parts appear on a price page they come
 * through the catalogue like every other machine, and this entry is deleted.
 */
function AnnouncedSeriesNote({ technologyCode }: { technologyCode?: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const series = announcedFor(technologyCode);
  if (series.length === 0) return null;

  return (
    <>
      {series.map((a) => (
        <div key={a.name} className="border-t border-rule bg-steel-50 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-steel-900">{a.name}</p>
            <Status inline tone="muted">announced {a.announced} · not orderable</Status>
          </div>
          <p className="mt-1 text-2xs text-steel-700">{a.summary}</p>
          {/* The reason, in the place a rep asks the question. Without it this reads
              as a machine the tool failed to load. */}
          <p className="mt-1 text-2xs text-steel-600">{a.whyNotQuotable}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
            <DocLink href={a.page} title={a.name}>product page</DocLink>
            {a.documents.map((d) => (
              <DocLink key={d.url} href={d.url} title={d.name}>
                {d.kind === 'specification' ? 'specifications' : `${d.kind} (PDF)`}
              </DocLink>
            ))}
            {a.models.map((m) => (
              <button key={m} type="button" className="btn-inline num text-2xs"
                      aria-expanded={open === m}
                      onClick={() => setOpen((v) => (v === m ? null : m))}>
                {m}
              </button>
            ))}
          </p>
          {/* The 7300 is composed rather than picked, like the laser. A rep cannot
              order one yet, but the number is what they need to ask for a price. */}
          {a.technologyCode === 'CIJ' && <PartNumberBuilder />}
          {open && specsFor(open) && (
            <div className="mt-2 border-t border-steel-200 pt-2">
              <p className="num text-2xs font-semibold text-steel-900">{open}</p>
              <dl className="mt-1 divide-y divide-steel-200">
                {Object.entries(specsFor(open)!.specs).map(([k, v]) => (
                  <div key={k}
                       className="grid grid-cols-1 gap-x-3 py-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
                    <dt className="text-2xs text-steel-600">{k}</dt>
                    <dd className="text-2xs text-steel-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * What the application ruled out before anything was graded.
 *
 * ASKED: "Do the rules drive the application fit logic or is there a hidden layer in
 * code?" Grading was always entirely rule-driven. This was the hidden layer: two
 * comparisons that removed candidates before any rule saw them, with no rule code, no
 * citation and nothing on the screen. A machine the enquiry ruled out was simply
 * absent, and on a porous black-ink enquiry that was 284 of 947 CIJ configurations.
 *
 * It still narrows rather than grades — 284 rows marked NOT RECOMMENDED is the noise
 * the narrowing exists to remove, and grading them would re-break the counts that
 * "VIJ says 8 good when there's only 4" was reported about. What it does now is say
 * so, in the same shape as every other decision: a rule code, a sentence, and the
 * document the judgement came from.
 *
 * Two numbers where the list collapses configurations, because there the honest
 * answer is two numbers: no machine disappeared AND 284 ways to order one did.
 */
function NarrowedNote({ narrowed }: { narrowed?: NarrowingApplied[] }) {
  const [open, setOpen] = useState(false);
  if (!narrowed?.length) return null;

  return (
    <div className="border-t border-rule bg-steel-50 px-4 py-2">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xs text-steel-700">
        <span className="font-semibold text-steel-900">The application narrowed this list.</span>
        <button type="button" className="btn-inline text-2xs" aria-expanded={open}
                onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide the detail' : `${narrowed.length} rule${narrowed.length === 1 ? '' : 's'}`}
        </button>
      </p>
      {open && (
        <ul className="mt-1.5 space-y-1.5">
          {narrowed.map((n) => (
            <li key={n.ruleCode} className="flex items-start gap-2 text-2xs text-steel-700">
              <RuleCodeChip code={n.ruleCode} />
              <span className="min-w-0">
                {n.summary}
                <span className="mt-0.5 block text-steel-600">
                  {n.matched === 'porous' || n.matched === 'nonPorous'
                    ? `The enquiry says ${n.matched === 'porous' ? 'porous' : 'non-porous'}. `
                    : `The enquiry asks for ${n.matched}. `}
                  {describeRemoval(n)}
                </span>
                <span className="cite mt-0.5 block text-steel-500">
                  {n.author ?? 'author not recorded'}
                  {n.sourceRef ? ` · ${n.sourceRef}` : ' · source not recorded'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        /* The answer to "so how do I see them?", which a note that only explains
           leaves a rep to work out. The catalogue below is deliberately unnarrowed —
           it is the answer to "I know exactly what I want and it is not on your
           list" — so the way back is one sentence away rather than a support call. */
        <p className="mt-1.5 text-2xs text-steel-600">
          Nothing is lost: the whole catalogue below is unfiltered, and anything
          narrowed out here can still be searched and added by hand.
        </p>
      )}
    </div>
  );
}

/** "1 row, and 284 ways to order the machines that stayed." */
function describeRemoval(n: NarrowingApplied): string {
  const rows = n.removed ?? 0;
  const options = n.removedOptions ?? 0;
  const row = `${rows} ${rows === 1 ? 'row' : 'rows'}`;
  if (rows === 0 && options > 0) {
    // Every machine survived; what went is configurations of the machines shown.
    return `No machine was removed, but ${options} ways to order the ones shown were.`;
  }
  if (options > rows) {
    return `Removed ${row}, and ${options} orderable configurations in total.`;
  }
  return `Removed ${row}.`;
}

function RequirementBand({ req, draft, satisfiedBy, onAdd, onRemove, book }: {
  req: Requirement;
  draft: QuoteDraft;
  /** The price book this solution is for. */
  book: string;
  satisfiedBy: Item[];
  onAdd: (itemNo: string) => void;
  onRemove: (itemNo: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const met = satisfiedBy.length > 0;

  /* Candidates are fetched only when the band is opened. Three bands each pulling a
     catalogue on mount is three requests a rep never asked for, on a screen that is
     already evaluating the quote on every keystroke. */
  const candidates = useAsync(
    () => (open
      ? api.searchItems({ technology: book, role: req.role, limit: 60 })
      : Promise.resolve([] as Item[])),
    [open, book, req.role],
  );
  const chosen = new Set(draft.lines.map((l) => l.itemNo));
  const list = candidates.data ?? [];

  return (
    <div className="border-t border-rule">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3 pb-1
                      text-2xs font-semibold uppercase tracking-wider text-instr-800">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 shrink-0 ${met ? 'bg-fit-600' : 'bg-signal-600'}`}
          />
          {ITEM_ROLE_PLURAL[req.role] ?? req.role}
        </span>
        <span className={`text-2xs font-semibold normal-case tracking-normal ${
          met ? 'text-fit-800' : 'text-signal-800'}`}>
          {met
            ? `${satisfiedBy.length} on the quote`
            : 'Nothing on the quote yet'}
        </span>
      </div>

      <div className="px-4 pb-3">
        {/* The rule's sentence is a complaint — "no mount on this quote" — so it is
            shown while that is true and dropped once it is not. The chip stays either
            way, because a rep asked why installation is on the quote still needs the
            rule that put it there. */}
        {met ? (
          <p className="flex items-center gap-2 text-2xs text-steel-600">
            <RuleCodeChip code={req.ruleCode} tone="ok" />
            <span>Answered.</span>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-2xs leading-snug text-steel-700">
            <RuleCodeChip code={req.ruleCode} tone="warn" />
            <span className="min-w-0">
              {req.summary}
              <span className="cite mt-0.5 block text-steel-500">
                {req.author ?? 'author not recorded'}
                {req.sourceRef ? ` · ${req.sourceRef}` : ' · source not recorded'}
              </span>
            </span>
          </p>
        )}

        {met && (
          <ul className="mt-2 divide-y divide-steel-100 border border-fit-200 bg-fit-100/40">
            {satisfiedBy.map((i) => (
              <li key={i.itemNo} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate text-xs text-steel-900">{i.description}</span>
                  <span className="num block text-2xs text-steel-600">{i.itemNo}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="num text-2xs text-steel-700">{money(i.listPrice)}</span>
                  {/* Where the line is, rather than only in the rail across the
                      screen. This band knows what the part is FOR, so it is the
                      place a rep decides they were wrong about it. */}
                  <button type="button" className="btn-inline text-2xs text-alert-700"
                          onClick={() => onRemove(i.itemNo)}
                          aria-label={`Remove ${i.description} from the quote`}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="btn-quiet mt-2 text-2xs"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : met ? `Add another ${req.role}` : `Choose a ${req.role}`}
        </button>

        {open && (
          <div className="mt-2 border border-rule">
            {candidates.loading && <Skeleton rows={3} />}
            {candidates.error && (
              <ErrorNote message={candidates.error} onRetry={candidates.reload} />
            )}
            {candidates.data && list.length === 0 && (
              <p className="px-3 py-6 text-center text-2xs text-steel-600">
                The {book} book has nothing of this kind yet.
              </p>
            )}
            {list.length > 0 && (
              <ul className="max-h-72 divide-y divide-steel-100 overflow-y-auto">
                {list.map((i) => (
                  <PickRow key={i.itemNo} item={i} chosen={chosen.has(i.itemNo)}
                           onAdd={onAdd} onRemove={onRemove}
                           cols="grid-cols-[minmax(0,1fr)_6rem_5rem]" />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- the catalogue */

/** Where a "find me a mount" finding scrolls to. */
/**
 * Everything on a quote that is not the machine, in the order a solution is built.
 *
 * Print head before ink before the parts that hold it up, then what wears out, then
 * what covers it. `promo` and `part` are deliberately absent: a promotion is not a
 * companion to anything, and "Other part" is where classification gave up — offering
 * it here would fill the panel with the catalogue's unsorted remainder.
 */
const COMPANION_ROLES = [
  'printhead', 'ink', 'accessory', 'consumable', 'spare', 'service', 'warranty',
];

export const CATALOGUE_ANCHOR = 'parts-catalogue';

/**
 * What the application implies, grouped by what kind of thing it is.
 *
 * Split out of the machine panel and into the catalogue section, because a rep
 * assembling the rest of a quote was being offered two lists — this one, which knew
 * the application, and the catalogue below, which knew everything — with no way to
 * tell which was which. One place, ordered: the smart answer first, the whole book
 * behind it.
 */
function WhatGoesWithIt({ items, machineLines, chosen, skip, openRole, setOpenRole, onAdd }: {
  items: FitAssessment[] | null;
  machineLines: QuoteLine[];
  chosen: Set<string>;
  /** Roles a requirement band above has already covered. */
  skip: Set<string>;
  openRole: string | null;
  setOpenRole: (r: string | null) => void;
  onAdd: (itemNo: string) => void;
}) {
  if (!items?.length) return null;
  return (
    <>
          {/* ---- and what goes with it ------------------------------------- */}
          {items.length > 0 && (() => {
            const found = items;
            const byRole = new Map<string, typeof found>();
            for (const f of found) {
              const role = f.itemRole ?? 'part';
              if (chosen.has(f.itemNo)) continue;
              (byRole.get(role) ?? byRole.set(role, []).get(role)!).push(f);
            }
            /* Parts that name a machine on the quote, first.
               The engine ranks on fit, then on how often a part is really ordered —
               and the preview has no order history, so a 49-strong accessory list
               came back in part-number order with an 6440 service kit at the top of
               a quote for an 6400. The model is on the part description and on the
               quote; using it is reading what is already there, not guessing. */
            const models = machineLines.map((l) => l.model).filter(Boolean) as string[];
            const forOurs = (d: string) => (models.some((m) => d.includes(m)) ? 0 : 1);
            const groups = COMPANION_ROLES
              .filter((r) => !skip.has(r))
              .map((r) => [r, (byRole.get(r) ?? []).slice().sort(
                (x, y) => forOurs(x.description) - forOurs(y.description))] as const)
              .filter(([, list]) => list.length);
            if (!groups.length) return null;
            return (
              <div>
                <ul className="divide-y divide-steel-100">
                  {groups.map(([role, list]) => (
                    <li key={role}>
                      <button type="button"
                              aria-expanded={openRole === role}
                              onClick={() => setOpenRole(openRole === role ? null : role)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-navy-50">
                        <span className="flex items-center gap-2">
                          <Caret open={openRole === role} />
                          <span className="text-sm font-semibold text-steel-900">
                            {ITEM_ROLE_PLURAL[role] ?? role}
                          </span>
                        </span>
                        <span className="num text-2xs text-steel-600">{list.length}</span>
                      </button>
                      {openRole === role && (
                        <ul className="divide-y divide-steel-100 border-t border-steel-100">
                          {list.slice(0, 12).map((f) => (
                            <li key={f.itemNo}
                                className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5 pl-10">
                              <span className="min-w-0">
                                <span className="block text-xs text-steel-900">{f.description}</span>
                                <span className="num block text-2xs text-steel-600">{f.itemNo}</span>
                                {/* Only when a rule actually said something. Silence
                                    here means nothing is known, not that it is fine. */}
                                {f.reasons.map((r) => (
                                  <span key={r.ruleCode} className="mt-0.5 block text-2xs text-instr-800">
                                    {r.text}
                                  </span>
                                ))}
                              </span>
                              <span className="flex shrink-0 items-baseline gap-3">
                                {f.listPrice != null && (
                                  <span className="num text-2xs text-steel-600">{money(f.listPrice)}</span>
                                )}
                                <button type="button" className="btn-quiet text-2xs"
                                        onClick={() => onAdd(f.itemNo)}>
                                  Add
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
    </>
  );
}

function Catalogue({ draft, onAdd, onRemove, role, setRole, withIt, machineLines,
                    requirements, satisfiers, quantityOf, onQuantity, book }: {
  draft: QuoteDraft;
  /** The price book this solution is for; the search never leaves it. */
  book: string;
  onAdd: (itemNo: string) => void;
  onRemove: (itemNo: string) => void;
  role: string;
  setRole: (r: string) => void;
  /** Graded companions for the machine already chosen, or null before one is. */
  withIt: FitAssessment[] | null;
  machineLines: QuoteLine[];
  /** Roles a structure rule is asking about, read off the rules themselves. */
  requirements: Requirement[];
  satisfiers: Map<string, Item[]>;
  quantityOf: (itemNo: string) => number | undefined;
  onQuantity: (itemNo: string, q: number) => void;
}) {
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(12);
  const [open, setOpen] = useState(false);

  // Opened automatically when a finding sent the rep here for a particular kind.
  useEffect(() => { if (role) setOpen(true); }, [role]);

  const [category, setCategory] = useState('');
  const results = useAsync(
    () => (open && book
      ? api.searchItems({ q, role: role || undefined, category: category || undefined,
                          technology: book, limit })
      : Promise.resolve([] as Item[])),
    [open, q, role, category, limit, book],
  );
  /* What kinds of part this book actually holds.
     Asked for by the sales team: an "accessory" is 145 things on the PALM book, and
     knowing that much does not help anybody quote. The list is counted from the
     catalogue rather than written down, so a rep is never offered a filter that
     returns nothing. */
  const cats = useAsync(
    () => (open && book
      ? api.listCategories(book)
      : Promise.resolve([] as { category: string; count: number }[])),
    [open, book],
  );
  // Only the book changing resets it. Keying this on  as well meant the two
  // chip rows fought each other: setRole('') from a category click cleared the very
  // category that click had just set.
  useEffect(() => { setCategory(''); }, [book]);
  const chosen = new Set(draft.lines.map((l) => l.itemNo));
  const list = results.data ?? [];

  const KINDS = [
    { value: '', label: 'Everything' },
    { value: 'printer', label: 'Machines' },
    { value: 'printhead', label: 'Print heads' },
    { value: 'consumable', label: 'Consumables' },
    { value: 'accessory', label: 'Accessories' },
    { value: 'spare', label: 'Spares' },
    { value: 'service', label: 'Service' },
    { value: 'part', label: 'Other parts' },
  ];

  return (
    /* Named, because a finding on a saved quote scrolls here.
       "No mount on this quote" opens the builder with the catalogue filtered to
       accessories — and the scroll used to land on the whole solution section, which
       starts at the machine chooser several screens above this. */
    <section className="band" id={CATALOGUE_ANCHOR}>
      <div className="band-legend">
        <span>{machineLines.length ? 'What goes with it' : 'Anything else'}</span>
      </div>

      {/* The fast path, above the search box.
          REPORTED: "the What goes with it section looks to be a more inclusive
          duplicate of the accessories consumables service section, incorporate the
          good things from both into one."

          It was two sections doing one job: a suggestion list that knew the
          application and a catalogue that knew everything. They are one section now
          — what the application implies, first and grouped, with the whole book one
          click away underneath. The catalogue is still unfiltered: it is the answer
          to "I know exactly what I want and it is not on your list", and narrowing
          it would take that away. */}
      {/* The roles a rule is actually asking about, first and with the rule attached.
          These carry the one thing a plain list cannot — WHY this kind of part is
          being suggested, and whether the quote has answered it yet. */}
      {requirements.map((req) => (
        <RequirementBand key={req.ruleCode} req={req} draft={draft} book={book}
                         satisfiedBy={satisfiers.get(req.role) ?? []} onAdd={onAdd}
                         onRemove={onRemove} />
      ))}

      {/* Then everything else the book holds for this machine. Roles a rule already
          asked about are left out rather than listed twice — the duplication that
          was reported. */}
      <WhatGoesWithIt items={withIt} machineLines={machineLines} chosen={chosen}
                      skip={new Set(requirements.map((r) => r.role))}
                      openRole={openRole} setOpenRole={setOpenRole} onAdd={onAdd} />
      {/* Its own header, immediately above its own panel.
          REPORTED: "the catalogue sits right under the spares section which kind of
          looks like it's showing the spares, and the button to open it is far away
          from the catalogue so it's not very intuitive."

          Both true, and the same cause: the control was in the section legend and
          the panel opened five folds below it, so pressing the button appeared to do
          nothing and what did open had no heading of its own. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1
                      border-t-2 border-rule px-4 pt-3 pb-1">
        <span className="text-2xs font-semibold uppercase tracking-wider text-instr-800">
          The whole catalogue
        </span>
        <button type="button" className="btn-quiet text-2xs" aria-expanded={open}
                onClick={() => setOpen((v) => !v)}>
          {open ? 'Close it' : `Search all of ${book}`}
        </button>
      </div>
      {!open && (
        <p className="px-4 pb-3 text-2xs text-steel-600">
          Every part in the book, including the ones the application did not suggest.
        </p>
      )}
      {open && (
        <div className="px-4 pb-3">
          <input
            className="field max-w-sm text-sm" type="search" aria-label="Find a part"
            placeholder="Part number, description, ink, colour…"
            value={q} onChange={(e) => { setQ(e.target.value); setLimit(12); }}
          />
          <p className="mt-2 text-2xs text-steel-600">
            Narrow by kind, or by category. Picking one clears the other — they are
            different cuts of the same catalogue, not two filters to combine.
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Kind of part">
            {KINDS.map((k) => {
              const on = role === k.value;
              return (
                <button key={k.value} type="button" data-tap="chip" aria-pressed={on}
                        onClick={() => {
                          // Symmetrical: a kind that cannot contain the chosen
                          // category drops it, rather than showing nothing.
                          setRole(k.value);
                          setCategory('');
                          setLimit(12);
                        }}
                        className={`rounded border px-2.5 py-1 text-2xs transition-colors ${
                          on ? 'border-instr-600 bg-instr-100 font-semibold text-instr-800'
                             : 'border-rule bg-surface text-steel-700 hover:border-instr-400'}`}>
                  {k.label}
                </button>
              );
            })}
          </div>

          {/* A second row, under the kinds. Narrowing by role first and then by
              category is how a rep actually thinks about it — "an accessory, and
              specifically a stand" — and the counts make the shape of the book
              visible before anything is clicked. */}
          {(cats.data?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Category">
              <button type="button" data-tap="chip" aria-pressed={category === ''}
                      onClick={() => { setCategory(''); setLimit(12); }}
                      className={`rounded border px-2.5 py-1 text-2xs transition-colors ${
                        category === ''
                          ? 'border-instr-600 bg-instr-100 font-semibold text-instr-800'
                          : 'border-rule bg-surface text-steel-700 hover:border-instr-400'}`}>
                Any category
              </button>
              {cats.data!.map((c) => (
                <button key={c.category} type="button" data-tap="chip"
                        aria-pressed={category === c.category}
                        onClick={() => {
                          /* Clearing the kind is the point.
                             REPORTED: "those extra categories need to auto change the
                             top filter to everything. If I have machines selected it
                             isn't going to show me anything under the rest of the
                             categories I click through."

                             The two rows are ANDed, and almost every pair of them is
                             empty — Machines AND Ribbon is nothing, and a rep clicking
                             through categories with Machines still lit gets an empty
                             list every time and concludes the catalogue is broken. A
                             category is the more specific of the two, so it wins. */
                          setRole('');
                          setCategory(c.category);
                          setLimit(12);
                        }}
                        className={`rounded border px-2.5 py-1 text-2xs transition-colors ${
                          category === c.category
                            ? 'border-instr-600 bg-instr-100 font-semibold text-instr-800'
                            : 'border-rule bg-surface text-steel-700 hover:border-instr-400'}`}>
                  {c.category}
                  <span className="num ml-1 text-steel-500">{c.count}</span>
                </button>
              ))}
            </div>
          )}

          {results.loading && <Skeleton rows={3} />}
          {results.error && <ErrorNote message={results.error} onRetry={results.reload} />}
          {results.data && list.length === 0 && (
            <p className="mt-3 text-2xs text-steel-600">
              Nothing in {book} matches that.
            </p>
          )}
          {list.length > 0 && (
            <ul className="mt-2 divide-y divide-steel-100 border border-rule">
              {list.map((i) => (
                <PickRow key={i.itemNo} item={i} chosen={chosen.has(i.itemNo)}
                         onAdd={onAdd} onRemove={onRemove}
                         quantity={quantityOf(i.itemNo)} onQuantity={onQuantity}
                         cols="grid-cols-[minmax(0,1fr)_6rem_6rem_5rem]"
                         extra={<span className="truncate text-2xs text-steel-600">
                           {i.category ?? i.itemRole}
                         </span>} />
              ))}
            </ul>
          )}
          {results.data && list.length >= limit && (
            <button type="button" className="btn-quiet mt-2 text-2xs"
                    onClick={() => setLimit((n) => n + 20)}>
              Show more
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- the whole step */

export function SolutionBody({ draft, patch, ev, hint, role, setRole, chooser, book,
                              solutionId }: {
  draft: QuoteDraft;
  /**
   * Which station this is.
   *
   * Every line read or written below is scoped to it. Scoping by price book was
   * enough while a solution WAS a book; two stations sharing one would otherwise
   * add to each other's lines, and removing a part from one would take it from both.
   */
  solutionId: string;
  /**
   * The price book THIS solution is for.
   *
   * A quote can carry a coder at one station and an applicator at another, so a
   * solution owns its book rather than reading the quote's. Everything below is scoped
   * to it: the machine, what goes with it, the requirements, and the part search — which
   * is why the search needs no book selector of its own.
   */
  book: string;
  patch: (p: Partial<QuoteDraft>) => void;
  ev: Evaluation | null;
  hint: string | null;
  role: string;
  setRole: (r: string) => void;
  /** The price-book chooser, passed in so this file does not own that decision. */
  chooser: React.ReactNode;
}) {
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(6);

  const resolved = !!book;
  const itemsBy = useMemo(
    () => new Map((ev?.lines ?? []).map((l) => [l.itemNo, l])), [ev]);

  /* Which machines are on the quote. The role comes from the priced line, so an item
     reclassified since the quote was saved is read the way it is classified now. */
  /* This solution's lines, by the station they were added to rather than by their
     price book. A section showing another station's machine under its own heading is
     worse than showing none — and two stations on the same book would show each
     other's everything. */
  const mine = (ev?.lines ?? []).filter((l) => l.solutionId === solutionId);
  const machineLines = mine.filter((l) => l.itemRole === 'printer');
  const hasMachine = machineLines.length > 0;

  const s = useAsync(
    () => (resolved && !hasMachine
      ? api.suggestItems({
          technologyCode: book, profile: draft.profile,
          attributes: attrs, q, limit,
        })
      : Promise.resolve(null)),
    [resolved, hasMachine, book, JSON.stringify(draft.profile),
      JSON.stringify(attrs), q, limit],
  );

  /* What goes with it.
     REPORTED: "it is currently only suggesting the machine through the application,
     it should also be able to suggest accessories / consumables."

     The panel above answers "which machine" and then stops — `!hasMachine` — so the
     tool did the thinking on the hardest decision and went quiet for the ink, the
     photocell, the bracket and the service kit, which between them are most of the
     lines on a real quote. This asks the same question of everything else in the
     book, in the context of the machine already chosen, so a rule about the machine
     can speak for the parts that go with it. */
  const [openRole, setOpenRole] = useState<string | null>(null);
  const withIt = useAsync(
    () => (resolved && hasMachine
      ? api.suggestItems({
          technologyCode: book, profile: draft.profile,
          roles: COMPANION_ROLES, lines: draft.lines, limit: 60,
        })
      : Promise.resolve(null)),
    [resolved, hasMachine, book, JSON.stringify(draft.profile),
      JSON.stringify(draft.lines)],
  );

  useEffect(() => { setAttrs({}); setQ(''); setLimit(6); }, [book]);
  useEffect(() => { if (hint) { setQ(hint); setLimit(6); } }, [hint]);

  /* Every line operation names the station as well as the part.
     Two solutions may quote the same printhead, and by item number alone adding it at
     one station would look like it was already at the other, and removing it from one
     would take it off both. */
  const isMine = (l: { itemNo: string; solutionId?: string | null }, itemNo: string) =>
    l.itemNo === itemNo && (l.solutionId ?? null) === solutionId;
  const add = (itemNo: string) =>
    patch({ lines: [...draft.lines, { itemNo, quantity: 1, solutionId }] });
  const removeItem = (itemNo: string) =>
    patch({ lines: draft.lines.filter((l) => !isMine(l, itemNo)) });
  /* Zero removes, which is what the rail already does — one behaviour for one
     control, wherever it appears. */
  const setQuantity = (itemNo: string, q: number) =>
    patch({
      lines: q <= 0
        ? draft.lines.filter((l) => !isMine(l, itemNo))
        : draft.lines.map((l) => (isMine(l, itemNo) ? { ...l, quantity: q } : l)),
    });

  const chosen = new Set(
    draft.lines.filter((l) => (l.solutionId ?? null) === solutionId).map((l) => l.itemNo));
  const shown = s.data?.items ?? [];
  const total = s.data?.total ?? 0;
  const facets = s.data?.facets ?? {};
  const active = Object.entries(attrs).filter(([, v]) => v);

  /* A rule true of every machine shown is a statement about the technology, not a
     distinction between them. Said once, above the list. */
  const hoisted = useMemo(() => {
    if (shown.length < 3) return new Set<string>();
    const counts = new Map<string, number>();
    for (const f of shown) {
      for (const r of f.reasons) counts.set(r.ruleCode, (counts.get(r.ruleCode) ?? 0) + 1);
    }
    return new Set([...counts.entries()]
      .filter(([, n]) => n === shown.length).map(([c]) => c));
  }, [shown]);

  /* From the service, so a rule an admin wrote this morning produces a band this
     afternoon rather than at the next front-end deploy. */
  const reqs = useAsync(
    () => (resolved && book
      ? api.listRequirements(book)
      : Promise.resolve([] as Requirement[])),
    [resolved, book],
  );
  const requirements = reqs.data ?? [];

  /* What already satisfies each requirement, read from the priced lines. */
  const satisfiers = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const l of mine) {
      if (!l.itemRole || l.itemRole === 'printer') continue;
      const list = m.get(l.itemRole) ?? [];
      list.push({ itemNo: l.itemNo, description: l.description, listPrice: l.listPrice } as Item);
      m.set(l.itemRole, list);
    }
    return m;
  }, [ev]);

  const missing = missingKeyFields(draft.profile, draft.noConstraint ?? []);

  if (!resolved) {
    return (
      <>
        {chooser}
        <Empty title="Pick a price book, or let the enquiry pick one">
          Paste the customer&rsquo;s email into the application above and the technology
          usually follows from how they describe the job. Choose one here if you already
          know what you are selling.
        </Empty>
      </>
    );
  }

  return (
    <>
      {chooser}

      {/* ---- the machine ------------------------------------------------- */}
      {hasMachine ? (
        <section className="band">
          <div className="band-legend">
            <span>The machine</span>
            <span className="text-2xs font-semibold normal-case tracking-normal text-fit-800">
              {machineLines.length === 1 ? 'chosen' : `${machineLines.length} chosen`}
            </span>
          </div>
          <ul className="divide-y divide-steel-100">
            {machineLines.map((l) => (
              <li key={l.itemNo}
                  className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
                {/* REPORTED: "mobile layout gets messed up after you select a
                    machine". The photograph is a fixed 200px well that may not
                    shrink, so beside the text on a 375px screen it left the text
                    column 61px wide — and the specification table underneath has a
                    9rem label column, which then hung 83px off the side of the page.
                    Side by side is a desk layout; a phone stacks them. */}
                <div className="flex min-w-0 flex-wrap gap-4">
                  <MachineHero model={l.model} />
                  {/* basis-64 rather than a breakpoint: what matters is whether the
                      text has room beside a 200px photograph, and that depends on how
                      wide this CARD is — which a viewport breakpoint only guesses at.
                      At 768px the guess was wrong in the other direction and left the
                      specification 91px for its values. Asking for 16rem and letting
                      the row wrap when it cannot have it is the same rule at every
                      width. */}
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-base font-semibold leading-snug text-steel-900">
                      {l.description}
                    </p>
                    <p className="num mt-1 text-xs text-steel-600">{l.itemNo}</p>
                    <MachineLinks model={l.model} />
                    <MachineSpecs model={l.model} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="readout-light text-xl">{money(l.extendedNet)}</span>
                  <span className="text-2xs text-steel-600">on the quote</span>
                  <button type="button" className="btn-quiet mt-1 text-2xs"
                          onClick={() => removeItem(l.itemNo)}>
                    Choose another
                  </button>
                </div>
              </li>
            ))}
          </ul>

        </section>
      ) : CONFIGURED.has(book) ? (
        /* Configured, not chosen from a list. */
        <LaserConfigurator
          chosen={draft.lines[0]?.itemNo ?? null}
          onChoose={async (partNo, description, listPrice, model) => {
            /* Registered before it is quoted: the engine prices from the catalogue,
               and until this moment there was no such part number anywhere.

               `model` is the machine the datasheets name — CSL60, FSL20 — not the
               first three characters of the part number, which is what it was and
               which matched none of the fifteen laser rules. */
            await api.addConfiguredItem({
              itemNo: partNo, description, technologyCode: book,
              listPrice, model,
            });
            add(partNo);
          }}
        />
      ) : (
        <section className="band">
          <div className="band-legend">
            <span>The machine</span>
            {s.data && (
              <span className="num text-2xs font-normal normal-case tracking-normal text-steel-600">
                {total === 0 ? 'none' : `${Math.min(shown.length, total)} of ${total}`}
              </span>
            )}
          </div>

          <div className="px-4 pb-3">
            <div className="flex flex-wrap items-end gap-2">
              <input
                className="field max-w-xs text-sm" type="search" aria-label="Narrow the machines"
                placeholder="Part number, model or ink…"
                value={q} onChange={(e) => { setQ(e.target.value); setLimit(6); }}
              />
              {Object.entries(facets).map(([name, values]) => (
                <label key={name} className="min-w-0">
                  <span className="label">{name}</span>
                  <select className="field mt-0.5 max-w-[12rem] py-1 text-xs"
                          value={attrs[name] ?? ''}
                          onChange={(e) => {
                            setAttrs((a) => ({ ...a, [name]: e.target.value }));
                            setLimit(6);
                          }}>
                    <option value="">Any {name.toLowerCase()}</option>
                    {values.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              ))}
              {(active.length > 0 || q) && (
                <button type="button" className="btn-quiet text-2xs"
                        onClick={() => { setAttrs({}); setQ(''); setLimit(6); }}>
                  Clear {active.length + (q ? 1 : 0)} filter
                  {active.length + (q ? 1 : 0) === 1 ? '' : 's'}
                </button>
              )}
            </div>

            {missing.length > 0 && (
              <p className="mt-2.5 border border-signal-200 bg-signal-100 px-3 py-2 text-2xs leading-snug text-signal-800">
                {shown.some((f: FitAssessment) => f.reasons.length > 0)
                  ? <>Graded on what has been captured so far — still missing {missing.join(', ')},
                      so the rules that read those have not run.</>
                  : <>Nothing below has been graded against the line yet. The fit rules read the
                      application, and it is still missing {missing.join(', ')}.</>}
              </p>
            )}

            {hoisted.size > 0 && shown.length > 0 && (
              <div className="mt-2.5 border border-signal-200 bg-signal-100 px-3 py-2">
                {[...hoisted].map((code) => {
                  const r = shown[0].reasons.find((x) => x.ruleCode === code)!;
                  return (
                    <p key={code}
                       className="flex items-start gap-2 text-2xs leading-snug text-signal-800">
                      <RuleCodeChip code={code} />
                      <span className="min-w-0">
                        {r.text}
                        <span className="cite mt-0.5 block text-signal-800/80">
                          {r.author ?? 'author not recorded'}
                          {r.sourceRef ? ` · ${r.sourceRef}` : ''} · true of all {shown.length} shown
                        </span>
                      </span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          {s.loading && <Skeleton rows={3} />}
          {s.error && <ErrorNote message={s.error} onRetry={s.reload} />}
          {s.data && total === 0 && !CONFIGURED.has(book) && (
            <Empty title={active.length || q
              ? 'Nothing matches those filters'
              : 'Nothing to offer yet'}>
              {active.length || q
                ? 'Clear a filter and try again.'
                : 'Nothing is mapped to this technology yet.'}
            </Empty>
          )}
          <NarrowedNote narrowed={s.data?.narrowed} />
          {shown.length > 0 && (
            <ul className="border-t border-rule">
              {shown.map((f: FitAssessment) => (
                <MachineRow key={f.itemNo} f={f} hoisted={hoisted}
                            chosen={chosen.has(f.itemNo)} onAdd={() => add(f.itemNo)}
                            onSeeVariants={f.identity && Object.keys(f.identity).length
                              ? () => {
                                  /* Setting the facet is what un-groups the list: the
                                     engine only collapses on identity attributes that
                                     are not already being filtered, so answering
                                     "which machine" turns the same list into that
                                     machine's configurations. */
                                  setAttrs((a) => ({ ...a, ...f.identity }));
                                  setLimit(12);
                                }
                              : undefined} />
              ))}
            </ul>
          )}
          <AnnouncedSeriesNote technologyCode={book} />
          {s.data && (total > shown.length || shown.length > 6) && (
            <div className="flex flex-wrap gap-2 border-t border-rule px-4 py-2">
              {total > shown.length && (
                <button type="button" className="btn-quiet text-2xs"
                        onClick={() => setLimit((n) => n + 12)}>
                  Show 12 more — {total - shown.length} still hidden
                </button>
              )}
              {shown.length > 6 && (
                <button type="button" className="btn-quiet text-2xs" onClick={() => setLimit(6)}>
                  Show fewer
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* ---- what goes with it, and everything else ----------------------- */}
      <Catalogue draft={draft} book={book} onAdd={add} onRemove={removeItem} role={role} setRole={setRole}
                 withIt={withIt.data?.items ?? null} machineLines={machineLines}
                 requirements={hasMachine ? requirements : []} satisfiers={satisfiers}
                 quantityOf={(n) => draft.lines.find((l) => isMine(l, n))?.quantity}
                 onQuantity={setQuantity} />
    </>
  );
}
