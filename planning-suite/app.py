"""
Axim Planning Analytics: backend API
========================================
A thin read-only web service that runs the SQL Server views and serves the
dashboard. Replaces Power BI's per-viewer licensing: this app serves an
unlimited number of viewers for $0 in license cost. It sits INSIDE the network
and connects straight to SQL Server, so there is no data gateway to manage.

Stack: FastAPI (Python). Chosen because it is readable, fully self-contained,
and easy to hand to IT for review. If your IT standardizes on .NET/IIS instead,
the same endpoints port directly to a minimal-API C# service; the SQL is the
real asset and does not change.

RUN (dev):
    pip install -r requirements.txt
    # set the two env vars below (or edit the defaults), then:
    uvicorn app:app --host 0.0.0.0 --port 8080
Then open http://<this-server>:8080. Viewers need nothing but a browser.

CONNECTION: the one thing to confirm with IT.
    Two auth modes, switch with PA_AUTH.
      PA_AUTH=windows  -> Trusted_Connection (the app's service account is a
                          SQL login; nothing stored here). Preferred in an
                          AD shop. Run the service under a least-privilege
                          domain account that has db_datareader on the
                          PA_DB database ONLY.
      PA_AUTH=sql      -> uses PA_USER / PA_PASS (a read-only SQL login).
    Everything this app runs is SELECT-only against views. Grant the service
    account db_datareader and nothing more; the views already encapsulate all
    logic, so the app never needs table access or write rights.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
try:
    import pyodbc
except ImportError:          # fine in demo mode; fatal only for live mode
    pyodbc = None

# ---- config (env-overridable; only read when PA_DEMO=0) ---------------------
PA_HOST   = os.getenv("PA_HOST", "sql.axim.example")   # NOT sql01 - legacy, forwards here
PA_DB     = os.getenv("PA_DB",   "PlanningSuite")   # the live SQL Server database name; never shown in the UI
PA_AUTH   = os.getenv("PA_AUTH", "windows")          # 'windows' | 'sql'
PA_USER   = os.getenv("PA_USER", "")
PA_PASS   = os.getenv("PA_PASS", "")
PA_DRIVER = os.getenv("PA_DRIVER", "ODBC Driver 18 for SQL Server")
#: Demo unless you ask for live, which is the opposite of the original.
#:
#: A portfolio piece that needs a SQL Server, an ODBC driver and three
#: environment variables before it shows you anything is a portfolio piece
#: nobody runs. Set PA_DEMO=0 and the connection settings below to point it at
#: a real database; otherwise it serves the in-memory dataset in demo_data.py.
PA_DEMO   = os.getenv("PA_DEMO", "1") == "1"

def _conn_str() -> str:
    base = (f"DRIVER={{{PA_DRIVER}}};SERVER={PA_HOST};DATABASE={PA_DB};"
            "Encrypt=yes;TrustServerCertificate=yes;")
    if PA_AUTH == "sql":
        return base + f"UID={PA_USER};PWD={PA_PASS};"
    return base + "Trusted_Connection=yes;"

if PA_DEMO:
    from demo_data import demo_q

def q(sql: str, params: tuple = ()) -> list[dict]:
    if PA_DEMO:
        return demo_q(sql, params)
    if pyodbc is None:
        raise HTTPException(503, "pyodbc not installed - run with PA_DEMO=1 for the demo dataset, "
                                 "or pip install pyodbc + the MS ODBC driver for live mode")
    """Run a read-only query, return list of dicts. Connections are per-request
    and short-lived; for higher traffic put a pool (e.g. via SQLAlchemy) here."""
    cn = None
    try:
        # NOTE: pyodbc's context manager commits but does NOT close the
        # connection (documented gotcha), so close explicitly.
        cn = pyodbc.connect(_conn_str(), timeout=8)
        cur = cn.cursor()
        cur.execute(sql, params)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    except pyodbc.Error as e:
        raise HTTPException(status_code=503, detail=f"database: {e.args[-1] if e.args else e}")
    finally:
        if cn is not None:
            cn.close()

app = FastAPI(title="Axim Planning Analytics", docs_url="/api/docs")

# =====================================================================
#  API: every endpoint maps to a view you already deployed. Column names
#  follow the dashboard-views / pipeline files; where a name is uncertain
#  it is flagged with a NOTE so you can confirm against your live schema.
# =====================================================================

@app.get("/api/health")
def health():
    row = q("SELECT 1 AS ok")
    return {"ok": bool(row), "mode": "demo" if PA_DEMO else "live",
            "host": None if PA_DEMO else PA_HOST, "db": None if PA_DEMO else PA_DB,
            "auth": None if PA_DEMO else PA_AUTH}

@app.get("/api/act/summary")
def act_summary(planner: str | None = None):
    """Four action-type tiles. Column names verified against the deployed
    views July 2026 (suggested_order_value, build_status, etc.)."""
    pl = "AND planner = ?" if planner else ""
    p  = (planner,) if planner else ()
    orders = q(f"""SELECT COUNT(*) n, SUM(suggested_order_value) v
                   FROM dbo.v_plan_reorder_suggestion WHERE 1=1 {pl}""", p)
    expo = q(f"""SELECT COUNT(*) n, SUM(open_value) v FROM dbo.v_plan_open_po
                 WHERE recommended_action = 'EXPEDITE' {pl}""", p)
    defr = q(f"""SELECT COUNT(*) n, SUM(open_value) v FROM dbo.v_plan_open_po
                 WHERE (recommended_action LIKE 'DEFER%' OR recommended_action LIKE 'REVIEW%') {pl}""", p)
    blk = q(f"""SELECT COUNT(*) n FROM [plan].v_build_readiness
                WHERE build_status LIKE 'BLOCKED%' {pl}""", p)
    def one(r): return {"count": r[0]["n"] or 0, "value": float(r[0]["v"] or 0)}
    return {"order": one(orders), "expedite": one(expo), "defer": one(defr),
            "blocked": {"count": blk[0]["n"] or 0, "value": 0}}

@app.get("/api/act/queue")
def act_queue(planner: str | None = None, limit: int = 50):
    """Unified action queue, ranked by dollar impact."""
    pl = "AND planner = ?" if planner else ""
    p  = (planner,) if planner else ()
    return q(f"""
        SELECT * FROM (
            SELECT 'ORDER' AS action_type, item_no, item_desc_1 AS descr,
                   suggested_order_value AS impact, suggested_need_by_dt AS due_dt,
                   'Place ' + CAST(CAST(suggested_order_qty AS int) AS varchar(20))
                     + ' @ ' + ISNULL(primary_vendor_name,'(no vendor)') AS instruction,
                   urgency AS badge
            FROM dbo.v_plan_reorder_suggestion WHERE 1=1 {pl}
            UNION ALL
            SELECT recommended_action, item_no, item_desc_1,
                   open_value, promise_dt,
                   recommended_action + ' PO ' + LTRIM(RTRIM(CAST(ord_no AS varchar(20))))
                     + CASE WHEN days_overdue > 0
                            THEN ' (' + CAST(days_overdue AS varchar(10)) + 'd overdue)'
                            ELSE '' END,
                   recommended_action
            FROM dbo.v_plan_open_po
            WHERE (recommended_action LIKE 'EXPEDITE%'
                   OR recommended_action LIKE 'DEFER%'
                   OR recommended_action LIKE 'REVIEW%') {pl}
            UNION ALL
            SELECT 'BLOCKED', b.item_no, b.item_desc_1,
                   CAST(b.build_qty * ISNULL(pf.unit_cost,0) AS decimal(18,2)), b.due_dt,
                   'Build ' + CAST(CAST(b.build_qty AS int) AS varchar(20))
                     + ' - gated by ' + ISNULL(b.gating_component,'?'),
                   b.build_status
            FROM [plan].v_build_readiness b
            LEFT JOIN dbo.v_pfep pf ON pf.item_no = b.item_no
            WHERE b.build_status LIKE 'BLOCKED%' {pl.replace('planner','b.planner')}
        ) x
        ORDER BY impact DESC
        OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
    """, p + p + p + (limit,))

@app.get("/api/plan/spend")
def plan_spend():
    """Spend forecast: KNOWN / PREDICTED_REORDER / PREDICTED_DATED by month."""
    return q("""SELECT month_start, spend_type, spend_amount
                FROM [plan].v_spend_forecast ORDER BY month_start, spend_type""")

@app.get("/api/plan/excess")
def plan_excess():
    """Projected excess value by month (+1..+3), split by whether demand will
    consume it. Excess with no demand behind it does not move on this curve."""
    return q("""SELECT month_start, month_offset,
                       SUM(excess_value_proj) AS excess_value,
                       SUM(CASE WHEN weeks_to_clear IS NOT NULL THEN 1 ELSE 0 END) AS clearing_ct,
                       SUM(CASE WHEN weeks_to_clear IS NULL     THEN 1 ELSE 0 END) AS stuck_ct
                FROM [plan].v_excess_projection
                GROUP BY month_start, month_offset ORDER BY month_offset""")

@app.get("/api/plan/excess_risk")
def plan_excess_risk(limit: int = 25):
    """Early-warning list: items whose demand is falling fast enough that their
    current cover will tip into excess. Actionable bucket first."""
    return q("""SELECT TOP (?) item_no, item_desc_1, planner, risk_flag,
                       trend_ratio_13wk, headroom_pct, value_on_hand,
                       excess_value_if_flipped
                FROM dbo.v_excess_risk_trend
                WHERE risk_flag IS NOT NULL
                ORDER BY CASE WHEN risk_flag LIKE 'EXCESS%' THEN 1
                              WHEN risk_flag LIKE 'DECLINING%THIN%' THEN 2
                              ELSE 3 END, value_on_hand DESC""", (limit,))

@app.get("/api/plan/stockout")
def plan_stockout(limit: int = 25, planner: str | None = None):
    """Items whose on-hand track hits zero inside the horizon. Derived from the
    simulation trace: first week where qty_on_hand = 0. Optional planner filter
    for the Plan-page stockout runway."""
    pl = "AND d.planner = ?" if planner else ""
    p = (planner,) if planner else ()
    return q(f"""
        WITH had_stock AS (
            SELECT item_no FROM [plan].replenishment_sim
            WHERE horizon_wk = 0 AND qty_on_hand > 0
        ),
        z AS (
            SELECT s.item_no, MIN(s.horizon_wk) AS first_zero_wk
            FROM [plan].replenishment_sim s
            JOIN had_stock h ON h.item_no = s.item_no   -- "runs OUT", not "was already empty"
            WHERE s.qty_on_hand <= 0 AND s.horizon_wk > 0
            GROUP BY s.item_no
        )
        SELECT TOP (?) z.item_no, z.first_zero_wk,
               d.item_desc_1, d.lead_working_days
        FROM z
        LEFT JOIN dbo.v_plan_item_detail d ON d.item_no = z.item_no
        WHERE 1=1 {pl}
        ORDER BY z.first_zero_wk ASC
    """, (limit,) + p)

@app.get("/api/plan/strip/{item_no}")
def plan_strip(item_no: str):
    """The signature horizon strip: position + on-hand walk for one item."""
    return q("""SELECT horizon_wk, week_start, position, qty_on_hand
                FROM [plan].replenishment_sim
                WHERE item_no = ? ORDER BY horizon_wk""", (item_no,))

@app.get("/api/money/bridge")
def money_bridge():
    """Cash release bridge inputs: on-hand and excess. One excess bucket covers
    everything held above the order-up-to level, so no item is counted twice and
    nothing hides behind a tier label."""
    return q("""SELECT
                  SUM(value_on_hand) AS on_hand,
                  SUM(CASE WHEN excess_value > 0 THEN excess_value ELSE 0 END) AS excess
                FROM dbo.v_exec_inventory_item""")

@app.get("/api/money/burndown")
def money_burndown():
    """How long the excess takes to clear. Months-to-clear divides the excess that
    has demand behind it by the value consumed per month; turns-to-clear restates
    that against the site's own turn rate. The stuck figure never clears at any
    turn rate, which is why it is reported separately rather than averaged in."""
    site = q("""SELECT excess_value, clearing_value, stuck_value,
                       monthly_burn, months_to_clear, site_turns, turns_to_clear
                FROM [plan].v_excess_burndown""")[0]
    proj = q("""SELECT month_offset, SUM(excess_value_proj) v
                FROM [plan].v_excess_projection GROUP BY month_offset ORDER BY month_offset""")
    return {**{k: float(v) for k, v in site.items()},
            "projected": [{"month_offset": r["month_offset"], "value": float(r["v"] or 0)} for r in proj]}

@app.get("/api/trust/forecast")
def trust_forecast():
    """MAPE + bias by demand class, horizon 1."""
    return q("""SELECT demand_class,
                       AVG(ape_pct) AS mape,
                       CAST(100.0 * SUM(within_band) / COUNT(*) AS decimal(5,1)) AS band_hit_pct
                FROM [plan].v_forecast_accuracy
                WHERE horizon_wk = 1
                GROUP BY demand_class ORDER BY demand_class""")

@app.get("/api/item/{item_no}")
def item_detail(item_no: str):
    """The dossier. One item, everything a planner needs to defend a decision."""
    detail = q("""SELECT * FROM dbo.v_plan_item_detail WHERE item_no = ?""", (item_no,))
    if not detail:
        raise HTTPException(404, "item not found")
    supply = q("""SELECT supply_seq, supply_source, supply_dt, supply_qty
                  FROM [plan].promise_supply_events
                  WHERE item_no = ? ORDER BY supply_seq""", (item_no,))
    return {"detail": detail[0], "supply": supply}

@app.get("/api/planners")
def planners():
    """Distinct planner codes; feeds the planner filter control."""
    return q("""SELECT DISTINCT planner FROM dbo.v_plan_item_detail
                WHERE planner IS NOT NULL AND LTRIM(RTRIM(planner)) <> ''
                ORDER BY planner""")

@app.get("/api/planner/{planner}/items")
def planner_items(planner: str, limit: int = 6):
    """Top items for one planner by value on hand; feeds the multi-item
    position walk on the PLAN page."""
    return q("""SELECT TOP (?) item_no, item_desc_1, value_on_hand
                FROM dbo.v_plan_item_detail
                WHERE planner = ? ORDER BY value_on_hand DESC""", (limit, planner))

@app.get("/api/promise/{item_no}/bom")
def promise_bom(item_no: str):
    """Level-1 BOM for the promise-page kit calculator: each component with
    on-hand, inbound supply, and lead time so the frontend can compute a
    material-ready date for any quantity.
    NOTE: is_optional is 0 for engineered BOMs; when kit orders (imkitfil)
    are wired in, map the kit component optional flag here."""
    return q("""SELECT b.component_item, d.item_desc_1,
                       b.cum_qty_per AS qty_per, 0 AS is_optional,
                       d.qty_on_hand_net AS qty_on_hand,
                       ISNULL(po.on_order_qty, 0) AS on_order_qty, po.next_receipt_dt,
                       d.lead_working_days, d.unit_cost
                FROM [plan].bom_explosion_flat b
                JOIN dbo.v_plan_item_detail d ON d.item_no = b.component_item
                OUTER APPLY (SELECT SUM(p.qty_open) AS on_order_qty,
                                    MIN(p.promise_dt) AS next_receipt_dt
                             FROM dbo.v_plan_open_po p
                             WHERE p.item_no = b.component_item) po
                WHERE b.parent_item = ? AND b.bom_level = 1
                ORDER BY d.unit_cost * b.cum_qty_per DESC""", (item_no,))

@app.get("/api/items/search")
def items_search(query: str, limit: int = 12):
    """Autocomplete over the item dimension."""
    like = f"%{query.strip()}%"
    return q("""SELECT TOP (?) LTRIM(RTRIM(item_no)) AS item_no,
                       LTRIM(RTRIM(item_desc_1)) AS item_desc_1
                FROM dbo.imitmidx_sql
                WHERE item_no LIKE ? OR item_desc_1 LIKE ?
                ORDER BY item_no""", (limit, like, like))

@app.get("/api/promise/{item_no}")
def promise(item_no: str):
    """The ATP/CTP promise ladder with explanation sentences: the
    sales-facing capability. plan.v_promise, verified columns."""
    rows = q("""SELECT item_no, item_desc_1, pur_or_mfg, ladder_seq,
                       promised_dt, material_ready_dt, atp_qty, promise_mode,
                       explanation, qty_overdue_excluded, qty_blanket_excluded
                FROM [plan].v_promise
                WHERE item_no = ? ORDER BY ladder_seq""", (item_no,))
    if not rows:
        raise HTTPException(404, "no promise ladder for this item")
    return rows

@app.get("/api/plan/orders")
def plan_orders(planner: str | None = None):
    """Predicted order calendar: week x vendor, REORDER vs DATED, plus the
    beyond-horizon bucket (order_wk IS NULL) where far-out DATED
    commitments live. Optional planner filter for the Plan-page calendar."""
    pl = "AND pf.planner = ?" if planner else ""
    p = (planner,) if planner else ()
    return q(f"""SELECT po.order_wk, po.order_dt, po.receipt_dt, po.order_type,
                       LTRIM(RTRIM(po.item_no)) AS item_no,
                       ISNULL(pf.primary_vendor_name,'(no vendor)') AS vendor,
                       po.order_qty, po.order_value
                FROM [plan].predicted_orders po
                LEFT JOIN dbo.v_pfep pf ON pf.item_no = po.item_no
                WHERE 1=1 {pl}
                ORDER BY po.order_dt""", p)

@app.get("/api/money/excess_items")
def money_excess_items(month_offset: int | None = None, band: str | None = None, limit: int = 50):
    """The names behind the numbers. month_offset 1-3 = projected list; omitted =
    current excess from the live exec view. band is CLEARING or STUCK."""
    if month_offset:
        t = "AND excess_band_proj = ?" if band else ""
        p = (month_offset,) + ((band,) if band else ()) + (limit,)
        return q(f"""SELECT item_no, item_desc_1, weeks_to_clear,
                            projected_qty, unit_cost, excess_value_proj AS excess_value
                     FROM [plan].v_excess_projection
                     WHERE month_offset = ? {t}
                     ORDER BY excess_value_proj DESC
                     OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY""", p)
    t = "AND e.excess_band = ?" if band else ""
    p = ((band,) if band else ()) + (limit,)
    # NOTE (July 2026): v_exec_inventory_item was slimmed for the PBI model -
    # item_desc_1 / planner / qty_on_hand_net moved off it; join item_detail.
    return q(f"""SELECT e.item_no, d.item_desc_1, d.planner, e.weeks_to_clear,
                        d.qty_on_hand_net, e.value_on_hand, e.excess_value
                 FROM dbo.v_exec_inventory_item e
                 JOIN dbo.v_plan_item_detail d ON d.item_no = e.item_no
                 WHERE e.excess_value > 0 {t}
                 ORDER BY e.excess_value DESC
                 OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY""", p)

@app.get("/api/money/level_review")
def money_level_review(limit: int = 15):
    """The program ROI figure: net dollar effect of adopting calculated
    stock levels, with the top movers each direction."""
    total = q("SELECT SUM(inv_dollar_delta) v FROM [plan].v_stock_level_review")
    movers = q("""SELECT TOP (?) item_no, item_desc_1, inv_dollar_delta
                  FROM [plan].v_stock_level_review
                  WHERE inv_dollar_delta IS NOT NULL
                  ORDER BY ABS(inv_dollar_delta) DESC""", (limit,))
    return {"net_delta": float(total[0]["v"] or 0), "top_movers": movers}

@app.get("/api/trust/health")
def trust_health():
    """Data-health tiles from the PFEP flags. The rollout insurance policy:
    a new site's first look should be its own master-data score."""
    counts = q("""SELECT SUM(flag_no_vendor)            AS no_vendor,
                         SUM(flag_no_lead_time)         AS no_lead_time,
                         SUM(flag_no_calc_params)       AS no_calc_params,
                         SUM(flag_no_demand_with_stock) AS no_demand_with_stock
                  FROM dbo.v_pfep""")
    return counts[0]

