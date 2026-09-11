"""
Reads and writes, kept apart from the routes.

Everything the engine needs — items, rules, discount categories — is loaded
here and handed over as plain dicts. Prices are read from Orbit through the
``mac`` synonyms at the moment a quote is evaluated and are never stored except
as a snapshot on a saved quote line, which is a record of what the rep saw
rather than a second source of truth.

NOTHING HERE HAS BEEN RUN AGAINST A DATABASE. IT does not allow development tooling on the production network,
so every statement is written from Planning Analytics'
Orbit_SQL_Master_Dictionary.md and the schema in ../sql. Treat the first run as
a test, on a restored copy.
"""

from __future__ import annotations

import json
from typing import Any

import db

# --------------------------------------------------------------------- catalog


def technologies() -> list[dict]:
    return db.rows(
        """
        SELECT t.technology_cd AS code, t.technology_name AS name,
               (SELECT COUNT(*) FROM cpq.rule r
                 WHERE r.technology_cd = t.technology_cd AND r.is_active = 1) AS ruleCount,
               (SELECT COUNT(*) FROM cpq.v_quotable_item i
                 WHERE i.technology_cd = t.technology_cd) AS itemCount,
               -- Machines, not parts. The chooser says both, because a book with
               -- 200 accessories and no printer is not a book you can start a quote
               -- from, and one count cannot say that.
               -- Machines, not part numbers. A Corvus number is a printer already
               -- filled, so counting rows offered "CIJ - 947 machines" over a list
               -- showing nine. Rows sharing the book's identity attribute are one
               -- machine; a row that does not carry it stands alone, which is the
               -- same rule the web app groups by.
               (SELECT COUNT(*) FROM (
                    SELECT DISTINCT COALESCE(a.attr_value, i.item_no) AS machine
                      FROM cpq.v_quotable_item i
                      LEFT JOIN cpq.item_attribute a
                             ON a.item_no = i.item_no
                            AND a.attr_name = t.machine_identity_attr
                     WHERE i.technology_cd = t.technology_cd
                       AND i.item_role = 'printer'
                ) m) AS machineCount
          FROM cpq.technology t
         WHERE t.is_active = 1        -- ALL is a marker, not a book
         ORDER BY t.sort_order, t.technology_cd
        """
    )


def discount_categories() -> list[dict]:
    return db.rows(
        """
        SELECT discount_cat_cd AS code, display_name AS displayName, max_discount AS maxDiscount
          FROM cpq.discount_category
         ORDER BY sort_order, discount_cat_cd
        """
    )


ITEM_SELECT = """
    SELECT i.item_no          AS itemNo,
           i.description      AS description,
           i.prod_cat         AS prodCat,
           i.prod_cat_desc    AS prodCatDesc,
           i.technology_cd    AS technologyCode,
           i.item_role        AS itemRole,
           i.discount_cat_cd  AS discountCatCode,
           i.list_price       AS listPrice,
           i.std_cost         AS stdCost,
           i.uom              AS uom,
           i.is_active        AS isActive
      FROM cpq.v_quotable_item i
"""


def _with_attributes(items: list[dict]) -> list[dict]:
    """Attributes are a child table, so they are fetched once for the whole set
    rather than per item."""
    if not items:
        return items
    keys = [i["itemNo"] for i in items]
    marks = ",".join("?" for _ in keys)
    attrs = db.rows(
        f"SELECT item_no, attr_name, attr_value FROM cpq.item_attribute "
        f"WHERE item_no IN ({marks})",
        keys,
    )
    by_item: dict[str, dict[str, str]] = {}
    for a in attrs:
        by_item.setdefault(a["item_no"], {})[a["attr_name"]] = a["attr_value"]
    for i in items:
        i["attributes"] = by_item.get(i["itemNo"], {})
        i["isActive"] = bool(i["isActive"])
    return items


def search_items(technology: str | None = None, role: str | None = None,
                 q: str | None = None, limit: int = 25) -> list[dict]:
    where, params = ["i.is_active = 1"], []
    if technology:
        where.append("i.technology_cd = ?")
        params.append(technology)
    if role:
        where.append("i.item_role = ?")
        params.append(role)
    if q:
        where.append("(i.item_no LIKE ? OR i.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    sql = (f"{ITEM_SELECT} WHERE {' AND '.join(where)} "
           f"ORDER BY i.item_no OFFSET 0 ROWS FETCH NEXT {int(limit)} ROWS ONLY")
    return _with_attributes(db.rows(sql, params))


def order_counts(technology: str, months: int = 24) -> dict[str, int]:
    """How often each machine in a book has actually been ordered.

    DISTINCT ORDERS, not summed quantity. Quantity answers "how many did we ship",
    which is a different question and a misleading one here: one customer taking a
    thousand of something in a single order would outrank a machine sold to a
    different customer every week for a decade. Popularity, for the purpose of
    recommending, means how many separate times somebody chose it.

    Sales history (oelinhst_sql), not open orders (oeordlin_sql). Planning
    Analytics reads the open lines because it is answering "what is outstanding
    now"; this is answering "what do we actually sell", and a single large
    backorder sitting open would distort the open-line answer completely.

    Returns {} rather than raising when the history tables are not reachable — the
    ranking degrades to fit and documentation, which is the same order a brand-new
    part gets. A recommendation should never fail to appear because a popularity
    signal was unavailable.
    """
    try:
        rows = db.rows(
            """
            SELECT h.item_no,
                   COUNT(DISTINCT h.ord_no) AS orders
              FROM mac.oelinhst_sql AS h
              JOIN cpq.v_item_class AS c ON c.item_no = h.item_no
             WHERE c.technology_cd = ?
               AND c.item_role = 'printer'
               AND h.inv_dt >= DATEADD(month, -?, GETDATE())
             GROUP BY h.item_no
            """,
            technology, months,
        )
    except Exception:                       # noqa: BLE001 - see docstring
        return {}
    return {r["item_no"]: int(r["orders"]) for r in rows}


def items_for(item_nos: list[str]) -> list[dict]:
    """The exact items on a draft, whatever their state. A discontinued part
    already on a quote still has to price, or reopening an old quote fails."""
    if not item_nos:
        return []
    marks = ",".join("?" for _ in item_nos)
    return _with_attributes(db.rows(f"{ITEM_SELECT} WHERE i.item_no IN ({marks})", item_nos))


# ------------------------------------------------------------------- mappings


