"""
The rule engine — the production authority.

`web/src/engine/evaluate.ts` is a port of this for the preview build. The two
are separate implementations of one algorithm, which is a real risk: two engines
that disagree would price the same quote two ways, and the disagreement would
surface as a customer receiving a number the business never sanctioned.

So neither may change alone. `../engine-cases.json` holds worked examples and
both `tests/test_engine.py` and `web/src/engine/evaluate.test.ts` assert against
it. Change one engine and the other side's test fails.

THE ORDER OF EVALUATION, AND WHY IT IS THIS ORDER

  1. Price      list price x quantity, from Orbit. The tool stores no price.
  2. Discount   the category discount the rep asked for, per line.
  3. Caps       item caps pull an individual line back. Caps run AFTER the
                category discount because a cap is a ceiling on the result, not
                an alternative to it.
  4. Structure  requires / requireOneOf / excludes / duplicate. These read the
                line set, so they must run after it is final.
  5. Eligibility  every condition must hold. The trace names the ones that
                failed, because "no" without "which" is useless to a rep.
  6. Fit        the application profile against applicationFit rules.
  7. Approvals  what exceeds a stated ceiling. Last, because it needs the final
                discounts.

A rule outside its effective dates never fires, at any step. That is the one
thing the spreadsheets could not do, and the reason a lapsed promotion sat on
the live CIJ sheet for seven months.

Nothing in here touches the database. It is a pure function of (draft, items,
rules, categories, today), which is what makes it testable without a server and
what lets the same code answer both "price this draft" and "what would this
rule do".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Iterable, Sequence

FIT_ORDER = {"good": 0, "caveat": 1, "notAssessed": 2, "notRecommended": 3}

#: Rounding is HALF UP, on the decimal value, and both engines must do it the
#: same way.
#:
#: This used ``round(Decimal(str(n)), N)``, which is half-to-EVEN — Python's
#: default for Decimal. evaluate.ts used ``Math.round(n * 100) / 100``, which is
#: half up on the binary float. So the two engines priced the same line two ways
#: whenever a figure landed exactly on a half: a $5.00 part at 17.5% came to
#: $4.12 from the service and $4.13 from the preview. Sweeping ordinary prices
#: and discounts finds it in the millions of combinations, not in a corner.
#:
#: engine-cases.json could not catch it because every fixture price in it was a
#: round hundred, so no case ever produced a half. There are cases now that do.
#:
#: Half up because that is the commercial convention for money — a customer
#: reading a quote expects half a cent to go up, and half-to-even would make an
#: invoice look wrong. Decimal(str(n)) first because the halves that matter are
#: decimal halves: 8.845 is not exactly representable in binary, and rounding the
#: double directly answers a question about the wrong number.
_Q2 = Decimal("0.01")
_Q4 = Decimal("0.0001")


def _round2(n: float) -> float:
    return float(Decimal(str(n)).quantize(_Q2, rounding=ROUND_HALF_UP))


def _round4(n: float) -> float:
    return float(Decimal(str(n)).quantize(_Q4, rounding=ROUND_HALF_UP))


def _get(obj: Any, key: str, default: Any = None) -> Any:
    """Rules and items arrive as dicts from SQL and as dicts from the test
    fixtures, so everything is read the same way."""
    if isinstance(obj, dict):
        v = obj.get(key, default)
        return default if v is None else v
    return getattr(obj, key, default)


@dataclass
class Ctx:
    qty: dict[str, float]
    items: dict[str, dict]
    draft: dict
    attrs: set[str]
    #: net order total, available from step 4 onward; 0 while lines are priced
    total: float = 0.0


def _books_on_quote(draft: dict, items_by: dict) -> set:
    """Every price book a quote draws on: the one it was started in, and the book of
    anything actually on it.

    'ALL' is not a book of its own — a service offering or a promotion belongs to every
    quote — so it is left out rather than widening the rule set by a whole technology.
    """
    books = {_get(draft, "technologyCode")}
    for line in _get(draft, "lines", []) or []:
        item = items_by.get(_get(line, "itemNo"))
        tech = _get(item, "technologyCode") if item else None
        if tech and tech != "ALL":
            books.add(tech)
    return books


def _solution(draft: dict, solution_id) -> dict | None:
    """The solution with this id, or None.

    Solutions are a list rather than a mapping keyed by price book, because two
    stations on one quote may both want a CIJ coder and a book cannot tell them
    apart. Everything joins on the id.
    """
    if not solution_id:
        return None
    for s in _get(draft, "solutions", []) or []:
        if _get(s, "id") == solution_id:
            return s
    return None


def _draft_for(draft: dict, solution_id) -> dict:
    """The draft as one solution sees it: the quote's application, with that
    solution's own answers laid over the top.

    Absent means "as the quote says", so an ordinary quote merges nothing and is
    unchanged. The engine does not know which fields are station-level and does not
    need to — it merges what it is given.
    """
    sol = _solution(draft, solution_id)
    if sol is None:
        return draft
    out = draft
    own = _get(sol, "profile", {})
    if own:
        profile = dict(_get(draft, "profile", {}) or {})
        profile.update({k: v for k, v in own.items()})
        out = {**out, "profile": profile}
    # Answered as a whole rather than field by field: a station that has been asked
    # carries its own list, and an empty list means "nothing is unconstrained here"
    # rather than "ask the quote". None is what means ask the quote.
    shrugs = _get(sol, "noConstraint")
    if shrugs is not None:
        out = {**out, "noConstraint": list(shrugs)}
    return out


def in_effect(rule: dict, today: str) -> bool:
    if not _get(rule, "isActive", False):
        return False
    eff_from = _get(rule, "effectiveFrom")
    eff_to = _get(rule, "effectiveTo")
    if eff_from and today < eff_from:
        return False
    if eff_to and today > eff_to:
        return False
    return True


def engaged(rule: dict, c: Ctx) -> bool:
    """Triggers are ANDed.

    A rule with two triggers means "when both hold", not "when either does".
    That is what lets one fit rule name a printer and a substrate together
    instead of two rules that cannot see each other. A rule with no trigger
    never fires — validation rejects that on save, but the engine must not
    depend on validation having run.
    """
    triggers = _get(rule, "triggers", []) or []
    return len(triggers) > 0 and all(fires(t, c) for t in triggers)


def fires(t: dict, c: Ctx) -> bool:
    kind = _get(t, "triggerType")
    if kind == "always":
        return True
    if kind == "item":
        item_no = _get(t, "itemNo")
        return bool(item_no) and c.qty.get(item_no, 0) >= _get(t, "minCount", 1)
    if kind == "role":
        # How many DISTINCT items on the quote have this role. Distinct, not total
        # quantity: six of one ink is a year's supply, six different service items
        # is somebody adding the whole list.
        n = sum(1 for k in c.qty
                if _get(c.items.get(k, {}), "itemRole") == _get(t, "itemRole"))
        # 'ne' inverts it: engages when NOTHING quoted has this role. That is what
        # lets a rule say "a printer, and no accessory" — a printer going out with
        # nothing to mount it on, which no trigger could express before.
        if _get(t, "compareOp") == "ne":
            return n == 0
        return n >= _get(t, "minCount", 1)
    if kind == "category":
        return any(_get(c.items.get(n, {}), "prodCat") == _get(t, "prodCat") for n in c.qty)
    if kind == "itemCategory":
        # The hierarchy's own word for the kind of part — Stands, Conveyor, Tamp Pad.
        # Mirrors evaluate.ts.
        return any(
            _compare(_get(c.items.get(n, {}), "category"),
                     _get(t, "compareOp", "eq"), _get(t, "compareValue"))
            for n in c.qty)
    if kind == "attribute":
        return bool(_get(t, "attrName")) and f"{_get(t, 'attrName')}={_get(t, 'attrValue')}" in c.attrs
    if kind == "model":
        # Any quoted item whose model matches. A datasheet states one ceiling for
        # "6400/6410", which becomes two rules or one 'includes' — never a list
        # of 468 part numbers.
        return any(
            _compare(_get(c.items.get(n, {}), "model"),
                     _get(t, "compareOp", "eq"), _get(t, "compareValue"))
            for n in c.qty)
    if kind == "profile":
        # A field the customer has no constraint on stops every rule that reads
        # it. "Any throw distance" has to mean the throw-distance rules go
        # quiet, not that they evaluate against a blank and quietly exclude
        # machines.
        field = _get(t, "profileField")
        if field and field in (_get(c.draft, "noConstraint", []) or []):
            return False
        return _compare(_profile_value(c.draft, field),
                        _get(t, "compareOp", "eq"), _get(t, "compareValue"))
    if kind == "total":
        return _compare(c.total, _get(t, "compareOp", "gte"), _get(t, "compareValue"))
    return False


def _mark_height_mm(draft: dict):
    """How tall the finished mark is — which is not how much room there is to print it.

    The print-height rules used to grade against markingWindowMm, and that field is the
    space AVAILABLE on the pack. Read that way the arithmetic runs backwards: a 6-inch
    clear panel ruled out every head printing less than 6 inches, so the roomier the
    product the fewer machines would take it. Reported from use.

    What those rules want is the height of the code itself. Nobody is asked for it
    because it is not an independent fact — it is the character height times the number
    of lines — so it is derived here rather than added as a question.

    Line spacing is deliberately not added, which makes this a floor. Every rule reading
    it asks "is the mark already taller than the head", and on that question a floor is
    the safe side: a mark that fails it fails however the leading is set.

    Mirrors markHeightMm in web/src/engine/evaluate.ts. engine-cases.json holds the two
    to the same answers.
    """
    # "Any character height" has to silence what is derived from it too.
    if "charHeightMm" in (_get(draft, "noConstraint", []) or []):
        return None
    profile = _get(draft, "profile", {}) or {}
    try:
        ch = float(profile.get("charHeightMm"))
    except (TypeError, ValueError):
        return None
    if ch <= 0:
        return None
    try:
        lines = int(profile.get("linesOfPrint"))
    except (TypeError, ValueError):
        lines = 1
    return ch * (lines if lines >= 1 else 1)


def _profile_value(draft: dict, field_name: str | None):
    if not field_name:
        return None
    if field_name == "markHeightMm":
        return _mark_height_mm(draft)
    return (_get(draft, "profile", {}) or {}).get(field_name)


def _compare(left, op: str | None, right) -> bool:
    if left is None or right is None:
        return False
    op = op or "eq"
    try:
        ln, rn = float(left), float(right)
        numeric = True
    except (TypeError, ValueError):
        ln = rn = 0.0
        numeric = False

    ls, rs = str(left).lower(), str(right).lower()
    if op == "eq":
        return ls == rs
    if op == "ne":
        return ls != rs
    if op == "gt":
        return numeric and ln > rn
    if op == "gte":
        return numeric and ln >= rn
    if op == "lt":
        return numeric and ln < rn
    if op == "lte":
        return numeric and ln <= rn
    if op == "includes":
        return rs in ls
    # A substrate is written by a person, so it arrives as "Dark corrugated case"
    # rather than a code, and the claim a rule makes is usually about a family:
    # a TTO wants film, web or foil. 'includesAny' is that claim in one rule
    # instead of six near-identical ones. There is deliberately no notIncludes —
    # negating a free-text field would condemn every substrate nobody thought to
    # list, including the ones spelt differently.
    if op == "includesAny":
        return any(v.strip() in ls for v in rs.split(",") if v.strip())
    if op == "in":
        return ls in [v.strip() for v in rs.split(",") if v.strip()]
    return False


def _pct(n: float) -> str:
    v = round(n * 1000) / 10
    return f"{int(v) if v == int(v) else v}%"


def _money(n: float) -> str:
    return f"${n:,.2f}"


def _label(item_no: str, items: dict[str, dict]) -> str:
    it = items.get(item_no)
    return f"{_get(it, 'description')} ({item_no})" if it else item_no


def evaluate(draft: dict, items: Iterable[dict], rules: Iterable[dict],
             categories: Iterable[dict], today: str) -> dict:
    items = list(items)
    rules = list(rules)
    categories = list(categories)

    items_by = {_get(i, "itemNo"): i for i in items}

    qty: dict[str, float] = {}
    for line in _get(draft, "lines", []) or []:
        n = _get(line, "itemNo")
        qty[n] = qty.get(n, 0) + _get(line, "quantity", 0)

    attrs: set[str] = set()
    for n in qty:
        for k, v in (_get(items_by.get(n, {}), "attributes", {}) or {}).items():
            attrs.add(f"{k}={v}")

    ctx = Ctx(qty=qty, items=items_by, draft=draft, attrs=attrs)

    # A rule belongs to one technology or to all of them. Without this filter a
    # PALM rule about custom pad sizes turns up on a CIJ quote, which is how a
    # rep learns to stop reading the trace.
    #
    # The books are the ones ON the quote rather than the one it was started in. A quote
    # can carry a coder at one station and an applicator at another, and when the filter
    # was the draft's single technologyCode the applicator was priced, totalled, printed
    # on the customer's copy and never graded — silence that looks like approval. What
    # keeps the pad-size rule off a CIJ printer is the per-item check in the fit loop,
    # which is where it belongs: it is a statement about the item, not about the quote.
    books = _books_on_quote(draft, items_by)
    live = [r for r in rules
            if in_effect(r, today)
            and (_get(r, "technologyCode") is None or _get(r, "technologyCode") in books)]

    trace: list[dict] = []
    approvals: list[dict] = []

    def say(rule: dict, status: str, headline: str, fix: list[dict] | None = None) -> None:
        entry = {
            "ruleCode": _get(rule, "ruleCode"),
            "ruleSummary": _get(rule, "summary"),
            "sourceRef": _get(rule, "sourceRef"),
            "author": _get(rule, "author"),
            "status": status,
            "headline": headline,
        }
        # The parts that would satisfy the finding, where the rule names them
        # exactly. A requireOneOf is a choice and carries none: choosing is the
        # rep's job, and a button cannot make that decision for them.
        if fix:
            entry["fix"] = fix
        else:
            # Where the rule names a KIND of part rather than a part number —
            # "no stand, bracket or mount on this quote" — the kind is already in
            # its trigger, as a role the quote is missing. Reading it off there
            # means a picker appears for any rule written that way, including ones
            # nobody has written yet, and the remedy can never disagree with the
            # condition that produced it.
            for t in _get(rule, "triggers", []) or []:
                if _get(t, "triggerType") == "role" and _get(t, "compareOp") == "ne":
                    if _get(t, "itemRole"):
                        entry["pickRole"] = _get(t, "itemRole")
                    break
        trace.append(entry)

    # ---- 1-3. Price, discount, caps ---------------------------------------

    caps: dict[str, dict] = {}
    for r in live:
        if not engaged(r, ctx):
            continue
        for a in _get(r, "actions", []) or []:
            if _get(a, "actionType") != "cap":
                continue
            item_no, max_disc = _get(a, "itemNo"), _get(a, "maxDiscount")
            if not item_no or max_disc is None:
                continue
            held = caps.get(item_no)
            # The tightest cap wins. Two rules capping the same part is a policy
            # question, but quoting the looser of the two is never the safe
            # reading.
            if held is None or max_disc < held["pct"]:
                caps[item_no] = {"pct": max_disc, "ruleCode": _get(r, "ruleCode")}

    cat_discounts = _get(draft, "categoryDiscounts", {}) or {}
    lines: list[dict] = []
    for idx, dl in enumerate(_get(draft, "lines", []) or []):
        item_no = _get(dl, "itemNo")
        quantity = _get(dl, "quantity", 0)
        item = items_by.get(item_no)
        list_price = _get(item, "listPrice") if item else None
        cat_code = _get(item, "discountCatCode") if item else None
        asked = cat_discounts.get(cat_code, 0) if cat_code else 0
        cap = caps.get(item_no)
        capped = cap is not None and cap["pct"] < asked
        applied = cap["pct"] if capped else asked
        net_unit = None if list_price is None else _round4(list_price * (1 - applied))
        lines.append({
            "lineNo": idx + 1,
            "itemNo": item_no,
            "description": _get(item, "description") if item else item_no,
            # What the item IS, carried on the priced line — see the TypeScript port.
            "itemRole": _get(item, "itemRole"),
            # And which book it came from, so a quote carrying two solutions can show
            # them apart. One lookup here rather than one on every screen.
            "technologyCode": _get(item, "technologyCode"),
            # Which station this line serves, carried on the priced line so a screen
            # can group by solution without re-deriving it.
            "solutionId": _get(dl, "solutionId"),
            "model": _get(item, "model"),
            "quantity": quantity,
            "optional": _get(dl, "optional") is True,
            "listPrice": list_price,
            "discountCatCode": cat_code,
            "categoryDiscount": asked,
            "appliedDiscount": applied,
            "cappedByRule": cap["ruleCode"] if capped else None,
            "netUnit": net_unit,
            "extendedList": None if list_price is None else _round2(list_price * quantity),
            "extendedNet": None if net_unit is None else _round2(net_unit * quantity),
        })

    for item_no, cap in caps.items():
        hit = next((l for l in lines
                    if l["itemNo"] == item_no and l["cappedByRule"] == cap["ruleCode"]), None)
        if hit is None:
            continue
        rule = next(r for r in live if _get(r, "ruleCode") == cap["ruleCode"])
        say(rule, "warning",
            f"{hit['description']}: {_pct(hit['categoryDiscount'] or 0)} requested, "
            f"held to {_pct(cap['pct'])}.")

    # ---- 4. Structure ------------------------------------------------------

    # Lines are priced, so a rule may now ask about the order value.
    ctx.total = _round2(sum(l["extendedNet"] or 0 for l in lines))

    blocked = False

    for r in live:
        if not engaged(r, ctx):
            continue
        actions = _get(r, "actions", []) or []

        for a in actions:
            kind = _get(a, "actionType")

            if kind == "require":
                item_no = _get(a, "itemNo")
                if not item_no:
                    continue
                have = qty.get(item_no, 0)
                need = _get(a, "quantity", 1)
                if have >= need:
                    say(r, "satisfied", f"{_label(item_no, items_by)} is on the quote.")
                else:
                    suffix = f" — {_get(a, 'message')}" if _get(a, "message") else ""
                    say(r, "action",
                        f"Add {need - have} × {_label(item_no, items_by)}{suffix}",
                        [{"itemNo": item_no, "quantity": need - have,
                          "description": _get(items_by.get(item_no, {}), "description")}])

            elif kind == "pickOne":
                # The mirror of requireOneOf: that speaks up when none of the set
                # is quoted, this when more than one is. Five printhead poles of
                # different lengths are a choice, not a kit.
                pick = [x for x in actions
                        if _get(x, "actionType") == "pickOne" and _get(x, "itemNo")]
                if a is not pick[0]:
                    continue
                on = [x for x in pick if qty.get(_get(x, "itemNo"), 0) > 0]
                if len(on) > 1:
                    named = ", ".join(_label(_get(x, "itemNo"), items_by) for x in on)
                    say(r, "warning",
                        _get(a, "message")
                        or (f"Only one of these is normally needed, and {len(on)} "
                            f"are on the quote: {named}."))

            elif kind == "requireOneOf":
                options = [x for x in actions
                           if _get(x, "actionType") == "requireOneOf" and _get(x, "itemNo")]
                if options and a is options[0]:
                    met = any(qty.get(_get(x, "itemNo"), 0) > 0 for x in options)
                    say(r, "satisfied" if met else "action",
                        "One of the accepted options is on the quote." if met
                        else "Add one of: "
                             + ", ".join(_label(_get(x, "itemNo"), items_by) for x in options)
                             + ".")

            elif kind == "exclude":
                # An exclude action must name what it excludes. One that names
                # nothing would block every quote it engages on, which is never
                # what the author meant — validation rejects it on save, and the
                # engine refuses to act on it in case an older row slipped through.
                item_no = _get(a, "itemNo")
                if not item_no:
                    continue
                if qty.get(item_no, 0) > 0:
                    blocked = True
                    say(r, "blocked",
                        _get(a, "message") or f"{_label(item_no, items_by)} cannot be quoted here.")

            elif kind == "warn":
                say(r, "warning", _get(a, "message") or _get(r, "summary"))

            elif kind == "substitute":
                msg = _get(a, "message") or "An alternative exists"
                item_no = _get(a, "itemNo")
                tail = f" — {_label(item_no, items_by)}" if item_no else ""
                say(r, "info", f"{msg}{tail}.")

            elif kind == "allowance":
                amt = _get(a, "allowanceAmt")
                if amt is not None:
                    say(r, "info", f"Allowance of {_money(amt)} applies.")

        # ---- 5. Eligibility ------------------------------------------------

        conditions = _get(r, "conditions", []) or []
        if conditions:
            failed = [c for c in conditions if not holds(c, ctx)]
            if not failed:
                say(r, "satisfied", f"All {len(conditions)} conditions hold.")
            else:
                which = "; ".join(_get(c, "label", "") for c in failed)
                if _get(r, "severity") == "block":
                    blocked = True
                    say(r, "blocked",
                        f"{len(failed)} of {len(conditions)} conditions not met — {which}.")
                else:
                    say(r, "warning", f"Not met: {which}.")
                ap = next((x for x in actions if _get(x, "actionType") == "approve"), None)
                if ap is not None:
                    approvals.append({
                        "ruleCode": _get(r, "ruleCode"),
                        "reason": _get(ap, "message") or _get(r, "summary"),
                        "requestedPct": None,
                        "statedMax": None,
                        "approverRole": _get(ap, "approverRole"),
                    })

    # ---- 6. Fit ------------------------------------------------------------

    # One assessment per (solution, item), in the order the lines were added. The same
    # item at two stations is two rows, because the two stations can answer the
    # application differently and get different answers.
    targets: list[tuple] = []
    for dl in _get(draft, "lines", []) or []:
        pair = (_get(dl, "solutionId"), _get(dl, "itemNo"))
        if pair not in targets:
            targets.append(pair)
    fit = grade_fit(live, ctx, targets)

    # ---- 7. Approvals ------------------------------------------------------

    ceilings = {_get(c, "code"): _get(c, "maxDiscount") for c in categories}
    approval_rule = next(
        (r for r in live
         if _get(r, "ruleType") == "approval"
         and any(_get(a, "actionType") == "approve" for a in (_get(r, "actions", []) or []))),
        None,
    )

    for code, asked_pct in cat_discounts.items():
        ceiling = ceilings.get(code)
        if ceiling is None or asked_pct <= ceiling:
            continue
        # Used on no line, so it is not a real request.
        if not any(l["discountCatCode"] == code for l in lines):
            continue
        cat = next(c for c in categories if _get(c, "code") == code)
        role = None
        if approval_rule is not None:
            ap = next((a for a in (_get(approval_rule, "actions", []) or [])
                       if _get(a, "actionType") == "approve"), None)
            role = _get(ap, "approverRole") if ap else None
        approvals.append({
            "ruleCode": _get(approval_rule, "ruleCode") if approval_rule else None,
            "reason": f"{_get(cat, 'displayName')} discount of {_pct(asked_pct)} is past "
                      f"the stated maximum of {_pct(ceiling)}.",
            "requestedPct": asked_pct,
            "statedMax": ceiling,
            "approverRole": role or "Regional Sales Manager",
        })
        if approval_rule is not None:
            say(approval_rule, "action",
                f"{_get(cat, 'displayName')} discount {_pct(asked_pct)} is past "
                f"the stated {_pct(ceiling)}.")

    # ---- Totals ------------------------------------------------------------

    # Committed lines only. An optional line is a price the customer may or may not
    # take, so adding it to the order total states a number nobody has agreed to — and
    # it would flow into the margin and the discount percentage too, which are the two
    # figures a manager reads before approving. Mirrors evaluate.ts.
    committed = [l for l in lines if not l.get("optional")]
    optional_lines = [l for l in lines if l.get("optional")]
    extended_list = _round2(sum(l["extendedList"] or 0 for l in committed))
    net_of_lines = _round2(sum(l["extendedNet"] or 0 for l in committed))
    optional_net = _round2(sum(l["extendedNet"] or 0 for l in optional_lines))

    # Money off the order, after the percentages. Clamped at the net: an amount larger
    # than the quote is a typo, and a negative order total is not sendable.
    try:
        asked_flat = max(0.0, float(_get(draft, "flatDiscount") or 0))
    except (TypeError, ValueError):
        asked_flat = 0.0
    flat_applied = _round2(min(asked_flat, net_of_lines))
    extended_net = _round2(net_of_lines - flat_applied)
    # Stated as a percentage whatever it was entered as: every ceiling is a
    # percentage, so a flat amount that goes past one has to show up here.
    total_discount = _round4(1 - extended_net / extended_list) if extended_list > 0 else 0

    # Margin needs standard cost from Orbit. If any line lacks one the figure
    # would be wrong rather than approximate, so it is withheld and said so.
    missing = [l for l in committed if _get(items_by.get(l["itemNo"], {}), "stdCost") is None]
    margin_pct = None
    margin_note = None
    if not missing and extended_net > 0:
        cost = sum(_get(items_by[l["itemNo"]], "stdCost", 0) * l["quantity"] for l in committed)
        margin_pct = _round4((extended_net - cost) / extended_net)
    elif missing:
        margin_note = (
            "No standard cost in Orbit for these items, so margin cannot be stated."
            if len(missing) == len(committed)
            else f"{len(missing)} of {len(committed)} lines carry no standard cost, "
                 f"so margin would be overstated."
        )

    return {
        "lines": lines,
        "trace": trace,
        "requiredApprovals": approvals,
        "fit": fit,
        "extendedList": extended_list,
        "extendedNet": extended_net,
        "totalDiscount": total_discount,
        "flatDiscountApplied": flat_applied,
        "optionalNet": optional_net,
        "orderTotal": extended_net,
        "marginPct": margin_pct,
        "marginNote": margin_note,
        "blocked": blocked,
    }


def holds(c: dict, ctx: Ctx) -> bool:
    kind = _get(c, "conditionKind")
    if kind == "attribute":
        return bool(_get(c, "attrName")) and f"{_get(c, 'attrName')}={_get(c, 'attrValue')}" in ctx.attrs
    if kind == "item":
        return bool(_get(c, "itemNo")) and ctx.qty.get(_get(c, "itemNo"), 0) > 0
    if kind in ("flag", "term"):
        flag = _get(c, "flagName")
        return bool(flag) and (_get(ctx.draft, "flags", {}) or {}).get(flag) is True
    return False


def _about_the_item(r: dict) -> bool:
    """Does this rule say anything about the item, or only about the application?

    A trigger on the item number, the model or an attribute means the rule is about
    a particular thing. A rule with only profile triggers describes the technology,
    and grading every consumable and accessory against it produces findings that are
    true of the book and meaningless about the part.
    """
    return any(_get(t, "triggerType") in ("item", "model", "attribute")
               for t in _get(r, "triggers", []) or [])


def grade_fit(live: list[dict], base: Ctx, targets: list[tuple]) -> list[dict]:
    """Fit grading. Every grade comes from a rule someone wrote, with its code
    attached — there are no thresholds compiled into this file.

    An item nobody has written a fit rule about grades 'notAssessed'. This used to
    be 'good', with a comment calling it honest because it meant "nothing is known
    against it". The reasoning was sound and the result was not: the screen has no
    way to draw the difference between a machine a datasheet endorses and a machine
    nobody has ever written a rule about, so 947 CIJ printers came back as good
    fits. A reviewer asked for 10,000,000 fpm and still got recommendations.

    Absence of evidence needs its own grade, or it silently becomes evidence of
    absence — in the direction that puts an unsuitable machine in front of a
    customer.

    Each item is graded in a context containing ONLY itself.

    That matters. Fit asks "does this item suit the application", so an attribute
    trigger has to mean the candidate's own attribute. Graded against the whole
    quote, a rule reading ``Color = Black`` sees the union of every line's
    attributes, and a black printer sitting on the quote condemns the white one
    beside it — which is precisely backwards, since the white one is the answer.
    """
    out = []
    for solution_id, item_no in targets:
        item = base.items.get(item_no)
        # This station's answers over the quote's. See _draft_for.
        #
        # Graded per SOLUTION rather than per item, so the same printhead quoted at two
        # stations is assessed twice against two applications. It used to be graded
        # once for the whole quote against whichever profile its price book carried,
        # which could not express two stations sharing a book at all.
        draft = _draft_for(base.draft, solution_id)
        solo = Ctx(
            qty={item_no: base.qty.get(item_no, 1)},
            items=base.items,
            draft=draft,
            attrs={f"{k}={v}" for k, v in (_get(item, "attributes", {}) or {}).items()},
            total=base.total,
        )
        reasons: list[dict] = []
        grade = "good"
        assessed = False
        for r in live:
            if _get(r, "ruleType") != "applicationFit":
                continue
            # This machine's own book. On a quote with a coder at one station and an
            # applicator at another both books' rules are live, and a rule from the
            # other one has nothing to say about this part.
            rule_tech = _get(r, "technologyCode")
            if (rule_tech is not None and _get(item, "technologyCode") != "ALL"
                    and rule_tech != _get(item, "technologyCode")):
                continue
            # A rule that names nothing about the ITEM — only the application — is
            # a statement about the technology, not about this part. "Small
            # character CIJ is aimed at primary packs" is a reason not to choose
            # CIJ for a case; it is not a reason to grade the UPS battery backup on
            # the quote NOT RECOMMENDED, which is what a saved quote was showing.
            if not _about_the_item(r) and _get(item, "itemRole") != "printer":
                continue
            if not engaged(r, solo):
                continue
            for a in _get(r, "actions", []) or []:
                if _get(a, "actionType") != "grade" or not _get(a, "fitGrade"):
                    continue
                if _get(a, "itemNo") and _get(a, "itemNo") != item_no:
                    continue
                assessed = True
                if FIT_ORDER[_get(a, "fitGrade")] > FIT_ORDER[grade]:
                    grade = _get(a, "fitGrade")
                # The citation travels with the reason. A fit grade a rep cannot
                # attribute is the one thing this product promises not to ship.
                reasons.append({"ruleCode": _get(r, "ruleCode"),
                                "text": _get(a, "message") or _get(r, "summary"),
                                "author": _get(r, "author"),
                                "sourceRef": _get(r, "sourceRef")})
        out.append({
            "itemNo": item_no,
            # Which station this grade is about. Two rows may share an item number.
            "solutionId": solution_id,
            "description": _get(item, "description") if item else item_no,
            "grade": grade if assessed else "notAssessed",
            "reasons": reasons,
            # So the client can show the machine and link to its page.
            "model": (_get(item, "model") or None) if item else None,
            # And so the machine list can show a price. Null where Orbit has none.
            "listPrice": _get(item, "listPrice") if item else None,
        })
    return out


def suggest(draft: dict, items: Iterable[dict], rules: Iterable[dict], today: str,
            attributes: dict | None = None, q: str | None = None,
            rank: dict[str, dict] | None = None,
            identity: list[str] | None = None,
            roles: list[str] | None = None,
            narrow: dict[str, list[str]] | None = None,
            deny: dict | None = None) -> list[dict]:
    """Items worth offering for a captured application, best fit first.

    ``attributes`` and ``q`` narrow the candidates BEFORE grading, which is the
    only order that works: a CIJ book holds over a thousand printer
    configurations, and grading all of them to throw most away is wasted work at
    the point a rep is typing.

    ``identity`` names the attributes that say WHICH MACHINE a row is, and turns
    the answer back into a list of machines. A Corvus part number is a printer
    already filled — printer, printhead, ink and colour in one SKU — so nine
    machines, six printheads and forty-eight inks arrive as 947 rows, and "which
    machine" gets answered with a catalogue. Rows sharing an identity collapse to
    the best-graded one, which carries ``variants``: how many orderable
    configurations of that machine there are.

    An identity attribute the caller is already filtering on is not grouped on —
    once a rep has said "6420 Dye Based", the configurations of it are exactly
    what they want to see. So the grouping lifts itself as the question narrows.

    ``rank`` decides the order once fit has spoken, keyed by item number:

      orders      distinct sales orders containing the part over a trailing
                  window, from mac.oelinhst_sql. Distinct orders rather than
                  summed quantity — one customer buying a thousand of something
                  does not make it the popular choice.
      documented  whether the model has a datasheet and a photograph.
    """
    items = list(items)
    tech = _get(draft, "technologyCode")
    chosen = [(k, v) for k, v in (attributes or {}).items() if v]
    words = (q or "").lower().split()

    wanted = set(roles) if roles else {"printer"}

    def matches(i: dict) -> bool:
        if _get(i, "technologyCode") != tech or not _get(i, "isActive", False):
            return False
        # Machines when the caller says nothing. This function was machine-only
        # with the filter written inline, and the panel calling it went quiet the
        # moment a machine was chosen — so the tool did its thinking about the
        # hardest decision and said nothing about the ink, the photocell, the
        # bracket and the service kit, which are most of the lines on a real quote.
        if _get(i, "itemRole") not in wanted:
            return False
        attrs = _get(i, "attributes", {}) or {}
        for name, value in chosen:
            if attrs.get(name) != value:
                return False
        # What the application ruled out, computed by the caller and applied here.
        # Softer than `attributes` and deliberately so: that one is a filter a rep
        # set, so an item without the attribute fails it. This is the application
        # talking, so an item WITHOUT the attribute is kept — a bracket has no
        # Surface, and saying nothing about porosity is not disagreeing about it.
        for name, allowed in (narrow or {}).items():
            have = attrs.get(name)
            if have is not None and have not in allowed:
                return False
        if deny and _get(i, "itemRole") in (deny.get("roles") or []):
            desc = str(_get(i, "description", ""))
            if any(re.search(p, desc, re.I) for p in (deny.get("patterns") or [])):
                return False
        if words:
            hay = " ".join([
                str(_get(i, "itemNo", "")), str(_get(i, "description", "")),
                *[str(v) for v in attrs.values()],
            ]).lower()
            if not all(w in hay for w in words):
                return False
        return True

    candidates = [i for i in items if matches(i)]
    ctx = Ctx(qty={}, items={_get(i, "itemNo"): i for i in items},
              draft=draft, attrs=set(), total=0.0)
    live = [r for r in rules
            if in_effect(r, today)
            and (_get(r, "technologyCode") is None or _get(r, "technologyCode") == tech)]

    # Nothing is on the quote yet, so no station owns these — they are graded against
    # the quote's own application.
    graded = grade_fit(live, ctx, [(None, _get(c, "itemNo")) for c in candidates])

    # The order, and every step of it is a fact rather than a preference:
    #
    #  1. FIT        what the datasheets say about this application. Nothing
    #                outranks it; a popular machine that cannot code the pack is
    #                not an answer.
    #  2. REASONS    within a grade, an item a rule positively endorses outranks
    #                one nothing is known about. This started mattering with the
    #                real catalogue — among 947 CIJ printers the vast majority
    #                have no fit rule at all, so without it they bury the one
    #                machine a rule actually recommends.
    #  3. ORDERS     how often it is really bought. A machine sold every week is
    #                a safer recommendation than an equally-suitable one nobody
    #                has ordered since 2019: parts availability, field
    #                familiarity and installation experience follow the volume.
    #  4. DOCUMENTED whether the rep can put a datasheet and a photograph in
    #                front of the customer. Last, because it describes the quote
    #                rather than the machine.
    #  5. ITEM NO    so the order is stable and two runs never disagree.
    rank = rank or {}
    ordered = sorted(
        graded,
        key=lambda f: (
            FIT_ORDER[f["grade"]],
            0 if f["reasons"] else 1,
            -int(rank.get(f["itemNo"], {}).get("orders") or 0),
            0 if rank.get(f["itemNo"], {}).get("documented") else 1,
            f["itemNo"],
        ),
    )

    # Collapse configurations of one machine, once the ordering has decided which
    # of them speaks for it. After the sort, deliberately: the representative has
    # to be the best-fitting configuration, not whichever happened to be first in
    # the catalogue.
    group_on = [k for k in (identity or []) if not (attributes or {}).get(k)]
    if not group_on:
        return ordered

    by_item = {_get(i, "itemNo"): i for i in items}
    out: list[dict] = []
    first: dict[str, dict] = {}
    for f in ordered:
        attrs = _get(by_item.get(f["itemNo"], {}), "attributes", {}) or {}
        key = identity_key(attrs, group_on)
        if key is None:
            out.append(f)
            continue
        rep = first.get(key)
        if rep is None:
            rep = dict(f, variants=1,
                       identity={k: attrs.get(k) or "" for k in group_on})
            first[key] = rep
            out.append(rep)
        else:
            rep["variants"] += 1
    return out


# --------------------------------------------------------------- narrowing


COLOUR_WORDS = ("black", "white", "red", "blue", "green", "yellow", "orange",
                "silver", "brown", "purple", "grey", "gray")


def _colour_named(text: str, words: Sequence[str]) -> str | None:
    """The colour a sentence names, by word rather than by substring.

    "black ink" names black. "blackcurrant juice" does not.
    """
    low = (text or "").lower()
    for c in words:
        if re.search(rf"\b{re.escape(c)}\b", low):
            return c
    return None


def _same_colour(a: str, b: str) -> bool:
    """Grey and gray are one colour spelt two ways; neither denies the other."""
    norm = lambda c: "grey" if c == "gray" else c  # noqa: E731
    return norm(a) == norm(b)


def _engages(rule: dict, profile: dict) -> str | None:
    """What the profile said that makes this narrowing rule apply, or None."""
    for t in _get(rule, "triggers", []) or []:
        if _get(t, "triggerType") != "profile" or not _get(t, "profileField"):
            return None
        raw = (profile or {}).get(_get(t, "profileField"))
        value = "" if raw is None else str(raw)
        allowed = [v.strip() for v in str(_get(t, "compareValue", "") or "").split(",")
                   if v.strip()]
        op = _get(t, "compareOp")
        if op == "matchesColour":
            return _colour_named(value, allowed)
        if op == "in":
            return value if value in allowed else None
        # A narrowing rule with a trigger nobody implemented must not narrow silently.
        return None
    return None


def narrowing_for(profile: dict | None, items: Iterable[dict], technology_code: str,
                  rules: Iterable[dict]) -> dict:
    """What the application rules out before anything is graded.

    Mirrors web/src/engine/narrowing.ts. See data/application-narrowing.md for the
    judgement the rules cite, and data/narrowing-rules.json for the rules.

    Returns ``{"narrow": {attr: [values]}, "deny": {...} | None, "applied": [...]}``.
    """
    narrow: dict[str, list[str]] = {}
    patterns: list[str] = []
    applied: list[dict] = []
    roles: list[str] = []
    if not profile:
        return {"narrow": narrow, "deny": None, "applied": applied}

    items = list(items)

    def values_of(name: str) -> list[str]:
        seen: list[str] = []
        for i in items:
            if _get(i, "technologyCode") != technology_code:
                continue
            v = (_get(i, "attributes", {}) or {}).get(name)
            if v and v not in seen:
                seen.append(v)
        return seen

    for rule in rules:
        if _get(rule, "ruleType") != "narrowing" or not _get(rule, "isActive", True):
            continue
        tech = _get(rule, "technologyCode")
        if tech is not None and tech != technology_code:
            continue
        matched = _engages(rule, profile)
        if matched is None:
            continue

        for action in _get(rule, "actions", []) or []:
            if _get(action, "actionType") != "narrow" or not _get(action, "attribute"):
                continue
            attribute = _get(action, "attribute")
            matcher = _get(action, "matcher")
            kept: list[str] = []
            mine: list[str] = []

            if matcher == "porosity":
                # Exact on the attribute: "Non-porous" contains the word "porous",
                # so anything looser keeps precisely the inks the application
                # rules out. In descriptions the lookbehind is the whole point.
                want = "porous" if matched == "porous" else "non-porous"
                kept = [v for v in values_of(attribute) if v.lower() == want]
                mine.append(r"\bnon-?porous\b" if matched == "porous"
                            else r"(?<!non-)(?<!non)\bporous\b")
            elif matcher == "inkColour":
                triggers = _get(rule, "triggers", []) or []
                words = [v.strip() for v in
                         str(_get(triggers[0], "compareValue", "") or "").split(",")
                         if v.strip()] if triggers else list(COLOUR_WORDS)
                kept = [v for v in values_of(attribute)
                        if re.search(rf"\b{re.escape(matched)}\b", v, re.I)]
                for other in words:
                    if _same_colour(other, matched):
                        continue
                    mine.append(rf"\b{re.escape(other)}\b")
            else:
                continue

            if kept:
                narrow[attribute] = kept
            patterns.extend(mine)
            for r in str(_get(action, "denyRoles", "") or "").split(","):
                r = r.strip()
                if r and r not in roles:
                    roles.append(r)
            applied.append({
                "ruleCode": _get(rule, "ruleCode"),
                "summary": _get(rule, "summary"),
                "detail": _get(rule, "detail"),
                "sourceRef": _get(rule, "sourceRef"),
                "author": _get(rule, "author"),
                "attribute": attribute,
                "kept": kept,
                "matched": matched,
            })

    return {
        "narrow": narrow,
        "deny": {"roles": roles, "patterns": patterns} if patterns else None,
        "applied": applied,
    }


def identity_key(attributes: dict, group_on: Sequence[str]) -> str | None:
    """What makes two rows the same machine, or None when this row is not grouped.

    Mirrors identityKey in web/src/engine/evaluate.ts. Exported because the machine
    COUNT has to group the way the machine LIST does. It did not, and the price-book
    chip offered "CIJ - 947 machines" above a list showing nine: 947 was the part
    numbers, because a Corvus SKU is a printer already filled with a printhead, an ink
    and a colour.

    An item that does not carry the identity attributes is not grouped. Treating
    "absent" as a value put every such item in one bucket together, and two machines
    that merely both lack a Printer Type are not the same machine.
    """
    if not group_on:
        return None
    attributes = attributes or {}
    if any(not attributes.get(k) for k in group_on):
        return None
    # A NUL separator, not a space: attribute values are full of spaces
    # ("6400 Dye Based"), so a space would let two identities collide.
    return "\u0000".join(str(attributes.get(k, "")) for k in group_on)


def count_machines(items: Iterable[dict], technology_code: str,
                   identity: Sequence[str] | None) -> int:
    """How many distinct machines a book holds, counted the way the list shows them.

    Not how many part numbers carry a role of printer, which is what the chip used to
    say. A rep choosing a price book is choosing between machines.
    """
    group_on = list(identity or [])
    seen: set[str] = set()
    ungrouped = 0
    for i in items:
        if _get(i, "technologyCode") != technology_code:
            continue
        if _get(i, "itemRole") != "printer" or not _get(i, "isActive", False):
            continue
        key = identity_key(_get(i, "attributes", {}) or {}, group_on)
        if key is None:
            ungrouped += 1
        else:
            seen.add(key)
    return len(seen) + ungrouped