@app.get("/api/trust/health/{flag}")
def trust_health_items(flag: str, limit: int = 50):
    allowed = {"no_vendor":"flag_no_vendor","no_lead_time":"flag_no_lead_time",
               "no_calc_params":"flag_no_calc_params",
               "no_demand_with_stock":"flag_no_demand_with_stock"}
    col = allowed.get(flag)
    if not col: raise HTTPException(400, f"flag must be one of {list(allowed)}")
    return q(f"""SELECT TOP (?) item_no, item_desc_1, planner, value_on_hand
                 FROM dbo.v_pfep WHERE {col} = 1
                 ORDER BY value_on_hand DESC""", (limit,))

@app.get("/api/item/{item_no}/forecast")
def item_forecast(item_no: str):
    """26 weeks actual + 13 weeks forecast with confidence band: the chart
    plan.v_forecast_chart was built for."""
    return q("""SELECT * FROM [plan].v_forecast_chart
                WHERE item_no = ? ORDER BY week_start""", (item_no,))

@app.get("/api/suppliers")
def suppliers(limit: int = 40):
    """Supplier scorecard: OTD, fill rate, OTIF, grade, spend, exposure.
    SELECT * deliberately: the view is wide and the frontend picks fields
    with fallbacks, so a renamed column degrades a cell instead of a page."""
    return q("""SELECT TOP (?) * FROM dbo.v_supplier_scorecard
                ORDER BY annual_spend DESC""", (limit,))

