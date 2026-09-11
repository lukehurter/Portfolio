/*==============================================================================
  Axim CPQ — promise dates and open orders
  ------------------------------------------------------------------------------
  Run after 01_foundation.sql.

  THIS SCRIPT DELIBERATELY COMPUTES NOTHING.

  Planning Analytics already answers both questions, in production, refreshed by
  a SQL Agent job each morning:

    plan.v_promise        the promise ladder - per item, a sequence of
                          (quantity, date) steps with the mode it was derived by
                          and a written explanation.
    dbo.v_oe_open_lines   open sales order lines, with the policy already
                          applied: cancelled and credit-hold headers excluded,
                          fully-backordered lines included, qty_open floored.

  Re-deriving either here would create a second answer to the same question, and
  the two would drift. A rep quoting a date and a planner reading the dashboard
  must be looking at the same number. So CPQ reads those views through synonyms
  and adds only presentation.

  CONSEQUENCE WORTH KNOWING: promise dates are as fresh as the Planning
  Analytics frequent refresh, which runs ONCE, at 05:30. A midday run was
  specified but is not scheduled, so by four in the afternoon a promise date is
  ten hours old, and first thing the next morning it is nearly twenty-four.

  They are not live. Every view below carries an as_of column so the interface
  can say so — a rep on the phone to a customer should know whether a date is an
  hour old or a day, and with one run a day it is much more often a day.
==============================================================================*/

SET NOCOUNT ON;
GO
USE [AximQuote];
GO

IF SCHEMA_ID('pa') IS NULL EXEC('CREATE SCHEMA pa');   -- read-only Planning Analytics surface
GO

/*------------------------------------------------------------------------------
  1. Synonyms into PlanningSuite
------------------------------------------------------------------------------*/
DECLARE @pa sysname = N'[PlanningSuite]';   -- confirm the database name
DECLARE @sql nvarchar(max);

DECLARE @syn TABLE (name sysname, target nvarchar(200));
INSERT INTO @syn (name, target) VALUES
    (N'promise',       N'[plan].v_promise'),
    (N'oe_open_lines', N'dbo.v_oe_open_lines'),
    (N'pfep',          N'dbo.v_pfep'),          -- lead time, on hand, on order per item
    (N'refresh_log',   N'[plan].refresh_log');  -- so we can show how fresh the answer is

DECLARE @n sysname, @t nvarchar(200);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT name, target FROM @syn;
OPEN c; FETCH NEXT FROM c INTO @n, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = @n AND SCHEMA_NAME(schema_id) = 'pa')
        EXEC('DROP SYNONYM pa.' + @n);
    SET @sql = N'CREATE SYNONYM pa.' + QUOTENAME(@n) + N' FOR ' + @pa + N'.' + @t;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM c INTO @n, @t;
END
CLOSE c; DEALLOCATE c;
PRINT 'Planning Analytics synonyms created in schema [pa].';
GO

/*------------------------------------------------------------------------------
  2. How fresh is the answer?
  ------------------------------------------------------------------------------
  The frequent refresh is what rebuilds the promise ladder. If it has not run,
  every date below is stale and the interface must say so rather than presenting
  a confident wrong number.
------------------------------------------------------------------------------*/
CREATE OR ALTER VIEW cpq.v_promise_freshness AS
SELECT TOP 1
    r.job_name,
    r.finished_dt                                              AS refreshed_at,
    DATEDIFF(MINUTE, r.finished_dt, SYSDATETIME())             AS minutes_old,
    r.status,
    CASE
        WHEN r.status LIKE 'FAIL%'                       THEN 'failed'
        WHEN DATEDIFF(HOUR, r.finished_dt, SYSDATETIME()) > 14 THEN 'stale'
        ELSE 'current'
    END                                                        AS freshness
FROM pa.refresh_log r
WHERE r.job_name LIKE '%frequent%'
ORDER BY r.finished_dt DESC;
GO

/*------------------------------------------------------------------------------
  3. Promise ladder for an item
  ------------------------------------------------------------------------------
  Passed through as-is. `explanation` and `promise_mode` come from Planning
  Analytics and are shown to the rep verbatim: the date is only useful to a
  customer conversation if the rep can say why.
------------------------------------------------------------------------------*/
CREATE OR ALTER VIEW cpq.v_item_promise AS
SELECT
    p.item_no,
    p.item_desc_1,
    p.pur_or_mfg,
    p.ladder_seq,
    p.promised_dt,
    p.material_ready_dt,
    p.atp_qty,
    p.promise_mode,
    p.explanation,
    p.qty_overdue_excluded,
    p.qty_blanket_excluded,
    f.refreshed_at                                             AS as_of,
    f.freshness
