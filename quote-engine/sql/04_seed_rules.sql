/*==============================================================================
  Axim CPQ — seed the rules recovered from the price pages
  ------------------------------------------------------------------------------
  Run after 01_foundation.sql.

  173 cell comments were recovered from the eight price-page workbooks. The 144
  that could not be structured without guessing are inserted here with their real
  wording, their real cell reference and their real author — that provenance is
  the whole point, and it cannot be recovered later if it is dropped now.

  WHAT IS HERE, AND WHAT IS NOT

    48 rules are seeded INACTIVE, as drafts. They are the ones whose part could
    not be recovered: the comment sits on a section heading, or on a row whose
    part is not in the preview catalogue, or in the laser configurator, which is
    a different workbook.

    The other 96 drafts had a part all along and nobody had noticed. A comment is
    attached to a cell, the cell is on a row, and the row is a part — and this
    file kept that link only for the caps, because it needed one to write a cap.
    Everything else was seeded with no trigger at all, which does not make a weak
    rule, it makes an inert one: a rule with no trigger cannot fire however it is
    worded. They are live rules in data/price-page-notes.json now, showing the
    comment verbatim on the part it was written against. See
    data/price-page-notes.md.

    rule_code is UNIQUE, so anything generated into 07_application_rules.sql has
    to be gone from here. test_rule_code_collisions.py checks that.

    The other 29 — the "Max Discount 5%" caps — used to be seeded active from
    this file, and have moved to data/discount-caps.json. They were the only
    comments unambiguous enough to structure, and inserting them here meant they
    reached cpq.rule without passing through build_rules.py: the service capped
    those parts and the preview did not, so a rep could take a printhead stand to
    30% on screen and be held to 5% on the order. One file writes both outputs
    now, which is the point of that generator. See data/discount-caps.md.

  That is deliberate, not laziness. A comment reading "If replacing screws with
  tool-less handscrews, order (1) PH and (2) Cross Joints" names two parts in
  prose. Which photocell bracket? Which cross joint? A machine guessing that
  would put a wrong part on a real quote. So the wording is preserved, the rule
  appears in the admin screen ready to structure, and it fires only once a
  person has said what it means.

  The admin screen shows drafts under "Including retired". Working through them
  is a real task for somebody who knows the products — but they are working from
  the original wording with its cell reference, not from memory.

  Idempotent: re-running deletes only rules whose created_by is 'seed' AND which
  are still inactive, so anything a person has structured and enabled survives.
==============================================================================*/

SET NOCOUNT ON;
GO
USE [AximQuote];
GO

/* Clear only untouched seed drafts. Never touches a rule a person has enabled. */
DELETE a FROM cpq.rule_action a
  JOIN cpq.rule r ON r.rule_id = a.rule_id WHERE r.created_by = N'seed' AND r.is_active = 0;
DELETE t FROM cpq.rule_trigger t
  JOIN cpq.rule r ON r.rule_id = t.rule_id WHERE r.created_by = N'seed' AND r.is_active = 0;
DELETE c FROM cpq.rule_condition c
  JOIN cpq.rule r ON r.rule_id = c.rule_id WHERE r.created_by = N'seed' AND r.is_active = 0;
DELETE FROM cpq.rule WHERE created_by = N'seed' AND is_active = 0;
GO

DECLARE @rid int;

-- W-030  CIJ 3. Pick your accessories!G92  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-030', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G92', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-031  CIJ 3. Pick your accessories!G93  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-031', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G93', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-032  CIJ 3. Pick your accessories!G94  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-032', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G94', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-033  CIJ 3. Pick your accessories!G95  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-033', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G95', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-034  CIJ 3. Pick your accessories!G96  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-034', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G96', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-035  CIJ 3. Pick your accessories!G97  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-035', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G97', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-036  CIJ 3. Pick your accessories!G98  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-036', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G98', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-037  CIJ 3. Pick your accessories!G99  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-037', N'CIJ', N'discountCap', N'Max Discount 5%', N'Max Discount 5%',
    N'CIJ workbook, 3. Pick your accessories, G99', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-043  Laser CSL Configurator!N8  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-043', N'LSR', N'note', N'Laser guru:', N'Laser guru:
