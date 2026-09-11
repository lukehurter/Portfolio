"""
Axim CPQ — the service.

Routes only. The rules live in engine.py, the SQL in repo.py, the access
decisions in auth.py and sql/02_security.sql. This file's job is to say which
of those a request reaches, and to make sure a request cannot reach around them.

    uvicorn main:app --host 127.0.0.1 --port 8080

In production it runs as a Windows service under NSSM behind a reverse proxy
Identity is a Microsoft 365 token, validated in auth.py. See
README.md.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import re
import time
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

import auth
import engine
import repo
import validation
from document_defaults import DEFAULT_DOCUMENT
from auth import Caller
from models import (
    ApprovalDecision, BookFitRequest, ConfiguredItem, ItemClassification, LostReason,
    ProductLineMapping, QuoteDraft, Rule, SentOutside, SuggestRequest, TechnologyName,
    VocabularyName,
)

app = FastAPI(
    title="Axim CPQ",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

#: Everything this service says about itself.
#:
#: uvicorn configures the root logger, so this inherits whatever the service is
#: started with and needs no configuration of its own. What matters is that there IS
#: one: a quote is a commercial document, and "the tool lost my quote" deserves an
#: answer better than a shrug.
log = logging.getLogger("cpq")


@app.middleware("http")
async def record_the_request(request: Request, call_next):
    """One line per request, and the caller on every one of them.

    Deliberately not the body. A quote draft carries a customer name and a line
    description, and a log that holds those is a second copy of commercial data in a
    place nobody is guarding.
    """
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("%s %s failed", request.method, request.url.path)
        raise
    ms = (time.perf_counter() - started) * 1000
    # A slow request is the one worth finding later, so the duration is on every line
    # rather than only on the ones that failed.
    log.info("%s %s -> %s in %.0f ms", request.method, request.url.path,
             response.status_code, ms)
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    """A 500 that says nothing, and a log that says everything.

    FastAPI's default already withholds the traceback from the response. What it
    does not do is record that the request happened, so a rep reporting "it did not
    save" left nothing behind to look at.
    """
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "The service could not complete that. It has been logged."},
    )


#: The biggest file a rep may attach as proof of what they sent.
#:
#: It is a quote document — a Word file or a PDF — and it arrives as a data URL
#: inside a JSON body, so it costs about a third more than its size on disk. Ten
#: megabytes is a generous quote and a cheap ceiling; without one, a rep dragging in
#: the wrong file takes the request timeout with them.
MAX_SENT_FILE_BYTES = 10 * 1024 * 1024


def _decode_data_url(data_url: str) -> bytes:
    """The bytes out of a browser data URL, or a 400 that says which part was wrong."""
    head, _, payload = data_url.partition(",")
    if not payload or "base64" not in head:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "The attached file is not a base64 data URL.")
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "The attached file is not valid base64.")


def today() -> str:
    return date.today().isoformat()


# ------------------------------------------------------------------- session


@app.get("/api/session")
def get_session(caller: Caller = Depends(auth.current_user)) -> dict:
    # approver_username is the function's column; cpq.quote_approval.approver_user
    # is a different thing. Selecting the table's name from the function reads
    # plausibly and fails at execution.
    approver = repo.db.row(
        """SELECT a.approver_username, a.resolved_by, u.display_name
             FROM cpq.fn_approver_for(?, NULL) AS a
             LEFT JOIN cpq.app_user AS u ON u.username = a.approver_username""",
        (caller.username,),
    ) if caller.role == "rep" else None

    return {
        "username": caller.username,
        "displayName": caller.display_name or caller.username,
        "role": caller.role,
        "roleSource": caller.role_source,
        "approver": {
            "username": approver["approver_username"],
            "displayName": approver.get("display_name") or approver["approver_username"],
            "resolvedBy": approver["resolved_by"],
        } if approver and approver.get("approver_username") else None,
    }


@app.get("/api/technologies")
def technologies(caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.technologies()


@app.get("/api/discount-categories")
def discount_categories(caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.discount_categories()


@app.get("/api/items")
def items(q: str | None = None, technology: str | None = None, role: str | None = None,
          limit: int = 25, caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.search_items(technology=technology, role=role, q=q, limit=min(limit, 200))


@app.get("/api/product-lines")
def product_lines(caller: Caller = Depends(auth.current_user)) -> list[dict]:
    auth.require_admin(caller)
    return repo.product_lines()


@app.put("/api/product-lines")
def save_product_lines(rows: list[ProductLineMapping],
                       caller: Caller = Depends(auth.current_user)) -> list[dict]:
    auth.require_admin(caller)
    repo.save_product_lines([r.model_dump() for r in rows], caller.username)
    repo.log_access(caller.username, "saveProductLines",
                    ",".join(r.productLine for r in rows)[:400])
    return repo.product_lines()


@app.get("/api/classification/items")
def items_to_classify(
    why: str | None = None,
    technology: str | None = None,
    q: str | None = None,
    limit: int = 40,
    caller: Caller = Depends(auth.current_user),
) -> dict:
    auth.require_admin(caller)
    return repo.items_to_classify(why=why, technology=technology, q=q,
                                  limit=min(limit, 500))


@app.put("/api/classification/items")
def classify_items(rows: list[ItemClassification],
                   caller: Caller = Depends(auth.current_user)) -> dict:
    auth.require_admin(caller)
    saved = repo.classify_items([r.model_dump() for r in rows], caller.username)
    repo.log_access(caller.username, "classifyItems",
                    ",".join(r.itemNo for r in rows)[:400])
    return {"saved": saved}


# --------------------------------------------------------------------- rules


@app.get("/api/rules")
def list_rules(technology: str | None = None, type: str | None = None, q: str | None = None,
               includeInactive: bool = False,
               caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.list_rules(technology, type, q, includeInactive)


@app.get("/api/rules/{rule_code}")
def get_rule(rule_code: str, caller: Caller = Depends(auth.current_user)) -> dict:
    found = repo.get_rule(rule_code)
    if not found:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No rule {rule_code}")
    return found


@app.post("/api/rules/validate")
def validate(rule: Rule, caller: Caller = Depends(auth.current_user)) -> dict:
    return validation.validate_rule(rule.model_dump())


@app.put("/api/rules/{rule_code}")
def save_rule(rule_code: str, rule: Rule, caller: Caller = Depends(auth.current_user)) -> dict:
    auth.require_admin(caller)
    if rule.ruleCode != rule_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rule code in the body and the URL differ.")

    result = validation.validate_rule(rule.model_dump())
    if not result["ok"]:
        # 422 with the issues, so the admin screen shows the same messages it
        # showed while typing rather than a generic failure.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, result["issues"])

    repo.save_rule(rule.model_dump(), caller.username)
    repo.log_access(caller.username, "saveRule", rule_code)
    return repo.get_rule(rule_code)


@app.get("/api/rules/{rule_code}/audit")
def rule_audit(rule_code: str, caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.rule_audit(rule_code)


# -------------------------------------------------------------------- quotes


def _evaluate(draft: dict) -> dict:
    """Load exactly what the engine needs and run it.

    Prices come from Orbit at this moment, not from anything the tool stored,
    which is what makes a launch or a discontinuance a Orbit change with no
    code and no rule edit behind it.
    """
    item_nos = sorted({l["itemNo"] for l in draft.get("lines", [])})
    return engine.evaluate(
        draft,
        repo.items_for(item_nos),
        repo.active_rules_for(draft["technologyCode"]),
        repo.discount_categories(),
        today(),
    )


@app.post("/api/quotes/evaluate")
def evaluate_draft(draft: QuoteDraft, caller: Caller = Depends(auth.current_user)) -> dict:
    """Price a draft without saving it. This is what the builder calls on every
    change, so the rep watches the server's numbers rather than the browser's."""
    return _evaluate(draft.model_dump())


@app.post("/api/quotes/suggest")
def suggest(req: SuggestRequest, caller: Caller = Depends(auth.current_user)) -> dict:
    candidates = repo.search_items(technology=req.technologyCode, role="printer", limit=5000)
    # Popularity from sales history, documentation from the media map. Both are
    # facts about the item rather than about this quote, so they are gathered once
    # and handed to the engine rather than re-derived per candidate.
    orders = repo.order_counts(req.technologyCode)
    rank = {i["itemNo"]: {"orders": orders.get(i["itemNo"], 0),
                          "documented": bool(i.get("imageFile"))}
            for i in candidates}

    graded = engine.suggest(
        req.model_dump(), candidates, repo.active_rules_for(req.technologyCode),
        today(), attributes=req.attributes, q=req.q, rank=rank,
    )

    # Which attributes are worth offering as filters differs by technology — a
    # laser has no ink. One that has a single value narrows nothing, so it is
    # not shown as a control that does nothing.
    facets: dict[str, list[str]] = {}
    for i in candidates:
        for k, v in (i.get("attributes") or {}).items():
            if v and v not in facets.setdefault(k, []):
                facets[k].append(v)
    facets = {k: sorted(v) for k, v in facets.items() if 2 <= len(v) <= 60}

    return {"items": graded[:req.limit], "total": len(graded), "facets": facets}


@app.post("/api/technologies/fit")
def technology_fit(req: BookFitRequest,
                   caller: Caller = Depends(auth.current_user)) -> list[dict]:
    """Which price book suits this application.

    POST rather than GET because the profile is a dozen fields, one of them a
    free-text substrate description: a query string would truncate it and put a
    customer's line description into a server log.

    Every book is graded, including the ones that come back with nothing. A rep
    asking for 2,000 fpm needs to see that CIJ, TTO and print-and-apply are all
    ruled out, because that is the finding — hiding them would leave a laser
    sitting alone with no explanation of why it is the only option.

    Machines only. A book's consumables and brackets say nothing about whether the
    technology suits the line.
    """
    out: list[dict] = []
    for t in repo.technologies():
        code = t["code"]
        candidates = repo.search_items(technology=code, role="printer", limit=5000)
        graded = engine.suggest(
            {"technologyCode": code,
             "profile": req.profile.model_dump(),
             "noConstraint": req.noConstraint},
            candidates, repo.active_rules_for(code), today(),
        )
        n = lambda g: sum(1 for f in graded if f["grade"] == g)  # noqa: E731
        not_recommended = n("notRecommended")
        out.append({
            "technologyCode": code,
            "strong": n("good"),
            "caveat": n("caveat"),
            "notAssessed": n("notAssessed"),
            "notRecommended": not_recommended,
            "allRuledOut": bool(graded) and not_recommended == len(graded),
        })
    return out


@app.get("/api/quotes")
def list_quotes(
    # aliased because `status` is taken by fastapi.status in this module, and
    # the client sends ?status=
    quote_status: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    caller: Caller = Depends(auth.current_user),
) -> list[dict]:
    return repo.visible_quotes(caller.username, caller.role, quote_status, q)


@app.get("/api/analytics")
def analytics(caller: Caller = Depends(auth.current_user)) -> dict:
    """What the analytics page draws, aggregated in SQL and scoped to the caller.

    The scoping is the whole security question on this route. Every other read hands
    back one quote and `cpq.fn_visible_quotes` is enforced per row; an aggregate can
    leak the same information as a single number with nothing to notice, so the
    function is applied before anything is counted rather than after.
    """
    return repo.analytics(caller.username, caller.role)


@app.get("/api/quotes/{quote_no}")
def get_quote(quote_no: str, caller: Caller = Depends(auth.current_user)) -> dict:
    found = repo.get_quote(quote_no, caller.username, caller.role)
    if not found:
        # 404 rather than 403 on purpose: a rep should not be able to discover
        # that a quote exists by probing quote numbers.
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")
    found.pop("quoteId", None)
    return found


def _require_technology(draft: dict) -> None:
    """A quote without a price book cannot be priced or classified.

    The builder now leaves it unresolved until the application answers it, so an
    empty value reaches the API on any path that skipped that. cpq.quote.
    technology_cd is NOT NULL with a foreign key, so the alternative to this check
    is a constraint violation the rep cannot read.
    """
    if not (draft.get("technologyCode") or "").strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This quote has no price book yet. The application usually decides it, "
            "or it can be chosen on the machine step.")


@app.post("/api/quotes", status_code=status.HTTP_201_CREATED)
def create_quote(draft: QuoteDraft, caller: Caller = Depends(auth.current_user)) -> dict:
    d = draft.model_dump()
    _require_technology(d)
    quote_no = repo.next_quote_no()
    quote_id = repo.create_quote(quote_no, d, caller.username, caller.display_name)
    repo.write_evaluation(quote_id, d, _evaluate(d))
    repo.log_access(caller.username, "createQuote", quote_no)
    return get_quote(quote_no, caller)


@app.put("/api/quotes/{quote_no}")
def save_quote(quote_no: str, draft: QuoteDraft,
               caller: Caller = Depends(auth.current_user)) -> dict:
    existing = repo.get_quote(quote_no, caller.username, caller.role)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")
    if existing["status"] in ("sent", "won", "lost"):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"This quote is {existing['status']} and can no longer be edited.")
    if caller.role == "rep" and existing["repUsername"] != caller.username:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This quote belongs to another rep.")

    d = draft.model_dump()
    _require_technology(d)
    repo.write_evaluation(existing["quoteId"], d, _evaluate(d))
    return get_quote(quote_no, caller)


@app.post("/api/quotes/{quote_no}/submit")
def submit_quote(quote_no: str, caller: Caller = Depends(auth.current_user)) -> dict:
    existing = repo.get_quote(quote_no, caller.username, caller.role)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")
    if caller.role == "rep" and existing["repUsername"] != caller.username:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This quote belongs to another rep.")

    # Re-evaluate before accepting. The quote may have been drafted against a
    # rule that has since changed, and it is the numbers being SENT that have to
    # be legal — not the numbers that were legal when the rep started.
    draft = {
        "technologyCode": existing["technologyCode"],
        "customerNo": existing.get("customerNo"),
        "customerName": existing.get("customerName"),
        "lineName": existing.get("lineName"),
        "profile": {k: existing.get(k) for k in repo.PROFILE_COLS},
        "flags": {},
        "categoryDiscounts": {
            "system": existing.get("discount_system"),
            "consumables": existing.get("discount_consumables"),
            "accessories": existing.get("discount_accessories"),
            "customs": existing.get("discount_customs"),
        },
        "lines": [{"itemNo": l["itemNo"], "quantity": l["quantity"]}
                  for l in existing["lines"]],
    }
    draft["categoryDiscounts"] = {k: v for k, v in draft["categoryDiscounts"].items()
                                  if v is not None}

    ev = _evaluate(draft)
    if ev["blocked"]:
        blockers = "; ".join(t["headline"] for t in ev["trace"] if t["status"] == "blocked")
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"This quote is blocked by a rule and cannot be sent. {blockers}")

    repo.write_evaluation(existing["quoteId"], draft, ev)
    raised = repo.raise_approvals(existing["quoteId"], ev["requiredApprovals"], caller.username)
    repo.set_quote_status(existing["quoteId"], "pendingApproval" if raised else "sent")
    repo.log_access(caller.username, "submitQuote", quote_no)
    return get_quote(quote_no, caller)


@app.post("/api/quotes/{quote_no}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_quote(quote_no: str, caller: Caller = Depends(auth.current_user)) -> dict:
    """A new quote built from an existing one, never an edit of the original.

    Opening the original is what the button used to do, which meant a rep editing
    last quarter's record rather than starting from it.
    """
    existing = repo.get_quote(quote_no, caller.username, caller.role)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")

    draft = {
        "technologyCode": existing["technologyCode"],
        "customerNo": existing.get("customerNo"),
        "customerName": existing.get("customerName"),
        "lineName": existing.get("lineName"),
        "profile": {k: existing.get(k) for k in repo.PROFILE_COLS},
        "flags": {},
        "categoryDiscounts": {k: v for k, v in {
            "system": existing.get("discount_system"),
            "consumables": existing.get("discount_consumables"),
            "accessories": existing.get("discount_accessories"),
            "customs": existing.get("discount_customs"),
        }.items() if v is not None},
        "lines": [{"itemNo": l["itemNo"], "quantity": l["quantity"]}
                  for l in existing["lines"]],
    }

    quote_no_new = repo.next_quote_no()
    quote_id = repo.create_quote(quote_no_new, draft, caller.username, caller.display_name)
    # The copy carries the intent and none of the history: no approvals, no
    # trace, status back to draft.
    repo.write_evaluation(quote_id, draft, _evaluate(draft))
    repo.log_access(caller.username, "duplicateQuote", f"{quote_no} -> {quote_no_new}")
    return get_quote(quote_no_new, caller)


@app.delete("/api/quotes/{quote_no}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(quote_no: str, caller: Caller = Depends(auth.current_user)) -> None:
    """Only a draft. A sent quote is a record of what a customer was told, so it
    is cancelled rather than removed — deleting it would destroy the trace that
    makes the price defensible."""
    existing = repo.get_quote(quote_no, caller.username, caller.role)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")
    if caller.role == "rep" and existing["repUsername"] != caller.username:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This quote belongs to another rep.")
    if existing["status"] != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This quote is {existing['status']}. Only a draft can be deleted — a sent "
            f"quote is a record of what the customer was told.")

    repo.delete_quote(existing["quoteId"])
    repo.log_access(caller.username, "deleteQuote", quote_no)


@app.post("/api/quotes/{quote_no}/approvals/{approval_id}")
def decide(quote_no: str, approval_id: int, decision: ApprovalDecision,
           caller: Caller = Depends(auth.current_user)) -> dict:
    auth.require_approver(caller)
    existing = repo.get_quote(quote_no, caller.username, caller.role)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")

    repo.decide_approval(existing["quoteId"], approval_id,
                         decision.decision, decision.note, caller.username)
    repo.log_access(caller.username, f"approval:{decision.decision}", f"{quote_no}/{approval_id}")

    refreshed = repo.get_quote(quote_no, caller.username, caller.role)
    still_pending = any(a["status"] == "pending" for a in refreshed["approvals"])
    if not still_pending:
        declined = any(a["status"] == "declined" for a in refreshed["approvals"])
        repo.set_quote_status(refreshed["quoteId"], "draft" if declined else "sent")
    return get_quote(quote_no, caller)


# ------------------------------- promise dates and open orders (Planning Analytics)


@app.get("/api/items/{item_no}/promise")
def item_promise(item_no: str, qty: float = 1,
                 caller: Caller = Depends(auth.current_user)) -> dict:
    found = repo.item_promise(item_no, qty)
    if not found:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            f"No promise data for {item_no}. The overnight build may not "
                            f"cover this item.")
    return found


@app.get("/api/customers")
def customers(q: str = "", caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.search_customers(q, caller.username, caller.role)


@app.get("/api/customers/{customer_no}/open-orders")
def open_orders(customer_no: str, caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.open_orders(customer_no)


@app.get("/api/health")
def health() -> dict:
    """Unauthenticated on purpose — the load balancer has no AD identity.

    It reports reachability and NOTHING else. It used to return str(exc) from the
    failed connection, and pyodbc puts the whole connection string in that message:
    server, database, driver, sometimes the account. That is the internal topology of
    the estate, handed to anything that can reach the port. The detail goes to the
    log, where the people entitled to it already are.
    """
    try:
        repo.db.scalar("SELECT 1")
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001 — reachability is a yes or a no
        log.error("health check failed: %s", exc, exc_info=True)
        return {"ok": False}

# ------------------------------------------------------- the Classify vocabulary
#
# What a part can be sorted by. All three levels are editable here because the
# taxonomy the tool sorts parts by belongs to the business, not to a deployment —
# and all three refuse to drop a value that still has parts under it.


@app.get("/api/items/roles")
def list_item_roles(caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.item_roles()


@app.post("/api/items/roles", status_code=status.HTTP_204_NO_CONTENT)
def add_item_role(body: VocabularyName,
                  caller: Caller = Depends(auth.current_user)) -> None:
    auth.require_admin(caller)
    name = body.name.strip().lower()
    if not re.fullmatch(r"[a-z][a-z ]{2,19}", name):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "A type is a lower-case word, like printhead or consumable.")
    repo.add_item_role(name, caller.username)
    repo.log_access(caller.username, "itemRole.add", name)


@app.delete("/api/items/roles/{name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item_role(name: str, caller: Caller = Depends(auth.current_user)) -> None:
    auth.require_admin(caller)
    use = repo.item_role_usage(name)
    if use["builtin"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{name} is one of the types the engine ships knowing, so it cannot go.")
    if use["items"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{use['items']} part{'' if use['items'] == 1 else 's'} "
            f"{'is' if use['items'] == 1 else 'are'} typed as {name}. Retype them "
            f"first — a type cannot be removed from under a part.")
    if use["rules"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{use['rules']} rule{'' if use['rules'] == 1 else 's'} read the type "
            f"{name}. Change them first.")
    repo.remove_item_role(name)
    repo.log_access(caller.username, "itemRole.remove", name)


@app.get("/api/items/categories")
def list_categories(technology: str | None = None,
                    caller: Caller = Depends(auth.current_user)) -> list[dict]:
    return repo.item_categories(technology)


@app.post("/api/items/categories", status_code=status.HTTP_204_NO_CONTENT)
def add_category(body: VocabularyName,
                 caller: Caller = Depends(auth.current_user)) -> None:
    auth.require_admin(caller)
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A category needs a name.")
    # A category may not repeat a type. The two levels exist to say different
    # things, and "Inks" under the type `ink` is one fact filed twice.
    as_role = name.lower().rstrip("s")
    if any(r["name"] in (as_role, name.lower()) for r in repo.item_roles()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{name} is already a type, so it would be the same fact twice. A "
            f"category says what a type cannot — Stands, Conveyor, Tamp Pad.")
    repo.add_category(name, caller.username)
    repo.log_access(caller.username, "category.add", name)


@app.delete("/api/items/categories/{name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_category(name: str, caller: Caller = Depends(auth.current_user)) -> None:
    auth.require_admin(caller)
    n = repo.category_usage(name)
    if n:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{n} part{'' if n == 1 else 's'} {'is' if n == 1 else 'are'} filed under "
            f"{name}. Move them first — a category cannot be removed from under a part.")
    repo.remove_category(name)
    repo.log_access(caller.username, "category.remove", name)


@app.post("/api/technologies", status_code=status.HTTP_204_NO_CONTENT)
def add_technology(body: TechnologyName,
                   caller: Caller = Depends(auth.current_user)) -> None:
    auth.require_admin(caller)
    code = body.code.strip().upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9]{1,7}", code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "A price book code is 2 to 8 capitals, like CIJ or PALM.")
    if code == "ALL":
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "ALL is the marker every book shares and is reserved.")
    repo.add_technology(code, body.name.strip() or code, caller.username)


@app.delete("/api/technologies/{code}", status_code=status.HTTP_204_NO_CONTENT)
def remove_technology(code: str, caller: Caller = Depends(auth.current_user)) -> None:
    auth.require_admin(caller)
    if code.upper() == "ALL":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ALL is reserved.")
    use = repo.technology_usage(code)
    if use["items"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{use['items']} parts are in {code}. Move them first — a price book "
            f"cannot be removed from under a part.")
    if use["rules"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{use['rules']} rules belong to {code}. Retire them first.")
    # Quotes do not block it. The book stops being offered and every quote that
    # used it still reads, which is why this deactivates rather than deletes.
    repo.remove_technology(code, caller.username)


@app.get("/api/rules/requirements")
def rule_requirements(technology: str = Query(..., min_length=1, max_length=10),
                      caller: Caller = Depends(auth.current_user)) -> list[dict]:
    """What a complete quote in this book needs, read off the live rules.

    A structure rule that says "a printer is on the quote and nothing of kind X is"
    names X in its own trigger. That IS the requirement, so reading it here means a
    rule written next year produces a band without anybody adding one — and, unlike
    the constant the web app used to compile in, it is the rule set as it stands now
    rather than as it stood at the last deploy.
    """
    out: list[dict] = []
    for rule in repo.active_rules_for(technology):
        triggers = rule.get("triggers") or []
        wants_machine = any(
            t.get("triggerType") == "role" and t.get("itemRole") == "printer"
            and t.get("compareOp") != "ne"
            for t in triggers)
        missing = next(
            (t for t in triggers
             if t.get("triggerType") == "role" and t.get("compareOp") == "ne"
             and t.get("itemRole")),
            None)
        if not wants_machine or missing is None:
            continue
        actions = rule.get("actions") or []
        out.append({
            "role": missing["itemRole"],
            "ruleCode": rule["ruleCode"],
            "summary": (actions[0].get("message") if actions else None) or rule["summary"],
            "sourceRef": rule.get("sourceRef"),
            "author": rule.get("author"),
        })
    return out


# ------------------------------------------------------------ configured items


@app.post("/api/items/configured", status_code=status.HTTP_201_CREATED)
def add_configured_item(spec: ConfiguredItem,
                        caller: Caller = Depends(auth.current_user)) -> dict:
    """A part number composed rather than looked up.

    A Corvus laser has none until it is configured, and neither does a 7300-series
    CIJ. It lands in this service's own table; Orbit learns about it when somebody
    orders one, through the order.
    """
    return repo.add_configured_item(spec.model_dump(), caller.username)


# ------------------------------------------------------------ document defaults


@app.get("/api/document-defaults")
def get_document_defaults(caller: Caller = Depends(auth.current_user)) -> dict:
    stored = repo.document_defaults(caller.username)
    if not stored:
        # The shipped defaults, not an empty document. A blank quote template is not
        # a preference, it is a bug that looks like one.
        return DEFAULT_DOCUMENT
    try:
        return json.loads(stored)
    except ValueError:
        return DEFAULT_DOCUMENT


@app.put("/api/document-defaults")
def save_document_defaults(settings: dict,
                           caller: Caller = Depends(auth.current_user)) -> dict:
    merged = {**DEFAULT_DOCUMENT, **settings}
    repo.save_document_defaults(caller.username, json.dumps(merged))
    repo.log_access(caller.username, "documentDefaults.save", None)
    return merged


# ------------------------------------------------------------------ rule codes


@app.get("/api/rules/next-code")
def next_rule_code(prefix: str = Query(..., min_length=1, max_length=20),
                   caller: Caller = Depends(auth.current_user)) -> str:
    auth.require_admin(caller)
    return repo.next_rule_code(prefix)


# ---------------------------------------------------- how a quote ended, and how it went


@app.post("/api/quotes/{quote_no}/sent-outside")
def mark_sent_outside(quote_no: str, details: SentOutside,
                      caller: Caller = Depends(auth.current_user)) -> dict:
    """The rep sent it from Outlook, and the quote still has to be marked sent.

    Recorded as its own fact rather than as an ordinary send, because the day
    somebody asks which quote the customer actually received, "we do not know"
    is the wrong answer.
    """
    quote = repo.get_quote(quote_no, caller.username, caller.role)
    if quote is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")
    repo.mark_sent_outside(quote["quoteId"], details.model_dump(), caller.username)
    if details.file is not None:
        data = _decode_data_url(details.file.dataUrl)
        if len(data) > MAX_SENT_FILE_BYTES:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"That file is {len(data) // 1024} KB and the limit is "
                f"{MAX_SENT_FILE_BYTES // 1024} KB.")
        repo.save_sent_file(quote["quoteId"], details.file.name,
                            details.file.type, data)
    return repo.get_quote(quote_no, caller.username, caller.role)


@app.post("/api/quotes/{quote_no}/lost")
def mark_quote_lost(quote_no: str, body: LostReason,
                    caller: Caller = Depends(auth.current_user)) -> dict:
    quote = repo.get_quote(quote_no, caller.username, caller.role)
    if quote is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")
    repo.mark_lost(quote["quoteId"], body.reason, caller.username)
    return repo.get_quote(quote_no, caller.username, caller.role)


@app.post("/api/quotes/{quote_no}/reopen")
def reopen_quote(quote_no: str, caller: Caller = Depends(auth.current_user)) -> dict:
    quote = repo.get_quote(quote_no, caller.username, caller.role)
    if quote is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No quote {quote_no}")
    repo.reopen_quote(quote["quoteId"], caller.username)
    return repo.get_quote(quote_no, caller.username, caller.role)

