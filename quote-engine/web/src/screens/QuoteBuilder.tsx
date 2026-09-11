import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_TECHNOLOGIES,
  api, DEFAULT_DOCUMENT, draftFromQuote, EMPTY_PROFILE, ENVIRONMENT_OPTIONS,
  type ApplicationProfile, type BookFit, type CustomerHit, type DiscountCategory, type Evaluation,
  type FitAssessment, type Item, type QuoteDraft, type QuoteTraceEntry, type Solution,
} from '../api';
import {
  FIELD_LABEL, SUBSTRATE_NAMES, missingKeyFields, parseApplication, porosityFor,
  type Evidence, type Mention, type ParseResult,
} from '../engine/parseApplication';
import { mediaFor } from '../api/media';
import { downPayment } from './documentMoney';
import { applicationPhotoFor } from '../api/photos';
import { AXIM_LOGO_BLUE } from '../assets/logo';
import { buildQuestionnaire, parseQuestionnaire } from '../api/questionnaire';
import { ITEM_ROLE_WORD, word } from '../api/words';
import { usePublishedHeight } from '../components/usePublishedHeight';
import { EnvironmentPicker } from '../components/EnvironmentPicker';
import { UnsavedPromptView } from '../components/UnsavedPrompt';
import { ModalLayer } from '../components/ModalLayer';
import { isCovered } from '../api/approvals';
import type { QuoteApproval } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useModal } from '../components/useModal';
import { useUnsavedGuard } from '../components/useUnsavedGuard';
import { MachineLinks, MachineThumb } from './MachineMedia';
import { useApp, useAsync } from '../state/app';
import { QuoteDocument } from './QuoteDocument';
import { CATALOGUE_ANCHOR, SolutionBody } from './SolutionSection';
import { PaperFrame } from './QuoteDocumentScreen';
import {
  AgainstTheApplication,
  Empty, ErrorNote, Field, FreshnessNote, Panel, Reading, RuleCodeChip, Segmented, Skeleton,
  Status, fitLabel, money, pct, shortDate,
} from '../components/ui';

/**
 * The quote builder.
 *
 * The rep states intent — who it is for, what the application is, which parts,
 * what discount — and the server answers with the priced quote. Nothing on this
 * screen works out a price, a cap or an approval. Every figure shown in the
 * right-hand rail came back from `evaluateDraft`.
 *
 * That is not fastidiousness. If the browser could price a quote, a rep could
 * reach a number the business never sanctioned, and the trace stored against
 * the quote would be a story about it rather than a record of it.
 *
 * The sections are numbered but not gated. A rep who already knows the part
 * number should not have to answer eight application questions first, and a
 * rep on the phone will jump around. Order is a suggestion, not a wizard.
 */

/**
 * The sections, in the order a quote is actually filled in.
 *
 * Who it is for comes first. It used to sit second, behind the application, on the
 * reasoning that the application decides the price book — which is true of the
 * price book and not of the rep. The first thing anyone establishes on a call is
 * whose line this is, and a quote with an application but no customer is not a
 * quote yet. The application still decides the technology; it just no longer has to
 * be the first thing typed.
 */
/* Three. What is on the quote and what it costs live in the rail, beside the work,
   rather than as two more sections under it — the rail was already showing both, so
   scrolling past the configurator only ever reached a second copy of them. */
const STEP = { customer: 0, application: 1, solution: 2 } as const;
const STEP_NUMBERS = [0, 1, 2] as const;

/**
 * No price book until something says which one.
 *
 * The builder used to open by asking for the price book, which inverts the
 * dependency: the application decides the technology, so asking first means
 * guessing. Worse, it defaulted to CIJ, so a print-and-apply enquiry began on the
 * wrong catalogue and stayed there silently until the parser happened to correct
 * it. Empty means unresolved, and the machine step asks only if nothing else has
 * answered.
 */
const UNRESOLVED_TECHNOLOGY = '';

/** Marks a field the parser filled, so nothing appears by magic. */
const read_hint = (words?: string) =>
  words ? <span className="text-instr-700">read from &ldquo;{words}&rdquo;</span> : undefined;

/**
 * A field the customer has no constraint on.
 *
 * Not the same as blank. Blank means go and ask; "any" means the answer is in
 * and it is anything, so no rule may narrow the machine list on it. The engine
 * honours this — a profile trigger on an unconstrained field does not fire.
 */
/**
 * What one application form reads and writes.
 *
 * The quote has an application and so does every solution, and a rep asked for the
 * second to be the SAME thing as the first — the same parser, the same import, the
 * same layout — rather than the reduced questionnaire panel it used to get.
 *
 * REPORTED: "for additional applications, I want the same parser and import function,
 * the full same layout as the first application you do."
 *
 * So there is one form, and this is what it is pointed at. `quoteApplication` and
 * `solutionApplication` below are the two ways of building one; nothing in the form
 * knows which it has.
 */
interface ApplicationTarget {
  /** What to SHOW. For a station this is the quote's answers with its own over them. */
  profile: ApplicationProfile;
  /** What to STORE. For a station this keeps only what differs from the quote. */
  setProfile: (p: ApplicationProfile) => void;
  noConstraint: (keyof ApplicationProfile)[];
  setNoConstraint: (n: (keyof ApplicationProfile)[]) => void;
  /** The price book the parser may switch when the enquiry names one. */
  technologyCode: string;
  setTechnology: (code: string) => void;
  /** Named on the questionnaire, so a returned one can be told from its neighbour. */
  name: string | null;
  /** Where a part named in the enquiry goes, and what is already there. */
  addLine: (itemNo: string) => void;
  chosen: Set<string>;
}

/** The quote's own application. */
function quoteApplication(draft: QuoteDraft,
                          patch: (p: Partial<QuoteDraft>) => void): ApplicationTarget {
  return {
    profile: draft.profile,
    setProfile: (profile) => patch({ profile }),
    noConstraint: draft.noConstraint ?? [],
    setNoConstraint: (noConstraint) => patch({ noConstraint }),
    technologyCode: draft.technologyCode,
    setTechnology: (code) => patch({ technologyCode: code, lines: [] }),
    name: draft.lineName,
    addLine: (itemNo) => patch({ lines: [...draft.lines, { itemNo, quantity: 1 }] }),
    chosen: new Set(draft.lines.map((l) => l.itemNo)),
  };
}

/**
 * One station's application, over the quote's.
 *
 * Shows the quote's answer wherever the station has not given its own, and stores only
 * the difference — so correcting the line speed on the quote still corrects it at every
 * station that never disagreed about it. A straight copy would give two answers for one
 * conveyor and no way to tell which was stale.
 */
function solutionApplication(draft: QuoteDraft, patch: (p: Partial<QuoteDraft>) => void,
                             solution: Solution): ApplicationTarget {
  const base = draft.profile;
  const write = (next: Partial<Solution>) => patch({
    solutions: draft.solutions.map((x) => (x.id === solution.id ? { ...x, ...next } : x)),
  });
  return {
    profile: { ...base, ...(solution.profile ?? {}) },
    setProfile: (p) => {
      /* Only what actually differs. The parser fills a dozen fields at once and most
         of them will agree with the quote; storing those as the station's own would
         quietly cut the link for answers nobody meant to change. */
      const own: Record<string, unknown> = {};
      const from = base as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(p)) {
        const same = from[k];
        if (v !== same && !(v == null && same == null) && !(v === '' && same == null)) {
          own[k] = v;
        }
      }
      write({ profile: Object.keys(own).length ? own as Partial<ApplicationProfile> : undefined });
    },
    /* Undefined means "as the quote says"; a list, even empty, means this station has
       been asked. So the first tick has to write a real list rather than a patch. */
    noConstraint: solution.noConstraint ?? draft.noConstraint ?? [],
    setNoConstraint: (noConstraint) => write({ noConstraint }),
    technologyCode: solution.technologyCode,
    setTechnology: (code) => patch({
      ...(draft.solutions[0]?.id === solution.id ? { technologyCode: code } : {}),
      solutions: draft.solutions.map((x) => (x.id === solution.id
        ? { ...x, technologyCode: code } : x)),
      lines: draft.lines.filter((l) => (l.solutionId ?? null) !== solution.id),
    }),
    name: solution.name,
    addLine: (itemNo) => patch({
      lines: [...draft.lines, { itemNo, quantity: 1, solutionId: solution.id }],
    }),
    chosen: new Set(draft.lines.filter((l) => (l.solutionId ?? null) === solution.id)
      .map((l) => l.itemNo)),
  };
}

function AnyToggle({ field, target }: {
  field: keyof ApplicationProfile;
  target: ApplicationTarget;
}) {
  const list = target.noConstraint;
  const on = list.includes(field);
  return (
    <label className="mt-1 flex items-center gap-1.5 text-2xs text-steel-600">
      <input
        type="checkbox"
        className="h-3 w-3 accent-instr-600"
        checked={on}
        onChange={(e) => target.setNoConstraint(
          e.target.checked ? [...list, field] : list.filter((f) => f !== field))}
      />
      Any / does not matter
    </label>
  );
}


/**
 * What the machine looks like, from the captured portfolio.
 *
 * A CIJ price book enumerates 947 printer configurations whose descriptions
 * differ by an ink code. The photograph does not tell a rep which ink is in it,
 * and it is not meant to — it tells them at a glance that they are looking at a
 * printer rather than a label applicator, which is the mistake that actually
 * happens. Nothing renders when the model has no captured page.
 */