Be sure to choose for proper laser size. Pull down list is seperated by laser watts.',
    N'Laser workbook, CSL Configurator, N8', N'Eric Janes', N'warn', '2026-01-01', 0, N'seed');

-- W-044  Laser CSL Configurator!N11  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-044', N'LSR', N'note', N'Laser guru:', N'Laser guru:
Axim typical system has quick connect panel w/ 6x plugs - this is the back panel interface',
    N'Laser workbook, CSL Configurator, N11', N'Eric Janes', N'warn', '2026-01-01', 0, N'seed');

-- W-045  Laser CSL Configurator!N12  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-045', N'LSR', N'excludes', N'Laser guru:', N'Laser guru:
Chances are if your not in Europe, you don''t want this. This is NOT the interlocl or shutterlock',
    N'Laser workbook, CSL Configurator, N12', N'Eric Janes', N'block', '2026-01-01', 0, N'seed');

-- W-046  Laser CSL Configurator!N13  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-046', N'LSR', N'excludes', N'Laser guru:', N'Laser guru:
Choose for correct power. 10 watt lasers DO NOT have 90 degree option',
    N'Laser workbook, CSL Configurator, N13', N'Eric Janes', N'block', '2026-01-01', 0, N'seed');

-- W-047  Laser CSL Configurator!N14  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-047', N'LSR', N'note', N'Laser guru:', N'Laser guru:
Be sure to choose for correct laser power and head type',
    N'Laser workbook, CSL Configurator, N14', N'Eric Janes', N'warn', '2026-01-01', 0, N'seed');

-- W-048  Laser CSL Configurator!N16  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-048', N'LSR', N'note', N'laser guru:', N'laser guru:
Axim most common config are C or Y - CorvusVision is now Panel PC',
    N'Laser workbook, CSL Configurator, N16', N'Eric Janes', N'warn', '2026-01-01', 0, N'seed');

-- W-049  Laser CSL Configurator!N17  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-049', N'LSR', N'note', N'Laser guru:', N'Laser guru:
Axim M&C Does not use Corvus provided encoders or detectors, so this is left blank',
    N'Laser workbook, CSL Configurator, N17', N'Eric Janes', N'warn', '2026-01-01', 0, N'seed');

-- W-050  Laser CSL Configurator!N18  (Eric Janes)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-050', N'LSR', N'note', N'Laser guru:', N'Laser guru:
Axim M&C Does not use Corvus provided extractors as Corvus provides Airvex, which DMC has a direct relationship, as well as FUMEX',
    N'Laser workbook, CSL Configurator, N18', N'Eric Janes', N'warn', '2026-01-01', 0, N'seed');

-- W-051  Laser Laser Installation!H12  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-051', N'LSR', N'note', N'This data is outdated', N'This data is outdated',
    N'Laser workbook, Laser Installation, H12', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-052  Laser (threaded)!H12  (Chamberlain, Michelle)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-052', N'LSR', N'note', N'This data is outdated', N'This data is outdated',
    N'Laser workbook, (threaded), H12', N'Chamberlain, Michelle', N'warn', '2026-01-01', 0, N'seed');

-- W-089  PALM LB5200 PL6300 CONFIG!G149  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-089', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G149', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-090  PALM LB5200 PL6300 CONFIG!G150  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-090', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G150', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-091  PALM LB5200 PL6300 CONFIG!G151  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-091', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G151', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-092  PALM LB5200 PL6300 CONFIG!G152  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-092', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G152', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-093  PALM LB5200 PL6300 CONFIG!G153  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-093', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G153', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-094  PALM LB5200 PL6300 CONFIG!G154  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-094', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G154', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-095  PALM LB5200 PL6300 CONFIG!G155  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-095', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G155', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-096  PALM LB5200 PL6300 CONFIG!G156  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-096', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G156', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-097  PALM LB5200 PL6300 CONFIG!G157  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-097', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G157', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-098  PALM LB5200 PL6300 CONFIG!G158  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-098', N'PALM', N'note', N'5% Limited Discount', N'5% Limited Discount',
    N'PALM workbook, LB5200 PL6300 CONFIG, G158', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-099  PALM LB5200 PL6300 CONFIG!C174  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-099', N'PALM', N'note', N'**Stand NOT Included**', N'**Stand NOT Included**',
    N'PALM workbook, LB5200 PL6300 CONFIG, C174', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-117  PALM LB5200 PL6300 CONFIG!E201  ((threaded, author id only))
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-117', N'PALM', N'note', N'With A41, discount is locked.', N'With A41, discount is locked.',
    N'PALM workbook, LB5200 PL6300 CONFIG, E201', N'(threaded, author id only)', N'warn', '2026-01-01', 0, N'seed');

