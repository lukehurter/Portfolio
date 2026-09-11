"""
The validator's field list against the profile it validates.

`validation.py` has to know every field of the application profile, and that list is
declared in TypeScript. Two copies of one list is a drift risk, so this reads the
TypeScript and asserts they match rather than trusting anybody to update both.

The defect that prompted it: the rule editor offered `throwDistanceMm` and
`characterHeightMm`, which are not fields — the real ones are `throwDistMm` and
`charHeightMm`. A rule authored on either was accepted and never fired.

    cd "CPQ System/api" && python -m pytest
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from engine import evaluate, suggest
from validation import COMPARATORS, DERIVED_FIELDS, PROFILE_FIELDS, validate_rule

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web" / "src" / "api" / "types.ts"


def ts_profile_fields() -> set[str]:
    """The keys of EMPTY_PROFILE, which is the exhaustive one — the interface allows
    optional members, the constant has to name every field."""
    text = WEB.read_text(encoding="utf-8")
    start = text.index("export const EMPTY_PROFILE")
    end = text.index("};", start)
    body = text[start:end]
    return set(re.findall(r"(\w+):\s*(?:null|\[\]|'')", body))


def ts_comparators() -> set[str]:
    """The compareOp union in types.ts, however it is laid out.

    This read one line, which was true until a comparator earned a doc comment and
    the union wrapped. A test that silently stops seeing half the union is worse
    than no test: it passed while Python and TypeScript disagreed.
    """
    text = WEB.read_text(encoding="utf-8")
    start = text.index("compareOp?:")
    union = text[start:text.index(";", start)]
    union = re.sub(r"/\*.*?\*/", " ", union, flags=re.S)  # comments quote words too
    return set(re.findall(r"'(\w+)'", union))


def ts_derived_fields() -> set[str]:
    """The keys of DERIVED_FIELDS in the TypeScript engine. These are the fields a rule
    may name that nobody is asked for, and the rule editor offers them from that same
    constant — so if the two drift, one side accepts a trigger the other rejects."""
    # api/derivedFields.ts, not engine/evaluate.ts. It moved so that the rule editor
    # could import this one constant without dragging the pricing engine into the
    # production bundle behind it.
    text = (WEB.parent / "derivedFields.ts").read_text(encoding="utf-8")
    start = text.index("export const DERIVED_FIELDS")
    return set(re.findall(r"(\w+):\s*'", text[start:text.index("};", start)]))


def test_derived_fields_match_the_typescript() -> None:
    ts = ts_derived_fields()
    assert ts, "could not read DERIVED_FIELDS out of evaluate.ts"
    assert DERIVED_FIELDS == ts, (
        f"only in validation.py: {sorted(DERIVED_FIELDS - ts)}; "
        f"only in evaluate.ts: {sorted(ts - DERIVED_FIELDS)}")


def test_profile_fields_match_the_typescript() -> None:
    ts = ts_profile_fields()
    assert ts, "could not read EMPTY_PROFILE out of types.ts"
    assert PROFILE_FIELDS == ts, (
        f"only in validation.py: {sorted(PROFILE_FIELDS - ts)}; "
        f"only in types.ts: {sorted(ts - PROFILE_FIELDS)}")


def test_comparators_match_the_typescript() -> None:
    assert COMPARATORS == ts_comparators()


BASE = {
    "ruleCode": "T-1", "summary": "A rule.", "ruleType": "note", "severity": "info",
    "effectiveFrom": "2026-01-01", "effectiveTo": None,
    "actions": [{"actionType": "warn", "message": "hello"}],
    "conditions": [],
}


def errors(rule: dict) -> list[str]:
    got = validate_rule(rule, known_items=set())
    return [i["message"] for i in got["issues"] if i["level"] == "error"]


@pytest.mark.parametrize("field", ["throwDistanceMm", "characterHeightMm", "speed", ""])
def test_a_field_that_does_not_exist_is_an_error(field: str) -> None:
    rule = {**BASE, "triggers": [
        {"triggerType": "profile", "profileField": field, "compareOp": "gt", "compareValue": "5"}]}
    assert errors(rule), f"{field!r} was accepted"


def test_a_real_field_passes() -> None:
    rule = {**BASE, "triggers": [
        {"triggerType": "profile", "profileField": "charHeightMm",
         "compareOp": "gt", "compareValue": "8.64"}]}
    assert errors(rule) == []


def test_an_invented_comparator_is_an_error() -> None:
    rule = {**BASE, "triggers": [
        {"triggerType": "profile", "profileField": "substrate",
         "compareOp": "startsWith", "compareValue": "dark"}]}
    assert any("startsWith" in m for m in errors(rule))


def test_includes_any_is_accepted() -> None:
    """Every technology-fit rule uses it, so refusing it would reject shipped rules."""
    rule = {**BASE, "triggers": [
        {"triggerType": "profile", "profileField": "substrate",
         "compareOp": "includesAny", "compareValue": "film,foil,web"}]}
    assert errors(rule) == []

# ---------------------------------------------------------------- shape parity


def ts_interface(name: str) -> dict[str, bool]:
    """The fields of a TypeScript interface in types.ts, and which are optional.

    The two engines are held equal by engine-cases.json, and a case only covers what
    somebody wrote a case for. suggest() drifted for months that way: the TypeScript
    side grew `roles` and then the whole application narrowing, and neither reached
    the Python engine, which is the production authority — so the real service would
    have offered a rep 947 CIJ configurations where the preview offers 663.

    Cases catch a wrong ANSWER. This catches a missing FIELD, which is the drift that
    goes unnoticed because nothing fails: the caller reads undefined and moves on.
    """
    text = WEB.read_text(encoding="utf-8")
    start = text.index(f"export interface {name} {{")
    body = text[start:text.index("\n}", start)]
    body = re.sub(r"/\*.*?\*/", " ", body, flags=re.S)   # doc comments quote field names
    body = re.sub(r"//.*", " ", body)
    return {m.group(1): bool(m.group(2))
            for m in re.finditer(r"^\s{2}(\w+)(\?)?:", body, re.M)}


def test_evaluate_returns_the_whole_evaluation() -> None:
    spec = json.loads((ROOT / "engine-cases.json").read_text("utf-8"))
    case = spec["cases"][0]
    got = evaluate(
        {**case["draft"], "profile": {}},
        spec["fixtures"]["items"], spec["fixtures"]["rules"],
        spec["fixtures"]["categories"], spec["fixtures"]["today"],
    )
    want = ts_interface("Evaluation")
    assert want, "could not read the Evaluation interface out of types.ts"
    missing = sorted(f for f, optional in want.items() if not optional and f not in got)
    assert not missing, f"Evaluation fields the Python engine never returns: {missing}"
    extra = sorted(set(got) - set(want))
    assert not extra, f"the Python engine returns fields TypeScript has never heard of: {extra}"


def test_suggest_returns_the_whole_assessment() -> None:
    spec = json.loads((ROOT / "engine-cases.json").read_text("utf-8"))
    got = suggest(
        {"technologyCode": "CIJ", "profile": {}},
        spec["fixtures"]["items"], spec["fixtures"]["rules"], spec["fixtures"]["today"],
    )
    assert got, "the fixtures should offer at least one CIJ machine"
    want = ts_interface("FitAssessment")
    assert want, "could not read the FitAssessment interface out of types.ts"
    missing = sorted(f for f, optional in want.items()
                     if not optional and f not in got[0])
    assert not missing, f"FitAssessment fields the Python engine never returns: {missing}"
