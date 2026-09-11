/*==============================================================================
  Axim CPQ — foundation deploy script
  ------------------------------------------------------------------------------
  Creates the AximQuote database, read-only synonyms into Orbit, and the
  `cpq` schema: rules, discount policy, promotions and quotes.

  DESIGN INVARIANTS (do not break these without a deliberate decision)

    1. Nothing is ever written back to Orbit. Every Orbit object below is a
       read-only synonym. Same rule Planning Analytics follows.
    2. Orbit is the source of truth for items, descriptions, categories and
       price. The tool never stores a copy of a price. A new product launch or
       discontinuance is a Orbit change and needs no code and no rule edit.
    3. Rules are data, edited by people through the admin screen — never by
       editing this script. The seed script populates them once; after that the
       tables are owned by the business.
    4. Quotes live here, not in Orbit. The schema carries the columns an
       order-entry push would need (see cpq.quote.orbit_order_no) so that phase
       can be added later without a migration.

  RUN ORDER
    1. 01_foundation.sql   <- this file
    2. 02_seed_rules.sql      seeds the rules recovered from the price pages
    3. 03_views.sql           the read models the API queries

  BEFORE RUNNING: the synonym block targets the Orbit company database as [100].
  That is a database name, not a placeholder. Confirm it matches this
  environment before running — Planning Analytics documents the same check.

  Idempotent. Safe to re-run: it never drops a table that holds business data.
==============================================================================*/

SET NOCOUNT ON;
GO

IF DB_ID('AximQuote') IS NULL
BEGIN
    PRINT 'Creating database AximQuote...';
    EXEC('CREATE DATABASE [AximQuote]');
END
GO

USE [AximQuote];
GO

IF SCHEMA_ID('cpq') IS NULL EXEC('CREATE SCHEMA cpq');
IF SCHEMA_ID('mac') IS NULL EXEC('CREATE SCHEMA mac');   -- read-only Orbit surface
GO

/*------------------------------------------------------------------------------
  1. Read-only synonyms into Orbit
  ------------------------------------------------------------------------------
  Everything the tool knows about products comes through these. Isolating them
  in one schema means the Orbit database name appears in exactly one place.
------------------------------------------------------------------------------*/
DECLARE @orbit sysname = N'[100]';   -- <<< confirm before running
DECLARE @sql nvarchar(max) = N'';

/*  The synonym keeps the Orbit table's own name.

    It used to rename them — mac.item for imitmidx_sql, mac.item_loc for
    iminvloc_sql — and nothing else in the repository agreed. 05_service_objects,
    06_classification and api/repo.py all say mac.imitmidx_sql; only
    03_planning_links said mac.item. No SQL here has ever executed, so nobody had
    found out yet that most of the deployment would fail on "Invalid object name"
    at the first view it tried to create.

    One name wins, and it is Orbit's. A friendlier name buys a little readability
    and costs the ability to look at a query and know exactly which Orbit table it
    reads — which matters more in a tool whose whole safety story is that it only
    ever reads.                                                                  */
DECLARE @syn TABLE (name sysname, target sysname);
INSERT INTO @syn (name, target) VALUES
    (N'imitmidx_sql',  N'imitmidx_sql'),   -- item master
    (N'iminvloc_sql',  N'iminvloc_sql'),   -- item x location: price, costs, on hand
    (N'imcatfil_sql',  N'imcatfil_sql'),   -- product category master
    (N'arcusfil_sql',  N'arcusfil_sql'),   -- customer master
    (N'OEPRCFIL_SQL',  N'OEPRCFIL_SQL'),   -- price codes / quantity breaks
    (N'poitmvnd_sql',  N'poitmvnd_sql'),   -- vendor cross reference
    (N'oeordhdr_sql',  N'oeordhdr_sql'),   -- open order header. Read-only today
    (N'oeordlin_sql',  N'oeordlin_sql'),   -- open order line
    /*  Sales history: invoiced lines and their headers. Not the same question as
        the two above — those are what is outstanding now, this is what has
        actually been sold. Popularity ranking and the classify worklist's
        "has anyone bought this lately" both read it, and both would be wrong if
        they read open lines instead: one large backorder would outrank a part
        sold every week for a decade.                                          */
    (N'oelinhst_sql',  N'oelinhst_sql'),   -- sales order line history
    (N'oehdrhst_sql',  N'oehdrhst_sql');   -- sales order header history

