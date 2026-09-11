/*==============================================================================
  Axim CPQ — application-fit and quote-structure rules
  ------------------------------------------------------------------------------
  Run after 04_seed_rules.sql. 315 rules from three sources: physical limits
  taken from datasheets and product pages, and judgements about how a quote is
  assembled. Every row names where it came from.

  Separate from 04_seed_rules.sql, which carries the 173 comments recovered from
  the price pages — those are commercial rules written by colleagues, these are
  manufacturer limits plus the completeness checks the spreadsheets never had.

  Idempotent: re-running deletes only rules whose created_by is 'spec'.

  NOTHING HERE HAS BEEN RUN.
==============================================================================*/

SET NOCOUNT ON;
GO
USE [AximQuote];
GO

DELETE a FROM cpq.rule_action a
  JOIN cpq.rule r ON r.rule_id = a.rule_id WHERE r.created_by = N'spec';
DELETE t FROM cpq.rule_trigger t
  JOIN cpq.rule r ON r.rule_id = t.rule_id WHERE r.created_by = N'spec';
DELETE FROM cpq.rule WHERE created_by = N'spec';
GO

DECLARE @rid int;


-- A-CIJ-SPD-6400  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-SPD-6400', N'CIJ', N'applicationFit',
    N'Above 574 fpm the 6400 is past its single-line maximum.', N'Corvus 6400 technical data, PRINT / Max speed single line: ''6400: Up to 574 FPM''. Faster lines need an 6410 or above.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6400,6400LI');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'574');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The 6400 prints a single line to 574 fpm. This line runs faster.', NULL, NULL, NULL, NULL);

-- A-CIJ-SPD-6410  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-SPD-6410', N'CIJ', N'applicationFit',
    N'Above 1,433 fpm the 6410 and 6420 are past their single-line maximum.', N'Corvus 6400 technical data, Max speed single line: ''6410/6420: Up to 1,433 FPM''. Only the 6440 goes faster, at 1,791 FPM.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6410');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1433');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The 6410 prints a single line to 1,433 fpm. Consider the 6440 at 1,791 fpm.', NULL, NULL, NULL, NULL);

-- A-CIJ-SPD-6420  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-SPD-6420', N'CIJ', N'applicationFit',
    N'Above 1,433 fpm the 6420 is past its single-line maximum.', N'Corvus 6400 technical data, Max speed single line: ''6410/6420: Up to 1,433 FPM''.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6420');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1433');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The 6420 prints a single line to 1,433 fpm. Consider the 6440 at 1,791 fpm.', NULL, NULL, NULL, NULL);

-- A-CIJ-SPD-MAX  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424) and Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-SPD-MAX', N'CIJ', N'applicationFit',
    N'Above 1,791 fpm the 6440 is past its single-line maximum.', N'Corvus 6400 technical data, Max speed single line: ''6440: Up to 1,791 FPM''. That is the fastest figure in the range, so beyond it the application needs a laser: the Corvus CSL60 is rated to 2,952 ft/min.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424) and Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 and CSL60 datasheets', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6440');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1791');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The 6440 prints a single line to 1,791 fpm, the fastest in the range. A CSL60 laser is rated to 2,952 ft/min.', NULL, NULL, NULL, NULL);

-- A-CIJ-CHR-6400  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Character height range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-CHR-6400', N'CIJ', N'applicationFit',
    N'Past 8.6 mm the 6400 needs the larger printhead.', N'REPLACES a rule that refused above 8.64 mm (0.34") as the range''s ceiling. The Corvus per-model datasheets state a character height range of 1.8 to 20 mm on the PH4 Standard printhead and 2.1 to 20 mm on the Standard Plus, for the 6410, 6420 and 6440 alike — see data/vendor-docs.json, which transcribes them. The Axim combined sheet''s narrower figure tracks the PH4 Compact. Which printhead a part carries is stated in its description and not in an attribute a trigger can read, so this names both figures instead of choosing one. Corvus 6400 technical data, Character height range: ''6400/6410: 0.07" - 0.34"''. 0.34 inch is 8.64 mm. The 6420 and 6440 reach 0.47 inch, which is 11.94 mm.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Character height range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6400,6400LI');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'8.64');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past the 8.6 mm (0.34") stated on the Axim 6400 sheet. Corvus states 20 mm on the PH4 Standard and Standard Plus — confirm the printhead.', NULL, NULL, NULL, NULL);

-- A-CIJ-CHR-6410  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Character height range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-CHR-6410', N'CIJ', N'applicationFit',
    N'Past 8.6 mm the 6410 needs the larger printhead.', N'REPLACES a rule that refused above 8.64 mm (0.34") as the range''s ceiling. The Corvus per-model datasheets state a character height range of 1.8 to 20 mm on the PH4 Standard printhead and 2.1 to 20 mm on the Standard Plus, for the 6410, 6420 and 6440 alike — see data/vendor-docs.json, which transcribes them. The Axim combined sheet''s narrower figure tracks the PH4 Compact. Which printhead a part carries is stated in its description and not in an attribute a trigger can read, so this names both figures instead of choosing one. Corvus 6400 technical data, Character height range: ''6400/6410: 0.07" - 0.34"''. 0.34 inch is 8.64 mm.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Character height range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6410');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'8.64');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past the 8.6 mm (0.34") stated on the Axim 6400 sheet. Corvus states 20 mm for the 6410 on the PH4 Standard and Standard Plus — confirm the printhead.', NULL, NULL, NULL, NULL);

-- A-CIJ-CHR-MAX  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Character height range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-CHR-MAX', N'CIJ', N'applicationFit',
    N'Past 11.9 mm the 6420 and 6440 need the larger printhead.', N'REPLACES a rule that refused above 11.94 mm (0.47") as the range''s ceiling. The Corvus per-model datasheets state a character height range of 1.8 to 20 mm on the PH4 Standard printhead and 2.1 to 20 mm on the Standard Plus, for the 6410, 6420 and 6440 alike — see data/vendor-docs.json, which transcribes them. The Axim combined sheet''s narrower figure tracks the PH4 Compact. Which printhead a part carries is stated in its description and not in an attribute a trigger can read, so this names both figures instead of choosing one. Corvus 6400 technical data, Character height range: ''6420/6440: 0.07" - 0.47"''. 0.47 inch is 11.94 mm, the tallest in the range. Taller characters are a large-character or laser application.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Character height range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6420,6440');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'11.94');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past the 11.9 mm (0.47") stated on the Axim 6400 sheet. Corvus states 20 mm for the 6420 and 6440 on the PH4 Standard and Standard Plus — confirm the printhead.', NULL, NULL, NULL, NULL);

-- A-CIJ-IP-WASH  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Ingress protection rating — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-IP-WASH', N'CIJ', N'applicationFit',
    N'Only the 6440 is IP65. The rest of the range is IP55.', N'Corvus 6400 technical data, Ingress protection rating: ''6400/6410/6420: IP55, 6440: IP65''. IP55 is protection against dust and low-pressure water jets, which is not a washdown rating.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Ingress protection rating — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6400,6400PLUS,6400LI,6410,6410PLUS,6420,6420PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Washdown area. Only the 6440 is IP65; the 6400, 6410 and 6420 are IP55.', NULL, NULL, NULL, NULL);

-- A-CIJ-IP-6440-OK  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Ingress protection rating — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-IP-6440-OK', N'CIJ', N'applicationFit',
    N'The 6440 is the IP65 machine in the range, for washdown areas.', N'Corvus 6400 technical data, Ingress protection rating: ''6440: IP65''.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Ingress protection rating — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6440,6440PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'IP65, which is the washdown rating in this range.', NULL, NULL, NULL, NULL);

-- A-CIJ-LINES  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max lines of print — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-LINES', N'CIJ', N'note',
    N'The 6400 and 6410 print 3 lines; the 6420 and 6440 print 5.', N'Corvus 6400 technical data, Max lines of print: ''6400/6410: 3 lines, 6420/6440: 5 lines''. Worth checking against what has to go on the pack before the machine is chosen.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max lines of print — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6400,6400PLUS,6400LI,6410,6410PLUS,6420,6420PLUS,6440,6440PLUS');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'6400 and 6410 print 3 lines, 6420 and 6440 print 5. Check the message will fit.', NULL, NULL, NULL, NULL);

-- A-CIJ-TEMP  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Operating temperature range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-TEMP', N'CIJ', N'applicationFit',
    N'The 6400 range is rated to 113°F ambient, or 122°F on Corvus 1240 ink.', N'Corvus 6400 technical data, Operating temperature range: ''41-113°F (32-122°F for Corvus 1240 ink)''. A hot area either needs the ink changed or the printer moved.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Operating temperature range — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6400,6400PLUS,6400LI,6410,6410PLUS,6420,6420PLUS,6440,6440PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'high temperature');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated to 113°F ambient, or 122°F on Corvus 1240 ink. Confirm the ambient at the printhead.', NULL, NULL, NULL, NULL);

-- A-LSR-SPEED  Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Performance / Line Speed — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-SPEED', N'LSR', N'applicationFit',
    N'The CSL60 is the high-speed answer, to 2,952 ft/min.', N'CSL60 datasheet, Performance / Line Speed: ''Up to 2,952 ft/min (Code and Substrate Dependent)''. The 60W tube is described as suited to hard-to-mark materials such as glass and PET, and to high-speed lines.',
    N'Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Performance / Line Speed — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf', N'Corvus CSL60 datasheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1500');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'Rated to 2,952 ft/min, code and substrate dependent.', NULL, NULL, NULL, NULL);

-- A-LSR-IP-WASH  Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Laser Head Protection Class — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-IP-WASH', N'LSR', N'applicationFit',
    N'The CSL60 laser head is IP54 as standard; IP65 is an option.', N'CSL60 datasheet, Physical Characteristics / Laser Head Protection Class: ''IP54 or IP65 (Optional)''. Cooling changes with it: ''IP54 Air Cooled, IP65 Blower Unit''. A washdown area has to be quoted with the IP65 configuration.',
    N'Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Laser Head Protection Class — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf', N'Corvus CSL60 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Standard head is IP54. Quote the IP65 option and the blower cooling unit for washdown.', NULL, NULL, NULL, NULL);

-- A-LSR-TEMP  Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Operating Temperature Range — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-TEMP', N'LSR', N'applicationFit',
    N'The CSL60 is rated to 104°F ambient, lower than the CIJ range.', N'CSL60 datasheet, Operating Temperature Range: ''41 - 104°F Ambient''. The 6400 range reaches 113°F, so a hot area may rule the laser out where inkjet still works.',
    N'Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Operating Temperature Range — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf', N'Corvus CSL60 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'high temperature');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated to 104°F ambient. Confirm the ambient before committing to a laser here.', NULL, NULL, NULL, NULL);

-- A-PALM-SPEED  Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), LINE SPEED — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-SPEED', N'PALM', N'applicationFit',
    N'PL6300 line speed depends entirely on the apply module.', N'PL6300 technical data, LINE SPEED: ''Wipe: Up to 300 FPM, E-FASA: Up to 75 FPM, E-WASA: Up to 125 FPM, High Speed Tamp: Up to 300+ FPM''. A wipe module and an E-FASA differ fourfold, so the module has to be chosen against the line speed rather than after it.',
    N'Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), LINE SPEED — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'75');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Above 75 fpm rules out E-FASA. Wipe and High Speed Tamp reach 300 fpm; E-WASA 125.', NULL, NULL, NULL, NULL);

-- A-PALM-SPEED-MAX  Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), LINE SPEED — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-SPEED-MAX', N'PALM', N'applicationFit',
    N'Above 300 fpm no PL6300 apply module is rated for the line.', N'PL6300 technical data, LINE SPEED: the fastest figures stated are ''Wipe: Up to 300 FPM'' and ''High Speed Tamp: Up to 300+ FPM''. Beyond that the application needs engineering review rather than a catalogue answer.',
    N'Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), LINE SPEED — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'300');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past the fastest stated PL6300 figure of 300 fpm. Refer to Application Engineering.', NULL, NULL, NULL, NULL);

-- A-PALM-TEMP  Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), Temperature and Humidity — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-TEMP', N'PALM', N'applicationFit',
    N'The PL6300 is rated to 104°F and 85% relative humidity, non-condensing.', N'PL6300 technical data: ''Temperature 41°F to 104°F'' and ''Humidity 10 to 85% relative humidity, non-condensing''. A chilled or freezer area risks condensation, which the rating excludes.',
    N'Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), Temperature and Humidity — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'refrigerated');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated 41-104°F and non-condensing. A chilled area needs the condensation risk checked.', NULL, NULL, NULL, NULL);

-- A-PALM-CONDENSATION  Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), Humidity — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-CONDENSATION', N'PALM', N'applicationFit',
    N'The PL6300 humidity rating excludes condensation.', N'PL6300 technical data: ''Humidity 10 to 85% relative humidity, non-condensing''. Where condensation forms on the pack, labels stop adhering and the rating no longer covers the machine — a separate question from ambient temperature.',
    N'Axim-PL6300-Technical-Datasheet.pdf (DPL63000TS524), Humidity — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'condensation or humidity');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated to 85% relative humidity, non-condensing. Confirm label adhesion on a damp pack.', NULL, NULL, NULL, NULL);

-- A-PIJ-POROUS  ScanMark-Spec-Sheet.pdf (DSCA1022), Substrates — https://www.axim.example/Portals/0/adam/Content/RucqgQtGw0WTgt8_3rIPGA/DownloadUrl/ScanMark%20Spec%20Sheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-POROUS', N'PIJ', N'applicationFit',
    N'ScanMark ink is designed for porous substrates.', N'ScanMark spec sheet: ''Substrates: Designed for porous substrates'', ''Excellent adhesion to a variety of porous substrates'', ''Optimal contrast on porous substrates''. On a non-porous pack the ink is the wrong choice whatever the printer.',
    N'ScanMark-Spec-Sheet.pdf (DSCA1022), Substrates — https://www.axim.example/Portals/0/adam/Content/RucqgQtGw0WTgt8_3rIPGA/DownloadUrl/ScanMark%20Spec%20Sheet.pdf', N'Axim ScanMark spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'porosity', N'eq', N'nonPorous');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'ScanMark is specified for porous substrates. Confirm the ink against a non-porous pack.', NULL, NULL, NULL, NULL);

-- A-PIJ-BARCODE  ScanMark-Spec-Sheet.pdf (DSCA1022), Features and Benefits — https://www.axim.example/Portals/0/adam/Content/RucqgQtGw0WTgt8_3rIPGA/DownloadUrl/ScanMark%20Spec%20Sheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-BARCODE', N'PIJ', N'note',
    N'ScanMark is the pigment ink specified for GS1 barcode work.', N'ScanMark spec sheet: ''engineered to meet GS1 barcode requirements'', ''Pigment based ink for optimal barcode readability'', ''Premium barcode scanability''. It also notes ''the most forgiving of throw distances'' on secondary packaging.',
    N'ScanMark-Spec-Sheet.pdf (DSCA1022), Features and Benefits — https://www.axim.example/Portals/0/adam/Content/RucqgQtGw0WTgt8_3rIPGA/DownloadUrl/ScanMark%20Spec%20Sheet.pdf', N'Axim ScanMark spec sheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'messageContent', N'includes', N'barcode');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'For GS1 barcode work, ScanMark is the specified pigment ink.', NULL, NULL, NULL, NULL);

-- A-PIJ-SPD-TEXT  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-SPD-TEXT', N'PIJ', N'applicationFit',
    N'Above 250 fpm the Ridgeline 3200 is past its fastest published figure.', N'Ridgeline 3200 technical data, Print speed: ''Alphanumeric text: Up to 250 FPM @ 200 DPI''. That is the fastest number on the sheet, and it already assumes 200 DPI rather than the 300 DPI the head can reach.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'250');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past the fastest published Ridgeline figure of 250 fpm at 200 DPI. Refer to Application Engineering.', NULL, NULL, NULL, NULL);

-- A-PIJ-SPD-300DPI  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-SPD-300DPI', N'PIJ', N'note',
    N'Holding 300 DPI on the Ridgeline 3200 costs line speed.', N'Ridgeline 3200 technical data, Print speed: ''Up to 250 FPM @ 200 DPI'' and ''Up to 130 FPM @ 300 DPI'', with the note ''Higher line speeds achievable with reduction of DPI''. Above 130 fpm the resolution has to come down, so quote the resolution the line speed allows rather than the best the head can do.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'130');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'300 DPI is published to 130 fpm. Above that the resolution drops toward 200 DPI — confirm which the code needs.', NULL, NULL, NULL, NULL);

-- A-PIJ-SPD-BARCODE  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-SPD-BARCODE', N'PIJ', N'applicationFit',
    N'Barcodes on the Ridgeline 3200 are published to 150 fpm.', N'Ridgeline 3200 technical data, Print speed: ''Barcode: Up to 150 FPM @ 200 DPI''. Barcode work has its own, lower figure than text, and a scannable code is the whole point of quoting the machine.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'messageContent', N'includes', N'barcode');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'150');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Barcode print is published to 150 fpm at 200 DPI. This line is faster — get the code verified before quoting.', NULL, NULL, NULL, NULL);

-- A-PIJ-THROW-BARCODE  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Throw distance — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-THROW-BARCODE', N'PIJ', N'applicationFit',
    N'Barcodes need the printhead within 1/4 inch (6.35 mm).', N'Ridgeline 3200 technical data, Throw distance: ''Up to 1/4" for barcodes'', with the note ''Best barcodes at 1/8" and 300 DPI''. 1/4 inch is 6.35 mm and is the outer limit, not the target.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Throw distance — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'messageContent', N'includes', N'barcode');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throwDistMm', N'gt', N'6.35');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Barcodes are published to 1/4 inch (6.35 mm) throw, best at 1/8 inch. This gap is wider.', NULL, NULL, NULL, NULL);

-- A-PIJ-THROW-TEXT  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Throw distance — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-THROW-TEXT', N'PIJ', N'applicationFit',
    N'Past 1/2 inch (12.7 mm) throw the Ridgeline 3200 is outside its published range.', N'Ridgeline 3200 technical data, Throw distance: ''Up to 1/2" for text (application dependent)''. 1/2 inch is 12.7 mm, and the sheet''s own ''application dependent'' says the figure is not guaranteed even below it.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Throw distance — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throwDistMm', N'gt', N'12.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Published throw is up to 1/2 inch (12.7 mm) for text, and application dependent. This gap is wider.', NULL, NULL, NULL, NULL);

-- A-PIJ-WINDOW-MARK2  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print height — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-WINDOW-MARK2', N'PIJ', N'applicationFit',
    N'The Mark 2 head prints 2 inches (50.8 mm) tall.', N'Ridgeline 3200 technical data, Print height: ''Mark 2: 2"''. 2 inches is 50.8 mm. A taller mark needs the Mark 4, or two heads.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print height — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'eq', N'Mark 2');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'50.8');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The Mark 2 prints 2 inches (50.8 mm) tall. This mark is taller — quote the Mark 4 or a second head.', NULL, NULL, NULL, NULL);

-- A-PIJ-WINDOW-MARK4  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print height — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-WINDOW-MARK4', N'PIJ', N'applicationFit',
    N'The Mark 4 head prints 4 inches (101.6 mm) tall.', N'Ridgeline 3200 technical data, Print height: ''Mark 4: 4"''. 4 inches is 101.6 mm, and it is the tallest single head on the sheet.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Print height — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'eq', N'Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'101.6');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The Mark 4 prints 4 inches (101.6 mm) tall, the tallest single head. This mark needs stacked heads.', NULL, NULL, NULL, NULL);

-- A-PIJ-TEMP  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Environment — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-TEMP', N'PIJ', N'applicationFit',
    N'The Ridgeline 3200 is rated to 104°F ambient.', N'Ridgeline 3200 technical data, Environment: ''Ambient operating temp: 40˚ F to 104˚ F''. Above that the machine is outside its rating whatever the ink does.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Environment — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'104');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated 40-104°F ambient. This area runs hotter — the install needs cooling or a different position.', NULL, NULL, NULL, NULL);

-- A-PIJ-WASHDOWN  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), IP rating — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-WASHDOWN', N'PIJ', N'applicationFit',
    N'The Ridgeline 3200 IP65 rating is marked estimated on the datasheet.', N'Ridgeline 3200 technical data, IP rating: ''IP65 (estimated)''. The word estimated is Axim''s, printed on the sheet. For a washdown line that is not a rating to sell against — it needs confirming before the quote goes out.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), IP rating — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The datasheet says ''IP65 (estimated)''. Confirm the rating with Application Engineering before promising washdown.', NULL, NULL, NULL, NULL);

-- A-PIJ-CONDENSATION  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Environment — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-CONDENSATION', N'PIJ', N'applicationFit',
    N'The Ridgeline 3200 humidity rating excludes condensation.', N'Ridgeline 3200 technical data, Environment: ''Operating humidity: 5-90% non-condensing''. The range is wide, but condensation is outside it at any point in the range.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), Environment — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Axim Ridgeline 3200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'Ridgeline 3200,Mark 2,Mark 4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'condensation or humidity');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated 5-90% humidity, non-condensing. Condensation on the pack is outside the rating.', NULL, NULL, NULL, NULL);

-- A-TTO-IP20  https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/ngt6e, Specifications — IP Rate (also ngt8-8e.md, thorne-xl5000.md)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-IP20', N'TTO', N'applicationFit',
    N'Thermal transfer overprinters are rated IP20 — no liquid protection at all.', N'T406/6e, T408/8e and the Thorne T800 all publish ''IP Rate: IP20''. The second digit of an IP rating is water, and 0 means no protection whatsoever. This is not a machine to derate for a washdown line; it is a machine to keep out of one, or to enclose.',
    N'https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/ngt6e, Specifications — IP Rate (also ngt8-8e.md, thorne-xl5000.md)', N'Axim T400 and T800 product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Published IP20 — no water protection. A washdown line needs an enclosure quoted, or a different technology.', NULL, NULL, NULL, NULL);

-- A-TTO-TEMP  Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, Specifications — Environmental Temperature — https://www.axim.example/products/productcoding/thermaltransfer
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-TEMP', N'TTO', N'applicationFit',
    N'The T400 series is rated 41-104°F.', N'T402+ and T404+ specifications: ''Environmental Temperature 5 - 40°C (41-104°F)''. T406/6e, T408/8e and the T800 publish the same 5-40°C range. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, Specifications — Environmental Temperature — https://www.axim.example/products/productcoding/thermaltransfer', N'Axim T400 product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'104');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated to 104°F. This area runs hotter — the position or the cooling needs reviewing.', NULL, NULL, NULL, NULL);

-- A-TTO-HUMIDITY  https://www.axim.example/products/productcoding/thermaltransfer/ngt2plus, Specifications — Relative Humidity
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-HUMIDITY', N'TTO', N'applicationFit',
    N'Thermal transfer wants 20-75% humidity, non-condensing.', N'T402+ and T404+ specifications: ''Environment: Relative Humidity (non condensing) 20-75%''. Narrower at both ends than the inkjet ranges — condensation is out, and so is a very dry room, which is unusual enough to be worth saying.',
    N'https://www.axim.example/products/productcoding/thermaltransfer/ngt2plus, Specifications — Relative Humidity', N'Axim T400 product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'condensation or humidity');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated 20-75% relative humidity, non-condensing. Condensation on the ribbon or head is outside the rating.', NULL, NULL, NULL, NULL);

-- A-TTO-BAR-53  Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, Specifications — Thermal bar size — https://www.axim.example/products/productcoding/thermaltransfer
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-BAR-53', N'TTO', N'applicationFit',
    N'An T402+ prints 53 mm tall; taller needs an T404+.', N'T402+ specifications: ''Thermal bar size 2" (53mm)'' and ''Print area IM 53 x 50 mm''. The thermal bar is a physical width and cannot be exceeded. The T404+ bar is 4" (107mm). Because the hierarchy files all of these under one Product Type of ''T400 Series'', this cannot tell which one is on the quote — hence a caveat rather than a refusal. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, Specifications — Thermal bar size — https://www.axim.example/products/productcoding/thermaltransfer', N'Axim T402+ product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'T400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'53');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past the 53 mm T402+ print area. The T404+ prints 107 mm, the T406e 160 and the T408 213 — confirm which head this is.', NULL, NULL, NULL, NULL);

-- A-TTO-BAR-107  Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, SPECIFICATIONS — Print area (HxW) intermittent — https://www.axim.example/products/productcoding/thermaltransfer
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-BAR-107', N'TTO', N'applicationFit',
    N'Past 107 mm the mark needs an T406 or an T408.', N'REPLACES a rule that said ''107 mm is the widest thermal bar published in the T400 series'' and graded notRecommended above it. That was wrong, and the document it cited said so: the same specifications table states 160 mm for the T406e and 213 mm for the T408. The Thermal bar size row is given only for the T402+ and T404+, and reading it as the range''s ceiling ruled out two machines Axim sells. Thorne T400 specifications, Print area (HxW) intermittent: ''T402+ 2.1 x 3 in (53 x 75 mm), T404+ 4.2 x 3.5 in (107 x 90 mm), T406e 6.3 x 3.9 in (160 x 100 mm), T408 8.4 x 3.9 in (213 x 100 mm), T408e 8.4 x 6.1 in (213 x 155 mm)''. The hierarchy files all of these under one Product Type of ''T400 Series'', so a rule cannot tell which is on the quote — hence a caveat naming the machine that takes the next step, rather than a refusal.',
    N'Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, SPECIFICATIONS — Print area (HxW) intermittent — https://www.axim.example/products/productcoding/thermaltransfer', N'Thorne T400 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'T400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'107');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past the 107 mm T404+ print area. The T406e prints 160 mm and the T408 213 mm — confirm which head this is.', NULL, NULL, NULL, NULL);

