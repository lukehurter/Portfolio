/*==============================================================================
  Axim CPQ — users, roles and the approval chain
  ------------------------------------------------------------------------------
  Run after 01_foundation.sql.

  WHO SEES WHAT
    rep      own quotes, own customers' history. Cannot edit rules or policy.
    approver rep visibility, plus the quotes awaiting their decision.
    admin    everything, including rules, discount policy and the category maps.

  HOW SOMEBODY BECOMES AN ADMIN
    By Microsoft 365 group membership, not by a row someone typed here. IT
    group membership and has a process for it; duplicating that in the app would
    already manages it, and a list here would be a second, staler one.
    cpq.role_group maps a Microsoft 365 group -> role.
    cpq.app_user exists for what AD cannot answer: overrides, and who a rep's
    RSM is when the AD manager attribute is wrong or empty.

  WHO APPROVES A REP'S DISCOUNT
    Resolved in this order, first match wins:
      1. cpq.app_user.approver_override  - set by an admin in the tool
      2. the AD manager attribute        - synced into approver_ad, see below
      3. cpq.technology_approver          - a per-technology fallback
      4. nobody -> the quote is flagged as unroutable rather than silently sent
    The override exists because the AD manager attribute is frequently stale in
    practice, and an approval that routes to the wrong person is worse than one
    that routes nowhere.
==============================================================================*/

SET NOCOUNT ON;
GO
USE [AximQuote];
GO

/*------------------------------------------------------------------ roles ---*/
IF OBJECT_ID('cpq.app_role') IS NULL
CREATE TABLE cpq.app_role (
    role_cd     varchar(20)   NOT NULL PRIMARY KEY,
    description nvarchar(200) NOT NULL,
    rank        int           NOT NULL      -- higher wins when a user is in several groups
);
GO
MERGE cpq.app_role AS t
USING (VALUES
    ('rep',      N'Builds quotes. Sees own quotes and own customers'' history.', 10),
    ('approver', N'Rep rights, plus decides discount approvals routed to them.', 20),
    ('admin',    N'Everything, including rules, discount policy and mappings.',  30)
) AS s(cd, d, r) ON t.role_cd = s.cd
WHEN NOT MATCHED THEN INSERT (role_cd, description, rank) VALUES (s.cd, s.d, s.r);
GO

/*  Microsoft 365 group -> role. IT owns membership; this only says which
    means what. Seeded with placeholders that MUST be replaced before go-live.

    WHAT GOES IN ad_group DEPENDS ON THE TENANT. The app passes through whatever
    the token's group claim contains, and matches it here as plain text. A tenant
    emitting the 'groups' claim sends group OBJECT IDs -- GUIDs -- so that is what
    these rows must hold; one configured for app roles sends role names instead.
    CPQ_ENTRA_GROUPS_CLAIM in the service environment selects which claim is read,
    and these rows have to agree with it. The AXIM\... placeholders below are
    on-premises AD names, which is the one thing this will never receive.       */
IF OBJECT_ID('cpq.role_group') IS NULL
CREATE TABLE cpq.role_group (
    ad_group   nvarchar(200) NOT NULL PRIMARY KEY,
    role_cd    varchar(20)   NOT NULL,
    updated_by nvarchar(100) NULL,
    updated_at datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_rolegroup_role FOREIGN KEY (role_cd) REFERENCES cpq.app_role(role_cd)
);
GO
IF NOT EXISTS (SELECT 1 FROM cpq.role_group)
INSERT INTO cpq.role_group (ad_group, role_cd) VALUES
    (N'AXIM\CPQ-Reps',      'rep'),        -- <<< replace with the real group IDs
    (N'AXIM\CPQ-Approvers', 'approver'),
    (N'AXIM\CPQ-Admins',    'admin');
GO