DECLARE @n sysname, @t sysname;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT name, target FROM @syn;
OPEN c; FETCH NEXT FROM c INTO @n, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = @n AND SCHEMA_NAME(schema_id) = 'mac')
        EXEC('DROP SYNONYM mac.' + @n);
    SET @sql = N'CREATE SYNONYM mac.' + QUOTENAME(@n) + N' FOR ' + @orbit + N'.dbo.' + QUOTENAME(@t);
    EXEC sp_executesql @sql;
    FETCH NEXT FROM c INTO @n, @t;
END
CLOSE c; DEALLOCATE c;
PRINT 'Orbit synonyms created in schema [mac] (read-only by grant).';
GO

/*------------------------------------------------------------------------------
  2. Reference data the tool owns
------------------------------------------------------------------------------*/

-- The seven price-page technologies. Rules, promotions and quotes hang off this.
IF OBJECT_ID('cpq.technology') IS NULL
CREATE TABLE cpq.technology (
    technology_cd   varchar(10)   NOT NULL PRIMARY KEY,
    technology_name nvarchar(100) NOT NULL,
    sort_order      int           NOT NULL DEFAULT 100,
    is_active       bit           NOT NULL DEFAULT 1
);
GO
MERGE cpq.technology AS t
USING (VALUES
    ('CIJ',  N'Continuous inkjet',            10),
    ('TIJ',  N'Thermal inkjet',               20),
    ('TTO',  N'Thermal transfer overprint',   30),
    -- Axim's own word for it is impulse jet, on the Ridgeline 3200 product
    -- page and in every datasheet. Piezo describes the mechanism; it is not
    -- what a rep or the price pages call the technology.
    ('PIJ',  N'Impulse jet',                  40),
    ('VIJ',  N'Valve inkjet',                 50),
    ('LSR',  N'Laser',                        60),
    ('PALM', N'Print and apply labeling',     70),
    /*  Not a price book. A row so technology_cd can carry it without breaking the
        foreign keys on items, rules and quotes — an item marked ALL belongs to every
        book rather than to one, which is what a promotion, a service offering or a
        training day actually is. is_active = 0 keeps it out of the chooser: a rep
        picks a technology to quote in, and 'all of them' is not one of those. */
    ('ALL',  N'Every technology',            999)
) AS s(cd, nm, so) ON t.technology_cd = s.cd
WHEN NOT MATCHED THEN INSERT (technology_cd, technology_name, sort_order, is_active)
    VALUES (s.cd, s.nm, s.so, CASE WHEN s.cd = 'ALL' THEN 0 ELSE 1 END);
GO

/*  Which Orbit product categories belong to which technology.
    DELIBERATELY EMPTY. Orbit's prod_cat codes (P47 "Plat Ser Parts",
    N23 "Thermal parts", X95 "MATL HANDLING", ...) do not map one-to-one onto the
    seven price books, and guessing would put the wrong parts in front of a rep.
    This is a business mapping — fill it through the admin screen, or load it
    once from a reviewed spreadsheet. Until a row exists for a category, items in
    it are simply not offered for that technology.                              */
IF OBJECT_ID('cpq.technology_category') IS NULL
CREATE TABLE cpq.technology_category (
    technology_cd varchar(10)  NOT NULL,
    prod_cat      varchar(10)  NOT NULL,
    item_role     varchar(20)  NULL,   -- printer|printhead|ink|consumable|accessory|spare|service|warranty|promo
    CONSTRAINT pk_technology_category PRIMARY KEY (technology_cd, prod_cat),
    CONSTRAINT fk_techcat_tech FOREIGN KEY (technology_cd) REFERENCES cpq.technology(technology_cd)
);
GO