/** A group of the fuller application questions, closed until wanted. */
function MoreFields({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 sm:col-span-2 lg:col-span-3">
      <legend className="label mb-1.5 text-instr-800">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

/** The next free solution id on this quote. Deleting a solution takes its lines with
 *  it, so a freed id has nothing left pointing at it and is safe to hand out again. */
function nextSolutionId(solutions: Solution[]): string {
  const used = new Set(solutions.map((s) => s.id));
  let n = 1;
  while (used.has(`sol-${n}`)) n += 1;
  return `sol-${n}`;
}

/**
 * A draft that is guaranteed to have solutions, and lines that belong to one.
 *
 * A quote saved before solutions existed has lines and no stations, which would render
 * as parts belonging to nothing — visible in no section, deletable from no section. The
 * old model said a line's solution WAS its price book, so that is what this rebuilds:
 * one station per distinct book, in the order the lines were added, which reproduces
 * exactly what the quote showed before.
 *
 * Idempotent, and it leaves a draft that already has solutions alone.
 */
function withSolutions(draft: QuoteDraft, itemBook: (itemNo: string) => string | null): QuoteDraft {
  if (draft.solutions.length > 0) return draft;

  const books: string[] = [];
  for (const l of draft.lines) {
    const b = itemBook(l.itemNo) ?? draft.technologyCode;
    /* 'ALL' is not a book of its own — a service offering or a promotion belongs to
       whatever it was sold beside — so it never opens a station of its own. */
    if (b && b !== ALL_TECHNOLOGIES && !books.includes(b)) books.push(b);
  }
  if (books.length === 0) books.push(draft.technologyCode);

  const solutions: Solution[] = books.map((technologyCode, i) => ({
    id: `sol-${i + 1}`,
    /* The quote's own line name belongs to the first station: on a one-station quote
       it is the same thing said once, and that is the overwhelmingly common case. */
    name: i === 0 ? draft.lineName : null,
    technologyCode,
  }));
  const idOf = (book: string | null) =>
    solutions.find((s) => s.technologyCode === book)?.id ?? solutions[0].id;

  return {
    ...draft,
    solutions,
    lines: draft.lines.map((l) => (l.solutionId
      ? l
      : { ...l, solutionId: idOf(itemBook(l.itemNo) ?? draft.technologyCode) })),
  };
}

export function QuoteBuilder({ quoteNo, startAt, pickRole: pickRoleFromRoute }: {
  quoteNo?: string;
  /** The kind of part a finding on the saved quote sent the rep here to find. */
  pickRole?: string;
  /** 'machine' when the rep came through the "start from a machine" door. */
  startAt?: 'machine';
}) {
  const { go, notify } = useApp();

  const [draft, setDraft] = useState<QuoteDraft>({
    technologyCode: UNRESOLVED_TECHNOLOGY,
    customerNo: null, customerName: null, lineName: null,
    profile: { ...EMPTY_PROFILE },
    flags: {},
    // Zero. A discount is a decision the rep makes, and pre-filling one means
    // every quote starts by giving margin away that nobody asked for.
    categoryDiscounts: { system: 0, consumables: 0, accessories: 0, customs: 0 },
    /* One station from the start, so the first solution is built by exactly the same
       machinery as the second and there is no first-solution special case to keep in
       step. Its book is filled in by the price-book chooser. */
    solutions: [{ id: 'sol-1', name: null, technologyCode: UNRESOLVED_TECHNOLOGY }],
    lines: [],
  });
  const [savedNo, setSavedNo] = useState<string | undefined>(quoteNo);
  /* What is on the server, so the guard knows whether anything would be lost.
     A snapshot rather than a flag: setting a value and setting it straight back is
     not a change, and a rep who fixes their own typo should not be asked whether they
     meant it. Null until the first save or load, which is the state a new quote is in
     — and a new quote is compared against a pristine one instead. */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const pristine = useRef<string | null>(null);
  if (pristine.current === null) pristine.current = JSON.stringify(draft);
  const [busy, setBusy] = useState(false);
  /** Nothing leaves without being looked at first. */
  const [review, setReview] = useState(false);
  /** what the last enquiry read produced, so later sections can use it */
  const [read, setRead] = useState<ParseResult | null>(null);

  const cats = useAsync(() => api.listDiscountCategories(), []);
  const patch = useCallback(
    (p: Partial<QuoteDraft>) => setDraft((d) => ({ ...d, ...p })), [],
  );

  /* Add what a rule asked for, in one press.
     Quantities accumulate onto an existing line rather than appending a second one
     for the same part, because two lines of the same bracket is not what the rule
     meant and it is what the rep would have to tidy up afterwards. */
  const addParts = useCallback((parts: { itemNo: string; quantity: number }[]) => {
    setDraft((d) => {
      const lines = [...d.lines];
      for (const p of parts) {
        const at = lines.findIndex((l) => l.itemNo === p.itemNo);
        if (at >= 0) lines[at] = { ...lines[at], quantity: lines[at].quantity + p.quantity };
        else lines.push({ itemNo: p.itemNo, quantity: p.quantity });
      }
      return { ...d, lines };
    });
  }, []);

  /* One section open at a time, starting with who it is for.
     `open[n] !== false` was the bug behind "the categories are still not closed":
     an unvisited section is `undefined`, which that test reads as open, so seeding
     the state closed nothing at all. Membership is explicit now — a section is open
     only if this map says true. */
  /* The machine door opens on the machine list, which is the whole point of it
     being a separate door. Who it is for stays open too, because a machine still
     has to be quoted to somebody. */
  const [open, setOpen] = useState<Record<number, boolean>>(
    startAt === 'machine'
      ? { [STEP.customer]: true, [STEP.solution]: true }
      : { [STEP.customer]: true },
  );
  const allOpen = STEP_NUMBERS.every((n) => open[n] === true);
  const step = (n: number) => ({
    open: open[n] === true,
    onToggle: () => setOpen((o) => ({ ...o, [n]: !o[n] })),
  });

  /* The parts filter lives up here, not inside the section, because the findings
     panel needs to drive it.

     A rule that says "no stand, bracket or mount on this quote" used to end there.
     The rep had to read the sentence, work out that a mount is an accessory, scroll
     back, open the parts step and change the Kind dropdown themselves — four
     actions to act on advice the tool had already worked out. Now the finding
     carries a button that does all four. */
  /* The status band publishes its own height, for the rail that sticks below it. */
  const bandRef = useRef<HTMLDivElement>(null);
  usePublishedHeight(bandRef, '--band-h');

  const [lineRole, setLineRole] = useState('');
  const linesRef = useRef<HTMLDivElement | null>(null);
  /* Follow a finding to the parts that answer it.
     This opened the solution step and scrolled to the top of it — the machine
     chooser, several screens above the catalogue it had just filtered. So the tool
     did the right thing and then showed the rep somewhere else, which reads as the
     filter not having worked.

     Two things it now gets right. It scrolls to the catalogue itself, and it waits
     for that element to exist: opening the step is a render, and the anchor is not
     in the document during the frame that asks for it. And it stops short of the
     sticky bars, which is where scrollIntoView would have put it — under them. */
  const pickRole = useCallback((role: string) => {
    setLineRole(role);
    setOpen((o) => ({ ...o, [STEP.solution]: true }));

    let tries = 0;
    const land = () => {
      const el = document.getElementById(CATALOGUE_ANCHOR) ?? linesRef.current;
      if (!el) {
        if (tries++ < 30) setTimeout(land, 50);
        return;
      }
      const style = getComputedStyle(document.documentElement);
      const px = (name: string, fallback: number) =>
        parseFloat(style.getPropertyValue(name)) || fallback;
      const clear = px('--chrome-h', 52) + px('--band-h', 88) + 8;
      const top = el.getBoundingClientRect().top + window.scrollY - clear;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };
    setTimeout(land, 0);
  }, []);

  /* Arriving from a finding on a saved quote — "no mount on this quote" followed
     through — opens the parts step with the filter already set. Once only: a rep who
     then changes the filter must not have it put back on the next render. */
  const routeHandled = useRef(false);
  useEffect(() => {
    if (!pickRoleFromRoute || routeHandled.current) return;
    routeHandled.current = true;
    pickRole(pickRoleFromRoute);
  }, [pickRoleFromRoute, pickRole]);

  /* Which sections have their answers in.
     Used to reveal the next one, so filling the quote in reads as one pass rather
     than five clicks. Discount is not on this list: it is optional, so it has
     nothing to complete and nothing follows it. */
  const done: Record<number, boolean> = {
    [STEP.customer]: !!(draft.customerNo || draft.customerName) && !!draft.lineName?.trim(),
    [STEP.application]: missingKeyFields(draft.profile, draft.noConstraint ?? []).length === 0,
    [STEP.solution]: draft.lines.length > 0,
    /* Reviewing is complete once there are lines to have reviewed. Discount is not
       on this list and neither is anything after it: a discount is optional, so it
       has nothing to complete and nothing follows it. */
  };

  /*
    Reveal the next section. Never close the one being worked in.
    Two things were wrong with the first attempt.

    It closed the current section, which is the wrong thing to do to somebody
    mid-sentence: a name half typed would fold away under the cursor. Opening the
    next one is an offer; closing this one is an interruption. Only opening now.

    And it fired on the first keystroke, because one character in the line name
    made the section "complete". Completion is a poor proxy for "finished typing",
    so the check waits for the draft to stop changing. Nine hundred milliseconds is
    long enough that a pause reads as a pause and short enough not to feel stuck.

    `revealed` records which openings have happened, so a section the rep closes
    stays closed instead of springing back on the next change.
  */
  const revealed = useRef<Set<number>>(new Set());
  const settled = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(settled.current);
    settled.current = window.setTimeout(() => {
      const order = [STEP.customer, STEP.application, STEP.solution];
      for (let i = 0; i < order.length - 1; i += 1) {
        const here = order[i], next = order[i + 1];
        if (done[here] && !revealed.current.has(next)) {
          revealed.current.add(next);
          setOpen((o) => ({ ...o, [next]: true }));
          return;
        }
      }
    }, 900);
    return () => window.clearTimeout(settled.current);
  }, [done[STEP.customer], done[STEP.application], done[STEP.solution],
      draft.lineName, draft.customerName, draft.customerNo]);

  /* Reopening an existing quote loads the intent behind it, not its numbers. */
  useEffect(() => {
    if (!quoteNo) return;
    void api.getQuote(quoteNo).then((q) => {
      /* Everything the rep set, not just the numbers. This block used to spell the
         conversion out and lost a field every time one was added — noConstraint
         first, then the flat discount and the optional flag. draftFromQuote is the
         one place that remembers. */
      /* And a station for every line to belong to, on a quote raised before there
         were any. See withSolutions: it rebuilds what the old model implied rather
         than inventing a shape the quote never had. */
      const loaded: QuoteDraft = withSolutions(
        draftFromQuote(q),
        (itemNo) => q.lines.find((l) => l.itemNo === itemNo)?.technologyCode ?? null);
      setDraft(loaded);
      // What is on the server, so reopening a saved quote is not immediately unsaved.
      setSavedSnapshot(JSON.stringify(loaded));
    });
  }, [quoteNo]);

  const ev = useLiveEvaluation(draft);

  /* The solutions on this quote — the draft's own list, in the order they were built.

     This used to be derived: the quote's book, plus the book of anything on the quote,
     plus a list of books a rep had opened and not filled. That made a solution and a
     price book the same thing, so two stations that both wanted a CIJ coder collapsed
     into one and the control for adding one hid every book already in use. Now a
     solution is a row a rep created and the derivation is gone.

     REPORTED: "adding another solution to a quote is a half-done process. It should
     literally be the same process as the first solution." */
  const solutions = draft.solutions;

  /* Which one is open. One at a time: the point of collapsing a finished solution is
     to get it out of the way of the next. Keyed by id, so deleting the solution above
     does not silently open a different one. */
  const [openSolution, setOpenSolution] = useState<string>('');

  /* Which station's application is expanded.
     A new solution opens on it, because answering the application is the first half of
     building one and the half that was previously hidden behind a disclosure nobody
     opened. Fill the application, then configure — the same order as the first. */
  const [openApplication, setOpenApplication] = useState<string>('');

  /** Add a station, and open it on its application — the first thing to fill in. */
  const addSolution = (technologyCode: string) => {
    const id = nextSolutionId(draft.solutions);
    patch({ solutions: [...draft.solutions, { id, name: null, technologyCode }] });
    setOpenSolution(id);
    setOpenApplication(id);
  };

  /**
   * Remove a station, and everything that only made sense as part of it.
   *
   * Its lines go with it. A line whose station has gone would be priced into the
   * total, printed on the customer's copy and editable from nowhere, which is a worse
   * outcome than losing it — and the rep is told the count before it happens.
   *
   * REPORTED: "the user also needs to be able to delete a section on the quote, there
   * currently is no delete button for those."
   */
  const removeSolution = (id: string) => {
    patch({
      solutions: draft.solutions.filter((x) => x.id !== id),
      lines: draft.lines.filter((l) => (l.solutionId ?? null) !== id),
    });
    if (openSolution === id) setOpenSolution('');
  };

  /* Anything that differs from what is on the server would be lost.
     This used to be a hand-written list of the fields that counted — customer, lines,
     profile — which left out the line name, the technology, the rules a rep had
     deliberately silenced, the discounts and the flags. Every one of those is a
     decision somebody made, and none of them armed the guard. Comparing against the
     saved state cannot miss a field, and comparing an unsaved quote against a
     pristine one keeps the question off an untouched screen — asking about a form
     nobody has typed in is how a rep learns to dismiss the question unread. */
  const now = JSON.stringify(draft);
  const dirty = now !== (savedSnapshot ?? pristine.current);
  const guard = useUnsavedGuard(dirty);

  async function save() {
    setBusy(true);
    try {
      const q = savedNo ? await api.saveQuote(savedNo, draft) : await api.createQuote(draft);
      const isFirst = !savedNo;
      setSavedNo(q.quoteNo);
      setSavedSnapshot(JSON.stringify(draft));
      notify(`${q.quoteNo} saved.`);
      // Move to the quote's own URL on the first save. It used to stay on
      // #/quotes/new, so a refresh lost the draft that had just been saved and the
      // address could not be shared or bookmarked — the quote existed and nothing
      // pointed at it.
      if (isFirst) { guard.allowNext(); go({ name: 'editQuote', quoteNo: q.quoteNo }); }
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.');
    } finally { setBusy(false); }
  }

  /* Finish editing, then look at it. */
  async function saveAndReview() {
    setBusy(true);
    try {
      const q = savedNo ? await api.saveQuote(savedNo, draft) : await api.createQuote(draft);
      setSavedNo(q.quoteNo);
      setSavedSnapshot(JSON.stringify(draft));
      guard.allowNext();
      go({ name: 'quote', quoteNo: q.quoteNo });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.');
    } finally { setBusy(false); }
  }

  async function send(to: string, note: string) {
    setBusy(true);
    try {
      const withRecipient = { ...draft, recipientEmail: to, coveringNote: note };
      setDraft(withRecipient);
      const no = savedNo ?? (await api.createQuote(withRecipient)).quoteNo;
      if (!savedNo) setSavedNo(no);
      await api.saveQuote(no, withRecipient);
      const q = await api.submitQuote(no);
      setReview(false);
      notify(q.status === 'pendingApproval'
        ? `${q.quoteNo} sent for approval.`
        : `${q.quoteNo} sent.`);
      go({ name: 'quote', quoteNo: q.quoteNo });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not send.');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {/* Asked by the app rather than by window.confirm — see UnsavedPrompt. */}
      <UnsavedPromptView prompt={guard} what="quote" />
      {/*
        The status band.

        Sticks below the brand bar, because Save and Send have to be reachable from
        any scroll position — hunting for them at the top of a five-section form is
        what makes a long form feel long.

        It carries the live readings as well as the actions. The order total used to
        live only in the right-hand rail, which appears at `xl` and sits below
        everything else on a phone: a rep scrolling the builder could not see the
        number they were negotiating. An instrument states its readings where they
        cannot be scrolled away from.
      */}
      <div style={{ top: 'var(--chrome-h, 3.25rem)' }}
           ref={bandRef}
           className="fascia sticky z-dropdown -mx-4 -mt-4 border-b-2 border-instr-400 bg-navy-900 px-4 py-2 text-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="h-display truncate text-base text-white">{savedNo ? savedNo : 'New quote'}</h1>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-quiet text-xs"
                  onClick={() => setOpen(() => {
                    const next = !allOpen;
                    return Object.fromEntries(STEP_NUMBERS.map((n) => [n, next]));
                  })}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
          <button type="button" className="btn-quiet text-xs" onClick={save}
                  disabled={busy || !draft.lines.length}>
            {savedNo ? 'Save' : 'Save draft'}
          </button>
          {/* Save and go, rather than send from the middle of editing.
              Sending straight from the builder meant the thing a customer receives
              left from a screen that was still being changed, and the record of what
              was sent was written in the same motion. The quote is saved first and the
              rep lands on it — the same page anyone else opens — and sends from there,
              having seen it the way it will be read. */}
          <button type="button" className="btn-primary text-xs"
                  onClick={saveAndReview}
                  disabled={busy || !draft.lines.length || !!ev.data?.blocked}>
            Save and review
          </button>
        </div>
      </div>

      <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t border-navy-700 pt-2">
        <Reading label="Price book" value={draft.technologyCode || 'not chosen'} />
        <Reading label="Lines" value={String(draft.lines.length)} />
        <Reading label="Order total" value={money(ev.data?.orderTotal)} lead />
        <div className="flex items-baseline gap-2">
          <dt className="text-2xs font-semibold uppercase tracking-wider text-navy-300">State</dt>
          <dd>
            {ev.loading ? (
              <span className="text-xs text-navy-100">pricing…</span>
            ) : ev.data?.blocked ? (
              <span className="text-xs font-semibold text-fascia-alert">cannot be sent</span>
            ) : (ev.data?.requiredApprovals?.length ?? 0) > 0 ? (
              <span className="text-xs font-semibold text-fascia-signal">
                {ev.data!.requiredApprovals.length} approval{ev.data!.requiredApprovals.length === 1 ? '' : 's'} needed
              </span>
            ) : draft.lines.length ? (
              /* Warnings are not blockers and should not become blockers, but the
                 summary word must not contradict the panel beside it. A quote with no
                 ink, no mount and no installation read "ready to send" while
                 Q-BARE-CONSUMABLE said the machine cannot print on arrival. */
              (() => {
                const checks = (ev.data?.trace ?? []).filter((t) => t.status === 'warning').length;
                return checks > 0
                  ? <span className="text-xs font-semibold text-fascia-signal">
                      ready, {checks} to check
                    </span>
                  : <span className="text-xs font-semibold text-fascia-fit">ready to send</span>;
              })()
            ) : (
              <span className="text-xs text-navy-100">nothing on it yet</span>
            )}
          </dd>
        </div>
      </dl>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_23rem]">
        {/* The application first: it is what decides the technology, and every
            later section depends on that answer. */}
        <div className="min-w-0 space-y-3">
          <CustomerSection draft={draft} patch={patch} {...step(STEP.customer)} />
          <ApplicationSection draft={draft} patch={patch} onRead={setRead} quoteNo={quoteNo}
                              {...step(STEP.application)} />
          <div ref={linesRef}>
            {/* One section per solution. A quote can carry a coder at one station and
                an applicator at another: configure one, collapse it, add another.
                The first owns the price-book chooser, because choosing the quote's own
                book is a different decision from adding a second solution to it. */}
            {solutions.map((sol, i) => (
              <SolutionSection
                key={sol.id}
                draft={draft} patch={patch} ev={ev.data}
                hint={read?.machineHint ?? null}
                role={lineRole} setRole={setLineRole}
                solution={sol}
                index={i}
                multi={solutions.length > 1}
                /* Named by the rep, and falling back to the quote's own line name for
                   the first — on a one-station quote that is the same thing said once. */
                title={solutions.length > 1
                  ? (sol.name || `Solution ${i + 1}`) : 'The solution'}
                /* The chooser picks this station's book, and only while the station has
                   nothing to lose by changing it. Every solution gets one, because
                   picking the book is part of building a solution and the second was
                   having it picked for it by a dialog it never saw again. */
                chooser={draft.lines.every((l) => (l.solutionId ?? null) !== sol.id)
                  ? <PriceBookChooser draft={draft} patch={patch} ev={ev.data}
                                      solution={sol} /> : undefined}
                /* The first solution keeps the step machinery, so a new quote still
                   opens on "Who is it for" and on that alone. The rest are the rep's to
                   open and close, one at a time — the point of collapsing a finished
                   solution is to get it out of the way of the next. */
                open={i === 0 ? step(STEP.solution).open : openSolution === sol.id}
                onToggle={i === 0
                  ? step(STEP.solution).onToggle
                  : () => setOpenSolution(openSolution === sol.id ? '' : sol.id)}
                applicationOpen={openApplication === sol.id}
                setApplicationOpen={(v) => setOpenApplication(v ? sol.id : '')}
                /* The last one standing cannot be deleted: a quote with no station is
                   a state the builder cannot get back out of. */
                onDelete={solutions.length > 1 ? () => removeSolution(sol.id) : undefined}
              />
            ))}
            <AddSolution draft={draft} onAdd={addSolution} />
          </div>
        </div>

        <div className="min-w-0">
          {/* Below the chrome and the status band, both measured. */}
          {/* Below the chrome AND below the status band, both measured.
              The band's height was a hard-coded 5.5rem, which is the same mistake
              --chrome-h was written to fix: it wraps to two and three rows as the
              window narrows, so the rail's top rode up under it and the first panel
              lost its heading. --band-h is published by the band itself. */}
          <div style={{ top: 'calc(var(--chrome-h, 3.25rem) + var(--band-h, 5.5rem))' }}
               className="space-y-3 xl:sticky xl:max-h-[calc(100vh-var(--chrome-h,3.25rem)-var(--band-h,5.5rem)-1rem)] xl:overflow-y-auto">
            <SummaryRail ev={ev.data} loading={ev.loading} error={ev.error}
                         draft={draft} patch={patch} onFix={addParts} onPick={pickRole}
                         cats={cats.data ?? []} />
          </div>
        </div>
      </div>

      {review && (
        <SendDialog
          draft={draft}
          ev={ev.data}
          quoteNo={savedNo}
          busy={busy}
          onClose={() => setReview(false)}
          onSend={send}
        />
      )}
    </div>
  );
}

