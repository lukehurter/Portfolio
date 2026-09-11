"""Every column the service names is a column the schema defines.

WHY THIS EXISTS

Nothing in sql/ has ever run. So a query naming a column that does not exist is not a
compile error, not a type error and not a test failure — it is correct-looking Python
that throws the first time it meets a database, and only on the path that runs it.

Three of these were found by reading, one at a time, and each was invisible until
somebody happened to put the query and the table side by side:

  * cpq.fn_effective_role was selected FROM as a table and declared as a scalar, and
    read a column (role_source) that existed nowhere. Every authenticated request.
    See test_auth_sql_parity.py, which covers that one function in more detail.
  * cpq.rule_audit had no `summary` column, though repo.py wrote one on every rule
    save and read one back for the history panel. The audit insert shares the rule
    save's transaction, so saving ANY rule failed.
  * cpq.access_log's column is `event`; repo.py inserted into `action`. Every audited
    privileged action.

Reading found them slowly and would have missed the next one. Comparing the two
mechanically finds them all at once, so that is what this does: it reads the columns
out of sql/ and the columns out of api/, and asserts the second is a subset of the
first.

WHAT IT DOES NOT COVER

Views. A view's columns come from its own SELECT and resolving that properly means
implementing a SQL engine, so anything read through cpq.v_* is out of scope here — as
is any query too tangled for the conservative parsing below, which is skipped rather
than guessed at. A skipped query is a gap in this test; a wrong assertion would be a
reason to delete it. Only a real database proves the rest.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SQL = ROOT / "sql"
API = ROOT / "api"

os.environ.setdefault("CPQ_DEMO", "1")
sys.path.insert(0, str(API))

#: Not a column list — a placeholder the f-string fills in. Checked separately.
INTERPOLATED = re.compile(r"[{}]")


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return re.sub(r"--[^\n]*", " ", sql)


def table_columns() -> dict[str, set[str]]:
    """Every base table in sql/, and the columns it ends up with.

    CREATE TABLE gives the starting set and ALTER TABLE ADD grows it, because the
    migrations are how this schema gains a column — quote_line.is_optional,
    quote.print_quality, quote.solutions and quote_line.solution_id all arrive that
    way, and a test that read only CREATE TABLE would call every one of them missing.
    """
    out: dict[str, set[str]] = {}
    for f in sorted(SQL.glob("*.sql")):
        src = strip_comments(f.read_text(encoding="utf-8"))
        for m in re.finditer(r"CREATE\s+TABLE\s+(cpq\.\w+)\s*\((.*?)\n\s*\);", src, re.S | re.I):
            cols = out.setdefault(m.group(1).lower(), set())
            for part in m.group(2).split(","):
                name = re.match(r"\s*([A-Za-z_]\w*)\s+\w", part)
                if name and name.group(1).upper() not in {
                        "CONSTRAINT", "PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "INDEX"}:
                    cols.add(name.group(1).lower())
        for m in re.finditer(r"ALTER\s+TABLE\s+(cpq\.\w+)\s+ADD\s+([A-Za-z_]\w*)\s+\w", src, re.I):
            if m.group(2).upper() not in {"CONSTRAINT", "CHECK"}:
                out.setdefault(m.group(1).lower(), set()).add(m.group(2).lower())
    return out


TABLES = table_columns()


def api_sources() -> list[tuple[str, str]]:
    return [(f.name, f.read_text(encoding="utf-8")) for f in sorted(API.glob("*.py"))]


def where(src: str, at: int) -> int:
    return src[:at].count("\n") + 1


def test_the_schema_was_read_at_all() -> None:
    """A parsing change that quietly matched nothing would make every test below
    pass by vacuum, which is the failure mode of a test that reads source code."""
    assert len(TABLES) > 20, f"only found {len(TABLES)} tables in {SQL}"
    assert "cpq.quote" in TABLES
    assert {"quote_no", "technology_cd", "solutions"} <= TABLES["cpq.quote"]


def test_every_inserted_column_exists() -> None:
    bad: list[str] = []
    for name, src in api_sources():
        for m in re.finditer(r"INSERT\s+INTO\s+(cpq\.\w+)\s*\(([^)]*)\)", src, re.I | re.S):
            table = m.group(1).lower()
            if table not in TABLES or INTERPOLATED.search(m.group(2)):
                continue
            for col in (c.strip().lower() for c in m.group(2).split(",") if c.strip()):
                if col not in TABLES[table]:
                    bad.append(f"{name}:{where(src, m.start())} INSERT {table}({col})")
    assert not bad, "columns written that the schema does not define:\n  " + "\n  ".join(bad)


def test_every_updated_column_exists() -> None:
    bad: list[str] = []
    for name, src in api_sources():
        for m in re.finditer(r"UPDATE\s+(cpq\.\w+)\s+SET\s+(.*?)\bWHERE\b", src, re.I | re.S):
            table = m.group(1).lower()
            if table not in TABLES:
                continue
            for col in re.findall(r"([A-Za-z_]\w*)\s*=\s*(?:\?|SYSUTCDATETIME)", m.group(2)):
                if col.lower() not in TABLES[table]:
                    bad.append(f"{name}:{where(src, m.start())} UPDATE {table} SET {col}=")
    assert not bad, "columns updated that the schema does not define:\n  " + "\n  ".join(bad)


def test_every_selected_column_exists() -> None:
    """Reads too, not just writes — cpq.rule_audit.summary was read as well as written.

    Deliberately conservative: only a SELECT whose FROM names one base table and no
    join, and within it only bare columns. Anything wrapped in a function, aliased
    through a table prefix, or interpolated is skipped rather than guessed at.
    """
    bad: list[str] = []
    for name, src in api_sources():
        for m in re.finditer(
                r"SELECT\s+(.*?)\s+FROM\s+(cpq\.\w+)\s*(?:WHERE|ORDER|GROUP|\"\"\")",
                src, re.I | re.S):
            table = m.group(2).lower()
            select = m.group(1)
            if table not in TABLES or INTERPOLATED.search(select):
                continue
            # A non-greedy .*? will happily run past the end of one statement and pair
            # that statement's SELECT with a later statement's FROM — which reported an
            # INSERT's column list as though it were being read out of cpq.quote. A
            # select list containing any of these is not a select list.
            if re.search(r"\b(SELECT|INSERT|UPDATE|DELETE|VALUES|FROM|JOIN)\b",
                         select, re.I):
                continue
            for item in select.split(","):
                item = item.strip()
                if not item or "(" in item or "." in item or item == "*":
                    continue                      # function, qualified, or everything
                col = re.match(r"([A-Za-z_]\w*)(?:\s+AS\s+\w+)?$", item, re.I)
                if col and col.group(1).lower() not in TABLES[table]:
                    bad.append(f"{name}:{where(src, m.start())} SELECT {col.group(1)} "
                               f"FROM {table}")
    assert not bad, "columns read that the schema does not define:\n  " + "\n  ".join(bad)


def test_the_profile_column_map_is_all_real_columns() -> None:
    """repo.PROFILE_COLS builds its own SELECT list and UPDATE assignments, so the
    checks above see an f-string placeholder rather than column names."""
    import repo

    missing = sorted(c for c in repo.PROFILE_COLS.values()
                     if c.lower() not in TABLES["cpq.quote"])
    assert not missing, f"PROFILE_COLS names columns cpq.quote does not have: {missing}"


def test_the_profile_column_map_holds_only_profile_fields() -> None:
    """And every KEY is a field of the profile it claims to map.

    This is the map that carried `solutionProfiles: solution_profiles`. Both halves of
    that row were real — solutionProfiles was a draft field and solution_profiles was a
    column — so nothing about it looked wrong, and checking the columns exist would not
    have found it either. What was wrong is that it sat in a map of PROFILE fields:
    write_evaluation reads these out of `draft["profile"]`, so it fetched
    draft["profile"]["solutionProfiles"], a key that never exists, and every station's
    answers were silently written as NULL.

    The invariant is the one the map's name states: these are the profile's fields.
    """
    import repo
    from models import ApplicationProfile

    known = set(ApplicationProfile.model_fields)
    stray = sorted(set(repo.PROFILE_COLS) - known)
    assert not stray, (
        "PROFILE_COLS maps fields that are not on ApplicationProfile, so they are read "
        f"from draft['profile'] where they will never be: {stray}")


@pytest.mark.parametrize("table", ["cpq.quote", "cpq.quote_line", "cpq.rule_audit",
                                   "cpq.access_log"])
def test_the_tables_this_test_cares_about_are_defined(table: str) -> None:
    """Named explicitly so that renaming or dropping one of them fails here rather
    than silently removing this file's coverage of it."""
    assert table in TABLES, f"{table} is not defined anywhere in {SQL}"