/*  Item-level overrides. Orbit carries no notion of "this is a printer" or
    "this accessory is quotable on CIJ", so where the category mapping is too
    coarse a specific item can be placed by hand.                              */
IF OBJECT_ID('cpq.item_profile') IS NULL
CREATE TABLE cpq.item_profile (
    item_no        varchar(25)  NOT NULL,
    technology_cd  varchar(10)  NOT NULL,
    item_role      varchar(20)  NOT NULL,
    is_quotable    bit          NOT NULL DEFAULT 1,
    display_order  int          NULL,
    notes          nvarchar(400) NULL,
    updated_by     nvarchar(100) NULL,
    updated_at     datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_item_profile PRIMARY KEY (item_no, technology_cd),
    CONSTRAINT fk_itemprofile_tech FOREIGN KEY (technology_cd) REFERENCES cpq.technology(technology_cd)
);
GO

/*  Product attributes the price pages carry but Orbit does not:
    Printer Type, Printhead Type, Ink, Colour. Key/value so a new attribute
    never needs a schema change.                                              */
IF OBJECT_ID('cpq.item_attribute') IS NULL
CREATE TABLE cpq.item_attribute (
    item_no    varchar(25)   NOT NULL,
    attr_name  varchar(40)   NOT NULL,
    attr_value nvarchar(200) NOT NULL,
    CONSTRAINT pk_item_attribute PRIMARY KEY (item_no, attr_name)
);
GO

/*------------------------------------------------------------------------------
  3. Discount policy
  ------------------------------------------------------------------------------
  Four category discounts with stated maxima, overridden downward by item caps.
  Both are business-editable; neither is hardcoded anywhere in the application.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.discount_category') IS NULL
CREATE TABLE cpq.discount_category (
    discount_cat_cd varchar(20)   NOT NULL PRIMARY KEY,
    display_name    nvarchar(60)  NOT NULL,
    max_discount    decimal(5,4)  NULL,      -- NULL = no stated maximum
    sort_order      int           NOT NULL DEFAULT 100,
    updated_by      nvarchar(100) NULL,
    updated_at      datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
MERGE cpq.discount_category AS t
USING (VALUES
    ('system',      N'System',      CAST(0.30 AS decimal(5,4)), 10),
    ('consumables', N'Consumables', NULL,                       20),
    ('accessories', N'Accessories', CAST(0.18 AS decimal(5,4)), 30),
    ('customs',     N'Customs',     CAST(0.05 AS decimal(5,4)), 40)
) AS s(cd, nm, mx, so) ON t.discount_cat_cd = s.cd
WHEN NOT MATCHED THEN INSERT (discount_cat_cd, display_name, max_discount, sort_order)
     VALUES (s.cd, s.nm, s.mx, s.so);
GO

-- Which discount category a Orbit product category falls into.
IF OBJECT_ID('cpq.category_discount_map') IS NULL
CREATE TABLE cpq.category_discount_map (
    prod_cat        varchar(10) NOT NULL PRIMARY KEY,
    discount_cat_cd varchar(20) NOT NULL,
    CONSTRAINT fk_catdisc FOREIGN KEY (discount_cat_cd) REFERENCES cpq.discount_category(discount_cat_cd)
);
GO

/*  The item-level caps — 37 "Max Discount 5%" notes were recovered from the CIJ
    book alone. These override the category discount downward, and the quote must
    always be able to say which cap bit.                                       */
IF OBJECT_ID('cpq.item_discount_cap') IS NULL
CREATE TABLE cpq.item_discount_cap (
    item_no        varchar(25)   NOT NULL,
    technology_cd  varchar(10)   NULL,        -- NULL = applies to every technology
    max_discount   decimal(5,4)  NOT NULL,
    rule_code      varchar(20)   NULL,        -- the rule the quote line cites
    effective_from date          NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS date),
    effective_to   date          NULL,
    updated_by     nvarchar(100) NULL,
    updated_at     datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_item_discount_cap PRIMARY KEY (item_no, effective_from)
);
GO

