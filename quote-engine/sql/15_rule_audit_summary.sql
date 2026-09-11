/*  15_rule_audit_summary.sql
    ------------------------------------------------------------------------------
    The column that made saving a rule impossible.

    cpq.rule_audit never had a `summary` column. api/repo.py writes one on every rule
    save and reads one back for the history panel, and RuleAuditEntry in
    web/src/api/types.ts declares it, so all three sides agreed the column existed and
    the table did not have it.

    That is not a degraded history panel. The audit insert shares the rule save's
    transaction — deliberately, so a rule edit that is not audited cannot happen — so
    the failed insert rolls the save back with it. Every attempt to save a rule from
    the admin screen would have failed on the first run against a real database, and
    that screen is the one the whole requirement rests on.

    Found by comparing every column api/ writes against the columns sql/ defines,
    which is now tests/test_schema_parity.py. Two of these existed; the other was
    cpq.access_log, where the app inserted into `action` and the column is `event`.
    That one is fixed in the caller rather than here: the column name was right and
    the query was wrong.

    Idempotent. Fresh installs get the column from 01_foundation.sql; this is for a
    database created before it was added there.
*/

SET NOCOUNT ON;
GO

IF SCHEMA_ID('cpq') IS NULL
BEGIN
    RAISERROR('cpq schema is missing — run 01_foundation.sql first.', 16, 1);
    RETURN;
END
GO

/*  Nullable, and no default. Rows written before this are edits whose one-line
    description was never captured, and inventing one for them — "Edited in the admin
    screen" — would put words into the audit trail that nobody typed. A blank summary
    on an old row is the truth about that row.  */
IF COL_LENGTH('cpq.rule_audit', 'summary') IS NULL
BEGIN
    ALTER TABLE cpq.rule_audit ADD summary nvarchar(300) NULL;
    PRINT ' cpq.rule_audit.summary added.';
END
ELSE
    PRINT ' cpq.rule_audit.summary already present — nothing to do.';
GO

PRINT '';
PRINT ' Rule edits, newest first:';
PRINT '   SELECT rule_code, action, changed_by, changed_at, summary';
PRINT '   FROM cpq.rule_audit ORDER BY changed_at DESC;';
GO
