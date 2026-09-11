/*==============================================================================
  Axim CPQ — the rest of the application profile
  ------------------------------------------------------------------------------
  Run after 08_quote_send.sql.

  Additive, like 08, and for the same reason: editing 01_foundation.sql once it
  has run somewhere leaves two copies of the schema that differ with nothing to
  say which is which.

  WHY TWENTY MORE COLUMNS

  cpq.quote captured eight things about the line. Axim's own application
  analysis forms ask for far more than eight, and they ask on every order — the
  CIJ, laser and TTO books use a sheet called CUSTOMER & CAE INFO, the label and
  piezo books use CUST AND APP INFO, and the thermal and valve jet books use one
  called App Analysis. Between them they ask about product size, throughput,
  spacing, conveyor, guide rails, ambient range, dry time, adhesion and whether a
  sample was ever tested.

  Those questions are not decoration. Several are the difference between a rule
  firing and staying silent: the Ridgeline print-height rules need the marking
  window, the guide-rail rules need to know there are none, and the Ridgeline and
  PL6300 temperature ratings need an ambient figure rather than a product one.
  Capturing the questions the business already asks is also what lets a rep stop
  keeping a second form beside this tool.

  EVERY COLUMN IS NULLABLE, AND THAT IS THE POINT

  A quote is written the moment a rep starts it, long before most of this is
  known. NULL means "not captured yet". It does not mean "no constraint" — that
  is a different statement, held separately in no_constraint, because a field the
  customer genuinely has no limit on must silence the rules that read it rather
  than leave them waiting for a number that will never come.

  PRODUCT TEMPERATURE IS NOT AMBIENT TEMPERATURE

  product_temp_f is how hot the pack is; ambient_temp_min_f and ambient_temp_max_f
  are how hot the room is. The datasheets rate the machine against the room, so a
  rule that read the pack temperature would be citing a figure about the wrong
  thing. Both are captured because both matter, to different rules.

  NO_CONSTRAINT WAS NEVER STORED

  The engine has always honoured no_constraint — api/engine.py skips any rule
  reading a field the customer has no limit on. Nothing wrote it down. So the
  distinction held while the rep had the quote open and was lost the moment it
  was reopened, and the silenced rules came back with no record of why they had
  been silenced. That is the bug this column closes.

  NOTHING HERE HAS BEEN RUN. Treat the first execution as a test on a restored
  copy, as with every other script in this folder.
==============================================================================*/

SET NOCOUNT ON;
GO
USE [AximQuote];
GO