@app.get("/api/suppliers/{vend_no}/receipts")
def supplier_receipts(vend_no: str, limit: int = 40):
    """Recent receipt lines for one vendor - the evidence behind the grade."""
    return q("""SELECT TOP (?) * FROM dbo.v_supplier_receipts
                WHERE vend_no = ? ORDER BY rec_hst_dt DESC""", (limit, vend_no))

@app.get("/api/suppliers/{vend_no}/open")
def supplier_open_pos(vend_no: str, limit: int = 25):
    """Open (not yet fully received) PO lines for one vendor, worst-overdue
    first - the confirm/expedite worklist behind the scorecard's overdue
    count. Backs the 'Email order status' composer on the supplier drill."""
    return q("""SELECT TOP (?) ord_no, line_no, item_no, item_desc_1,
                       qty_remaining, promise_dt, days_overdue, open_value,
                       recommended_action
                FROM dbo.v_plan_open_po
                WHERE vend_no = ? ORDER BY days_overdue DESC, promise_dt""", (limit, vend_no))

@app.get("/api/build")
def build(status: str | None = None, limit: int = 80):
    """The full FIFO build list - releasable AND blocked, not just the
    exceptions the ACT queue shows. status filter: 'blocked' | 'ready'."""
    w = ""
    if status == "blocked": w = "WHERE build_status LIKE 'BLOCKED%'"
    elif status == "ready": w = "WHERE build_status NOT LIKE 'BLOCKED%'"
    return q(f"""SELECT TOP (?) line_key, ord_no, line_no, due_dt, item_no, item_desc_1,
                        cus_no, planner, qty_open, qty_from_stock, build_qty,
                        build_status, status_sort, material_complete_dt,
                        schedule_start_dt, est_build_done_dt,
                        gating_component, gating_source, planner_note
                 FROM [plan].v_build_readiness {w}
                 ORDER BY status_sort, due_dt""", (limit,))

