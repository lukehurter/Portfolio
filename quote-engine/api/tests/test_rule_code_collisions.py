"""No rule code is written by two files.

cpq.rule.rule_code is UNIQUE. 04_seed_rules.sql inserts the workbook drafts and
07_application_rules.sql is generated from data/*.json, and 124 W-codes moved from the
first to the second when their part numbers were recovered. Leaving them in both would
mean the two scripts cannot be run against the same database — which is not a subtle
failure, but it is one nobody would meet until deployment day, because no test in this
repository has ever needed a database.
"""

from __future__ import annotations

import pathlib
import re

BASE = pathlib.Path(__file__).resolve().parents[2]


def codes(path: pathlib.Path) -> set[str]:
    text = path.read_text("utf-8", errors="replace")
    return set(re.findall(r"INSERT INTO cpq\.rule \([^)]*\)\s*\n?\s*VALUES \(N'([A-Z]+-[\w-]+)'",
                          text))


def test_the_seed_and_the_generated_rules_do_not_overlap() -> None:
    seed = codes(BASE / "sql" / "04_seed_rules.sql")
    generated = codes(BASE / "sql" / "07_application_rules.sql")
    assert seed, "no rules found in 04 — has the INSERT shape changed?"
    assert generated, "no rules found in 07 — has the INSERT shape changed?"
    both = seed & generated
    assert not both, (
        "these rule codes are inserted by both scripts and rule_code is UNIQUE, so the "
        "second one to run fails: " + ", ".join(sorted(both))
    )