def product_lines() -> list[dict]:
    """The 43-row taxonomy, with a live part count per line.

    Replaces the prod_cat worksheet entirely. Orbit's category codes never mapped
    onto the seven price books, so nothing reads them any more.
    """
    return db.rows(
        """
        SELECT m.product_line      AS productLine,
               m.product_class     AS productClass,
               m.technology_cd     AS technologyCode,
               m.item_role         AS itemRole,
               m.is_quotable       AS isQuotable,
               m.confidence,
               m.notes,
               (SELECT COUNT(*) FROM cpq.item_hierarchy h
                 WHERE h.product_line = m.product_line) AS itemCount
          FROM cpq.product_line_map AS m
         ORDER BY CASE WHEN m.confidence = 'assumed' THEN 0 ELSE 1 END, itemCount DESC
        """
    )


def save_product_lines(rows: list[dict], username: str) -> None:
    """Editing a row is a decision, so it stops being an assumption.

    The 13 rows seeded as 'assumed' are my reading of a line name, not anybody's
    judgement. Confirming one is the whole point of the screen, so the write
    records who did it.
    """
    with db.cursor() as cur:
        for r in rows:
            cur.execute(
                """UPDATE cpq.product_line_map
                      SET technology_cd = ?, item_role = ?, is_quotable = ?,
                          confidence = 'confirmed', updated_by = ?,
                          updated_at = SYSUTCDATETIME()
                    WHERE product_line = ?""",
                r.get("technologyCode"), r["itemRole"],
                1 if r.get("isQuotable") else 0, username, r["productLine"])