@app.get("/api/plan/sourcing_risk")
def sourcing_risk(limit: int = 25, planner: str | None = None):
    """Sole-source items ranked by annual value - the supply-risk register.
    Optional planner filter, matching the rest of the Plan page."""
    pl = "AND planner = ?" if planner else ""
    p = (planner,) if planner else ()
    return q(f"""SELECT TOP (?) item_no, item_desc_1, abc_class, annual_value,
                       vend_name, vendor_lead_days, last_price_paid
                FROM dbo.v_sourcing_item_vendor
                WHERE is_sole_source = 1 AND is_pipeline_primary = 1 {pl}
                ORDER BY annual_value DESC""", (limit,) + p)

@app.get("/api/trust/segmentation")
def segmentation():
    """ABC x XYZ matrix: item count and annual value per cell - the policy,
    made visible."""
    return q("""SELECT abc_class, xyz_class, COUNT(*) AS item_ct,
                       SUM(annual_value) AS annual_value
                FROM [plan].item_abc_xyz
                GROUP BY abc_class, xyz_class""")

@app.get("/api/trust/config")
def config():
    """The assumptions register: every tunable the pipeline runs on, with
    its documentation. Deterministic arithmetic on committed rules -
    productized."""
    return q("""SELECT param_name, param_value, notes
                FROM [plan].config_params ORDER BY param_name""")