/**
 * Re-evaluate as the draft changes, but not on every keystroke.
 *
 * The debounce is short enough that the totals feel live and long enough that
 * typing a quantity does not fire six round trips. The stale-response guard
 * matters more: without it a slow early request can land after a fast later one
 * and put an out-of-date total on screen, which is exactly the kind of wrong
 * number this whole design exists to prevent.
 */
function useLiveEvaluation(draft: QuoteDraft) {
  const [data, setData] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!draft.lines.length) { setData(null); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = window.setTimeout(() => {
      api.evaluateDraft(draft)
        .then((r) => { if (mine === seq.current) { setData(r); setError(null); } })
        .catch((e: unknown) => {
          if (mine === seq.current) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => { if (mine === seq.current) setLoading(false); });
    }, 250);
    return () => window.clearTimeout(t);
  }, [draft]);

  return { data, loading, error };
}

/* ------------------------------------------------------------------ sections */

/**
 * A collapsible section.
 *
 * A quote is six sections and a rep is only ever working in one. Collapsing the
 * others keeps the sticky rail and the buttons in reach instead of six screens
 * away, and `summary` means a closed section still says what is in it — a
 * collapse that hides the answer is just a worse scroll.
 */
/**
 * A disclosure whose button says what it controls.
 *
 * aria-expanded was already here; aria-controls was not, so a screen reader could
 * announce that something was expanded without being told what. The id comes from the
 * title, which is stable and unique across the five steps.
 */