/*------------------------------------------------------------------------------
  4. Rules
  ------------------------------------------------------------------------------
  The whole point of the tool. Stored as a header plus typed child rows rather
  than a JSON blob, because a JSON blob is not editable by a regular person — the
  admin screen builds these rows from dropdowns and validates every part number
  against Orbit before it will save.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.rule') IS NULL
CREATE TABLE cpq.rule (
    rule_id        int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    rule_code      varchar(20)   NOT NULL UNIQUE,   -- R-011; human-facing, shown on the quote
    technology_cd  varchar(10)   NULL,              -- NULL = all technologies
    rule_type      varchar(20)   NOT NULL,          -- see ck_rule_type
    summary        nvarchar(300) NOT NULL,          -- one line, shown in the interface
    detail         nvarchar(max) NULL,              -- the original wording, shown on expand
    source_ref     nvarchar(200) NULL,              -- 'CIJ workbook, 3. Pick your accessories, D49/D50'
    author         nvarchar(100) NULL,
    severity       varchar(20)   NOT NULL DEFAULT 'warn',  -- info|warn|block
    effective_from date          NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS date),
    effective_to   date          NULL,
    is_active      bit           NOT NULL DEFAULT 1,
    created_by     nvarchar(100) NULL,
    created_at     datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by     nvarchar(100) NULL,
    updated_at     datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_rule_tech FOREIGN KEY (technology_cd) REFERENCES cpq.technology(technology_cd),
    CONSTRAINT ck_rule_type CHECK (rule_type IN
        ('requires','excludes','duplicate','eligibility','substitution',
         'applicationFit','approval','discountCap','note')),
    CONSTRAINT ck_rule_severity CHECK (severity IN ('info','warn','block')),
    CONSTRAINT ck_rule_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
GO

/*  WHEN the rule engages. Multiple rows AND together.                         */
IF OBJECT_ID('cpq.rule_trigger') IS NULL
CREATE TABLE cpq.rule_trigger (
    trigger_id   int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    rule_id      int          NOT NULL,
    trigger_type varchar(20)  NOT NULL,   -- item|role|category|attribute|profile|always
    item_no      varchar(25)  NULL,
    item_role    varchar(20)  NULL,
    prod_cat     varchar(10)  NULL,
    attr_name    varchar(40)  NULL,
    attr_value   nvarchar(200) NULL,
    profile_field varchar(40) NULL,       -- substrate|porosity|lineSpeedFpm|throwDistanceMm|...
    compare_op   varchar(10)  NULL,       -- eq|ne|gt|gte|lt|lte|includes
    compare_value nvarchar(200) NULL,
    min_count    int          NULL,       -- 'at least N of these present' (duplicate rules)
    CONSTRAINT fk_trigger_rule FOREIGN KEY (rule_id) REFERENCES cpq.rule(rule_id) ON DELETE CASCADE,
    CONSTRAINT ck_trigger_type CHECK (trigger_type IN
        ('item','role','category','attribute','profile','always'))
);
GO

