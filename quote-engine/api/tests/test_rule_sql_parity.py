"""What the preview evaluates and what the service stores are the same rules.

data/build_rules.py writes appRules.ts and 07_application_rules.sql from one set of
JSON files, and that is the whole argument for generating both: the two can never
disagree about what a rule says.

They disagreed. The SQL emitter wrote four of the thirteen action columns, so an
`approve` action reached the database with a NULL approver_role — an approval naming
nobody — every `require` lost its quantity, and the two narrowing rules lost the
matcher and the attribute they narrow ON, which is the entire content of a narrowing
rule. The preview was right and the service was quietly not.

Nothing pointed at it because both files were generated, both were checked in, and
neither is read by a human. So this reads the emitted SQL and asserts that every field
present in the source JSON actually appears in it.
"""

from __future__ import annotations

import json
import pathlib
import re

BASE = pathlib.Path(__file__).resolve().parents[2]
DATA = BASE / "data"
SQL = BASE / "sql" / "07_application_rules.sql"

SOURCES = ("application-rules", "technology-fit-rules", "datasheet-rules",
           "structure-rules", "narrowing-rules", "catalogue-requirements")

#: action field -> the column build_rules.py must write it to.
ACTION_COLUMNS = {
    "actionType": "action_type", "itemNo": "item_no", "quantity": "quantity",
    "maxDiscount": "max_discount", "fitGrade": "fit_grade",
    "approverRole": "approver_role", "allowanceAmt": "allowance_amt",
    "message": "message", "remedy": "remedy", "matcher": "matcher",
    "attribute": "attribute", "denyRoles": "deny_roles",
}


def rules() -> list[dict]:
    out = []
    for name in SOURCES:
        out += json.loads((DATA / f"{name}.json").read_text("utf-8"))["rules"]
    return out


def test_every_action_field_has_a_column() -> None:
    used = {k for r in rules() for a in r["actions"] for k in a}
    unmapped = used - set(ACTION_COLUMNS)
    assert not unmapped, (
        "these action fields have nowhere to go in cpq.rule_action: "
        + ", ".join(sorted(unmapped))
        + " — add the column in sql/01 and a migration, then map it here"
    )


def test_the_emitter_writes_every_column() -> None:
    sql = SQL.read_text("utf-8", errors="replace")
    insert = re.search(r"INSERT INTO cpq\.rule_action \(([^)]*)\) VALUES", sql)
    assert insert, "no rule_action insert in the generated SQL"
    written = {c.strip() for c in insert.group(1).split(",")} - {"rule_id"}
    missing = set(ACTION_COLUMNS.values()) - written
    assert not missing, (
        "the generated SQL never writes these columns, so the value is dropped "
        "silently on its way to the service: " + ", ".join(sorted(missing))
    )


def test_the_values_actually_arrive() -> None:
    """Columns in the insert list prove nothing if every value is NULL.

    Checked per field rather than in aggregate: `approver_role` appears on exactly one
    rule, and an aggregate count would have stayed green while that one was lost.
    """
    sql = SQL.read_text("utf-8", errors="replace")
    for field, column in sorted(ACTION_COLUMNS.items()):
        if field == "actionType":
            continue
        expected = [a[field] for r in rules() for a in r["actions"] if a.get(field) is not None]
        if not expected:
            continue
        for value in expected[:6]:
            needle = (f"N'{str(value)}'".replace("''", "'") if isinstance(value, str)
                      else str(value))
            if isinstance(value, str):
                needle = "N'" + str(value).replace("'", "''") + "'"
            assert needle in sql, (
                f"{field} -> {column}: {value!r} is in the rule data and not in the "
                f"generated SQL"
            )


def test_narrowing_rules_carry_what_they_narrow_on() -> None:
    """A narrowing rule without its matcher is not a weaker rule, it is no rule.

    N-POROSITY and N-INK-COLOUR are how a rep stops being offered a white ink for a
    black print. Reaching the service without `matcher` they offered everything.
    """
    narrowing = json.loads((DATA / "narrowing-rules.json").read_text("utf-8"))["rules"]
    assert narrowing, "no narrowing rules — has the file moved?"
    sql = SQL.read_text("utf-8", errors="replace")
    for r in narrowing:
        for a in r["actions"]:
            for field in ("matcher", "attribute", "denyRoles"):
                value = a.get(field)
                if value is None:
                    continue
                assert f"N'{value}'" in sql, (
                    f"{r['ruleCode']} narrows on {field}={value!r} and the generated "
                    f"SQL does not carry it"
                )