# =====================================================================
#  ENGINE ADDITIONS (July 2026): endpoints for the data layer that arrived
#  with the engine restructure. Same read-only rules.
# =====================================================================

@app.get("/api/refresh")
def refresh_status():
    """HONEST freshness for the top bar: last successful run per orchestrator
    from plan.refresh_log (SUCCESS-WARN = data built, validation flagged).
    Replaces the frontend's old hardcoded 'Pipeline refreshed' text."""
    rows = q("""SELECT job_name, MAX(finished_dt) AS last_ok
                FROM [plan].refresh_log
                WHERE status IN ('SUCCESS','SUCCESS-WARN')
                  AND job_name IN ('usp_refresh_weekly','usp_refresh_frequent')
                GROUP BY job_name""")
    out = {"weekly": None, "frequent": None}
    for r in rows:
        key = "weekly" if "weekly" in str(r["job_name"]) else "frequent"
        out[key] = str(r["last_ok"]) if r["last_ok"] else None
    return out

@app.get("/api/trust/validation")
def trust_validation():
    """Latest run of the standing-invariant harness (plan.usp_validate)."""
    return q("""SELECT scope, check_name, severity, failed_rows, passed, checked_dt
                FROM [plan].validation_log
                WHERE checked_dt = (SELECT MAX(checked_dt) FROM [plan].validation_log)
                ORDER BY passed ASC, CASE severity WHEN 'ERROR' THEN 0 ELSE 1 END, check_name""")