def items_to_classify(why: str | None = None, technology: str | None = None,
                      q: str | None = None, limit: int = 40) -> dict:
    """The gap worklist.

    Two different problems in one list. 'unclassified' is a part no source knows,
    which in production is most of it because the question is asked of the whole
    Orbit item master. 'fallback' is a part classified only by the price-page
    sheet it happened to sit on — a filing decision rather than a statement of
    what the part is.

    Ordered by what has actually moved: an obsolete part nobody has ordered in
    four years is not worth anyone's afternoon.
    """
    where, params = ["1 = 1"], []
    if technology:
        where.append("u.technology_cd = ?")
        params.append(technology)
    if q:
        where.append("(u.item_no LIKE ? OR u.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if why and why != "all":
        where.append("u.why = ?")
        params.append(why)

    clause = " AND ".join(where)
    base = """
        SELECT v.item_no                AS itemNo,
               v.description,
               v.prod_cat               AS prodCat,
               v.list_price             AS listPrice,
               v.hierarchy_line         AS hierarchyLine,
               NULL                     AS technology_cd,
               CAST('unclassified' AS varchar(20)) AS why
          FROM cpq.v_unclassified_item AS v
         UNION ALL
        SELECT c.item_no, i.item_desc_1, i.prod_cat, loc.list_price,
               c.product_line, c.technology_cd,
               CAST('fallback' AS varchar(20))
          FROM cpq.v_item_class AS c
          JOIN mac.imitmidx_sql AS i   ON i.item_no = c.item_no
          LEFT JOIN mac.iminvloc_sql AS loc ON loc.item_no = c.item_no AND loc.loc = 'MAIN'
         WHERE c.class_source = 'pricePage'
    """

    counts = {r["why"]: r["n"] for r in db.rows(
        f"SELECT u.why, COUNT(*) AS n FROM ({base}) AS u GROUP BY u.why")}
    total = db.rows(f"SELECT COUNT(*) AS n FROM ({base}) AS u WHERE {clause}", params)[0]["n"]
    items = db.rows(
        f"""SELECT u.itemNo, u.description, u.prodCat, u.listPrice,
                   u.hierarchyLine, u.technology_cd AS technologyCode,
                   NULL AS itemRole, u.why
              FROM ({base}) AS u
             WHERE {clause}
             ORDER BY u.why, u.itemNo
             OFFSET 0 ROWS FETCH NEXT {int(limit)} ROWS ONLY""",
        params)
    return {"items": items, "total": total, "counts": counts}


def classify_items(rows: list[dict], username: str) -> int:
    """Write overrides. An override always wins: it is the most recent human
    judgement, and the whole reason the gap list exists is that the automated
    sources cannot answer."""
    with db.cursor() as cur:
        for r in rows:
            cur.execute(
                """MERGE cpq.item_class_override AS t
                   USING (SELECT ? AS item_no) AS s ON t.item_no = s.item_no
                   WHEN MATCHED THEN UPDATE SET technology_cd = ?, item_role = ?,
                        model = ?, is_quotable = ?, reason = ?, updated_by = ?,
                        updated_at = SYSUTCDATETIME()
                   WHEN NOT MATCHED THEN INSERT (item_no, technology_cd, item_role,
                        model, is_quotable, reason, updated_by)
                        VALUES (s.item_no, ?, ?, ?, ?, ?, ?);""",
                r["itemNo"],
                r.get("technologyCode"), r["itemRole"], r.get("model"),
                1 if r.get("isQuotable", True) else 0, r.get("reason"), username,
                r.get("technologyCode"), r["itemRole"], r.get("model"),
                1 if r.get("isQuotable", True) else 0, r.get("reason"), username)
    return len(rows)


# ----------------------------------------------------------------------- rules


def _hydrate_rules(headers: list[dict]) -> list[dict]:
    if not headers:
        return []
    ids = [r.pop("rule_id") for r in headers]
    marks = ",".join("?" for _ in ids)

    triggers = db.rows(
        f"""SELECT rule_id, trigger_type AS triggerType, item_no AS itemNo,
                   item_role AS itemRole, prod_cat AS prodCat, attr_name AS attrName,
                   attr_value AS attrValue, profile_field AS profileField,
                   compare_op AS compareOp, compare_value AS compareValue,
                   min_count AS minCount
              FROM cpq.rule_trigger WHERE rule_id IN ({marks})""", ids)
    actions = db.rows(
        f"""SELECT rule_id, action_type AS actionType, item_no AS itemNo,
                   quantity, max_discount AS maxDiscount, fit_grade AS fitGrade,
                   approver_role AS approverRole, allowance_amt AS allowanceAmt,
                   message, remedy, matcher, attribute, deny_roles AS denyRoles
              FROM cpq.rule_action WHERE rule_id IN ({marks})""", ids)
    conditions = db.rows(
        f"""SELECT rule_id, seq, label, condition_kind AS conditionKind,
                   attr_name AS attrName, attr_value AS attrValue,
                   item_no AS itemNo, flag_name AS flagName
              FROM cpq.rule_condition WHERE rule_id IN ({marks}) ORDER BY seq""", ids)

    def group(child: list[dict]) -> dict[int, list[dict]]:
        out: dict[int, list[dict]] = {}
        for c in child:
            out.setdefault(c.pop("rule_id"), []).append(c)
        return out

    t, a, c = group(triggers), group(actions), group(conditions)
    for rule, rid in zip(headers, ids):
        rule["triggers"] = t.get(rid, [])
        rule["actions"] = a.get(rid, [])
        rule["conditions"] = c.get(rid, [])
        rule["isActive"] = bool(rule["isActive"])
    return headers


RULE_SELECT = """
    SELECT r.rule_id, r.rule_code AS ruleCode, r.technology_cd AS technologyCode,
           r.rule_type AS ruleType, r.summary, r.detail,
           r.source_ref AS sourceRef, r.author, r.severity,
           CONVERT(varchar(10), r.effective_from, 23) AS effectiveFrom,
           CONVERT(varchar(10), r.effective_to, 23)   AS effectiveTo,
           r.is_active AS isActive, r.updated_by AS updatedBy,
           CONVERT(varchar(30), r.updated_at, 126) AS updatedAt
      FROM cpq.rule r
"""


def active_rules_for(technology: str) -> list[dict]:
    """What the engine evaluates. Dating is applied in the engine rather than
    here, so the trace can explain a rule that just lapsed."""
    return _hydrate_rules(db.rows(
        f"{RULE_SELECT} WHERE r.is_active = 1 AND (r.technology_cd IS NULL OR r.technology_cd = ?)",
        (technology,),
    ))


def get_rule(rule_code: str) -> dict | None:
    found = _hydrate_rules(db.rows(f"{RULE_SELECT} WHERE r.rule_code = ?", (rule_code,)))
    return found[0] if found else None


def list_rules(technology: str | None, rule_type: str | None,
               q: str | None, include_inactive: bool) -> list[dict]:
    where, params = [], []
    if not include_inactive:
        where.append("r.is_active = 1")
    if technology and technology != "all":
        where.append("(r.technology_cd = ? OR r.technology_cd IS NULL)")
        params.append(technology)
    if rule_type and rule_type != "all":
        where.append("r.rule_type = ?")
        params.append(rule_type)
    if q:
        where.append("(r.rule_code LIKE ? OR r.summary LIKE ? OR r.detail LIKE ? OR r.author LIKE ?)")
        params += [f"%{q}%"] * 4
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    return db.rows(
        f"""
        SELECT r.rule_code AS ruleCode, r.technology_cd AS technologyCode,
               r.rule_type AS ruleType, r.summary, r.author, r.source_ref AS sourceRef,
               r.severity, r.is_active AS isActive,
               CONVERT(varchar(10), r.effective_from, 23) AS effectiveFrom,
               CONVERT(varchar(10), r.effective_to, 23)   AS effectiveTo,
               (SELECT COUNT(*) FROM cpq.quote_rule_trace tr
                 WHERE tr.rule_code = r.rule_code
                   AND tr.recorded_at >= DATEADD(day, -90, SYSUTCDATETIME())) AS firedCount
          FROM cpq.rule r {clause}
         ORDER BY r.rule_code
        """,
        params,
    )


def rule_audit(rule_code: str) -> list[dict]:
    return db.rows(
        """
        SELECT audit_id AS auditId, action, changed_by AS changedBy,
               CONVERT(varchar(30), changed_at, 126) AS changedAt, summary
          FROM cpq.rule_audit WHERE rule_code = ? ORDER BY changed_at DESC
        """,
        (rule_code,),
    )


def save_rule(rule: dict, username: str) -> None:
    """Header plus typed children, replaced as a set, with the before-and-after
    written to cpq.rule_audit in the same transaction. A rule edit that is not
    auditable is not an acceptable rule edit."""
    with db.cursor() as cur:
        cur.execute("SELECT rule_id FROM cpq.rule WHERE rule_code = ?", rule["ruleCode"])
        found = cur.fetchone()
        before = json.dumps(get_rule(rule["ruleCode"]), default=str) if found else None

        args = (
            rule.get("technologyCode"), rule["ruleType"], rule["summary"], rule.get("detail"),
            rule.get("sourceRef"), rule.get("author"), rule["severity"],
            rule["effectiveFrom"], rule.get("effectiveTo"),
            1 if rule.get("isActive") else 0, username,
        )
        if found:
            rule_id = found[0]
            cur.execute(
                """UPDATE cpq.rule
                      SET technology_cd=?, rule_type=?, summary=?, detail=?, source_ref=?,
                          author=?, severity=?, effective_from=?, effective_to=?,
                          is_active=?, updated_by=?, updated_at=SYSUTCDATETIME()
                    WHERE rule_id=?""", *args, rule_id)
            for table in ("cpq.rule_trigger", "cpq.rule_action", "cpq.rule_condition"):
                cur.execute(f"DELETE FROM {table} WHERE rule_id = ?", rule_id)
        else:
            cur.execute(
                """INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
                                         source_ref, author, severity, effective_from,
                                         effective_to, is_active, updated_by, created_by)
                   OUTPUT INSERTED.rule_id
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                rule["ruleCode"], *args, username)
            rule_id = cur.fetchone()[0]

        for t in rule.get("triggers", []):
            cur.execute(
                """INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role,
                        prod_cat, attr_name, attr_value, profile_field, compare_op,
                        compare_value, min_count) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                rule_id, t["triggerType"], t.get("itemNo"), t.get("itemRole"), t.get("prodCat"),
                t.get("attrName"), t.get("attrValue"), t.get("profileField"),
                t.get("compareOp"), t.get("compareValue"), t.get("minCount"))
        for a in rule.get("actions", []):
            cur.execute(
                """INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity,
                        max_discount, fit_grade, approver_role, allowance_amt, message,
                        remedy, matcher, attribute, deny_roles)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                rule_id, a["actionType"], a.get("itemNo"), a.get("quantity"),
                a.get("maxDiscount"), a.get("fitGrade"), a.get("approverRole"),
                a.get("allowanceAmt"), a.get("message"), a.get("remedy"),
                a.get("matcher"), a.get("attribute"), a.get("denyRoles"))
        for c in rule.get("conditions", []):
            cur.execute(
                """INSERT INTO cpq.rule_condition (rule_id, seq, label, condition_kind,
                        attr_name, attr_value, item_no, flag_name) VALUES (?,?,?,?,?,?,?,?)""",
                rule_id, c["seq"], c["label"], c["conditionKind"], c.get("attrName"),
                c.get("attrValue"), c.get("itemNo"), c.get("flagName"))

        cur.execute(
            """INSERT INTO cpq.rule_audit (rule_code, action, changed_by, summary,
                                           before_json, after_json)
               VALUES (?,?,?,?,?,?)""",
            rule["ruleCode"], "update" if found else "insert", username,
            "Edited in the admin screen" if found else "Created in the admin screen",
            before, json.dumps(rule, default=str))


# ---------------------------------------------------------------------- quotes


def analytics(username: str, role: str) -> dict:
    """Everything the analytics page draws, aggregated in SQL.

    SCOPED BEFORE ANYTHING IS COUNTED

    Every query below reads `cpq.fn_visible_quotes(?, ?)` rather than `cpq.quote`.
    That is the same rule every single-quote read obeys, and an aggregate is where it
    is easiest to skip and most damaging to: one unscoped SUM hands a rep the
    company's revenue in a number with nothing on screen to suggest it was ever
    narrowed.

    THE FILL-RATE SQL IS GENERATED FROM PROFILE_COLS

    Twenty-six columns, one COUNT each, and writing them out by hand is how a field
    added to the application quietly fails to appear on the page a year later. The
    map already exists and is already tested against both the schema and the
    TypeScript contract, so it is the honest source for this too.

    NOT RUN. Like everything in this repository, this has never executed against a
    database — the aggregate SQL is the part the parity guards cannot check, since
    they compare column names and not what a GROUP BY returns.
    """
    scope = "all" if role == "admin" else "team" if role == "approver" else "mine"
    who = (username, role)

    head = db.row(
        f"""
        SELECT COUNT(*) AS quotes,
               SUM(CASE WHEN {' OR '.join(f'v.{c} IS NOT NULL' for c in PROFILE_COLS.values())}
                        THEN 1 ELSE 0 END) AS described
          FROM cpq.fn_visible_quotes(?, ?) AS v
        """, who) or {"quotes": 0, "described": 0}

    # One row per field: how many answered it, and how many waved it off. The
    # no_constraint column is a CSV of field names, so a field is "waved off" when its
    # name appears in that list — matched with delimiters, or `substrate` would also
    # match a future `substrateNote`.
    answered = db.row(
        "SELECT " + ", ".join(
            f"SUM(CASE WHEN v.{col} IS NOT NULL THEN 1 ELSE 0 END) AS a_{field}, "
            f"SUM(CASE WHEN CHARINDEX(',{field},', ',' + ISNULL(v.no_constraint,'') + ',') > 0 "
            f"THEN 1 ELSE 0 END) AS n_{field}"
            for field, col in PROFILE_COLS.items())
        + " FROM cpq.fn_visible_quotes(?, ?) AS v", who) or {}

    # How many of the 28 each quote answered, so the page can state a median rather
    # than an average — one fully-captured application would drag a mean upwards and
    # report an evidence level no quote actually has.
    per_quote = db.rows(
        "SELECT (" + " + ".join(
            f"CASE WHEN v.{c} IS NOT NULL THEN 1 ELSE 0 END" for c in PROFILE_COLS.values())
        + ") AS n FROM cpq.fn_visible_quotes(?, ?) AS v", who)
    counts = sorted(r["n"] for r in per_quote)
    median_answered = 0
    if counts:
        mid = len(counts) // 2
        median_answered = (counts[mid] if len(counts) % 2
                           else round((counts[mid - 1] + counts[mid]) / 2))

    pipeline = db.rows(
        """
        SELECT v.status, COUNT(*) AS count, ISNULL(SUM(v.order_total), 0) AS value
          FROM cpq.fn_visible_quotes(?, ?) AS v
         GROUP BY v.status ORDER BY COUNT(*) DESC
        """, who)

    approvals = db.row(
        """
        SELECT SUM(CASE WHEN a.status = 'pending'  THEN 1 ELSE 0 END) AS pending,
               SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) AS approved,
               SUM(CASE WHEN a.status = 'declined' THEN 1 ELSE 0 END) AS declined,
               AVG(CASE WHEN a.decided_at IS NOT NULL
                        THEN DATEDIFF(hour, a.requested_at, a.decided_at) END) AS hours
          FROM cpq.quote_approval AS a
          JOIN cpq.fn_visible_quotes(?, ?) AS v ON v.quote_id = a.quote_id
        """, who) or {}

    # What the rules did. DISTINCT on the quote, because a rule that speaks twice
    # about one quote still had one opinion about it.
    fired = db.rows(
        """
        SELECT TOP 12 t.rule_code AS ruleCode,
               MIN(t.rule_summary) AS summary,
               COUNT(DISTINCT t.quote_id) AS fired,
               COUNT(DISTINCT CASE WHEN t.status = 'blocked' THEN t.quote_id END) AS blocked
          FROM cpq.quote_rule_trace AS t
          JOIN cpq.fn_visible_quotes(?, ?) AS v ON v.quote_id = t.quote_id
         GROUP BY t.rule_code ORDER BY COUNT(DISTINCT t.quote_id) DESC
        """, who)

    never = db.rows(
        """
        SELECT TOP 12 r.rule_code AS ruleCode, r.summary
          FROM cpq.rule AS r
         WHERE r.is_active = 1
           AND NOT EXISTS (
                 SELECT 1 FROM cpq.quote_rule_trace AS t
                  JOIN cpq.fn_visible_quotes(?, ?) AS v ON v.quote_id = t.quote_id
                 WHERE t.rule_code = r.rule_code)
         ORDER BY r.rule_code
        """, who)

    return {
        "quotes": head.get("quotes") or 0,
        "scope": scope,
        "described": head.get("described") or 0,
        "medianAnswered": median_answered,
        "application": [
            {
                "field": field,
                "label": field,
                "answered": answered.get(f"a_{field}") or 0,
                "noConstraint": answered.get(f"n_{field}") or 0,
                "ruleCount": 0,
                "bands": [],
            }
            for field in PROFILE_COLS
        ],
        "pipeline": pipeline,
        "discounts": [],
        "approvals": {
            "pending": approvals.get("pending") or 0,
            "approved": approvals.get("approved") or 0,
            "declined": approvals.get("declined") or 0,
            "medianHours": approvals.get("hours"),
        },
        "rules": fired,
        "neverFired": never,
    }


def next_quote_no() -> str:
    seq = db.scalar("SELECT NEXT VALUE FOR cpq.seq_quote_no")
    from datetime import date
    return f"Q-{date.today().year}-{int(seq):04d}"


def visible_quotes(username: str, role: str, status: str | None, q: str | None) -> list[dict]:
    where, params = ["1=1"], [username, role]
    if status and status != "all":
        where.append("v.status = ?")
        params.append(status)
    if q:
        where.append("(v.quote_no LIKE ? OR v.customer_name LIKE ? OR v.line_name LIKE ?)")
        params += [f"%{q}%"] * 3
    return db.rows(
        f"""
        SELECT v.quote_no AS quoteNo, v.technology_cd AS technologyCode, v.status,
               v.customer_no AS customerNo, v.customer_name AS customerName,
               v.line_name AS lineName, v.rep_username AS repUsername,
               v.rep_display AS repDisplay, v.order_total AS orderTotal,
               (SELECT COUNT(*) FROM cpq.quote_line l WHERE l.quote_id = v.quote_id) AS lineCount,
               CONVERT(varchar(30), v.updated_at, 126) AS updatedAt,
               (SELECT COUNT(*) FROM cpq.quote_approval a
                 WHERE a.quote_id = v.quote_id AND a.status = 'pending') AS approvalsPending
          FROM cpq.fn_visible_quotes(?, ?) AS v
         WHERE {' AND '.join(where)}
         ORDER BY v.updated_at DESC
        """,
        params,
    )


# The application profile: field on the draft -> column on cpq.quote.
#
# A mapping rather than two parallel lists. The UPDATE below used to name its
# columns inline and take its values from a list that had to be in the same
# order; with eight fields that held, and it would not have survived
# twenty-eight. Both halves of every pair are now written once, together.
PROFILE_COLS = {
    "substrate": "substrate",
    "porosity": "porosity",
    "productWidthMm": "product_width_mm",
    "productLengthMm": "product_length_mm",
    "productTempF": "product_temp_f",
    "lineSpeedFpm": "line_speed_fpm",
    "throughputPpm": "throughput_ppm",
    "productSpacingMm": "product_spacing_mm",
    # Nineteen fit rules trigger on these two, and neither had a column or an entry
    # here — so the answer reached the service and stopped. See sql/16_label_size.sql.
    "labelWidthMm": "label_width_mm",
    "labelLengthMm": "label_length_mm",
    "conveyor": "conveyor",
    "guideRails": "guide_rails",
    "productMotion": "product_motion",
    "charHeightMm": "char_height_mm",
    "throwDistMm": "throw_dist_mm",
    "linesOfPrint": "lines_of_print",
    "markingWindowMm": "marking_window_mm",
    "messageContent": "message_content",
    "barcodeRequirements": "barcode_requirements",
    "printQuality": "print_quality",
    "inkType": "ink_type",
    "dryTimeSeconds": "dry_time_seconds",
    "environment": "environment",
    "ambientTempMinF": "ambient_temp_min_f",
    "ambientTempMaxF": "ambient_temp_max_f",
    "adhesionRequirements": "adhesion_requirements",
    "sampleTested": "sample_tested",
    "notes": "profile_notes",
}

# SELECT list and UPDATE assignments, derived from the one mapping above so a new
# profile field cannot be readable but unwritable, or the reverse.
PROFILE_SELECT = ",\n               ".join(
    f"v.{col}" if col == field else f"v.{col} AS {field}"
    for field, col in PROFILE_COLS.items())
PROFILE_SET = ", ".join(f"{col}=?" for col in PROFILE_COLS.values())


def get_quote(quote_no: str, username: str, role: str) -> dict | None:
    head = db.row(
        f"""
        SELECT v.quote_id, v.quote_no AS quoteNo, v.technology_cd AS technologyCode, v.status,
               v.customer_no AS customerNo, v.customer_name AS customerName,
               v.line_name AS lineName, v.rep_username AS repUsername,
               v.rep_display AS repDisplay, v.extended_list AS extendedList,
               v.extended_net AS extendedNet, v.order_total AS orderTotal,
               v.total_discount AS totalDiscount, v.margin_pct AS marginPct,
               {PROFILE_SELECT},
               v.solutions AS solutionsJson,
               v.no_constraint AS noConstraintCsv,
               v.discount_system, v.discount_consumables,
               v.discount_accessories, v.discount_customs,
               v.recipient_email AS recipientEmail, v.covering_note AS coveringNote,
               CONVERT(varchar(30), v.updated_at, 126) AS updatedAt
          FROM cpq.fn_visible_quotes(?, ?) AS v
         WHERE v.quote_no = ?
        """,
        (username, role, quote_no),
    )
    if not head:
        return None
    qid = head.pop("quote_id")

    # Nest the profile, because that is the shape the client's Quote type declares.
    # These columns used to be returned flat beside quoteNo and status, so
    # Quote.profile was never populated and reopening a quote silently lost every
    # answer the rep had given about the line.
    head["profile"] = {field: head.pop(field) for field in PROFILE_COLS}
    csv = head.pop("noConstraintCsv", None) or ""
    head["noConstraint"] = [f for f in (s.strip() for s in csv.split(",")) if f]

    # The stations, stored as JSON. A quote raised before solutions existed has
    # none, and every line falls back to the quote's own application.
    head["solutions"] = json.loads(head.pop("solutionsJson", None) or "[]")

    head["lines"] = db.rows(
        """SELECT line_no AS lineNo, item_no AS itemNo, description, quantity,
                  list_price AS listPrice, discount_cat_cd AS discountCatCode,
                  category_discount AS categoryDiscount, applied_discount AS appliedDiscount,
                  capped_by_rule AS cappedByRule, net_unit AS netUnit,
                  extended_list AS extendedList, extended_net AS extendedNet,
                  solution_id AS solutionId,
                  CAST(is_optional AS bit) AS optional
             FROM cpq.quote_line WHERE quote_id = ? ORDER BY line_no""", (qid,))
    head["trace"] = db.rows(
        """SELECT rule_code AS ruleCode, rule_summary AS ruleSummary, source_ref AS sourceRef,
                  author, status, headline
             FROM cpq.quote_rule_trace WHERE quote_id = ? ORDER BY trace_id""", (qid,))
    head["approvals"] = db.rows(
        """SELECT a.approval_id AS approvalId, a.rule_code AS ruleCode, a.reason,
                  a.requested_pct AS requestedPct, a.stated_max AS statedMax,
                  a.approver_user AS approverUser, u.display_name AS approverDisplay,
                  a.status, CONVERT(varchar(30), a.requested_at, 126) AS requestedAt
             FROM cpq.quote_approval a
             LEFT JOIN cpq.app_user u ON u.username = a.approver_user
            WHERE a.quote_id = ? ORDER BY a.approval_id""", (qid,))
    head["quoteId"] = qid
    return head


def write_evaluation(quote_id: int, draft: dict, ev: dict) -> None:
    """Replace the quote's lines and trace with what the engine just produced.

    The trace is written by the same call that produced the numbers. If it were
    written anywhere else it would be a description of the quote rather than a
    record of it, and six months later nobody could defend the price.
    """
    d = draft.get("categoryDiscounts") or {}
    p = draft.get("profile") or {}
    # Written down so a reopened quote knows which fields were deliberately left
    # unconstrained, rather than treating them as merely unanswered.
    no_constraint = ",".join(draft.get("noConstraint") or []) or None
    with db.cursor() as cur:
        cur.execute(
            f"""UPDATE cpq.quote
                   SET technology_cd=?, customer_no=?, customer_name=?, line_name=?,
                       {PROFILE_SET}, no_constraint=?, solutions=?,
                       discount_system=?, discount_consumables=?, discount_accessories=?,
                       discount_customs=?, extended_list=?, extended_net=?, order_total=?,
                       total_discount=?, margin_pct=?,
                       recipient_email=?, covering_note=?,
                       updated_at=SYSUTCDATETIME()
                 WHERE quote_id=?""",
            draft["technologyCode"], draft.get("customerNo"), draft.get("customerName"),
            draft.get("lineName"),
            *[p.get(k) for k in PROFILE_COLS], no_constraint,
            json.dumps(draft.get("solutions") or []),
            d.get("system"), d.get("consumables"), d.get("accessories"), d.get("customs"),
            ev["extendedList"], ev["extendedNet"], ev["orderTotal"],
            ev["totalDiscount"], ev["marginPct"],
            draft.get("recipientEmail"), draft.get("coveringNote"), quote_id)

        cur.execute("DELETE FROM cpq.quote_line WHERE quote_id = ?", quote_id)
        for l in ev["lines"]:
            cur.execute(
                """INSERT INTO cpq.quote_line (quote_id, line_no, item_no, description,
                        quantity, list_price, discount_cat_cd, category_discount,
                        applied_discount, capped_by_rule, net_unit, extended_list,
                        extended_net, solution_id, is_optional)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                quote_id, l["lineNo"], l["itemNo"], l["description"], l["quantity"],
                l["listPrice"], l["discountCatCode"], l["categoryDiscount"],
                l["appliedDiscount"], l["cappedByRule"], l["netUnit"],
                l["extendedList"], l["extendedNet"], l.get("solutionId"),
            1 if l.get("optional") else 0)

        cur.execute("DELETE FROM cpq.quote_rule_trace WHERE quote_id = ?", quote_id)
        for t in ev["trace"]:
            cur.execute(
                """INSERT INTO cpq.quote_rule_trace (quote_id, rule_code, rule_summary,
                        source_ref, author, status, headline) VALUES (?,?,?,?,?,?,?)""",
                quote_id, t["ruleCode"], t["ruleSummary"], t["sourceRef"],
                t["author"], t["status"], t["headline"])


