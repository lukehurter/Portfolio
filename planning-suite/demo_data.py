"""
Axim Planning Analytics: demo dataset
=========================================
Activated with PA_DEMO=1. Replaces the SQL layer with an in-memory dataset, so
the full application runs with no database, no ODBC driver, and no network: a
laptop demo and an IT-evaluation build in one.

The dataset is coherent: the same twelve Axim-flavored items flow through
every endpoint, so clicking a part in the ACT queue, looking it up in
PROMISE, and finding it in the excess list all tell one consistent story.
Numbers are seeded-random per item (deterministic across restarts).

Dispatcher design: demo_q(sql, params) matches the same SQL fragments the
real endpoints send, so app.py needs zero endpoint changes. The swap happens
at the q() layer only.
"""

import random
from datetime import date, timedelta

TODAY = date.today()
def _monday(d): return d - timedelta(days=d.weekday())
WK1 = _monday(TODAY) + timedelta(days=7)          # horizon week 1 start
def wk_start(w): return WK1 + timedelta(weeks=w - 1)
def month_start(offset=0):
    m = TODAY.month - 1 + offset
    return date(TODAY.year + m // 12, m % 12 + 1, 1)
def iso(d): return d.isoformat()

# ----------------------------------------------------------------------------
# The cast: twelve items, Axim-flavored, with planning state
# ----------------------------------------------------------------------------
ITEMS = {
 "1150-BLK":  dict(desc="Black pigment ink · 825 ml cartridge", pm="P", abc="A", xyz="X", dcls="SMOOTH",
                   oh=340, pos=210, rop=180, s=820, ss=95, bin_qty=320, cost=14.00, lead=12,
                   vendor="Halton Inks", planner="Luke Carver"),
 "INK-1265Y": dict(desc="Yellow dye ink · 500 ml", pm="P", abc="B", xyz="Y", dcls="ERRATIC",
                   oh=64, pos=20, rop=45, s=180, ss=28, bin_qty=90, cost=33.00, lead=14,
                   vendor="Halton Inks", planner="Luke Carver"),
 "2600223":   dict(desc="Printhead assembly · 32-valve", pm="M", abc="A", xyz="Y", dcls="ERRATIC",
                   oh=15, pos=1, rop=8, s=24, ss=4, bin_qty=8, cost=1220.00, lead=35,
                   vendor="Verity Dispensing", planner="Dana Whitfield"),
 "400001PPM": dict(desc="Make-up fluid · MEK base · 1 L", pm="P", abc="B", xyz="X", dcls="SMOOTH",
                   oh=4, pos=4, rop=60, s=220, ss=32, bin_qty=96, cost=24.00, lead=8,
                   vendor="Brightwater Fluids", planner="Luke Carver"),
 "TTO-33110": dict(desc="Thermal transfer ribbon · 33 mm × 1100 m", pm="P", abc="A", xyz="X", dcls="SMOOTH",
                   oh=88, pos=52, rop=70, s=260, ss=36, bin_qty=110, cost=45.00, lead=15,
                   vendor="Cascade Ribbon", planner="Priya Nair"),
 "FLT-2200":  dict(desc="Inline filter kit · 5 µm", pm="P", abc="C", xyz="Z", dcls="LUMPY",
                   oh=210, pos=210, rop=40, s=120, ss=18, bin_qty=50, cost=29.00, lead=10,
                   vendor="Verity Dispensing", planner="Luke Carver"),
 "SOL-9040":  dict(desc="Cleaning solvent · 5 L", pm="P", abc="B", xyz="Y", dcls="ERRATIC",
                   oh=22, pos=14, rop=30, s=110, ss=15, bin_qty=48, cost=18.50, lead=9,
                   vendor="Brightwater Fluids", planner="Priya Nair"),
 "CAP-118":   dict(desc="Sealing cap · nozzle assembly", pm="P", abc="B", xyz="Z", dcls="LUMPY",
                   oh=95, pos=60, rop=80, s=300, ss=40, bin_qty=120, cost=6.40, lead=20,
                   vendor="Precision Molding Co", planner="Dana Whitfield"),
 "BRK-770":   dict(desc="Mounting bracket · stainless", pm="P", abc="C", xyz="Z", dcls="INTERMITTENT",
                   oh=140, pos=140, rop=12, s=40, ss=6, bin_qty=20, cost=24.40, lead=18,
                   vendor="Precision Molding Co", planner="Priya Nair"),
 "GSK-42":    dict(desc="Gasket set · printhead service", pm="P", abc="C", xyz="Y", dcls="LUMPY",
                   oh=0, pos=180, rop=50, s=200, ss=25, bin_qty=80, cost=11.20, lead=12,
                   vendor="Verity Dispensing", planner="Dana Whitfield"),
 "OBS-3310":  dict(desc="Legacy encoder wheel · IJ3000", pm="P", abc="C", xyz="Z", dcls="INTERMITTENT",
                   oh=64, pos=64, rop=None, s=None, ss=0, bin_qty=0, cost=88.00, lead=30,
                   vendor="(discontinued)", planner="Luke Carver"),
 "RES-5000K": dict(desc="Ridgeline 3200 maintenance kit", pm="M", abc="A", xyz="Y", dcls="ERRATIC",
                   oh=12, pos=9, rop=10, s=36, ss=5, bin_qty=12, cost=310.00, lead=25,
                   vendor="Axim Ashfield", planner="Dana Whitfield"),
}

def _rng(item): return random.Random(item)  # deterministic per item

# vendor MOQ / order multiple (stocking UOM) - mirrors plan.vendor_params
MOQ_MULT = {"1150-BLK":(200,40), "INK-1265Y":(60,30), "2600223":(1,1), "400001PPM":(48,12),
            "TTO-33110":(60,20), "FLT-2200":(25,25), "SOL-9040":(24,12), "CAP-118":(120,60),
            "BRK-770":(20,10), "GSK-42":(80,40), "OBS-3310":(0,0), "RES-5000K":(1,1)}

def _eoq(item):
    """Wilson formula, same K/h as plan.config_params (eoq_order_cost=50, holding=25%)."""
    it = ITEMS[item]
    weekly = max(1.0, ((it["s"] or 100) - (it["rop"] or 0)) / 5.0)
    annual = weekly * 52
    return round((2 * annual * 50.0 / (0.25 * it["cost"])) ** 0.5)

# ---- simulation strips (position + on-hand walk, 13 weeks) -----------------
def strip(item):
    it = ITEMS[item]; r = _rng(item)
    pos, oh = float(it["pos"]), float(it["oh"])
    rop = it["rop"] or 0; s = it["s"] or max(oh, pos, 1)
    weekly = max(1.0, (s - rop) / 5.0)
    rows = [dict(horizon_wk=0, week_start=iso(TODAY), position=round(pos,1), qty_on_hand=round(oh,1))]
    for w in range(1, 14):
        dep = max(0.0, weekly * (0.6 + 0.8 * r.random()))
        pos -= dep; oh = max(0.0, oh - dep)
        if it["rop"] is not None and pos <= rop:            # reorder trigger
            qty = max(s - pos, it["bin_qty"]); pos += qty
        if w in (4, 9) and r.random() < 0.6:                 # receipts land
            oh += it["bin_qty"] * (0.8 + 0.4 * r.random())
        rows.append(dict(horizon_wk=w, week_start=iso(wk_start(w)),
                         position=round(pos,1), qty_on_hand=round(oh,1)))
    return rows

STRIPS = {k: strip(k) for k in ITEMS}

# ---- ACT queue --------------------------------------------------------------
QUEUE = [
 dict(action_type="EXPEDITE", item_no="INK-1265Y", impact=18200.0, due=-3,
      instruction="EXPEDITE PO 41755 (3d overdue)", badge="EXPEDITE"),
 dict(action_type="ORDER", item_no="400001PPM", impact=5184.0, due=2,
      instruction="Place 216 @ Brightwater Fluids", badge="1 - URGENT (stockout)"),
 dict(action_type="BLOCKED", item_no="2600223", impact=19520.0, due=11,
      instruction="Build 16 - gated by GSK-42", badge="BLOCKED - NO INBOUND SUPPLY"),
 dict(action_type="ORDER", item_no="SOL-9040", impact=1776.0, due=5,
      instruction="Place 96 @ Brightwater Fluids", badge="2 - HIGH (below safety)"),
 dict(action_type="ORDER", item_no="TTO-33110", impact=8100.0, due=17,
      instruction="Place 180 @ Cascade Ribbon", badge="3 - REORDER"),
 dict(action_type="EXPEDITE", item_no="CAP-118", impact=1920.0, due=-8,
      instruction="EXPEDITE PO 41710 (8d overdue)", badge="EXPEDITE"),
 dict(action_type="ORDER", item_no="RES-5000K", impact=11160.0, due=25,
      instruction="Place 36 @ Axim Ashfield", badge="3 - REORDER"),
 dict(action_type="DEFER", item_no="FLT-2200", impact=4930.0, due=None,
      instruction="DEFER PO 41733 - covered 9 wks", badge="DEFER"),
 dict(action_type="REVIEW", item_no="BRK-770", impact=2440.0, due=None,
      instruction="REVIEW / CANCEL PO 41699 - no demand", badge="REVIEW / CANCEL - no demand"),
 dict(action_type="ORDER", item_no="GSK-42", impact=2016.0, due=9,
      instruction="Place 180 @ Verity Dispensing", badge="3 - REORDER"),
]

# ---- promise ladders ---------------------------------------------------------
def ladder(item):
    it = ITEMS[item]
    rows, seq = [], 1
    if it["oh"] > 0:
        rows.append(dict(ladder_seq=seq, promised_dt=iso(TODAY + timedelta(days=1)),
            material_ready_dt=iso(TODAY), atp_qty=it["oh"], promise_mode="FROM STOCK",
            explanation=f"{it['oh']} available from nettable stock now; ships next working day.")); seq += 1
    rows.append(dict(ladder_seq=seq, promised_dt=iso(wk_start(4) + timedelta(days=2)),
        material_ready_dt=iso(wk_start(4)), atp_qty=it["bin_qty"] or 50, promise_mode="OPEN PO",
        explanation=f"Covered by PO 418{seq}2 promised {wk_start(4).strftime('%b %d')} from {it['vendor']}.")); seq += 1
    lead_dt = TODAY + timedelta(days=int(it["lead"] * 7 / 5) + 3)
    rows.append(dict(ladder_seq=seq, promised_dt=iso(lead_dt + timedelta(days=2)),
        material_ready_dt=iso(lead_dt), atp_qty=it["s"] or 100, promise_mode="ESTIMATE (LEAD TIME)",
        explanation=f"Beyond committed supply: estimated from {it['lead']} working-day vendor lead time - no PO exists yet."))
    common = dict(item_no=item, item_desc_1=it["desc"], pur_or_mfg=it["pm"],
                  qty_overdue_excluded=120 if item == "INK-1265Y" else 0,
                  qty_blanket_excluded=500 if item == "1150-BLK" else 0)
    return [dict(**common, **r) for r in rows]

# ---- predicted orders (REORDER + DATED, incl. beyond horizon) ----------------
PREDICTED = []
for item, wks in [("1150-BLK",[4,11]),("TTO-33110",[2,8]),("SOL-9040",[1,7]),
                  ("400001PPM",[1]),("INK-1265Y",[3,10]),("GSK-42",[2]),
                  ("CAP-118",[5]),("RES-5000K",[6])]:
    it = ITEMS[item]
    for w in wks:
        qty = it["bin_qty"] or 40
        PREDICTED.append(dict(order_wk=w, order_dt=iso(wk_start(w)),
            receipt_dt=iso(wk_start(w + max(1, round(it["lead"]/5)))),
            order_type="REORDER", item_no=item, vendor=it["vendor"],
            order_qty=qty, order_value=round(qty * it["cost"], 2)))
# the year-out spike: DATED, released beyond the horizon
PREDICTED.append(dict(order_wk=None, order_dt=iso(TODAY + timedelta(weeks=44)),
    receipt_dt=iso(TODAY + timedelta(weeks=52)), order_type="DATED", item_no="1150-BLK",
    vendor="Halton Inks", order_qty=10000, order_value=140000.0))
# a nearer DATED spike inside the horizon
PREDICTED.append(dict(order_wk=6, order_dt=iso(wk_start(6)), receipt_dt=iso(wk_start(9)),
    order_type="DATED", item_no="2600223", vendor="Verity Dispensing",
    order_qty=16, order_value=19520.0))

# ---- excess inventory: value above order-up-to, and how long it clears --------
#: Excess is on-hand above the order-up-to level. Weeks-to-clear divides it by
#: current weekly demand, so an item with no demand reports None and reads as
#: "never clears" instead of carrying a tier label somebody has to interpret.
def _excess(it):
    S = it["s"]
    if S is None:                                    # no policy and no demand
        return it["oh"], round(it["oh"] * it["cost"], 2), None
    qty = max(0, it["oh"] - S)
    weekly = max(0.0, (S - (it["rop"] or 0)) / 5.0)
    return qty, round(qty * it["cost"], 2), (None if weekly <= 0 else round(qty / weekly, 1))

def _excess_row(k, v):
    qty, val, wks = _excess(v)
    return dict(item_no=k, item_desc_1=v["desc"], planner=v["planner"],
                qty_on_hand_net=v["oh"], value_on_hand=round(v["oh"] * v["cost"], 2),
                excess_qty=qty, excess_value=val, weeks_to_clear=wks)

def _band(r):
    """Two bands in place of the old tier labels: excess that demand will consume,
    and excess it will not. The second is the one worth a meeting."""
    return "STUCK" if r.get("weeks_to_clear") is None else "CLEARING"

EXCESS_CURRENT = [r for r in (_excess_row(k, v) for k, v in ITEMS.items())
                  if r["excess_value"] > 0]
CUR_EXCESS_TOTAL = round(sum(r["excess_value"] for r in EXCESS_CURRENT), 2)

#: Projection: excess burns down at each item's own demand rate. Items with no
#: demand stay flat, which is the reason to draw the curve at all.
PROJ_NEW = {1: [], 2: [("SOL-9040", 40)], 3: [("CAP-118", 55)]}   # qty tipping into excess

def _weeks(it, qty):
    weekly = max(0.0, ((it["s"] or 0) - (it["rop"] or 0)) / 5.0)
    return None if weekly <= 0 else round(qty / weekly, 1)

def excess_projection(mo):
    rows = []
    for r in EXCESS_CURRENT:
        it, wks = ITEMS[r["item_no"]], r["weeks_to_clear"]
        if wks is None:
            qty = r["excess_qty"]                     # never clears
        else:
            qty = max(0, round(r["excess_qty"] - (r["excess_qty"] / wks) * 4.33 * mo))
        rows.append(dict(item_no=r["item_no"], item_desc_1=it["desc"], projected_qty=qty,
                         unit_cost=it["cost"], excess_value=round(qty * it["cost"], 2),
                         weeks_to_clear=wks))
    for m in range(1, mo + 1):
        for item, qty in PROJ_NEW[m]:
            it = ITEMS[item]
            rows.append(dict(item_no=item, item_desc_1=it["desc"], projected_qty=qty,
                             unit_cost=it["cost"], excess_value=round(qty * it["cost"], 2),
                             weeks_to_clear=_weeks(it, qty)))
    return [r for r in rows if r["excess_value"] > 0]

#: Site-level burn-down. Months-to-clear divides the excess that has demand behind
#: it by the value consumed per month; turns-to-clear restates that against the
#: site's own turn rate, so "8.5 months" also reads as "3.4 turns". The stuck half
#: never clears at any turn rate, which is why it is carried separately.
EXCESS_SITE = dict(
    excess_value   = round(CUR_EXCESS_TOTAL + 1152000.0, 2),
    clearing_value = round(sum(r["excess_value"] for r in EXCESS_CURRENT
                               if r["weeks_to_clear"] is not None) + 690000.0, 2),
    monthly_burn   = 82000.0,
    site_turns     = 4.8,
)
EXCESS_SITE["stuck_value"]     = round(EXCESS_SITE["excess_value"] - EXCESS_SITE["clearing_value"], 2)
EXCESS_SITE["months_to_clear"] = round(EXCESS_SITE["clearing_value"] / EXCESS_SITE["monthly_burn"], 1)
EXCESS_SITE["turns_to_clear"]  = round(EXCESS_SITE["months_to_clear"] / (12.0 / EXCESS_SITE["site_turns"]), 1)

#: Site-level curve: the stuck value sits flat underneath while the clearing value
#: burns off at monthly_burn. Item counts come from the item-level projection.
EXCESS_PROJ_TOTALS = [dict(month_start=iso(month_start(m)), month_offset=m,
                           excess_value=round(EXCESS_SITE["stuck_value"]
                                              + max(0.0, EXCESS_SITE["clearing_value"]
                                                    - EXCESS_SITE["monthly_burn"] * m), 2),
                           clearing_ct=sum(1 for r in excess_projection(m) if r["weeks_to_clear"] is not None),
                           stuck_ct=sum(1 for r in excess_projection(m) if r["weeks_to_clear"] is None))
                      for m in (1, 2, 3)]

# ---- spend forecast -----------------------------------------------------------
SPEND = []
for m, known, reo, dated in [(0,182000,86000,19520),(1,148000,112000,64000),(2,91000,118000,72000)]:
    ms = iso(month_start(m))
    SPEND += [dict(month_start=ms, spend_type="KNOWN", spend_amount=known),
              dict(month_start=ms, spend_type="PREDICTED_REORDER", spend_amount=reo),
              dict(month_start=ms, spend_type="PREDICTED_DATED", spend_amount=dated)]

# ---- everything else ------------------------------------------------------------
STOCKOUTS = [dict(item_no=k, first_zero_wk=w, item_desc_1=ITEMS[k]["desc"], lead_working_days=ITEMS[k]["lead"])
             for k, w in [("INK-1265Y",3),("2600223",5),("SOL-9040",7),("CAP-118",9),("1150-BLK",11)]]
# One excess bucket: everything held above the order-up-to level, whether or not
# demand will ever consume it. The split that matters is not slow-vs-obsolete, it
# is clears-vs-never, and that lives in EXCESS_SITE below.
BRIDGE = dict(on_hand=6420000.0, excess=EXCESS_SITE["excess_value"])
LEVEL_REVIEW = dict(net_delta=-310400.0, top_movers=[
    dict(item_no="FLT-2200", item_desc_1=ITEMS["FLT-2200"]["desc"], inv_dollar_delta=-42800.0),
    dict(item_no="1150-BLK", item_desc_1=ITEMS["1150-BLK"]["desc"], inv_dollar_delta=-31200.0),
    dict(item_no="RES-5000K", item_desc_1=ITEMS["RES-5000K"]["desc"], inv_dollar_delta=18400.0),
    dict(item_no="BRK-770", item_desc_1=ITEMS["BRK-770"]["desc"], inv_dollar_delta=-16900.0),
])
FCST_ACC = [dict(demand_class="SMOOTH", mape=18.2, band_hit_pct=84.0),
            dict(demand_class="ERRATIC", mape=41.5, band_hit_pct=80.5),
            dict(demand_class="LUMPY", mape=72.8, band_hit_pct=78.0),
            dict(demand_class="INTERMITTENT", mape=88.1, band_hit_pct=76.0)]
HEALTH = dict(no_vendor=37, no_lead_time=12, no_calc_params=54, no_demand_with_stock=8)
HEALTH_ITEMS = {f: [dict(item_no=k, item_desc_1=v["desc"], planner=v["planner"],
                         value_on_hand=round(v["oh"]*v["cost"],2))
                    for k, v in list(ITEMS.items())[i:i+4]]
                for i, f in enumerate(["no_vendor","no_lead_time","no_calc_params","no_demand_with_stock"])}

def forecast_chart(item):
    it = ITEMS[item]; r = _rng(item + "f")
    base = max(2.0, (it["s"] or 100) / 8.0)
    rows = []
    for w in range(26, 0, -1):
        ws = _monday(TODAY) - timedelta(weeks=w)
        rows.append(dict(item_no=item, week_start=iso(ws),
                         actual_qty=round(max(0, base*(0.5+r.random())),1), fcst_qty=None,
                         fcst_lo=None, fcst_hi=None))
    for w in range(1, 14):
        f = base * (0.7 + 0.5 * r.random()); band = f * 0.35
        rows.append(dict(item_no=item, week_start=iso(wk_start(w)), actual_qty=None,
                         fcst_qty=round(f,1), fcst_lo=round(max(0,f-band),1), fcst_hi=round(f+band,1)))
    return rows

def item_detail_row(item):
    it = ITEMS[item]
    nxt = next((p for p in sorted(PREDICTED, key=lambda x: x["order_dt"]) if p["item_no"]==item), None)
    moq, mult = MOQ_MULT.get(item, (0, 0))
    return dict(item_no=item, item_desc_1=it["desc"], pur_or_mfg=it["pm"], planner=it["planner"],
        abc_class=it["abc"], xyz_class=it["xyz"], demand_class=it["dcls"],
        primary_vendor_name=it["vendor"], lead_working_days=it["lead"], unit_cost=it["cost"],
        qty_on_hand_net=it["oh"], inventory_position=it["pos"],
        calc_safety_stock=it["ss"], calc_reorder_point=it["rop"], calc_order_up_to=it["s"],
        moq=moq, po_mult=mult, calc_eoq=_eoq(item),
        value_on_hand=round(it["oh"]*it["cost"],2), excess_value=_excess(it)[1],
        flag_no_vendor=0, flag_no_lead_time=0, flag_no_calc_params=1 if it["rop"] is None else 0,
        next_predicted_order_dt=nxt and nxt["order_dt"], next_predicted_order_qty=nxt and nxt["order_qty"],
        next_predicted_order_value=nxt and nxt["order_value"], next_predicted_order_type=nxt and nxt["order_type"])

def supply_events(item):
    it = ITEMS[item]
    rows = [dict(supply_seq=1, supply_source="ON HAND", supply_dt=iso(TODAY), supply_qty=it["oh"])]
    if it["rop"] is not None:
        rows.append(dict(supply_seq=2, supply_source="OPEN PO 41822", supply_dt=iso(wk_start(4)),
                         supply_qty=it["bin_qty"] or 40))
    return rows

# ============================================================================
# The dispatcher: matches the SQL fragments app.py sends.
# ============================================================================
def demo_q(sql: str, params: tuple = ()):
    s = " ".join(sql.lower().split())
    P = list(params)

    if "select 1 as ok" in s: return [{"ok": 1}]

    # ---- engine additions (July 2026) - matched FIRST because some of
    # their view names contain older matchers' substrings (e.g.
    # v_build_readiness_detail contains v_build_readiness) ----
    if "refresh_log" in s and "group by job_name" in s: return V2_REFRESH_STATUS
    if "refresh_log" in s: return V2_REFRESH_RUNS[:P[0] if P else 30]
    if "validation_log" in s: return V2_VALIDATION
    if "classification_glossary" in s: return V2_GLOSSARY
    if "v_build_readiness_detail" in s:
        return V2_BUILD_COMPONENTS.get(P[0] if P else "", [])
    if "v_supplier_todo" in s: return V2_SUPPLIER_TODO
    if "v_supplier_leadtime" in s:
        return [r for r in V2_SUPPLIER_LEADTIME if r["vend_no"] == (P[0] if P else None)]
    if "v_blanket_position" in s: return V2_BLANKETS
    if "v_blanket_candidates" in s: return V2_BLANKET_CANDIDATES[:P[0] if P else 25]
    if "v_shelf_life_exceptions" in s: return V2_SHELF_LIFE
    if "v_pallet_capacity" in s: return V2_PALLETS
    if "group by planner" in s: return V2_WORKLOAD
    if "v_fact_inventory" in s: return V2_LOCATIONS.get(P[0] if P else "", [])
    if "component_item = ?" in s:   # BOM where-used (parents of a component)
        return V2_WHERE_USED.get(P[0] if P else "", [])
    if "source_fg = ?" in s:        # BOM full explode-down
        return V2_EXPLODE.get(P[0] if P else "", [])

    # planner filter: app.py appends "AND planner = ?" with planner as first param
    _planner = P[0] if ("and planner" in s and P) else None
    def _byplanner(rows):
        if not _planner: return rows
        return [r for r in rows if ITEMS[r["item_no"]]["planner"] == _planner]

    # ---- ACT ----
    if "v_plan_reorder_suggestion" in s and "count(*)" in s:
        rows = _byplanner([r for r in QUEUE if r["action_type"]=="ORDER"])
        return [dict(n=len(rows), v=sum(r["impact"] for r in rows))]
    if "'expedite'" in s and "count(*)" in s:
        rows = _byplanner([r for r in QUEUE if r["action_type"]=="EXPEDITE"])
        return [dict(n=len(rows), v=sum(r["impact"] for r in rows))]
    if "defer%" in s and "count(*)" in s:
        rows = _byplanner([r for r in QUEUE if r["action_type"] in ("DEFER","REVIEW")])
        return [dict(n=len(rows), v=sum(r["impact"] for r in rows))]
    if "v_build_readiness" in s and "count(*)" in s:
        return [dict(n=len(_byplanner([r for r in QUEUE if r["action_type"]=="BLOCKED"])))]
    if "union all" in s and "action_type" in s:
        limit = P[-1] if P else 50
        out = [dict(action_type=r["action_type"], item_no=r["item_no"],
                    descr=ITEMS[r["item_no"]]["desc"], impact=r["impact"],
                    due_dt=iso(TODAY + timedelta(days=r["due"])) if r["due"] is not None else None,
                    instruction=r["instruction"], badge=r["badge"]) for r in _byplanner(QUEUE)]
        return sorted(out, key=lambda x: -x["impact"])[:limit]

    # ---- planners / planner items / BOM ----
    if "select distinct planner" in s:
        return [dict(planner=p) for p in sorted({v["planner"] for v in ITEMS.values()})]
    if "v_plan_item_detail" in s and "where planner" in s:
        limit, pl = (P[0], P[1]) if len(P) == 2 else (6, P[0])
        rows = [dict(item_no=k, item_desc_1=v["desc"], value_on_hand=round(v["oh"]*v["cost"],2))
                for k, v in ITEMS.items() if v["planner"] == pl]
        return sorted(rows, key=lambda r: -r["value_on_hand"])[:limit]
    if "bom_explosion_flat" in s:
        return bom_rows(P[0]) if P else []

    # ---- search / promise ----
    if "imitmidx_sql" in s:
        needle = (P[1] if len(P) > 1 else "%%").strip("%").lower()
        return [dict(item_no=k, item_desc_1=v["desc"]) for k, v in ITEMS.items()
                if needle in k.lower() or needle in v["desc"].lower()][:P[0] if P else 12]
    if "v_promise" in s:
        item = P[0] if P else ""
        return ladder(item) if item in ITEMS else []

    # ---- PLAN ----
    if "v_spend_forecast" in s: return SPEND
    if "v_excess_projection" in s and "group by month_start" in s: return EXCESS_PROJ_TOTALS
    if "v_excess_risk_trend" in s:
        return [dict(item_no="SOL-9040", item_desc_1=ITEMS["SOL-9040"]["desc"], planner="Priya Nair",
                     risk_flag="EXCESS PROJECTED (MO 2)", trend_ratio_13wk=0.58, headroom_pct=11.0,
                     value_on_hand=407.0, excess_value_if_flipped=740.0),
                dict(item_no="CAP-118", item_desc_1=ITEMS["CAP-118"]["desc"], planner="Dana Whitfield",
                     risk_flag="DECLINING DEMAND - THIN HEADROOM", trend_ratio_13wk=0.62, headroom_pct=14.0,
                     value_on_hand=608.0, excess_value_if_flipped=352.0)]
    if "had_stock" in s:
        rows = STOCKOUTS
        if "planner = ?" in s and len(P) > 1:
            rows = [r for r in rows if ITEMS[r["item_no"]]["planner"] == P[1]]
        return rows[:P[0] if P else 25]
    if "replenishment_sim" in s and "where item_no" in s:
        return STRIPS.get(P[0], [])
    if "predicted_orders po" in s:
        rows = sorted(PREDICTED, key=lambda x: x["order_dt"])
        if "pf.planner = ?" in s and P:
            rows = [r for r in rows if ITEMS[r["item_no"]]["planner"] == P[0]]
        return rows

    # ---- MONEY ----
    if "v_exec_inventory_item" in s and "sum(value_on_hand)" in s: return [BRIDGE]
    if "excess_burndown" in s:
        return [dict(**EXCESS_SITE)]
    if "v_excess_projection" in s and "month_offset = ?" in s:
        mo = P[0]; band = P[1] if len(P) == 3 else None
        rows = [r for r in excess_projection(mo) if not band or _band(r) == band]
        return sorted(rows, key=lambda x: -x["excess_value"])[:P[-1]]
    if "v_exec_inventory_item" in s and "excess_value > 0" in s:
        band = P[0] if len(P) == 2 else None
        rows = [r for r in EXCESS_CURRENT if not band or _band(r) == band]
        return sorted(rows, key=lambda x: -x["excess_value"])[:P[-1]]
    if "v_excess_projection" in s and "group by month_offset" in s:
        return [dict(month_offset=r["month_offset"], v=r["excess_value"]) for r in EXCESS_PROJ_TOTALS]
    if "sum(inv_dollar_delta)" in s: return [dict(v=LEVEL_REVIEW["net_delta"])]
    if "v_stock_level_review" in s: return LEVEL_REVIEW["top_movers"][:P[0] if P else 15]

    # ---- TRUST ----
    if "v_forecast_accuracy" in s: return FCST_ACC
    if "flag_no_vendor)" in s and "sum(" in s: return [HEALTH]
    for flag in HEALTH_ITEMS:
        if f"flag_{flag} = 1" in s: return HEALTH_ITEMS[flag][:P[0] if P else 50]

    # ---- ITEM ----
    if "v_forecast_chart" in s: return forecast_chart(P[0]) if P and P[0] in ITEMS else []
    if "v_plan_item_detail" in s and "where item_no" in s:
        return [item_detail_row(P[0])] if P and P[0] in ITEMS else []
    if "promise_supply_events" in s:
        return supply_events(P[0]) if P and P[0] in ITEMS else []

    # ---- suppliers / build / sourcing / segmentation / config ----
    if "v_supplier_scorecard" in s: return VENDORS[:P[0] if P else 40]
    if "v_supplier_receipts" in s: return vendor_receipts(P[1])[:P[0]]
    if "v_plan_open_po" in s and "vend_no = ?" in s: return open_po_lines(P[1])[:P[0]]
    if "v_build_readiness" in s and "count(*)" not in s:
        rows = BUILD_LIST
        if "like 'blocked%'" in s and "not like" not in s:
            rows = [r for r in rows if r["build_status"].startswith("BLOCKED")]
        elif "not like 'blocked%'" in s:
            rows = [r for r in rows if not r["build_status"].startswith("BLOCKED")]
        return sorted(rows, key=lambda r: (r["status_sort"], r["due_dt"]))[:P[0] if P else 80]
    if "v_sourcing_item_vendor" in s:
        rows = SOURCING_RISK
        if "and planner = ?" in s and len(P) > 1:
            rows = [r for r in rows if ITEMS[r["item_no"]]["planner"] == P[1]]
        return sorted(rows, key=lambda r: -r["annual_value"])[:P[0] if P else 25]
    if "item_abc_xyz" in s: return SEGMENTATION
    if "config_params" in s: return CONFIG

    return []

# ---- suppliers, build, sourcing, segmentation, config ------------------------
VENDORS = [
 dict(vend_no="V1010", vend_name="Halton Inks", otd_pct_12mo=96.4, order_fill_pct_12mo=97.1,
      otif_pct_12mo=94.2, reject_pct_12mo=0.3, scorecard_grade="A - PREFERRED", annual_spend=418000.0,
      open_po_value=64200.0, overdue_lines=1, overdue_value=6720.0, items_supplied=14,
      sole_source_items=6, life_avg_lead_tm=12.4, receipt_lines=212, ppv_dollars=-3120.0,
      vendor_city="Cincinnati", vendor_state="OH", contact_name="Marta Feld",
      vendor_email="mfeld@kaocollins.com", vendor_phone="513-555-0142", terms_desc="Net 30"),
 dict(vend_no="V2040", vend_name="Cascade Ribbon", otd_pct_12mo=93.1, order_fill_pct_12mo=95.8,
      otif_pct_12mo=90.6, reject_pct_12mo=0.8, scorecard_grade="B - APPROVED", annual_spend=286000.0,
      open_po_value=32800.0, overdue_lines=0, overdue_value=0.0, items_supplied=9,
      sole_source_items=2, life_avg_lead_tm=15.1, receipt_lines=148, ppv_dollars=1840.0,
      vendor_city="La Vergne", vendor_state="TN", contact_name="Devon Pruitt",
      vendor_email="d.pruitt@armor-tt.com", vendor_phone="615-555-0177", terms_desc="Net 45"),
 dict(vend_no="V3220", vend_name="Verity Dispensing", otd_pct_12mo=88.9, order_fill_pct_12mo=86.4,
      otif_pct_12mo=81.7, reject_pct_12mo=2.1, scorecard_grade="B - APPROVED", annual_spend=402000.0,
      open_po_value=91400.0, overdue_lines=3, overdue_value=19520.0, items_supplied=11,
      sole_source_items=5, life_avg_lead_tm=31.8, receipt_lines=96, ppv_dollars=8420.0,
      vendor_city="East Providence", vendor_state="RI", contact_name="Alicia Trần",
      vendor_email="atran@nordsonefd.com", vendor_phone="401-555-0126", terms_desc="Net 30"),
 dict(vend_no="V4105", vend_name="Brightwater Fluids", otd_pct_12mo=82.3, order_fill_pct_12mo=88.0,
      otif_pct_12mo=74.9, reject_pct_12mo=1.4, scorecard_grade="C - CONDITIONAL", annual_spend=126000.0,
      open_po_value=11800.0, overdue_lines=2, overdue_value=3550.0, items_supplied=7,
      sole_source_items=3, life_avg_lead_tm=9.6, receipt_lines=174, ppv_dollars=960.0,
      vendor_city="Elk Grove Village", vendor_state="IL", contact_name="Sam Okafor",
      vendor_email="sokafor@meridianfluids.com", vendor_phone="847-555-0193", terms_desc="Net 30 · 2% 10"),
 dict(vend_no="V3400", vend_name="Precision Molding Co", otd_pct_12mo=64.5, order_fill_pct_12mo=71.2,
      otif_pct_12mo=52.8, reject_pct_12mo=4.6, scorecard_grade="D - AT RISK", annual_spend=88000.0,
      open_po_value=14200.0, overdue_lines=4, overdue_value=4360.0, items_supplied=5,
      sole_source_items=2, life_avg_lead_tm=21.3, receipt_lines=61, ppv_dollars=5210.0,
      vendor_city="Rockford", vendor_state="IL", contact_name="Gene Hollis",
      vendor_email="ghollis@precisionmolding.co", vendor_phone="815-555-0164", terms_desc="Net 60"),
]

# ---- level-1 BOM for manufactured items - mirrors plan.bom_explosion_flat ----
# is_optional marks kit components a customer can decline (they never gate a promise).
BOM = {
 "2600223": [                                        # printhead assembly
   dict(component_item="GSK-42",   qty_per=2, is_optional=0),
   dict(component_item="CAP-118",  qty_per=4, is_optional=0),
   dict(component_item="BRK-770",  qty_per=1, is_optional=0),
   dict(component_item="FLT-2200", qty_per=1, is_optional=1),   # inline filter option
 ],
 "RES-5000K": [                                      # maintenance kit
   dict(component_item="FLT-2200", qty_per=2, is_optional=0),
   dict(component_item="GSK-42",   qty_per=1, is_optional=0),
   dict(component_item="SOL-9040", qty_per=1, is_optional=0),
   dict(component_item="CAP-118",  qty_per=2, is_optional=1),   # spare-cap option
   dict(component_item="OBS-3310", qty_per=1, is_optional=1),   # legacy-printer option
 ],
 "CAP-118": [                                        # cap ASSEMBLY - nested level so
   dict(component_item="BRK-770",  qty_per=1, is_optional=0),   # the BOM explorer demos
 ],                                                             # a real multi-level tree
}
def bom_rows(parent):
    out = []
    for b in BOM.get(parent, []):
        it = ITEMS[b["component_item"]]
        on_order = it["bin_qty"] if it["rop"] is not None else 0
        out.append(dict(component_item=b["component_item"], item_desc_1=it["desc"],
            qty_per=b["qty_per"], is_optional=b["is_optional"], bom_level=1,
            qty_on_hand=it["oh"], on_order_qty=on_order,
            next_receipt_dt=iso(wk_start(4)) if on_order else None,
            lead_working_days=it["lead"], unit_cost=it["cost"]))
    return out
def vendor_receipts(vend_no):
    v = next((x for x in VENDORS if x["vend_no"]==vend_no), None)
    if not v: return []
    r = random.Random(vend_no); rows=[]
    items = [k for k,it in ITEMS.items() if it["vendor"]==v["vend_name"]] or list(ITEMS)[:3]
    for i in range(14):
        item = items[i % len(items)]; it = ITEMS[item]
        dt = TODAY - timedelta(days=6*i + r.randint(0,4))
        late = max(0, r.randint(-4, 9))
        qty = max(1, round((it["bin_qty"] or 24) * (0.7 + 0.6*r.random())))
        rows.append(dict(vend_no=vend_no, vend_name=v["vend_name"], item_no=item,
            ord_no=f"41{700+i}", rec_hst_dt=iso(dt), commit_dt=iso(dt - timedelta(days=late)),
            days_late=late, is_on_time=1 if late<=0 else 0, qty_received=qty,
            unit_cost_paid=round(it["cost"] * (0.97 + 0.06*r.random()), 2),
            receipt_value=round(qty * it["cost"], 2)))
    return rows

def open_po_lines(vend_no):
    """Open (not-yet-received) PO lines for one vendor - mirrors
    dbo.v_plan_open_po. Overdue-line COUNT matches the vendor's own
    overdue_lines field so the drill-down list stays consistent with the
    scorecard row it was opened from; exact dollar totals are illustrative."""
    v = next((x for x in VENDORS if x["vend_no"]==vend_no), None)
    if not v: return []
    r = random.Random(vend_no+"_openpo")
    items = [k for k,it in ITEMS.items() if it["vendor"]==v["vend_name"]] or list(ITEMS)[:2]
    n_overdue = v.get("overdue_lines", 0) or 0
    n_total = max(n_overdue + r.randint(1, 3), n_overdue, 1)
    rows = []
    for i in range(n_total):
        item = items[i % len(items)]; it = ITEMS[item]
        overdue = i < n_overdue
        days = r.randint(2, 21) if overdue else 0
        promise = TODAY - timedelta(days=days) if overdue else TODAY + timedelta(days=r.randint(3, 30))
        qty = max(1, round((it["bin_qty"] or 24) * (0.5 + r.random())))
        rows.append(dict(ord_no=f"418{20+i}", line_no=1, item_no=item, item_desc_1=it["desc"],
            qty_remaining=qty, promise_dt=iso(promise), days_overdue=days,
            open_value=round(qty * it["cost"], 2),
            recommended_action="EXPEDITE" if overdue else "MONITOR"))
    return sorted(rows, key=lambda x: -x["days_overdue"])

BUILD_LIST = [
 dict(ord_no="88210", line_no=1, due_dt=iso(TODAY+timedelta(days=11)), item_no="2600223",
      item_desc_1=ITEMS["2600223"]["desc"], cus_no="C04412", planner="Dana Whitfield",
      qty_open=16, qty_from_stock=15, build_qty=1, build_status="BLOCKED - NO INBOUND SUPPLY",
      status_sort=1, material_complete_dt=None, schedule_start_dt=None, est_build_done_dt=None,
      gating_component="GSK-42", gating_source="BOM L1",
      planner_note="BLOCKED: GSK-42 has no inbound supply covering this line"),
 dict(ord_no="88231", line_no=2, due_dt=iso(TODAY+timedelta(days=6)), item_no="RES-5000K",
      item_desc_1=ITEMS["RES-5000K"]["desc"], cus_no="C01180", planner="Dana Whitfield",
      qty_open=8, qty_from_stock=8, build_qty=0, build_status="SHIP FROM STOCK",
      status_sort=3, material_complete_dt=iso(TODAY), schedule_start_dt=None,
      est_build_done_dt=iso(TODAY+timedelta(days=1)), gating_component=None,
      gating_source=None, planner_note="Fill from finished stock"),
 dict(ord_no="88245", line_no=1, due_dt=iso(TODAY+timedelta(days=14)), item_no="RES-5000K",
      item_desc_1=ITEMS["RES-5000K"]["desc"], cus_no="C02277", planner="Dana Whitfield",
      qty_open=6, qty_from_stock=4, build_qty=2, build_status="READY TO RELEASE",
      status_sort=2, material_complete_dt=iso(TODAY), schedule_start_dt=iso(TODAY+timedelta(days=2)),
      est_build_done_dt=iso(TODAY+timedelta(days=9)), gating_component=None,
      gating_source=None, planner_note="Release to floor now"),
 dict(ord_no="88260", line_no=1, due_dt=iso(TODAY+timedelta(days=24)), item_no="2600223",
      item_desc_1=ITEMS["2600223"]["desc"], cus_no="C04412", planner="Dana Whitfield",
      qty_open=4, qty_from_stock=0, build_qty=4, build_status="WAITING ON MATERIAL",
      status_sort=2, material_complete_dt=iso(wk_start(4)), schedule_start_dt=iso(wk_start(4)),
      est_build_done_dt=iso(wk_start(6)), gating_component="CAP-118", gating_source="BOM L2",
      planner_note="Waiting on CAP-118 - PO 41710 promised " + wk_start(4).strftime('%b %d')),
]
# star-schema build-line id (ord_type-ord_no-line_no); every demo build is a sales order
for _b in BUILD_LIST:
    _b["line_key"] = f"O-{_b['ord_no']}-{_b['line_no']}"

SOURCING_RISK = [dict(item_no=k, item_desc_1=v["desc"], abc_class=v["abc"],
                      annual_value=round(v["cost"]*(v["s"] or 40)*6,2), vend_name=v["vendor"],
                      vendor_lead_days=v["lead"], last_price_paid=v["cost"])
                 for k,v in ITEMS.items() if k in ("2600223","1150-BLK","RES-5000K","CAP-118","OBS-3310")]

SEGMENTATION = [dict(abc_class=a, xyz_class=x,
                     item_ct=random.Random(a+x).randint(8,220),
                     annual_value=round(random.Random(x+a).uniform(2e4, 9e5),2))
                for a in "ABC" for x in "XYZ"]

CONFIG = [
 dict(param_name="T_working_days", param_value=5.0, notes="Replenishment interval = 1 working week. Short cycle deliberately chosen for a lean, high-customization, Z-heavy mix."),
 dict(param_name="service_level_A", param_value=0.98, notes="Cycle service level target, A items."),
 dict(param_name="service_level_B", param_value=0.95, notes="Cycle service level target, B items."),
 dict(param_name="service_level_C", param_value=0.90, notes="Cycle service level target, C items."),
 dict(param_name="fcst_horizon_wk", param_value=13.0, notes="Forecast + simulation horizon in weeks."),
 dict(param_name="build_lead_cal_days", param_value=7.0, notes="Promise-date build lead for manufactured items: 1 week (per production planner). Calendar days added to component-availability date."),
 dict(param_name="excess_trend_decline_ratio", param_value=0.70, notes="13-wk demand trend ratio below which an item flags as declining."),
]

# ==============================================================================
# ENGINE DEMO DATA (July 2026) - backs the endpoints added with the
# restructured engine data layer. Keyed to the same demo world above.
# ==============================================================================
V2_REFRESH_STATUS = [
 dict(job_name="usp_refresh_weekly",   last_ok=iso(TODAY - timedelta(days=TODAY.weekday())) + " 03:14"),
 dict(job_name="usp_refresh_frequent", last_ok=iso(TODAY) + " 05:41"),
]
V2_REFRESH_RUNS = [
 dict(log_id=118, job_name="usp_refresh_frequent", started_dt=iso(TODAY)+" 05:30", finished_dt=iso(TODAY)+" 05:41", status="SUCCESS", secs=642, error_msg=None),
 dict(log_id=117, job_name="build_readiness",      started_dt=iso(TODAY)+" 05:37", finished_dt=iso(TODAY)+" 05:41", status="SUCCESS", secs=224, error_msg=None),
 dict(log_id=116, job_name="build_promise",        started_dt=iso(TODAY)+" 05:30", finished_dt=iso(TODAY)+" 05:37", status="SUCCESS", secs=418, error_msg=None),
 dict(log_id=115, job_name="usp_refresh_weekly",   started_dt=iso(TODAY - timedelta(days=TODAY.weekday()))+" 03:00", finished_dt=iso(TODAY - timedelta(days=TODAY.weekday()))+" 03:14", status="SUCCESS", secs=861, error_msg=None),
 dict(log_id=114, job_name="build_projection",     started_dt=iso(TODAY - timedelta(days=TODAY.weekday()))+" 03:09", finished_dt=iso(TODAY - timedelta(days=TODAY.weekday()))+" 03:14", status="SUCCESS", secs=304, error_msg=None),
]
V2_VALIDATION = [
 dict(scope="frequent", check_name="build_blocked_consistency",  severity="ERROR", failed_rows=0, passed=1, checked_dt=iso(TODAY)+" 05:41"),
 dict(scope="frequent", check_name="build_gating_in_detail",     severity="ERROR", failed_rows=0, passed=1, checked_dt=iso(TODAY)+" 05:41"),
 dict(scope="frequent", check_name="otd_never_exceeds_100",      severity="ERROR", failed_rows=0, passed=1, checked_dt=iso(TODAY)+" 05:41"),
 dict(scope="frequent", check_name="otif_never_exceeds_otd",     severity="ERROR", failed_rows=0, passed=1, checked_dt=iso(TODAY)+" 05:41"),
 dict(scope="frequent", check_name="promise_anchor_non_negative",severity="ERROR", failed_rows=0, passed=1, checked_dt=iso(TODAY)+" 05:41"),
 dict(scope="frequent", check_name="reorder_excludes_nonpurchased",severity="ERROR", failed_rows=0, passed=1, checked_dt=iso(TODAY)+" 05:41"),
 dict(scope="weekly",   check_name="abc_covers_demand",          severity="WARN",  failed_rows=3, passed=0, checked_dt=iso(TODAY)+" 05:41"),
]
V2_GLOSSARY = [
 dict(code_type="ABC", code="A", name="High value",   description="Top ~80% of annual consumption value. Tightest service level (95%)."),
 dict(code_type="ABC", code="B", name="Medium value", description="Next ~15% of annual consumption value. 90% service level target."),
 dict(code_type="ABC", code="C", name="Low value",    description="Bottom ~5% of annual value. 85% service level - cheaper to expedite than hold."),
 dict(code_type="XYZ", code="X", name="Steady demand",  description="Low variability. Forecasts trustworthy; safety stock can be lean."),
 dict(code_type="XYZ", code="Y", name="Variable demand",description="Moderate variability. Forecasts useful but carry error."),
 dict(code_type="XYZ", code="Z", name="Sporadic demand",description="High variability or intermittent - lean on reorder points and review."),
 dict(code_type="DEMAND_CLASS", code="SMOOTH",       name="Regular + stable",        description="Two-bin kanban works perfectly here."),
 dict(code_type="DEMAND_CLASS", code="ERRATIC",      name="Regular + variable qty",  description="Reorder point works; safety stock does the lifting."),
 dict(code_type="DEMAND_CLASS", code="INTERMITTENT", name="Gaps, stable qty",        description="Order-to-demand often beats stocking."),
 dict(code_type="DEMAND_CLASS", code="LUMPY",        name="Intermittent + variable", description="The hardest class - discrete review beats automation."),
]
V2_BUILD_COMPONENTS = {
 "O-88210-1": [
  dict(component_item="GSK-42",  component_desc=ITEMS["GSK-42"]["desc"],  comp_role="CONSTRAINING", comp_status="NO INBOUND SUPPLY", comp_status_sort=1, qty_per_parent=2.0, comp_need=2.0, cum_comp_need=14.0, covered_dt=None, covered_source=None, is_blocked=1, qty_on_hand_net=0, qty_available=0, qty_on_order=0, lead_working_days=15, primary_vendor_name="Brightwater Fluids", need_value=44.6, component_stock_status="STOCKOUT"),
  dict(component_item="CAP-118", component_desc=ITEMS["CAP-118"]["desc"], comp_role="CONSTRAINING", comp_status="COVERED "+iso(TODAY+timedelta(days=9)), comp_status_sort=2, qty_per_parent=1.0, comp_need=1.0, cum_comp_need=9.0, covered_dt=iso(TODAY+timedelta(days=9)), covered_source="PO 41922 L1", is_blocked=0, qty_on_hand_net=4, qty_available=2, qty_on_order=40, lead_working_days=10, primary_vendor_name="Verity Dispensing", need_value=12.8, component_stock_status="AT REORDER"),
  dict(component_item="SOL-9040",component_desc=ITEMS["SOL-9040"]["desc"],comp_role="CONSTRAINING", comp_status="AVAILABLE NOW", comp_status_sort=3, qty_per_parent=0.5, comp_need=0.5, cum_comp_need=4.0, covered_dt=iso(TODAY), covered_source="ON HAND", is_blocked=0, qty_on_hand_net=120, qty_available=96, qty_on_order=0, lead_working_days=8, primary_vendor_name="Cascade Ribbon", need_value=6.1, component_stock_status="OK"),
  dict(component_item="BRK-770", component_desc=ITEMS["BRK-770"]["desc"], comp_role="NSI - KANBAN", comp_status="KANBAN MANAGED - not tracked here", comp_status_sort=4, qty_per_parent=4.0, comp_need=4.0, cum_comp_need=None, covered_dt=None, covered_source=None, is_blocked=0, qty_on_hand_net=None, qty_available=None, qty_on_order=None, lead_working_days=5, primary_vendor_name="Halton Inks", need_value=None, component_stock_status="NSI - KANBAN"),
 ],
}
V2_SUPPLIER_TODO = [
 dict(vend_no="V4105", vend_name="Brightwater Fluids", annual_spend=126000.0, items_supplied=7, sole_source_items=3, otd_pct_12mo=82.3, otif_pct_12mo=74.9, ppv_pct_12mo=0.8, lead_delta_days=16.0, action_status="RED",    action_reason=" OTD 82%. OTIF 74%. Lead time running 16d over stated - update the master."),
 dict(vend_no="V3220", vend_name="Verity Dispensing",     annual_spend=402000.0, items_supplied=11, sole_source_items=5, otd_pct_12mo=88.9, otif_pct_12mo=81.7, ppv_pct_12mo=2.6, lead_delta_days=6.0,  action_status="YELLOW", action_reason=" OTD 88%. Paying 2.6% over expected cost."),
 dict(vend_no="V2040", vend_name="Cascade Ribbon",        annual_spend=286000.0, items_supplied=9,  sole_source_items=2, otd_pct_12mo=93.1, otif_pct_12mo=90.6, ppv_pct_12mo=0.6, lead_delta_days=2.0,  action_status="GREEN",  action_reason=""),
 dict(vend_no="V1010", vend_name="Halton Inks",     annual_spend=418000.0, items_supplied=14, sole_source_items=6, otd_pct_12mo=96.4, otif_pct_12mo=94.2, ppv_pct_12mo=-0.7, lead_delta_days=0.4, action_status="GREEN",  action_reason=""),
]
V2_SUPPLIER_LEADTIME = [
 dict(vend_no="V1010", vend_name="Halton Inks",     receipt_lines_12mo=212, stated_lead_cal_avg=16.8, actual_lead_cal_avg=17.2, lead_delta_days=0.4,  actual_lead_last3mo=16.9, actual_lead_prior9mo=17.4, flag_update_lead_time=0),
 dict(vend_no="V2040", vend_name="Cascade Ribbon",        receipt_lines_12mo=148, stated_lead_cal_avg=21.1, actual_lead_cal_avg=23.1, lead_delta_days=2.0,  actual_lead_last3mo=22.5, actual_lead_prior9mo=23.4, flag_update_lead_time=0),
 dict(vend_no="V3220", vend_name="Verity Dispensing",     receipt_lines_12mo=96,  stated_lead_cal_avg=44.5, actual_lead_cal_avg=50.5, lead_delta_days=6.0,  actual_lead_last3mo=52.8, actual_lead_prior9mo=49.6, flag_update_lead_time=0),
 dict(vend_no="V4105", vend_name="Brightwater Fluids", receipt_lines_12mo=174, stated_lead_cal_avg=13.4, actual_lead_cal_avg=29.4, lead_delta_days=16.0, actual_lead_last3mo=31.2, actual_lead_prior9mo=28.7, flag_update_lead_time=1),
]
V2_BLANKETS = [
 dict(blanket_po="327245", item_no="1150-BLK", item_desc_1=ITEMS["1150-BLK"]["desc"], vend_no="V1010", vend_name="Halton Inks", blanket_dt=iso(TODAY-timedelta(days=64)), blanket_total_qty=4800, released_total_qty=3200, release_count=4, blanket_balance_remaining=1600, supply_tier="SCHEDULABLE - NEEDS RELEASE"),
 dict(blanket_po="331080", item_no="TTO-33110", item_desc_1=ITEMS["TTO-33110"]["desc"], vend_no="V2040", vend_name="Cascade Ribbon", blanket_dt=iso(TODAY-timedelta(days=31)), blanket_total_qty=1200, released_total_qty=400, release_count=1, blanket_balance_remaining=800, supply_tier="SCHEDULABLE - NEEDS RELEASE"),
]
V2_BLANKET_CANDIDATES = [
 dict(item_no="SOL-9040", item_desc_1=ITEMS["SOL-9040"]["desc"], planner="Priya Nair", primary_vendor_name="Cascade Ribbon", demand_class="SMOOTH", xyz_class="X", demand_per_week=310.0, suggested_blanket_qty=8100.0, suggested_release_qty=1560.0, release_every_n_weeks=5.0, six_month_value=64800.0),
 dict(item_no="FLT-2200", item_desc_1=ITEMS["FLT-2200"]["desc"], planner="Luke Carver", primary_vendor_name="Verity Dispensing", demand_class="SMOOTH", xyz_class="Y", demand_per_week=88.0, suggested_blanket_qty=2300.0, suggested_release_qty=460.0, release_every_n_weeks=5.2, six_month_value=29900.0),
]
V2_SHELF_LIFE = [
 dict(item_no="INK-1265Y", item_desc_1=ITEMS["INK-1265Y"]["desc"], planner="Luke Carver", shelf_life_days=180, shelf_life_cap_qty=740.0, moq=1000.0, shelf_moq_conflict=1, air_only=1, ocean_po_lines_open=1, primary_vendor_name="Halton Inks"),
 dict(item_no="SOL-9040",  item_desc_1=ITEMS["SOL-9040"]["desc"],  planner="Priya Nair", shelf_life_days=365, shelf_life_cap_qty=16100.0, moq=500.0, shelf_moq_conflict=0, air_only=1, ocean_po_lines_open=0, primary_vendor_name="Cascade Ribbon"),
]
V2_PALLETS = [
 dict(item_no="1150-BLK", item_desc_1=ITEMS["1150-BLK"]["desc"], pallet_qty=240.0, pallets_on_hand=2, pallets_on_order=2, pallets_projected=4, total_projected=61, pallet_cap=99, capacity_used_pct=61.6, over_capacity=0),
 dict(item_no="SOL-9040", item_desc_1=ITEMS["SOL-9040"]["desc"], pallet_qty=48.0,  pallets_on_hand=3, pallets_on_order=0, pallets_projected=3, total_projected=61, pallet_cap=99, capacity_used_pct=61.6, over_capacity=0),
]
V2_WORKLOAD = [
 dict(planner="Luke Carver",    open_po_lines=42, open_po_value=284000.0, overdue_po_lines=5, open_order_suggestions=9,  suggestion_value=88200.0, blocked_builds=0),
 dict(planner="Priya Nair",     open_po_lines=35, open_po_value=201000.0, overdue_po_lines=2, open_order_suggestions=7,  suggestion_value=61400.0, blocked_builds=0),
 dict(planner="Dana Whitfield", open_po_lines=18, open_po_value=96000.0,  overdue_po_lines=1, open_order_suggestions=3,  suggestion_value=32800.0, blocked_builds=2),
]
V2_LOCATIONS = {
 "1150-BLK": [
  dict(loc="MAIN", loc_status=None, is_nettable=1, qty_on_hand=290, qty_allocated=110, qty_available=180, qty_on_order=480, param_exception=""),
  dict(loc="FLOOR", loc_status=None, is_nettable=1, qty_on_hand=50, qty_allocated=20, qty_available=30, qty_on_order=0, param_exception=""),
  dict(loc="QHOLD", loc_status="H", is_nettable=0, qty_on_hand=12, qty_allocated=0, qty_available=0, qty_on_order=0, param_exception="SAFETY > REORDER"),
 ],
}
# BOM explorer directions DERIVED from the single BOM edge dict above, the
# same way the real plan.bom_explosion_flat derives from bmprdstr_sql - so the
# kit calculator, explode-down, and where-used can never disagree with each
# other (they did when these were three hand-maintained structures: CAP-118
# sat inside 2600223's explosion but had no where-used entry).
def _explode(source, parent=None, level=1, mult=1.0, seen=None):
    parent = parent or source
    seen = seen or {source}
    rows = []
    for e in BOM.get(parent, []):
        c = e["component_item"]
        if c in seen:            # per-path cycle guard, like the real CTE
            continue
        rows.append(dict(parent_item=parent, component_item=c,
                         component_desc=ITEMS[c]["desc"] if c in ITEMS else "",
                         bom_level=level, cum_qty_per=float(e["qty_per"]) * mult))
        rows += _explode(source, c, level + 1, float(e["qty_per"]) * mult, seen | {c})
    return rows

V2_EXPLODE = {p: _explode(p) for p in BOM}
V2_WHERE_USED = {}
for _src, _rows in V2_EXPLODE.items():
    for _r in _rows:
        V2_WHERE_USED.setdefault(_r["component_item"], []).append(
            dict(source_fg=_src, parent_item=_r["parent_item"],
                 parent_desc=ITEMS[_src]["desc"] if _src in ITEMS else "",
                 bom_level=_r["bom_level"], cum_qty_per=_r["cum_qty_per"]))