@app.get("/api/trust/runs")
def trust_runs(limit: int = 30):
    """Refresh run history: umbrella + per-domain rows, newest first."""
    return q("""SELECT TOP (?) log_id, job_name, started_dt, finished_dt, status,
                       DATEDIFF(SECOND, started_dt, finished_dt) AS secs, error_msg
                FROM [plan].refresh_log ORDER BY log_id DESC""", (limit,))

@app.get("/api/trust/glossary")
def trust_glossary():
    """Plain-language definitions of every classification code (tooltips)."""
    return q("""SELECT code_type, code, name, description
                FROM [plan].classification_glossary ORDER BY code_type, code""")

@app.get("/api/build/components")
def build_components(line_key: str):
    """Component-grain detail for one build line: the BOM exploder. Same FIFO
    allocation the line statuses derive from, so the two can never disagree.
    Keyed on line_key (ord_type-ord_no-line_no), the star-schema build-line id."""
    return q("""SELECT component_item, component_desc, comp_role, comp_status,
                       comp_status_sort, qty_per_parent, comp_need, cum_comp_need,
                       covered_dt, covered_source, is_blocked,
                       qty_on_hand_net, qty_available, qty_on_order,
                       lead_working_days, primary_vendor_name, need_value,
                       component_stock_status
                FROM [plan].v_build_readiness_detail
                WHERE line_key = ?
                ORDER BY comp_status_sort, need_value DESC""", (line_key,))