def create_quote(quote_no: str, draft: dict, caller_username: str, caller_display: str | None) -> int:
    return db.scalar(
        """INSERT INTO cpq.quote (quote_no, technology_cd, status, rep_username, rep_display)
           OUTPUT INSERTED.quote_id VALUES (?, ?, 'draft', ?, ?)""",
        (quote_no, draft["technologyCode"], caller_username, caller_display),
    )


def raise_approvals(quote_id: int, required: list[dict], rep_username: str) -> int:
    """Route each approval the evaluation asked for, and say how the approver was
    chosen. ``cpq.fn_approver_for`` returns 'unroutable' when nobody resolves,
    and the quote is flagged rather than silently sent to nobody."""
    with db.cursor() as cur:
        cur.execute("DELETE FROM cpq.quote_approval WHERE quote_id = ? AND status = 'pending'",
                    quote_id)
        cur.execute("SELECT technology_cd FROM cpq.quote WHERE quote_id = ?", quote_id)
        tech = cur.fetchone()[0]
        for a in required:
            # approver_username is the function's column. cpq.quote_approval has a
            # separate approver_user column, and selecting that name from the
            # function looked right in a grep while failing on execution.
            cur.execute("SELECT approver_username, resolved_by FROM cpq.fn_approver_for(?, ?)",
                        rep_username, tech)
            got = cur.fetchone()
            cur.execute(
                """INSERT INTO cpq.quote_approval (quote_id, rule_code, reason, requested_pct,
                        stated_max, approver_role, approver_user, status)
                   VALUES (?,?,?,?,?,?,?, 'pending')""",
                quote_id, a.get("ruleCode"), a["reason"], a.get("requestedPct"),
                a.get("statedMax"), a.get("approverRole"), got[0] if got else None)
        return len(required)


