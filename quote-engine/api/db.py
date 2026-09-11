"""
Database access.

One connection string, read through the ODBC driver, using the AD service
account's own credentials via Windows integrated auth — there is no password in
this file and there must never be one.

The service touches two databases:

  AximQuote        read and write. Rules, policy, quotes.
  PlanningSuite  read only. Promise ladders and open order lines.

It touches Orbit through neither. Every Orbit object is a synonym in the
``mac`` schema of AximQuote (see sql/01_foundation.sql), so the grant the
service needs is on AximQuote, not on company database [100]. That is the same
invariant Planning Analytics holds, for the same reason: nothing this tool does
can write to Orbit, however wrong the code gets.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

try:
    import pyodbc
except ImportError:  # tests and the engine do not need a driver
    pyodbc = None  # type: ignore[assignment]

SQL_SERVER = os.environ.get("CPQ_SQL_SERVER", "sql.axim.example")
CPQ_DB = os.environ.get("CPQ_DB", "AximQuote")
ODBC_DRIVER = os.environ.get("CPQ_ODBC_DRIVER", "ODBC Driver 18 for SQL Server")

#: Set CPQ_DEMO=1 to run the API with no database at all. Every repo function
#: then raises rather than returning made-up rows — the web preview build is
#: where you look at the tool without a backend, and having two places that
#: invent data is how invented data reaches a customer.
DEMO = os.environ.get("CPQ_DEMO") == "1"


def connection_string() -> str:
    return (
        f"DRIVER={{{ODBC_DRIVER}}};"
        f"SERVER={SQL_SERVER};"
        f"DATABASE={CPQ_DB};"
        "Trusted_Connection=yes;"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
    )


@contextmanager
def cursor() -> Iterator[Any]:
    if DEMO or pyodbc is None:
        raise RuntimeError(
            "No database connection. Set CPQ_SQL_SERVER and install the ODBC driver, "
            "or use the web preview build (npm run build:preview) to look at the UI."
        )
    conn = pyodbc.connect(connection_string(), autocommit=False)
    try:
        yield conn.cursor()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def rows(sql: str, params: Sequence[Any] = ()) -> list[dict]:
    """Every read goes through here so results are plain dicts, which is what
    the engine and the Pydantic models both expect."""
    with cursor() as cur:
        cur.execute(sql, *params) if params else cur.execute(sql)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def row(sql: str, params: Sequence[Any] = ()) -> dict | None:
    found = rows(sql, params)
    return found[0] if found else None


def execute(sql: str, params: Sequence[Any] = ()) -> None:
    with cursor() as cur:
        cur.execute(sql, *params) if params else cur.execute(sql)


def scalar(sql: str, params: Sequence[Any] = ()) -> Any:
    with cursor() as cur:
        cur.execute(sql, *params) if params else cur.execute(sql)
        got = cur.fetchone()
        return got[0] if got else None
