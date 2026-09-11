/*  11_optional_lines.sql
    ------------------------------------------------------------------------------
    One column, so a line marked optional stays optional.

    REPORTED: "Marking something as optional during quote building doesn't actually
    do anything on the customer copy, they should be in an optional section, so they
    know what's available to buy."

    Everything needed to honour that already existed except somewhere to put it. Both
    engines take optional lines out of the totals and subtotal them separately
    (api/engine.py, web/src/engine/evaluate.ts), and the customer's copy already draws
    them under "Also available, not included above". What did not exist was a column:
    cpq.quote_line stored thirteen fields and this was not one of them, so the flag
    lived exactly as long as the rep's browser session. Set it, save, reopen — and it
    was back in the price, which is the worst way for it to fail, because the total the
    customer reads is then higher than the one the rep agreed.

    Fresh installs get this from 01_foundation.sql. This file is for a database that
    already exists, and is safe to run more than once.

    Read-only against Orbit, like everything else here. Nothing in this file touches
    any schema but cpq.
*/

SET NOCOUNT ON;
GO

IF SCHEMA_ID('cpq') IS NULL
BEGIN
    RAISERROR('cpq schema is missing — run 01_foundation.sql first.', 16, 1);
    RETURN;
END
GO

/*  NOT NULL with a default rather than a nullable bit.

    A nullable flag has three states and the question has two: a line is offered or it
    is bought. NULL would mean "nobody has said", which no part of the app can produce
    and every part of it would then have to decide what to do with. Existing rows are
    lines somebody committed to, so 0 is not a guess.  */
IF COL_LENGTH('cpq.quote_line', 'is_optional') IS NULL
BEGIN
    ALTER TABLE cpq.quote_line ADD is_optional bit NOT NULL
        CONSTRAINT df_quote_line_is_optional DEFAULT 0;
    PRINT ' cpq.quote_line.is_optional added, existing lines set to 0 (bought).';
END
ELSE
    PRINT ' cpq.quote_line.is_optional already present — nothing to do.';
GO

/*  A quote whose every line is optional has a total of zero and reads as free.
    Not enforced as a constraint: a rep part-way through building a quote can
    legitimately have one optional line and nothing else on it yet, and a constraint
    that fires while somebody is typing is a constraint that gets dropped. It is
    listed here so the reporting side knows to look for it.  */
PRINT '';
PRINT ' Worth watching: a sent quote on which every line is optional.';
PRINT '   SELECT q.quote_no FROM cpq.quote q';
PRINT '   JOIN cpq.quote_line l ON l.quote_id = q.quote_id';
PRINT '   WHERE q.status = ''sent''';
PRINT '   GROUP BY q.quote_no HAVING MIN(CAST(l.is_optional AS int)) = 1;';
GO