def delete_quote(quote_id: int) -> None:
    """Lines, trace and approvals go with it — all three cascade on quote_id."""
    db.execute("DELETE FROM cpq.quote WHERE quote_id = ?", (quote_id,))


def set_quote_status(quote_id: int, status: str) -> None:
    db.execute(
        "UPDATE cpq.quote SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN SYSUTCDATETIME() "
        "ELSE sent_at END, updated_at = SYSUTCDATETIME() WHERE quote_id = ?",
        (status, status, quote_id))


def decide_approval(quote_id: int, approval_id: int, decision: str,
                    note: str, decider: str) -> None:
    db.execute(
        """UPDATE cpq.quote_approval
              SET status = ?, decision_note = ?, decided_at = SYSUTCDATETIME(),
                  approver_user = COALESCE(approver_user, ?)
            WHERE quote_id = ? AND approval_id = ?""",
        (decision, note, decider, quote_id, approval_id))


# ----------------------------------------------- Planning Analytics pass-through


def item_promise(item_no: str, qty: float) -> dict | None:
    head = db.row(
        """SELECT item_no AS itemNo, description, pur_or_mfg AS purOrMfg,
                  CONVERT(varchar(30), as_of, 126) AS asOf, freshness
             FROM cpq.v_item_promise WHERE item_no = ?""", (item_no,))
    if not head:
        return None
    head["ladder"] = db.rows(
        """SELECT ladder_seq AS ladderSeq, CONVERT(varchar(10), promised_dt, 23) AS promisedDt,
                  CONVERT(varchar(10), material_ready_dt, 23) AS materialReadyDt,
                  atp_qty AS atpQty, promise_mode AS promiseMode, explanation
             FROM pa.promise WHERE item_no = ? ORDER BY ladder_seq""", (item_no,))
    head["covering"] = db.row(
        "SELECT * FROM cpq.fn_promise_for_qty(?, ?)", (item_no, qty))
    return head