/*----------------------------------------------------------------- users ----*/
IF OBJECT_ID('cpq.app_user') IS NULL
CREATE TABLE cpq.app_user (
    -- The token's preferred_username, which on this tenant is a UPN
    -- (someone@axim.example). NOT DOMAIN\user: that was the shape Windows
    -- integrated auth presented, and this app no longer uses it. approver_ad,
    -- approver_override and cpq.rep_customer.username all carry the same shape.
    username           nvarchar(100) NOT NULL PRIMARY KEY,
    display_name       nvarchar(150) NULL,
    email              nvarchar(200) NULL,
    -- synced from Microsoft 365; never edited by hand
    approver_ad        nvarchar(100) NULL,   -- the AD 'manager' attribute
    ad_title           nvarchar(150) NULL,
    ad_synced_at       datetime2(0)  NULL,
    -- set by an admin in the tool; wins over AD
    approver_override  nvarchar(100) NULL,
    override_reason    nvarchar(300) NULL,
    role_override      varchar(20)   NULL,   -- rarely needed; group membership is the norm
    is_active          bit           NOT NULL DEFAULT 1,
    first_seen_at      datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    last_seen_at       datetime2(0)  NULL,
    CONSTRAINT fk_appuser_role FOREIGN KEY (role_override) REFERENCES cpq.app_role(role_cd)
);
GO

/*  Fallback approver per technology, for when neither an override nor a usable
    AD manager exists. Better than dropping the request on the floor.         */
IF OBJECT_ID('cpq.technology_approver') IS NULL
CREATE TABLE cpq.technology_approver (
    technology_cd     varchar(10)   NOT NULL PRIMARY KEY,
    approver_username nvarchar(100) NOT NULL,
    updated_by        nvarchar(100) NULL,
    updated_at        datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_techapprover_tech FOREIGN KEY (technology_cd) REFERENCES cpq.technology(technology_cd)
);
GO

/*  Which customers a rep may see.

    THE SOURCE IS MICROSOFT DYNAMICS. Rep-to-account assignment lives there, not
    in Orbit and not in this tool, so this table is a projection of Dynamics and
    nothing else may be treated as authoritative. There is no maintenance screen
    in the app and there should not be one: a second place to edit an assignment
    is a second answer to the question.

    Nobody has access to that Dynamics instance yet, so the table stays EMPTY
    until the sync exists. Empty is safe, not broken: with no rows, a rep sees
    only the quotes they created themselves. What they lose is a colleague's quote
    for an account they share — visibility, never authority.

    `source` records where a row came from. Add 'dynamics' when the sync lands and
    leave 'manual' for any row a person had to enter in the meantime, so the two
    are always tellable apart.                                                 */
IF OBJECT_ID('cpq.rep_customer') IS NULL
CREATE TABLE cpq.rep_customer (
    username    nvarchar(100) NOT NULL,
    customer_no varchar(12)   NOT NULL,
    source      varchar(20)   NOT NULL DEFAULT 'manual',  -- dynamics|manual
    updated_at  datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_rep_customer PRIMARY KEY (username, customer_no)
);
GO

/*  Every sign-in and every privileged action. Rule edits already have their own
    audit; this covers logins, role resolution and approval decisions.        */
