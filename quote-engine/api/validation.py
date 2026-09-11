"""
Rule validation.

`web/src/api/mock.ts` runs the same checks so the admin screen can show errors
as you type, but this is the one that decides. A check that exists only in the
browser is not a check — it is a suggestion that anyone with a terminal can
decline.

Part numbers are verified against Orbit here, which the browser cannot do
honestly, so this version is strictly stronger than the client's.
"""

from __future__ import annotations

import repo

# Every field of the application profile a rule may read.
#
# A profile trigger naming a field that does not exist is accepted by the engine and
# then never fires — `_compare` sees None on the left and returns False — so the rule
# is saved, looks right in the list, and silently does nothing. The rule editor used to
# offer two such names outright (`throwDistanceMm`, `characterHeightMm`), which is how
# this was found. Keep in step with ApplicationProfile in web/src/api/types.ts;
# api/tests/test_validation.py asserts the two lists match.
PROFILE_FIELDS = {
    "substrate", "porosity", "productWidthMm", "productLengthMm",
    "labelWidthMm", "labelLengthMm",
    "productTempF", "lineSpeedFpm", "throughputPpm", "productSpacingMm", "conveyor",
    "guideRails", "productMotion", "charHeightMm", "throwDistMm",
    "linesOfPrint", "markingWindowMm", "messageContent",
    "barcodeRequirements", "printQuality", "inkType", "dryTimeSeconds", "environment",
    "ambientTempMinF", "ambientTempMaxF", "adhesionRequirements", "sampleTested",
    "notes",
}

# Fields the engines compute rather than ask for.
#
# Kept apart from PROFILE_FIELDS because they answer to different things: the stored
# fields must match ApplicationProfile exactly, and a test asserts it, while these must
# match what the engines actually resolve. Folding them together would have quietly
# turned that test off.
#
# Mirrors DERIVED_FIELDS in web/src/engine/evaluate.ts, which is what the rule editor
# offers; api/tests/test_validation.py asserts the two agree.
DERIVED_FIELDS = {
    "markHeightMm",
}

# What a rule may name. Rejecting a derived field here would reject eight shipped rules.
TRIGGERABLE_FIELDS = PROFILE_FIELDS | DERIVED_FIELDS

# "matchesColour" belongs to narrowing rules only: it asks whether a profile field
# names one of a list of colour words, by word rather than by substring, and it is
# the trigger side of what engine.narrowing_for does. Held equal with the
# TypeScript union in types.ts by test_comparators_match_the_typescript.
COMPARATORS = {"eq", "ne", "gt", "gte", "lt", "lte", "includes", "includesAny",
               "in", "matchesColour"}

# What a rule code looks like. Deliberately loose about the middle and strict about
# the shape, because the shape is what makes a list of 200 rules readable.
RULE_CODE = __import__("re").compile(r"^[A-Z]{1,2}-[A-Z0-9]+(?:-[A-Z0-9]+)*$")