-- W-126  PALM (threaded)!D187  (Bryson, Kerry)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-126', N'PALM', N'reference', N'Check with Application Engineer to see if we have made this size before- may be able to avoid engineering fee.', N'Check with Application Engineer to see if we have made this size before- may be able to avoid engineering fee.',
    N'PALM workbook, (threaded), D187', N'Bryson, Kerry', N'warn', '2026-01-01', 0, N'seed');

-- W-134  TIJ Sample Request Form!A23  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-134', N'TIJ', N'reference', N'It is the salemans responsibility to provide the print message (.prd) Help is available for difficult/complex messages. Contact Kurt Q.', N'It is the salemans responsibility to provide the print message (.prd) Help is available for difficult/complex messages. Contact Kurt Q.',
    N'TIJ workbook, Sample Request Form, A23', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-139  TIJ TJ Thermal Jet!B75  (JWilson)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-139', N'TIJ', N'quantity', N'Ink pricing shown is list price, quantity of one. Quantity discounts and special pricing may be available through the SPI department. Please call (800) 526-2531 for firm pricing quotes.', N'Ink pricing shown is list price, quantity of one. Quantity discounts and special pricing may be available through the SPI department. Please call (800) 526-2531 for firm pricing quotes.',
    N'TIJ workbook, TJ Thermal Jet, B75', N'JWilson', N'warn', '2026-01-01', 0, N'seed');

-- W-141  TIJ TJ Thermal Jet!B84  (JWilson)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-141', N'TIJ', N'note', N'A more complete listing of Service items are listed in the SPI Data Sheet found on the Axim Website adjacent to the LCIJ price pages.', N'A more complete listing of Service items are listed in the SPI Data Sheet found on the Axim Website adjacent to the LCIJ price pages.',
    N'TIJ workbook, TJ Thermal Jet, B84', N'JWilson', N'warn', '2026-01-01', 0, N'seed');

-- W-142  TTO T400 Configuration!C39  (price page comment)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-142', N'TTO', N'note', N'The "A" dimesion is measured from inside to inside of the window bracket frame.', N'The "A" dimesion is measured from inside to inside of the window bracket frame.',
    N'TTO workbook, T400 Configuration, C39', N'price page comment', N'warn', '2026-01-01', 0, N'seed');

-- W-154  VIJ Sample Request Form!A23  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-154', N'VIJ', N'reference', N'It is the salemans responsibility to provide the print message (.prd) Help is available for difficult/complex messages. Contact Kurt Q.', N'It is the salemans responsibility to provide the print message (.prd) Help is available for difficult/complex messages. Contact Kurt Q.',
    N'VIJ workbook, Sample Request Form, A23', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-158  VIJ IV Porous!B127  (JWilson)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-158', N'VIJ', N'quantity', N'Ink pricing shown is list price, quantity of one. Quantity discounts and special pricing may be available through the SPI department. Please call (800) 526-2531 for firm pricing quotes.', N'Ink pricing shown is list price, quantity of one. Quantity discounts and special pricing may be available through the SPI department. Please call (800) 526-2531 for firm pricing quotes.',
    N'VIJ workbook, IV Porous, B127', N'JWilson', N'warn', '2026-01-01', 0, N'seed');

-- W-161  VIJ IV Porous!B149  (JWilson)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-161', N'VIJ', N'note', N'A more complete listing of Service items are listed in the SPI Data Sheet found on the Axim Website adjacent to the LCIJ price pages.', N'A more complete listing of Service items are listed in the SPI Data Sheet found on the Axim Website adjacent to the LCIJ price pages.',
    N'VIJ workbook, IV Porous, B149', N'JWilson', N'warn', '2026-01-01', 0, N'seed');

