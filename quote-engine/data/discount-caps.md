# Discount ceilings written on the price pages

28 parts carry **"Max Discount 5%"** in the discount column of their own row on a
Axim price page. Those notes are in `discount-caps.json` as rules, one per part.

## Why these and not the other 144

173 cell comments were recovered from the eight price-page workbooks. These were the
only ones that could be turned into a rule without anybody guessing: the comment sits in
a discount column, on a row whose part number resolves, and says a number. Both halves —
what it applies to and what it does — come off the page.

The other 144 do not. *"If replacing screws with tool-less handscrews, order (1) PH and
(2) Cross Joints"* names two parts in prose and no part number. They are seeded as
inactive drafts by `sql/04_seed_rules.sql` with their real wording and their real cell
reference, and they fire only once somebody who knows the products has said what they
mean.

## Why they moved here

They were inserted straight into `cpq.rule` by `04_seed_rules.sql` and never went
through `build_rules.py`. Both engines read a cap off a rule action, so the effect was
that **the service capped these parts and the preview did not** — a rep could take a
printhead stand to 30% on screen, send the quote, and be held to 5% on the order.

Twenty-eight of them are printhead stands, poles, mounting kits and integration cabling:
exactly the accessories a rep discounts to close a system sale. Generating them here puts
the same ceiling in front of the rep and on the order, which is the whole reason one file
writes both outputs.

## The provenance

Every rule keeps its original `W-###` code, so the chain back to the workbook cell is
unbroken. The `sourceRef` names the cell: `W-001 (CIJ workbook, 3. Pick your accessories,
G28)`. All 28 are price page comment's, all at 5%, across the CIJ and PIJ books.

`559427` — the 60" printhead stand pole — carries the same note on two rows, G38 and G60.
It is one rule naming both cells rather than two rules saying the same thing about the
same part.

## What this does not cover

`cpq.item_discount_cap` is a denormalised table `04_seed_rules.sql` also writes. Nothing
evaluates it — both engines read the cap from the rule action — so it is a convenience
index, not a second source of truth. It is left alone.

The category ceilings (`system` 30%, `accessories` 18%, `customs` 5%) are a different
mechanism entirely: they come from `cpq.discount_category` and apply to everything in the
category. An item cap is tighter than its category and wins.