/*---------------------------------------------------------------------------
  The product on the line
---------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'product_width_mm') IS NULL
    ALTER TABLE cpq.quote ADD product_width_mm decimal(8,2) NULL;
GO
IF COL_LENGTH('cpq.quote', 'product_length_mm') IS NULL
    ALTER TABLE cpq.quote ADD product_length_mm decimal(8,2) NULL;
GO
GO
IF COL_LENGTH('cpq.quote', 'product_temp_f') IS NULL
    ALTER TABLE cpq.quote ADD product_temp_f int NULL;
GO

/*---------------------------------------------------------------------------
  How the line runs

  throughput_ppm and line_speed_fpm are both asked for on every form and are
  not derivable from each other without the product spacing, which is why all
  three are here. A slow belt carrying densely packed product and a fast belt
  carrying spaced product can print the same number of packs a minute and need
  different machines.
---------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'throughput_ppm') IS NULL
    ALTER TABLE cpq.quote ADD throughput_ppm int NULL;
GO
IF COL_LENGTH('cpq.quote', 'product_spacing_mm') IS NULL
    ALTER TABLE cpq.quote ADD product_spacing_mm decimal(8,2) NULL;
GO
IF COL_LENGTH('cpq.quote', 'conveyor') IS NULL
    ALTER TABLE cpq.quote ADD conveyor varchar(10) NULL;        -- new|existing
GO
IF COL_LENGTH('cpq.quote', 'guide_rails') IS NULL
    ALTER TABLE cpq.quote ADD guide_rails varchar(3) NULL;      -- yes|no
GO
IF COL_LENGTH('cpq.quote', 'product_motion') IS NULL
    ALTER TABLE cpq.quote ADD product_motion varchar(12) NULL;  -- moving|stationary
GO

/*---------------------------------------------------------------------------
  What gets printed
---------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'lines_of_print') IS NULL
    ALTER TABLE cpq.quote ADD lines_of_print int NULL;
GO
GO
IF COL_LENGTH('cpq.quote', 'marking_window_mm') IS NULL
    ALTER TABLE cpq.quote ADD marking_window_mm decimal(8,2) NULL;
GO
IF COL_LENGTH('cpq.quote', 'barcode_requirements') IS NULL
    ALTER TABLE cpq.quote ADD barcode_requirements nvarchar(300) NULL;
GO

/*---------------------------------------------------------------------------
  Ink and adhesion
---------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'ink_type') IS NULL
    ALTER TABLE cpq.quote ADD ink_type nvarchar(120) NULL;
GO
IF COL_LENGTH('cpq.quote', 'dry_time_seconds') IS NULL
    ALTER TABLE cpq.quote ADD dry_time_seconds decimal(8,2) NULL;
GO
IF COL_LENGTH('cpq.quote', 'adhesion_requirements') IS NULL
    ALTER TABLE cpq.quote ADD adhesion_requirements nvarchar(300) NULL;
GO

/*---------------------------------------------------------------------------
  The room, not the pack
---------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'ambient_temp_min_f') IS NULL
    ALTER TABLE cpq.quote ADD ambient_temp_min_f int NULL;
GO
IF COL_LENGTH('cpq.quote', 'ambient_temp_max_f') IS NULL
    ALTER TABLE cpq.quote ADD ambient_temp_max_f int NULL;
GO

/*---------------------------------------------------------------------------
  Was it ever tried?

  Every form asks whether a sample was run, and it is the single most useful
  thing on the sheet: a tested sample turns every other answer from an estimate
  into a measurement. It is captured so a reviewer can see which quotes rest on
  a test and which rest on a phone call.
---------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'sample_tested') IS NULL
    ALTER TABLE cpq.quote ADD sample_tested varchar(3) NULL;    -- yes|no
GO
IF COL_LENGTH('cpq.quote', 'profile_notes') IS NULL
    ALTER TABLE cpq.quote ADD profile_notes nvarchar(2000) NULL;
GO

/*---------------------------------------------------------------------------
  Fields the customer has no constraint on.

  Stored as a comma-separated list of profile field names. A field named here is
  deliberately unconstrained, and the engine skips any rule that reads it — as
  opposed to a NULL column, which only means nobody has asked yet.

  The list is short and read as a whole, never joined against, so a delimited
  column is honest about how it is used. A child table would imply a query
  nothing performs.
---------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'no_constraint') IS NULL
    ALTER TABLE cpq.quote ADD no_constraint nvarchar(600) NULL;
GO

/*---------------------------------------------------------------------------
  Recreate cpq.fn_visible_quotes.

  It is an inline table-valued function whose body is SELECT q.* FROM cpq.quote.
  SQL Server expands that star when the function is created and does not revisit
  it, so every column added above is invisible to the function — and therefore to
  the application, which reads quotes only through it — until the function is
  recreated. The symptom would be an "Invalid column name" on the first quote
  opened after this migration, which is a poor way to find out.

  The body below is identical to the one in 02_security.sql. It is repeated here
  rather than referenced because a migration has to be runnable on its own.
---------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.fn_visible_quotes') IS NOT NULL DROP FUNCTION cpq.fn_visible_quotes;
GO
CREATE FUNCTION cpq.fn_visible_quotes (@username nvarchar(100), @role varchar(20))
RETURNS TABLE
AS
RETURN
(
    SELECT q.*
    FROM cpq.quote q
    WHERE @role = 'admin'
       OR q.rep_username = @username
       OR (@role = 'approver' AND EXISTS (
             SELECT 1 FROM cpq.quote_approval a
             WHERE a.quote_id = q.quote_id AND a.approver_user = @username))
       OR EXISTS (
             SELECT 1 FROM cpq.rep_customer rc
             WHERE rc.username = @username AND rc.customer_no = q.customer_no)
);
GO

/*  How complete is the captured profile, per quote?

    Not a validation gate — a quote is allowed to be incomplete, and most are
    early on. This is for the person asking why a configuration graded 'good'
    with nothing to go on: a quote answering four of twenty-eight questions has
    silenced most of the rule set by omission rather than by judgement.        */
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

PRINT '---------------------------------------------------------------';
PRINT ' Application profile extended on cpq.quote.';
PRINT '';
PRINT ' 18 nullable columns added, plus no_constraint.';
PRINT '';
PRINT ' cpq.fn_visible_quotes was recreated. It selects q.*, which SQL';
PRINT ' Server froze when the function was created, so without this the';
PRINT ' new columns would not exist as far as the application is';
PRINT ' concerned. If you edit cpq.quote again, recreate it again.';
PRINT '';
PRINT ' NULL means not captured yet. no_constraint means the customer';
PRINT ' has no limit, which silences the rules that read that field.';
PRINT ' They are different statements and are stored differently.';
PRINT '';
PRINT ' cpq.v_quote_profile_completeness shows how much of the profile';
PRINT ' each quote answered. A low count is not an error, but it does';
PRINT ' explain a configuration that graded well with little evidence.';
PRINT '---------------------------------------------------------------';
GO
