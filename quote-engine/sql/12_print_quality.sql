/*  12_print_quality.sql
    ------------------------------------------------------------------------------
    One column: what the printed code has to be good enough for.

    Sixteen rules already reasoned about resolution and every one of them triggered on
    a proxy — line speed, the barcode box, air at the printhead — because nothing in the
    application said what the print was FOR. So each of them could describe the trade
    between resolution and speed and none could come down on a side.

    The machines' own specifications carry the figure. The valve jets are 8 x 25 and
    9 x 25 DPI; the thermal jets are 300 x 300. That is more than thirty times across
    the web, and the only thing separating them on a quote was whether somebody had
    typed something into the barcode box.

    Four values rather than a number, because these are the four a customer can answer
    without being asked to know what 300 dpi means:

        humanReadable   a date, lot or batch code somebody reads
        scannable       a barcode that has to scan
        graded          a barcode checked to a grade
        graphics        a logo, or retail-quality print

    The mapping from these to dpi lives in the rules, where each one cites the
    specification it came from. It is deliberately NOT in this column: a threshold in a
    schema is a threshold nobody can check.

    Safe to run more than once. Read-only against Orbit, like everything here.
*/

SET NOCOUNT ON;
GO

IF SCHEMA_ID('cpq') IS NULL
BEGIN
    RAISERROR('cpq schema is missing — run 01_foundation.sql first.', 16, 1);
    RETURN;
END
GO

/*  Nullable, and null means "not asked" rather than "no requirement".
    That distinction is the same one no_constraint exists for elsewhere: a rep who has
    not got to this question yet must not have their machines graded as though the
    customer had said a date code was enough.  */
IF COL_LENGTH('cpq.quote', 'print_quality') IS NULL
BEGIN
    ALTER TABLE cpq.quote ADD print_quality varchar(20) NULL;
    PRINT ' cpq.quote.print_quality added.';
END
ELSE
    PRINT ' cpq.quote.print_quality already present — nothing to do.';
GO

/*  A check constraint rather than a lookup table.
    Four values that change when a datasheet changes, which is never; a table would be
    four rows and a join on every read.  */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_quote_print_quality')
    ALTER TABLE cpq.quote ADD CONSTRAINT ck_quote_print_quality
        CHECK (print_quality IS NULL OR print_quality IN
               ('humanReadable', 'scannable', 'graded', 'graphics'));
GO

PRINT '';
PRINT ' Answered on a quote:';
PRINT '   SELECT print_quality, COUNT(*) FROM cpq.quote GROUP BY print_quality;';
GO