/*  THEN what happens.                                                          */
IF OBJECT_ID('cpq.rule_action') IS NULL
CREATE TABLE cpq.rule_action (
    action_id     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    rule_id       int          NOT NULL,
    action_type   varchar(20)  NOT NULL,  -- require|requireOneOf|exclude|warn|substitute|cap|approve|grade|allowance
    item_no       varchar(25)  NULL,      -- the companion / replacement / capped item
    quantity      decimal(9,2) NULL,
    max_discount  decimal(5,4) NULL,
    fit_grade     varchar(20)  NULL,      -- good|caveat|notRecommended
    approver_role nvarchar(60) NULL,      -- 'Regional Sales Manager'
    allowance_amt decimal(12,2) NULL,
    message       nvarchar(500) NULL,
    remedy        nvarchar(500) NULL,
    -- What a `narrow` action compares, what it compares against, and the roles it
    -- exempts. Without these a narrowing rule reaches the service and narrows
    -- nothing, which is not a degraded rule but an absent one. See sql/12.
    matcher       varchar(40)  NULL,      -- 'porosity' | 'inkColour'
    attribute     nvarchar(60) NULL,      -- the item attribute: 'Surface', 'Color'
    deny_roles    nvarchar(200) NULL,     -- comma separated roles it does not apply to
    sort_order    int          NOT NULL DEFAULT 10,
    CONSTRAINT fk_action_rule FOREIGN KEY (rule_id) REFERENCES cpq.rule(rule_id) ON DELETE CASCADE,
    CONSTRAINT ck_action_type CHECK (action_type IN
        ('require','requireOneOf','exclude','warn','substitute','cap','approve','grade','allowance'))
);
GO

/*  Multi-condition eligibility — the competitor trade-out stacks five. Each row
    is one condition the quote must satisfy, and each is shown to the rep with a
    pass/fail state rather than collapsing to a single yes/no.                 */
IF OBJECT_ID('cpq.rule_condition') IS NULL
CREATE TABLE cpq.rule_condition (
    condition_id  int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    rule_id       int           NOT NULL,
    seq           int           NOT NULL,
    label         nvarchar(200) NOT NULL,   -- 'Quoted with an 6420 printer'
    condition_kind varchar(20)  NOT NULL,   -- attribute|item|flag|term
    attr_name     varchar(40)   NULL,
    attr_value    nvarchar(200) NULL,
    item_no       varchar(25)   NULL,
    flag_name     varchar(40)   NULL,       -- newPrinterSale|existingCustomer|inkTerm24|rsmApproval
    CONSTRAINT fk_condition_rule FOREIGN KEY (rule_id) REFERENCES cpq.rule(rule_id) ON DELETE CASCADE,
    CONSTRAINT uq_rule_condition_seq UNIQUE (rule_id, seq),
    CONSTRAINT ck_condition_kind CHECK (condition_kind IN ('attribute','item','flag','term'))
);
GO

/*  Every change to a rule, kept forever. Pricing governance needs to be able to
    answer "who changed this, and when did it start applying".                 */
IF OBJECT_ID('cpq.rule_audit') IS NULL
CREATE TABLE cpq.rule_audit (
    audit_id    bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    rule_id     int           NULL,
    rule_code   varchar(20)   NULL,
    action      varchar(20)   NOT NULL,   -- insert|update|delete|activate|deactivate
    changed_by  nvarchar(100) NOT NULL,
    changed_at  datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    -- What the history panel shows beside the name and the date. The API has
    -- always written and read it; the column was simply missing, so saving any
    -- rule failed -- the audit insert shares the rule save's transaction.
    summary     nvarchar(300) NULL,
    before_json nvarchar(max) NULL,
    after_json  nvarchar(max) NULL
);
GO