-- A-VIJ-SPD  Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Specifications — Standard print speeds — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-SPD', N'VIJ', N'applicationFit',
    N'Above 200 fpm the IV series trades resolution for speed.', N'IV18-Dot and IV9-Dot specifications: ''Standard print speeds: Up to 200 FPM'' and ''Print speeds w/ reduced resolution: Up to 650 FPM''. The machine keeps running past 200 fpm; the code gets coarser, which matters if anything has to scan. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Specifications — Standard print speeds — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot', N'Axim IV series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'200');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Standard print speed is 200 fpm. Faster is published only at reduced resolution — confirm the code still reads.', NULL, NULL, NULL, NULL);

-- A-VIJ-SPD-MAX  Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Specifications — Print speeds w/ reduced resolution — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-SPD-MAX', N'VIJ', N'applicationFit',
    N'650 fpm is the fastest figure published for the IV series.', N'IV18-Dot and IV9-Dot specifications: ''Print speeds w/ reduced resolution: Up to 650 FPM''. That already assumes the resolution has been given up, so there is nothing left to trade. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Specifications — Print speeds w/ reduced resolution — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot', N'Axim IV series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'650');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past the fastest published IV figure of 650 fpm, and that is already at reduced resolution.', NULL, NULL, NULL, NULL);

-- A-VIJ-THROW  https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print distance
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-THROW', N'VIJ', N'applicationFit',
    N'The IV series prints up to 1/2 inch (12.7 mm) from the product.', N'IV18-Dot and IV9-Dot specifications: ''Print distance: Up to 1/2"''. 1/2 inch is 12.7 mm, and it is a ceiling rather than a target.',
    N'https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print distance', N'Axim IV series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throwDistMm', N'gt', N'12.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Published print distance is up to 1/2 inch (12.7 mm). This gap is wider.', NULL, NULL, NULL, NULL);

-- A-VIJ-TEMP  Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Specifications — Operating environment — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-TEMP', N'VIJ', N'applicationFit',
    N'The IV series is rated 40°F to 104°F.', N'IV18-Dot and IV9-Dot specifications: ''Operating environment: 40°F to 104°F''. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Specifications — Operating environment — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot', N'Axim IV series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'104');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated 40-104°F. This area runs hotter — the install needs cooling or a different position.', NULL, NULL, NULL, NULL);

-- A-VIJ-HEIGHT-IV18  https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, Specifications — Print height; https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-HEIGHT-IV18', N'VIJ', N'applicationFit',
    N'IV18 heads print 1 or 2 inches tall.', N'IV18-Dot specifications: ''Print height: 1" and 2" print heads''. 2 inches is 50.8 mm and is the taller of the two. A taller mark needs heads stacked. ''The print head can be daisy chained with up to 3 other IV18-Dot print heads, allowing it to print large logos or large multi-lined alphanumeric text messages.'' Three others plus the first is four heads of 2 inches: 203.2 mm.',
    N'https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, Specifications — Print height; https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, daisy chaining', N'Axim IV18-Dot product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'IV18');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'50.8');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'lte', N'203.2');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The mark is taller than one head prints (2.0", 50.8 mm). IV18 heads daisy chain — up to 4, covering 8.0" (203.2 mm) — so quote the heads the mark needs.', NULL, NULL, NULL, NULL);

-- A-VIJ-HEIGHT-IV9  https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print height; https://www.axim.example/products/casecoding/largecharacterinkjet, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-HEIGHT-IV9', N'VIJ', N'applicationFit',
    N'IV9 heads print 1/2 or 7/8 inch tall.', N'IV9-Dot specifications: ''Print height: 1/2" and 7/8"''. 7/8 inch is 22.2 mm and is the taller of the two, so an IV9 is the wrong head for a deep code — the IV18 reaches 2 inches. ''The print head is available in 1/2" and 7/8" print heights and can be daisy-chained with up to 15 other IV9-Dot print heads, allowing you to print large logos or other large multi-lined alpha numeric print messages.'' Fifteen others plus the first is sixteen heads of 7/8 inch: 355.2 mm.',
    N'https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print height; https://www.axim.example/products/casecoding/largecharacterinkjet, daisy chaining', N'Axim IV9-Dot product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'IV9');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'22.2');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'lte', N'355.2');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The mark is taller than one head prints (0.87", 22.2 mm). IV9 heads daisy chain — up to 16, covering 13.98" (355.2 mm) — so quote the heads the mark needs.', NULL, NULL, NULL, NULL);

-- A-TIJ-SPD  Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Standard Print Speeds — https://www.axim.example/products/productcoding/thermalinkjet
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-SPD', N'TIJ', N'applicationFit',
    N'Above 200 fpm the thermal jet heads trade resolution for speed.', N'TJ500 and TJ1000 specifications: ''Standard print speeds: Up to 200 FPM'' and ''Print speeds w/ reduced resolution: Up to 500 FPM''. Both heads print 300 x 300 DPI at the standard speed, which is what makes them worth quoting for a 2D code — so giving that up to go faster deserves saying out loud. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Standard Print Speeds — https://www.axim.example/products/productcoding/thermalinkjet', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'200');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Standard speed is 200 fpm at 300 DPI. Faster is published only at reduced resolution — confirm the code still reads.', NULL, NULL, NULL, NULL);

-- A-TIJ-SPD-MAX  Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Print Speeds w/reduced resolution — https://www.axim.example/products/productcoding/thermalinkjet
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-SPD-MAX', N'TIJ', N'applicationFit',
    N'500 fpm is the fastest figure published for the thermal jet heads.', N'TJ500 and TJ1000 specifications: ''Print speeds w/ reduced resolution: Up to 500 FPM''. That figure already assumes the resolution has been given up. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Print Speeds w/reduced resolution — https://www.axim.example/products/productcoding/thermalinkjet', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'500');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past the fastest published thermal jet figure of 500 fpm, and that is already at reduced resolution.', NULL, NULL, NULL, NULL);

-- A-TIJ-THROW  https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, Specifications — Print Distance
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-THROW', N'TIJ', N'applicationFit',
    N'Thermal jet prints within 1/4 inch (6.35 mm) of the product.', N'TJ500 and TJ1000 specifications: ''Print distance: Up to 1/4"''. 1/4 inch is 6.35 mm — half what the valve jet heads reach, and the tightest throw of any technology in the range. It is the figure most often missed when a thermal jet is swapped in for something else.',
    N'https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, Specifications — Print Distance', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throwDistMm', N'gt', N'6.35');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Published print distance is up to 1/4 inch (6.35 mm). This gap is wider — the head has to come closer.', NULL, NULL, NULL, NULL);

-- A-TIJ-TEMP  Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Operating Environment — https://www.axim.example/products/productcoding/thermalinkjet
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-TEMP', N'TIJ', N'applicationFit',
    N'Thermal jet is rated to 104°F.', N'TJ500 and TJ1000 specifications: ''Operating environment: 50°F to 104°F (10°C to 40°C)''. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Operating Environment — https://www.axim.example/products/productcoding/thermalinkjet', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'104');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated to 104°F. This area runs hotter — the install needs cooling or a different position.', NULL, NULL, NULL, NULL);

-- A-TIJ-TEMP-COLD  Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Operating environment — https://www.axim.example/products/productcoding/thermalinkjet
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-TEMP-COLD', N'TIJ', N'applicationFit',
    N'Thermal jet stops at 50°F, the highest floor in the range.', N'TJ500 and TJ1000 specifications: ''Operating environment: 50°F to 104°F''. Every other technology here is rated to 40°F or 41°F, so a cool room that suits a CIJ or a valve jet can be below spec for a thermal jet. Worth checking before the swap, not after. Cited to the spec sheet rather than the product page from 8 August 2026: the figure is stated in both and a spec sheet is the stronger reference.',
    N'Datasheets/Axim HP Thermal Jet System Datasheet.md, Specifications — Operating environment — https://www.axim.example/products/productcoding/thermalinkjet', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'50');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated down to 50°F only — higher than the rest of the range. Confirm the coldest the area gets.', NULL, NULL, NULL, NULL);

-- A-TIJ-REFRIGERATED  https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Operating environment
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-REFRIGERATED', N'TIJ', N'applicationFit',
    N'A refrigerated area is below the thermal jet''s 50°F floor.', N'TJ500 and TJ1000 specifications: ''Operating environment: 50°F to 104°F''. A chilled store or a refrigerated line runs well under 50°F by definition, so this is not a marginal call.',
    N'https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Operating environment', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'refrigerated');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Rated down to 50°F. A refrigerated area is below that — quote a technology rated for the cold.', NULL, NULL, NULL, NULL);

-- A-TIJ-HEIGHT-1IN  https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, Specifications — Print Height; https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-HEIGHT-1IN', N'TIJ', N'applicationFit',
    N'The taller thermal jet head prints 1 inch (25.4 mm).', N'TJ500 and TJ1000 specifications: ''Print height: 1/2" & 1" print heads''. 1 inch is 25.4 mm and is the taller of the two. A taller mark needs heads stacked, or another technology. ''Can be daisy chained with up to 8 cartridges for larger print applications.'' Eight 1-inch cartridges is 203.2 mm.',
    N'https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, Specifications — Print Height; https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, daisy chaining', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'1.0');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'25.4');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'lte', N'203.2');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The mark is taller than one head prints (1.0", 25.4 mm). thermal jet heads daisy chain — up to 8, covering 8.0" (203.2 mm) — so quote the heads the mark needs.', NULL, NULL, NULL, NULL);

-- A-TIJ-HEIGHT-HALF  https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Print height; https://www.axim.example/products/productcoding/thermalinkjet/tj-500, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-HEIGHT-HALF', N'TIJ', N'applicationFit',
    N'A 1/2 inch head prints 12.7 mm.', N'TJ500 and TJ1000 specifications: ''Print height: 1/2" & 1" print heads''. The hierarchy files these as ''HP 0.5"'' and ''HP 1.0"'', so where a half-inch head is on the quote the limit is 12.7 mm rather than 25.4 mm. ''Can be daisy chained with up to 8 cartridges for larger print application.'' Eight half-inch cartridges is 101.6 mm.',
    N'https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Print height; https://www.axim.example/products/productcoding/thermalinkjet/tj-500, daisy chaining', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'0.5');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'12.7');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'lte', N'101.6');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The mark is taller than one head prints (0.5", 12.7 mm). thermal jet heads daisy chain — up to 8, covering 4.0" (101.6 mm) — so quote the heads the mark needs.', NULL, NULL, NULL, NULL);

-- A-TIJ-WASHDOWN  data/application-analysis-notes.md, TIJ App Analysis — Wash Down Environs; https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, Specifications — Enclosure
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-WASHDOWN', N'TIJ', N'applicationFit',
    N'No IP rating is published for any part of a TIJ system.', N'Axim''s TIJ application analysis form asks ''Wash Down Environs?'' and answers it in the same breath: ''controllers, ink sys & PH''s aren''t IP rated''. The TJ product pages agree by omission — the enclosure is given as ''Industrial thermoplastic, drop resistant'', which is a drop claim and not an ingress rating. Neither source gives a number to quote against.',
    N'data/application-analysis-notes.md, TIJ App Analysis — Wash Down Environs; https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, Specifications — Enclosure', N'Axim TIJ application analysis form and TJ product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'No IP rating is published for the TIJ controller or ink system. A washdown line needs an enclosure quoted, or another technology.', NULL, NULL, NULL, NULL);

-- A-VIJ-WASHDOWN  data/application-analysis-notes.md, VIJ App Analysis — Wash Down Environs; https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, Specifications — Enclosure
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-WASHDOWN', N'VIJ', N'applicationFit',
    N'No IP rating is published for any part of a VIJ system.', N'Axim''s VIJ application analysis form asks ''Wash Down Environs?'' and answers it in the same breath: ''controllers, ink sys & PH''s aren''t IP rated''. The IV product pages do describe the printhead enclosure as ''Stainless steel, environmentally sealed'', which is a claim about the head and not an ingress rating for the controller or the ink delivery system. Neither source gives a number to quote against.',
    N'data/application-analysis-notes.md, VIJ App Analysis — Wash Down Environs; https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, Specifications — Enclosure', N'Axim VIJ application analysis form and IV product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'No IP rating is published for the VIJ controller or ink system. A washdown line needs an enclosure quoted, or another technology.', NULL, NULL, NULL, NULL);

-- A-TIJ-TURBULENCE  data/application-analysis-notes.md, TIJ App Analysis — Air Turbulence near PH
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-TURBULENCE', N'TIJ', N'applicationFit',
    N'Fast moving air at the printhead spoils high-resolution print.', N'Axim''s application analysis form: ''Fast moving air at PH can adversely affect print quality in hi-res applications (IJ & TJ). It can also carry ink vapor to accumulate on surroundings.'' Two separate problems — the code, and ink settling on the machine around it.',
    N'data/application-analysis-notes.md, TIJ App Analysis — Air Turbulence near PH', N'Axim TIJ application analysis form', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'air turbulence near printhead');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Moving air at the head degrades hi-res print and carries ink vapour onto surroundings. Shield the head or move the fan.', NULL, NULL, NULL, NULL);

-- A-VIJ-TURBULENCE  data/application-analysis-notes.md, VIJ App Analysis — Air Turbulence near PH
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-TURBULENCE', N'VIJ', N'applicationFit',
    N'Fast moving air at the printhead spoils high-resolution print.', N'Axim''s application analysis form: ''Fast moving air at PH can adversely affect print quality in hi-res applications (IJ & TJ). It can also carry ink vapor to accumulate on surroundings.'' Two separate problems — the code, and ink settling on the machine around it.',
    N'data/application-analysis-notes.md, VIJ App Analysis — Air Turbulence near PH', N'Axim VIJ application analysis form', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'air turbulence near printhead');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Moving air at the head degrades hi-res print and carries ink vapour onto surroundings. Shield the head or move the fan.', NULL, NULL, NULL, NULL);

-- A-TIJ-RAILS  data/application-analysis-notes.md, TIJ App Analysis — Guide Rails or other product positioning
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-RAILS', N'TIJ', N'applicationFit',
    N'Without guide rails the product-to-printhead distance wanders.', N'Axim''s application analysis form, on product positioning: ''Distance from product to PH is critical for quality hi-res print''. A pack that can drift across the belt changes its own throw distance, and the print changes with it.',
    N'data/application-analysis-notes.md, TIJ App Analysis — Guide Rails or other product positioning', N'Axim TIJ application analysis form', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'guideRails', N'eq', N'no');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Distance from product to printhead is critical for hi-res print. Quote guide rails or another way to hold position.', NULL, NULL, NULL, NULL);

-- A-VIJ-RAILS  data/application-analysis-notes.md, VIJ App Analysis — Guide Rails or other product positioning
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-RAILS', N'VIJ', N'applicationFit',
    N'Without guide rails the product-to-printhead distance wanders.', N'Axim''s application analysis form, on product positioning: ''Distance from product to PH is critical for quality hi-res print''. A pack that can drift across the belt changes its own throw distance, and the print changes with it.',
    N'data/application-analysis-notes.md, VIJ App Analysis — Guide Rails or other product positioning', N'Axim VIJ application analysis form', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'guideRails', N'eq', N'no');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Distance from product to printhead is critical for hi-res print. Quote guide rails or another way to hold position.', NULL, NULL, NULL, NULL);

-- A-CIJ-SPD-CEILING  Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-SPD-CEILING', N'CIJ', N'applicationFit',
    N'1,791 fpm is the fastest single-line figure anywhere in the CIJ range.', N'Corvus 6400 technical data, Max speed single line: ''6440: Up to 1,791 FPM''. A-CIJ-SPD-MAX says the same thing but is scoped to the 6440, so it can only speak for the machine that happens to be the fastest — every other CIJ printer stayed silent above 1,791 and rendered as unassessed. This one is scoped to the technology, which is what the sentence ''the fastest in the range'' actually means.',
    N'Axim-Corvus-6400-technical-datasheet.pdf (DCORVUS89000424), Max speed single line — https://www.axim.example/Portals/0/adam/Content/pC7OwFgRNkm_yOQy0Z1O9w/DownloadUrl/Axim%20Corvus%208900%20technical%20datasheet.pdf', N'Corvus 6400 technical datasheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1791');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past 1,791 fpm, which is the fastest single-line speed published for any CIJ printer here. A CSL60 laser is rated to 2,952 ft/min.', NULL, NULL, NULL, NULL);

-- A-LSR-SPD-CEILING  Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Performance / Line Speed — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-SPD-CEILING', N'LSR', N'applicationFit',
    N'2,952 ft/min is the fastest laser figure published, and it is the fastest figure in the tool.', N'CSL60 datasheet, Performance / Line Speed: ''Up to 2,952 ft/min (Code and Substrate Dependent)''. Nothing in the catalogue is quoted faster, so above this the honest answer is that no machine here meets the requirement — not that the choice is a difficult one. Note the parenthesis: the figure is code- and substrate-dependent, so it is a ceiling on the best case rather than a promise.',
    N'Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf, Performance / Line Speed — https://www.axim.example/Portals/0/PDF/Axim-Corvus-CSL60-Laser-Coder-Datasheet.pdf', N'Corvus CSL60 datasheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'2952');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past 2,952 ft/min. That is the fastest line speed published for any machine in this tool, so nothing here meets this requirement.', NULL, NULL, NULL, NULL);

-- A-TTO-SPD-CEILING  Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, Print Speed — https://www.axim.example/products/productcoding/thermaltransfer
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-SPD-CEILING', N'TTO', N'applicationFit',
    N'115 ft/min is the fastest TTO print speed published.', N'Thorne T400 specifications, Print Speed: ''Max.: 35 m/min / 115 ft/min'' for the continuous variant; the intermittent variants are quoted lower at 95, 56 and 46 ft/min. Worth knowing when reading this: the T800 is specified in prints per minute (450 ppm) rather than line speed, so a fast TTO application is often better described by throughput than by fpm.',
    N'Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, Print Speed — https://www.axim.example/products/productcoding/thermaltransfer', N'Thorne T400 spec sheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'115');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past 115 ft/min, the fastest thermal transfer figure published here. A TTO indexes film against a stationary head, so line speed is a hard limit rather than a quality trade-off.', NULL, NULL, NULL, NULL);

-- A-PALM-SPD-CEILING  Axim-PL6300-Technical-Datasheet.pdf (DPL63000TDS), line speed — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-SPD-CEILING', N'PALM', N'applicationFit',
    N'300 fpm is the fastest print-and-apply line speed published.', N'PL6300 technical datasheet. A-PALM-SPEED-MAX carries the same figure but is scoped to a model, so every other applicator was silent above it. Applying a label needs the pack to be reachable for the length of the apply stroke, which is why this ceiling is so much lower than an inkjet''s.',
    N'Axim-PL6300-Technical-Datasheet.pdf (DPL63000TDS), line speed — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'300');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past 300 fpm, the fastest print-and-apply speed published here. Above this, code the pack directly instead of applying a label.', NULL, NULL, NULL, NULL);

-- A-PIJ-SPD-CEILING  Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-SPD-CEILING', N'PIJ', N'applicationFit',
    N'250 fpm is the fastest high-resolution inkjet figure, and that is for text.', N'Ridgeline 3200 technical datasheet. The published figure is for text; barcodes are quoted at 150 fpm, because a barcode has to hold its bar-to-space ratio and a piezo drop has a fixed flight time. A-PIJ-SPD-TEXT holds the same number scoped to a model, which left every other hi-res printer unassessed above it.',
    N'Ridgeline-5000-Technical-Datasheet-1.pdf (DRESSP0424), print speed — https://www.axim.example/Portals/0/adam/Content/zCAv1fNCWEqGxnl1RvOluA/DownloadUrl/Ridgeline%205000%20Technical%20Datasheet-1.pdf', N'Ridgeline 3200 datasheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'250');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past 250 fpm, the fastest high-resolution figure published here, and that figure is for text rather than barcodes.', NULL, NULL, NULL, NULL);

-- A-CIJ-LINES-6400  Datasheets/Literature_CIJ_Corvus6400Series_SpecSheetWEB.md, Max Lines of Print — https://www.axim.example/Portals/0/Downloads/6400-literature.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-LINES-6400', N'CIJ', N'applicationFit',
    N'The 6400 prints three lines. Five is the 6410 and above.', N'Corvus 6400 series specification, Max Lines of Print: the 6400 column reads 3 and the higher column reads 5. The two columns also differ on character height (0.07-0.34in against 0.07-0.47in) and single-line speed (574 fpm against 1,230), so an application needing four lines is not a close call on the 6400 - it is the wrong column of the table.',
    N'Datasheets/Literature_CIJ_Corvus6400Series_SpecSheetWEB.md, Max Lines of Print — https://www.axim.example/Portals/0/Downloads/6400-literature.pdf', N'Corvus 6400 series spec sheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'linesOfPrint', N'gt', N'3');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The 6400 prints three lines. This application needs more, which is an 6410 or above.', NULL, NULL, NULL, NULL);

-- A-CIJ-LINES-MAX  Datasheets/Literature_CIJ_Corvus6400Series_SpecSheetWEB.md, Max Lines of Print — https://www.axim.example/Portals/0/Downloads/6400-literature.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-LINES-MAX', N'CIJ', N'applicationFit',
    N'Five lines is the most any CIJ printer here prints.', N'Corvus 6400 series specification, Max Lines of Print: 5 is the highest figure in the range. Beyond it the answer is a different technology rather than a different printer - a thermal jet head prints up to ten lines, and a laser is not limited by lines at all.',
    N'Datasheets/Literature_CIJ_Corvus6400Series_SpecSheetWEB.md, Max Lines of Print — https://www.axim.example/Portals/0/Downloads/6400-literature.pdf', N'Corvus 6400 series spec sheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'linesOfPrint', N'gt', N'5');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past five lines, the most any CIJ printer here prints. A thermal jet head does ten.', NULL, NULL, NULL, NULL);

-- A-TIJ-LINES-MAX  Datasheets/Axim HP Thermal Jet System Datasheet.md, overview — https://www.axim.example/products/productcoding/thermalinkjet
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-LINES-MAX', N'TIJ', N'applicationFit',
    N'Ten lines is the published thermal jet maximum.', N'HP Thermal Jet System datasheet: ''high resolution text, barcodes and graphics up to 1" tall or up to 10 lines of print''. Note the ''or'' - the ten-line figure and the one-inch figure are alternatives, not both at once, because they are the same print window divided differently.',
    N'Datasheets/Axim HP Thermal Jet System Datasheet.md, overview — https://www.axim.example/products/productcoding/thermalinkjet', N'Axim HP Thermal Jet datasheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'linesOfPrint', N'gt', N'10');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past ten lines, the most the thermal jet heads print.', NULL, NULL, NULL, NULL);

-- A-CIJ-LINES-CJ250  Datasheets/Literature_CIJ_CorvusCJ250_SpecSheetWEB.md, overview
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-LINES-CJ250', N'CIJ', N'applicationFit',
    N'The CJ250 prints three lines.', N'Corvus CJ250 spec sheet: ''can be used on multiple lines to print up to three lines of information''. It is the portable unit in the range, and the line count is the trade for that.',
    N'Datasheets/Literature_CIJ_CorvusCJ250_SpecSheetWEB.md, overview', N'Corvus CJ250 spec sheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'CJ250');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'linesOfPrint', N'gt', N'3');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The CJ250 prints three lines.', NULL, NULL, NULL, NULL);

-- A-PIJ-BARCODE-THROW  Datasheets/Axim HR2600 High Resolution Inkjet Datasheet.md, throw distance — https://www.axim.example/products/casecoding/highresolutioninkjet
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-BARCODE-THROW', N'PIJ', N'applicationFit',
    N'A barcode halves the usable throw distance.', N'HR2600 datasheet, throw distance: ''Up to 1/4" (6 mm) for Barcodes, Up to 1/2" for Text (Application Dependent)''. A barcode has to hold its bar-to-space ratio, and drop placement scatters with distance, so the figure that applies is the barcode one whenever a barcode is on the message. Quoting the text figure to a customer printing a GS1 code is how a system passes a demo and fails validation.',
    N'Datasheets/Axim HR2600 High Resolution Inkjet Datasheet.md, throw distance — https://www.axim.example/products/casecoding/highresolutioninkjet', N'Axim HR2600 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'barcodeRequirements', N'ne', N'');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throwDistMm', N'gt', N'6');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past 6 mm, which is the barcode figure. 12 mm is the text figure and does not apply once a barcode is on the message.', NULL, NULL, NULL, NULL);

-- A-VIJ-CHAIN-IV18  https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-CHAIN-IV18', N'VIJ', N'applicationFit',
    N'4 chained IV18 heads reach 8.0" (203.2 mm).', N'''The print head can be daisy chained with up to 3 other IV18-Dot print heads, allowing it to print large logos or large multi-lined alphanumeric text messages.'' Three others plus the first is four heads of 2 inches: 203.2 mm. A mark taller than the whole chain is past what this technology can print, however many heads are quoted.',
    N'https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot, daisy chaining', N'Axim IV18-Dot product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'IV18');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'203.2');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Even 4 chained heads print 8.0" (203.2 mm), and this mark is taller.', NULL, NULL, NULL, NULL);

-- A-VIJ-CHAIN-IV9  https://www.axim.example/products/casecoding/largecharacterinkjet, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-CHAIN-IV9', N'VIJ', N'applicationFit',
    N'16 chained IV9 heads reach 13.98" (355.2 mm).', N'''The print head is available in 1/2" and 7/8" print heights and can be daisy-chained with up to 15 other IV9-Dot print heads, allowing you to print large logos or other large multi-lined alpha numeric print messages.'' Fifteen others plus the first is sixteen heads of 7/8 inch: 355.2 mm. A mark taller than the whole chain is past what this technology can print, however many heads are quoted.',
    N'https://www.axim.example/products/casecoding/largecharacterinkjet, daisy chaining', N'Axim IV9-Dot product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'IV9');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'355.2');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Even 16 chained heads print 13.98" (355.2 mm), and this mark is taller.', NULL, NULL, NULL, NULL);