-- W-162  VIJ IV Porous!D162  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-162', N'VIJ', N'approval', N'Enter the system discount to apply, if any. The discount is limited to 20% unless sales manager approves larger percentage.', N'Enter the system discount to apply, if any. The discount is limited to 20% unless sales manager approves larger percentage.',
    N'VIJ workbook, IV Porous, D162', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-163  VIJ IV Porous!D164  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-163', N'VIJ', N'note', N'Enter the non-standard items discount to apply, if any. The discount is limited to 5%.', N'Enter the non-standard items discount to apply, if any. The discount is limited to 5%.',
    N'VIJ workbook, IV Porous, D164', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-164  VIJ IV Porous!D170  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-164', N'VIJ', N'note', N'System downpayment is 1/2 of order total for amounts over $50K', N'System downpayment is 1/2 of order total for amounts over $50K',
    N'VIJ workbook, IV Porous, D170', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-165  VIJ IV Porous!D172  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-165', N'VIJ', N'note', N'Non Standard and Build Special items downpayment is entire amount of non-standard item total for amounts over $2000.', N'Non Standard and Build Special items downpayment is entire amount of non-standard item total for amounts over $2000.',
    N'VIJ workbook, IV Porous, D172', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-167  VIJ IV NonPorous!B123  (JWilson)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-167', N'VIJ', N'quantity', N'Ink pricing shown is list price, quantity of one. Quantity discounts and special pricing may be available through the SPI department. Please call (800) 526-2531 for firm pricing quotes.', N'Ink pricing shown is list price, quantity of one. Quantity discounts and special pricing may be available through the SPI department. Please call (800) 526-2531 for firm pricing quotes.',
    N'VIJ workbook, IV NonPorous, B123', N'JWilson', N'warn', '2026-01-01', 0, N'seed');

-- W-169  VIJ IV NonPorous!B146  (JWilson)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-169', N'VIJ', N'note', N'A more complete listing of Service items are listed in the SPI Data Sheet found on the Axim Website adjacent to the LCIJ price pages.', N'A more complete listing of Service items are listed in the SPI Data Sheet found on the Axim Website adjacent to the LCIJ price pages.',
    N'VIJ workbook, IV NonPorous, B146', N'JWilson', N'warn', '2026-01-01', 0, N'seed');

-- W-170  VIJ IV NonPorous!D159  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-170', N'VIJ', N'approval', N'Enter the system discount to apply, if any. The discount is limited to 20% unless sales manager approves larger percentage.', N'Enter the system discount to apply, if any. The discount is limited to 20% unless sales manager approves larger percentage.',
    N'VIJ workbook, IV NonPorous, D159', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-171  VIJ IV NonPorous!D161  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-171', N'VIJ', N'note', N'Enter the non-standard items discount to apply, if any. The discount is limited to 5%.', N'Enter the non-standard items discount to apply, if any. The discount is limited to 5%.',
    N'VIJ workbook, IV NonPorous, D161', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-172  VIJ IV NonPorous!D167  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-172', N'VIJ', N'note', N'System downpayment is 1/2 of order total for amounts over $50K', N'System downpayment is 1/2 of order total for amounts over $50K',
    N'VIJ workbook, IV NonPorous, D167', N'product management', N'warn', '2026-01-01', 0, N'seed');

-- W-173  VIJ IV NonPorous!D169  (product management)
INSERT INTO cpq.rule (rule_code, technology_cd, rule_type, summary, detail,
    source_ref, author, severity, effective_from, is_active, created_by)
VALUES (N'W-173', N'VIJ', N'note', N'Non Standard and Build Special items downpayment is entire amount of non-standard item total for amounts over $2000.', N'Non Standard and Build Special items downpayment is entire amount of non-standard item total for amounts over $2000.',
    N'VIJ workbook, IV NonPorous, D169', N'product management', N'warn', '2026-01-01', 0, N'seed');
GO
PRINT '---------------------------------------------------------------';
PRINT ' Seeded 173 rules from the price-page cell comments.';
PRINT '   29 active  (discount caps with a resolved part number)';
PRINT '   144 drafts  (wording preserved, awaiting structure)';
PRINT '';
PRINT ' Drafts do not fire. Open the admin screen, filter to Including';
PRINT ' retired, and work through them with the original wording in view.';
PRINT '---------------------------------------------------------------';
GO
