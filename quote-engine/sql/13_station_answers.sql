/*  13_station_answers.sql
    ------------------------------------------------------------------------------
    What one solution on a quote answers differently from the rest of it.

    A quote holds one application. That is honest for what is true of the LINE and the
    room — both machines sit on the same conveyor, in the same air, at the same speed —
    and wrong for what is true of a POSITION on it. The date code on the bottle is not
    the height of the text on the case label, and the printhead is not the same distance
    from both.

    Measured against the shipped rules, 18 of the 21 price-book pairs share at least one
    station-level question: CIJ+TTO shares character height and substrate; PIJ+VIJ shares
    barcode, mark height, substrate and throw distance. Before this, one answer served
    two stations and nothing on the quote said so.

    WHY JSON AND NOT COLUMNS

    The alternative is a cpq.quote_station table with one nullable column per overridable
    question — sixteen of them, every one duplicating a column already on cpq.quote, and
    every new application question needing two migrations instead of one. The engines
    treat this as a sparse patch and never query inside it; nothing joins on it, nothing
    filters on it, and the reporting star reads the quote's own columns. A blob is the
    honest shape for a value that is only ever read whole.

    Sparse on purpose: a field absent means "same as the line". An empty object is not
    written, so a quote with one solution carries NULL and reads exactly as it did.

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

IF COL_LENGTH('cpq.quote', 'solution_profiles') IS NULL
BEGIN
    ALTER TABLE cpq.quote ADD solution_profiles nvarchar(max) NULL;
    PRINT ' cpq.quote.solution_profiles added.';
END
ELSE
    PRINT ' cpq.quote.solution_profiles already present — nothing to do.';
GO

/*  It has to be JSON if it is anything. A malformed blob would be read by the engine as
    "no station answers", which is the failure mode this whole change exists to remove:
    a quote graded against one station's answers with nothing saying so.  */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_quote_solution_profiles')
    ALTER TABLE cpq.quote ADD CONSTRAINT ck_quote_solution_profiles
        CHECK (solution_profiles IS NULL OR ISJSON(solution_profiles) = 1);
GO

PRINT '';
PRINT ' Quotes where a station answers differently:';
PRINT '   SELECT quote_no, solution_profiles FROM cpq.quote';
PRINT '   WHERE solution_profiles IS NOT NULL;';
GO