-- A-TIJ-CHAIN-1IN  https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-CHAIN-1IN', N'TIJ', N'applicationFit',
    N'8 chained thermal jet heads reach 8.0" (203.2 mm).', N'''Can be daisy chained with up to 8 cartridges for larger print applications.'' Eight 1-inch cartridges is 203.2 mm. A mark taller than the whole chain is past what this technology can print, however many heads are quoted.',
    N'https://www.axim.example/products/productcoding/thermalindustrialinkjetprinter/tj-1000, daisy chaining', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'1.0');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'203.2');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Even 8 chained heads print 8.0" (203.2 mm), and this mark is taller.', NULL, NULL, NULL, NULL);

-- A-TIJ-CHAIN-HALF  https://www.axim.example/products/productcoding/thermalinkjet/tj-500, daisy chaining
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-CHAIN-HALF', N'TIJ', N'applicationFit',
    N'8 chained thermal jet heads reach 4.0" (101.6 mm).', N'''Can be daisy chained with up to 8 cartridges for larger print application.'' Eight half-inch cartridges is 101.6 mm. A mark taller than the whole chain is past what this technology can print, however many heads are quoted.',
    N'https://www.axim.example/products/productcoding/thermalinkjet/tj-500, daisy chaining', N'Axim HJ series product pages', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'0.5');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'101.6');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Even 8 chained heads print 4.0" (101.6 mm), and this mark is taller.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-SPEED  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Line Speed — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-SPEED', N'PALM', N'applicationFit',
    N'LB5200 line speed depends entirely on the apply module.', N'LB5200 specifications, Line Speed: ''Wipe: Up to 300 FPM, E-Tamp and E-Tamp/Blow: Up to 150 FPM, E-FASA: Up to 75 FPM, E-WASA: Up to 125 FPM, High Speed Tamp: 300+ FPM''. A wipe module and an E-FASA differ fourfold, so the module has to be chosen against the line speed rather than after it.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Line Speed — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'75');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Above 75 fpm rules out E-FASA. E-WASA reaches 125, E-Tamp and E-Tamp/Blow 150, wipe and High Speed Tamp 300.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-SPEED-MAX  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Line Speed — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-SPEED-MAX', N'PALM', N'applicationFit',
    N'Above 300 fpm no LB5200 apply module is rated for the line.', N'LB5200 specifications, Line Speed: the fastest figures stated are ''Wipe: Up to 300 FPM'' and ''High Speed Tamp: 300+ FPM''. Beyond that the application needs engineering review rather than a catalogue answer.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Line Speed — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'300');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past the fastest stated LB5200 figure of 300 fpm. Refer to Application Engineering.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-RATE  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Product Rate — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-RATE', N'PALM', N'applicationFit',
    N'Above 120 products a minute only the wipe module is rated.', N'LB5200 specifications, Product Rate: ''Wipe: Up to 800 PPM, E-Tamp: Up to 120 PPM, E-Tamp/Blow: Up to 55 PPM, E-FASA: Single Apply Up to 52 PPM; Dual Apply Up to 28 PPM''. Product rate and line speed are different questions and a fast line can still be a low rate — a 22 inch case at 300 fpm is 163 a minute, a 4 inch bottle at 100 fpm is 300.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Product Rate — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throughputPpm', N'gt', N'120');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Above 120 per minute leaves only the wipe module, rated to 800. E-Tamp is 120, E-WASA depends on label length and spacing.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-RATE-MAX  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Product Rate — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-RATE-MAX', N'PALM', N'applicationFit',
    N'800 a minute is the fastest LB5200 product rate published.', N'LB5200 specifications, Product Rate: ''Wipe: Up to 800 PPM'' is the highest figure on the sheet, and it is the wipe module only.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Product Rate — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throughputPpm', N'gt', N'800');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past the fastest stated LB5200 rate of 800 per minute, which is wipe only.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-TEMP-HOT  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Temperature — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-TEMP-HOT', N'PALM', N'applicationFit',
    N'The LB5200 is rated to 104°F.', N'LB5200 specifications, Temperature: ''41°F – 104°F (5°C – 40°C)''. Above that the servo drive and the controller are outside their stated range.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Temperature — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'104');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Above the LB5200''s stated 104°F ceiling.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-TEMP-COLD  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Temperature — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-TEMP-COLD', N'PALM', N'applicationFit',
    N'The LB5200 stops at 41°F, so a chilled area is outside its range.', N'LB5200 specifications, Temperature: ''41°F – 104°F'' and Humidity: ''10 to 85% Relative Humidity, Non-Condensing''. A chilled or freezer area is both below the floor and a condensation risk, which the rating excludes.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Temperature — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'41');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Below the LB5200''s stated 41°F floor, and a condensation risk its non-condensing rating excludes.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-REFRIGERATED  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Temperature and Humidity — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-REFRIGERATED', N'PALM', N'applicationFit',
    N'A refrigerated area is below the LB5200''s 41°F floor.', N'LB5200 specifications, Temperature: ''41°F – 104°F (5°C – 40°C)'', Humidity: ''10 to 85% Relative Humidity, Non-Condensing''. Chilled areas run below the floor and condense on cold metal.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, Temperature and Humidity — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'refrigerated');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'A refrigerated area is below the LB5200''s stated 41°F floor and outside its non-condensing rating.', NULL, NULL, NULL, NULL);

-- A-PALM-ZE-TEMP-HOT  Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Environmental — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-ZE-TEMP-HOT', N'PALM', N'applicationFit',
    N'The Palisade print engines are rated to 104°F.', N'Palisade PE311/PE321 spec sheet, Environmental: ''Operating Temperature: 31°F to 104°F/0°C to 40°C'' and ''Operating Humidity: 20% to 95% non-condensing R.H.'' The engine sits inside the applicator, so the applicator''s own rating is not the whole answer — whichever is narrower governs.',
    N'Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Environmental — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf', N'Palisade PE311/PE321 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'ZE5');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'104');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Above the print engine''s stated 104°F ceiling. The engine is inside the applicator and has its own rating.', NULL, NULL, NULL, NULL);

-- A-PALM-ZE-TEMP-COLD  Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Environmental — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-ZE-TEMP-COLD', N'PALM', N'applicationFit',
    N'The Palisade print engines stop at 31°F.', N'Palisade PE311/PE321 spec sheet, Environmental: ''Operating Temperature: 31°F to 104°F/0°C to 40°C'' and ''Operating Humidity: 20% to 95% non-condensing R.H.'' The engine sits inside the applicator, so the applicator''s own rating is not the whole answer — whichever is narrower governs.',
    N'Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Environmental — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf', N'Palisade PE311/PE321 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'ZE5');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'31');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Below the print engine''s stated 31°F floor.', NULL, NULL, NULL, NULL);

-- A-PALM-ZE-REFRIGERATED  Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Environmental — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-ZE-REFRIGERATED', N'PALM', N'applicationFit',
    N'A refrigerated area is inside the engine''s range and against its humidity rating.', N'Palisade PE311/PE321 spec sheet, Environmental: ''Operating Temperature: 31°F to 104°F/0°C to 40°C'' and ''Operating Humidity: 20% to 95% non-condensing R.H.'' The engine sits inside the applicator, so the applicator''s own rating is not the whole answer — whichever is narrower governs.',
    N'Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Environmental — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf', N'Palisade PE311/PE321 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'ZE5');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'refrigerated');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'A chilled area is within the engine''s 31°F floor but its humidity rating is non-condensing, and a cold engine in a warm room condenses. Check the applicator''s rating too.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-LBL-WIDE  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-LBL-WIDE', N'PALM', N'applicationFit',
    N'The LB5200 takes a label up to 9 inches, and only on the wide web.', N'LB5200 specifications: ''Narrow Web Label Width 0.5" (12.7 mm) Min. up to 6" (152.4 mm)'' and ''Wide Web Label Width 0.5" (12.7 mm) Min. up to 9" (228.6 mm)''. Past 9 inches no configuration is rated.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'228.6');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Wider than the LB5200''s widest stated label, 9 inches on the wide web.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-LBL-WIDEWEB  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-LBL-WIDEWEB', N'PALM', N'applicationFit',
    N'Past 6 inches only the wide web LB5200 is rated.', N'LB5200 specifications: ''Narrow Web Label Width 0.5" (12.7 mm) Min. up to 6" (152.4 mm)'' and ''Wide Web Label Width 0.5" (12.7 mm) Min. up to 9" (228.6 mm)''. The two are different machines to order rather than an option to add later. This was a caveat on every LB5200 row, because the catalogue recorded the web width only in the description text and not as an attribute a trigger could read — so a rep quoting the wide web machine was cautioned about a limit that machine does not have. data/build_classification.py derives Web Width from that same description now, so the narrow web rows can be ruled out and the wide web ones left alone.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'block', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'attribute', NULL, NULL, NULL, N'Web Width', N'Narrow', NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'152.4');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The narrow web LB5200 is rated to 6 inches. This label is wider, so it needs the wide web machine, which is rated to 9.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-LBL-WIDEWEB-OK  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-LBL-WIDEWEB-OK', N'PALM', N'applicationFit',
    N'Past 6 inches the wide web LB5200 is the one that is rated.', N'LB5200 specifications: ''Wide Web Label Width 0.5" (12.7 mm) Min. up to 9" (228.6 mm)''. The narrow web machine stops at 6 inches and is ruled out above it by A-PALM-LA7-LBL-WIDEWEB; this is the other half, so a label between 6 and 9 inches reads as a machine that fits rather than as a range where nothing was said.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'attribute', NULL, NULL, NULL, N'Web Width', N'Wide', NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'152.4');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'The wide web LB5200 is rated to 9 inches, which covers this label.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-LBL-NARROW  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-LBL-NARROW', N'PALM', N'applicationFit',
    N'An inch or less has to be application tested before it is quoted.', N'LB5200 specifications, stated twice on the sheet: ''Label widths 1" and below must be application tested and verified''. The floor is 0.5" (12.7 mm).',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lte', N'25.4');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The sheet says a label an inch or narrower must be application tested and verified before it is quoted.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-LBL-MIN  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-LBL-MIN', N'PALM', N'applicationFit',
    N'Below half an inch the LB5200 is outside its stated range.', N'LB5200 specifications: label width minimum is 0.5" (12.7 mm) on both narrow and wide web.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lt', N'12.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Narrower than the LB5200''s stated 0.5 inch minimum.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-LBL-LONG  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-LBL-LONG', N'PALM', N'applicationFit',
    N'The LB5200 takes a label up to 22 inches long.', N'LB5200 specifications: ''Label Length 1" (25.4 mm) Min. up to 22" (558.8 mm)''.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelLengthMm', N'gt', N'558.8');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Longer than the LB5200''s stated 22 inch maximum.', NULL, NULL, NULL, NULL);

-- A-PALM-LA7-LBL-SHORT  Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LA7-LBL-SHORT', N'PALM', N'applicationFit',
    N'The LB5200 needs a label at least an inch long.', N'LB5200 specifications: ''Label Length 1" (25.4 mm) Min.'' The PL6300 goes down to half an inch and the LB5200 does not, which is a real difference between them.',
    N'Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf, SPECIFICATIONS — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'LB5200');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelLengthMm', N'lt', N'25.4');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Shorter than the LB5200''s stated 1 inch minimum. The PL6300 is rated to 0.5.', NULL, NULL, NULL, NULL);

-- A-PALM-PA7-LBL-WIDE  Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PA7-LBL-WIDE', N'PALM', N'applicationFit',
    N'The PL6300 takes a label up to 6.5 inches.', N'PL6300 technical data: ''Label width 0.5" to 6.5"''. The LB5200 reaches 9 on the wide web, which is the reason to move between them.',
    N'Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'165.1');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Wider than the PL6300''s stated 6.5 inch maximum. The wide web LB5200 reaches 9.', NULL, NULL, NULL, NULL);

-- A-PALM-PA7-LBL-NARROW  Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PA7-LBL-NARROW', N'PALM', N'applicationFit',
    N'An inch or less has to be application tested before it is quoted.', N'PL6300 technical data: ''Label widths 1" and below must be application tested and verified''.',
    N'Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lte', N'25.4');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The sheet says a label an inch or narrower must be application tested and verified before it is quoted.', NULL, NULL, NULL, NULL);

-- A-PALM-PA7-LBL-MIN  Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PA7-LBL-MIN', N'PALM', N'applicationFit',
    N'Below half an inch the PL6300 is outside its stated range.', N'PL6300 technical data: ''Label width 0.5" to 6.5"''.',
    N'Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lt', N'12.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Narrower than the PL6300''s stated 0.5 inch minimum.', NULL, NULL, NULL, NULL);

-- A-PALM-PA7-LBL-LONG  Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PA7-LBL-LONG', N'PALM', N'applicationFit',
    N'The PL6300 takes a label up to 14 inches long.', N'PL6300 technical data: ''Label length 0.5" to 14"''. The LB5200 reaches 22.',
    N'Axim-PL6300-Technical-Datasheet.pdf, TECHNICAL DATA — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelLengthMm', N'gt', N'355.6');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Longer than the PL6300''s stated 14 inch maximum. The LB5200 reaches 22.', NULL, NULL, NULL, NULL);

-- A-PALM-PE311-LBL-WIDE  Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PE311-LBL-WIDE', N'PALM', N'applicationFit',
    N'The PE311 engine prints media up to 4.5 inches wide.', N'Palisade PE311/PE321 spec sheet, Media: ''PE311: .625 in./16 mm - 4.5 in./114 mm''. The PE321 takes 3 to 7.1 inches, so a wide label is a different engine rather than a different option.',
    N'Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf', N'Palisade PE311/PE321 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PE311');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'114.3');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Wider than the PE311''s stated 4.5 inch media maximum. The PE321 reaches 7.1.', NULL, NULL, NULL, NULL);

-- A-PALM-PE311-LBL-MIN  Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PE311-LBL-MIN', N'PALM', N'applicationFit',
    N'The PE311 engine needs media at least 0.625 inches wide.', N'Palisade PE311/PE321 spec sheet, Media: ''PE311: .625 in./16 mm - 4.5 in./114 mm''.',
    N'Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf', N'Palisade PE311/PE321 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PE311');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lt', N'15.9');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Narrower than the PE311''s stated 0.625 inch media minimum.', NULL, NULL, NULL, NULL);

-- A-PALM-PE321-LBL-WIDE  Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PE321-LBL-WIDE', N'PALM', N'applicationFit',
    N'The PE321 engine prints media up to 7.1 inches wide.', N'Palisade PE311/PE321 spec sheet, Media: ''PE321: 3 in./76 mm - 7.1 in./180 mm''.',
    N'Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf', N'Palisade PE311/PE321 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PE321');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'180.3');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Wider than the PE321''s stated 7.1 inch media maximum.', NULL, NULL, NULL, NULL);

-- A-PALM-PE321-LBL-MIN  Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PE321-LBL-MIN', N'PALM', N'applicationFit',
    N'The PE321 engine will not take media under 3 inches.', N'Palisade PE311/PE321 spec sheet, Media: ''PE321: 3 in./76 mm - 7.1 in./180 mm''. The PE311 starts at 0.625, so a narrow label is the smaller engine.',
    N'Datasheets/Palisade PE311 PE321 Print Engine Specifications.md, Media — https://www.palisade.example/content/dam/palisade_dam/en/spec-sheets/ze511-ze521-spec-sheet-en-us.pdf', N'Palisade PE311/PE321 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PE321');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lt', N'76.2');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Narrower than the PE321''s stated 3 inch media minimum. The PE311 goes to 0.625.', NULL, NULL, NULL, NULL);

-- A-PALM-S84-LBL-WIDE  Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s84nx/specifications/
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-S84-LBL-WIDE', N'PALM', N'applicationFit',
    N'The K84X engine takes media up to 131 mm wide.', N'Kestrel K84X specifications, Media width: ''13 to 131 mm (0.51" to 5.16")''. The K86X takes 54 to 180 mm, so a wide label is a different engine.',
    N'Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s84nx/specifications/', N'Kestrel K84X specifications', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'K84X');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'131');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Wider than the K84X''s stated 131 mm media maximum. The K86X reaches 180.', NULL, NULL, NULL, NULL);

-- A-PALM-S84-LBL-MIN  Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s84nx/specifications/
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-S84-LBL-MIN', N'PALM', N'applicationFit',
    N'The K84X engine needs media at least 13 mm wide.', N'Kestrel K84X specifications, Media width: ''13 to 131 mm (0.51" to 5.16")''.',
    N'Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s84nx/specifications/', N'Kestrel K84X specifications', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'K84X');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lt', N'13');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Narrower than the K84X''s stated 13 mm media minimum.', NULL, NULL, NULL, NULL);

-- A-PALM-S86-LBL-WIDE  Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s86nx/specifications/
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-S86-LBL-WIDE', N'PALM', N'applicationFit',
    N'The K86X engine takes media up to 180 mm wide.', N'Kestrel K86X specifications, Media width: ''54 to 180 mm (2.13" to 7.09")''.',
    N'Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s86nx/specifications/', N'Kestrel K86X specifications', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'K86X');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'gt', N'180');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Wider than the K86X''s stated 180 mm media maximum.', NULL, NULL, NULL, NULL);

-- A-PALM-S86-LBL-MIN  Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s86nx/specifications/
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-S86-LBL-MIN', N'PALM', N'applicationFit',
    N'The K86X engine will not take media under 54 mm.', N'Kestrel K86X specifications, Media width: ''54 to 180 mm (2.13" to 7.09")''. The K84X starts at 13 mm, so a narrow label is the smaller engine.',
    N'Datasheets/Kestrel K84X K86X Print Engine Specifications.md, Media width — https://www.kestrel.example/products/printers/print-engines/s86nx/specifications/', N'Kestrel K86X specifications', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'K86X');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'labelWidthMm', N'lt', N'54');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Narrower than the K86X''s stated 54 mm media minimum. The K84X goes to 13.', NULL, NULL, NULL, NULL);

-- A-TTO-BAR-160  Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, SPECIFICATIONS — Print area (HxW) intermittent — https://www.axim.example/products/productcoding/thermaltransfer
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-BAR-160', N'TTO', N'applicationFit',
    N'Past 160 mm only the T408 is rated.', N'Thorne T400 specifications, Print area (HxW) intermittent: ''T402+ 2.1 x 3 in (53 x 75 mm), T404+ 4.2 x 3.5 in (107 x 90 mm), T406e 6.3 x 3.9 in (160 x 100 mm), T408 8.4 x 3.9 in (213 x 100 mm), T408e 8.4 x 6.1 in (213 x 155 mm)''. The hierarchy files all of these under one Product Type of ''T400 Series'', so a rule cannot tell which is on the quote — hence a caveat naming the machine that takes the next step, rather than a refusal.',
    N'Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, SPECIFICATIONS — Print area (HxW) intermittent — https://www.axim.example/products/productcoding/thermaltransfer', N'Thorne T400 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'T400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'160');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past the 160 mm T406e print area. Only the T408 goes further, at 213 mm.', NULL, NULL, NULL, NULL);

-- A-TTO-BAR-213  Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, SPECIFICATIONS — Print area (HxW) intermittent — https://www.axim.example/products/productcoding/thermaltransfer
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-BAR-213', N'TTO', N'applicationFit',
    N'213 mm is the largest T400 print area published.', N'Thorne T400 specifications, Print area (HxW) intermittent: ''T402+ 2.1 x 3 in (53 x 75 mm), T404+ 4.2 x 3.5 in (107 x 90 mm), T406e 6.3 x 3.9 in (160 x 100 mm), T408 8.4 x 3.9 in (213 x 100 mm), T408e 8.4 x 6.1 in (213 x 155 mm)''. The hierarchy files all of these under one Product Type of ''T400 Series'', so a rule cannot tell which is on the quote — hence a caveat naming the machine that takes the next step, rather than a refusal.',
    N'Datasheets/Literature_TTO_ThorneNGT_SpecSheetWEB.md, SPECIFICATIONS — Print area (HxW) intermittent — https://www.axim.example/products/productcoding/thermaltransfer', N'Thorne T400 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'T400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markHeightMm', N'gt', N'213');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Taller than the largest print area any Thorne T400 document states, 213 mm on the T408. Refer to Application Engineering.', NULL, NULL, NULL, NULL);

-- A-CIJ-CHR-CEILING  data/vendor-docs.json, specs.6440.Character height — https://www.corvus.example/wp-content/uploads/2023/06/corvus-6440-datasheet-mp42172_05.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-CHR-CEILING', N'CIJ', N'applicationFit',
    N'20 mm is the tallest character any 6400-series sheet states.', N'Corvus 6410, 6420 and 6440 datasheets, Character height: ''1.8 to 20 mm'' (PH4 Standard) and ''2.1 to 20 mm'' (PH4 Standard Plus). Nothing in the range prints taller in one pass, on either document. Taller is a large-character or laser application.',
    N'data/vendor-docs.json, specs.6440.Character height — https://www.corvus.example/wp-content/uploads/2023/06/corvus-6440-datasheet-mp42172_05.pdf', N'Corvus 6440 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'20');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Taller than the 20 mm maximum stated on any Corvus 6400-series datasheet. This is a large character or laser application.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-SPD-7300  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-SPD-7300', N'CIJ', N'applicationFit',
    N'The 7300 prints a single line to 557 fpm.', N'Corvus 7300 Series brochure, Maximum speed, one line print (5 dot high): 2.83 m/s on both the PH4 Standard and the Standard Plus. It is the base machine of the range and the only one that does not go faster with a bigger printhead.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'557');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The 7300 prints a single line to 557 fpm. This line runs faster — the 7310 and 7320 reach 1,433.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-SPD-991X  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-SPD-991X', N'CIJ', N'applicationFit',
    N'The 7310 and 7320 print a single line to 1,433 fpm.', N'Corvus 7300 Series brochure, Maximum speed, one line print: 7.28 m/s on the PH4 Standard Plus for both models. The 7340 reaches 9.10 m/s.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7310,7320');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1433');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past the 1,433 fpm these print on their fastest printhead. The 7340 reaches 1,791, and 1,969 in tower print.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-SPD-7340  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-SPD-7340', N'CIJ', N'applicationFit',
    N'Past 1,791 fpm the 7340 needs its tower print mode.', N'Corvus 7300 Series brochure, Maximum speed: 9.10 m/s on the PH4 Standard Plus, and a super-fast tower print of 10 m/s at 5 dot high on the same printhead. Tower print is a different message shape, so it is a caveat rather than a figure a rep can simply quote.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7340,7340 Prism');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1791');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past the 1,791 fpm of ordinary single-line print. The 7340 reaches 1,969 in tower print, at 5 dot high — confirm the message suits it.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-SPD-MAX  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-SPD-MAX', N'CIJ', N'applicationFit',
    N'1,969 fpm is the fastest figure the 7300 Series states.', N'Corvus 7300 Series brochure: the highest speed anywhere on the sheet is the 7340''s tower print at 10 m/s. Beyond that the range is out.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7300,7310,7320,7340,7340 Prism');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1969');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Faster than anything in the 7300 Series, whose highest stated figure is 1,969 fpm in tower print on the 7340.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-CHR-7300  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-CHR-7300', N'CIJ', N'applicationFit',
    N'The 7300 prints characters to 10.7 mm.', N'Corvus 7300 Series brochure, Character height range: 2.1 to 10.7 mm on the PH4 Standard Plus, 1.8 to 8.8 mm on the Standard. The rest of the range reaches 20.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'10.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Taller than the 10.7 mm the 7300 prints. The 7310, 7320 and 7340 reach 20 mm.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-CHR-SPECTRUM  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-CHR-SPECTRUM', N'CIJ', N'applicationFit',
    N'The 7340 Prism prints characters to 17 mm.', N'Corvus 7300 Series brochure, Character height range: 2.1 to 17 mm on the PH4 Standard Plus and 1.8 to 16 mm on the Standard — shorter than the other 7340, which reaches 20 mm, and the trade for its hard-pigmented inks.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7340 Prism');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'17');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Taller than the 17 mm the 7340 Prism prints. The ordinary 7340 reaches 20.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-CHR-MAX  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-CHR-MAX', N'CIJ', N'applicationFit',
    N'20 mm is the tallest character the 7300 Series prints.', N'Corvus 7300 Series brochure, Character height range: 1.8 to 20 mm on the PH4 Standard and 2.1 to 20 mm on the Standard Plus. Taller is a large-character or laser application.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7310,7320,7340');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'20');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Taller than the 20 mm maximum stated anywhere in the 7300 Series. This is a large character or laser application.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-TEMP  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-TEMP', N'CIJ', N'applicationFit',
    N'The 7300 Series is rated to 45 °C / 113 °F.', N'Corvus 7300 Series brochure, Operating temperature range: 5 to 45 °C, and 0 to 50 °C for the Corvus 1240, 1010, 1014 and 3240 inks. Above that the range is outside its stated envelope whichever ink is chosen.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7300,7310,7320,7340,7340 Prism');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'113');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Above the 113 °F ceiling stated for the 7300 Series.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-IP-WASH  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-IP-WASH', N'CIJ', N'applicationFit',
    N'IP55 is not a washdown rating; the 7340s are IP65.', N'Corvus 7300 Series brochure, Environmental protection rating: IP55 on the 7300, 7310 and 7320, IP65 on the 7340 and 7340 Prism. A washdown area needs the IP65 machines.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7300,7310,7320');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'IP55, which is not a washdown rating. The 7340 and 7340 Prism are IP65.', NULL, NULL, NULL, NULL);

