/*==============================================================================
  Axim CPQ — PREFLIGHT
  ------------------------------------------------------------------------------
  READ ONLY. Creates nothing, changes nothing, safe on production.

  Run this FIRST, before 01_foundation.sql, and send the output back.

  It answers the one question the whole design rests on: **is Orbit actually
  authoritative for the prices we quote?** The build assumes yes. This proves it
  or disproves it in about thirty seconds, using 38 real part numbers taken from
  the current price pages across five technologies.

  HOW TO RUN
    Open in SSMS, connect to the SQL Server that hosts Orbit, press F5.
    Results come back as several grids, each labelled. Send all of them.
    If you prefer a single file: Query > Results To > Text, then save.

  BEFORE RUNNING: set @orbit below to the Orbit company database name.
  Planning Analytics documents it as [100]; confirm for this environment.
==============================================================================*/

SET NOCOUNT ON;

DECLARE @orbit sysname = N'100';     -- <<< confirm this is the Orbit company DB
DECLARE @sql    nvarchar(max);

PRINT '================================================================';
PRINT ' Axim CPQ preflight';
PRINT ' Server   : ' + @@SERVERNAME;
PRINT ' Orbit DB: ' + @orbit;
PRINT ' Run at   : ' + CONVERT(varchar(19), SYSDATETIME(), 120);
PRINT '================================================================';

/*------------------------------------------------------------------ 1. database */
IF DB_ID(@orbit) IS NULL
BEGIN
    PRINT '';
    PRINT '*** STOP. Database [' + @orbit + '] does not exist on this server.';
    PRINT '*** Set @orbit to the correct company database name and re-run.';
    PRINT '*** Databases on this server:';
    SELECT name AS [databases_on_this_server] FROM sys.databases ORDER BY name;
    RETURN;
END
PRINT '1. Orbit database found.';

/*--------------------------------------------------- 2. do the tables exist? */
SET @sql = N'
SELECT  t.expected_table,
        CASE WHEN o.name IS NULL THEN ''MISSING'' ELSE ''ok'' END AS status,
        o.name AS actual_name
FROM (VALUES
        (''imitmidx_sql''), (''iminvloc_sql''), (''imcatfil_sql''),
        (''arcusfil_sql''),  (''OEPRCFIL_SQL''), (''poitmvnd_sql''),
        (''oeordhdr_sql''),  (''oeordlin_sql'')
     ) AS t(expected_table)
LEFT JOIN ' + QUOTENAME(@orbit) + N'.sys.objects o
       ON o.name = t.expected_table AND o.type = ''U''
ORDER BY status DESC, t.expected_table;';
PRINT '2. Table existence -->  grid [expected_table]';
EXEC sp_executesql @sql;

/*------------------------------------------------- 3. do the columns exist? */
SET @sql = N'
SELECT  c.expected_table, c.expected_column,
        CASE WHEN sc.name IS NULL THEN ''MISSING'' ELSE ''ok'' END AS status,
        TYPE_NAME(sc.user_type_id) AS data_type
FROM (VALUES
        (''imitmidx_sql'',''item_no''), (''imitmidx_sql'',''item_desc_1''),
        (''imitmidx_sql'',''item_desc_2''),(''imitmidx_sql'',''prod_cat''),
        (''imitmidx_sql'',''uom''),      (''imitmidx_sql'',''activity_cd''),
        (''imitmidx_sql'',''stocked_fg''),(''imitmidx_sql'',''pur_or_mfg''),
        (''iminvloc_sql'',''item_no''),  (''iminvloc_sql'',''loc''),
        (''iminvloc_sql'',''price''),    (''iminvloc_sql'',''avg_cost''),
        (''iminvloc_sql'',''std_cost''), (''iminvloc_sql'',''last_cost''),
        (''iminvloc_sql'',''status''),
        (''imcatfil_sql'',''prod_cat''), (''imcatfil_sql'',''prod_cat_desc'')
     ) AS c(expected_table, expected_column)