def validate_rule(rule: dict, known_items: set[str] | None = None,
                  existing_codes: set[str] | None = None) -> dict:
    issues: list[dict] = []

    def err(field: str, message: str) -> None:
        issues.append({"level": "error", "field": field, "message": message})

    def warn(field: str, message: str) -> None:
        issues.append({"level": "warning", "field": field, "message": message})

    if not (rule.get("ruleCode") or "").strip():
        err("ruleCode", "A rule code is required.")
    # A second rule under an existing code is not a variant, it is a collision: the
    # trace names a rule by its code, the approval record stores the code, and the
    # editor loads a rule BY code — so the second one is unreachable and the first one
    # gets blamed for what it does. REPORTED: "there's nothing stopping you from
    # adding multiple rules with the same code."
    code = (rule.get("ruleCode") or "").strip()
    if code and existing_codes and code in existing_codes:
        err("ruleCode", f"{code} is already in use. Every rule needs its own code — "
                        "the trace, the approval record and this editor all find a "
                        "rule by it.")
    if code and not RULE_CODE.match(code):
        err("ruleCode", "A rule code looks like R-091, A-CIJ-SPD-6400 or Q-BARE-MOUNT: "
                        "a prefix, then what it is about, in capitals.")

    if not (rule.get("summary") or "").strip():
        err("summary", "Summary is what a rep reads on the quote. It cannot be blank.")

    triggers = rule.get("triggers") or []
    actions = rule.get("actions") or []
    conditions = rule.get("conditions") or []

    if not triggers:
        err("triggers", "A rule with no trigger can never fire.")
    if not actions and not conditions:
        err("actions", "A rule with no action and no conditions does nothing.")

    # Resolve every part number the rule mentions in one round trip.
    if known_items is None:
        mentioned = {t.get("itemNo") for t in triggers if t.get("itemNo")}
        mentioned |= {a.get("itemNo") for a in actions if a.get("itemNo")}
        mentioned |= {c.get("itemNo") for c in conditions if c.get("itemNo")}
        known_items = {i["itemNo"] for i in repo.items_for(sorted(mentioned))} if mentioned else set()

    for i, t in enumerate(triggers):
        if t.get("triggerType") == "item" and t.get("itemNo") and t["itemNo"] not in known_items:
            err(f"triggers.{i}.itemNo", f"{t['itemNo']} is not a part number in Orbit.")
        if t.get("triggerType") == "total":
            try:
                float(t.get("compareValue"))
            except (TypeError, ValueError):
                err(f"triggers.{i}.compareValue",
                    "An order-value trigger needs an amount to compare against.")
        if t.get("triggerType") == "profile":
            field = t.get("profileField")
            if not field:
                err(f"triggers.{i}.profileField",
                    "Say which part of the application this looks at.")
            elif field not in TRIGGERABLE_FIELDS:
                # Not a warning. A rule keyed to a field that does not exist never
                # fires, and a rule that never fires is worse than no rule: it reads
                # as cover for a decision nothing is actually checking.
                err(f"triggers.{i}.profileField",
                    f"{field} is not part of the application profile, so this rule "
                    "would never fire. Choose a field from the list.")
        if t.get("compareOp") and t["compareOp"] not in COMPARATORS:
            err(f"triggers.{i}.compareOp",
                f"{t['compareOp']} is not a comparison either engine implements.")

    for i, a in enumerate(actions):
        if a.get("itemNo") and a["itemNo"] not in known_items:
            err(f"actions.{i}.itemNo", f"{a['itemNo']} is not a part number in Orbit.")
        if a.get("actionType") == "cap":
            m = a.get("maxDiscount")
            if m is None or m < 0 or m > 1:
                err(f"actions.{i}.maxDiscount", "A cap must be between 0 and 100 percent.")
        # An exclude with nothing to exclude would block every quote it engages
        # on. This is the check that a malformed seed row got past once.
        if a.get("actionType") == "exclude" and not a.get("itemNo"):
            err(f"actions.{i}.itemNo",
                "Say which part this excludes. An exclude with no part would block "
                "every quote the rule touches.")
        if a.get("actionType") == "require" and not a.get("itemNo"):
            err(f"actions.{i}.itemNo", "Say which part is required.")

    eff_from, eff_to = rule.get("effectiveFrom"), rule.get("effectiveTo")
    if eff_to and eff_from and eff_to < eff_from:
        err("effectiveTo", "The end date is before the start date.")
    if eff_to:
        from datetime import date
        if eff_to < date.today().isoformat():
            warn("effectiveTo", "This end date is in the past, so the rule will never fire.")

    if not (rule.get("detail") or "").strip():
        warn("detail", "Without the original wording, a rep cannot see where the rule came from.")
    if not (rule.get("sourceRef") or "").strip():
        warn("sourceRef", "No source recorded. The quote will say the reference was not recorded.")

    return {"ok": not any(i["level"] == "error" for i in issues), "issues": issues}
