"""
The shared golden cases.

`web/src/engine/evaluate.test.ts` reads the same file and asserts the same
things. The point is that neither engine can be changed alone: touch one and the
other side's test fails. Two engines quietly disagreeing about a price is the
failure this is here to prevent.

    cd "CPQ System/api" && python -m pytest
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from engine import evaluate, narrowing_for, suggest

SPEC = json.loads((Path(__file__).resolve().parents[2] / "engine-cases.json").read_text("utf-8"))
FIX = SPEC["fixtures"]
# The real narrowing rules, not a copy of them: they are what the narrowing cases
# are testing, and a fixture copy could drift from what ships.
NARROWING_RULES = json.loads(
    (Path(__file__).resolve().parents[2] / "data" / "narrowing-rules.json")
    .read_text("utf-8"))["rules"]
for _r in NARROWING_RULES:
    _r.setdefault("isActive", True)

EMPTY_PROFILE = {
    "substrate": None, "porosity": None, "lineSpeedFpm": None, "throwDistMm": None,
    "charHeightMm": None, "messageContent": None, "environment": None,
}

SCALARS = ["extendedList", "extendedNet", "orderTotal", "totalDiscount",
           "marginPct", "marginNote", "blocked"]


def run(draft: dict) -> dict:
    full = dict(draft)
    full["profile"] = {**EMPTY_PROFILE, **(draft.get("profile") or {})}
    return evaluate(full, FIX["items"], FIX["rules"], FIX["categories"], FIX["today"])


@pytest.mark.parametrize("case", SPEC["cases"], ids=[c["name"] for c in SPEC["cases"]])
def test_case(case: dict) -> None:
    got = run(case["draft"])
    want = case["expect"]

    for key in SCALARS:
        if key in want:
            assert got[key] == want[key], f"{key}: got {got[key]!r}, want {want[key]!r}"

    if "marginNoteContains" in want:
        assert want["marginNoteContains"] in (got["marginNote"] or "")

    for wl in want.get("lines", []):
        gl = next((l for l in got["lines"] if l["itemNo"] == wl["itemNo"]), None)
        assert gl is not None, f"no line for {wl['itemNo']}"
        for k, v in wl.items():
            if k == "itemNo":
                continue
            assert gl[k] == v, f"{wl['itemNo']}.{k}: got {gl[k]!r}, want {v!r}"

    codes = [t["ruleCode"] for t in got["trace"]]
    for code in want.get("traceCodes", []):
        assert code in codes, f"expected {code} in trace, got {codes}"
    for code in want.get("traceCodesAbsent", []):
        assert code not in codes, f"{code} should not be in the trace"

    for code, status in (want.get("traceStatuses") or {}).items():
        entry = next((t for t in got["trace"] if t["ruleCode"] == code), None)
        assert entry is not None, f"no trace entry for {code}"
        assert entry["status"] == status

    # The kind of part a finding sends the rep to find — see the TypeScript port.
    for code, role in (want.get("tracePickRoles") or {}).items():
        entry = next((t for t in got["trace"] if t["ruleCode"] == code), None)
        assert entry is not None, f"no trace entry for {code}"
        assert entry.get("pickRole") == role, f"pickRole of {code}"
    for code in want.get("tracePickRolesAbsent", []):
        entry = next((t for t in got["trace"] if t["ruleCode"] == code), None)
        assert entry is not None, f"no trace entry for {code}"
        assert entry.get("pickRole") is None, f"{code} should offer no picker"

    for code, needle in (want.get("traceHeadlineContains") or {}).items():
        entry = next(t for t in got["trace"] if t["ruleCode"] == code)
        assert needle in entry["headline"]

    if "requiredApprovals" in want:
        assert len(got["requiredApprovals"]) == len(want["requiredApprovals"])
        for i, wa in enumerate(want["requiredApprovals"]):
            for k, v in wa.items():
                assert got["requiredApprovals"][i][k] == v, f"approval[{i}].{k}"

    # Matched on the solution too where the case names one: an item quoted at two
    # stations is two assessments with the same item number, and matching on the
    # number alone would silently check the first one twice.
    for wf in want.get("fit", []):
        gf = next((f for f in got["fit"]
                   if f["itemNo"] == wf["itemNo"]
                   and ("solutionId" not in wf or f.get("solutionId") == wf["solutionId"])),
                  None)
        where = f"{wf['itemNo']}" + (f" at {wf['solutionId']}" if "solutionId" in wf else "")
        assert gf is not None, f"no fit for {where}"
        assert gf["grade"] == wf["grade"], f"grade of {where}"
        assert [r["ruleCode"] for r in gf["reasons"]] == wf["reasonCodes"], where


@pytest.mark.parametrize(
    "case", SPEC["suggestCases"], ids=[c["name"] for c in SPEC["suggestCases"]])
def test_suggest_case(case):
    """The same file's suggest cases — see the TypeScript port.

    `suggest` answers "which machine", and until grouping it answered with a
    catalogue: a Corvus part number is a printer already filled, so nine machines
    came back as 947 rows.
    """
    draft = {**case["draft"], "profile": {**EMPTY_PROFILE, **case["draft"].get("profile", {})}}
    got = suggest(
        draft, FIX["items"], FIX["rules"], FIX["today"],
        attributes=case.get("attributes"), q=case.get("q"),
        identity=case.get("identity"),
    )
    want = case["expect"]

    if want.get("count") is not None:
        assert len(got) == want["count"], "row count"

    # Stated in full: a row absent from `variants` must carry none, so a change
    # that starts grouping something cannot pass by going unmentioned.
    variants = want.get("variants") or {}
    for f in got:
        assert f.get("variants", 1) == variants.get(f["itemNo"], 1),             f"variants of {f['itemNo']}"

    for item_no, values in (want.get("identityOf") or {}).items():
        f = next((x for x in got if x["itemNo"] == item_no), None)
        assert f is not None, f"{item_no} should be a row"
        assert f.get("identity") == values, f"identity of {item_no}"


@pytest.mark.parametrize(
    "case", SPEC["narrowingCases"], ids=[c["name"] for c in SPEC["narrowingCases"]])
def test_narrowing_case(case):
    """What the application rules out before anything is graded.

    ASKED: "do the rules drive the application fit logic or is there a hidden layer
    in code?" This was the hidden layer, and it lived on the TypeScript side alone —
    so this engine, the production authority, would have offered a rep 947 CIJ
    configurations where the preview offers 663. Both sides run these now.
    """
    profile = {**EMPTY_PROFILE, **case["profile"]}
    items = FIX["narrowingItems"]
    n = narrowing_for(profile, items, case["technologyCode"], NARROWING_RULES)
    want = case["expect"]

    assert [a["ruleCode"] for a in n["applied"]] == want["applied"], "rules that engaged"
    assert n["narrow"] == want["narrow"], "attribute values kept"

    got = suggest(
        {"technologyCode": case["technologyCode"], "profile": profile},
        items, [], FIX["today"], roles=case.get("roles"),
        narrow=n["narrow"], deny=n["deny"],
    )
    assert sorted(f["itemNo"] for f in got) == want["survivors"], "what survived"

    # Every narrowing a rep sees has to be answerable: a code, a sentence, and the
    # document the judgement came from.
    for a in n["applied"]:
        assert a["summary"], f"{a['ruleCode']} has no summary"
        assert a["sourceRef"], f"{a['ruleCode']} cites nothing"
        assert a["author"], f"{a['ruleCode']} has no author"