/*------------------------------------------------------------------------------
  5. Promotions
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.promotion') IS NULL
CREATE TABLE cpq.promotion (
    promotion_id   int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    promotion_cd   varchar(30)   NOT NULL UNIQUE,
    technology_cd  varchar(10)   NULL,
    display_name   nvarchar(200) NOT NULL,
    promo_kind     varchar(20)   NOT NULL,   -- freeItem|credit|allowance
    item_no        varchar(25)   NULL,
    credit_amount  decimal(12,2) NULL,
    effective_from date          NOT NULL,
    effective_to   date          NULL,
    rule_code      varchar(20)   NULL,       -- eligibility rule that governs it
    is_active      bit           NOT NULL DEFAULT 1,
    updated_by     nvarchar(100) NULL,
    updated_at     datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_promo_kind CHECK (promo_kind IN ('freeItem','credit','allowance')),
    CONSTRAINT ck_promo_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
GO

/*------------------------------------------------------------------------------
  6. Quotes
  ------------------------------------------------------------------------------
  Written by the tool, never by Orbit. orbit_order_no is null today and is the
  hook for the later order-entry push — no migration needed when that lands.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.quote') IS NULL
CREATE TABLE cpq.quote (
    quote_id        int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    quote_no        varchar(20)   NOT NULL UNIQUE,
    technology_cd   varchar(10)   NOT NULL,
    status          varchar(20)   NOT NULL DEFAULT 'draft',  -- draft|pendingApproval|approved|sent|won|lost|expired
    customer_no     varchar(12)   NULL,      -- Orbit customer, when known
    customer_name   nvarchar(200) NULL,      -- free text for prospects
    -- A prospect who is not in Orbit yet. There was no path for one at all: the
    -- customer field searched the ERP, so a rep quoting somebody new had nowhere to
    -- put them and the quote went out with a name and nothing else. Sales does not
    -- wait for an account to be created.
    --
    -- The smallest set that lets a quote be addressed and sent. Asking for more is
    -- asking the rep to do the credit team's data entry a second time, and the
    -- second copy is the one that will be wrong.
    prospect_contact nvarchar(150) NULL,
    prospect_email   nvarchar(200) NULL,
    prospect_city    nvarchar(80)  NULL,
    prospect_state   varchar(4)    NULL,
    line_name       nvarchar(200) NULL,
    rep_username    nvarchar(100) NOT NULL,
    rep_display     nvarchar(150) NULL,
    -- application profile, captured once and used to grade the configuration
    substrate       nvarchar(60)  NULL,
    porosity        varchar(20)   NULL,
    line_speed_fpm  int           NULL,
    throw_dist_mm   decimal(6,2)  NULL,
    char_height_mm  decimal(6,2)  NULL,
    message_content nvarchar(300) NULL,
    environment     nvarchar(300) NULL,
    -- commercial
    discount_system      decimal(5,4) NULL,
    discount_consumables decimal(5,4) NULL,
    discount_accessories decimal(5,4) NULL,
    discount_customs     decimal(5,4) NULL,
    extended_list   decimal(14,2) NULL,
    extended_net    decimal(14,2) NULL,
    order_total     decimal(14,2) NULL,
    total_discount  decimal(5,4)  NULL,
    margin_pct      decimal(5,4)  NULL,
    orbit_order_no varchar(20)   NULL,      -- reserved for the later OE push
    created_at      datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    sent_at         datetime2(0)  NULL,
    CONSTRAINT fk_quote_tech FOREIGN KEY (technology_cd) REFERENCES cpq.technology(technology_cd),
    -- 'approved' is the state between an approver saying yes and the rep sending it.
    -- Without it an approved quote had to be written back as 'draft', which is the
    -- same value as never-submitted.
    CONSTRAINT ck_quote_status CHECK (status IN ('draft','pendingApproval','approved','sent','won','lost','expired')),
    -- A quote cannot be WON against a customer who does not exist.
    --
    -- Sent is fine, and deliberately so: a prospect quote is exactly the thing you
    -- send. But won means revenue, and revenue against a customer nobody can look
    -- up is a number that gets found at month end by somebody who was not there
    -- when it was raised. When the account is created the rep pastes the Orbit
    -- number in and the quote re-points; nothing is rewritten.
    CONSTRAINT ck_quote_won_needs_customer
        CHECK (status <> 'won' OR customer_no IS NOT NULL)
);
GO

IF OBJECT_ID('cpq.quote_line') IS NULL
CREATE TABLE cpq.quote_line (
    quote_line_id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    quote_id      int           NOT NULL,
    line_no       int           NOT NULL,
    item_no       varchar(25)   NOT NULL,
    description   nvarchar(200) NULL,   -- snapshot: what the rep saw when quoting
    quantity      decimal(9,2)  NOT NULL DEFAULT 1,
    list_price    decimal(14,4) NULL,   -- snapshot of the Orbit price at quote time
    discount_cat_cd varchar(20) NULL,
    category_discount decimal(5,4) NULL,
    applied_discount  decimal(5,4) NULL,
    capped_by_rule  varchar(20)  NULL,  -- which cap bit, so the line can say so
    net_unit      decimal(14,4) NULL,
    extended_list decimal(14,2) NULL,
    extended_net  decimal(14,2) NULL,
    -- Offered, not bought. Priced and graded like every other line and left out of
    -- the totals, so the customer's copy can put it under its own heading. Without
    -- somewhere to store it the flag survived only as long as the rep's session:
    -- set it, save, reopen, and everything was back in the price.
    is_optional   bit           NOT NULL CONSTRAINT df_quote_line_is_optional DEFAULT 0,
    CONSTRAINT fk_quoteline_quote FOREIGN KEY (quote_id) REFERENCES cpq.quote(quote_id) ON DELETE CASCADE,
    CONSTRAINT uq_quote_line UNIQUE (quote_id, line_no)
);
GO

/*  Which rules fired on a given quote, kept with the quote. This is what makes
    a quote defensible six months later, when the rule itself may have changed. */
