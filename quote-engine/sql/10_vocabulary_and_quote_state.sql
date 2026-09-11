/*==============================================================================
  Axim CPQ — the vocabulary, the document defaults, configured items, and
  the two quote states the schema did not have
  ------------------------------------------------------------------------------
  Run after 09_application_profile.sql. Idempotent: every object is created only
  if it is absent and every column added only if it is missing, so this can be
  run twice against the same database without complaint.

  WHY THIS EXISTS

  The web app grew ten endpoints the service never learnt to serve. They work in
  the preview build, which keeps everything in memory, and in production they
  would have been 404s against a UI that offers the buttons. This is the storage
  half of closing that; api/repo.py and api/main.py are the rest.

  Nothing here writes to Orbit. Every Orbit object this service can see is a
  read-only synonym in the mac schema (see 01_foundation.sql), which is the
  invariant the whole design rests on.
==============================================================================*/
SET NOCOUNT ON;
GO

/*------------------------------------------------------------------------------
  1. The vocabulary a part is sorted by.

  Price books already have a table (cpq.technology). Types and categories did
  not: they were distinct values of columns, which is fine for reading and
  useless for the Classify screen, where somebody adds "Sensors" and expects it
  to exist before any part carries it.

  A value may be removed only when nothing is filed under it. That rule lives in
  the service rather than in a constraint, because the answer a rep needs is
  "39 parts are still in Solvents", not a foreign-key violation.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.item_role') IS NULL
CREATE TABLE cpq.item_role (
    role_name     varchar(30)   NOT NULL PRIMARY KEY,
    display_name  nvarchar(60)  NULL,
    -- The engine reads these: a structure rule says "a printer is quoted and no
    -- accessory is". A type nothing references is safe to drop; one a rule names
    -- is not, and the service checks before allowing it.
    is_builtin    bit           NOT NULL DEFAULT 0,
    created_utc   datetime2(0)  NOT NULL DEFAULT sysutcdatetime(),
    created_by    nvarchar(100) NULL
);
GO

IF OBJECT_ID('cpq.item_category') IS NULL
CREATE TABLE cpq.item_category (
    category_name nvarchar(60)  NOT NULL PRIMARY KEY,
    created_utc   datetime2(0)  NOT NULL DEFAULT sysutcdatetime(),
    created_by    nvarchar(100) NULL
);
GO

/* The types the engine ships knowing. Seeded rather than assumed: the Classify
   screen lists what is in this table, and an empty table would offer a rep
   nothing to file a part under. */
MERGE cpq.item_role AS t
USING (VALUES
    ('printer','Machine'), ('printhead','Print head'), ('ink','Ink'),
    ('consumable','Consumable'), ('accessory','Accessory'), ('spare','Spare'),
    ('service','Service'), ('warranty','Warranty'), ('promo','Promotion'),
    ('part','Other part')
) AS s(role_name, display_name)
ON t.role_name = s.role_name
WHEN NOT MATCHED THEN
    INSERT (role_name, display_name, is_builtin) VALUES (s.role_name, s.display_name, 1);
GO

/*------------------------------------------------------------------------------
  1b. What makes two rows the same machine.

  A Corvus part number is a printer already filled — machine, printhead, ink and
  colour in one code — so the CIJ book holds 947 rows for nine machines. The
  chooser counted the rows and offered "947 machines" over a list showing nine.

  The attribute that identifies the machine differs by book and is empty for the
  books that list one row per machine, so it belongs on cpq.technology rather
  than in a service constant. Both the SQL count and the web app group on it, and
  they agree because there is one answer to look up.
------------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.technology', 'machine_identity_attr') IS NULL
    ALTER TABLE cpq.technology ADD machine_identity_attr nvarchar(60) NULL;
GO

UPDATE cpq.technology
   SET machine_identity_attr = 'Printer Type'
 WHERE technology_cd = 'CIJ' AND machine_identity_attr IS NULL;
GO

/*------------------------------------------------------------------------------
  2. Configured items.

  A Corvus laser has no part number until it is configured, and neither does a
  7300-series CIJ — the number IS the configuration. The web app composes one
  and posts it; this is where it lands so the next quote can find it.

  Separate from cpq.item_hierarchy, which mirrors Orbit. These parts do not
  exist in Orbit until somebody orders one, and writing them there is not this
  service's business.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.item_configured') IS NULL
CREATE TABLE cpq.item_configured (
    item_no        varchar(40)   NOT NULL PRIMARY KEY,
    description    nvarchar(200) NOT NULL,
    technology_cd  varchar(10)   NOT NULL,
    item_role      varchar(30)   NOT NULL DEFAULT 'printer',
    model          nvarchar(60)  NULL,
    list_price     decimal(12,2) NULL,   -- NULL until Orbit prices it
    discount_cd    varchar(20)   NULL,
    created_utc    datetime2(0)  NOT NULL DEFAULT sysutcdatetime(),
    created_by     nvarchar(100) NULL,
    CONSTRAINT fk_item_configured_tech FOREIGN KEY (technology_cd)
        REFERENCES cpq.technology (technology_cd)
);
GO

/*------------------------------------------------------------------------------
  3. Document defaults, per rep.

  "Save as the default for my quotes." Stored as JSON rather than as fifteen
  columns because the quote document gains a field most months and a migration
  per field is a migration nobody runs. The service validates the shape; SQL
  checks only that it is JSON at all.
------------------------------------------------------------------------------*/
IF OBJECT_ID('cpq.document_default') IS NULL
CREATE TABLE cpq.document_default (
    username     nvarchar(100) NOT NULL PRIMARY KEY,
    settings     nvarchar(max) NOT NULL,
    updated_utc  datetime2(0)  NOT NULL DEFAULT sysutcdatetime(),
    CONSTRAINT ck_document_default_json CHECK (ISJSON(settings) = 1)
);
GO