def search_customers(q: str, username: str, role: str) -> list[dict]:
    """A rep sees only the customers assigned to them. An approver or admin sees
    everyone — the restriction is on the rep role specifically, not on seniority."""
    return db.rows(
        """SELECT c.customer_no AS customerNo, c.customer_name AS customerName,
                  c.open_orders AS openOrders, c.late_orders AS lateOrders
             FROM cpq.v_customer_open_summary c
            WHERE (? = '' OR c.customer_no LIKE ? OR c.customer_name LIKE ?)
              AND (? <> 'rep' OR EXISTS (SELECT 1 FROM cpq.rep_customer rc
                                          WHERE rc.customer_no = c.customer_no
                                            AND rc.rep_username = ?))
            ORDER BY c.customer_name""",
        (q or "", f"%{q}%", f"%{q}%", role, username))


def open_orders(customer_no: str) -> list[dict]:
    lines = db.rows(
        """SELECT ord_no AS ordNo, ord_type AS ordType, cus_no AS customerNo,
                  cus_name AS customerName, line_seq_no AS lineSeqNo,
                  item_no AS itemNo, description, qty_open AS qtyOpen,
                  qty_bkord AS qtyBackordered,
                  CONVERT(varchar(10), promise_dt, 23) AS promiseDt,
                  CONVERT(varchar(10), request_dt, 23) AS requestDt,
                  CONVERT(varchar(10), due_dt, 23) AS dueDt,
                  status_label AS statusLabel, is_late AS isLate, days_late AS daysLate,
                  CONVERT(varchar(10), ladder_promised_dt, 23) AS ladderPromisedDt,
                  promise_mode AS promiseMode, promise_explanation AS promiseExplanation,
                  CONVERT(varchar(30), as_of, 126) AS asOf, freshness
             FROM cpq.v_customer_open_lines WHERE cus_no = ?
            ORDER BY ord_no, line_seq_no""", (customer_no,))

    orders: dict[str, dict] = {}
    for l in lines:
        o = orders.setdefault(l["ordNo"], {
            "ordNo": l["ordNo"], "ordType": l["ordType"], "customerNo": l["customerNo"],
            "customerName": l["customerName"], "lines": [],
            "asOf": l["asOf"], "freshness": l["freshness"],
        })
        o["lines"].append({k: l[k] for k in (
            "lineSeqNo", "itemNo", "description", "qtyOpen", "qtyBackordered", "promiseDt",
            "requestDt", "dueDt", "statusLabel", "isLate", "daysLate", "ladderPromisedDt",
            "promiseMode", "promiseExplanation")})

    for o in orders.values():
        ls = o["lines"]
        dues = sorted(x["dueDt"] for x in ls if x["dueDt"])
        readies = sorted((x["ladderPromisedDt"] or x["dueDt"]) for x in ls
                         if x["ladderPromisedDt"] or x["dueDt"])
        o["openLines"] = len(ls)
        o["qtyOpen"] = sum(x["qtyOpen"] for x in ls)
        o["earliestDueDt"] = dues[0] if dues else None
        # The slowest line decides when the whole order can ship, not the fastest.
        o["expectedReadyDt"] = readies[-1] if readies else None
        o["lateLines"] = sum(1 for x in ls if x["isLate"])
        late = [x["daysLate"] for x in ls if x["daysLate"]]
        o["worstDaysLate"] = max(late) if late else None
    return sorted(orders.values(),
                  key=lambda o: (-o["lateLines"], o["earliestDueDt"] or "9999"))


