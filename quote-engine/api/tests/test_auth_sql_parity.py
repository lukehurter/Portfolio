"""The sign-in query and the function it calls have to fit each other.

WHY THIS EXISTS

`auth.current_user` runs one query, and every route in the service depends on it.
It is also the one query no test can execute: there is no database, and the whole
suite runs under CPQ_DEMO=1 where `db.cursor()` raises before anything is sent. So
the query and `cpq.fn_effective_role` drifted apart completely and nothing noticed
until somebody read them side by side in August 2026. Three separate faults, each
of which alone would have denied every user on the first real run:

  * the function was declared `RETURNS varchar(20)` — a SCALAR — while auth.py
    selected columns out of it in a FROM clause, which T-SQL does not allow at all;
  * auth.py read `r.role_source`, a column that existed nowhere in sql/;
  * the function split the group list on CHAR(10) and auth.py joined it with a
    comma, so a user in one group resolved and a user in two did not.

None of that is exotic. It is what happens when an interface is described in two
languages and neither side can run. So this reads both and compares them, the way
test_route_parity.py compares the client's paths with the service's routes.

It checks the SHAPE of the contract, not the SQL's meaning. A database is still
the only thing that can prove the query runs.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUTH_PY = ROOT / "api" / "auth.py"
SECURITY_SQL = ROOT / "sql" / "02_security.sql"

FUNCTION = "cpq.fn_effective_role"


def function_body() -> str:
    """The CREATE FUNCTION batch for fn_effective_role, up to its terminating GO."""
    sql = SECURITY_SQL.read_text(encoding="utf-8")
    m = re.search(
        rf"CREATE\s+FUNCTION\s+{re.escape(FUNCTION)}\b(.*?)\n\s*GO\s*$",
        sql, re.S | re.M | re.I,
    )
    assert m, f"{FUNCTION} is not defined in {SECURITY_SQL.name}"
    return m.group(1)


def auth_query() -> str:
    """The one query in auth.py that calls the function."""
    text = AUTH_PY.read_text(encoding="utf-8")
    m = re.search(r'"""(\s*SELECT.*?)"""', text, re.S)
    assert m, "no SQL string literal found in auth.py"
    query = m.group(1)
    assert FUNCTION in query, f"the query in auth.py no longer calls {FUNCTION}"
    return query


def test_the_function_returns_a_table_because_auth_selects_from_it() -> None:
    """A scalar UDF cannot appear in a FROM clause. This is the fault that would
    have failed every authenticated request on the first run against SQL Server."""
    query = auth_query()
    assert re.search(rf"FROM\s+{re.escape(FUNCTION)}\s*\(", query, re.I), (
        "auth.py no longer selects FROM the function; if it now calls it as a scalar, "
        "this test should be rewritten to check that instead"
    )
    body = function_body()
    assert re.search(r"RETURNS\s+(TABLE|@\w+\s+TABLE)\b", body, re.I), (
        f"auth.py selects FROM {FUNCTION}, so it must be a table-valued function. "
        f"It is declared: " + (re.search(r"RETURNS\s+[^\n]+", body, re.I) or ["?"])[0]
    )


def test_every_column_auth_reads_is_one_the_function_produces() -> None:
    """`r.role_source` was read for months and never existed."""
    query = auth_query()
    alias = re.search(rf"FROM\s+{re.escape(FUNCTION)}\s*\([^)]*\)\s+AS\s+(\w+)", query, re.I)
    assert alias, "could not find the alias auth.py gives the function"
    wanted = set(re.findall(rf"\b{alias.group(1)}\.(\w+)", query))
    assert wanted, "auth.py reads no columns from the function at all"

    body = function_body()
    outer = re.search(r"\bRETURN\b\s*\(?\s*SELECT\s+(?:TOP\s*\(?\d+\)?\s+)?(.+?)\s+FROM\b",
                      body, re.S | re.I)
    assert outer, f"could not read the output columns of {FUNCTION}"
    produced = {part.strip().split(".")[-1].strip().strip("[]")
                for part in outer.group(1).split(",")}

    missing = sorted(wanted - produced)
    assert not missing, (
        f"auth.py reads {missing} from {FUNCTION}, which returns {sorted(produced)}"
    )


def test_the_group_list_is_joined_the_way_the_function_splits_it() -> None:
    """A separator mismatch denies everybody in more than one group, and nobody
    else — which is the shape of bug that reaches production looking like a
    permissions question."""
    text = AUTH_PY.read_text(encoding="utf-8")
    joined = re.search(r'"((?:\\.|[^"\\])*)"\s*\.join\(\s*str\(g\)\s+for\s+g\s+in\s+groups\s*\)',
                       text)
    assert joined, "could not find where auth.py joins the group claim"
    separator = joined.group(1).encode().decode("unicode_escape")

    body = function_body()
    delimiters = set(re.findall(r"CHAR\((\d+)\)", body))
    assert delimiters, f"{FUNCTION} no longer delimits the group list with CHAR(n)"
    assert delimiters == {"10"}, (
        f"{FUNCTION} delimits on CHAR({', '.join(sorted(delimiters))}); this test and "
        f"auth.py both assume one delimiter"
    )
    assert separator == "\n", (
        f"{FUNCTION} splits the group list on CHAR(10) but auth.py joins it with "
        f"{separator!r}. Anyone in two or more groups would resolve to no role."
    )