-- A-CIJ-99-IP-7340-OK  data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-99-IP-7340-OK', N'CIJ', N'applicationFit',
    N'The 7340 and 7340 Prism are IP65, which suits a washdown area.', N'Corvus 7300 Series brochure, Environmental protection rating: IP65. Positively endorsed rather than merely not ruled out — among 947 CIJ configurations a machine nothing is known against buries the one a datasheet actually recommends.',
    N'data/vendor-docs.json, specs.7340 — https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf', N'Corvus 7300 Series brochure', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'7340,7340 Prism');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'IP65, which is rated for washdown.', NULL, NULL, NULL, NULL);

-- A-TTO-XL-WIDTH  Datasheets/Literature_TTO_ThorneT800_SpecSheetWEB.md, Print Area (HxW) Intermittent — '53 x 80 mm (2.1 x 3.1 inches)'
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-XL-WIDTH', N'TTO', N'applicationFit',
    N'A print wider than 80 mm puts the XL Series into continuous mode.', N'The sheet gives two print areas, and they are not close: 53 x 80 mm intermittent against 53 x 300 mm continuous. Width is the whole difference — the height is 53 mm either way — so a message wider than 80 mm is not a machine problem, it is a mode decision, and it costs throughput. See A-TTO-XL-RATE-CM: continuous is published at 250 prints a minute against 450 intermittent. A rep who has quoted 400 a minute AND a 200 mm wide message has quoted something the sheet does not offer.',
    N'Datasheets/Literature_TTO_ThorneT800_SpecSheetWEB.md, Print Area (HxW) Intermittent — ''53 x 80 mm (2.1 x 3.1 inches)''', N'Thorne T800 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'XL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markingWindowMm', N'gt', N'80');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Wider than the 80 mm intermittent print area. The XL Series reaches 300 mm in continuous mode, which is published at 250 prints a minute rather than 450.', NULL, NULL, NULL, NULL);

-- A-TTO-XL-WIDTH-MAX  Datasheets/Literature_TTO_ThorneT800_SpecSheetWEB.md, Print Area (HxW) Continuous — '53 x 300 mm (2.1 x 11.8 inches)'
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-XL-WIDTH-MAX', N'TTO', N'applicationFit',
    N'300 mm is the widest print the XL Series publishes.', N'53 x 300 mm in continuous mode is the larger of the two print areas on the sheet, and there is no third. A caveat rather than a refusal for the same reason A-TTO-BAR-53 is: the hierarchy files the whole Thorne range under one product type, so this cannot tell one XL variant from another.',
    N'Datasheets/Literature_TTO_ThorneT800_SpecSheetWEB.md, Print Area (HxW) Continuous — ''53 x 300 mm (2.1 x 11.8 inches)''', N'Thorne T800 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'XL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markingWindowMm', N'gt', N'300');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Wider than the 300 mm continuous print area, which is the largest the XL Series publishes.', NULL, NULL, NULL, NULL);

-- A-TTO-XL-RATE-CM  Datasheets/Literature_TTO_ThorneT800_SpecSheetWEB.md, Performance CM at 5mm Print Height — '250 Prints Per Minute'
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-XL-RATE-CM', N'TTO', N'applicationFit',
    N'Above 250 a minute the XL Series has to run intermittently.', N'Two performance figures at 5 mm print height: 450 prints per minute intermittent, 250 continuous. A-TTO-XL-RATE already refuses above 450; this is the line below it, where the rate is still available but only in the mode that caps the print at 80 mm wide. Both figures are stated against their own label on the sheet, which is why they can be quoted.',
    N'Datasheets/Literature_TTO_ThorneT800_SpecSheetWEB.md, Performance CM at 5mm Print Height — ''250 Prints Per Minute''', N'Thorne T800 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'XL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throughputPpm', N'gt', N'250');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Above the 250 a minute continuous figure. This rate needs intermittent mode, where the print area is 80 mm wide rather than 300.', NULL, NULL, NULL, NULL);

-- A-PALM-SPACING-RATE  Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Product Rate — 'Dependent on Label Length, Print Speed and Product Spacing'
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-SPACING-RATE', N'PALM', N'applicationFit',
    N'The published apply rate depends on the product spacing.', N'The sheet states the rate and then states what it depends on, in the same row: ''Single Apply: Up to 52 PPM; Dual Apply: Up to 28 PPM'' followed by ''Dependent on Label Length, Print Speed and Product Spacing''. So 52 a minute is a ceiling under conditions, not a number to quote against a line whose spacing nobody has checked.

No minimum spacing is published anywhere, which is why this states the dependency instead of grading it. Writing a threshold here would mean inventing one. It fires only when the rep has answered the spacing question and is asking for more than the dual-apply figure — the point at which the three variables start trading against each other.',
    N'Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Product Rate — ''Dependent on Label Length, Print Speed and Product Spacing''', N'Axim PL6300 datasheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'productSpacingMm', N'gte', N'0');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throughputPpm', N'gt', N'28');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'The published apply rate is stated as dependent on label length, print speed and product spacing. Confirm the rate holds at this line''s spacing before quoting it.', NULL, NULL, NULL, NULL);

-- A-VIJ-QUALITY-GRAPHICS  https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print resolution
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-QUALITY-GRAPHICS', N'VIJ', N'applicationFit',
    N'The valve jet prints 9 dots across; a logo needs a hundred times that.', N'IV9 specifications: ''Print resolution 9 x 25 DPI''. IV18: ''8 x 25 DPI''. Nine dots across the web is a character built from a dot matrix you can count, which is what a valve jet is for — a large, cheap, robust mark on a case. It is not a printing process a logo or a retail-quality code can be asked of, and the difference from a thermal jet''s 300 x 300 is not a matter of degree.',
    N'https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print resolution', N'Axim IV series product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'IV9,IV18,IV12,IV7');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'printQuality', N'in', N'graphics,graded');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The valve jet resolves 9 dots across the web. For a graded code or a logo this is the wrong process — a thermal jet or the high-resolution inkjet is.', NULL, NULL, NULL, NULL);

-- A-VIJ-QUALITY-SCANNABLE  https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print resolution
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-QUALITY-SCANNABLE', N'VIJ', N'applicationFit',
    N'A scannable barcode off a valve jet needs proving before it is quoted.', N'IV9 specifications: ''Print resolution 9 x 25 DPI''. A linear barcode can be built from a coarse matrix and often scans; whether THIS one does depends on the symbology, the X dimension and the substrate, and none of those is a figure the datasheet settles. Stated as a caveat rather than a refusal because valve jets do print scannable codes in the field — and rather than silence, because the machine beside it in the list resolves thirty times finer for the same answer.',
    N'https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv9-dot, Specifications — Print resolution', N'Axim IV series product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'IV9,IV18,IV12,IV7');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'printQuality', N'in', N'scannable');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'9 x 25 DPI. Linear codes can scan off a valve jet, but prove it on the customer''s substrate before quoting it.', NULL, NULL, NULL, NULL);

-- A-TIJ-QUALITY-GOOD  https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Print resolution
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-QUALITY-GOOD', N'TIJ', N'applicationFit',
    N'300 x 300 DPI is what a graded code or a logo needs.', N'HP 0.5" and HP 1.0" specifications: ''Print resolution 300 x 300 DPI''. This is the answer to the question the valve jet is refused for, and saying so positively is the point — a rep who has just been told the valve jet will not do it should be able to see what will.',
    N'https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Print resolution', N'Axim thermal jet product page', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'HP 0.5",HP 1.0"');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'printQuality', N'in', N'graded,graphics');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'300 x 300 DPI, which covers a graded barcode or a logo.', NULL, NULL, NULL, NULL);

-- A-TIJ-QUALITY-SPEED  https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Print resolution
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TIJ-QUALITY-SPEED', N'TIJ', N'applicationFit',
    N'Holding 300 DPI costs the thermal jet its top speed.', N'HP 0.5" specifications: ''Print resolution 300 x 300 DPI'' and ''Print speeds w/ reduced resolution Up to 500 FPM''. The 500 figure is the REDUCED-resolution one, so a line running near it is not also getting 300 DPI. Which of the two gives way is a decision for the customer, and it can only be put to them if somebody knows the code has to be graded.',
    N'https://www.axim.example/products/productcoding/thermalinkjet/tj-500, Specifications — Print resolution', N'Axim thermal jet product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'HP 0.5",HP 1.0"');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'printQuality', N'in', N'graded,graphics');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'200');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The 500 fpm figure is at REDUCED resolution. Above 200 fpm, check the customer will accept the print this gives at speed.', NULL, NULL, NULL, NULL);

-- A-TECH-TTO-RIGID  https://www.axim.example/products/productcoding/thermaltransfer, Thorne T800 — 'web and foil printing applications'
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-TTO-RIGID', N'TTO', N'applicationFit',
    N'A thermal transfer overprinter prints onto a flexible web, not onto a rigid pack.', N'The TTO range is described for ''web and foil printing applications'', and the T400 print areas are quoted as intermittent and continuous — both describe film moving past a printhead under a ribbon. A rigid pack has nothing to feed. Code it directly with an inkjet, or apply a printed label.',
    N'https://www.axim.example/products/productcoding/thermaltransfer, Thorne T800 — ''web and foil printing applications''', N'axim.example, Thermal Transfer Overprinters (TTO)', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'glass,jar,can,metal,corrugat,carton,case,drum,pail,bottle,pipe,wood,tray');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'A TTO prints onto a flexible film or foil web. This substrate is rigid, so there is no web to print on.', NULL, NULL, NULL, NULL);

-- A-TECH-TTO-WEB  https://www.axim.example/products/productcoding/thermaltransfer, Thorne T800
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-TTO-WEB', N'TTO', N'applicationFit',
    N'Film, foil, pouches and labels are what a TTO is for.', N'''Extended uptime makes the Thorne T800 a versatile printer for web and foil printing applications.'' This is the technology''s own ground, so the rule says so rather than leaving the machine ungraded.',
    N'https://www.axim.example/products/productcoding/thermaltransfer, Thorne T800', N'axim.example, Thermal Transfer Overprinters (TTO)', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'film,web,foil,laminate,pouch,bag,sachet,wrapper,label,flow wrap,flowwrap,lidding');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'Film and foil web is what a thermal transfer overprinter is built for.', NULL, NULL, NULL, NULL);

-- A-TECH-VIJ-SUBSTRATE  https://www.axim.example/products/casecoding/largecharacterinkjet, Substrates that pair perfectly with the IV series
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-VIJ-SUBSTRATE', N'VIJ', N'applicationFit',
    N'The IV series names the substrates it pairs with, and this is one of them.', N'''Substrates that pair perfectly with the IV series include corrugate, plastic, metal, glass, drywall, wood products, pipe and carpet.'' Large-character valve jet is the low cost per mark answer on all of them.',
    N'https://www.axim.example/products/casecoding/largecharacterinkjet, Substrates that pair perfectly with the IV series', N'axim.example, Integrated Valve Ink Jet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'corrugat,plastic,metal,glass,drywall,wood,pipe,carpet,case,carton,lumber,board');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'The IV series names this substrate as one it pairs with.', NULL, NULL, NULL, NULL);

-- A-TECH-VIJ-SMALL-CHAR  https://www.axim.example/products/casecoding/largecharacterinkjet, fonts as small as 3/16"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-VIJ-SMALL-CHAR', N'VIJ', N'applicationFit',
    N'Below 3/16 inch the valve jet cannot form the character.', N'''It is perfect for coding applications that require fonts as small as 3/16" and as large as 2".'' 3/16 inch is 4.76mm, and that is the floor, not a preference — a valve puts down one dot per opening. Small character work is continuous inkjet or thermal inkjet.',
    N'https://www.axim.example/products/casecoding/largecharacterinkjet, fonts as small as 3/16"', N'axim.example, Integrated Valve Ink Jet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'lt', N'4.76');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The valve jet prints down to 3/16 inch (4.76mm). This character height is smaller than the technology can form.', NULL, NULL, NULL, NULL);

-- A-TECH-PIJ-CASE  https://www.axim.example/products/casecoding/highresolutioninkjet, Ridgeline 3200
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-PIJ-CASE', N'PIJ', N'applicationFit',
    N'High-resolution impulse jet is aimed at cases and secondary packaging.', N'''Our impulse jet technology is engineered to achieve the sharpest high-resolution prints on secondary packaging and cases with the most forgiving of throw distances'', with ''nearly 35% improved barcode scanability over other industrial inkjet printers''.',
    N'https://www.axim.example/products/casecoding/highresolutioninkjet, Ridgeline 3200', N'axim.example, High Resolution Industrial Inkjet Printing for Case Coding', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'corrugat,case,carton,tray,fibreboard,fiberboard,kraft,shipper,box');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'Cases and secondary packaging are what the impulse jet is engineered for.', NULL, NULL, NULL, NULL);

-- A-TECH-CIJ-PRIMARY  https://www.axim.example/products/productcoding/small-character, What is CIJ or continuous inkjet technology?
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-CIJ-PRIMARY', N'CIJ', N'applicationFit',
    N'Continuous inkjet marks primary packs of almost any material.', N'''Continuous inkjet printers can mark onto virtually any substrate type ranging from plastic bags, glass jars, metal cans, paper cartons and more. Small character inkjet printers are mainly used for primary packaging of consumer goods products.''',
    N'https://www.axim.example/products/productcoding/small-character, What is CIJ or continuous inkjet technology?', N'axim.example, Small Character Continuous Inkjet Printers', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'bottle,jar,can,pouch,bag,film,tube,cap,sachet,extrud,wire,cable,foil,blister,ampoule,vial');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'A primary pack of this kind is ordinary continuous inkjet work.', NULL, NULL, NULL, NULL);

-- A-TECH-CIJ-SECONDARY  https://www.axim.example/products/productcoding/small-character, mainly used for primary packaging
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-CIJ-SECONDARY', N'CIJ', N'applicationFit',
    N'A case is secondary packaging, which is not where small character CIJ is usually put.', N'''Small character inkjet printers are mainly used for primary packaging of consumer goods products.'' A CIJ will mark a case, but it prints to 11.94mm at the largest and costs more per mark than a valve jet. The usual answers for a case are the IV series or the Ridgeline 3200.',
    N'https://www.axim.example/products/productcoding/small-character, mainly used for primary packaging', N'axim.example, Small Character Continuous Inkjet Printers', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'corrugat,case,shipper,fibreboard,fiberboard');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'This is a case. Small character CIJ is aimed at primary packs — a valve jet or the Ridgeline 3200 is the usual case coder.', NULL, NULL, NULL, NULL);

-- A-TECH-PALM-GRADED-BARCODE  https://www.axim.example/aboutaxim/casecodingcompliance/benefitsofdualtechnology, Axim's Dual Technology Solution
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-PALM-GRADED-BARCODE', N'PALM', N'applicationFit',
    N'A guaranteed barcode grade is a labelling claim.', N'''The first half of the Axim solution consists of a labeling system, such as the PA/5000LT, that provides machine-readable, guaranteed "A" grade bar codes, every time'' — and ''Guaranteed "A" grade verifiable bar codes (when using Axim label and ribbon materials)''. Where the customer has specified a grade, print and apply is the technology that carries the guarantee.',
    N'https://www.axim.example/aboutaxim/casecodingcompliance/benefitsofdualtechnology, Axim''s Dual Technology Solution', N'axim.example, Case Code Compliance', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'barcodeRequirements', N'includesAny', N'grade a,a grade,grade b,b grade,grade c,c grade,verifi,gs1-128,gs1 128,scc-14,itf-14,sscc');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'Print and apply carries the barcode grade guarantee, with Axim label and ribbon materials.', NULL, NULL, NULL, NULL);

-- A-TECH-VIJ-GRADED-BARCODE  https://www.axim.example/aboutaxim/casecodingcompliance/benefitsofdualtechnology, IJ/3000 Integrated Valve
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TECH-VIJ-GRADED-BARCODE', N'VIJ', N'applicationFit',
    N'The valve jet is medium resolution, so it does not answer a specified barcode grade.', N'The compliance page splits the two halves of the job: the labeller gives ''guaranteed "A" grade bar codes'', while the Integrated Valve is for ''medium resolution printing on-demand of human readable codes direct to carton''. Human readable is the claim — a graded barcode is not.',
    N'https://www.axim.example/aboutaxim/casecodingcompliance/benefitsofdualtechnology, IJ/3000 Integrated Valve', N'axim.example, Case Code Compliance', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'barcodeRequirements', N'includesAny', N'grade a,a grade,grade b,b grade,grade c,c grade,verifi');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Valve jet is medium resolution and human readable. A specified barcode grade wants a label or high-resolution inkjet.', NULL, NULL, NULL, NULL);

-- A-PALM-PPM-MAX  Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Product Rate — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PPM-MAX', N'PALM', N'applicationFit',
    N'Above 120 products a minute the PL6300 cannot keep up, whichever module is fitted.', N'Product Rate: ''E-Tamp Up to 120 PPM'', and every other module on the sheet is slower — E-Tamp/Blow up to 55 PPM, E-FASA single apply up to 52 PPM and dual up to 28 PPM. 120 is therefore the ceiling for the machine, not for one option on it.',
    N'Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Product Rate — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'PL6300/LS7100');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throughputPpm', N'gt', N'120');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The fastest PL6300 module applies 120 labels a minute. This line runs more products than that.', NULL, NULL, NULL, NULL);

-- A-PALM-PPM-MODULE  Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Product Rate — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-PPM-MODULE', N'PALM', N'applicationFit',
    N'Above 55 products a minute the choice of apply module stops being free.', N'Product Rate: E-Tamp up to 120 PPM, E-Tamp/Blow up to 55 PPM, E-FASA single apply up to 52 PPM, dual apply up to 28 PPM, E-WASA dependent on label length. Past 55 the E-Tamp is the only module that keeps up, so the module is decided by the line rather than by preference.',
    N'Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Product Rate — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'PL6300/LS7100');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throughputPpm', N'gt', N'55');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Past 55 a minute only the E-Tamp keeps up — the blow, swing-arm and wipe modules are all slower.', NULL, NULL, NULL, NULL);

-- A-PALM-TEMP-HOT  Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Temperature — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-TEMP-HOT', N'PALM', N'applicationFit',
    N'Print and apply is rated to 104F, and to 85 percent humidity without condensation.', N'Temperature: ''41F - 104F (5C to 40C)''. Humidity: ''10 to 85% Relative Humidity, Non-Condensing''. The LB5200 sheet gives the same range. Nothing in the PALM rules read the ambient temperature before this, so a labeller beside an oven was graded on speed alone.',
    N'Datasheets/Axim PL6300 All-Electric Print and Apply Labeler Datasheet 4P.md, Temperature — https://www.axim.example/Portals/0/adam/Content/kz0RfVyTLUGlFiswfxHTlw/DownloadUrl/Axim%20PL6300%20Technical%20Datasheet.pdf', N'Axim PL6300 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMaxF', N'gt', N'104');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated to 104F. Confirm the ambient at the labeller, not in the room.', NULL, NULL, NULL, NULL);

-- A-PALM-TEMP-COLD  Datasheets/Axim LB5200 All-Electric Label Applicator Datasheet.md, Temperature — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-TEMP-COLD', N'PALM', N'applicationFit',
    N'Below 41F a print and apply labeller is outside its rated range.', N'Temperature: ''41F - 104F (5C to 40C)''. A label adhesive has its own cold limit on top of this, which is a question for the label rather than the machine — but the machine''s own floor is 41F.',
    N'Datasheets/Axim LB5200 All-Electric Label Applicator Datasheet.md, Temperature — https://www.axim.example/Portals/0/Downloads/Axim-LB5200-All-Electric-Label-Applicator-Datasheet.pdf', N'Axim LB5200 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'41');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Below 41F is outside the rated range, and the label adhesive will need checking separately.', NULL, NULL, NULL, NULL);

-- A-VIJ-TEMP-COLD  Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Operating Temperature — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-VIJ-TEMP-COLD', N'VIJ', N'applicationFit',
    N'Below 40F the valve jet is outside its rated range.', N'Operating temperature: ''40F to 104F (5C to 40C)''. The valve jet rules read the maximum already; nothing read the floor, so a coder going into a chilled room was graded as though the cold did not matter.',
    N'Datasheets/Axim VJ2600 Integrated Valve Jet Datasheet.md, Operating Temperature — https://www.axim.example/products/casecodinglabeling/largecharacterinkjetprinter/iv18-dot', N'Axim VJ2600 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'40');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated from 40F. Confirm the ink is specified for the cold as well as the machine.', NULL, NULL, NULL, NULL);

-- A-PIJ-COLD-OPTION  Datasheets/Axim HR2600 High Resolution Inkjet Datasheet.md, Operating Temperature — https://www.axim.example/products/casecoding/highresolutioninkjet
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PIJ-COLD-OPTION', N'PIJ', N'applicationFit',
    N'Below 50F the impulse jet needs its 32F option specified.', N'Operating temperature: ''50F to 104F (10C to 40C), 32F Option (0C)''. This is the useful shape of a cold limit — not a refusal but an option to order, and one a rep will only know to ask for if the quote says so.',
    N'Datasheets/Axim HR2600 High Resolution Inkjet Datasheet.md, Operating Temperature — https://www.axim.example/products/casecoding/highresolutioninkjet', N'Axim HR2600 datasheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'50');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Standard range starts at 50F. There is a 32F option — specify it rather than quoting the standard build.', NULL, NULL, NULL, NULL);

-- A-LSR-IP-CSL10  Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Laser Head Protection Class — https://www.axim.example/products/productcoding/laser
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-IP-CSL10', N'LSR', N'applicationFit',
    N'The CSL10 is IP54 only. There is no washdown option for it.', N'Laser Head Protection Class is given per model: ''IP54'' for the CSL10 and ''IP54 or IP65 (Optional)'' for the CSL30. The CSL10 is the one model in the scribing range with no IP65 configuration to quote, so a washdown area is not a matter of adding an option to it.',
    N'Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Laser Head Protection Class — https://www.axim.example/products/productcoding/laser', N'Corvus CSL10 & CSL30 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL10');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The CSL10 has no IP65 version. For a washdown area quote the CSL30 or CSL60 with the IP65 option and its blower unit.', NULL, NULL, NULL, NULL);

-- A-LSR-IP-FSL  Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, Laser Head Protection Class — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-IP-FSL', N'LSR', N'applicationFit',
    N'The fibre lasers are IP54. Neither has a washdown option.', N'Laser Head Protection Class: ''IP54'', with no optional rating given for either the FSL20 or the FSL50 — unlike the scribing sheets, which name the IP65 option where it exists.',
    N'Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, Laser Head Protection Class — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers', N'Corvus FSL20 & FSL50 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'FSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The fibre lasers are IP54 only. A washdown area needs a CSL30 or CSL60 in its IP65 configuration.', NULL, NULL, NULL, NULL);

-- A-LSR-TEMP-FSL-MIN  Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, Operating Temperature Range — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-TEMP-FSL-MIN', N'LSR', N'applicationFit',
    N'The fibre lasers stop nine degrees short of the scribing ones: 50°F, not 41°F.', N'Operating Temperature Range: ''50-104°F Ambient'' on the fibre sheet, against ''41-104°F Ambient'' on both scribing sheets. A chilled room that a CSL will start in is below the fibre laser''s floor.',
    N'Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, Operating Temperature Range — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers', N'Corvus FSL20 & FSL50 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'FSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'50');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Below 50°F the fibre lasers are outside their stated range. The scribing lasers are rated to 41°F.', NULL, NULL, NULL, NULL);

-- A-LSR-TEMP-CSL-MIN  Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Operating Temperature Range — https://www.axim.example/products/productcoding/laser
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-TEMP-CSL-MIN', N'LSR', N'applicationFit',
    N'41°F is the floor for the scribing lasers.', N'Operating Temperature Range: ''41-104°F Ambient'', the same figure on the CSL10/30 sheet and the CSL60 sheet. A cold store below that is outside what either is rated for.',
    N'Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Operating Temperature Range — https://www.axim.example/products/productcoding/laser', N'Corvus CSL10 & CSL30 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'ambientTempMinF', N'lt', N'41');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The scribing lasers are rated from 41°F ambient. This area is colder than that.', NULL, NULL, NULL, NULL);

-- A-LSR-SPD-CSL  Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Line Speed — https://www.axim.example/products/productcoding/laser
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-SPD-CSL', N'LSR', N'applicationFit',
    N'2,952 ft/min is the published ceiling for every scribing laser, not just the CSL60.', N'Line Speed: ''Up to 2,952 ft/min (Code and Substrate Dependent)'' — the same figure on the CSL10/30 sheet as on the CSL60. Power decides what can be marked at that speed, not whether the speed can be reached.',
    N'Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Line Speed — https://www.axim.example/products/productcoding/laser', N'Corvus CSL10 & CSL30 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'2952');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Past 2,952 ft/min there is no published laser figure to quote against.', NULL, NULL, NULL, NULL);