function Step({ title, children, aside, summary, open, onToggle, strong }: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /**
   * Reverse the header out in navy.
   *
   * Unused on the builder, and deliberately so: six stacked steps are a sequence,
   * and singling one out reads as a warning about that step rather than as
   * emphasis. The navy belongs on the enquiry door on the quotes screen, where it
   * marks a choice between three things rather than a stop within one path.
   */
  strong?: boolean;
}) {
  const panelId = `step-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <Panel
      strong={strong}
      title={
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId}
                className="step-head -my-1 flex min-w-0 items-center gap-2.5 rounded py-1 text-left hover:text-instr-700">
          {/* Drawn, not a ▸ character. The glyph rendered at 4.39:1 against white,
              under the 4.5 body-text floor, and its weight and baseline were the
              font's decision rather than this interface's. */}
          <svg aria-hidden viewBox="0 0 12 12" width="10" height="10"
               className={`shrink-0 text-instr-700 transition-transform ${open ? 'rotate-90' : ''}`}>
            <path d="M4 2.5 L8.5 6 L4 9.5" fill="none" stroke="currentColor"
                  strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* No step number. This screen's whole argument is that the order is a
              suggestion and not a wizard — a rep who knows the part number should
              not be told they are on step 4 of 5. Numbering it said the opposite of
              what the screen does. */}
          <span className="h-display truncate text-sm">{title}</span>
          {!open && summary && (
            <span className="min-w-0 truncate text-2xs font-normal text-steel-600">{summary}</span>
          )}
        </button>
      }
      aside={aside}
    >
      {/* Always rendered, so the id aria-controls names is always there. It used to be
          `{open && <div id=…>}`, which meant every collapsed section pointed at an element
          that did not exist — an ARIA reference broken by the same change that added
          aria-controls. Contents stay conditional; the container does not. */}
      <div id={panelId} hidden={!open} className={open ? 'p-4' : undefined}>
        {open && children}
      </div>
    </Panel>
  );
}

/**
 * Which price book this quote is against.
 *
 * Not a step of its own any more. The application decides the technology, so
 * asking for it first inverted the dependency and — defaulting to CIJ — put
 * print-and-apply enquiries on the wrong catalogue without saying so. It now
 * lives inside the machine step: the parser proposes, this confirms, and a rep
 * who already knows what they are selling picks it here in one click.
 *
 * A technology with no items is shown rather than hidden, because "nothing is
 * mapped yet" is information a rep needs and an absent option is not.
 */
function PriceBookChooser({ draft, patch, ev, solution }: {
  draft: QuoteDraft; patch: (p: Partial<QuoteDraft>) => void;
  ev: Evaluation | null;
  /** The station being given a book. Every solution picks its own. */
  solution: Solution;
}) {
  const techs = useAsync(() => api.listTechnologies(), []);
  const chosen = solution.technologyCode === UNRESOLVED_TECHNOLOGY
    ? '' : solution.technologyCode;
  const isFirst = draft.solutions[0]?.id === solution.id;

  /* Set this station's book — and the quote's too, where this is the first station.
     The quote's own technologyCode is what the header states and what seeds the set
     of books whose rules are live, so on a one-solution quote the two must not drift
     apart. On the second and later stations it is left alone: they extend the quote
     rather than redefine it. */
  const choose = (code: string) => patch({
    ...(isFirst ? { technologyCode: code } : {}),
    solutions: draft.solutions.map((x) => (x.id === solution.id
      ? { ...x, technologyCode: code } : x)),
  });

  /* How many lines each book already holds.
     A quote can carry a coder at one station and an applicator at another, so the
     chips have to say which books are on it — otherwise switching between them looks
     like switching the quote rather than moving between its solutions. Counted off the
     priced lines, which carry their own book. */
  const onQuote = new Map<string, number>();
  for (const l of ev?.lines ?? []) {
    if (l.technologyCode && l.technologyCode !== 'ALL') {
      onQuote.set(l.technologyCode, (onQuote.get(l.technologyCode) ?? 0) + 1);
    }
  }
  const solutions = onQuote.size;

  /* Grade the books against the application, but only once the application says
     something. With an empty profile every rule stays quiet and every book would
     report the same nothing, which is a worse label than the item counts it
     replaced. The counts are the honest answer until there is a question. */
  const described = Object.values(draft.profile ?? {}).some((v) => v != null && v !== '');
  const fit = useAsync(
    () => (described
      ? api.recommendBooks(draft.profile, draft.noConstraint)
      : Promise.resolve([] as BookFit[])),
    [described, JSON.stringify(draft.profile), JSON.stringify(draft.noConstraint)],
  );
  const fitBy = new Map((fit.data ?? []).map((f) => [f.technologyCode, f]));

  /* The best book gets said out loud rather than left for the rep to work out by
     comparing seven chips. Most strong fits wins; ties go to the book with fewer
     ruled-out machines, which reads as the one with less standing in its way. */
  const best = [...(fit.data ?? [])]
    .filter((f) => f.strong > 0)
    .sort((a, b) => b.strong - a.strong || a.notRecommended - b.notRecommended)[0];

  /* And it gets CHOSEN, not just named.
     Saying "CIJ has the most good options" and then making the rep click CIJ is
     asking them to retype an answer the tool already has. It only ever fills a gap:
     once a technology is set — by this, by the parser, or by the rep — nothing here
     changes it again, because a rep who deliberately picked laser must not have it
     taken back the moment they describe the substrate.

     The rep can always change it, and the chip says which one was chosen for them. */
  const autoPicked = useRef(false);
  useEffect(() => {
    if (chosen || !best || autoPicked.current) return;
    autoPicked.current = true;
    choose(best.technologyCode);
  }, [chosen, best, patch]);

  return (
    <div className="mb-3">
      <p className="label mb-1.5">
        {chosen ? 'Price book' : 'Which price book — nothing has answered this yet'}
      </p>
      {best && (
        <p className="mb-1.5 text-2xs text-steel-700">
          <span className="font-semibold text-instr-800">{best.technologyCode}</span>
          {' '}has the most machines the datasheets endorse for this application
          {' '}({best.strong}
          {best.caveat > 0 ? `, and ${best.caveat} more with caveats` : ''}
          ){chosen === best.technologyCode && autoPicked.current
            ? ' — chosen for you. Change it if you disagree.' : '.'}
        </p>
      )}
      {techs.loading && <Skeleton rows={1} />}
      {techs.data && (
        <div className="flex flex-wrap gap-2">
          {techs.data.map((t) => {
            const on = t.code === chosen;
            const f = fitBy.get(t.code);
            // What this book already holds on the quote, so a rep can see at a glance
            // which chips are solutions and which are just books.
            const here = onQuote.get(t.code) ?? 0;
            const empty = t.itemCount === 0;
            const noMachine = !empty && t.machineCount === 0;
            return (
              <button
                key={t.code}
                type="button"
                aria-pressed={on}
                data-tap="chip"
                /* The lines stay. This cleared them, with a caption underneath
                   saying so, which made the one obvious control on the section the one
                   that destroyed the work — and left adding a second solution to a
                   dropdown at the bottom of the catalogue panel that nobody found.
                   A quote holds more than one book now, and each machine is graded by
                   its own, so there is nothing to clear. */
                onClick={() => choose(t.code)}
                className={`min-w-0 rounded border px-3 py-1.5 text-left transition-colors ${
                  on ? 'border-instr-600 bg-instr-100'
                    : 'border-rule bg-surface hover:border-instr-400 hover:bg-steel-50'}`}
              >
                <span className={`num block text-xs font-bold ${on ? 'text-instr-800' : 'text-steel-900'}`}>
                  {t.code}
                </span>
                {/* steel-600, not steel-500: 500 is the disabled/decorative
                    floor and comes to 4.12:1 on the selected tint. */}
                {/* Machines first, because that is what the step is for, and the
                    rest of the book after it. "3 items" used to be the whole label
                    on a technology with no machine in it at all. */}
                {/* What the rep is actually choosing between. Once the application
                    is described, the useful figure is how many machines suit it —
                    not how many part numbers the book contains. "947 machines ·
                    1,157 parts" answered a question nobody asked. */}
                <span className={`num block text-2xs ${
                  here > 0 ? 'text-fit-800'
                    : empty || noMachine ? 'text-signal-800'
                    : f?.allRuledOut ? 'text-alert-800'
                      : f && f.strong > 0 ? 'text-fit-800' : 'text-steel-600'}`}>
                  {here > 0 ? `${here} on the quote`
                    : empty ? 'no items yet'
                    : noMachine ? `no machine · ${t.itemCount} parts`
                      : f?.allRuledOut ? 'nothing here can do this'
                        /* Both numbers, because they answer different questions. Strong
                           is what a datasheet endorses; caveat is what works with a
                           stated compromise, and a rep pitching against a competitor
                           needs to know a book has ten of the second before dismissing
                           it for having two of the first. */
                        : f && (f.strong > 0 || f.caveat > 0)
                          ? `${f.strong} good · ${f.caveat} with caveats`
                          : f ? `${t.machineCount} machines · none assessed`
                            : `${t.machineCount} machine${t.machineCount === 1 ? '' : 's'} · ${t.itemCount} parts`}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {chosen && draft.lines.length > 0 && (
        <p className="mt-1.5 text-2xs text-steel-600">
          {solutions > 1
            ? `This quote has ${solutions} solutions. Each machine is graded against `
              + 'its own book, and the customer\u2019s copy names them separately.'
            : 'Switching book keeps the lines \u2014 a quote can carry a coder at one '
              + 'station and an applicator at another.'}
        </p>
      )}
    </div>
  );
}

/**
 * The customer field.
 *
 * A combobox, not a search box with a list bolted underneath. Choosing a
 * customer puts them IN the field and closes the list — the field then reads as
 * settled, because it is. The old version left the typed text sitting above a
 * permanent list of matches, so nothing on screen said which one had been
 * picked.
 */
function CustomerSection({ draft, patch, open, onToggle }: {
  draft: QuoteDraft; patch: (p: Partial<QuoteDraft>) => void;
  open: boolean; onToggle: () => void;
}) {
  const [q, setQ] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const hits = useAsync(() => (listOpen && q ? api.searchCustomers(q) : Promise.resolve([])), [q, listOpen]);
  const list = hits.data ?? [];

  const locked = !!draft.customerNo;

  // Clicking away is a decision to stop choosing, not a reason to keep a list open.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const choose = (c: CustomerHit) => {
    /* Take the contact with the account. Orbit holds it, and a rep retyping an
       address the ERP already knows is a rep who will eventually mistype one — a
       quote sent to a wrong address is not a small mistake. Only a DEFAULT: an
       account with several contacts leaves the choice open in the send step, and
       one with none leaves it blank rather than inventing something. */
    patch({
      customerNo: c.customerNo,
      customerName: c.customerName,
      newCustomer: null,
      recipientEmail: c.email ?? null,
    });
    setQ('');
    setListOpen(false);
  };

  /* A prospect: a name has been typed and no Orbit account was chosen. */
  const prospect = !locked && !!draft.customerName?.trim();
  const nc = draft.newCustomer ?? { companyName: '', contactName: '', email: '', city: '', state: '' };
  const setNc = (k: keyof typeof nc, v: string) =>
    patch({ newCustomer: { ...nc, companyName: draft.customerName ?? '', [k]: v } });

  const onKey = (e: React.KeyboardEvent) => {
    if (!listOpen || !list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((i) => Math.min(i + 1, list.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); choose(list[cursor]); }
    if (e.key === 'Escape') setListOpen(false);
  };

  return (
    <Step title="Who is it for" open={open} onToggle={onToggle}
          summary={draft.customerName ?? undefined}>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* min-w-0: a grid child defaults to min-width:auto, so the locked
            customer chip would otherwise push the page wider than a phone. */}
        <div ref={boxRef} className="relative min-w-0">
          <Field
            label="Customer"
            hint={locked ? undefined : 'Start typing an account name or number. Not in Orbit yet? Type the name and carry on.'}
          >
            {locked ? (
              <span className="flex items-center gap-2 rounded border border-instr-300 bg-instr-100 px-2.5 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-heading">
                    {draft.customerName}
                  </span>
                  <span className="num block text-2xs text-steel-600">{draft.customerNo}</span>
                </span>
                <button
                  type="button"
                  className="btn-quiet shrink-0 text-2xs"
                  onClick={() => { patch({ customerNo: null, customerName: null }); setListOpen(false); }}
                >
                  Change
                </button>
              </span>
            ) : (
              <input
                className="field text-sm"
                role="combobox"
                aria-expanded={listOpen && list.length > 0}
                aria-autocomplete="list"
                aria-label="Customer"
                placeholder="Name or account number…"
                value={q || draft.customerName || ''}
                onChange={(e) => {
                  setQ(e.target.value);
                  setCursor(0);
                  setListOpen(true);
                  // Typed text is a prospect name until a real account is chosen.
                  patch({ customerName: e.target.value || null });
                }}
                onFocus={() => setListOpen(true)}
                onKeyDown={onKey}
              />
            )}
          </Field>

          {listOpen && !locked && list.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 z-dropdown mt-1 max-h-60 overflow-y-auto rounded border border-rule bg-surface shadow-lift"
            >
              {list.map((c, i) => (
                <li key={c.customerNo} role="option" aria-selected={i === cursor}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(c)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${
                      i === cursor ? 'bg-instr-100' : 'hover:bg-steel-50'}`}
                  >
                    <span className="min-w-0 truncate font-semibold text-steel-900">{c.customerName}</span>
                    <span className="num shrink-0 text-2xs text-steel-600">{c.customerNo}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!locked && q && !hits.loading && list.length === 0 && (
            <p className="mt-1 text-2xs text-steel-600">
              No Orbit account matches that. It will be quoted as a prospect.
            </p>
          )}
        </div>

        <Field label="Line or application name" hint="What you will recognise this quote by later.">
          <input className="field text-sm" value={draft.lineName ?? ''}
                 placeholder="Line 3 — case coder"
                 onChange={(e) => patch({ lineName: e.target.value || null })} />
        </Field>
      </div>

      {/* The prospect who is not in the ERP yet.
          There was no path for one at all — the field searched Orbit and a rep
          quoting somebody new had nowhere to put them, so the quote went out with a
          name and nothing else. Sales does not wait for an account to be created.

          Deliberately the smallest set that lets a quote be addressed and sent.
          Asking for more is asking a rep to do the credit team's data entry a
          second time, and the second copy is the one that will be wrong. */}
      {prospect && (
        <div className="mt-3 border-l-2 border-signal-600 bg-signal-50 px-3 py-2.5">
          <p className="text-2xs font-semibold text-signal-900">
            Not in Orbit yet — quoted as a prospect
          </p>
          <p className="mt-0.5 text-2xs text-steel-700">
            The quote carries a temporary reference until an account exists. It can be
            sent; it cannot be marked won until a real Orbit number replaces it.
          </p>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <Field label="Contact name">
              <input className="field text-sm" value={nc.contactName}
                     onChange={(e) => setNc('contactName', e.target.value)} />
            </Field>
            <Field label="Contact email">
              <input className="field text-sm" type="email" value={nc.email}
                     onChange={(e) => {
                       setNc('email', e.target.value);
                       patch({ recipientEmail: e.target.value || null });
                     }} />
            </Field>
            <Field label="Ship-to city">
              <input className="field text-sm" value={nc.city}
                     onChange={(e) => setNc('city', e.target.value)} />
            </Field>
            <Field label="Ship-to state">
              <input className="field text-sm" value={nc.state}
                     onChange={(e) => setNc('state', e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </Step>
  );
}

/**
  * The application, whoever is answering it.
  *
  * One form for the quote and for every station on it — same paste box, same parser,
  * same questionnaire import, same fields in the same order. It used to be this for
  * the quote and a separate reduced panel for a station, which is most of what made
  * adding a second solution feel half done.
  *
  * Everything it reads and writes comes through `target`, so it never learns whether
  * it is editing the quote or one station of it. See ApplicationTarget.
  */
function ApplicationForm({ target, quoteNo, customerName, onRead }: {
  target: ApplicationTarget;
  /** Stamped on the questionnaire so a returned one can be matched to its quote. */
  quoteNo?: string;
  customerName: string | null;
  onRead: (r: ParseResult | null) => void;
}) {
  const { notify, session } = useApp();
  const profile = target.profile;
  const onChange = (p: ApplicationProfile) => target.setProfile(p);
  const set = <K extends keyof ApplicationProfile>(k: K, v: ApplicationProfile[K]) =>
    onChange({ ...profile, [k]: v });
  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const [text, setText] = useState('');
  /* Which answers came back exactly, as opposed to being read out of prose. Worth
     distinguishing on screen: one is the customer's own figure and the other is this
     tool's guess at what a sentence meant. */
  const [imported, setImported] = useState<(keyof ApplicationProfile)[] | null>(null);

  /* A download, not a mail client.
     Opening the rep's mail client with an attachment is not something a web page can
     do, and pretending otherwise produces a button that works on one machine. This
     puts the file in their downloads folder and says so; attaching it is the one step
     they were always going to do by hand. */
  function sendQuestionnaire() {
    const html = buildQuestionnaire({
      quoteNo, customerName, lineName: target.name,
      repName: session?.displayName ?? null,
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Axim application questionnaire${
      customerName ? ` — ${customerName}` : ''}${
      target.name ? ` — ${target.name}` : ''}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoked on the next tick: revoking immediately races the download in Firefox.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    notify('Questionnaire downloaded — attach it to an email to the customer.');
  }
  const [result, setResult] = useState<ParseResult | null>(null);
  const evidence: Evidence = result?.evidence ?? {};

  /* One box, two readers.
     A returned questionnaire is exact — the customer's own answers, already in the
     right units — so it is read losslessly and nothing is inferred. Anything else is
     prose and goes to the keyword parser. The rep does not have to know which they
     have; the marker in the text decides, and pasting a reply that contains both an
     answers block and a paragraph of context reads the block and keeps the
     paragraph. */
  function readQuestionnaire(raw: string): boolean {
    const { profile: answers, found } = parseQuestionnaire(raw);
    if (!found.length) return false;
    onChange({ ...profile, ...answers });
    setImported(found);
    setResult(null);
    notify(`Read ${found.length} answer${found.length === 1 ? '' : 's'} from the questionnaire.`);
    return true;
  }

  function read() {
    if (readQuestionnaire(text)) return;
    setImported(null);
    const r = parseApplication(text);
    // Only fills what it found. A field the parser could not read keeps
    // whatever the rep already typed rather than being wiped by a blank.
    onChange({ ...profile, ...r.profile });
    /* The price book, but only when the enquiry NAMED one.
       An inferred book is a guess from a job description, and the tool has better
       evidence than a guess: it grades every machine in every book against this
       application. Setting the guess here filled technologyCode, which made the
       chooser's auto-pick stand down — so the guess silently outranked the grading.
       REPORTED: the sample enquiry landed on CIJ with 0 good fits and 9 caveats,
       while PIJ had 6 good ones.

       Said out loud — "a laser", "print and apply", "6440" — it still wins, because
       then the customer has told us and no amount of grading overrules that. */
    if (r.technologyNamed && r.technologyCode && r.technologyCode !== target.technologyCode) {
      target.setTechnology(r.technologyCode);
    }
    // Fields the enquiry says are unconstrained, merged with any the rep already
    // ticked — reading an email should not silently un-tick their answers.
    if (r.noConstraint.length) {
      target.setNoConstraint(
        [...new Set([...target.noConstraint, ...r.noConstraint])] as (keyof ApplicationProfile)[]);
    }
    setResult(
      r.filled || r.technologyCode || r.mentions.length || r.noConstraint.length ? r : null);
    onRead(r);
  }

  function clear() {
    setText('');
    setResult(null);
    onRead(null);
  }

  /* Start the application again.
     "Clear" above empties the paste box; it has never touched the answers, which is
     right — a rep who has read an email and then corrected two fields by hand does
     not want the box emptying their work. But there was no way to empty the work
     either, and a quote copied from another customer's arrives with a whole
     application that has to be unpicked field by field. Reported: "there should be a
     button to clear the application."

     Asked first, and through the app's own dialog, because twenty-eight answers is a
     real amount of typing to lose to a misplaced click. */
  const [clearing, setClearing] = useState(false);
  function clearApplication() {
    target.setProfile({ ...EMPTY_PROFILE });
    target.setNoConstraint([]);
    setText('');
    setResult(null);
    setImported(null);
    onRead(null);
    setClearing(false);
    notify('The application is empty. Nothing else on the quote changed.');
  }

  const missing = missingKeyFields(profile, target.noConstraint);
  const cameFrom = (k: keyof ApplicationProfile) => evidence[k];
  // Not a gate. A quote is allowed to be incomplete and most are early on — this
  // is so a rep can see how much a 'good fit' verdict actually rests on.
  const answered = Object.values(profile).filter(
    (v) => v !== null && v !== undefined && v !== '').length;

  return (
    <>
    {clearing && (
      <ConfirmDialog
        title="Clear the application?"
        body={(
          <p>
            All {answered} answer{answered === 1 ? '' : 's'} go, and the fit rules stop
            grading against them. The lines, the customer and the discounts stay.
          </p>
        )}
        confirmLabel="Clear it"
        onCancel={() => setClearing(false)}
        onConfirm={clearApplication}
      />
    )}
      {/* Paste the enquiry. Most of this arrives as an email and retyping it
          into eight fields is the tedious part of starting a quote. */}
      <div className="mb-4 border border-instr-200 bg-instr-100/50 p-3">
        <label className="block">
          <span className="label">Paste the customer's email, or describe the line</span>
          <textarea
            className="field mt-1 h-24 resize-y text-sm"
            placeholder={'"We need to code date and lot onto corrugated cases, about 300 a minute, '
              + 'dusty plant, two shifts. 5mm characters."'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary text-xs" onClick={read} disabled={!text.trim()}>
            Read it
          </button>
          {text && (
            <button type="button" className="btn-quiet text-xs" onClick={clear}>
              Clear the box
            </button>
          )}
          {answered > 0 && (
            <button type="button" className="btn-quiet text-xs" onClick={() => setClearing(true)}>
              Clear the application
            </button>
          )}
          {/* The file the customer sent back, rather than a paste. Same reader. */}
          <label className="btn-quiet cursor-pointer text-xs">
            Import a file
            <input type="file" accept=".txt,.text,text/plain" className="sr-only"
                   onChange={async (e) => {
                     const f = e.target.files?.[0];
                     if (!f) return;
                     const raw = await f.text();
                     if (!readQuestionnaire(raw)) {
                       setText(raw);
                       notify('No answers block in that file — its text is in the box to read.');
                     }
                     e.target.value = '';
                   }} />
          </label>

        </div>

        {/* Ask the customer, rather than guessing on their behalf.
            A rep has almost none of these 28 answers after the first call, and the
            person who knows the line speed is standing next to the line. Every grade,
            ranking and price-book recommendation downstream inherits whatever gets
            typed here — so a half-filled profile is not a display problem, it is the
            tool grading on a third of the evidence. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-instr-200 pt-2.5">
          <button type="button" className="btn-quiet text-xs" onClick={sendQuestionnaire}>
            Make a questionnaire to send
          </button>
          <p className="text-2xs text-steel-600">
            A one-page form to email. It works offline, sends nothing anywhere, and the
            answers come back as a block you paste above.
          </p>
        </div>

        {imported && (
          <div className="mt-3 border-t border-instr-200 pt-2.5">
            <p className="text-2xs font-semibold text-fit-800">
              Read {imported.length} answer{imported.length === 1 ? '' : 's'} straight from the
              questionnaire — the customer's own figures, not inferred.
            </p>
            <p className="mt-1 text-2xs text-steel-700">
              {imported.map((f) => FIELD_LABEL[f]).join(', ')}
            </p>
          </div>
        )}

        {result && (
          <div className="mt-3 space-y-2 border-t border-instr-200 pt-2.5">
            {result.technologyCode && (
              <p className="text-2xs text-steel-800">
                <span className="font-semibold text-instr-800">Price book</span>
                {' set to '}
                <span className="num font-semibold">{result.technologyCode}</span>
                {' from '}<span className="italic">&ldquo;{result.technologyWords}&rdquo;</span>
                {' — change it on the machine step if that is wrong.'}
              </p>
            )}

            {Object.keys(evidence).length > 0 && (
              <div>
                <p className="text-2xs font-semibold text-instr-800">
                  Read {Object.keys(evidence).length} field
                  {Object.keys(evidence).length === 1 ? '' : 's'} from that
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {(Object.keys(evidence) as (keyof ApplicationProfile)[]).map((k) => (
                    <li key={k} className="text-2xs text-steel-700">
                      <span className="font-semibold">{FIELD_LABEL[k]}</span>
                      {' from '}
                      <span className="italic">&ldquo;{evidence[k]}&rdquo;</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.machineHint && (
              <p className="text-2xs text-steel-800">
                <span className="font-semibold text-instr-800">Machine</span>
                {' — narrowed the machine list to '}
                <span className="num font-semibold">{result.machineHint}</span>
                {' from '}<span className="italic">&ldquo;{result.machineWords}&rdquo;</span>
              </p>
            )}

            {result.mentions.length > 0 && (
              <MentionedParts
                mentions={result.mentions}
                technologyCode={target.technologyCode}
                onAdd={target.addLine}
                chosen={target.chosen}
              />
            )}

            {missing.length > 0 && (
              <p className="text-2xs text-signal-800">
                Still needed for the fit rules to grade properly: {missing.join(', ')}.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <Field label="Substrate" hint={read_hint(cameFrom('substrate'))}>
            {/* A select, like every other choice on this panel.
                REPORTED: "the drop-boxes under the application aren't consistent.
                Substrate uses a different design/method than every other dropdown."
                It was an input with a datalist, which on Windows looks like a text
                box with a faint chevron, opens on typing rather than on click, and
                accepts anything — so the one field the fit rules key on hardest was
                also the one a typo could get through. The list is closed now, which
                it always effectively was: porosityFor only knows these names. */}
            <select className="field text-sm" value={profile.substrate ?? ''}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      // Picking a known substrate settles porosity too — it is a
                      // property of the material, not a second question.
                      const por = porosityFor(v);
                      onChange({ ...profile, substrate: v, porosity: por ?? profile.porosity });
                    }}>
              <option value="">Not stated</option>
              {SUBSTRATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
              {/* Whatever the parser read, if it is not one of ours. Dropping it
                  silently would throw away the customer's own word for the pack. */}
              {profile.substrate && !SUBSTRATE_NAMES.includes(profile.substrate) && (
                <option value={profile.substrate}>{profile.substrate}</option>
              )}
            </select>
          </Field>
          <AnyToggle target={target} field="substrate" />
        </div>
        <div className="min-w-0">
          <Field label="Surface" hint={read_hint(cameFrom('porosity'))}>
            <select className="field text-sm" value={profile.porosity ?? ''}
                    onChange={(e) => set('porosity', (e.target.value || null) as ApplicationProfile['porosity'])}>
              <option value="">Not stated</option>
              <option value="porous">Porous — paper, board, kraft</option>
              <option value="nonPorous">Non-porous — film, plastic, metal, glass</option>
              <option value="unknown">Not known yet</option>
            </select>
          </Field>
        </div>
        <div className="min-w-0">
          <Field label="Line speed" hint={read_hint(cameFrom('lineSpeedFpm')) ?? 'feet per minute'}>
            <input className="field num text-sm" inputMode="numeric" value={profile.lineSpeedFpm ?? ''}
                   onChange={(e) => set('lineSpeedFpm', num(e.target.value))} />
          </Field>
          <AnyToggle target={target} field="lineSpeedFpm" />
        </div>
        <div className="min-w-0">
          <Field label="Throw distance"
                 hint={read_hint(cameFrom('throwDistMm')) ?? 'millimetres, printhead to product'}>
            <input className="field num text-sm" inputMode="decimal" value={profile.throwDistMm ?? ''}
                   onChange={(e) => set('throwDistMm', num(e.target.value))} />
          </Field>
          <AnyToggle target={target} field="throwDistMm" />
        </div>
        <div className="min-w-0">
          <Field label="Character height" hint={read_hint(cameFrom('charHeightMm')) ?? 'millimetres'}>
            <input className="field num text-sm" inputMode="decimal" value={profile.charHeightMm ?? ''}
                   onChange={(e) => set('charHeightMm', num(e.target.value))} />
          </Field>
          <AnyToggle target={target} field="charHeightMm" />
        </div>
        <div className="min-w-0 sm:col-span-2 lg:col-span-3">
          <Field label="What has to be printed" hint={read_hint(cameFrom('messageContent'))}>
            <input className="field text-sm" value={profile.messageContent ?? ''}
                   placeholder="Best-before date, lot code, 2D matrix…"
                   onChange={(e) => set('messageContent', e.target.value || null)} />
          </Field>
        </div>
        <div className="min-w-0 sm:col-span-2 lg:col-span-3">
          <Field label="Environment" hint={read_hint(cameFrom('environment'))}>
            <EnvironmentPicker value={profile.environment}
                               onChange={(v) => set('environment', v)} />
          </Field>
          <AnyToggle target={target} field="environment" />
        </div>
      </div>

      {/* The rest of the application analysis.
          Axim's own forms ask all of this on every order. Eight fields are
          enough to start a quote and to grade it roughly, so those stay above;
          these are the ones that decide the harder calls, and several are the
          only thing a rule can read — the Ridgeline print-height rules need the
          marking window, and the guide-rail rules need to know there are none.
          Closed by default so the common path stays short. */}
      <details className="mt-4 border border-steel-200 bg-surface">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-instr-800 hover:bg-instr-100">
          The full application analysis
          <span className="ml-2 font-normal text-steel-600">
            {answered} of 30 answered
          </span>
        </summary>
        <div className="grid gap-4 border-t border-steel-200 p-3">
          <MoreFields title="The product">
            <Field label="Width" hint={read_hint(cameFrom('productWidthMm')) ?? 'mm'}>
              <input className="field num text-sm" inputMode="decimal" value={profile.productWidthMm ?? ''}
                     onChange={(e) => set('productWidthMm', num(e.target.value))} />
            </Field>
            <Field label="Length" hint={read_hint(cameFrom('productLengthMm')) ?? 'mm'}>
              <input className="field num text-sm" inputMode="decimal" value={profile.productLengthMm ?? ''}
                     onChange={(e) => set('productLengthMm', num(e.target.value))} />
            </Field>
            <Field label="Product temperature"
                   hint={read_hint(cameFrom('productTempF')) ?? '°F, the pack itself'}>
              <input className="field num text-sm" inputMode="numeric" value={profile.productTempF ?? ''}
                     onChange={(e) => set('productTempF', num(e.target.value))} />
            </Field>
          </MoreFields>

          {/* The label, not the product.
              A print-and-apply job is described by its label before anything else,
              and every figure a print engine publishes is about the label — media
              width 13 to 131 mm on a Kestrel K84X. Without these two the engines were
              quotable machines that no application could rule in or out.

              Shown for every book rather than only for print-and-apply: a rep often
              captures the application before choosing a technology, and a field that
              appears late is a field nobody fills in. It stays empty and silent where
              it does not apply, like every other field here. */}
          <MoreFields title="The label">
            <Field label="Label width" hint={read_hint(cameFrom('labelWidthMm')) ?? 'mm'}>
              <input className="field num text-sm" inputMode="decimal" value={profile.labelWidthMm ?? ''}
                     onChange={(e) => set('labelWidthMm', num(e.target.value))} />
            </Field>
            <Field label="Label length" hint={read_hint(cameFrom('labelLengthMm')) ?? 'mm'}>
              <input className="field num text-sm" inputMode="decimal" value={profile.labelLengthMm ?? ''}
                     onChange={(e) => set('labelLengthMm', num(e.target.value))} />
            </Field>
          </MoreFields>

          <MoreFields title="How the line runs">
            <div className="min-w-0">
              <Field label="Throughput"
                     hint={read_hint(cameFrom('throughputPpm')) ?? 'products per minute'}>
                <input className="field num text-sm" inputMode="numeric" value={profile.throughputPpm ?? ''}
                       onChange={(e) => set('throughputPpm', num(e.target.value))} />
              </Field>
              <AnyToggle target={target} field="throughputPpm" />
            </div>
            <Field label="Product spacing"
                   hint={read_hint(cameFrom('productSpacingMm')) ?? 'mm, gap between packs'}>
              <input className="field num text-sm" inputMode="decimal" value={profile.productSpacingMm ?? ''}
                     onChange={(e) => set('productSpacingMm', num(e.target.value))} />
            </Field>
            <Field label="Conveyor" hint={read_hint(cameFrom('conveyor'))}>
              <select className="field text-sm" value={profile.conveyor ?? ''}
                      onChange={(e) => set('conveyor', (e.target.value || null) as ApplicationProfile['conveyor'])}>
                <option value="">Not stated</option>
                <option value="new">New — quoted with the system</option>
                <option value="existing">Existing — fitting to theirs</option>
              </select>
            </Field>
            <Field label="Guide rails" hint={read_hint(cameFrom('guideRails'))}>
              <select className="field text-sm" value={profile.guideRails ?? ''}
                      onChange={(e) => set('guideRails', (e.target.value || null) as ApplicationProfile['guideRails'])}>
                <option value="">Not stated</option>
                <option value="yes">Yes — product is held in position</option>
                <option value="no">No — it can drift across the belt</option>
              </select>
            </Field>
            <Field label="Product status" hint={read_hint(cameFrom('productMotion'))}>
              <select className="field text-sm" value={profile.productMotion ?? ''}
                      onChange={(e) => set('productMotion', (e.target.value || null) as ApplicationProfile['productMotion'])}>
                <option value="">Not stated</option>
                <option value="moving">Moving when marked</option>
                <option value="stationary">Stationary when marked</option>
              </select>
            </Field>
          </MoreFields>

          <MoreFields title="What gets printed">
            <Field label="Lines of print" hint={read_hint(cameFrom('linesOfPrint'))}>
              <input className="field num text-sm" inputMode="numeric" value={profile.linesOfPrint ?? ''}
                     onChange={(e) => set('linesOfPrint', num(e.target.value))} />
            </Field>
            <div className="min-w-0">
              {/* "height available to print in" is what this always meant and the
                  rules read it as the height REQUIRED, which is the opposite — so a
                  roomy pack ruled out every head. The rules are fixed; the wording is
                  sharpened so the next reader cannot make the same swap. */}
              <Field label="Room to print in"
                     hint={read_hint(cameFrom('markingWindowMm'))
                       ?? 'mm of clear space on the pack — not the height of the code'}>
                <input className="field num text-sm" inputMode="decimal" value={profile.markingWindowMm ?? ''}
                       onChange={(e) => set('markingWindowMm', num(e.target.value))} />
              </Field>
              <AnyToggle target={target} field="markingWindowMm" />
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-3">
              <Field label="Barcode requirements"
                     hint={read_hint(cameFrom('barcodeRequirements')) ?? 'symbology, grade, who verifies it'}>
                <input className="field text-sm" value={profile.barcodeRequirements ?? ''}
                       placeholder="GS1-128, grade C or better, verified on the line…"
                       onChange={(e) => set('barcodeRequirements', e.target.value || null)} />
              </Field>
            </div>
            <div className="min-w-0 sm:col-span-2">
              {/* The one field that says which side of the resolution/speed trade the
                  customer needs. Without it every rule about resolution could only
                  describe the trade, never come down on it. */}
              <Field label="Print quality needed"
                     hint={read_hint(cameFrom('printQuality')) ?? 'what the code has to be good enough for'}>
                <select className="field text-sm" value={profile.printQuality ?? ''}
                        onChange={(e) => set('printQuality',
                          (e.target.value || null) as ApplicationProfile['printQuality'])}>
                  <option value="">Not stated</option>
                  <option value="humanReadable">Read by a person — date, lot, batch</option>
                  <option value="scannable">A barcode that has to scan</option>
                  <option value="graded">A barcode checked to a grade</option>
                  <option value="graphics">A logo, or retail-quality print</option>
                </select>
              </Field>
            </div>
            <AnyToggle target={target} field="printQuality" />
          </MoreFields>

          <MoreFields title="Ink and adhesion">
            <Field label="Ink type" hint={read_hint(cameFrom('inkType'))}>
              <input className="field text-sm" value={profile.inkType ?? ''}
                     placeholder="Black MEK, food grade, thermochromic…"
                     onChange={(e) => set('inkType', e.target.value || null)} />
            </Field>
            <Field label="Dry time available"
                   hint={read_hint(cameFrom('dryTimeSeconds')) ?? 'seconds before the next contact'}>
              <input className="field num text-sm" inputMode="decimal" value={profile.dryTimeSeconds ?? ''}
                     onChange={(e) => set('dryTimeSeconds', num(e.target.value))} />
            </Field>
            <div className="min-w-0 sm:col-span-2 lg:col-span-3">
              <Field label="Adhesion requirements" hint={read_hint(cameFrom('adhesionRequirements'))}>
                <input className="field text-sm" value={profile.adhesionRequirements ?? ''}
                       placeholder="Must survive ice water, rub test, 90 days outdoors…"
                       onChange={(e) => set('adhesionRequirements', e.target.value || null)} />
              </Field>
            </div>
          </MoreFields>

          <MoreFields title="The room, not the pack">
            <Field label="Coldest ambient"
                   hint={read_hint(cameFrom('ambientTempMinF')) ?? '°F'}>
              <input className="field num text-sm" inputMode="numeric" value={profile.ambientTempMinF ?? ''}
                     onChange={(e) => set('ambientTempMinF', num(e.target.value))} />
            </Field>
            <Field label="Hottest ambient"
                   hint={read_hint(cameFrom('ambientTempMaxF')) ?? '°F — what the datasheets rate against'}>
              <input className="field num text-sm" inputMode="numeric" value={profile.ambientTempMaxF ?? ''}
                     onChange={(e) => set('ambientTempMaxF', num(e.target.value))} />
            </Field>
          </MoreFields>

          <MoreFields title="Evidence">
            <Field label="Sample tested" hint={read_hint(cameFrom('sampleTested'))}>
              <select className="field text-sm" value={profile.sampleTested ?? ''}
                      onChange={(e) => set('sampleTested', (e.target.value || null) as ApplicationProfile['sampleTested'])}>
                <option value="">Not stated</option>
                <option value="yes">Yes — a sample was run</option>
                <option value="no">No — this is all from description</option>
              </select>
            </Field>
            <div className="min-w-0 sm:col-span-2">
              <Field label="Notes" hint={read_hint(cameFrom('notes'))}>
                <textarea className="field h-16 resize-y text-sm" value={profile.notes ?? ''}
                          placeholder="Anything the fields above cannot hold"
                          onChange={(e) => set('notes', e.target.value || null)} />
              </Field>
            </div>
          </MoreFields>
        </div>
      </details>
    </>
  );
}

/**
 * The quote's own application, as a step on the builder.
 *
 * A thin wrapper: the form is ApplicationForm and a station gets exactly the same one.
 * This owns only the step chrome and the summary line, which belong to the quote.
 */
function ApplicationSection({ draft, patch, onRead, quoteNo, open, onToggle }: {
  draft: QuoteDraft;
  patch: (p: Partial<QuoteDraft>) => void;
  onRead: (r: ParseResult | null) => void;
  quoteNo?: string;
  open: boolean; onToggle: () => void;
}) {
  const profile = draft.profile;
  return (
    <Step title="The application" open={open} onToggle={onToggle}
          summary={[profile.substrate, profile.lineSpeedFpm && `${profile.lineSpeedFpm} fpm`]
            .filter(Boolean).join(' · ') || undefined}>
      <ApplicationForm
        target={quoteApplication(draft, patch)}
        quoteNo={quoteNo}
        customerName={draft.customerName}
        onRead={onRead}
      />
    </Step>
  );
}

/**
 * Parts the enquiry asked for by name.
 *
 * Offered, never added. "We'll need a stand" does not say which stand, and
 * there are 53 of them — putting one on a quote unasked is exactly the guess
 * this tool refuses to make. So each mention expands into the matching parts
 * and the rep picks.
 */
function MentionedParts({ mentions, technologyCode, onAdd, chosen }: {
  mentions: Mention[];
  technologyCode: string;
  onAdd: (itemNo: string) => void;
  chosen: Set<string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const hits = useAsync(
    () => (open
      ? api.searchItems({
          q: mentions.find((m) => m.query === open)!.query,
          role: mentions.find((m) => m.query === open)!.role,
          technology: technologyCode,
          limit: 6,
        })
      : Promise.resolve([])),
    [open, technologyCode],
  );

  return (
    <div>
      <p className="text-2xs font-semibold text-instr-800">
        Also asked for — pick the right part, none are added for you
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {mentions.map((m) => (
          <button
            key={m.query}
            type="button"
            aria-expanded={open === m.query}
            onClick={() => setOpen(open === m.query ? null : m.query)}
            className={`rounded border px-2 py-1 text-2xs font-semibold transition-colors ${
              open === m.query
                ? 'border-instr-600 bg-instr-200 text-instr-800'
                : 'border-instr-300 bg-surface text-instr-700 hover:bg-instr-100'}`}
          >
            {m.label}
            <span className="ml-1.5 font-normal italic text-steel-600">
              &ldquo;{m.words}&rdquo;
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div className="mt-2 border border-rule bg-surface">
          {hits.loading && <Skeleton rows={2} />}
          {hits.data && hits.data.length === 0 && (
            <p className="text-2xs text-steel-600">
              Nothing in {technologyCode} matches that. Search for it under
              &ldquo;What is on the quote&rdquo;.
            </p>
          )}
          {hits.data && hits.data.length > 0 && (
            <ul className="divide-y divide-steel-100">
              {hits.data.map((it: Item) => (
                <li key={it.itemNo}>
                  <button
                    type="button"
                    disabled={chosen.has(it.itemNo)}
                    onClick={() => onAdd(it.itemNo)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-steel-50 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-2xs text-steel-900">{it.description}</span>
                      <span className="num block text-2xs text-steel-600">{it.itemNo}</span>
                    </span>
                    <span className="num shrink-0 text-2xs text-steel-700">
                      {chosen.has(it.itemNo) ? 'on the quote' : money(it.listPrice)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Technologies with no machine to pick, and the true reason for each.
 *
 * This used to name three technologies and give one reason — that the machine is
 * specified by an application engineer. That was right about the laser price pages
 * and wrong about the other two: the thermal jet and valve jet machines were simply
 * never extracted, because the first price-page extract only read sheets whose names
 * it recognised and those two books name theirs differently. Both are in the
 * catalogue now, so only the laser is left here, with the reason it actually has.
 */
const ENGINEERED: Record<string, string | undefined> = {
  LSR: 'A laser is configured rather than picked — the part number is assembled from '
    + 'option codes for power, wavelength, enclosure rating and marking head, so there '
    + 'is no finished machine to list. The extraction, stands and consumables below are '
    + 'priced and quotable. See data/laser-configurator.md for what building the '
    + 'configurator would take.',
};

/**
 * One step for the machine and everything it needs.
 *
 * "Which machine" and "Configure the solution" were two steps and one decision. The
 * body lives in SolutionSection.tsx; this is the step wrapper, so the price-book
 * chooser stays owned by this file.
 */
function SolutionSection({ draft, patch, ev, hint, role, setRole, open, onToggle,
                          solution, index, title, chooser, multi,
                          applicationOpen, setApplicationOpen, onDelete }: {
  draft: QuoteDraft; patch: (p: Partial<QuoteDraft>) => void; ev: Evaluation | null;
  hint: string | null; role: string; setRole: (r: string) => void;
  open: boolean; onToggle: () => void;
  /** The station: its id, its name, and the price book it is quoted from. */
  solution: Solution;
  /** Where it sits on the quote, for the placeholder name only. */
  index: number;
  title: string;
  chooser?: React.ReactNode;
  /** True once the quote holds more than one solution. */
  multi: boolean;
  applicationOpen: boolean;
  setApplicationOpen: (v: boolean) => void;
  /** Absent on the last remaining solution — a quote needs at least one. */
  onDelete?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  /* What this station's own parser read, so "we want an 6440" narrows THIS station's
     machine list the way it narrows the quote's. Without it the station had the
     parser and none of what the parser is for. Its own reading wins over the
     quote's, and falls back to it while the station has read nothing. */
  const [read, setRead] = useState<ParseResult | null>(null);
  const book = solution.technologyCode;
  /* This solution's own lines, by station rather than by book. The summary of a
     collapsed solution has to describe THAT solution — a quote with a coder and an
     applicator on it showed both machines under whichever heading happened to be
     first, and two stations sharing a book showed each other's everything. */
  const mine = (ev?.lines ?? []).filter((l) => l.solutionId === solution.id);
  const machine = mine.find((l) => l.itemRole === 'printer');
  const money0 = mine.reduce((n, l) => n + (l.extendedNet ?? 0), 0);
  const ownAnswers = Object.keys(solution.profile ?? {}).length;
  return (
    <Step
      title={title}
      open={open}
      onToggle={onToggle}
      summary={[
        book && book !== UNRESOLVED_TECHNOLOGY ? book : 'no price book yet',
        machine ? machine.description : 'no machine yet',
      ].filter(Boolean).join(' · ')}
      aside={<span className="num text-2xs text-steel-600">
        {mine.length} line{mine.length === 1 ? '' : 's'}
        {money0 > 0 ? ` · ${money(money0)}` : ''}
      </span>}
    >
      {/* Name it, answer the application, then configure it — in that order, and the
          same order for every solution on the quote. The second used to start at
          "configure": no name of its own, and its application behind a disclosure
          reading "All from the first solution" that a rep had no reason to open. */}
      {multi && (
        <div className="band">
          <div className="band-legend flex flex-wrap items-baseline justify-between gap-2">
            <span>This solution</span>
            {onDelete && (confirmDelete ? (
              <span className="flex items-center gap-2">
                <span className="text-2xs text-steel-600">
                  {mine.length
                    ? `Remove it and its ${mine.length} line${mine.length === 1 ? '' : 's'}?`
                    : 'Remove it?'}
                </span>
                <button type="button" className="btn-quiet text-2xs text-danger-700"
                        onClick={onDelete}>Remove</button>
                <button type="button" className="btn-quiet text-2xs"
                        onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              /* Asked before it happens, because the lines go with it and a priced
                 line disappearing from the total is not something to discover later. */
              <button type="button" className="btn-quiet text-2xs"
                      onClick={() => setConfirmDelete(true)}>
                Remove this solution
              </button>
            ))}
          </div>
          <div className="px-4 py-3">
            <label className="label" htmlFor={`sol-name-${solution.id}`}>
              Line or application name
            </label>
            <input id={`sol-name-${solution.id}`} className="field mt-1 text-sm"
                   value={solution.name ?? ''}
                   placeholder={`Solution ${index + 1}`}
                   onChange={(e) => patch({
                     solutions: draft.solutions.map((x) => (x.id === solution.id
                       ? { ...x, name: e.target.value || null } : x)),
                   })} />
            {/* The example is deliberately not the shape of the demo quote's own line
                name: sitting under a filled box, an example that matches the value
                above it reads as a description of that value rather than as a hint. */}
            <p className="mt-1 text-2xs text-steel-600">
              What you will recognise this station by, such as &ldquo;filler 2 &mdash;
              date code&rdquo;. It heads this section and its own block on the quote.
            </p>
          </div>
        </div>
      )}
      {/* The same application form the quote gets — same paste box, same parser, same
          questionnaire import, same fields. It used to be a reduced panel of the
          twenty-eight questions with none of that, which is most of what made adding
          a second solution feel like a different job from building the first.

          It inherits: every field shows the quote's answer until this station gives
          its own, so a station that differs in nothing costs nothing to say. */}
      {multi && (
        <div className="band">
          <div className="band-legend flex flex-wrap items-baseline justify-between gap-2">
            <span>The application at this station</span>
            <button type="button" className="btn-quiet text-2xs"
                    onClick={() => setApplicationOpen(!applicationOpen)}>
              {applicationOpen ? 'Hide' : ownAnswers
                ? `${ownAnswers} answer${ownAnswers === 1 ? '' : 's'} of its own`
                : 'All from the quote'}
            </button>
          </div>
          {applicationOpen && (
            <div className="px-4 py-3">
              <p className="mb-3 text-2xs leading-relaxed text-steel-600">
                Every field starts as the quote&rsquo;s answer and follows it when it
                changes. Anything you type or read in here becomes this station&rsquo;s
                own. This is where a coder on the bottle and an applicator on the case
                stop sharing a pack size.
              </p>
              <ApplicationForm
                target={solutionApplication(draft, patch, solution)}
                customerName={draft.customerName}
                onRead={setRead}
              />
            </div>
          )}
        </div>
      )}
      <SolutionBody
        draft={draft} patch={patch} ev={ev} role={role} setRole={setRole}
        hint={read?.machineHint ?? hint}
        book={book} solutionId={solution.id} chooser={chooser}
      />
      {ownAnswers > 0 && !applicationOpen && (
        <p className="px-4 pb-3 text-2xs text-steel-600">
          Graded against {ownAnswers} answer{ownAnswers === 1 ? '' : 's'} of its own.
        </p>
      )}
    </Step>
  );
}


/**
 * Add a second solution.
 *
 * REPORTED: "I'm not seeing how you add another tech to a quote." There was no way that
 * a person would find — the price book chips at the top of the section CLEARED the quote
 * when clicked, with a caption saying so, and the only control that added a book was a
 * dropdown at the bottom of the catalogue panel behind a button reading "Search all of
 * CIJ".
 *
 * This is the shape it was asked for: configure one, collapse it, add another, configure
 * that one. It offers only books that are not already on the quote, and it says what
 * each holds, because "PALM" on its own does not tell a rep whether the applicator they
 * want is in there.
 */
function AddSolution({ draft, onAdd }: {
  draft: QuoteDraft;
  onAdd: (book: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const techs = useAsync(() => api.listTechnologies(), []);
  /* Every book, including ones already on the quote.
     It used to offer only the books not in use, because a solution WAS a book — so a
     rep quoting two production lines that both need a CIJ coder found the book they
     wanted missing from the list, with nothing saying why. */
  const left = techs.data ?? [];

  // Nothing to add to a quote with no book yet: that decision is the chooser's.
  if (!draft.technologyCode || left.length === 0) return null;

  if (!open) {
    return (
      <div className="mt-3">
        <button type="button" className="btn-quiet text-xs" onClick={() => setOpen(true)}>
          + Add another solution
        </button>
        <p className="mt-1 text-2xs text-steel-600">
          For a line that needs a second machine — a coder at one station and an
          applicator at another, or two lines each wanting their own. Each is named,
          answers the application its own way, and is priced and graded against its
          own book.
        </p>
      </div>
    );
  }
  return (
    <div className="panel mt-3">
      <div className="panel-head">
        <span>Which book is this solution in?</span>
        <button type="button" className="btn-quiet text-2xs" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <div className="grid gap-1.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {left.map((t) => (
          <button key={t.code} type="button" data-tap="chip"
                  onClick={() => { onAdd(t.code); setOpen(false); }}
                  className="min-w-0 rounded-[2px] border border-rule bg-surface px-3 py-1.5
                             text-left transition-colors hover:border-instr-400 hover:bg-steel-50">
            <span className="num block text-xs font-bold text-steel-900">{t.code}</span>
            <span className="num block text-2xs text-steel-600">
              {t.machineCount} machine{t.machineCount === 1 ? '' : 's'} · {t.itemCount} parts
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


/**
 * Nothing leaves until it has been looked at.
 *
 * Send used to fire on the first click: no preview, no availability, and it
 * would go out with no customer and no address. A quote is the thing the
 * customer sees, so the rep sees it first — what is on it, what it costs, when
 * it can be delivered, and the note going with it.
 */
/* Exported: a saved quote goes through the same gate. It used to submit
   straight from the detail screen with no review, no recipient and no covering
   note, which meant the review step only protected quotes that happened to be
   sent from the builder. */
export function SendDialog({
  draft, ev, quoteNo, busy, onClose, onSend, quoteApprovals,
}: {
  draft: QuoteDraft;
  ev: Evaluation | null;
  quoteNo?: string;
  busy: boolean;
  onClose: () => void;
  onSend: (to: string, note: string) => void;
  /**
   * The decisions already on file for this quote.
   *
   * Absent on a quote that has never been saved, which has none by definition. With
   * them the dialog can tell "needs an approval" from "is waiting on one", and those
   * are different sentences to put in front of a rep.
   */
  quoteApprovals?: QuoteApproval[];
}) {
  const [to, setTo] = useState(draft.recipientEmail ?? '');
  /* The company defaults for the customer's copy, so this preview is the document
     as configured. The quote's own overrides ride on draft.document and QuoteDocument
     layers them on top. */
  const docDefaults = useAsync(() => api.getDocumentDefaults(), []).data ?? null;
  /* The contacts Orbit holds for this account. Searching by the customer number
     rather than the name, because two accounts can share a name and only one can
     share a number. */
  const contactHits = useAsync(
    () => (draft.customerNo ? api.searchCustomers(draft.customerNo) : Promise.resolve([])),
    [draft.customerNo],
  );
  const contacts = (contactHits.data ?? [])
    .find((c) => c.customerNo === draft.customerNo)?.contacts ?? [];
  const [note, setNote] = useState(draft.coveringNote ?? '');
  const [tab, setTab] = useState<'availability' | 'document'>('document');
  const { session } = useApp();
  /* Who else gets it. Shown rather than offered: copying the manager is policy, so
     a checkbox here would be a control that must not be unticked. */
  const manager = session?.approver ?? null;

  /* Escape closes it. It is aria-modal, so a keyboard user who opened it by mistake
     had no way out but to find the Close button — and this is the one dialog in the
     tool standing between a rep and a customer, so being stuck in it is worse here
     than anywhere else. Closing only abandons the review; the draft is untouched. */
  /**
   * The dialog takes the focus, keeps it, and gives it back.
   *
   * Escape already closed it. Everything else was missing: focus stayed on <body>, the
   * 114 tabbable elements behind it stayed reachable, the page behind still scrolled,
   * and closing left focus nowhere. This is the one gate between a rep and a customer,
   * and it was the least keyboard-operable surface in the app.
   */
  const panel = useRef<HTMLDivElement>(null);
  /* Escape, focus in, focus trapped, shell hidden, focus back — see useModal. The
     recipient field takes focus where there is one, because that is the thing every
     send needs and the thing most often missing. */
  useModal({ panel, onClose, focusFirst: 'input[type="email"]' });

  // Availability is asked for, not assumed. Every line, worst date wins.
  const promises = useAsync(
    async () => (tab === 'availability'
      ? Promise.all(draft.lines.map((l) => api.getItemPromise(l.itemNo, l.quantity)))
      : []),
    [tab, JSON.stringify(draft.lines)],
  );

  /* Two different acts wearing one dialog.
     With an approval outstanding nothing reaches the customer — the quote goes to a
     manager and waits. The customer's address is not needed to do that and asking for
     it is what made the two indistinguishable, so it is not asked for. It is asked
     for later, on the quote, when the thing being done really is sending. */
  /* Outstanding, not merely required.
     This asked "does this quote require approval", and a 45% quote requires one for
     ever — approving it does not change the rules, it adds a decision. So the dialog
     went on calling itself "Send for approval" after the approval had been granted,
     and a rep who touched the customer copy of an approved quote was sent round the
     loop again. REPORTED.

     The quote screen learned this once already, in isCovered. The dialog is the other
     half of the same question and was never told. */
  const decided = quoteApprovals ?? [];
  const approvals = (ev?.requiredApprovals ?? []).filter((r) => !isCovered(r, decided));
  const forApproval = approvals.length > 0;
  const approver = approvals[0];

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to.trim());
  const problems: string[] = [];
  if (!draft.customerName && !draft.customerNo) problems.push('no customer');
  if (!forApproval) {
    if (!to.trim()) problems.push('no email address');
    else if (!emailOk) problems.push('the email address is not valid');
  }
  if (!draft.lines.length) problems.push('nothing on the quote');
  if (ev?.blocked) problems.push('a rule is blocking it');

  const rows = ev?.lines ?? [];
  const ready = promises.data?.length
    ? promises.data.map((p) => p.covering?.promisedDt).filter(Boolean).sort().slice(-1)[0]
    : null;

  return (
    <ModalLayer>
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4">
      {/* Bounded by the window, and it scrolls inside itself.
          Showing the real document here made the dialog as tall as the document —
          1,633px in a 720px window, with overflow hidden — so everything below the
          fold, the send controls included, could not be reached at all. The band and
          the footer stay put and only the middle scrolls, because the one thing a
          rep must always be able to find in this dialog is the way out of it. */}
      <div ref={panel} role="dialog" aria-modal="true" aria-label={forApproval ? "Send for approval" : "Review before sending"}
           /* 4rem, not 2: the backdrop has 1rem of padding and this has 1rem of margin,
              top and bottom, so a ceiling of 100vh-2rem still hung 12px past the
              bottom of the window. */
           className="my-4 flex max-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-edge bg-surface shadow-lift">
        {/* The last gate gets the instrument's own face, not a plain title bar.
            Everywhere else the navy band means "this is the live state of the thing
            you are working on"; here it means "this is what is about to leave", and
            the state reading answers the only question that matters at this moment.
            The detail stays in the footer — a reading says whether you may send, a
            sentence says why not. */}
        <header className="fascia border-b-2 border-instr-400 bg-navy-900 px-4 py-2 text-white">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 className="h-display text-base text-white">
              {forApproval ? 'Send for approval' : 'Review before sending'}
            </h2>
            <button type="button" className="btn-quiet text-xs" onClick={onClose}>Close</button>
          </div>
          <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t border-navy-700 pt-2">
            <Reading label="Lines" value={String(rows.length)} />
            <Reading label="Order total" value={money(ev?.orderTotal)} lead />
            <div className="flex items-baseline gap-2">
              <dt className="text-2xs font-semibold uppercase tracking-wider text-navy-300">State</dt>
              <dd className="text-xs font-semibold">
                {problems.length ? (
                  <span className="text-fascia-alert">
                    {problems.length} thing{problems.length === 1 ? '' : 's'} to fix first
                  </span>
                ) : forApproval ? (
                  <span className="text-fascia-signal">for approval</span>
                ) : (
                  <span className="text-fascia-fit">ready to send</span>
                )}
              </dd>
            </div>
          </dl>
        </header>

        {/* One scrolling column: the form, the tabs and whatever the tabs show.
            The form used to be pinned above tabs that scrolled, which on a phone left
            the document with no room and no way to reach it. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-rule px-4 py-3">
          {forApproval ? (
            /* Who it is going to, and what they are being asked.
               Not an address field: nothing reaches the customer while this is
               outstanding, and a box asking for their email said otherwise. */
            <div className="border border-signal-200 bg-signal-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-signal-800">
                Goes to {session?.approver?.displayName ?? 'an approver'}
              </p>
              <ul className="mt-1.5 space-y-1">
                {approvals.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-2xs text-signal-800">
                    {a.ruleCode && <RuleCodeChip code={a.ruleCode} tone="warn" />}
                    <span className="min-w-0">{a.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Send to" error={to && !emailOk ? 'That is not a valid address.' : undefined}
                   hint={contacts.length > 1
                     ? 'Orbit holds more than one contact for this account.'
                     : contacts.length === 0 && draft.customerNo
                       ? 'Orbit holds no contact for this account.'
                       : undefined}>
              <input className="field text-sm" type="email" value={to}
                     placeholder="name@customer.com"
                     onChange={(e) => setTo(e.target.value)} />
            </Field>
            {/* Orbit's contacts, offered rather than chosen.
                Filling the first one silently is wrong on an account with four:
                the tool would be picking who receives a commercial document, and
                would be wrong often enough that a rep learns to check it anyway —
                at which point it has saved nothing and cost trust. So: one click
                each, and the field stays typeable for a contact Orbit has never
                heard of, which is most of them the first time. */}
            {contacts.length > 0 && (
              <div className="sm:col-span-2 -mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-2xs text-steel-600">From Orbit:</span>
                {contacts.map((c) => (
                  <button key={c.email} type="button" data-tap="chip"
                          aria-pressed={to === c.email}
                          onClick={() => setTo(c.email)}
                          className={`rounded border px-2 py-1 text-2xs transition-colors ${
                            to === c.email
                              ? 'border-instr-600 bg-instr-100 text-instr-800'
                              : 'border-rule bg-surface text-steel-700 hover:border-instr-400'}`}>
                    <span className="font-semibold">{c.name}</span>
                    {c.title && <span className="text-steel-600"> · {c.title}</span>}
                  </button>
                ))}
              </div>
            )}
            <Field label="Customer">
              <span className="flex h-[34px] items-center text-sm text-steel-900">
                {draft.customerName ?? <span className="text-alert-800">Not set</span>}
                {draft.customerNo && (
                  <span className="num ml-2 text-2xs text-steel-600">{draft.customerNo}</span>
                )}
              </span>
            </Field>
            <Field label="Copy to">
              <span className="flex h-[34px] items-center gap-2 text-sm text-steel-900">
                {manager
                  ? <>
                      {manager.displayName}
                      {manager.email && (
                        <span className="num text-2xs text-steel-600">{manager.email}</span>
                      )}
                    </>
                  /* Not an error. The quote still sends; it just cannot be copied,
                     and the rep should know that before it goes rather than after. */
                  : <span className="text-signal-800">No manager on the reporting line</span>}
              </span>
            </Field>
          </div>
          )}
          <div className="mt-3">
            <Field label={forApproval ? 'Note to the approver' : 'Note to go with it'}
                   hint={forApproval ? 'Why, in one line.' : undefined}>
              <textarea className="field h-14 resize-y text-sm sm:h-20" value={note}
                        placeholder={forApproval
                          ? 'e.g. matching a competitor quote on a three-line rollout.'
                          : 'Anything the customer should read before the numbers.'}
                        onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="border-b border-rule px-4 py-2">
          <Segmented
            label="What to check"
            value={tab}
            onChange={setTab}
            options={[
              /* One customer copy. There were two: this dialog drew its own table,
                 logo and photograph, and a second tab rendered QuoteDocument — the
                 component that honours the layout switches. So the settings a rep
                 had just chosen did nothing to the thing they were about to send. */
              { value: 'document', label: 'The quote', count: rows.length },
              { value: 'availability', label: 'Availability' },
            ]}
          />
        </div>

        {tab === 'document' && (
          <div className="bg-steel-100 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-2xs text-steel-700">
                What the customer receives. No list price, no discount, no margin —
                only what they pay.
              </p>
              {/* Print, not a generated file. The browser's own PDF writer makes a
                  better document than this app could assemble — real fonts,
                  selectable text, correct pagination — and needs no dependency in a
                  build that has to stay one openable file. "Save as PDF" is the
                  destination in the print dialog on every platform the reps use. */}
              <span className="flex gap-2">
                {quoteNo && (
                  <button type="button" className="btn-quiet text-2xs"
                          onClick={() => { window.location.hash = `#/quotes/${quoteNo}/document`; }}>
                    Edit how it looks
                  </button>
                )}
                <button type="button" className="btn-quiet text-2xs"
                        onClick={() => window.print()}>
                  Print or save as PDF
                </button>
              </span>
            </div>
            {/* The same PaperFrame the customer-copy page uses: a fixed 816px page
                scaled to the width available, rather than a narrower document. A
                preview that reflows is a preview of something else. */}
            <PaperFrame>
              {/* settings, so this is the document as configured rather than as
                  shipped: the customer-copy page writes them and this reads them. */}
              <QuoteDocument draft={draft} ev={ev} quoteNo={quoteNo} settings={docDefaults}
                             repName={session?.displayName} repEmail={session?.email}
                             repPhone={session?.phone} />
            </PaperFrame>
          </div>
        )}

        {tab === 'availability' && (
          <div className="px-4 py-3">
            {promises.loading && <Skeleton rows={3} />}
            {promises.data && promises.data.length > 0 && (
              <>
                <p className="mb-2 text-xs text-steel-800">
                  Complete order ready <span className="num font-semibold">{ready ? shortDate(ready) : 'not datable'}</span>
                  {' — the slowest line decides it.'}
                </p>
                <ul className="divide-y divide-steel-100 border border-rule">
                  {promises.data.map((p) => (
                    <li key={p.itemNo} className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-steel-900">{p.description}</span>
                        <span className="block text-2xs text-steel-600">
                          {p.covering?.explanation ?? 'no supply covers this quantity yet'}
                        </span>
                      </span>
                      <span className="num text-right text-xs text-steel-900">
                        {p.covering ? shortDate(p.covering.promisedDt) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                {promises.data[0] && (
                  <p className="mt-2">
                    <FreshnessNote asOf={promises.data[0].asOf} freshness={promises.data[0].freshness} />
                  </p>
                )}
              </>
            )}
          </div>
        )}

        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-steel-50 px-4 py-3">
          <p className="text-2xs text-steel-700">
            {problems.length
              ? <span className="font-semibold text-alert-800">Cannot send: {problems.join(', ')}.</span>
              : forApproval
                ? (
                  <span className="font-semibold text-signal-800">
                    Goes to {session?.approver?.displayName
                      ?? approver?.approverRole ?? 'an approver'}.
                  </span>
                )
                : <>Goes to <span className="num font-semibold">{to}</span>{quoteNo ? ` as ${quoteNo}` : ''}.</>}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-quiet text-xs" onClick={onClose}>Keep editing</button>
            <button type="button" className="btn-primary text-xs"
                    disabled={busy || problems.length > 0}
                    onClick={() => onSend(to.trim(), note)}>
              {forApproval ? 'Send for approval' : 'Send it to the customer'}
            </button>
          </div>
        </footer>
      </div>
    </div>
    </ModalLayer>
  );
}

/* ---------------------------------------------------------------- the rail */

const STATUS_ORDER: QuoteTraceEntry['status'][] = ['blocked', 'action', 'warning', 'satisfied', 'info'];
const STATUS_TONE: Record<QuoteTraceEntry['status'], string> = {
  blocked: 'block', action: 'warn', warning: 'warn', satisfied: 'ok', info: 'info',
};
const STATUS_WORD: Record<QuoteTraceEntry['status'], string> = {
  blocked: 'Blocking', action: 'Needs action', warning: 'Worth knowing',
  satisfied: 'Satisfied', info: 'For information',
};

/**
 * What a rule that named a KIND of part should be called on a button.
 *
 * Role codes are what the data says; these are what a rep says. "Show me the
 * accessories" is not how anybody describes looking for a bracket.
 */
/**
 * The kinds, in the order somebody configures a system.
 *
 * Machine first because it is what everything else hangs off, then the things it
 * cannot run without, then the things it is mounted on, then the labour. Not
 * alphabetical, and not the order the enum happens to be declared in — the order the
 * job is done in.
 */
const KINDS: { value: string; label: string }[] = [
  { value: '', label: 'Everything' },
  { value: 'printer', label: 'Machines' },
  { value: 'printhead', label: 'Print heads' },
  { value: 'consumable', label: 'Consumables' },
  { value: 'accessory', label: 'Accessories' },
  { value: 'spare', label: 'Spares' },
  { value: 'service', label: 'Service' },
  { value: 'part', label: 'Other parts' },
];

export const PICK_WORD: Record<string, string> = {
  accessory: 'Find a mount or bracket',
  consumable: 'Find the ink or ribbon',
  service: 'Find an installation',
  spare: 'Find a spare',
  printhead: 'Find a print head',
  printer: 'Find a machine',
};

function SummaryRail({ ev, loading, error, draft, patch, onFix, onPick, cats }: {
  ev: Evaluation | null;
  loading: boolean;
  error: string | null;
  draft: QuoteDraft;
  patch: (p: Partial<QuoteDraft>) => void;
  onFix?: (parts: { itemNo: string; quantity: number }[]) => void;
  onPick?: (role: string) => void;
  cats: DiscountCategory[];
}) {
  const down = downPayment(draft.document ?? DEFAULT_DOCUMENT, ev?.orderTotal ?? 0);
  const lineCount = draft.lines.length;
  const grouped = useMemo(() => {
    const g = new Map<QuoteTraceEntry['status'], QuoteTraceEntry[]>();
    for (const t of ev?.trace ?? []) g.set(t.status, [...(g.get(t.status) ?? []), t]);
    return STATUS_ORDER.filter((s) => g.has(s)).map((s) => [s, g.get(s)!] as const);
  }, [ev]);

  if (error) return <ErrorNote message={error} />;

  if (!lineCount) {
    return (
      <Panel title="The quote">
        <Empty title="Nothing priced yet">
          Add a line and the server prices it, applies the rules and tells you what needs approval.
        </Empty>
      </Panel>
    );
  }

  const setQty = (itemNo: string, q: number) => patch({
    lines: q <= 0
      ? draft.lines.filter((l) => l.itemNo !== itemNo)
      : draft.lines.map((l) => (l.itemNo === itemNo ? { ...l, quantity: q } : l)),
  });

  /* Optional is a property of the line, not a separate list. Keeping it on the line
     means the part keeps its quantity, its discount category and its place in the
     rules when a rep changes their mind about which side of the total it sits on. */
  const setOptional = (itemNo: string, optional: boolean) => patch({
    lines: draft.lines.map((l) => (l.itemNo === itemNo ? { ...l, optional } : l)),
  });

  return (
    <>
      {/* What is on the quote, where the rep is already looking.
          The lines lived only in section four, so checking what had been added — or
          taking something off — meant scrolling past the machine list and back. The
          rail is beside the work; the section below is still the place to price and
          discount a line, and this is the place to see and change what is on it. */}
      <Panel title="On the quote"
             aside={<span className="num text-2xs text-steel-600">
               {lineCount} line{lineCount === 1 ? '' : 's'}
             </span>}>
        <ul className="divide-y divide-steel-100">
          {(ev?.lines ?? draft.lines.map((l) => ({
            lineNo: 0, itemNo: l.itemNo, description: l.itemNo, quantity: l.quantity,
            extendedNet: null,
          }))).map((l) => (
            <li key={l.itemNo} className="px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-2xs leading-snug text-steel-900">{l.description}</span>
                  <span className="num block text-2xs text-steel-600">{l.itemNo}</span>
                </span>
                <span className="num shrink-0 text-2xs font-semibold text-steel-900">
                  {money(l.extendedNet)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <label className="flex items-center gap-1 text-2xs text-steel-600">
                  <span className="sr-only">Quantity for {l.itemNo}</span>
                  <input
                    type="number" min={1} inputMode="numeric" value={l.quantity}
                    onChange={(e) => setQty(l.itemNo, Number(e.target.value))}
                    className="field num w-14 px-1.5 py-0.5 text-2xs"
                  />
                </label>
                {/* Offered, not bought.
                    Asked for by the sales team: a rep wants a second head or a year
                    of ink in front of the customer without it landing in the price
                    they read. It is priced and graded like any other line and shows
                    under its own heading on the customer's copy. */}
                <label className="flex items-center gap-1 text-2xs text-steel-600">
                  <input
                    type="checkbox"
                    checked={draft.lines.find((d) => d.itemNo === l.itemNo)?.optional === true}
                    onChange={(e) => setOptional(l.itemNo, e.target.checked)}
                  />
                  Optional
                </label>
                <button type="button"
                        className="btn-inline text-2xs text-alert-700 hover:text-alert-800"
                        onClick={() => setQty(l.itemNo, 0)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Discount, beside the total it moves.
          It was a section of its own below the configurator, so a rep dragged a
          slider on one screen and read the result on another. */}
      {cats.length > 0 && draft.lines.length > 0 && (
        <Panel title="Discount">
          <div className="space-y-2.5 p-4">
            {cats.map((c) => {
              const v = draft.categoryDiscounts[c.code] ?? 0;
              const over = c.maxDiscount != null && v > c.maxDiscount;
              const inUse = new Set((ev?.lines ?? []).map((l) => l.discountCatCode)).has(c.code);
              if (!inUse) return null;
              return (
                <div key={c.code} className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-xs font-semibold text-steel-900">{c.displayName}</span>
                    <span className={`text-2xs ${over ? 'font-semibold text-signal-800' : 'text-steel-600'}`}>
                      {c.maxDiscount == null ? 'no stated maximum' : `max ${pct(c.maxDiscount)}`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="range" min={0} max={0.6} step={0.01} value={v}
                           aria-label={`${c.displayName} discount`} aria-valuetext={pct(v)}
                           className="slider"
                           onChange={(e) => patch({ categoryDiscounts: {
                             ...draft.categoryDiscounts, [c.code]: Number(e.target.value) } })} />
                    <span className="flex shrink-0 items-baseline gap-0.5">
                      <input type="number" min={0} max={60} step={0.5}
                             value={Math.round(v * 1000) / 10}
                             aria-label={`${c.displayName} discount, percent`}
                             className="field num w-14 px-1.5 py-0.5 text-right text-xs font-semibold"
                             onChange={(e) => {
                               const typed = Number(e.target.value);
                               if (Number.isNaN(typed)) return;
                               patch({ categoryDiscounts: {
                                 ...draft.categoryDiscounts,
                                 [c.code]: Math.min(0.6, Math.max(0, typed / 100)) } });
                             }} />
                      <span className="text-2xs text-steel-600">%</span>
                    </span>
                  </div>
                  {over && (
                    <p className="mt-0.5 text-2xs text-signal-800">
                      Past the stated maximum — this will go for approval.
                    </p>
                  )}
                </div>
              );
            })}

            {/* Money off the order.
                REPORTED: "the UI for the amount off on the discount section is kind
                of bad." It was: a bare number box with a floating dollar sign, a
                Clear button that appeared and disappeared, and the equivalent
                percentage hidden in the corner label where the category rows put
                their MAXIMUM — so the one figure that tells a rep whether they have
                gone past a ceiling was sitting where the ceiling goes.

                It reads like the rows above it now, because it is the same kind of
                thing: a discount, its effect, and whether that effect is past what
                anybody has agreed. */}
            <div className="min-w-0 border-t border-rule pt-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-xs font-semibold text-steel-900">Amount off the order</span>
                <span className="text-2xs text-steel-600">after the percentages above</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="text-xs text-steel-600">$</span>
                  <input type="number" min={0} step={100}
                         value={draft.flatDiscount ?? ''}
                         placeholder="0"
                         aria-label="Amount off the order, in dollars"
                         className="field num w-full min-w-0 text-right text-xs font-semibold"
                         onChange={(e) => {
                           const typed = Number(e.target.value);
                           patch({ flatDiscount: Number.isFinite(typed) && typed > 0 ? typed : null });
                         }} />
                </span>
                <span className="num shrink-0 text-2xs text-steel-600">
                  {(draft.flatDiscount ?? 0) > 0 && ev?.totalDiscount != null
                    ? `${pct(ev.totalDiscount)} all in`
                    : '—'}
                </span>
              </div>
              {(draft.flatDiscount ?? 0) > 0 && ev != null && (
                <p className="mt-0.5 text-2xs text-steel-600">
                  {money(ev.extendedList)} list, {money(ev.orderTotal)} after everything.
                </p>
              )}
              {ev != null && (ev.flatDiscountApplied ?? 0) < (draft.flatDiscount ?? 0) && (
                <p className="mt-0.5 text-2xs text-signal-800">
                  That is more than the quote comes to, so {money(ev.flatDiscountApplied)} was
                  applied and the total is zero.
                </p>
              )}
            </div>
          </div>
        </Panel>
      )}

      <Panel title="The quote" aside={loading ? <span className="text-2xs text-steel-500">pricing…</span> : undefined}>
        <dl className="divide-y divide-steel-100">
          <Row label="Extended list" value={money(ev?.extendedList)} />
          <Row label="Total discount" value={pct(ev?.totalDiscount)} />
          {(ev?.flatDiscountApplied ?? 0) > 0 && (
            <Row label="Amount off" value={`− ${money(ev!.flatDiscountApplied)}`} />
          )}
          <Row label="Order total" value={money(ev?.orderTotal)} big />
          {/* Stated separately, never added in. An optional line is a price the
              customer may or may not take. */}
          {(ev?.optionalNet ?? 0) > 0 && (
            <Row label="Optional, if taken" value={money(ev!.optionalNet)} />
          )}
          {/* What the customer pays up front, worked out rather than described.
              Rule R-085 fires on the same threshold and says "50 percent down payment
              required", which left the rep doing the arithmetic in the covering email.
              The quote's own policy where it has one, the shipped terms otherwise. */}
          {down != null && (
            <Row label="Due with order" value={money(down.amount)} />
          )}
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="label">Margin</dt>
            <dd className="text-right">
              {ev?.marginPct != null
                ? <span className="num text-sm font-semibold text-steel-900">{pct(ev.marginPct)}</span>
                : <span className="block max-w-[12rem] text-2xs leading-snug text-steel-600">
                    {ev?.marginNote ?? 'not available'}
                  </span>}
            </dd>
          </div>
        </dl>
      </Panel>

      {ev?.blocked && (
        <Panel title="Cannot be sent">
          <p className="px-4 py-3 text-xs text-steel-700">
            A blocking rule has fired. Resolve it below and the quote can go out.
          </p>
        </Panel>
      )}

      {(ev?.requiredApprovals.length ?? 0) > 0 && (
        <Panel title={`Needs approval (${ev!.requiredApprovals.length})`}>
          <ul className="divide-y divide-steel-100">
            {ev!.requiredApprovals.map((a, i) => (
              <li key={i} className="px-4 py-3">
                <p className="text-xs text-steel-800">{a.reason}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-steel-600">
                  {a.ruleCode && <RuleCodeChip code={a.ruleCode} tone="warn" />}
                  {a.approverRole && <span>goes to the {a.approverRole}</span>}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AgainstTheApplication fit={ev?.fit} solutions={draft.solutions} />

      <Panel title="Why the quote reads this way"
             aside={<span className="num text-2xs text-steel-600">{ev?.trace.length ?? 0}</span>}>
        {grouped.length === 0
          ? <Empty title="No rule has anything to say">
              Every rule in effect was checked and none of them engage on these lines.
            </Empty>
          : grouped.map(([status, entries]) => (
              <div key={status} className="border-b border-rule last:border-b-0">
                <p className="bg-steel-50 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-steel-700">
                  {STATUS_WORD[status]} · {entries.length}
                </p>
                <ul className="divide-y divide-steel-100">
                  {entries.map((t, i) => (
                    <li key={i} className="px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        <RuleCodeChip code={t.ruleCode} tone={STATUS_TONE[status]} />
                        <p className="min-w-0 text-2xs leading-snug text-steel-800">{t.headline}</p>
                      </div>
                      {/* Fix it from where it fired.
                          The rule already knows the part number and the shortfall,
                          so making the rep read the sentence, remember a code and go
                          and search for it was work the tool was choosing not to do.
                          Only appears where the fix is unambiguous — a
                          requireOneOf sends no payload, because choosing is the
                          rep's call. */}
                      {t.fix?.length && onFix ? (
                        <button type="button" className="btn-quiet mt-1.5 text-2xs"
                                onClick={() => onFix(t.fix!)}>
                          {t.fix.length === 1
                            ? `Add ${t.fix[0].quantity} × ${t.fix[0].description ?? t.fix[0].itemNo}`
                            : `Add all ${t.fix.length}`}
                        </button>
                      ) : t.pickRole && onPick ? (
                        /* The rule named a kind of part, not a part number. There
                           are four mounts in the CIJ book and choosing between them
                           is the rep's call — so this opens the parts list filtered
                           to that kind rather than adding something on their behalf.
                           Advice you cannot act on from where you read it is advice
                           the tool made you do the work for. */
                        <button type="button" className="btn-quiet mt-1.5 text-2xs"
                                onClick={() => onPick(t.pickRole!)}>
                          {PICK_WORD[t.pickRole] ?? `Find ${t.pickRole}`}
                        </button>
                      ) : t.status === 'action' || t.status === 'warning' ? (
                        /* Neither an exact part nor a kind. Saying so is the point:
                           every finding now ends in a way to act on it or an explicit
                           statement that there is nothing to click, and a rep never
                           has to wonder whether they missed a button. */
                        <p className="mt-1.5 text-2xs italic text-steel-500">
                          Nothing to add.
                        </p>
                      ) : null}
                      <p className="cite mt-1 text-2xs text-steel-500">
                        {t.author ?? 'author not recorded'}
                        {t.sourceRef ? ` · ${t.sourceRef}` : ' · source not recorded'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
      </Panel>
    </>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="label">{label}</dt>
      {/* The rail exists to report this one number, so it gets the readout rather
          than a slightly bolder figure. One per block, which is why only `big` does. */}
      {big
        ? <dd className="readout-light text-xl">{value}</dd>
        : <dd className="num text-sm text-steel-900">{value}</dd>}
    </div>
  );
}
