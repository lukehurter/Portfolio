/*  14_solutions.sql
    ------------------------------------------------------------------------------
    Solutions become things, instead of being price books wearing a hat.

    WHAT WAS WRONG

    13_station_answers.sql keyed a station's answers by price book:
    solution_profiles held {"CIJ": {...}, "PALM": {...}}, and a line belonged to a
    station by way of its item's technology. That works exactly as long as no quote
    ever wants two stations from one book — and a rep quoting two production lines
    that each need a CIJ coder is the ordinary case, not the exotic one. The second
    station had nowhere to put its answers, its lines could not be told from the
    first's, and the control for adding one hid every book already in use.

    REPORTED: "adding another solution to a quote is a half-done process. It should
    literally be the same process as the first solution. Except, it may be a
    different line or application name."

    WHAT THIS ADDS

      cpq.quote.solutions        the stations, as JSON: id, name, technology, and
                                 the application answers that station gives its own
      cpq.quote_line.solution_id which station a line serves

    A line's station is now stated rather than inferred. That is what lets two CIJ
    coders keep their lines and their gradings apart, and it is what the engines
    read: fit is assessed per (solution, item), so one printhead quoted at two
    stations is graded twice against two applications.

    WHY JSON, STILL

    The argument from 13 is unchanged and now stronger. The alternative is a
    cpq.quote_station table with one nullable column per overridable question —
    twenty-eight of them, every one duplicating a column already on cpq.quote, and
    every new application question needing two migrations instead of one. The
    engines treat a station's profile as a sparse patch and never query inside it;
    nothing joins on it, nothing filters on it, and the reporting star reads the
    quote's own columns. A blob is the honest shape for a value only ever read
    whole.

    What is NOT a blob is solution_id. That one is a key — it is joined on, it is
    filtered on, and a line pointing at a station that does not exist is a fault
    worth catching — so it is a column with a real check on it.

    Sparse on purpose: a solution with no profile carries none, and a field absent
    from a profile means "as the quote says". A one-solution quote reads exactly as
    it did.

    solution_profiles is left alone. It is superseded and nothing reads it, but this
    repository has never run against a database and dropping a column on the
    strength of that assumption is how a migration destroys the one installation
    where it was wrong. The block at the bottom reports whether it holds anything.

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

/*---------------------------------------------------------------- the stations ---*/

IF COL_LENGTH('cpq.quote', 'solutions') IS NULL
BEGIN
    ALTER TABLE cpq.quote ADD solutions nvarchar(max) NULL;
    PRINT ' cpq.quote.solutions added.';
END
ELSE
    PRINT ' cpq.quote.solutions already present — nothing to do.';
GO

/*  It has to be JSON if it is anything. A malformed blob would be read by the app as
    "no stations", and every line on the quote would silently fall back to the quote's
    own application — which is the failure this change exists to remove.  */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_quote_solutions')
    ALTER TABLE cpq.quote ADD CONSTRAINT ck_quote_solutions
        CHECK (solutions IS NULL OR ISJSON(solutions) = 1);
GO

/*------------------------------------------------------ which station a line is for ---*/

IF COL_LENGTH('cpq.quote_line', 'solution_id') IS NULL
BEGIN
    /*  Nullable, and null is meaningful rather than missing: it is a line that belongs
        to the QUOTE rather than to a station — freight, an installation day, a training
        course — and it grades against the quote's own application. It is also what a
        quote raised before this migration carries, which reads the same way and is the
        answer those quotes already had.  */
    ALTER TABLE cpq.quote_line ADD solution_id varchar(20) NULL;
    PRINT ' cpq.quote_line.solution_id added.';
END
ELSE
    PRINT ' cpq.quote_line.solution_id already present — nothing to do.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_quote_line_solution'
                 AND object_id = OBJECT_ID('cpq.quote_line'))
    CREATE INDEX ix_quote_line_solution ON cpq.quote_line (quote_id, solution_id);
GO

/*------------------------------------------------------------------ what is left ---*/

/*  Say whether the superseded column holds anything before anybody decides to drop it.
    A dropped column cannot be restored from a backup without restoring the whole table,
    so this counts first and refuses to guess on the operator's behalf.  */
IF COL_LENGTH('cpq.quote', 'solution_profiles') IS NOT NULL
BEGIN
    DECLARE @held int = 0;
    EXEC sp_executesql
        N'SELECT @n = COUNT(*) FROM cpq.quote WHERE solution_profiles IS NOT NULL',
        N'@n int OUTPUT', @n = @held OUTPUT;
    IF @held > 0
        PRINT CONCAT(' cpq.quote.solution_profiles is superseded and holds ', @held,
                     ' row(s). Migrate them into cpq.quote.solutions before dropping it.');
    ELSE
        PRINT ' cpq.quote.solution_profiles is superseded and empty. Safe to drop by hand.';
END
GO

PRINT '';
PRINT ' Quotes with more than one station:';
PRINT '   SELECT quote_no, solutions FROM cpq.quote';
PRINT '   WHERE ISJSON(solutions) = 1 AND (SELECT COUNT(*) FROM OPENJSON(solutions)) > 1;';
PRINT '';
PRINT ' Lines whose station is not on their quote (should return nothing):';
PRINT '   SELECT l.quote_id, l.line_no, l.solution_id FROM cpq.quote_line l';
PRINT '   JOIN cpq.quote q ON q.quote_id = l.quote_id';
PRINT '   WHERE l.solution_id IS NOT NULL AND NOT EXISTS (';
PRINT '     SELECT 1 FROM OPENJSON(q.solutions) WITH (id varchar(20) ''$.id'') s';
PRINT '     WHERE s.id = l.solution_id);';
GO