FROM pa.promise p
CROSS JOIN (SELECT TOP 1 refreshed_at, freshness FROM cpq.v_promise_freshness) f;
GO

/*  The single answer to "when can they have N of these?" — the first rung of
    the ladder that covers the quantity asked for.                            */
CREATE OR ALTER FUNCTION cpq.fn_promise_for_qty
(
    @item_no varchar(25),
    @qty     decimal(18,4)
)
RETURNS TABLE
AS
RETURN
(
    SELECT TOP 1
        p.item_no,
        p.promised_dt,
        p.material_ready_dt,
        p.atp_qty,
        p.promise_mode,
        p.explanation,
        p.ladder_seq,
        p.as_of,
        p.freshness,
        CASE WHEN p.atp_qty >= @qty THEN 1 ELSE 0 END AS covers_quantity
    FROM cpq.v_item_promise p
    WHERE p.item_no = @item_no
      AND p.atp_qty >= @qty
    ORDER BY p.ladder_seq
);
GO

/*------------------------------------------------------------------------------
  4. A customer's open orders
  ------------------------------------------------------------------------------
  For the call that starts "where is my order". One row per open line, with the
  committed date, what is still outstanding, and whether it is already late.
------------------------------------------------------------------------------*/
CREATE OR ALTER VIEW cpq.v_customer_open_lines AS
SELECT
    o.cus_no,
    c.cus_name,
    o.ord_no,
    o.ord_type,
    o.line_seq_no,
    o.item_no,
    LTRIM(RTRIM(i.item_desc_1))                                AS description,
    o.loc,
    o.qty_open,
    o.qty_to_ship,
    o.qty_bkord,
    o.promise_dt,
    o.request_dt,
    o.due_dt,
    o.hdr_status,
    CASE o.hdr_status
        WHEN 'O' THEN 'Open'  WHEN 'B' THEN 'Backordered'
        WHEN 'P' THEN 'Picked' WHEN 'S' THEN 'Shipped'
        WHEN 'H' THEN 'On hold'
        ELSE o.hdr_status END                                  AS status_label,
    CASE WHEN o.due_dt IS NULL THEN NULL
         ELSE DATEDIFF(DAY, o.due_dt, CAST(GETDATE() AS date)) END AS days_late,
    CASE WHEN o.due_dt IS NOT NULL AND o.due_dt < CAST(GETDATE() AS date)
         THEN 1 ELSE 0 END                                      AS is_late,
    /*  When the line has no committed date, or is already late, the promise
        ladder is the honest answer to "when will it actually be ready".      */
    pr.promised_dt                                             AS ladder_promised_dt,
    pr.material_ready_dt                                       AS ladder_material_ready_dt,
    pr.promise_mode,
    pr.explanation                                             AS promise_explanation,
    pr.as_of,
    pr.freshness
FROM pa.oe_open_lines o
LEFT JOIN mac.imitmidx_sql i ON i.item_no = o.item_no
LEFT JOIN mac.arcusfil_sql c ON c.cus_no  = o.cus_no
OUTER APPLY cpq.fn_promise_for_qty(o.item_no, o.qty_open) pr
/*  A line with nothing outstanding has shipped. Planning Analytics floors
    qty_open at zero rather than dropping the row, so without this the open-order
    screen lists orders with nothing open on them.                            */
WHERE o.qty_open > 0;
GO

/*  Order-level roll-up: what a rep reads out loud before drilling in.        */
CREATE OR ALTER VIEW cpq.v_customer_open_orders AS
SELECT
    l.cus_no,
    l.cus_name,
    l.ord_no,
    l.ord_type,
    COUNT(*)                                                   AS open_lines,
    SUM(l.qty_open)                                            AS qty_open,
    MIN(l.due_dt)                                              AS earliest_due_dt,
    MAX(l.due_dt)                                              AS latest_due_dt,
    /*  The order is ready when its slowest line is ready.                    */
    MAX(COALESCE(l.ladder_promised_dt, l.due_dt))              AS expected_ready_dt,
    SUM(CASE WHEN l.is_late = 1 THEN 1 ELSE 0 END)             AS late_lines,
    MAX(l.days_late)                                           AS worst_days_late,
    MAX(l.as_of)                                               AS as_of,
    MIN(l.freshness)                                           AS freshness
FROM cpq.v_customer_open_lines l
GROUP BY l.cus_no, l.cus_name, l.ord_no, l.ord_type;
GO

PRINT 'Promise and open-order views deployed.';
PRINT '';
PRINT 'These read PlanningSuite. The app service account therefore needs';
PRINT 'db_datareader on PlanningSuite as well as AximQuote. It still needs';
PRINT 'nothing on Orbit directly - both sets of synonyms encapsulate that.';
GO