@app.get("/api/bom/{item_no}/where_used")
def bom_where_used(item_no: str):
    """Every parent/FG that consumes this component, with level and qty-per.
    The question engineering asks most: 'if this part changes, what's hit?'"""
    return q("""SELECT LTRIM(RTRIM(e.source_fg)) AS source_fg,
                       LTRIM(RTRIM(e.parent_item)) AS parent_item,
                       LTRIM(RTRIM(im.item_desc_1)) AS parent_desc,
                       e.bom_level, e.cum_qty_per
                FROM [plan].bom_explosion_flat e
                LEFT JOIN dbo.imitmidx_sql im ON im.item_no = e.source_fg
                WHERE e.component_item = ?
                ORDER BY e.source_fg, e.bom_level""", (item_no,))

@app.get("/api/bom/{item_no}/explode")
def bom_explode(item_no: str):
    """Full multi-level explosion of one item (indented-BOM data)."""
    return q("""SELECT LTRIM(RTRIM(e.parent_item)) AS parent_item,
                       LTRIM(RTRIM(e.component_item)) AS component_item,
                       LTRIM(RTRIM(im.item_desc_1)) AS component_desc,
                       e.bom_level, e.cum_qty_per
                FROM [plan].bom_explosion_flat e
                LEFT JOIN dbo.imitmidx_sql im ON im.item_no = e.component_item
                WHERE e.source_fg = ?
                ORDER BY e.bom_level, e.parent_item, e.component_item""", (item_no,))

@app.get("/api/suppliers/todo")
def suppliers_todo():
    """RED/YELLOW/GREEN vendor action list with the reason sentence."""
    return q("""SELECT vend_no, vend_name, annual_spend, items_supplied,
                       sole_source_items, otd_pct_12mo, otif_pct_12mo,
                       ppv_pct_12mo, lead_delta_days, action_status, action_reason
                FROM dbo.v_supplier_todo
                ORDER BY CASE action_status WHEN 'RED' THEN 1
                                            WHEN 'YELLOW' THEN 2 ELSE 3 END,
                         annual_spend DESC""")

@app.get("/api/suppliers/{vend_no}/leadtime")
def supplier_leadtime(vend_no: str):
    """Stated vs actual lead time (12-mo receipts) + update flag."""
    return q("""SELECT vend_no, vend_name, receipt_lines_12mo,
                       stated_lead_cal_avg, actual_lead_cal_avg, lead_delta_days,
                       actual_lead_last3mo, actual_lead_prior9mo, flag_update_lead_time
                FROM dbo.v_supplier_leadtime WHERE vend_no = ?""", (vend_no,))

@app.get("/api/orders/blankets")
def orders_blankets():
    """Unreleased blanket balances: supply on contract that needs a RELEASE
    scheduled, not a new PO (netted into reorder suggestions since July 2026)."""
    return q("""SELECT blanket_po, item_no, item_desc_1, vend_no, vend_name,
                       blanket_dt, blanket_total_qty, released_total_qty,
                       release_count, blanket_balance_remaining, supply_tier
                FROM dbo.v_blanket_position
                ORDER BY blanket_balance_remaining DESC""")