-- A-LSR-PWR-HARD  Datasheets/Literature_Laser_Corvus LC70_SpecSheetWEB.md, Key Features — https://www.axim.example/products/productcoding/laser
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-PWR-HARD', N'LSR', N'applicationFit',
    N'Glass and PET at speed are what the 60W tube is for.', N'''The high power 60W laser tube is ideal for coding onto hard to mark materials, like glass PET bottles, and high-speed lines'' — coding up to 70,000 bottles per hour, application dependent.',
    N'Datasheets/Literature_Laser_Corvus LC70_SpecSheetWEB.md, Key Features — https://www.axim.example/products/productcoding/laser', N'Corvus CSL60 spec sheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL60');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'glass,pet,bottle');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'The 60W tube is the one specified for glass and PET.', NULL, NULL, NULL, NULL);

-- A-LSR-SUB-FSL  Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, product description — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-SUB-FSL', N'LSR', N'applicationFit',
    N'The fibre lasers are for metal, plastics and foils.', N'''precision marking for complete traceability onto a wide range of materials including metal, plastics and packaging foils''. The scribing sheets name paper, card, glass and rubber; the fibre sheet does not.',
    N'Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, product description — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers', N'Corvus FSL20 & FSL50 spec sheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'FSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'metal,aluminium,aluminum,steel,foil');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'Metal and foil are what the fibre lasers are specified for.', NULL, NULL, NULL, NULL);

-- A-LSR-SUB-FSL-PAPER  Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, product description — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-SUB-FSL-PAPER', N'LSR', N'applicationFit',
    N'Paper and board are not on the fibre laser''s list of materials.', N'The fibre sheet names ''metal, plastics and packaging foils''. Coated paper and card appear on the scribing sheets instead — the CSL30 carries a 10.2μm ''Card'' wavelength option for exactly this.',
    N'Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, product description — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers', N'Corvus FSL20 & FSL50 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'FSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'corrugated,carton,card,board,paper,kraft');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'For paper or board quote a scribing laser — the CSL30 has a 10.2μm card option.', NULL, NULL, NULL, NULL);

-- A-LSR-SUB-CSL-PET  Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Laser Wave Length — https://www.axim.example/products/productcoding/laser
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-SUB-CSL-PET', N'LSR', N'applicationFit',
    N'PET has its own wavelength on the scribing lasers: 9.3μm.', N'Laser Wave Length: CSL10 ''10.6μm (Standard) or 9.3μm (PET)''; CSL30 ''10.6μm (Standard) 10.2μm (Card) 9.3μm (PET)''. The wavelength is chosen with the machine, so it belongs on the quote rather than after it.',
    N'Datasheets/Literature_Laser_Corvus LC20&30_SpecSheetWEB.md, Laser Wave Length — https://www.axim.example/products/productcoding/laser', N'Corvus CSL10 & CSL30 spec sheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'pet,polyester');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Quote the 9.3μm tube for PET. 10.6μm is the standard wavelength and is not the one specified for it.', NULL, NULL, NULL, NULL);

-- A-LSR-CONDUIT-FSL  Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, Conduit Length — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-CONDUIT-FSL', N'LSR', N'applicationFit',
    N'The fibre laser''s conduit is 2.7 m and does not come longer.', N'Conduit Length: ''8.8 ft (2.7m)'', a single figure. The scribing lasers offer ''9.8 ft (3 m) — Standard, 16.4 ft (5 m) — Optional, 32.8 ft (10 m) — Optional'', so a supply unit that has to sit away from the line is a scribing-laser question.',
    N'Datasheets/Literature_Laser_Corvus LF30&50_SpecSheetWEB.md, Conduit Length — https://www.axim.example/products/productcoding/lasercoders/corvusfsl20andfsl50fiberlasers', N'Corvus FSL20 & FSL50 spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'FSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throwDistMm', N'gt', N'2700');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The fibre laser''s conduit is 2.7 m. The scribing lasers go to 10 m.', NULL, NULL, NULL, NULL);

-- A-LSR-CHAR-MAX  Datasheets/Literature_Laser_Corvus LC70_SpecSheetWEB.md, Code Height — https://www.axim.example/products/productcoding/laser
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-LSR-CHAR-MAX', N'LSR', N'applicationFit',
    N'A laser''s character height is limited by the marking field, up to 601 mm.', N'Code Height: ''Up to Marking Field Size — Max Height of 601 mm'' on the CSL60. The CSL10/30 sheet gives the field itself: ''up to 15.7in x 23.6in (400mm x 600mm), the largest marking area in the industry''. Character height is therefore a lens and field question, not a machine limit.',
    N'Datasheets/Literature_Laser_Corvus LC70_SpecSheetWEB.md, Code Height — https://www.axim.example/products/productcoding/laser', N'Corvus CSL60 spec sheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'CSL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'601');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'601 mm is the tallest code height the CSL60 sheet states.', NULL, NULL, NULL, NULL);

-- A-CIJ-SPD-5400  https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Max speed; single line print
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-SPD-5400', N'CIJ', N'applicationFit',
    N'Above 1,230 fpm the 5400 is past its single-line maximum.', N'Max speed; single line print: ''1,230 fpm''. The 6400 range publishes different figures again — 574 for the 6400, 1,433 for the 6410 and 6420, 1,791 for the 6440 — so a line above 1,230 is an 6400-family question rather than a 5400 one.',
    N'https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Max speed; single line print', N'Corvus 5400 product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'5400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'1230');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The 5400 prints a single line to 1,230 fpm. Above that the 6410 and up are the published answer.', NULL, NULL, NULL, NULL);

-- A-CIJ-CHR-5400-MAX  https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Character Height Range
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-CHR-5400-MAX', N'CIJ', N'applicationFit',
    N'The 5400 tops out at 13.7 mm characters, taller than any 6400.', N'Character Height Range: ''0.04" to 0.54"'' — 1.0 mm to 13.7 mm. That is the tallest character in the CIJ range here; the 6420 and 6440 stop at 0.47" (11.9 mm) and the 6400 and 6410 at 0.34" (8.6 mm).',
    N'https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Character Height Range', N'Corvus 5400 product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'5400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'13.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'13.7 mm is the tallest character the 5400 prints, and the tallest in this CIJ range.', NULL, NULL, NULL, NULL);

-- A-CIJ-CHR-5400-MIN  https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Character Height Range
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-CHR-5400-MIN', N'CIJ', N'applicationFit',
    N'The 5400 prints smaller than the 6400 range: down to 1.0 mm.', N'Character Height Range: ''0.04" to 0.54"''. The 6400 range starts at 0.07" (1.8 mm), so a code specified below that is a 5400 question.',
    N'https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Character Height Range', N'Corvus 5400 product page', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'5400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'lt', N'1.8');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'The 5400 prints down to 1.0 mm, below the 6400 range''s 1.8 mm floor.', NULL, NULL, NULL, NULL);

-- A-CIJ-IP-5400  https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Ingress Protection rating
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-IP-5400', N'CIJ', N'applicationFit',
    N'A 5400 is IP55 unless the IP65 version is quoted. The Prism is IP65 already.', N'Ingress Protection rating: ''IP55, optional IP65. Prism IP65 as standard''. IP55 is dust and low-pressure jets, which is not a washdown rating — the same distinction the 6400 range makes between the 6440 and the rest.',
    N'https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Ingress Protection rating', N'Corvus 5400 product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'eq', N'5400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Quote the 5400 IP65 version, or the Prism, which is IP65 as standard.', NULL, NULL, NULL, NULL);

-- A-CIJ-IP-5400-OK  https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Ingress Protection rating
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-IP-5400-OK', N'CIJ', N'applicationFit',
    N'The Prism and the 5400 IP65 are the washdown machines in the 5400 range.', N'Ingress Protection rating: ''IP55, optional IP65. Prism IP65 as standard''.',
    N'https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Ingress Protection rating', N'Corvus 5400 product page', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'5400 IP65,5400 Prism');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'washdown');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'IP65, which is the washdown rating.', NULL, NULL, NULL, NULL);

-- A-CIJ-HUMID-5400  https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Humidity Range
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-HUMID-5400', N'CIJ', N'applicationFit',
    N'The 5400''s humidity rating stops at condensation.', N'Humidity Range (r.h., non-condensing): ''90% max''. Ninety percent is generous, and the words that matter are ''non-condensing'': a pack coming out of a chiller into a warm room carries condensation whatever the room reads.',
    N'https://www.axim.example/products/productcoding/smallcharacter/corvus5400, Humidity Range', N'Corvus 5400 product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'5400');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'environment', N'includes', N'condensation or humidity');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'Rated to 90% humidity but not to condensation. Check whether the pack is condensing at the print position.', NULL, NULL, NULL, NULL);

-- A-PALM-LABEL-MIN  https://www.axim.example/products/palletlabeling/printapplylabeling/pa7100, Label Width
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LABEL-MIN', N'PALM', N'applicationFit',
    N'A print-and-apply label is at least half an inch wide, so the pack needs the room.', N'Label Width: ''0.5" min. to 6.5" max.'' on the PL6300 and ''0.5" (12.7 mm) Min. to 6" (152.4 mm) Max.'' on the LB5200. A clear area narrower than 12.7 mm cannot take the smallest label either machine runs, whatever else is true of the application.',
    N'https://www.axim.example/products/palletlabeling/printapplylabeling/pa7100, Label Width', N'Axim PL6300 product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markingWindowMm', N'lt', N'12.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The smallest label these machines apply is 12.7 mm wide. This pack has less clear area than that — it is a direct-coding job rather than a labelling one.', NULL, NULL, NULL, NULL);

-- A-PALM-LABEL-MAX  https://www.axim.example/products/productcoding/labelapplicator/la7000, Label Length
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-PALM-LABEL-MAX', N'PALM', N'applicationFit',
    N'The LB5200 takes a longer label than the PL6300: 22 inches against 14.', N'Label Length: ''1" (25.4 mm) Min. to 22" (558.8 mm) Max.'' on the LB5200, against ''0.5" min. to 14" max.'' on the PL6300. A wrap-around or full-face label past 14 inches is an LB5200 question.',
    N'https://www.axim.example/products/productcoding/labelapplicator/la7000, Label Length', N'Axim LB5200 product page', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PL6300');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'markingWindowMm', N'gt', N'355.6');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'The PL6300 runs labels to 14 inches. The LB5200 goes to 22.', NULL, NULL, NULL, NULL);

-- A-TTO-XL-AREA  https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/thornexl5000, Print Area
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-XL-AREA', N'TTO', N'applicationFit',
    N'The XL Series prints 53 mm tall, the same as an T402+.', N'Print Area (HxW) Intermittent: ''53 x 80 mm''; Continuous: ''53 x 300 mm''. The height is 53 mm in both modes — what continuous buys is length along the web, not a taller code.',
    N'https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/thornexl5000, Print Area', N'Thorne T800 product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'XL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'53');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'53 mm is the XL Series print height in both intermittent and continuous modes.', NULL, NULL, NULL, NULL);

-- A-TTO-XL-RATE  https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/thornexl5000, Performance
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-XL-RATE', N'TTO', N'applicationFit',
    N'450 packs a minute is the XL Series ceiling, and only intermittently.', N'Performance IM at 5mm Print Height: ''450 prints per minute''; Performance CM at 5mm Print Height: ''250 prints per minute''. Both figures are quoted at a 5 mm code — a taller code takes longer to lay down, so these are ceilings rather than working rates.',
    N'https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/thornexl5000, Performance', N'Thorne T800 product page', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'XL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'throughputPpm', N'gt', N'450');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The XL Series is published at 450 prints a minute intermittent, 250 continuous, both at a 5 mm code.', NULL, NULL, NULL, NULL);

-- A-TTO-XL-AIR  https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/thornexl5000, Air Pressure
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-TTO-XL-AIR', N'TTO', N'applicationFit',
    N'The XL Series needs 5 bar of clean air.', N'Air Pressure: ''5 bar''. A line with no compressed air at the print position needs it running before a thermal transfer overprinter can be installed, which is a site question rather than a machine one.',
    N'https://www.axim.example/products/productcoding/thermaltransfer-overprinting-axim/thornexl5000, Air Pressure', N'Thorne T800 product page', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'XL');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'conveyor', N'eq', N'new');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'caveat', NULL, NULL, N'5 bar of clean compressed air is needed at the print position. Confirm it is available on a new line.', NULL, NULL, NULL, NULL);

-- A-CIJ-PLUS-SPD-6400  Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Max Speed Single Line — https://www.axim.example/products/productcoding/smallcharacter/6400ps
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-PLUS-SPD-6400', N'CIJ', N'applicationFit',
    N'The 6400 Plus stops at 557 fpm, slightly under the standard 6400.', N'Max Speed Single Line: ''557 fpm'' for the 6400 Plus, against 574 fpm for the standard 6400. A line between the two figures is inside the standard machine and past the Plus.',
    N'Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Max Speed Single Line — https://www.axim.example/products/productcoding/smallcharacter/6400ps', N'Corvus 6400 Plus Series spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'eq', N'6400PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'lineSpeedFpm', N'gt', N'557');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'557 fpm is the 6400 Plus single-line maximum.', NULL, NULL, NULL, NULL);

-- A-CIJ-PLUS-CHR-6400  Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Character Height Range — https://www.axim.example/products/productcoding/smallcharacter/6400ps
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-PLUS-CHR-6400', N'CIJ', N'applicationFit',
    N'The 6400 Plus prints to 10.7 mm; the rest of the Plus range goes further.', N'CORRECTS a rule that applied this ceiling to the 6410 Plus as well. Corvus 6400 Plus Series specification sheet, Character height: the 6400 Plus is 0.083" to 0.421" (2.1 to 10.7 mm) and the 6410, 6420 and 6440 Plus are 0.083" to 0.531" (2.1 to 13.5 mm). Only the 6400 Plus stops at 10.7. Character Height Range: ''0.083” – 0.421”'' — 2.1 mm to 10.7 mm — against 0.07” to 0.34” (1.8 to 8.6 mm) on the standard 6400 and 6410. The Plus prints taller and does not print as small.',
    N'Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Character Height Range — https://www.axim.example/products/productcoding/smallcharacter/6400ps', N'Corvus 6400 Plus Series spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6400PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'10.7');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'Taller than the 6400 Plus''s 10.7 mm. The 6410, 6420 and 6440 Plus reach 13.5 mm.', NULL, NULL, NULL, NULL);

-- A-CIJ-PLUS-CHR-MAX  Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Character Height Range — https://www.axim.example/products/productcoding/smallcharacter/6400ps
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-PLUS-CHR-MAX', N'CIJ', N'applicationFit',
    N'13.5 mm is the tallest character in the Plus series.', N'Now covers the 6410 Plus, which states the same 0.083" to 0.531" as the 6420 and 6440 and was previously grouped with the 6400. Character Height Range: ''0.083” – 0.531”'' for the 6420 and 6440 Plus — 2.1 mm to 13.5 mm, against 0.47” (11.9 mm) on the standard pair.',
    N'Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Character Height Range — https://www.axim.example/products/productcoding/smallcharacter/6400ps', N'Corvus 6400 Plus Series spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6410PLUS,6420PLUS,6440PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'gt', N'13.5');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'13.5 mm is the tallest character anywhere in the Plus series.', NULL, NULL, NULL, NULL);

-- A-CIJ-PLUS-CHR-MIN  Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Character Height Range — https://www.axim.example/products/productcoding/smallcharacter/6400ps
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-PLUS-CHR-MIN', N'CIJ', N'applicationFit',
    N'The Plus series does not print as small as the standard one: 2.1 mm, not 1.8.', N'Character Height Range starts at ''0.083”'' (2.1 mm) on every Plus model, against 0.07” (1.8 mm) on the standard series and 0.04” (1.0 mm) on the 5400. A small code is not what this series is for.',
    N'Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Character Height Range — https://www.axim.example/products/productcoding/smallcharacter/6400ps', N'Corvus 6400 Plus Series spec sheet', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'includes', N'PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'charHeightMm', N'lt', N'2.1');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'notRecommended', NULL, NULL, N'The Plus series starts at 2.1 mm. For a smaller code quote the standard 6400 series, or the 5400 below 1.8 mm.', NULL, NULL, NULL, NULL);

-- A-CIJ-PLUS-CARTON  Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Carton Coding Height — https://www.axim.example/products/productcoding/smallcharacter/6400ps
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'A-CIJ-PLUS-CARTON', N'CIJ', N'applicationFit',
    N'Carton coding to 20.1 mm is what the 6420 and 6440 Plus add.', N'Carton Coding Height: ''0.791”'' — 20.1 mm — for the 6420 and 6440 Plus, against ''N/A'' for the 6400 and 6410 Plus. The standard series sheet carries no such row at all, so a large carton code is the reason to reach for this series.',
    N'Datasheets/Literature_CIJ_Corvus6400PlusSeries_SpecSheetWEB.md, Carton Coding Height — https://www.axim.example/products/productcoding/smallcharacter/6400ps', N'Corvus 6400 Plus Series spec sheet', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'model', NULL, NULL, NULL, NULL, NULL, NULL, N'in', N'6420PLUS,6440PLUS');
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'substrate', N'includesAny', N'carton,case,corrugated');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'grade', NULL, NULL, NULL, N'good', NULL, NULL, N'Carton coding to 20.1 mm, which the standard series does not publish.', NULL, NULL, NULL, NULL);

-- Q-BARE-MOUNT  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-MOUNT', NULL, N'note',
    N'A printer is quoted with no accessory to hold or trigger it.', N'Nothing on the quote has the accessory role — no stand, pole, bracket or conveyor mount. A coder has to be held somewhere, and the mount is the part most often forgotten because it is the one the customer never asks about. Scoped to the role because that is the only shape a trigger has: any accessory answers it, so a UPS on the quote reads as a mount. Splitting ''mounting'' from ''accessory'' needs a classification finer than the one the catalogue carries, and inventing that split here would make the rule precise and wrong.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'accessory', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No stand, bracket, mount or sensor on this quote. Check how the head is held and how it is triggered.', NULL, NULL, NULL, NULL);

-- Q-BARE-INSTALL  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-INSTALL', NULL, N'note',
    N'A printer is quoted with no installation.', N'Nothing on the quote has the service role. Not every sale is installed by Axim, so this is a question rather than a warning — but an uninstalled coder that a customer expected fitted is a bad first week.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'service', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No installation on this quote. Confirm the customer is fitting it themselves.', NULL, NULL, NULL, NULL);

-- Q-ONE-POLE  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-ONE-POLE', N'CIJ', N'duplicate',
    N'The stand poles are lengths of one pole, not a set.', N'12", 23", 36", 60", 72", 1.0 m and 0.5 m of the same printhead stand pole. One line needs one length. Two is a two-head installation, which is why this asks rather than blocks.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'always', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'797711', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'380413', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'774936', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'559427', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'091570', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'RG28566', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'EH98306', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Q-ONE-BRACKET  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-ONE-BRACKET', N'CIJ', N'duplicate',
    N'A printhead is mounted one way, not five.', N'T-base, cabinet mount, conveyor mount, pole mount and cart. Each is a way of mounting one head; more than one on a quote is usually every option added while deciding.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'always', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'YD40176', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'ZF24718', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'HB41301', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'LY03715', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'CR23741', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Q-ONE-ALARM  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-ONE-ALARM', N'CIJ', N'duplicate',
    N'One alarm beacon per line.', N'Single or multistage, audible or silent. These are the same alarm specified four ways.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'always', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'0108032QBE7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'9016210GKV2NAP', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'8661724HQT5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'pickOne', N'2052759BRV7ZAG', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Q-MANY-SERVICE  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-MANY-SERVICE', NULL, N'duplicate',
    N'Three or more separate service items on one quote.', N'One line is installed once. Three or more distinct service lines is usually the service list added wholesale while deciding, not three visits that were each costed. Counts distinct items, not quantity — two days of the same install is a two-day install.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'service', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Three or more separate service items. Confirm each one is actually being sold.', NULL, NULL, NULL, NULL);

-- Q-MANY-SPARE  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-MANY-SPARE', NULL, N'duplicate',
    N'Four or more spares on one quote.', N'Spares are chosen against a maintenance interval and a risk, not added as a set. Four or more distinct spare parts on a new machine usually means the whole maintenance-kit list went on.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'spare', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Four or more spare parts. Check these against what the customer actually stocks.', NULL, NULL, NULL, NULL);

-- Q-MANY-ACCESSORY  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-MANY-ACCESSORY', NULL, N'duplicate',
    N'Six or more accessories on one quote.', N'A coder needs a mount, a sensor, maybe a stand and an alarm. Six or more distinct accessories is worth a second look — usually several are alternatives to each other rather than additions.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'accessory', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Six or more accessories. Several may be alternatives rather than additions.', NULL, NULL, NULL, NULL);

-- Q-MANY-CONSUMABLE  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-MANY-CONSUMABLE', NULL, N'duplicate',
    N'Five or more different consumables on one quote.', N'One machine prints with one ink and one solvent. Five or more distinct consumables means either several colours the line does not run, or the consumables page added in bulk.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'consumable', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Five or more different consumables. One machine normally runs one ink and one solvent.', NULL, NULL, NULL, NULL);

-- Q-BARE-CONSUMABLE-CIJ  data/quote-completeness.md, A CIJ needs ink and solvent, and they are different roles
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-CONSUMABLE-CIJ', N'CIJ', N'note',
    N'A CIJ printer is quoted with no solvent or cleaning fluid.', N'CORRECTS a rule that said ''nothing to print with'' while triggering on the role `consumable`. Ink carries the role `ink`, so the message was about the one thing this rule cannot see: a quote WITH ink was warned about ink, and a quote with solvent and no ink said nothing. A continuous inkjet consumes both — the supplied 7300 starter package lists startup ink, startup solvent and cleaning fluid as three separate lines. This one is the solvent side. Nothing on the quote has the consumable role — no ink, ribbon, solvent or cleaning fluid. The machine will not mark anything on the day it arrives. Scoped to CIJ, which marks with ink and make-up. This rule applied to every price book, laser included — and a laser marks with light, so a laser quote was told off for having nothing to print with, for ever, with nothing that could be added to satisfy it.',
    N'data/quote-completeness.md, A CIJ needs ink and solvent, and they are different roles', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'consumable', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No solvent or cleaning fluid on the quote. A continuous inkjet consumes solvent as well as ink, and a starter package carries both.', NULL, NULL, NULL, NULL);

-- Q-BARE-CONSUMABLE-TIJ  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-CONSUMABLE-TIJ', N'TIJ', N'note',
    N'A printer is quoted with nothing to print with.', N'Nothing on the quote has the consumable role — no ink, ribbon, solvent or cleaning fluid. The machine will not mark anything on the day it arrives. Scoped to TIJ, which marks with cartridges. This rule applied to every price book, laser included — and a laser marks with light, so a laser quote was told off for having nothing to print with, for ever, with nothing that could be added to satisfy it.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'consumable', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No ink, ribbon or fluid on this quote. The machine cannot print on arrival.', NULL, NULL, NULL, NULL);

-- Q-BARE-CONSUMABLE-VIJ  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-CONSUMABLE-VIJ', N'VIJ', N'note',
    N'A printer is quoted with nothing to print with.', N'Nothing on the quote has the consumable role — no ink, ribbon, solvent or cleaning fluid. The machine will not mark anything on the day it arrives. Scoped to VIJ, which marks with ink. This rule applied to every price book, laser included — and a laser marks with light, so a laser quote was told off for having nothing to print with, for ever, with nothing that could be added to satisfy it.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'consumable', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No ink, ribbon or fluid on this quote. The machine cannot print on arrival.', NULL, NULL, NULL, NULL);

-- Q-BARE-CONSUMABLE-PIJ  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-CONSUMABLE-PIJ', N'PIJ', N'note',
    N'A printer is quoted with nothing to print with.', N'Nothing on the quote has the consumable role — no ink, ribbon, solvent or cleaning fluid. The machine will not mark anything on the day it arrives. Scoped to PIJ, which marks with ink. This rule applied to every price book, laser included — and a laser marks with light, so a laser quote was told off for having nothing to print with, for ever, with nothing that could be added to satisfy it.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'consumable', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No ink, ribbon or fluid on this quote. The machine cannot print on arrival.', NULL, NULL, NULL, NULL);

-- Q-BARE-CONSUMABLE-TTO  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-CONSUMABLE-TTO', N'TTO', N'note',
    N'A printer is quoted with nothing to print with.', N'Nothing on the quote has the consumable role — no ink, ribbon, solvent or cleaning fluid. The machine will not mark anything on the day it arrives. Scoped to TTO, which marks with ribbon. This rule applied to every price book, laser included — and a laser marks with light, so a laser quote was told off for having nothing to print with, for ever, with nothing that could be added to satisfy it.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'consumable', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No ink, ribbon or fluid on this quote. The machine cannot print on arrival.', NULL, NULL, NULL, NULL);

-- Q-BARE-CONSUMABLE-PALM  data/quote-completeness.md
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-CONSUMABLE-PALM', N'PALM', N'note',
    N'A printer is quoted with nothing to print with.', N'Nothing on the quote has the consumable role — no ink, ribbon, solvent or cleaning fluid. The machine will not mark anything on the day it arrives. Scoped to PALM, which marks with labels and ribbon. This rule applied to every price book, laser included — and a laser marks with light, so a laser quote was told off for having nothing to print with, for ever, with nothing that could be added to satisfy it.',
    N'data/quote-completeness.md', N'Axim CPQ, quote completeness', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'consumable', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No ink, ribbon or fluid on this quote. The machine cannot print on arrival.', NULL, NULL, NULL, NULL);

-- Q-BARE-INK-CIJ  data/quote-completeness.md, A CIJ needs ink and solvent, and they are different roles
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'Q-BARE-INK-CIJ', N'CIJ', N'requires',
    N'A CIJ printer is quoted with no ink.', N'A continuous inkjet prints with ink and the catalogue files ink under its own role, so the consumable check could never see it. The supplied 7300 starter package lists the ink as its own line — ''Startup ink (3103 black), JZT1227/6E'' — alongside the solvent and the cleaning fluid.',
    N'data/quote-completeness.md, A CIJ needs ink and solvent, and they are different roles', N'Quote review, CIJ starter package', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'printer', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'role', NULL, N'ink', NULL, NULL, NULL, NULL, N'ne', NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'No ink on the quote. A continuous inkjet does not print without it, and the ink is chosen with the machine rather than after it.', NULL, NULL, NULL, NULL);

