/*==============================================================================
  Axim CPQ — the objects the service reads through
  ------------------------------------------------------------------------------
  Run after 01_foundation.sql. Creates nothing that holds data: one view, one
  sequence.

  WHY A VIEW AND NOT A TABLE

  cpq.v_quotable_item is the single definition of "an item a rep may put on a
  quote, and what it costs". Every price the service returns comes through here,
  and the view reads Orbit live through the mac synonyms.

  That is the whole Orbit-is-authoritative decision expressed in one object. A
  new product launch is a Orbit row; a discontinuance is a Orbit flag. Neither
  needs a deployment, a rule edit, or anybody to remember to update a second
  list — because there is no second list.

  WHAT MAKES AN ITEM QUOTABLE

  Two routes, and an item needs only one:

    1. Its Orbit product category is mapped to a technology in
       cpq.technology_category.
    2. It is placed by hand in cpq.item_profile.

  Both are empty until somebody who knows the catalogue fills them, so this view
  returns NOTHING on a fresh install. That is deliberate and it is the correct
  failure. Orbit's ~40 categories do not map one-to-one onto the seven price
  books; an empty list is better than a wrong one in front of a rep.

  NOTHING HERE HAS BEEN RUN. Treat the first execution as a test, on a restored
  copy, exactly as the Planning Analytics scripts advise.
==============================================================================*/

SET NOCOUNT ON;
GO
USE [AximQuote];
GO

/*------------------------------------------------------------------------------
  Quote numbers.

  A sequence rather than MAX(quote_no)+1, because two reps pressing Save at the
  same moment must not be handed the same number, and a sequence is the only
  thing that guarantees that without taking a lock on the quote table.

  WHERE IT STARTS, AND WHY THAT IS A DECISION

  A CPQ quote number is 'Q-2026-1042'. A Orbit document number is an integer in
  oeordhdr_sql.ord_no. They are different shapes in different systems, so the two
  cannot literally collide — but "cannot collide" is not the same as "will not
  confuse anybody", and if the business reads them as one series then starting
  this one at 1000 puts a second document called 1042 in the world.

  So it starts above whatever Orbit has already issued. That costs nothing if
  the two series are meant to be separate, and it is the whole answer if they are
  meant to be one. ord_type 'Q' and 'O' are both counted: a number Orbit has
  used for an order is still a number that has been used.

  If Orbit cannot be read at install time the sequence is not created, and the
  install says so rather than quietly starting at 1 and issuing numbers that
  somebody else already owns.
------------------------------------------------------------------------------*/
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'seq_quote_no'
                 AND schema_id = SCHEMA_ID('cpq'))
