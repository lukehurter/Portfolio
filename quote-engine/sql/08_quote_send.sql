/*==============================================================================
  Axim CPQ — what was sent, and to whom
  ------------------------------------------------------------------------------
  Run after 07_application_rules.sql.

  A new migration rather than an edit to 01_foundation.sql. Editing a script that
  may already have run somewhere means the two copies of the schema silently
  differ, and nothing tells you which one you are looking at. Additive migrations
  are the only kind that can be reasoned about after the first deployment.

  WHY THESE TWO COLUMNS

  The send flow asks for a recipient and a covering note before anything leaves,
  and refuses to send without them. Until now neither was stored, so a sent quote
  could not answer the first question anybody asks about it: who did this go to?

  Both are nullable because a draft has neither. They are populated at submit,
  which is also when the quote is re-evaluated — so the address recorded here is
  the address the priced numbers went to.

  NOTHING HERE HAS BEEN RUN. Treat the first execution as a test on a restored
  copy, as with every other script in this folder.
==============================================================================*/

SET NOCOUNT ON;
GO
USE [AximQuote];
GO

IF COL_LENGTH('cpq.quote', 'recipient_email') IS NULL
    ALTER TABLE cpq.quote ADD recipient_email nvarchar(200) NULL;
GO

IF COL_LENGTH('cpq.quote', 'covering_note') IS NULL
    ALTER TABLE cpq.quote ADD covering_note nvarchar(2000) NULL;
GO

/*  Sent quotes with no recipient recorded.
    Empty is the correct result. A row here is either a quote sent before this
    migration or a bug in the submit path, and both are worth seeing.          */
IF OBJECT_ID('cpq.v_sent_without_recipient') IS NOT NULL
    DROP VIEW cpq.v_sent_without_recipient;
GO
CREATE VIEW cpq.v_sent_without_recipient
AS
SELECT quote_no, rep_username, customer_name, sent_at, order_total
FROM   cpq.quote
WHERE  status IN ('sent', 'won', 'lost')
  AND (recipient_email IS NULL OR LTRIM(RTRIM(recipient_email)) = '');
GO

PRINT '---------------------------------------------------------------';
PRINT ' Send fields added to cpq.quote.';
PRINT '';
PRINT ' cpq.v_sent_without_recipient should be empty. Anything in it was';
PRINT ' either sent before this migration or reveals a bug in submit.';
PRINT '---------------------------------------------------------------';
GO