@app.get("/api/orders/blanket_candidates")
def orders_blanket_candidates(limit: int = 25):
    """Steady sole-source items that should be on a blanket but aren't."""
    return q("""SELECT TOP (?) item_no, item_desc_1, planner, primary_vendor_name,
                       demand_class, xyz_class, demand_per_week,
                       suggested_blanket_qty, suggested_release_qty,
                       release_every_n_weeks, six_month_value
                FROM dbo.v_blanket_candidates
                ORDER BY six_month_value DESC""", (limit,))

@app.get("/api/orders/shelf_life")
def orders_shelf_life():
    """Shelf-life/MOQ conflicts + AIR-ONLY register (open ocean PO = problem)."""
    return q("""SELECT item_no, item_desc_1, planner, shelf_life_days,
                       shelf_life_cap_qty, moq, shelf_moq_conflict, air_only,
                       ocean_po_lines_open, primary_vendor_name
                FROM dbo.v_shelf_life_exceptions
                WHERE shelf_moq_conflict = 1 OR air_only = 1
                ORDER BY ocean_po_lines_open DESC, shelf_moq_conflict DESC""")

@app.get("/api/orders/pallets")
def orders_pallets():
    """Projected pallets vs warehouse cap (0 rows until item_pallet_qty loads)."""
    return q("""SELECT item_no, item_desc_1, pallet_qty, pallets_on_hand,
                       pallets_on_order, pallets_projected, total_projected,
                       pallet_cap, capacity_used_pct, over_capacity
                FROM dbo.v_pallet_capacity ORDER BY pallets_projected DESC""")

@app.get("/api/plan/workload")
def plan_workload():
    """Per-planner workload: where the work (and the trouble) sits. Aggregated
    live from the reporting views (the removed v_planner_workload did the same
    roll-up; Power BI now folds this into dim_item via DAX measures)."""
    return q("""SELECT COALESCE(po.planner, rs.planner, br.planner) AS planner,
                       ISNULL(po.open_po_lines, 0)          AS open_po_lines,
                       ISNULL(po.open_po_value, 0)          AS open_po_value,
                       ISNULL(po.overdue_po_lines, 0)       AS overdue_po_lines,
                       ISNULL(rs.open_order_suggestions, 0) AS open_order_suggestions,
                       ISNULL(rs.suggestion_value, 0)       AS suggestion_value,
                       ISNULL(br.blocked_builds, 0)         AS blocked_builds
                FROM (SELECT planner, COUNT(*) AS open_po_lines,
                             SUM(open_value) AS open_po_value,
                             SUM(is_overdue) AS overdue_po_lines
                      FROM dbo.v_plan_open_po GROUP BY planner) po
                FULL JOIN (SELECT planner, COUNT(*) AS open_order_suggestions,
                                  SUM(suggested_order_value) AS suggestion_value
                           FROM dbo.v_plan_reorder_suggestion GROUP BY planner) rs
                       ON rs.planner = po.planner
                FULL JOIN (SELECT planner, COUNT(*) AS blocked_builds
                           FROM [plan].v_build_readiness
                           WHERE build_status LIKE 'BLOCKED%' GROUP BY planner) br
                       ON br.planner = COALESCE(po.planner, rs.planner)
                ORDER BY open_po_value DESC""")

@app.get("/api/item/{item_no}/locations")
def item_locations(item_no: str):
    """Where the stock physically sits + Orbit param-exception audit flags."""
    return q("""SELECT loc, loc_status, is_nettable, qty_on_hand, qty_allocated,
                       qty_available, qty_on_order, param_exception
                FROM dbo.v_fact_inventory
                WHERE item_no = ? ORDER BY qty_on_hand DESC""", (item_no,))

# ---- static frontend (explicit routes; nothing else in this folder is
#      exposed over HTTP: the SQL and Python sources stay private) ----------
_BASE = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
def root():
    return FileResponse(os.path.join(_BASE, "index.html"))

def _asset(filename: str):
    path = os.path.join(_BASE, filename)
    if not os.path.isfile(path):
        # missing brand asset shouldn't 500 the whole request - the frontend
        # already falls back to a text wordmark on image load error
        raise HTTPException(404, f"{filename} not found in {_BASE}")
    return FileResponse(path)

@app.get("/axim-white.svg")
def logo_white():
    return _asset("axim-white.svg")

@app.get("/axim-blue.svg")
def logo_blue():
    return _asset("axim-blue.svg")
