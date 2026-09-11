/*  12_rule_action_columns.sql
    ------------------------------------------------------------------------------
    Three columns a narrowing rule cannot work without.

    cpq.rule_action carries a column for every field an action uses — quantity,
    max_discount, approver_role, allowance_amt, remedy — except the three a `narrow`
    action needs. So a narrowing rule could be written, evaluated in the preview,
    generated into SQL, read back by the service, and narrow nothing: the matcher
    naming what to compare, the attribute to compare it against and the roles to
    exempt all had nowhere to go.

    That was not visible from either side. The preview reads the rules out of a
    generated TypeScript file where the fields are present, and the service reads them
    out of a table where they never arrive, and both are silent about it.

    Two narrowing rules exist today, N-POROSITY and N-INK-COLOUR, and both are how a
    rep stops being offered a white ink for a black print or a non-porous consumable
    for a porous substrate. In production, without these columns, they offered
    everything.

    Fresh installs get these from 01_foundation.sql. Safe to run more than once.
*/

SET NOCOUNT ON;
GO

IF SCHEMA_ID('cpq') IS NULL
BEGIN
    RAISERROR('cpq schema is missing — run 01_foundation.sql first.', 16, 1);
    RETURN;
END
GO

/*  What the action compares. 'porosity' and 'inkColour' today — the name of the
    comparison the engine implements, not a column of anything.  */
IF COL_LENGTH('cpq.rule_action', 'matcher') IS NULL
BEGIN
    ALTER TABLE cpq.rule_action ADD matcher varchar(40) NULL;
    PRINT ' cpq.rule_action.matcher added.';
END
ELSE PRINT ' cpq.rule_action.matcher already present.';
GO

/*  The item attribute it compares against: 'Surface', 'Color'. These are the
    attribute names the price pages use, so the width matches attr_name on
    cpq.rule_trigger rather than being chosen fresh.  */
IF COL_LENGTH('cpq.rule_action', 'attribute') IS NULL
BEGIN
    ALTER TABLE cpq.rule_action ADD attribute nvarchar(60) NULL;
    PRINT ' cpq.rule_action.attribute added.';
END
ELSE PRINT ' cpq.rule_action.attribute already present.';
GO

/*  Roles the narrowing does NOT apply to, comma separated — 'ink,consumable,part'.

    Stored as a list in one column rather than a child table because it is a short,
    closed set written by hand in the rule file and never queried across rules. A
    table would be three joins to answer a question nobody asks.  */
IF COL_LENGTH('cpq.rule_action', 'deny_roles') IS NULL
BEGIN
    ALTER TABLE cpq.rule_action ADD deny_roles nvarchar(200) NULL;
    PRINT ' cpq.rule_action.deny_roles added.';
END
ELSE PRINT ' cpq.rule_action.deny_roles already present.';
GO

PRINT '';
PRINT ' Re-run sql/07_application_rules.sql after this: the generated file now';
PRINT ' writes these three columns, and the rules already in the table do not have';
PRINT ' them. Until it is re-run, narrowing stays off.';
GO