IF OBJECT_ID('cpq.quote_rule_trace') IS NULL
CREATE TABLE cpq.quote_rule_trace (
    trace_id    bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    quote_id    int           NOT NULL,
    rule_code   varchar(20)   NOT NULL,
    rule_summary nvarchar(300) NULL,   -- snapshot of the wording at quote time
    source_ref  nvarchar(200) NULL,
    author      nvarchar(100) NULL,
    status      varchar(20)   NOT NULL,  -- satisfied|action|warning|blocked|info
    headline    nvarchar(500) NULL,
    recorded_at datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_trace_quote FOREIGN KEY (quote_id) REFERENCES cpq.quote(quote_id) ON DELETE CASCADE
);
GO

IF OBJECT_ID('cpq.quote_approval') IS NULL
CREATE TABLE cpq.quote_approval (
    approval_id   int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    quote_id      int           NOT NULL,
    rule_code     varchar(20)   NULL,
    reason        nvarchar(500) NOT NULL,
    requested_pct decimal(5,4)  NULL,
    stated_max    decimal(5,4)  NULL,
    approver_role nvarchar(60)  NULL,
    approver_user nvarchar(100) NULL,
    status        varchar(20)   NOT NULL DEFAULT 'pending',  -- pending|approved|declined
    requested_at  datetime2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    decided_at    datetime2(0)  NULL,
    decision_note nvarchar(500) NULL,
    CONSTRAINT fk_approval_quote FOREIGN KEY (quote_id) REFERENCES cpq.quote(quote_id) ON DELETE CASCADE,
    CONSTRAINT ck_approval_status CHECK (status IN ('pending','approved','declined'))
);
GO

/*------------------------------------------------------------------------------
  7. Indexes on the paths the app actually reads
------------------------------------------------------------------------------*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_rule_active' AND object_id=OBJECT_ID('cpq.rule'))
    CREATE INDEX ix_rule_active ON cpq.rule (technology_cd, is_active, effective_from, effective_to)
        INCLUDE (rule_code, rule_type, summary, severity);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_trigger_item' AND object_id=OBJECT_ID('cpq.rule_trigger'))
    CREATE INDEX ix_trigger_item ON cpq.rule_trigger (item_no) INCLUDE (rule_id, trigger_type);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_itemprofile_tech' AND object_id=OBJECT_ID('cpq.item_profile'))
    CREATE INDEX ix_itemprofile_tech ON cpq.item_profile (technology_cd, item_role, is_quotable);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_quote_rep' AND object_id=OBJECT_ID('cpq.quote'))
    CREATE INDEX ix_quote_rep ON cpq.quote (rep_username, status, updated_at DESC);
GO

PRINT 'AximQuote foundation deployed.';
PRINT 'Next: 02_seed_rules.sql, then 03_views.sql.';
PRINT 'REMINDER: cpq.technology_category is intentionally empty and must be';
PRINT 'populated before any item is offered to a rep.';
GO