/*------------------------------------------------------------------------------
  4. The two quote states the schema could not record.

  LOST. cpq.quote.status already allows 'lost'. What it could not hold is why,
  which is the only part anybody reads afterwards.

  SENT OUTSIDE THE SYSTEM. Reps edit the Word document and send it from Outlook,
  and the quote still has to be marked sent or the pipeline is wrong. Recording
  it as an ordinary 'sent' would be a lie about how it went, so it is its own
  set of columns: when, to whom, why, and the file they actually sent.
------------------------------------------------------------------------------*/
IF COL_LENGTH('cpq.quote', 'lost_reason') IS NULL
    ALTER TABLE cpq.quote ADD lost_reason nvarchar(300) NULL;
GO
IF COL_LENGTH('cpq.quote', 'lost_utc') IS NULL
    ALTER TABLE cpq.quote ADD lost_utc datetime2(0) NULL;
GO
IF COL_LENGTH('cpq.quote', 'sent_outside_utc') IS NULL
    ALTER TABLE cpq.quote ADD sent_outside_utc datetime2(0) NULL;
GO
IF COL_LENGTH('cpq.quote', 'sent_outside_to') IS NULL
    ALTER TABLE cpq.quote ADD sent_outside_to nvarchar(200) NULL;
GO
IF COL_LENGTH('cpq.quote', 'sent_outside_note') IS NULL
    ALTER TABLE cpq.quote ADD sent_outside_note nvarchar(500) NULL;
GO
IF COL_LENGTH('cpq.quote', 'sent_outside_by') IS NULL
    ALTER TABLE cpq.quote ADD sent_outside_by nvarchar(100) NULL;
GO

/* The file a rep attached as proof of what went out.

   Its own table, not a column: it is a Word document or a PDF, it is the only
   large object this schema holds, and a quote list that selects * should never
   drag one across the wire. */
IF OBJECT_ID('cpq.quote_sent_file') IS NULL
CREATE TABLE cpq.quote_sent_file (
    quote_id     int           NOT NULL PRIMARY KEY,
    file_name    nvarchar(260) NOT NULL,
    content_type varchar(120)  NULL,
    byte_size    int           NULL,
    content      varbinary(max) NOT NULL,
    uploaded_utc datetime2(0)  NOT NULL DEFAULT sysutcdatetime(),
    CONSTRAINT fk_quote_sent_file_quote FOREIGN KEY (quote_id)
        REFERENCES cpq.quote (quote_id) ON DELETE CASCADE
);
GO

/*------------------------------------------------------------------------------
  5. Grants. The service account reads and writes these like the rest of cpq.
------------------------------------------------------------------------------*/
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'cpq_service')
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON cpq.item_role        TO cpq_service;
    GRANT SELECT, INSERT, UPDATE, DELETE ON cpq.item_category    TO cpq_service;
    GRANT SELECT, INSERT, UPDATE, DELETE ON cpq.item_configured  TO cpq_service;
    GRANT SELECT, INSERT, UPDATE, DELETE ON cpq.document_default TO cpq_service;
    GRANT SELECT, INSERT, UPDATE, DELETE ON cpq.quote_sent_file  TO cpq_service;
END
GO

PRINT '---------------------------------------------------------------';
PRINT '10_vocabulary_and_quote_state.sql complete.';
PRINT '  cpq.item_role, cpq.item_category   the Classify vocabulary';
PRINT '  cpq.item_configured                part numbers composed, not looked up';
PRINT '  cpq.document_default               per-rep quote document defaults';
PRINT '  cpq.quote lost_/sent_outside_      why it stopped, and how it went';
PRINT '  cpq.quote_sent_file                the file a rep sent themselves';
PRINT '---------------------------------------------------------------';
GO