def log_access(username: str, event: str, detail: str | None = None) -> None:
    """Record a privileged action against the person who took it.

    The column is `event`. This inserted into `action` — a column cpq.access_log does
    not have — so every audited action would have thrown on the first run against a
    real database, and the audit trail the security design rests on would have been
    empty. The parameter is named for the column now, so the next person to read one
    reads the other.
    """
    db.execute(
        "INSERT INTO cpq.access_log (username, event, detail) VALUES (?,?,?)",
        (username, event, detail))

# ---------------------------------------------------------------- the vocabulary
#
# What a part can be sorted by: price book, type, category. All three are editable
# from the Classify screen, because the taxonomy the tool sorts parts by belongs to
# the business rather than to a deployment.


def item_roles() -> list[dict]:
    """Every type, with how many active parts carry it.

    The count is what makes the Remove button honest: a type with parts under it
    cannot go, and the number is both the reason and the way to find them.
    """
    return db.rows(
        """
        SELECT r.role_name AS name,
               (SELECT COUNT(*) FROM cpq.v_quotable_item i
                 WHERE i.item_role = r.role_name) AS count
          FROM cpq.item_role r
         ORDER BY r.role_name
        """
    )


def add_item_role(name: str, username: str) -> None:
    db.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM cpq.item_role WHERE role_name = ?)
            INSERT INTO cpq.item_role (role_name, created_by) VALUES (?, ?)
        """,
        (name, name, username),
    )


def item_role_usage(name: str) -> dict:
    """What is standing in the way of removing this type."""
    return {
        "items": db.scalar(
            "SELECT COUNT(*) FROM cpq.v_quotable_item WHERE item_role = ?", (name,)) or 0,
        # A rule that reads a type is a second reason it cannot go, and a quieter
        # one: the parts can be retyped, but a rule left naming a type nothing has
        # is a rule that never fires again.
        "rules": db.scalar(
            """
            SELECT COUNT(DISTINCT t.rule_id) FROM cpq.rule_trigger t
             WHERE t.trigger_type = 'role' AND t.item_role = ?
            """, (name,)) or 0,
        "builtin": bool(db.scalar(
            "SELECT is_builtin FROM cpq.item_role WHERE role_name = ?", (name,))),
    }


def remove_item_role(name: str) -> None:
    db.execute("DELETE FROM cpq.item_role WHERE role_name = ?", (name,))


def item_categories(technology: str | None = None) -> list[dict]:
    """Categories with a count, for one book or for all of them.

    Read from what parts actually carry, unioned with the categories somebody has
    declared and not yet used — a category added on the Classify screen has to appear
    before any part is filed under it, or nobody can file the first one.
    """
    return db.rows(
        """
        WITH used AS (
            SELECT i.category AS name, COUNT(*) AS count
              FROM cpq.v_quotable_item i
             WHERE i.category IS NOT NULL AND i.category <> ''
               AND (? IS NULL OR i.technology_cd = ?)
             GROUP BY i.category
        )
        SELECT c.category_name AS category,
               COALESCE(u.count, 0) AS count
          FROM cpq.item_category c
          LEFT JOIN used u ON u.name = c.category_name
        UNION
        SELECT u.name, u.count
          FROM used u
         WHERE NOT EXISTS (SELECT 1 FROM cpq.item_category c
                            WHERE c.category_name = u.name)
         ORDER BY 1
        """,
        (technology, technology),
    )


def add_category(name: str, username: str) -> None:
    db.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM cpq.item_category WHERE category_name = ?)
            INSERT INTO cpq.item_category (category_name, created_by) VALUES (?, ?)
        """,
        (name, name, username),
    )


def category_usage(name: str) -> int:
    return db.scalar(
        "SELECT COUNT(*) FROM cpq.v_quotable_item WHERE category = ?", (name,)) or 0