BEGIN
    DECLARE @start bigint;

    BEGIN TRY
        /* TRY_CONVERT, because ord_no is character in some Orbit installs and
           a non-numeric document reference would otherwise fail the whole
           install. Anything that is not a number is not part of a series. */
        SELECT @start = MAX(TRY_CONVERT(bigint, ord_no)) + 1
          FROM mac.oeordhdr_sql;
    END TRY
    BEGIN CATCH
        SET @start = NULL;
    END CATCH

    IF @start IS NULL
    BEGIN
        RAISERROR('cpq.seq_quote_no was NOT created: mac.oeordhdr_sql could not be
 read, so the highest document number already issued is unknown. Starting a quote
 series without that risks issuing numbers Orbit has already used. Fix the
 synonyms (01_foundation.sql) and run this file again, or create the sequence by
 hand at a number the business has agreed.', 16, 1);
    END
    ELSE
    BEGIN
        DECLARE @sql nvarchar(400) =
            N'CREATE SEQUENCE cpq.seq_quote_no AS bigint START WITH '
            + CONVERT(nvarchar(20), @start) + N' INCREMENT BY 1;';
        EXEC(@sql);
        PRINT '  cpq.seq_quote_no created, starting at '
            + CONVERT(nvarchar(20), @start)
            + ' (one past the highest ord_no in Orbit).';
    END
END
GO

/*------------------------------------------------------------------------------
  What a rep may quote, and what it costs.

  iminvloc_sql holds price and cost per location, so it is restricted to the
  quoting location. Preflight grid 3 is what tells you whether 'MAIN' is right
  here — if this company runs several selling locations, this WHERE clause is
  the line to change, and it should become a parameter rather than a literal.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.v_quotable_item') IS NOT NULL DROP VIEW cpq.v_quotable_item;
GO
CREATE VIEW cpq.v_quotable_item
AS
SELECT
    i.item_no,
    i.item_desc_1                          AS description,
    i.prod_cat,
    c.description                          AS prod_cat_desc,
    COALESCE(p.technology_cd, tc.technology_cd)  AS technology_cd,
    COALESCE(p.item_role,    tc.item_role)       AS item_role,
    dm.discount_cat_cd,
    loc.list_price,
    loc.std_cost,
    i.unit_of_measure                      AS uom,
    /*  'A' = Active, confirmed against the live Orbit data. Anything else -
        obsolete, superseded, on hold - is not offered, but an item already on a
        saved quote still prices, because repo.items_for reads by item number
        and does not apply this filter.                                        */
    CASE WHEN i.activity_cd = 'A' THEN 1 ELSE 0 END AS is_active
FROM        mac.imitmidx_sql          AS i
LEFT JOIN   mac.imcatfil_sql          AS c   ON c.prod_cat = i.prod_cat
LEFT JOIN   mac.iminvloc_sql          AS loc ON loc.item_no = i.item_no
                                            AND loc.loc = 'MAIN'
LEFT JOIN   cpq.technology_category   AS tc  ON tc.prod_cat = i.prod_cat
LEFT JOIN   cpq.item_profile          AS p   ON p.item_no = i.item_no
                                            AND p.is_quotable = 1
LEFT JOIN   cpq.category_discount_map AS dm  ON dm.prod_cat = i.prod_cat
/*  An item with no technology on either route is not quotable at all. This is
    the clause that keeps the list empty until the mapping is done.           */
WHERE COALESCE(p.technology_cd, tc.technology_cd) IS NOT NULL;
GO

/*------------------------------------------------------------------------------
  Item caps, folded in.

  cpq.item_discount_cap is written by the rule seed and by the admin screen. The
  engine reads caps from the rules themselves so the trace can name the rule
  that bit, but this view exists for the admin screen, which needs to answer
  "what is capped, and by what" without evaluating a quote.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.v_item_cap') IS NOT NULL DROP VIEW cpq.v_item_cap;
GO
CREATE VIEW cpq.v_item_cap
AS
SELECT  cap.item_no,
        cap.technology_cd,
        cap.max_discount,
        cap.rule_code,
        r.summary       AS rule_summary,
        r.source_ref,
        r.author,
        i.description,
        i.list_price
FROM        cpq.item_discount_cap AS cap
LEFT JOIN   cpq.rule              AS r ON r.rule_code = cap.rule_code
LEFT JOIN   cpq.v_quotable_item   AS i ON i.item_no  = cap.item_no;
GO

/*------------------------------------------------------------------------------
  Customers with something open.

  cpq.v_customer_open_orders (03_planning_links.sql) is one row per ORDER. The
  customer search needs one row per CUSTOMER — "who has work outstanding, and
  how much of it is late" — which is what a rep sees before picking anybody.

  Requires 03_planning_links.sql. If that has not been run this view will not
  compile, which is the right way to find out.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.v_customer_open_summary') IS NOT NULL DROP VIEW cpq.v_customer_open_summary;
GO
CREATE VIEW cpq.v_customer_open_summary
AS
SELECT
    o.cus_no                                             AS customer_no,
    MAX(o.cus_name)                                      AS customer_name,
    COUNT(*)                                             AS open_orders,
    SUM(CASE WHEN o.late_lines > 0 THEN 1 ELSE 0 END)    AS late_orders,
    MIN(o.earliest_due_dt)                               AS earliest_due_dt,
    MAX(o.worst_days_late)                               AS worst_days_late
FROM cpq.v_customer_open_orders AS o
GROUP BY o.cus_no;
GO

PRINT '---------------------------------------------------------------';
PRINT ' Service objects created.';
PRINT '';
PRINT ' cpq.v_quotable_item returns 0 rows until cpq.technology_category';
PRINT ' or cpq.item_profile is populated. That is expected on a fresh';
PRINT ' install - it is the mapping decision, not a fault.';
PRINT '---------------------------------------------------------------';
GO