-- R-REQ-Airvex-PVC  web/src/api/catalog.ts, 5422938621531391 — "Fume Extractor, Airvex AD PVC iQ (MUST INCLUDE L6127757)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-Airvex-PVC', N'LSR', N'requires',
    N'The Airvex AD PVC iQ extractor must be quoted with its hose kit.', N'The extractor''s own description says MUST INCLUDE A1020392. A fume extractor with no hose kit is a box that cannot be connected to the laser, and it is the kind of omission that is only found on the install day, because the extractor arrives and looks complete.',
    N'web/src/api/catalog.ts, 5422938621531391 — "Fume Extractor, Airvex AD PVC iQ (MUST INCLUDE L6127757)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'5422938621531391', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'L6127757', 1, NULL, NULL, NULL, NULL, N'Extraction Hose Kit, 4m, 50mm to 75mm, w/ Stayput Nozzle (MUST INCLUDE)', NULL, NULL, NULL, NULL);

-- R-REQ-Airvex-NANO  web/src/api/catalog.ts, 3108100306 — "Fume Extractor, Airvex AD Nano (MUST INCLUDE L6127757)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-Airvex-NANO', N'LSR', N'requires',
    N'The Airvex AD Nano extractor must be quoted with its hose kit.', N'The extractor''s own description says MUST INCLUDE A1020392. A fume extractor with no hose kit is a box that cannot be connected to the laser, and it is the kind of omission that is only found on the install day, because the extractor arrives and looks complete.',
    N'web/src/api/catalog.ts, 3108100306 — "Fume Extractor, Airvex AD Nano (MUST INCLUDE L6127757)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'3108100306', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'L6127757', 1, NULL, NULL, NULL, NULL, N'Extraction Hose Kit, 4m, 50mm to 75mm, w/ Stayput Nozzle (MUST INCLUDE)', NULL, NULL, NULL, NULL);

-- R-REQ-Airvex-ORACLE  web/src/api/catalog.ts, 7285702543-7805 — "Fume Extractor, Airvex AD Oracle iQ (MUST INCLUDE L6127757)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-Airvex-ORACLE', N'LSR', N'requires',
    N'The Airvex AD Oracle iQ extractor must be quoted with its hose kit.', N'The extractor''s own description says MUST INCLUDE A1020392. A fume extractor with no hose kit is a box that cannot be connected to the laser, and it is the kind of omission that is only found on the install day, because the extractor arrives and looks complete.',
    N'web/src/api/catalog.ts, 7285702543-7805 — "Fume Extractor, Airvex AD Oracle iQ (MUST INCLUDE L6127757)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'7285702543-7805', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'L6127757', 1, NULL, NULL, NULL, NULL, N'Extraction Hose Kit, 4m, 50mm to 75mm, w/ Stayput Nozzle (MUST INCLUDE)', NULL, NULL, NULL, NULL);

-- R-REQ-Airvex-ORACLE-SA  web/src/api/catalog.ts, 9841223553-3876 — "Fume Extractor, Airvex AD Oracle SAiQ (MUST INCLUDE L6127757)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-Airvex-ORACLE-SA', N'LSR', N'requires',
    N'The Airvex AD Oracle SAiQ extractor must be quoted with its hose kit.', N'The extractor''s own description says MUST INCLUDE A1020392. A fume extractor with no hose kit is a box that cannot be connected to the laser, and it is the kind of omission that is only found on the install day, because the extractor arrives and looks complete.',
    N'web/src/api/catalog.ts, 9841223553-3876 — "Fume Extractor, Airvex AD Oracle SAiQ (MUST INCLUDE L6127757)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'9841223553-3876', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'L6127757', 1, NULL, NULL, NULL, NULL, N'Extraction Hose Kit, 4m, 50mm to 75mm, w/ Stayput Nozzle (MUST INCLUDE)', NULL, NULL, NULL, NULL);

-- R-REQ-PH-BRACKET-VERT  web/src/api/catalog.ts, 6727262 — "Vertical Adjustment PH Bracket, TOOL-LESS (Requires 9592660)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-PH-BRACKET-VERT', N'PIJ', N'requires',
    N'The tool-less vertical bracket mounts on the conveyor mounting kit.', N'The bracket''s description says Requires 5760821. That kit is filed under VIJ and this bracket under PIJ, so it does not appear in the item search on a PIJ quote — which is why this rule hands the part over rather than telling the rep to go and find it.',
    N'web/src/api/catalog.ts, 6727262 — "Vertical Adjustment PH Bracket, TOOL-LESS (Requires 9592660)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'6727262', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'9592660', 1, NULL, NULL, NULL, NULL, N'Single Print Head Conveyor Mounting Kit, 9 or 18 Dot — filed under VIJ, so the item search on this quote will not show it.', NULL, NULL, NULL, NULL);

-- R-REQ-PH-BRACKET-LIN  web/src/api/catalog.ts, 5334300 — "Linear Adjustment PH Bracket, TOOL-LESS (Requires 9592660 & 6727262)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-PH-BRACKET-LIN', N'PIJ', N'requires',
    N'The tool-less linear bracket needs the mounting kit and the vertical bracket.', N'The bracket''s description names both. 9592660 is filed under VIJ and does not appear in the item search on a PIJ quote.',
    N'web/src/api/catalog.ts, 5334300 — "Linear Adjustment PH Bracket, TOOL-LESS (Requires 9592660 & 6727262)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'5334300', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'9592660', 1, NULL, NULL, NULL, NULL, N'Single Print Head Conveyor Mounting Kit, 9 or 18 Dot — filed under VIJ, so the item search on this quote will not show it.', NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'6727262', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- R-REQ-ALARM-IO-BOARD  web/src/api/catalog.ts, 1334426 — "I/O Alarm Tower, 3 color (Requires I/O Board 5760-392)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-ALARM-IO-BOARD', N'VIJ', N'requires',
    N'The alarm tower is driven by the I/O board and does not work without it.', N'REPORTED as the part that could not be found. The description writes the board as 5760-392 and the catalogue row is 6870691, so searching for what the description says returns nothing — and the board is filed under PIJ while the tower is VIJ, so even the right number would not appear in the item search on this quote. The description is Orbit''s and is not edited here; the number that finds it is stated below.',
    N'web/src/api/catalog.ts, 1334426 — "I/O Alarm Tower, 3 color (Requires I/O Board 5760-392)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'1334426', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'require', N'6870691', 1, NULL, NULL, NULL, NULL, N'I/O Board Kit — the catalogue writes it 6870691, without the hyphen the description uses, and files it under PIJ.', NULL, NULL, NULL, NULL);

-- R-REQ-QUICKSWITCH-IO  web/src/api/catalog.ts, 830440 — "Quickswitch Kit 6400 RS232 - Hand Scanner (requires i/o board)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-QUICKSWITCH-IO', N'CIJ', N'note',
    N'The 6400 Quickswitch kit needs an I/O board, and the description does not say which.', N'Written as a note rather than a requirement on purpose. The only I/O board in the catalogue is 6870691, which is the HR2600 controller''s; assuming an 6400 takes the same one would put a wrong part on a quote with a rule behind it. The rep is told to confirm the board instead of being handed a guess.',
    N'web/src/api/catalog.ts, 830440 — "Quickswitch Kit 6400 RS232 - Hand Scanner (requires i/o board)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'830440', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'This kit requires an I/O board and the price page does not say which one. Confirm the board for the 6400 before sending — the only I/O board in the catalogue is the HR2600''s.', NULL, NULL, NULL, NULL);

-- R-REQ-Airvex-CONNECTOR  web/src/api/catalog.ts, 553698 — "M12A-5pin-F Connector, Airvex, CSL (MUST INCLUDE WITH Airvex)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-Airvex-CONNECTOR', N'LSR', N'note',
    N'The M12A connector goes with a Airvex extractor.', N'The description states the pairing without naming a row: Airvex is the manufacturer of several extractors here. Quoted on its own it is probably a spare, which is legitimate, so this says so rather than blocking.',
    N'web/src/api/catalog.ts, 553698 — "M12A-5pin-F Connector, Airvex, CSL (MUST INCLUDE WITH Airvex)"', N'Axim price page, item description', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'553698', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'This connector is specified to be included with a Airvex extractor. Check there is one on the quote, or that this is being sold as a spare.', NULL, NULL, NULL, NULL);

-- R-REQ-TAMP-COVER  web/src/api/catalog.ts, 669569 — "Tamp Arm Cover Extension - REQUIRED FOR 20/30" TAMP"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-TAMP-COVER', N'PALM', N'note',
    N'The tamp arm cover extension is only for the 20 and 30 inch tamps.', N'A condition on the tamp stroke, which the quote does not carry as a field, so it cannot be graded. Stated so a rep quoting a shorter tamp is not paying for an extension it does not need, and one quoting a 20 or 30 inch tamp does not leave it off.',
    N'web/src/api/catalog.ts, 669569 — "Tamp Arm Cover Extension - REQUIRED FOR 20/30" TAMP"', N'Axim price page, item description', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'669569', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'This extension is required for a 20" or 30" tamp and is not needed on a shorter one. Check the tamp stroke on this quote.', NULL, NULL, NULL, NULL);

-- R-REQ-LOGO-FIXTURE  web/src/api/catalog.ts, 0337317 — "Logo Fixture for IV18 - 1" print heads.  Requires support structure for mounting.  Support structure may be special quoted or customer supplied.  5-6 week lead time."
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-REQ-LOGO-FIXTURE', N'PALM', N'note',
    N'The IV18 logo fixture needs a support structure that is not a catalogue part.', N'The description is explicit that the structure is special-quoted or supplied by the customer, so there is nothing to require. The lead time is the part most likely to be missed: five to six weeks against one to four for a standard build.',
    N'web/src/api/catalog.ts, 0337317 — "Logo Fixture for IV18 - 1" print heads.  Requires support structure for mounting.  Support structure may be special quoted or customer supplied.  5-6 week lead time."', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'0337317', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'This fixture needs a support structure, which is special-quoted or customer supplied rather than a catalogue part. Lead time is 5-6 weeks.', NULL, NULL, NULL, NULL);

-- R-APPR-6420-MAINT-5YR  web/src/api/catalog.ts, 3425425 — "6420 5 year Maintenance Modules (Need RSM Approval, Existing only)"
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'R-APPR-6420-MAINT-5YR', N'CIJ', N'note',
    N'Five-year maintenance modules for the 6420 need RSM approval.', N'The description says ''Need RSM Approval, Existing only''. Two conditions in five words: it is approved rather than simply quoted, and it is for machines already installed rather than a new one. Written as an approval so the quote cannot go out without the decision being recorded against it.',
    N'web/src/api/catalog.ts, 3425425 — "6420 5 year Maintenance Modules (Need RSM Approval, Existing only)"', N'Axim price page, item description', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'3425425', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'approve', NULL, NULL, NULL, NULL, N'Regional Sales Manager', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Five-year maintenance modules are for machines already installed, and need Regional Sales Manager approval.', NULL, NULL, NULL, NULL);