def remove_category(name: str) -> None:
    db.execute("DELETE FROM cpq.item_category WHERE category_name = ?", (name,))


def add_technology(code: str, name: str, username: str) -> None:
    db.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM cpq.technology WHERE technology_cd = ?)
            INSERT INTO cpq.technology (technology_cd, technology_name, is_active,
                                        sort_order)
            VALUES (?, ?, 1,
                    (SELECT ISNULL(MAX(sort_order), 0) + 10 FROM cpq.technology))
        """,
        (code, code, name),
    )
    log_access(username, "technology.add", code)


def technology_usage(code: str) -> dict:
    return {
        "items": db.scalar(
            "SELECT COUNT(*) FROM cpq.v_quotable_item WHERE technology_cd = ?",
            (code,)) or 0,
        "rules": db.scalar(
            "SELECT COUNT(*) FROM cpq.rule WHERE technology_cd = ?", (code,)) or 0,
        "quotes": db.scalar(
            "SELECT COUNT(*) FROM cpq.quote WHERE technology_cd = ?", (code,)) or 0,
    }


def remove_technology(code: str, username: str) -> None:
    """Deactivate, never delete.

    A price book with quotes against it is history, and history does not get
    removed because somebody tidied a dropdown. The book stops being offered; every
    quote that used it still reads.
    """
    db.execute(
        "UPDATE cpq.technology SET is_active = 0 WHERE technology_cd = ?", (code,))
    log_access(username, "technology.remove", code)


# ------------------------------------------------------------- configured items


def add_configured_item(spec: dict, username: str) -> dict:
    """A part number that did not exist until somebody composed it.

    A Corvus laser has none until it is configured, and neither does a 7300-series
    CIJ — the number IS the configuration. Idempotent on the part number: composing
    the same machine twice is one part, not an error.
    """
    db.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM cpq.item_configured WHERE item_no = ?)
            INSERT INTO cpq.item_configured
                (item_no, description, technology_cd, item_role, model, list_price,
                 discount_cd, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (spec["itemNo"], spec["itemNo"], spec["description"], spec["technologyCode"],
         spec.get("itemRole") or "printer", spec.get("model"),
         spec.get("listPrice"), spec.get("discountCatCode") or "system", username),
    )
    log_access(username, "item.configured", spec["itemNo"])
    found = items_for([spec["itemNo"]])
    if not found:
        raise RuntimeError(
            f"{spec['itemNo']} was written and cannot be read back — check that "
            f"cpq.v_quotable_item unions cpq.item_configured")
    return found[0]


# ------------------------------------------------------------ document defaults


def document_defaults(username: str) -> str | None:
    """The rep's own defaults as stored JSON, or None if they have never saved any.

    The service returns the shipped defaults in that case rather than an empty
    document; see main.py. A blank quote template is not a default, it is a bug
    that looks like a preference.
    """
    return db.scalar(
        "SELECT settings FROM cpq.document_default WHERE username = ?", (username,))


def save_document_defaults(username: str, settings_json: str) -> None:
    db.execute(
        """
        MERGE cpq.document_default AS t
        USING (SELECT ? AS username, ? AS settings) AS s
           ON t.username = s.username
        WHEN MATCHED THEN
            UPDATE SET settings = s.settings, updated_utc = sysutcdatetime()
        WHEN NOT MATCHED THEN
            INSERT (username, settings) VALUES (s.username, s.settings);
        """,
        (username, settings_json),
    )


# ------------------------------------------------------------------ rule codes


def next_rule_code(prefix: str) -> str:
    """The next free code under a prefix, e.g. A-CIJ- -> A-CIJ-007.

    Asked of the database rather than counted in the browser: two admins writing a
    rule at the same time would otherwise both be offered the same code, and the
    save that lands second would overwrite the first. Reusing a retired code is
    just as bad, so retired rules are counted too.
    """
    used = db.rows(
        "SELECT rule_code FROM cpq.rule WHERE rule_code LIKE ? + '%'", (prefix,))
    taken = set()
    for r in used:
        tail = r["rule_code"][len(prefix):]
        if tail.isdigit():
            taken.add(int(tail))
    n = 1
    while n in taken:
        n += 1
    width = max(3, max((len(str(t)) for t in taken), default=3))
    return f"{prefix}{n:0{width}d}"


# ------------------------------------------------------ how a quote ended, and how it went


def mark_sent_outside(quote_id: int, details: dict, username: str) -> None:
    """The rep sent it themselves, and the quote has to know.

    Reps edit the Word document and send it from Outlook. Recording that as an
    ordinary 'sent' would be a lie about how it went — and the difference matters
    the day somebody asks which quote the customer actually received.
    """
    db.execute(
        """
        UPDATE cpq.quote
           SET status            = 'sent',
               sent_outside_utc  = sysutcdatetime(),
               sent_outside_to   = ?,
               sent_outside_note = ?,
               sent_outside_by   = ?
         WHERE quote_id = ?
        """,
        (details.get("to"), details.get("note"), username, quote_id),
    )
    log_access(username, "quote.sentOutside", str(quote_id))


def save_sent_file(quote_id: int, name: str, content_type: str | None,
                   content: bytes) -> None:
    db.execute(
        """
        MERGE cpq.quote_sent_file AS t
        USING (SELECT ? AS quote_id) AS s
           ON t.quote_id = s.quote_id
        WHEN MATCHED THEN
            UPDATE SET file_name = ?, content_type = ?, byte_size = ?,
                       content = ?, uploaded_utc = sysutcdatetime()
        WHEN NOT MATCHED THEN
            INSERT (quote_id, file_name, content_type, byte_size, content)
            VALUES (?, ?, ?, ?, ?);
        """,
        (quote_id, name, content_type, len(content), content,
         quote_id, name, content_type, len(content), content),
    )


def mark_lost(quote_id: int, reason: str | None, username: str) -> None:
    db.execute(
        """
        UPDATE cpq.quote
           SET status = 'lost', lost_reason = ?, lost_utc = sysutcdatetime()
         WHERE quote_id = ?
        """,
        (reason, quote_id),
    )
    log_access(username, "quote.lost", str(quote_id))


def reopen_quote(quote_id: int, username: str) -> None:
    """Back to draft, and the reason it was lost goes with it.

    Leaving the old reason on a live quote is how a won deal ends up filed with a
    sentence about why it was lost.
    """
    db.execute(
        """
        UPDATE cpq.quote
           SET status = 'draft', lost_reason = NULL, lost_utc = NULL
         WHERE quote_id = ?
        """,
        (quote_id,),
    )
    log_access(username, "quote.reopen", str(quote_id))