IF OBJECT_ID('cpq.access_log') IS NULL
CREATE TABLE cpq.access_log (
    log_id      bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    username    nvarchar(100) NOT NULL,
    -- What the person did, as repo.log_access is called with it: saveRule,
    -- classifyItems, createQuote, submitQuote, deleteQuote, approval:granted,
    -- technology.add, quote.lost and so on. It used to be documented as
    -- signin|denied|roleResolved, a vocabulary nothing has ever produced.
    event       varchar(40)   NOT NULL,
    detail      nvarchar(500) NULL,
    ip_address  varchar(45)   NULL,
    occurred_at datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_access_log_user' AND object_id=OBJECT_ID('cpq.access_log'))
    CREATE INDEX ix_access_log_user ON cpq.access_log (username, occurred_at DESC);
GO

/*------------------------------------------------------------- resolution ---*/

/*  The effective role for a user, given the Microsoft 365 groups the app passes in.
    Highest rank wins; role_override beats everything.

    RETURNS A TABLE, NOT A SCALAR, AND WHY

    api/auth.py reads two columns from this: the role, and where the role came
    from -- the top bar says "admin - from a Microsoft 365 group" rather than
    showing a role with no provenance, and an override has to be tellable apart
    from group membership because it is the break-glass path.

    It was a scalar function returning varchar(20) while auth.py selected
    `r.role_cd, r.role_source` out of it in a FROM clause. A scalar UDF cannot be
    used that way at all, so every authenticated request -- which is every request
    -- would have failed on the first run against a real database. Nothing caught
    it because the tests run under CPQ_DEMO=1, where db.cursor() raises before any
    query is sent.

    ZERO ROWS MEANS NO ACCESS. The app must deny, not default: auth.py treats an
    empty result as 403.

    @ad_groups IS NEWLINE-SEPARATED. Newline and not comma, because a Microsoft 365
    group display name may contain a comma and cannot contain a newline. auth.py
    joins the claim with a newline to match. These two disagreed -- the app joined with
    a comma while this searched for newline-delimited names -- so a user in exactly
    one group resolved and a user in two or more resolved to nothing.            */
IF OBJECT_ID('cpq.fn_effective_role') IS NOT NULL DROP FUNCTION cpq.fn_effective_role;
GO
CREATE FUNCTION cpq.fn_effective_role
(
    @username nvarchar(100),      -- the token's preferred_username (a UPN), see cpq.app_user
    @ad_groups nvarchar(max)      -- newline-separated, as the app read them from the token
)
RETURNS TABLE
AS
RETURN
    SELECT TOP 1 candidate.role_cd, candidate.role_source
    FROM (
        /*  The override, set by an admin in the tool and logged in cpq.access_log.
            Ranked above every group so it wins outright, which is what makes it
            the break-glass path.                                              */
        SELECT CAST(u.role_override AS varchar(20)) AS role_cd,
               CAST('override'      AS varchar(20)) AS role_source,
               1 AS is_override,
               0 AS role_rank
        FROM cpq.app_user AS u
        WHERE u.username = @username
          AND u.is_active = 1
          AND u.role_override IS NOT NULL

        UNION ALL

        /*  Group membership. Highest-ranked role wins, so somebody in both the
            reps group and the admins group is an admin.                       */
        SELECT CAST(rg.role_cd  AS varchar(20)),
               CAST('entraGroup' AS varchar(20)),
               0,
               r.rank
        FROM cpq.role_group AS rg
        JOIN cpq.app_role   AS r ON r.role_cd = rg.role_cd
        WHERE CHARINDEX(CHAR(10) + LOWER(rg.ad_group) + CHAR(10),
                        CHAR(10) + LOWER(ISNULL(@ad_groups, N'')) + CHAR(10)) > 0
    ) AS candidate
    ORDER BY candidate.is_override DESC, candidate.role_rank DESC;
GO

/*  Who approves this rep, and by what authority. Returning the reason matters:
    the approval screen should say "routed to K. Bryson (AD manager)" rather
    than presenting a name with no provenance.                                */
IF OBJECT_ID('cpq.fn_approver_for') IS NOT NULL DROP FUNCTION cpq.fn_approver_for;
GO
CREATE FUNCTION cpq.fn_approver_for
(
    @username      nvarchar(100),
    @technology_cd varchar(10)
)
RETURNS @out TABLE (approver_username nvarchar(100), resolved_by varchar(20))
AS
BEGIN
    DECLARE @ovr nvarchar(100), @ad nvarchar(100), @tech nvarchar(100);

    SELECT @ovr = approver_override, @ad = approver_ad
    FROM cpq.app_user WHERE username = @username AND is_active = 1;

    SELECT @tech = approver_username
    FROM cpq.technology_approver WHERE technology_cd = @technology_cd;

    IF @ovr IS NOT NULL
        INSERT INTO @out VALUES (@ovr, 'override');
    ELSE IF @ad IS NOT NULL
        INSERT INTO @out VALUES (@ad, 'entraManager');
    ELSE IF @tech IS NOT NULL
        INSERT INTO @out VALUES (@tech, 'technology');
    ELSE
        INSERT INTO @out VALUES (NULL, 'unroutable');

    RETURN;
END
GO

/*  Quotes a given user is allowed to see.
      admin     everything
      approver  own, plus anything routed to them
      rep       own, plus quotes for customers assigned to them                */
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

PRINT 'Security objects deployed.';
PRINT '';
PRINT 'BEFORE GO-LIVE, two things must be set by a human:';
PRINT '  1. cpq.role_group  - replace the AXIM\CPQ-* placeholders with what';
PRINT '     the tenant actually puts in the token group claim, which for the';
PRINT '     ''groups'' claim is group OBJECT IDs and not names. Until then nobody';
PRINT '     resolves to a role and the app denies everyone, which is correct.';
PRINT '  2. cpq.app_user.approver_ad - populated by the AD sync (see README).';
PRINT '     Until it runs, approvals fall through to cpq.technology_approver.';
GO