-- W-001  data/discount-caps.md, W-001 (CIJ workbook, 3. Pick your accessories, G28)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-001', N'CIJ', N'discountCap',
    N'Cbl, CIJ Daisy Chain, 10'', IP67, DB9M-M, HD Shielded (PDEM Cable) is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-001 (CIJ workbook, 3. Pick your accessories, G28)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'712295', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'712295', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-002  data/discount-caps.md, W-002 (CIJ workbook, 3. Pick your accessories, G29)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-002', N'CIJ', N'discountCap',
    N'Kit, Integration Cabling, 7.5m, CIJ (Machine Integration) is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-002 (CIJ workbook, 3. Pick your accessories, G29)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'404771', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'404771', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-006  data/discount-caps.md, W-006 (CIJ workbook, 3. Pick your accessories, G38), W-017 (CIJ workbook, 3. Pick your accessories, G60)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-006', N'CIJ', N'discountCap',
    N'60\" Pole, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Two cells carry the same note on this part; both are named below. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-006 (CIJ workbook, 3. Pick your accessories, G38), W-017 (CIJ workbook, 3. Pick your accessories, G60)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'559427', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'559427', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-011  data/discount-caps.md, W-011 (CIJ workbook, 3. Pick your accessories, G54)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-011', N'CIJ', N'discountCap',
    N'PH Stnd, No Base, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-011 (CIJ workbook, 3. Pick your accessories, G54)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'456049', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'456049', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-012  data/discount-caps.md, W-012 (CIJ workbook, 3. Pick your accessories, G55)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-012', N'CIJ', N'discountCap',
    N'H-Base Kit, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-012 (CIJ workbook, 3. Pick your accessories, G55)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'140262', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'140262', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-013  data/discount-caps.md, W-013 (CIJ workbook, 3. Pick your accessories, G56)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-013', N'CIJ', N'discountCap',
    N'Flr/Conv Mnt Kit, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-013 (CIJ workbook, 3. Pick your accessories, G56)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'806909', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'806909', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-014  data/discount-caps.md, W-014 (CIJ workbook, 3. Pick your accessories, G57)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-014', N'CIJ', N'discountCap',
    N'Link Assy, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-014 (CIJ workbook, 3. Pick your accessories, G57)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'419376', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'419376', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-015  data/discount-caps.md, W-015 (CIJ workbook, 3. Pick your accessories, G58)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-015', N'CIJ', N'discountCap',
    N'PH Mnt Assy, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-015 (CIJ workbook, 3. Pick your accessories, G58)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'922770', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'922770', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-016  data/discount-caps.md, W-016 (CIJ workbook, 3. Pick your accessories, G59)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-016', N'CIJ', N'discountCap',
    N'Quick Adjust Kit, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-016 (CIJ workbook, 3. Pick your accessories, G59)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'188194', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'188194', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-018  data/discount-caps.md, W-018 (CIJ workbook, 3. Pick your accessories, G61)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-018', N'CIJ', N'discountCap',
    N'72\" Pole, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-018 (CIJ workbook, 3. Pick your accessories, G61)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'091570', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'091570', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-019  data/discount-caps.md, W-019 (CIJ workbook, 3. Pick your accessories, G62)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-019', N'CIJ', N'discountCap',
    N'36\" Pole, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-019 (CIJ workbook, 3. Pick your accessories, G62)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'774936', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'774936', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-020  data/discount-caps.md, W-020 (CIJ workbook, 3. Pick your accessories, G63)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-020', N'CIJ', N'discountCap',
    N'23\" Pole, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-020 (CIJ workbook, 3. Pick your accessories, G63)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'380413', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'380413', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-021  data/discount-caps.md, W-021 (CIJ workbook, 3. Pick your accessories, G64)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-021', N'CIJ', N'discountCap',
    N'12\" Pole, PH Stnd, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-021 (CIJ workbook, 3. Pick your accessories, G64)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'797711', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'797711', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-022  data/discount-caps.md, W-022 (CIJ workbook, 3. Pick your accessories, G65)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-022', N'CIJ', N'discountCap',
    N'PH Mnt Assy, Direct Mnt, CIJ, SS is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-022 (CIJ workbook, 3. Pick your accessories, G65)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'322718', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'322718', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-023  data/discount-caps.md, W-023 (CIJ workbook, 3. Pick your accessories, G66)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-023', N'CIJ', N'discountCap',
    N'Sensor Mnt, EZ Pro Controller, CIJ is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-023 (CIJ workbook, 3. Pick your accessories, G66)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'947270', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'947270', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-024  data/discount-caps.md, W-024 (CIJ workbook, 3. Pick your accessories, G67)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-024', N'CIJ', N'discountCap',
    N'Kit, Beacon Mnt, 6400 Cabinet is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-024 (CIJ workbook, 3. Pick your accessories, G67)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'150725', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'150725', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-025  data/discount-caps.md, W-025 (CIJ workbook, 3. Pick your accessories, G68)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-025', N'CIJ', N'discountCap',
    N'Kit, Sensor Mnt, TriTronics FSxxx, CIJ is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-025 (CIJ workbook, 3. Pick your accessories, G68)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'538272', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'538272', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-026  data/discount-caps.md, W-026 (CIJ workbook, 3. Pick your accessories, G69)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-026', N'CIJ', N'discountCap',
    N'RLC DTC, CIJ Conv. Mnt (for 806909) is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-026 (CIJ workbook, 3. Pick your accessories, G69)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'862419', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'862419', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-027  data/discount-caps.md, W-027 (CIJ workbook, 3. Pick your accessories, G71)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-027', N'CIJ', N'discountCap',
    N'Single Printer Cart, 6400 Series, SS, Made in USA is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-027 (CIJ workbook, 3. Pick your accessories, G71)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'497859', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'497859', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-028  data/discount-caps.md, W-028 (CIJ workbook, 3. Pick your accessories, G72)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-028', N'CIJ', N'discountCap',
    N'Dual Printer Cart, 6400, SS, Made in USA is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-028 (CIJ workbook, 3. Pick your accessories, G72)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'469931', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'469931', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-029  data/discount-caps.md, W-029 (CIJ workbook, 3. Pick your accessories, G79)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-029', N'CIJ', N'discountCap',
    N'Kit, Membrane Air Dryer, 6400 is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-029 (CIJ workbook, 3. Pick your accessories, G79)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'660136', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'660136', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-069  data/discount-caps.md, W-069 (PALM workbook, LB5200 PL6300 CONFIG, G107)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-069', N'PALM', N'discountCap',
    N'Cbl, Remote HMI, PALM, 10''  (Recommended for Enclosures / Taller Stands) is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-069 (PALM workbook, LB5200 PL6300 CONFIG, G107)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'565214', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'565214', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-078  data/discount-caps.md, W-078 (PALM workbook, LB5200 PL6300 CONFIG, G127)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-078', N'PALM', N'discountCap',
    N'Kit, Sensor Brkt, Alt Mnt, ALP  (Mounts Sensor to Opposite Side of Applicator) is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-078 (PALM workbook, LB5200 PL6300 CONFIG, G127)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'346311', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'346311', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-079  data/discount-caps.md, W-079 (PALM workbook, LB5200 PL6300 CONFIG, G128)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-079', N'PALM', N'discountCap',
    N'Kit, Sensor Brkt w/ Reflector, PALM, SS  (Conveyor Mnt) is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-079 (PALM workbook, LB5200 PL6300 CONFIG, G128)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'134728', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'134728', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-080  data/discount-caps.md, W-080 (PALM workbook, LB5200 PL6300 CONFIG, G129)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-080', N'PALM', N'discountCap',
    N'Kit, Sensor Brkt, PALM, SS (Conveyor Mnt) is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-080 (PALM workbook, LB5200 PL6300 CONFIG, G129)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'205078', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'205078', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-081  data/discount-caps.md, W-081 (PALM workbook, LB5200 PL6300 CONFIG, G136)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-081', N'PALM', N'discountCap',
    N'54\" T-Base Stand is capped at 10%.', N'''10% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-081 (PALM workbook, LB5200 PL6300 CONFIG, G136)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'284546Z05', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'284546Z05', NULL, 0.1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-082  data/discount-caps.md, W-082 (PALM workbook, LB5200 PL6300 CONFIG, G137)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-082', N'PALM', N'discountCap',
    N'72\" T-Base Stand w/ Back-Crank is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-082 (PALM workbook, LB5200 PL6300 CONFIG, G137)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'268360T99FL', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'268360T99FL', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-083  data/discount-caps.md, W-083 (PALM workbook, LB5200 PL6300 CONFIG, G138)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-083', N'PALM', N'discountCap',
    N'54\" U-Base Stand is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-083 (PALM workbook, LB5200 PL6300 CONFIG, G138)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'081634P77', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'081634P77', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-084  data/discount-caps.md, W-084 (PALM workbook, LB5200 PL6300 CONFIG, G139)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-084', N'PALM', N'discountCap',
    N'72\" U-Base Stand w/ Back-Crank is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-084 (PALM workbook, LB5200 PL6300 CONFIG, G139)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'506484A64EJ', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'506484A64EJ', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-085  data/discount-caps.md, W-085 (PALM workbook, LB5200 PL6300 CONFIG, G140)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-085', N'PALM', N'discountCap',
    N'54\" Floor Mnt Stand, 360 Deg Base, 18\" Horiztonal Adjustment is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-085 (PALM workbook, LB5200 PL6300 CONFIG, G140)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'034486Q18054VT', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'034486Q18054VT', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-086  data/discount-caps.md, W-086 (PALM workbook, LB5200 PL6300 CONFIG, G141)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-086', N'PALM', N'discountCap',
    N'72\" Floor Mnt Stand, 360 Deg Base, 18\" Horiztonal Adjustment w/ Back-Crank is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-086 (PALM workbook, LB5200 PL6300 CONFIG, G141)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'043680R50965GRRA', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'043680R50965GRRA', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-087  data/discount-caps.md, W-087 (PALM workbook, LB5200 PL6300 CONFIG, G143)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-087', N'PALM', N'discountCap',
    N'Docking Cleats, 3/PK, RLC Stands  (3 for T-Base, 2 for U-Base) is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-087 (PALM workbook, LB5200 PL6300 CONFIG, G143)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'882526', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'882526', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-088  data/discount-caps.md, W-088 (PALM workbook, LB5200 PL6300 CONFIG, G146)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-088', N'PALM', N'discountCap',
    N'Kit, 15/20\" FASA Support, PALM (Adjustable - All stands) is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-088 (PALM workbook, LB5200 PL6300 CONFIG, G146)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'478635', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'478635', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-101  data/discount-caps.md, W-101 (PALM workbook, LB5200 PL6300 CONFIG, G175)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-101', N'PALM', N'discountCap',
    N'Environmental enclosure, E-Tamp, Top Down is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-101 (PALM workbook, LB5200 PL6300 CONFIG, G175)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'806998WG', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'806998WG', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-103  data/discount-caps.md, W-103 (PALM workbook, LB5200 PL6300 CONFIG, G176)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-103', N'PALM', N'discountCap',
    N'Environmental enclosure, E-Tamp, Side Apply/Nose-up/Nose-Down is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-103 (PALM workbook, LB5200 PL6300 CONFIG, G176)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'551370NU', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'551370NU', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-105  data/discount-caps.md, W-105 (PALM workbook, LB5200 PL6300 CONFIG, G177)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-105', N'PALM', N'discountCap',
    N'Environmental enclosure, E-FASA, Top Down is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-105 (PALM workbook, LB5200 PL6300 CONFIG, G177)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'905428RS', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'905428RS', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-107  data/discount-caps.md, W-107 (PALM workbook, LB5200 PL6300 CONFIG, G178)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-107', N'PALM', N'discountCap',
    N'Environmental enclosure, E-FASA, Side Apply is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-107 (PALM workbook, LB5200 PL6300 CONFIG, G178)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'431583XM', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'431583XM', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-109  data/discount-caps.md, W-109 (PALM workbook, LB5200 PL6300 CONFIG, G179)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-109', N'PALM', N'discountCap',
    N'Environmental enclosure, E-FASA, Nose-Up/Nose-Down is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-109 (PALM workbook, LB5200 PL6300 CONFIG, G179)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'920848NM', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'920848NM', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-111  data/discount-caps.md, W-111 (PALM workbook, LB5200 PL6300 CONFIG, G180)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-111', N'PALM', N'discountCap',
    N'Kit, Rotational Assy, Enviro Encl, PALM, RLC is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-111 (PALM workbook, LB5200 PL6300 CONFIG, G180)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'721013', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'721013', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-112  data/discount-caps.md, W-112 (PALM workbook, LB5200 PL6300 CONFIG, G181)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-112', N'PALM', N'discountCap',
    N'Tamp Arm Cover Extension - REQUIRED FOR 20/30\" TAMP is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-112 (PALM workbook, LB5200 PL6300 CONFIG, G181)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'669569', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'669569', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-113  data/discount-caps.md, W-113 (PALM workbook, LB5200 PL6300 CONFIG, G182)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-113', N'PALM', N'discountCap',
    N'Positive Air, With Shut off & filter/regulator is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-113 (PALM workbook, LB5200 PL6300 CONFIG, G182)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'295578', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'295578', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-114  data/discount-caps.md, W-114 (PALM workbook, LB5200 PL6300 CONFIG, G183)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-114', N'PALM', N'discountCap',
    N'Electric Heater with Thermostat and On/Off Switch is capped at 5%.', N'''5% Limited Discount'' written against this part on the price page. Found in the inactive drafts rather than among the caps: the extractor keyed on the wording ''Max Discount'', and the print-and-apply book says ''Limited Discount'' instead. Same statement, same column, same unambiguous pair of a part and a percentage.',
    N'data/discount-caps.md, W-114 (PALM workbook, LB5200 PL6300 CONFIG, G183)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'750925', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'750925', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-127  data/discount-caps.md, W-127 (PIJ workbook, 3. Pick your accessories, G86)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-127', N'PIJ', N'discountCap',
    N'Designer Pro Basic Design Software is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-127 (PIJ workbook, 3. Pick your accessories, G86)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'SUYFNU681F', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'SUYFNU681F', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-128  data/discount-caps.md, W-128 (PIJ workbook, 3. Pick your accessories, G87)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-128', N'PIJ', N'discountCap',
    N'PowerForms Suite (up to 3 printers from one controller) is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-128 (PIJ workbook, 3. Pick your accessories, G87)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'PTSSHA698P', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'PTSSHA698P', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-129  data/discount-caps.md, W-129 (PIJ workbook, 3. Pick your accessories, G88)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-129', N'PIJ', N'discountCap',
    N'SMA(3yr)PowerForms Suite 3 printers is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-129 (PIJ workbook, 3. Pick your accessories, G88)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'UVQZEB2429', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'UVQZEB2429', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-130  data/discount-caps.md, W-130 (PIJ workbook, 3. Pick your accessories, G89)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-130', N'PIJ', N'discountCap',
    N'PowerForms Suite (up to 5 printers from one controller) is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-130 (PIJ workbook, 3. Pick your accessories, G89)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'XRNDBN621M', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'XRNDBN621M', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-131  data/discount-caps.md, W-131 (PIJ workbook, 3. Pick your accessories, G90)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-131', N'PIJ', N'discountCap',
    N'SMA(3yr)PowerForms Suite 5 printers is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-131 (PIJ workbook, 3. Pick your accessories, G90)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'NFYUXN4519', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'NFYUXN4519', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-132  data/discount-caps.md, W-132 (PIJ workbook, 3. Pick your accessories, G91)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-132', N'PIJ', N'discountCap',
    N'PowerForms Suite (up to 10 printers from one controller) is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-132 (PIJ workbook, 3. Pick your accessories, G91)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'ENRMRC272B', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'ENRMRC272B', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-133  data/discount-caps.md, W-133 (PIJ workbook, 3. Pick your accessories, G92)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-133', N'PIJ', N'discountCap',
    N'SMA(3yr)PowerForms Suite 10 printers is capped at 5%.', N'''Max Discount 5%'' written against this part on the price page. Seeded straight into cpq.rule by 04_seed_rules.sql until now, which meant the service applied it and the preview did not — a rep could take this to 30% on screen and be refused at 5% on the order.',
    N'data/discount-caps.md, W-133 (PIJ workbook, 3. Pick your accessories, G92)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'FEFFYP4688', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'cap', N'FEFFYP4688', NULL, 0.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- W-003  data/price-page-notes.md, W-003 (CIJ workbook, 3. Pick your accessories, D33)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-003', N'CIJ', N'note',
    N'Need Multistage Alarm Hardware Upgrade from Hardware Upgrade section', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D33. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-003 (CIJ workbook, 3. Pick your accessories, D33)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'8661724HQT5', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Need Multistage Alarm Hardware Upgrade from Hardware Upgrade section', NULL, NULL, NULL, NULL);

-- W-004  data/price-page-notes.md, W-004 (CIJ workbook, 3. Pick your accessories, D34)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-004', N'CIJ', N'note',
    N'Need Multistage Alarm Hardware Upgrade from Hardware Upgrade section', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D34. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-004 (CIJ workbook, 3. Pick your accessories, D34)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'2052759BRV7ZAG', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Need Multistage Alarm Hardware Upgrade from Hardware Upgrade section', NULL, NULL, NULL, NULL);

-- W-005  data/price-page-notes.md, W-005 (CIJ workbook, 3. Pick your accessories, D37)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-005', N'CIJ', N'note',
    N'This is the same bottle as the cleaning solution, no need to order if you are selling cleaning solution', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D37. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-005 (CIJ workbook, 3. Pick your accessories, D37)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'NA73925', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'This is the same bottle as the cleaning solution, no need to order if you are selling cleaning solution', NULL, NULL, NULL, NULL);

-- W-007  data/price-page-notes.md, W-007 (CIJ workbook, 3. Pick your accessories, D47)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-007', N'CIJ', N'note',
    N'Printhead bracket ONLY', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D47. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-007 (CIJ workbook, 3. Pick your accessories, D47)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'LY03715', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Printhead bracket ONLY', NULL, NULL, NULL, NULL);

-- W-008  data/price-page-notes.md, W-008 (CIJ workbook, 3. Pick your accessories, D48)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-008', N'CIJ', N'note',
    N'Printhead bracket ONLY', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D48. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-008 (CIJ workbook, 3. Pick your accessories, D48)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'UX84066', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Printhead bracket ONLY', NULL, NULL, NULL, NULL);

-- W-009  data/price-page-notes.md, W-009 (CIJ workbook, 3. Pick your accessories, D49)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-009', N'CIJ', N'note',
    N'If replacing screws with tool-less handscrews, order (1) PH and (2) Cross Joints', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D49. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-009 (CIJ workbook, 3. Pick your accessories, D49)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'PL79549', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'If replacing screws with tool-less handscrews, order (1) PH and (2) Cross Joints', NULL, NULL, NULL, NULL);

-- W-010  data/price-page-notes.md, W-010 (CIJ workbook, 3. Pick your accessories, D50)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-010', N'CIJ', N'note',
    N'If replacing screws with tool-less handscrews, order (1) PH and (2) Cross Joints', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D50. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-010 (CIJ workbook, 3. Pick your accessories, D50)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'PA12190', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'If replacing screws with tool-less handscrews, order (1) PH and (2) Cross Joints', NULL, NULL, NULL, NULL);

-- W-038  data/price-page-notes.md, W-038 (CIJ workbook, 3. Pick your accessories, D105)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-038', N'CIJ', N'note',
    N'Order this cable only when replacing older Corvus models with VFC or Dual Alarm', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D105. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-038 (CIJ workbook, 3. Pick your accessories, D105)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'8828339', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Order this cable only when replacing older Corvus models with VFC or Dual Alarm', NULL, NULL, NULL, NULL);

-- W-039  data/price-page-notes.md, W-039 (CIJ workbook, 3. Pick your accessories, D118)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-039', N'CIJ', N'note',
    N'ONLY QUOTE WITH 6420. New printer sale only. Existing customers only. 24 month inks only.', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D118. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-039 (CIJ workbook, 3. Pick your accessories, D118)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'8340970', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'ONLY QUOTE WITH 6420. New printer sale only. Existing customers only. 24 month inks only.', NULL, NULL, NULL, NULL);

-- W-040  data/price-page-notes.md, W-040 (CIJ workbook, 3. Pick your accessories, D119)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-040', N'CIJ', N'note',
    N'ONLY QUOTE WITH 6420. New printer sale only. Existing customers only. 24 month inks only.', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D119. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-040 (CIJ workbook, 3. Pick your accessories, D119)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'7508159', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'ONLY QUOTE WITH 6420. New printer sale only. Existing customers only. 24 month inks only.', NULL, NULL, NULL, NULL);

-- W-041  data/price-page-notes.md, W-041 (CIJ workbook, 3. Pick your accessories, D120)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-041', N'CIJ', N'note',
    N'ONLY QUOTE WITH 6420. New printer sale only. Existing customers only. 24 month inks only. Must get RSM approval.', N'Written on this part''s own row in the CIJ price page, at 3. Pick your accessories, D120. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-041 (CIJ workbook, 3. Pick your accessories, D120)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'3425425', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'ONLY QUOTE WITH 6420. New printer sale only. Existing customers only. 24 month inks only. Must get RSM approval.', NULL, NULL, NULL, NULL);

-- W-042  data/price-page-notes.md, W-042 (CIJ workbook, 3. Pick your accessories, D121)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-042', N'CIJ', N'note',
    N'Only to be used together with an 6420 or 6440.', N'The one comment of the 75 not shown word for word. In full it reads: "Only to be used together with a 6420/6440 and Service Offering Highlighted here. Put a 1 in the qty and the amount out of $1000 you''re giving to the customer in the List Price" — the second half instructs the rep on filling in the price workbook, naming a column and a dollar figure, and neither means anything outside that spreadsheet. The guidance in the first half is real and is kept. Nothing else here is edited; see data/price-page-notes.md.',
    N'data/price-page-notes.md, W-042 (CIJ workbook, 3. Pick your accessories, D121)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'1369064', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Only to be used together with an 6420 or 6440, alongside the service offering.', NULL, NULL, NULL, NULL);

-- W-053  data/price-page-notes.md, W-053 (LSR workbook, CORVUS CSL Configuration, D18)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-053', N'LSR', N'note',
    N'Highly recommend, and a must for barcodes. This CAN NOT be used on a matte-top chain conveyor and will require a direct couple.', N'Written on this part''s own row in the LSR price page, at CORVUS CSL Configuration, D18. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-053 (LSR workbook, CORVUS CSL Configuration, D18)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'960771', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Highly recommend, and a must for barcodes. This CAN NOT be used on a matte-top chain conveyor and will require a direct couple.', NULL, NULL, NULL, NULL);

-- W-054  data/price-page-notes.md, W-054 (LSR workbook, CORVUS CSL Configuration, D22)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-054', N'LSR', N'note',
    N'Note that the alarm tower will NOT illuminate as one would expect. RED is used for when laser is ACTIVE, and not faulted.', N'Written on this part''s own row in the LSR price page, at CORVUS CSL Configuration, D22. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-054 (LSR workbook, CORVUS CSL Configuration, D22)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'0876200NBH', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Note that the alarm tower will NOT illuminate as one would expect. RED is used for when laser is ACTIVE, and not faulted.', NULL, NULL, NULL, NULL);

-- W-055  data/price-page-notes.md, W-055 (LSR workbook, CORVUS CSL Configuration, D30)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-055', N'LSR', N'note',
    N'Light Duty / Low Throughput / Low Particulate', N'Written on this part''s own row in the LSR price page, at CORVUS CSL Configuration, D30. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-055 (LSR workbook, CORVUS CSL Configuration, D30)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'3108100306', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Light Duty / Low Throughput / Low Particulate', NULL, NULL, NULL, NULL);

-- W-056  data/price-page-notes.md, W-056 (LSR workbook, CORVUS CSL Configuration, D31)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-056', N'LSR', N'note',
    N'Med/High Duty / Med/High Throughput / Low-Med Particulate', N'Written on this part''s own row in the LSR price page, at CORVUS CSL Configuration, D31. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-056 (LSR workbook, CORVUS CSL Configuration, D31)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'9841223553-3876', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Med/High Duty / Med/High Throughput / Low-Med Particulate', NULL, NULL, NULL, NULL);

-- W-057  data/price-page-notes.md, W-057 (LSR workbook, CORVUS CSL Configuration, D32)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-057', N'LSR', N'note',
    N'Med/High Duty / Med/High Throughput / Med-High Particulate', N'Written on this part''s own row in the LSR price page, at CORVUS CSL Configuration, D32. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-057 (LSR workbook, CORVUS CSL Configuration, D32)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'7285702543-7805', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Med/High Duty / Med/High Throughput / Med-High Particulate', NULL, NULL, NULL, NULL);

-- W-058  data/price-page-notes.md, W-058 (LSR workbook, CORVUS CSL Configuration, D33)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-058', N'LSR', N'note',
    N'PVC ONLY - Any substrate which has a vinyl component to it will off gas hydrochloric acid when marked. Additionally safety precautions should be take.', N'Written on this part''s own row in the LSR price page, at CORVUS CSL Configuration, D33. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-058 (LSR workbook, CORVUS CSL Configuration, D33)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'5422938621531391', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'PVC ONLY - Any substrate which has a vinyl component to it will off gas hydrochloric acid when marked. Additionally safety precautions should be take.', NULL, NULL, NULL, NULL);

-- W-059  data/price-page-notes.md, W-059 (LSR workbook, CORVUS FSL Configuration, D18)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-059', N'LSR', N'note',
    N'Highly recommend, and a must for barcodes. This CAN NOT be used on a matte-top chain conveyor and will require a direct couple.', N'Written on this part''s own row in the LSR price page, at CORVUS FSL Configuration, D18. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-059 (LSR workbook, CORVUS FSL Configuration, D18)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'960771', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Highly recommend, and a must for barcodes. This CAN NOT be used on a matte-top chain conveyor and will require a direct couple.', NULL, NULL, NULL, NULL);

-- W-060  data/price-page-notes.md, W-060 (LSR workbook, CORVUS FSL Configuration, D22)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-060', N'LSR', N'note',
    N'Note that the alarm tower will NOT illuminate as one would expect. RED is used for when laser is ACTIVE, and not faulted.', N'Written on this part''s own row in the LSR price page, at CORVUS FSL Configuration, D22. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-060 (LSR workbook, CORVUS FSL Configuration, D22)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'0876200NBH', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Note that the alarm tower will NOT illuminate as one would expect. RED is used for when laser is ACTIVE, and not faulted.', NULL, NULL, NULL, NULL);

-- W-061  data/price-page-notes.md, W-061 (PALM workbook, LB5200 PL6300 CONFIG, C18)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-061', N'PALM', N'note',
    N'Be sure to include engine cabling', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C18. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-061 (PALM workbook, LB5200 PL6300 CONFIG, C18)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'322507B-XQ', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Be sure to include engine cabling', NULL, NULL, NULL, NULL);

-- W-062  data/price-page-notes.md, W-062 (PALM workbook, LB5200 PL6300 CONFIG, C19)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-062', N'PALM', N'note',
    N'Be sure to include engine cabling', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C19. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-062 (PALM workbook, LB5200 PL6300 CONFIG, C19)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'104974J-AS', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Be sure to include engine cabling', NULL, NULL, NULL, NULL);

-- W-063  data/price-page-notes.md, W-063 (PALM workbook, LB5200 PL6300 CONFIG, D42)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-063', N'PALM', N'note',
    N'Length will be determined by label length above. Multiple label lengths cannot be accommodated on the same WASA. Available lengths are 6", 8", 10", an…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D42. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-063 (PALM workbook, LB5200 PL6300 CONFIG, D42)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'TYNR FL 3', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Length will be determined by label length above. Multiple label lengths cannot be accommodated on the same WASA. Available lengths are 6", 8", 10", and 12" Guide Rails are an ABSOLUTE MUST. Product success depends on Guide Rail(s) to contain the product on path and tightly wrap the front edge', NULL, NULL, NULL, NULL);

-- W-064  data/price-page-notes.md, W-064 (PALM workbook, LB5200 PL6300 CONFIG, D43)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-064', N'PALM', N'note',
    N'Length will be determined by label length above. Multiple label lengths cannot be accommodated on the same WASA. Available lengths are 6", 8", 10", an…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D43. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-064 (PALM workbook, LB5200 PL6300 CONFIG, D43)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'TYNR FL 3', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Length will be determined by label length above. Multiple label lengths cannot be accommodated on the same WASA. Available lengths are 6", 8", 10", and 12" Guide Rails are an ABSOLUTE MUST. Product success depends on Guide Rail(s) to contain the product on path and tightly wrap the front edge', NULL, NULL, NULL, NULL);

-- W-065  data/price-page-notes.md, W-065 (PALM workbook, LB5200 PL6300 CONFIG, D92)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-065', N'PALM', N'note',
    N'Typically needed when customer opts for the "No Print Engine" and has an existing printer (out of a competitor system or old PA/5000LT). If the existi…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D92. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-065 (PALM workbook, LB5200 PL6300 CONFIG, D92)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'7897487', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Typically needed when customer opts for the "No Print Engine" and has an existing printer (out of a competitor system or old PA/5000LT). If the existing printer is a Palisade or Markwell, then this cable is required to hook the printer up to this system.', NULL, NULL, NULL, NULL);

-- W-066  data/price-page-notes.md, W-066 (PALM workbook, LB5200 PL6300 CONFIG, D93)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-066', N'PALM', N'note',
    N'Typically needed when customer opts for the "No Print Engine" and has an existing printer (out of a competitor system or old PA/5000LT). If the existi…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D93. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-066 (PALM workbook, LB5200 PL6300 CONFIG, D93)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'1764690', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Typically needed when customer opts for the "No Print Engine" and has an existing printer (out of a competitor system or old PA/5000LT). If the existing printer is a Palisade or Markwell, then this cable is required to hook the printer up to this system.', NULL, NULL, NULL, NULL);

-- W-067  data/price-page-notes.md, W-067 (PALM workbook, LB5200 PL6300 CONFIG, D103)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-067', N'PALM', N'note',
    N'Retro-Reflective (Break Beam Sensor). Uses reflector to trigger when a product "breaks the beam". Range = 1 inch to 10 feet. Mainly used for pallet ap…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D103. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-067 (PALM workbook, LB5200 PL6300 CONFIG, D103)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'4734225REFPHMH', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Retro-Reflective (Break Beam Sensor). Uses reflector to trigger when a product "breaks the beam". Range = 1 inch to 10 feet. Mainly used for pallet applications or where shrink wrap can fool the standard diffused (4600-900) sensor. Fits standard 4600-900 hole positions.', NULL, NULL, NULL, NULL);

-- W-068  data/price-page-notes.md, W-068 (PALM workbook, LB5200 PL6300 CONFIG, D104)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-068', N'PALM', N'note',
    N'If you need label placement accuracy - you need this sensor. See manual for more information', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D104. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-068 (PALM workbook, LB5200 PL6300 CONFIG, D104)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'3740669YEXUGDT', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'If you need label placement accuracy - you need this sensor. See manual for more information', NULL, NULL, NULL, NULL);

-- W-070  data/price-page-notes.md, W-070 (PALM workbook, LB5200 PL6300 CONFIG, D108)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-070', N'PALM', N'note',
    N'The High-Volume Air Assist fan should be considered when using a label 8” or greater in length. Polyurethane/synthetic plastic labels may also benefit…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D108. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-070 (PALM workbook, LB5200 PL6300 CONFIG, D108)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'5985481LNZSDGVF', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'The High-Volume Air Assist fan should be considered when using a label 8” or greater in length. Polyurethane/synthetic plastic labels may also benefit from the High-Volume air assist fan.', NULL, NULL, NULL, NULL);

-- W-071  data/price-page-notes.md, W-071 (PALM workbook, LB5200 PL6300 CONFIG, D109)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-071', N'PALM', N'note',
    N'The High-Volume Air Assist fan should be considered when using a label 8” or greater in length. Polyurethane/synthetic plastic labels may also benefit…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D109. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-071 (PALM workbook, LB5200 PL6300 CONFIG, D109)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'8685948LSCPJFTY', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'The High-Volume Air Assist fan should be considered when using a label 8” or greater in length. Polyurethane/synthetic plastic labels may also benefit from the High-Volume air assist fan.', NULL, NULL, NULL, NULL);

-- W-072  data/price-page-notes.md, W-072 (PALM workbook, LB5200 PL6300 CONFIG, D110)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-072', N'PALM', N'note',
    N'Do not specify without Application Engineering and Management approval', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D110. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-072 (PALM workbook, LB5200 PL6300 CONFIG, D110)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'4623455QUUYSJF', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Do not specify without Application Engineering and Management approval', NULL, NULL, NULL, NULL);

-- W-073  data/price-page-notes.md, W-073 (PALM workbook, LB5200 PL6300 CONFIG, D117)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-073', N'PALM', N'note',
    N'These are particularly useful for pallet applications and varying height/width applications', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D117. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-073 (PALM workbook, LB5200 PL6300 CONFIG, D117)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'3204518-BU', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'These are particularly useful for pallet applications and varying height/width applications', NULL, NULL, NULL, NULL);

-- W-074  data/price-page-notes.md, W-074 (PALM workbook, LB5200 PL6300 CONFIG, D120)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-074', N'PALM', N'note',
    N'Only available in the following sizes: 4x2 4x4 4x6 4x8 6x4 All available in RH and LH Also can be ordered as a field upgrade kit Buy this when color o…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D120. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-074 (PALM workbook, LB5200 PL6300 CONFIG, D120)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'881474', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Only available in the following sizes: 4x2 4x4 4x6 4x8 6x4 All available in RH and LH Also can be ordered as a field upgrade kit Buy this when color or reflectivity is an issue: Shrink Wrap, Plastic Containers, Black objects. Do not also order an Auto Retract Sensor from above. Ask AE/PSE for questions.', NULL, NULL, NULL, NULL);

-- W-075  data/price-page-notes.md, W-075 (PALM workbook, LB5200 PL6300 CONFIG, D122)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-075', N'PALM', N'note',
    N'Discrete I/O card has four (4) optically-isolated inputs and six (6) solid-state outputs. Inputs must be DC, and typical input voltage expected is 24…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D122. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-075 (PALM workbook, LB5200 PL6300 CONFIG, D122)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'5892089', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Discrete I/O card has four (4) optically-isolated inputs and six (6) solid-state outputs. Inputs must be DC, and typical input voltage expected is 24 VDC. Will accept wider range, see manual. Outputs are designed to switch AC or DC, but limited in current to 400 mA or less. See manual for details.', NULL, NULL, NULL, NULL);

-- W-076  data/price-page-notes.md, W-076 (PALM workbook, LB5200 PL6300 CONFIG, D124)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-076', N'PALM', N'note',
    N'Retro-Reflective (Break Beam Sensor). Uses reflector to trigger when a product "breaks the beam". Range = 1 inch to 10 feet. Mainly used for pallet ap…', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D124. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-076 (PALM workbook, LB5200 PL6300 CONFIG, D124)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'2391788', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Retro-Reflective (Break Beam Sensor). Uses reflector to trigger when a product "breaks the beam". Range = 1 inch to 10 feet. Mainly used for pallet applications or where shrink wrap can fool the standard diffused (4600-900) sensor. Fits standard 4600-900 hole positions.', NULL, NULL, NULL, NULL);

-- W-077  data/price-page-notes.md, W-077 (PALM workbook, LB5200 PL6300 CONFIG, D125)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-077', N'PALM', N'note',
    N'If you need label placement accuracy - you need this sensor. See manual for more information', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D125. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-077 (PALM workbook, LB5200 PL6300 CONFIG, D125)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'0716339', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'If you need label placement accuracy - you need this sensor. See manual for more information', NULL, NULL, NULL, NULL);

-- W-100  data/price-page-notes.md, W-100 (PALM workbook, LB5200 PL6300 CONFIG, C175)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-100', N'PALM', N'note',
    N'U-base or Floor Mount Stand . No Exceptions', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C175. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-100 (PALM workbook, LB5200 PL6300 CONFIG, C175)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'806998WG', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'U-base or Floor Mount Stand . No Exceptions', NULL, NULL, NULL, NULL);

-- W-102  data/price-page-notes.md, W-102 (PALM workbook, LB5200 PL6300 CONFIG, C176)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-102', N'PALM', N'note',
    N'U-base or Floor Mount Stand . No Exceptions', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C176. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-102 (PALM workbook, LB5200 PL6300 CONFIG, C176)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'551370NU', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'U-base or Floor Mount Stand . No Exceptions', NULL, NULL, NULL, NULL);

-- W-104  data/price-page-notes.md, W-104 (PALM workbook, LB5200 PL6300 CONFIG, C177)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-104', N'PALM', N'note',
    N'U-base or Floor Mount Stand . No Exceptions', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C177. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-104 (PALM workbook, LB5200 PL6300 CONFIG, C177)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'905428RS', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'U-base or Floor Mount Stand . No Exceptions', NULL, NULL, NULL, NULL);

-- W-106  data/price-page-notes.md, W-106 (PALM workbook, LB5200 PL6300 CONFIG, C178)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-106', N'PALM', N'note',
    N'U-base or Floor Mount Stand . No Exceptions', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C178. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-106 (PALM workbook, LB5200 PL6300 CONFIG, C178)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'431583XM', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'U-base or Floor Mount Stand . No Exceptions', NULL, NULL, NULL, NULL);

-- W-108  data/price-page-notes.md, W-108 (PALM workbook, LB5200 PL6300 CONFIG, C179)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-108', N'PALM', N'note',
    N'U-base or Floor Mount Stand . No Exceptions', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C179. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-108 (PALM workbook, LB5200 PL6300 CONFIG, C179)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'920848NM', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'U-base or Floor Mount Stand . No Exceptions', NULL, NULL, NULL, NULL);

-- W-110  data/price-page-notes.md, W-110 (PALM workbook, LB5200 PL6300 CONFIG, C180)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-110', N'PALM', N'note',
    N'If conveyor is on an incline, this component is required.', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, C180. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-110 (PALM workbook, LB5200 PL6300 CONFIG, C180)', N'price page comment', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'721013', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'If conveyor is on an incline, this component is required.', NULL, NULL, NULL, NULL);

-- W-115  data/price-page-notes.md, W-115 (PALM workbook, LB5200 PL6300 CONFIG, D187)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-115', N'PALM', N'note',
    N'Check with Application Engineer to see if we have made this size before- may be able to avoid engineering fee.', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D187. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-115 (PALM workbook, LB5200 PL6300 CONFIG, D187)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'7969864', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Check with Application Engineer to see if we have made this size before- may be able to avoid engineering fee.', NULL, NULL, NULL, NULL);

-- W-116  data/price-page-notes.md, W-116 (PALM workbook, LB5200 PL6300 CONFIG, D190)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-116', N'PALM', N'note',
    N'Please make sure the right amount of days are quoted including travel time for the installation.', N'Written on this part''s own row in the PALM price page, at LB5200 PL6300 CONFIG, D190. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-116 (PALM workbook, LB5200 PL6300 CONFIG, D190)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'2220075', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Please make sure the right amount of days are quoted including travel time for the installation.', NULL, NULL, NULL, NULL);

-- W-118  data/price-page-notes.md, W-118 (PALM workbook, MAINT. KITS & SPARE ENGINES, D16)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-118', N'PALM', N'note',
    N'Includes (2022-08-31 13:40:16) Idler Roller [6000-623] (Qty 2) - uses 2 per system Bearing pads [6000-624] (Qty 16) - uses 8 per system Top Plate [600…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D16. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-118 (PALM workbook, MAINT. KITS & SPARE ENGINES, D16)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'8436351', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Includes (2022-08-31 13:40:16) Idler Roller [6000-623] (Qty 2) - uses 2 per system Bearing pads [6000-624] (Qty 16) - uses 8 per system Top Plate [6000-627] (Qty 1) - uses 1 per system Clamp [6000-628] (Qty 1) - uses 1 per system Clamp Plate [6000-629] (Qty 1) - uses 1 per system Timing Belt [6000-633] (Qty 1) uses 1 per system Bumper - end of travel [6000-638] (Qty 1) uses 1 per system Bumper - home position [6150-601] (Qty 2) uses 1 per system Wave Springs [5331-002] (Qty 2) uses 2 per system', NULL, NULL, NULL, NULL);

-- W-119  data/price-page-notes.md, W-119 (PALM workbook, MAINT. KITS & SPARE ENGINES, D18)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-119', N'PALM', N'note',
    N'Includes (2022-08-31 13:40:17) Motor Drive Belt [6000-713] (Qty 1) - uses 1 per system Swing Arm Belt [6000-712](Qty 1) - uses 1 per system Shock Bump…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D18. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-119 (PALM workbook, MAINT. KITS & SPARE ENGINES, D18)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'5058533', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Includes (2022-08-31 13:40:17) Motor Drive Belt [6000-713] (Qty 1) - uses 1 per system Swing Arm Belt [6000-712](Qty 1) - uses 1 per system Shock Bumper [6170-480](Qty 1) - uses 1 per system Bumper [6150-601](Qty 2) - uses 1 per system Spring [5331-220](Qty 4) - uses 2 per system Misc fasteners', NULL, NULL, NULL, NULL);

-- W-120  data/price-page-notes.md, W-120 (PALM workbook, MAINT. KITS & SPARE ENGINES, D19)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-120', N'PALM', N'note',
    N'Includes (2022-08-31 13:40:17) ITEM PART NO. DESCRIPTION QTY. 1 5331-220 SPRING, EXTENSION, 2.25" LONG X 5/16" DIA. 3 2 5331-226 SPRING, EXTENSION, 1.…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D19. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-120 (PALM workbook, MAINT. KITS & SPARE ENGINES, D19)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'8101208', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Includes (2022-08-31 13:40:17) ITEM PART NO. DESCRIPTION QTY. 1 5331-220 SPRING, EXTENSION, 2.25" LONG X 5/16" DIA. 3 2 5331-226 SPRING, EXTENSION, 1.25" LONG X 5/16" DIA. 3 3 6170-583 ROLLER, UHMW, .25"ID, .625 OD 2 4 6170-509 FAN ASSEMBLY, WASA 1 5 6146-653 BRUSH, NYLON, 5"W X 1.5"L 1 6 6170-582 BRUSH, NYLON, 7"W X 1.5"L 1', NULL, NULL, NULL, NULL);

-- W-121  data/price-page-notes.md, W-121 (PALM workbook, MAINT. KITS & SPARE ENGINES, D26)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-121', N'PALM', N'note',
    N'R39783600 K84X PLATEN ROLLER R29176000 K84X PRESSURE ROLLER R29175000 K84X FEED ROLLER R38087200 K84X PRESSURE ASSY R39875103 GEAR BOX STD ASSY-LH…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D26. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-121 (PALM workbook, MAINT. KITS & SPARE ENGINES, D26)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'6600334', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'R39783600 K84X PLATEN ROLLER R29176000 K84X PRESSURE ROLLER R29175000 K84X FEED ROLLER R38087200 K84X PRESSURE ASSY R39875103 GEAR BOX STD ASSY-LH R39951104 GEAR BOX OPP ASSY -RH PU3256060 TIMING BELT RIBBON ROLLER P17886000 TIMING BELT RIBBON REWIND P18026010 FILTER', NULL, NULL, NULL, NULL);

-- W-122  data/price-page-notes.md, W-122 (PALM workbook, MAINT. KITS & SPARE ENGINES, D27)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-122', N'PALM', N'note',
    N'R39783600 K84X PLATEN ROLLER R29176000 K84X PRESSURE ROLLER R29175000 K84X FEED ROLLER R38087200 K84X PRESSURE ASSY R39875103 GEAR BOX STD ASSY-LH…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D27. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-122 (PALM workbook, MAINT. KITS & SPARE ENGINES, D27)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'4772100', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'R39783600 K84X PLATEN ROLLER R29176000 K84X PRESSURE ROLLER R29175000 K84X FEED ROLLER R38087200 K84X PRESSURE ASSY R39875103 GEAR BOX STD ASSY-LH R39951104 GEAR BOX OPP ASSY -RH PU3256060 TIMING BELT RIBBON ROLLER P17886000 TIMING BELT RIBBON REWIND P18026010 FILTER', NULL, NULL, NULL, NULL);

-- W-123  data/price-page-notes.md, W-123 (PALM workbook, MAINT. KITS & SPARE ENGINES, D28)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-123', N'PALM', N'note',
    N'R40127300 K86X PLATEN ROLLER R20628000 K86X PRESSURE ROLLER R20634000 K86X FEED ROLLER R38697500 K86X PRESSURE ASSY R39875103 GEAR BOX STD ASSY R3…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D28. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-123 (PALM workbook, MAINT. KITS & SPARE ENGINES, D28)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'9769382', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'R40127300 K86X PLATEN ROLLER R20628000 K86X PRESSURE ROLLER R20634000 K86X FEED ROLLER R38697500 K86X PRESSURE ASSY R39875103 GEAR BOX STD ASSY R39951104 GEAR BOX OPP ASSY PU3256060 TIMING BELT RIBBON ROLLER P17886000 TIMING BELT RIBBON REWIND P18026010 FILTER', NULL, NULL, NULL, NULL);

-- W-124  data/price-page-notes.md, W-124 (PALM workbook, MAINT. KITS & SPARE ENGINES, D30)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-124', N'PALM', N'note',
    N'Part# (2022-08-31 13:40:16) P1046696-145 Drive Belt kit 1 P1046696-146 Drive Belt Kit 1 P1046696-072 Platen Roller kit 1 P1046696-059 Pinch & Peel rol…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D30. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-124 (PALM workbook, MAINT. KITS & SPARE ENGINES, D30)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'6965521', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Part# (2022-08-31 13:40:16) P1046696-145 Drive Belt kit 1 P1046696-146 Drive Belt Kit 1 P1046696-072 Platen Roller kit 1 P1046696-059 Pinch & Peel roller 1 P1046696-109 Lower Peel Roller kit 1', NULL, NULL, NULL, NULL);

-- W-125  data/price-page-notes.md, W-125 (PALM workbook, MAINT. KITS & SPARE ENGINES, D31)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-125', N'PALM', N'note',
    N'Part# (2022-08-31 13:40:17) P1046696-145 Drive Belt kit 1 P1046696-146 Drive Belt Kit 1 P1046696-073 Platen Roller kit 1 P1046696-060 Pinch & Peel rol…', N'Written on this part''s own row in the PALM price page, at MAINT. KITS & SPARE ENGINES, D31. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-125 (PALM workbook, MAINT. KITS & SPARE ENGINES, D31)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'9435513', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Part# (2022-08-31 13:40:17) P1046696-145 Drive Belt kit 1 P1046696-146 Drive Belt Kit 1 P1046696-073 Platen Roller kit 1 P1046696-060 Pinch & Peel roller 1 P1046696-110 Lower Peel Roller kit 1', NULL, NULL, NULL, NULL);

-- W-135  data/price-page-notes.md, W-135 (TIJ workbook, TJ Thermal Jet, C53)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-135', N'TIJ', N'note',
    N'Can be used for TJ', N'Written on this part''s own row in the TIJ price page, at TJ Thermal Jet, C53. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-135 (TIJ workbook, TJ Thermal Jet, C53)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'6727115', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Can be used for TJ', NULL, NULL, NULL, NULL);

-- W-136  data/price-page-notes.md, W-136 (TIJ workbook, TJ Thermal Jet, C54)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-136', N'TIJ', N'note',
    N'Can be used for TJ', N'Written on this part''s own row in the TIJ price page, at TJ Thermal Jet, C54. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-136 (TIJ workbook, TJ Thermal Jet, C54)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'0775158', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Can be used for TJ', NULL, NULL, NULL, NULL);

-- W-137  data/price-page-notes.md, W-137 (TIJ workbook, TJ Thermal Jet, C55)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-137', N'TIJ', N'note',
    N'Floor mount pole (9611063) ordered separately.', N'Written on this part''s own row in the TIJ price page, at TJ Thermal Jet, C55. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-137 (TIJ workbook, TJ Thermal Jet, C55)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'6373621', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Floor mount pole (9611063) ordered separately.', NULL, NULL, NULL, NULL);

-- W-138  data/price-page-notes.md, W-138 (TIJ workbook, TJ Thermal Jet, C66)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-138', N'TIJ', N'note',
    N'For applications where product is difficult to sense against background. Acts like a break beam sensor, but isn''t.', N'Written on this part''s own row in the TIJ price page, at TJ Thermal Jet, C66. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-138 (TIJ workbook, TJ Thermal Jet, C66)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'2391788', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'For applications where product is difficult to sense against background. Acts like a break beam sensor, but isn''t.', NULL, NULL, NULL, NULL);

-- W-140  data/price-page-notes.md, W-140 (TIJ workbook, TJ Thermal Jet, C79)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-140', N'TIJ', N'note',
    N'Uses 45si cartridge for greater throw distance, darker print and much better decap property.', N'Written on this part''s own row in the TIJ price page, at TJ Thermal Jet, C79. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-140 (TIJ workbook, TJ Thermal Jet, C79)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'8434980', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Uses 45si cartridge for greater throw distance, darker print and much better decap property.', NULL, NULL, NULL, NULL);

-- W-143  data/price-page-notes.md, W-143 (TTO workbook, T400 Configuration, E68)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-143', N'TTO', N'note',
    N'Max 5%', N'Written on this part''s own row in the TTO price page, at T400 Configuration, E68. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-143 (TTO workbook, T400 Configuration, E68)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'896547', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Max 5%', NULL, NULL, NULL, NULL);

-- W-144  data/price-page-notes.md, W-144 (TTO workbook, T400 Configuration, E70)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-144', N'TTO', N'note',
    N'Max 5%', N'Written on this part''s own row in the TTO price page, at T400 Configuration, E70. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-144 (TTO workbook, T400 Configuration, E70)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'556974', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Max 5%', NULL, NULL, NULL, NULL);

-- W-145  data/price-page-notes.md, W-145 (TTO workbook, T400 Configuration, E79)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-145', N'TTO', N'note',
    N'Max 5%', N'Written on this part''s own row in the TTO price page, at T400 Configuration, E79. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-145 (TTO workbook, T400 Configuration, E79)', N'price page comment', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'256334', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Max 5%', NULL, NULL, NULL, NULL);

-- W-146  data/price-page-notes.md, W-146 (TTO workbook, T400 Configuration, C93)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-146', N'TTO', N'note',
    N'Part# Description Qty N.0000.00213 Tooth belt drive slide, NG 2/4 1 N.0000.00198 Module, RBN CBL (26 POLE), NG 2/4 1', N'Written on this part''s own row in the TTO price page, at T400 Configuration, C93. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-146 (TTO workbook, T400 Configuration, C93)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'158649', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Part# Description Qty N.0000.00213 Tooth belt drive slide, NG 2/4 1 N.0000.00198 Module, RBN CBL (26 POLE), NG 2/4 1', NULL, NULL, NULL, NULL);

-- W-147  data/price-page-notes.md, W-147 (TTO workbook, T400 Configuration, C95)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-147', N'TTO', N'note',
    N'Part # Description Qty N.0000.00271 Tooth Belt magazine drive NG 1 N.0000.00160 Brake Sring NG6/8 1 N.0000.00296 Felt Wheel, take-up NG2/4 2 N.0000.00…', N'Written on this part''s own row in the TTO price page, at T400 Configuration, C95. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-147 (TTO workbook, T400 Configuration, C95)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'613616', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Part # Description Qty N.0000.00271 Tooth Belt magazine drive NG 1 N.0000.00160 Brake Sring NG6/8 1 N.0000.00296 Felt Wheel, take-up NG2/4 2 N.0000.00311 Teflon Disc 3 N.0000.00632 Teflon Film, T402/4 1 3.0000.46014 Thrust Bearing BA5 2 100235 Bearing, 1224-015 1', NULL, NULL, NULL, NULL);

-- W-148  data/price-page-notes.md, W-148 (TTO workbook, T400 Configuration, C101)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-148', N'TTO', N'note',
    N'Kit contains: Part# Description Qty 3.0000.46009 WASHER TRUST BEARING AXK 1226 2 3.0000.46008 THRUST BEARING LG. NG6/8 1 N.00001.00377 TOOTHED BELT 1…', N'Written on this part''s own row in the TTO price page, at T400 Configuration, C101. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-148 (TTO workbook, T400 Configuration, C101)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'108174', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Kit contains: Part# Description Qty 3.0000.46009 WASHER TRUST BEARING AXK 1226 2 3.0000.46008 THRUST BEARING LG. NG6/8 1 N.00001.00377 TOOTHED BELT 1 N.0000.00160 Brake Spring NG6/8 1 N.0000.00502 FELT WHEEL TAKE-UP NG6/8 1 N.0000.00503 FELT WHEEL TAKE-UP NG6/8 1 N.0000.00504 TEFLN DISC(46x22x0,2mm)NG 6/8 2 N.0000.00505 TEFLON DISC(44x24x0,2mm)NG 6/8 1 N.0000.00506 TEFLON DISC 46X12X.02MM,NG6/8 1 N.0000.00403 Rd. Belt Drive Giver RingNG6E 1 3.0000.46006 THRUST BEARING AXK 0515,T408 2 3.0000.46007 WASHER FOR THRUST BEARING,NG8 4 N.0000.00376 Round blt drive giver ring NG8 1 N.0000.00093 TOOTH BELT(318 3M, 6mm) T406/8 1', NULL, NULL, NULL, NULL);

-- W-149  data/price-page-notes.md, W-149 (TTO workbook, T400 Configuration, C102)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-149', N'TTO', N'note',
    N'Kit contains: Part# Description Qty N.0000.00032 DRV BELT 1 drv.Slide 318 2M-A 1 N.0000.00033 DRV BELT 2drv. Slide 363 3M 1 N.0000.00117 ASSEMBLY RIBB…', N'Written on this part''s own row in the TTO price page, at T400 Configuration, C102. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-149 (TTO workbook, T400 Configuration, C102)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'547264', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Kit contains: Part# Description Qty N.0000.00032 DRV BELT 1 drv.Slide 318 2M-A 1 N.0000.00033 DRV BELT 2drv. Slide 363 3M 1 N.0000.00117 ASSEMBLY RIBBON CABLE NG6/8 1 N.0000.00118 MODULE 8-pole high flex cable 1 N.0000.00388 Tooth Blt 2 Dr Carriag,NG6e/8e 1 N.0000.00400 Ribbon Cable T406E/8E 1 N.0000.00401 Asm,8-way High Flex Cable 6/8E 1', NULL, NULL, NULL, NULL);

-- W-150  data/price-page-notes.md, W-150 (TTO workbook, Spares, C6)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-150', N'TTO', N'note',
    N'Part# Description Qty N.0000.00213 Tooth belt drive slide, NG 2/4 1 N.0000.00198 Module, RBN CBL (26 POLE), NG 2/4 1', N'Written on this part''s own row in the TTO price page, at Spares, C6. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-150 (TTO workbook, Spares, C6)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'158649', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Part# Description Qty N.0000.00213 Tooth belt drive slide, NG 2/4 1 N.0000.00198 Module, RBN CBL (26 POLE), NG 2/4 1', NULL, NULL, NULL, NULL);

-- W-151  data/price-page-notes.md, W-151 (TTO workbook, Spares, C8)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-151', N'TTO', N'note',
    N'Part # Description Qty N.0000.00271 Tooth Belt magazine drive NG 1 N.0000.00160 Brake Sring NG6/8 1 N.0000.00296 Felt Wheel, take-up NG2/4 2 N.0000.00…', N'Written on this part''s own row in the TTO price page, at Spares, C8. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-151 (TTO workbook, Spares, C8)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'613616', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Part # Description Qty N.0000.00271 Tooth Belt magazine drive NG 1 N.0000.00160 Brake Sring NG6/8 1 N.0000.00296 Felt Wheel, take-up NG2/4 2 N.0000.00311 Teflon Disc 3 N.0000.00632 Teflon Film, T402/4 1 3.0000.46014 Thrust Bearing BA5 2 100235 Bearing, 1224-015 1', NULL, NULL, NULL, NULL);

-- W-152  data/price-page-notes.md, W-152 (TTO workbook, Spares, C14)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-152', N'TTO', N'note',
    N'Kit contains: Part# Description Qty 3.0000.46009 WASHER TRUST BEARING AXK 1226 2 3.0000.46008 THRUST BEARING LG. NG6/8 1 N.00001.00377 TOOTHED BELT 1…', N'Written on this part''s own row in the TTO price page, at Spares, C14. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-152 (TTO workbook, Spares, C14)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'108174', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Kit contains: Part# Description Qty 3.0000.46009 WASHER TRUST BEARING AXK 1226 2 3.0000.46008 THRUST BEARING LG. NG6/8 1 N.00001.00377 TOOTHED BELT 1 N.0000.00160 Brake Spring NG6/8 1 N.0000.00502 FELT WHEEL TAKE-UP NG6/8 1 N.0000.00503 FELT WHEEL TAKE-UP NG6/8 1 N.0000.00504 TEFLN DISC(46x22x0,2mm)NG 6/8 2 N.0000.00505 TEFLON DISC(44x24x0,2mm)NG 6/8 1 N.0000.00506 TEFLON DISC 46X12X.02MM,NG6/8 1 N.0000.00403 Rd. Belt Drive Giver RingNG6E 1 3.0000.46006 THRUST BEARING AXK 0515,T408 2 3.0000.46007 WASHER FOR THRUST BEARING,NG8 4 N.0000.00376 Round blt drive giver ring NG8 1 N.0000.00093 TOOTH BELT(318 3M, 6mm) T406/8 1', NULL, NULL, NULL, NULL);

-- W-153  data/price-page-notes.md, W-153 (TTO workbook, Spares, C15)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-153', N'TTO', N'note',
    N'Kit contains: Part# Description Qty N.0000.00032 DRV BELT 1 drv.Slide 318 2M-A 1 N.0000.00033 DRV BELT 2drv. Slide 363 3M 1 N.0000.00117 ASSEMBLY RIBB…', N'Written on this part''s own row in the TTO price page, at Spares, C15. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-153 (TTO workbook, Spares, C15)', N'application engineering', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'547264', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Kit contains: Part# Description Qty N.0000.00032 DRV BELT 1 drv.Slide 318 2M-A 1 N.0000.00033 DRV BELT 2drv. Slide 363 3M 1 N.0000.00117 ASSEMBLY RIBBON CABLE NG6/8 1 N.0000.00118 MODULE 8-pole high flex cable 1 N.0000.00388 Tooth Blt 2 Dr Carriag,NG6e/8e 1 N.0000.00400 Ribbon Cable T406E/8E 1 N.0000.00401 Asm,8-way High Flex Cable 6/8E 1', NULL, NULL, NULL, NULL);

-- W-155  data/price-page-notes.md, W-155 (VIJ workbook, IV Porous, C66)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-155', N'VIJ', N'note',
    N'Includes power supply and cables.', N'Written on this part''s own row in the VIJ price page, at IV Porous, C66. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-155 (VIJ workbook, IV Porous, C66)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'0618070', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Includes power supply and cables.', NULL, NULL, NULL, NULL);

-- W-156  data/price-page-notes.md, W-156 (VIJ workbook, IV Porous, C68)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-156', N'VIJ', N'note',
    N'Needed when placing the HMI farther away from the SmartIDS than the 5'' power cable provided allows. An HMI can be placed flexibly in the work cell or…', N'Written on this part''s own row in the VIJ price page, at IV Porous, C68. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-156 (VIJ workbook, IV Porous, C68)', N'product management', N'warn', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'2791809X', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Needed when placing the HMI farther away from the SmartIDS than the 5'' power cable provided allows. An HMI can be placed flexibly in the work cell or plant but will need it''s own power supply and ethernet connection.', NULL, NULL, NULL, NULL);

-- W-157  data/price-page-notes.md, W-157 (VIJ workbook, IV Porous, C102)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-157', N'VIJ', N'note',
    N'Used for branching encoder feed to a second controller.', N'Written on this part''s own row in the VIJ price page, at IV Porous, C102. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-157 (VIJ workbook, IV Porous, C102)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'1867571', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Used for branching encoder feed to a second controller.', NULL, NULL, NULL, NULL);

-- W-159  data/price-page-notes.md, W-159 (VIJ workbook, IV Porous, C129)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-159', N'VIJ', N'note',
    N'TWP-101 is a low cost version of TWP-1 with 33% less dye which will produce a lighter mark. All other performance characteristics are the same.', N'Written on this part''s own row in the VIJ price page, at IV Porous, C129. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-159 (VIJ workbook, IV Porous, C129)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'2172460', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'TWP-101 is a low cost version of TWP-1 with 33% less dye which will produce a lighter mark. All other performance characteristics are the same.', NULL, NULL, NULL, NULL);

-- W-160  data/price-page-notes.md, W-160 (VIJ workbook, IV Porous, C130)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-160', N'VIJ', N'note',
    N'TWP-GB is specifically designed for the requirements of printing on gypsum board. Designed not to bleed when painted over.', N'Written on this part''s own row in the VIJ price page, at IV Porous, C130. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-160 (VIJ workbook, IV Porous, C130)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'4169353GH', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'TWP-GB is specifically designed for the requirements of printing on gypsum board. Designed not to bleed when painted over.', NULL, NULL, NULL, NULL);

-- W-166  data/price-page-notes.md, W-166 (VIJ workbook, IV NonPorous, C66)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-166', N'VIJ', N'note',
    N'Includes power supply and cables.', N'Written on this part''s own row in the VIJ price page, at IV NonPorous, C66. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-166 (VIJ workbook, IV NonPorous, C66)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'0618070', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'Includes power supply and cables.', NULL, NULL, NULL, NULL);

-- W-168  data/price-page-notes.md, W-168 (VIJ workbook, IV NonPorous, C125)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-168', N'VIJ', N'note',
    N'TSO-101 is a low cost version of TSO-1 with 33% less dye which will produce a lighter mark. All other performance characteristics are the same.', N'Written on this part''s own row in the VIJ price page, at IV NonPorous, C125. Shown as it was written: it is the sales guidance that used to live only in a workbook on somebody''s laptop, and paraphrasing it would lose the thing worth keeping.',
    N'data/price-page-notes.md, W-168 (VIJ workbook, IV NonPorous, C125)', N'product management', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'item', N'5601618', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'warn', NULL, NULL, NULL, NULL, NULL, NULL, N'TSO-101 is a low cost version of TSO-1 with 33% less dye which will produce a lighter mark. All other performance characteristics are the same.', NULL, NULL, NULL, NULL);

-- N-POROSITY  data/application-narrowing.md, Porosity
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'N-POROSITY', NULL, N'narrowing',
    N'A porous application is not offered non-porous ink, or the reverse.', N'Porosity is the first thing a rep establishes and it rules out most of a book. An item is removed only when it CARRIES the fact and states the other value: a Surface attribute of the opposite porosity, or, for inks and consumables, the opposite porosity in the description. A bracket has no porosity and stays. Exact on the attribute, because ''Non-porous'' contains the word ''porous'' and a looser comparison keeps precisely the inks the application rules out.',
    N'data/application-narrowing.md, Porosity', N'Quote review, application narrowing', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'porosity', N'in', N'porous,nonPorous');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'narrow', NULL, NULL, NULL, NULL, NULL, NULL, N'The application is on a {porosity} substrate, so {n} that state the opposite are not offered.', NULL, N'porosity', N'Surface', N'ink,consumable,part');

-- N-INK-COLOUR  data/application-narrowing.md, Ink colour
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'N-INK-COLOUR', NULL, N'narrowing',
    N'An application that names an ink colour is not offered the other colours.', N'Matched by word rather than by substring, so ''black ink'' means Black and Black Thermo and does not mean Sky Blue. ''Grey'' and ''gray'' are one colour spelt two ways and asking for one never denies the other. Machines are narrowed on the Color attribute because a Corvus part number is the machine already filled; no machine is denied on a word in its description, because a machine can be refilled.',
    N'data/application-narrowing.md, Ink colour', N'Quote review, application narrowing', N'info', '2026-01-01', 1, N'spec');
SET @rid = SCOPE_IDENTITY();
INSERT INTO cpq.rule_trigger (rule_id, trigger_type, item_no, item_role, prod_cat, attr_name, attr_value, profile_field, compare_op, compare_value) VALUES
  (@rid, N'profile', NULL, NULL, NULL, NULL, NULL, N'inkType', N'matchesColour', N'black,white,red,blue,green,yellow,orange,silver,brown,purple,grey,gray');
INSERT INTO cpq.rule_action (rule_id, action_type, item_no, quantity, max_discount, fit_grade, approver_role, allowance_amt, message, remedy, matcher, attribute, deny_roles) VALUES
  (@rid, N'narrow', NULL, NULL, NULL, NULL, NULL, NULL, N'The application asks for {colour}, so {n} in other colours are not offered.', NULL, N'inkColour', N'Color', N'ink,consumable,part');

GO
PRINT '---------------------------------------------------------------';
PRINT ' Seeded 315 application-fit rules from published specifications.';
PRINT '';
PRINT ' Every threshold cites the datasheet it came from. No rules exist yet';
PRINT ' for TTO, TIJ or VIJ - there is no published datasheet for them.';
PRINT '---------------------------------------------------------------';
GO
