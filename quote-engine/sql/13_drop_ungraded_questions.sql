/*  13_drop_ungraded_questions.sql
    ------------------------------------------------------------------------------
    Three questions the tool no longer asks.

        cpq.quote.product_height_mm
        cpq.quote.shifts_per_day
        cpq.quote.max_chars_per_line

    A question the tool asks, stores, prints on the customer's copy and then ignores
    when grading is worse than one it does not ask: the customer answers it, sees it
    restated on the quote, and reasonably concludes it changed the recommendation.

    Nothing states a limit for any of these. Every datasheet, spec sheet, brochure,
    captured product page and vendor document in the repository was searched, and
    none of the three is on Axim's own App Analysis form either — the form that
    is filled in with every TIJ and VIJ order.

    That form is why only three went. Product Temp, Product Spacing, Product Width,
    Product Length, Dry Time Required and Permanence of Mark are all on it by name,
    so they are questions Axim asks with every order. They stay, ungraded and
    declared as such in web/src/engine/ruleCoverage.test.ts, until a document settles
    them.

    NOTHING HAS EVER RUN AGAINST A DATABASE, so there is no answer to lose here. On
    an installation that does hold data, read the note below before running this.
*/

SET NOCOUNT ON;
GO

IF SCHEMA_ID('cpq') IS NULL
BEGIN
    RAISERROR('cpq schema is missing — run 01_foundation.sql first.', 16, 1);
    RETURN;
END
GO

/*  Say what would be lost before losing it.

    A dropped column cannot be restored from a backup without restoring the whole
    table, so this counts first and refuses to guess on the operator's behalf. If any
    quote carries one of these answers, the drop is skipped and the count is printed:
    somebody then decides whether that answer was worth anything, which is a question
    about the business rather than about the schema.  */
DECLARE @answered int = 0;

IF COL_LENGTH('cpq.quote', 'product_height_mm') IS NOT NULL
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM cpq.quote WHERE product_height_mm IS NOT NULL',
         N'@n int OUTPUT', @n = @answered OUTPUT;
IF @answered > 0 PRINT CONCAT(' product_height_mm holds ', @answered, ' answers.');

DECLARE @a2 int = 0, @a3 int = 0;
IF COL_LENGTH('cpq.quote', 'shifts_per_day') IS NOT NULL
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM cpq.quote WHERE shifts_per_day IS NOT NULL',
         N'@n int OUTPUT', @n = @a2 OUTPUT;
IF @a2 > 0 PRINT CONCAT(' shifts_per_day holds ', @a2, ' answers.');

IF COL_LENGTH('cpq.quote', 'max_chars_per_line') IS NOT NULL
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM cpq.quote WHERE max_chars_per_line IS NOT NULL',
         N'@n int OUTPUT', @n = @a3 OUTPUT;
IF @a3 > 0 PRINT CONCAT(' max_chars_per_line holds ', @a3, ' answers.');

IF (@answered + @a2 + @a3) > 0
BEGIN
    PRINT '';
    PRINT ' NOT DROPPED. One or more of these columns holds answers a rep typed in.';
    PRINT ' The tool has stopped asking and stopped storing them either way; the';
    PRINT ' columns are now inert rather than wrong. Drop them by hand once somebody';
    PRINT ' has decided the answers are not worth keeping.';
    RETURN;
END
GO

IF COL_LENGTH('cpq.quote', 'product_height_mm') IS NOT NULL
BEGIN
    ALTER TABLE cpq.quote DROP COLUMN product_height_mm;
    PRINT ' cpq.quote.product_height_mm dropped.';
END
GO
IF COL_LENGTH('cpq.quote', 'shifts_per_day') IS NOT NULL
BEGIN
    ALTER TABLE cpq.quote DROP COLUMN shifts_per_day;
    PRINT ' cpq.quote.shifts_per_day dropped.';
END
GO
IF COL_LENGTH('cpq.quote', 'max_chars_per_line') IS NOT NULL
BEGIN
    ALTER TABLE cpq.quote DROP COLUMN max_chars_per_line;
    PRINT ' cpq.quote.max_chars_per_line dropped.';
END
GO

PRINT '';
PRINT ' Re-run 09_application_profile.sql afterwards: the completeness view counts';
PRINT ' the profile columns and no longer counts these three.';
GO
