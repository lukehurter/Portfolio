/*  16_label_size.sql
    ------------------------------------------------------------------------------
    Two columns for the two questions the label rules are written about.

    The application asks how wide and how long the label is. The screen asks it, the
    parser reads it, engine-cases.json exercises it, and nineteen shipped fit rules
    trigger on it — sixteen on labelWidthMm and three on labelLengthMm, which makes
    label width the fourth most-read field in the whole rule set.

    cpq.quote had nowhere to put either of them. Not "stored in the wrong column" —
    no column at all, and no entry in repo.PROFILE_COLS, so the answer reached the
    service and stopped there. A rep would fill it in, the quote would save, and
    reopening it would show the question unanswered with nineteen rules quietly not
    firing against it.

    Found by comparing web/src/api/types.ts against models.ApplicationProfile, which
    is now tests/test_draft_contract.py. The same comparison found twenty-one profile
    fields that Pydantic was deleting at the wire; those needed no schema change,
    because 09_application_profile.sql had already added their columns. These two are
    the only ones the schema genuinely lacked.

    Idempotent. Read-only against Orbit, like everything here.
*/

SET NOCOUNT ON;
GO

IF SCHEMA_ID('cpq') IS NULL
BEGIN
    RAISERROR('cpq schema is missing — run 01_foundation.sql first.', 16, 1);
    RETURN;
END
GO

/*  decimal rather than int: a label is quoted in millimetres to one place often
    enough, and the matching profile fields are numbers on both sides of the wire.
    Nullable, because unanswered and zero are different answers — a zero-width label
    is not a thing, and a rule reading it as one would grade against nonsense.  */
IF COL_LENGTH('cpq.quote', 'label_width_mm') IS NULL
BEGIN
    ALTER TABLE cpq.quote ADD label_width_mm decimal(9,2) NULL;
    PRINT ' cpq.quote.label_width_mm added.';
END
ELSE
    PRINT ' cpq.quote.label_width_mm already present — nothing to do.';
GO

IF COL_LENGTH('cpq.quote', 'label_length_mm') IS NULL
BEGIN
    ALTER TABLE cpq.quote ADD label_length_mm decimal(9,2) NULL;
    PRINT ' cpq.quote.label_length_mm added.';
END
ELSE
    PRINT ' cpq.quote.label_length_mm already present — nothing to do.';
GO

/*------------------------------------------------ the completeness view ---*/

/*  Recreated here rather than corrected in 09, because it can only be right once
    every column it counts exists — and print_quality arrives in 12, label size in
    this file. A view naming a column that is two migrations away fails to create on
    a fresh install, which is why print_quality was never added to it.

    It summed twenty-five fields and reported them out of twenty-eight, so a fully
    answered application read as 25/28 and three questions could never be counted:
    print quality, label width, label length. The number under-reported the evidence a
    grading rests on, which is the one thing this view exists to state.  */
IF OBJECT_ID('cpq.v_quote_profile_completeness') IS NOT NULL
    DROP VIEW cpq.v_quote_profile_completeness;
GO
CREATE VIEW cpq.v_quote_profile_completeness
AS
SELECT  q.quote_no,
        q.status,
        q.technology_cd,
        q.rep_username,
        q.customer_name,
        CASE WHEN q.sample_tested = 'yes' THEN 1 ELSE 0 END        AS sample_tested,
        (CASE WHEN q.substrate            IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.porosity             IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.product_width_mm     IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.product_length_mm    IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.product_temp_f       IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.label_width_mm       IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.label_length_mm      IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.line_speed_fpm       IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.throughput_ppm       IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.product_spacing_mm   IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.conveyor             IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.guide_rails          IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.product_motion       IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.char_height_mm       IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.throw_dist_mm        IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.lines_of_print       IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.marking_window_mm    IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.message_content      IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.barcode_requirements IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.print_quality        IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.ink_type             IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.dry_time_seconds     IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.environment          IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.ambient_temp_min_f   IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.ambient_temp_max_f   IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.adhesion_requirements IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.sample_tested        IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN q.profile_notes        IS NOT NULL THEN 1 ELSE 0 END) AS fields_captured,
        28                                                         AS fields_total
FROM    cpq.quote AS q;
GO

PRINT ' cpq.v_quote_profile_completeness recreated: 28 fields counted, 28 declared.';
PRINT '';
PRINT ' Quotes that answered the label size:';
PRINT '   SELECT quote_no, label_width_mm, label_length_mm FROM cpq.quote';
PRINT '   WHERE label_width_mm IS NOT NULL OR label_length_mm IS NOT NULL;';
GO