LEFT JOIN ' + QUOTENAME(@orbit) + N'.sys.columns sc
       ON sc.object_id = OBJECT_ID(''' + @orbit + N'.dbo.'' + c.expected_table)
      AND sc.name = c.expected_column
ORDER BY status DESC, c.expected_table, c.expected_column;';
PRINT '3. Column existence -->  grid [expected_column]';
EXEC sp_executesql @sql;

/*------------------------------------------------------- 4. scale of the data */
SET @sql = N'
SELECT ''items (imitmidx_sql)''            AS measure, COUNT(*) AS value FROM ' + QUOTENAME(@orbit) + N'.dbo.imitmidx_sql
UNION ALL SELECT ''item x location rows'',  COUNT(*) FROM ' + QUOTENAME(@orbit) + N'.dbo.iminvloc_sql
UNION ALL SELECT ''product categories'',    COUNT(*) FROM ' + QUOTENAME(@orbit) + N'.dbo.imcatfil_sql
UNION ALL SELECT ''customers'',             COUNT(*) FROM ' + QUOTENAME(@orbit) + N'.dbo.arcusfil_sql
UNION ALL SELECT ''price code rows'',       COUNT(*) FROM ' + QUOTENAME(@orbit) + N'.dbo.OEPRCFIL_SQL;';
PRINT '4. Row counts -->  grid [measure]';
EXEC sp_executesql @sql;

/*----------------------------------------- 5. IS PRICE POPULATED, AND WHERE? */
SET @sql = N'
SELECT
    ''iminvloc_sql.price > 0''            AS price_source,
    COUNT(*)                              AS rows_with_value,
    COUNT(DISTINCT item_no)               AS distinct_items,
    CAST(MIN(price) AS decimal(14,2))     AS min_value,
    CAST(MAX(price) AS decimal(14,2))     AS max_value,
    CAST(AVG(price) AS decimal(14,2))     AS avg_value
FROM ' + QUOTENAME(@orbit) + N'.dbo.iminvloc_sql
WHERE price IS NOT NULL AND price > 0
UNION ALL
SELECT
    ''iminvloc_sql.sls_price > 0'', COUNT(*), COUNT(DISTINCT item_no),
    CAST(MIN(sls_price) AS decimal(14,2)), CAST(MAX(sls_price) AS decimal(14,2)),
    CAST(AVG(sls_price) AS decimal(14,2))
FROM ' + QUOTENAME(@orbit) + N'.dbo.iminvloc_sql
WHERE sls_price IS NOT NULL AND sls_price > 0;';
PRINT '5. Where price actually lives -->  grid [price_source]';
EXEC sp_executesql @sql;

/*---------------------------------------------- 6. THE DECISIVE TEST
  38 part numbers taken from the live price pages, spread across five
  technologies. For each: is it in Orbit at all, and does it carry a price?
  This is the answer to "is Orbit authoritative for what we quote".         */
IF OBJECT_ID('tempdb..#quoted') IS NOT NULL DROP TABLE #quoted;
CREATE TABLE #quoted (technology varchar(10), item_no varchar(30), description nvarchar(80));
INSERT INTO #quoted (technology, item_no, description) VALUES
    ('CIJ','Q013W088ZNY',N'6400 2M PH4 Standard 3103 Standard'),
    ('CIJ','Q140W419FHC',N'6420 4M PH4 Standard 1056 Black Wet Process'),
    ('CIJ','V349K898CUB',N'6400 6M PH4 Standard 1281 Thermochromic'),
    ('CIJ','M558G880KJX',N'6440 IP65 SPEC PH4 MIDI+ 4M HPC 1311'),
    ('CIJ','RG28566',    N'Pole, 1.0m'),
    ('CIJ','N7515051',   N'Dynamic Orientation - use with Traverse'),
    ('CIJ','1055535',    N'CIJ 5YR Ext Parts Warranty'),
    ('LSR','3108100306', N'Fume Extractor, Airvex AD Nano'),
    ('LSR','F1440152',   N'Chemical Pad Filter, Airvex AD PVC iQ'),
    ('LSR','9841223553-3876', N'Fume Extractor, Airvex AD Oracle SAiQ'),
    ('LSR','F9989944',   N'Hose, 50mm, per meter, Airvex'),
    ('PALM','202981W0H-M46', N'PL6300 Left-Handed - Narrow Web'),
    ('PALM','0008890',   N'Axim Passive Secondary Wipedown'),
    ('PALM','2391788',   N'Product Detector, Break Beam'),
    ('PALM','223388',    N'KIT,WEAR ITEMS, 7000 SERIES, NW'),
    ('PALM','6600334',   N'MAINTENANCE KIT,Kestrel K84X, RH'),
    ('PALM','6237532UAJJ', N'ENG,Kestrel,K86X,6",203DPI,TT,LH'),
    ('PALM','746338D6921', N'54" Floor Mount Stand with 30 deg Rotation'),
    ('PALM','060622141', N'RLC250 Conveyor, Adjustable Height'),
    ('PALM','665762U234',N'RLC2000, Integrated Conveyor/stand'),
    ('PIJ','088180HMT',  N'Mark 2 Print Head, ISM, ScanMark'),
    ('PIJ','334517',     N'Photosensor kit'),
    ('PIJ','391001',     N'Power Supply w/ Mount Bracket'),
    ('PIJ','930965EVS-NCAF', N'Mark 2 Print Head (Install Base Trade Out)'),
    ('PIJ','945792CYF-UGW',  N'Mark 4 Print Head (Competitor Trade Out)'),
    ('PIJ','681959KSH',  N'Ink Supply Module, Ridgeline 3200'),
    ('PIJ','530340WKV',  N'Printer Module, Mark 2, ScanMark'),
    ('PIJ','000281FQN',  N'Printer Module, Mark 4, ScanMark'),
    ('PIJ','143818',     N'PCB, Rear Plate & Vacuum Module Assembly'),
    ('TTO','9520423',    N'T402+, IM, Standard hand (LH)'),
    ('TTO','256334',     N'KIT, BRKT, FRAME TO HAYSSEN, DIRECT FIT'),
    ('TTO','M653781A3682', N'TTR-123, Black, Wax/Resin, 55mm x 450m'),
    ('TTO','R892678B0598', N'TTR-110, Black, Resin, 166mm x 600mm'),
    ('TTO','Y705749Z7079', N'TTR-184, Black, Wax/Resin, 220mm x 450m'),
    ('TTO','W371236M4159', N'TTR-281, White, Wax/Resin, 55mm x 450m'),
    ('TTO','P.8501.E5725', N'Spare Cassette T402+ Standard hand'),
    ('TTO','R.2987.G6927', N'Spare Cassette T406 Standard hand');

SET @sql = N'
SELECT  q.technology,
        q.item_no,
        q.description,
        CASE WHEN i.item_no IS NULL THEN ''NOT IN ORBIT'' ELSE ''found'' END       AS in_item_master,
        i.prod_cat,
        i.item_desc_1                                                              AS orbit_description,
        CASE WHEN p.item_no IS NULL THEN ''no price row''
             WHEN p.max_price > 0  THEN ''PRICED''
             ELSE ''price is zero'' END                                            AS price_status,
        CAST(p.max_price AS decimal(14,2))                                         AS orbit_price
FROM #quoted q
LEFT JOIN ' + QUOTENAME(@orbit) + N'.dbo.imitmidx_sql i
       ON i.item_no = q.item_no
LEFT JOIN (SELECT item_no, MAX(price) AS max_price
           FROM ' + QUOTENAME(@orbit) + N'.dbo.iminvloc_sql GROUP BY item_no) p
       ON p.item_no = q.item_no
ORDER BY q.technology, q.item_no;';
PRINT '6. THE DECISIVE TEST -->  grid [in_item_master / price_status]';
EXEC sp_executesql @sql;

/*  ...and the same thing as a one-line verdict per technology.               */
SET @sql = N'
SELECT  q.technology,
        COUNT(*)                                                            AS sampled,
        SUM(CASE WHEN i.item_no IS NOT NULL THEN 1 ELSE 0 END)              AS in_orbit,
        SUM(CASE WHEN p.max_price > 0 THEN 1 ELSE 0 END)                    AS priced_in_orbit,
        CAST(100.0 * SUM(CASE WHEN p.max_price > 0 THEN 1 ELSE 0 END)
             / NULLIF(COUNT(*),0) AS decimal(5,1))                          AS pct_priced
FROM #quoted q
LEFT JOIN ' + QUOTENAME(@orbit) + N'.dbo.imitmidx_sql i ON i.item_no = q.item_no
LEFT JOIN (SELECT item_no, MAX(price) AS max_price
           FROM ' + QUOTENAME(@orbit) + N'.dbo.iminvloc_sql GROUP BY item_no) p ON p.item_no = q.item_no
GROUP BY q.technology
ORDER BY pct_priced;';
PRINT '7. VERDICT BY TECHNOLOGY -->  grid [pct_priced]';
EXEC sp_executesql @sql;

/*---------------------------------------- 8. category inventory, for mapping
  This is the worksheet for cpq.technology_category. Every category, not a top
  N, because a truncated list would silently leave items unreachable.

  The sample part numbers are the point: a category called "N21 Brackets" is not
  decidable from its name, but three real part numbers from it usually are. */
SET @sql = N'
WITH cat AS (
    SELECT c.prod_cat, c.prod_cat_desc,
           COUNT(i.item_no)                                              AS items,
           -- activity_cd ''A'' = Active. Confirmed by the user, not inferred.
           SUM(CASE WHEN i.activity_cd = ''A'' THEN 1 ELSE 0 END)        AS active_items,
           SUM(CASE WHEN p.max_price > 0 THEN 1 ELSE 0 END)              AS priced_items
    FROM ' + QUOTENAME(@orbit) + N'.dbo.imcatfil_sql c
    LEFT JOIN ' + QUOTENAME(@orbit) + N'.dbo.imitmidx_sql i ON i.prod_cat = c.prod_cat
    LEFT JOIN (SELECT item_no, MAX(price) AS max_price
               FROM ' + QUOTENAME(@orbit) + N'.dbo.iminvloc_sql GROUP BY item_no) p
           ON p.item_no = i.item_no
    GROUP BY c.prod_cat, c.prod_cat_desc
)
SELECT  cat.prod_cat,
        cat.prod_cat_desc,
        cat.items,
        cat.active_items,
        cat.priced_items,
        STUFF((SELECT TOP 3 '', '' + LTRIM(RTRIM(s.item_no))
               FROM ' + QUOTENAME(@orbit) + N'.dbo.imitmidx_sql s
               WHERE s.prod_cat = cat.prod_cat AND s.activity_cd = ''A''
               ORDER BY s.item_no
               FOR XML PATH(''''), TYPE).value(''.'',''nvarchar(max)''), 1, 2, '''')
                                                                         AS sample_parts,
        CAST(NULL AS varchar(10))                                        AS technology_cd,
        CAST(NULL AS varchar(20))                                        AS item_role,
        CAST(NULL AS varchar(20))                                        AS discount_cat_cd
FROM cat
ORDER BY cat.items DESC, cat.prod_cat;';
PRINT '8. THE MAPPING WORKSHEET -->  grid [prod_cat / sample_parts]';
PRINT '   Every category, with sample part numbers so each row is decidable.';
PRINT '   The last three columns are deliberately empty - they are what a person';
PRINT '   fills in. One category may belong to several technologies; add a row';
PRINT '   per technology in that case.';
EXEC sp_executesql @sql;

DROP TABLE #quoted;

PRINT '';
PRINT '================================================================';
PRINT ' HOW TO READ GRID 7';
PRINT '   pct_priced near 100  -> Orbit is authoritative. Build proceeds';
PRINT '                           exactly as designed.';
PRINT '   pct_priced near 0    -> prices live in the spreadsheets, not';
PRINT '                           Orbit. Loading them is a prerequisite';
PRINT '                           project and the design needs revisiting.';
PRINT '   mixed by technology  -> some books are on Orbit and some are';
PRINT '                           not. Sequence the rollout accordingly.';
PRINT '================================================================';
