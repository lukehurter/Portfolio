"""Every endpoint the web app calls, the service serves.

The app and the service are written in different languages by different halves of
the build, and the only thing that made them agree was somebody remembering. It
stopped working: ten endpoints were added to the client and to the in-memory preview
API — the Classify vocabulary, document defaults, configured items, next rule code,
and the three quote states — and never to the service. They worked perfectly in the
preview and would have been 404s in production, against buttons the UI offers.

That is the worst shape a gap can take. Nothing fails at build time, nothing fails in
review, and the first person to find out is a rep whose quote will not save.

So the client is read for the paths it calls and the service for the paths it serves,
and they are compared. Adding a method to CpqApi's HTTP implementation without a route
fails here.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
HTTP_TS = ROOT / "web" / "src" / "api" / "http.ts"

os.environ.setdefault("CPQ_DEMO", "1")
sys.path.insert(0, str(ROOT / "api"))


def normalise(path: str) -> tuple[str, ...]:
    """A path as its segments, with every parameter reduced to one placeholder.

    `/quotes/${encodeURIComponent(no)}/lost` and `/quotes/{quote_no}/lost` are the
    same endpoint written by two people in two languages.
    """
    # `${qs(params)}` builds a QUERY STRING, not a path segment. Substituting a
    # placeholder for it turned /items into /items/{} and made four real endpoints
    # look unserved.
    path = re.sub(r"\$\{qs\([^)]*\)\}", "", path)
    path = re.sub(r"\$\{[^}]*\}", "{}", path)      # `${...}` in a template literal
    path = re.sub(r"\{[^}]*\}", "{}", path)        # {quote_no} in a FastAPI route
    path = path.split("?")[0]                       # a query string is not a path
    path = re.sub(r"^/api", "", path)
    return tuple(p for p in path.strip("/").split("/") if p)


def client_paths() -> dict[tuple[str, ...], str]:
    """What http.ts asks for, with the verb where it states one."""
    text = HTTP_TS.read_text(encoding="utf-8")
    found: dict[tuple[str, ...], str] = {}
    for m in re.finditer(
        r"""req(?:Void|Blob)?\s*(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"]+)[`'"]"""
        r"""(?:\s*,\s*\{[^}]*?method:\s*'(\w+)')?""",
        text, re.S,
    ):
        key = normalise(m.group(1))
        if key:
            found[key] = (m.group(2) or "GET").upper()
    return found


def server_paths() -> set[tuple[str, ...]]:
    import main  # imported here so a collection error names this test

    return {
        normalise(route.path)
        for route in main.app.routes
        if getattr(route, "path", "").startswith("/api")
    }


def test_the_client_asks_for_nothing_the_service_cannot_serve() -> None:
    client = client_paths()
    assert len(client) > 25, "http.ts parsed to almost nothing — has it been rewritten?"
    server = server_paths()
    missing = sorted("/" + "/".join(p) for p in client if p not in server)
    assert not missing, (
        "the web app calls these and the service has no route for them:\n  "
        + "\n  ".join(missing))


def test_every_route_is_reachable_from_the_client() -> None:
    """The other direction, which is a smaller problem and still worth knowing.

    A route nothing calls is either dead or a documented integration point. The
    exceptions are named so that the list shrinks rather than rots.
    """
    reachable_elsewhere = {
        ("health",),   # the load balancer, not the app
        ("docs",),     # FastAPI's own
        ("openapi.json",),
    }
    client = set(client_paths())
    unused = sorted(
        "/" + "/".join(p)
        for p in server_paths()
        if p not in client and p not in reachable_elsewhere
    )
    assert not unused, (
        "the service serves these and nothing calls them:\n  " + "\n  ".join(unused))


@pytest.mark.parametrize("name", ["item_roles", "item_categories", "add_technology",
                                  "add_configured_item", "document_defaults",
                                  "next_rule_code", "mark_sent_outside", "mark_lost",
                                  "reopen_quote"])
def test_the_repository_has_the_function_behind_each_new_route(name: str) -> None:
    """A route that calls a repo function nobody wrote is a 500, not a 404.

    Worth its own check because the import succeeds either way: the attribute is
    only looked up when a rep presses the button.
    """
    import repo

    assert hasattr(repo, name), f"repo.{name} is missing, and a route calls it"
