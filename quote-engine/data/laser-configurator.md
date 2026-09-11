# The laser is configured, not picked

Why the LSR machine list is empty, what the configurator workbook actually holds, and
what building it here would take. Written 2026-08-07 after reading
`CLEAN Axim Laser System Configurator 2025 REV B May 30 2025.xlsx`.

## A third answer, from 8 August

**The laser machines exist.** The product hierarchy holds 144 configured laser part
numbers, all `quotable`, all classified `printer` — CSL30 ×36, CSL10 ×24, CSL60 ×10,
IP65 variants of each, and the SL legacy family. `L361E62XBX3XXUSAXX` is a CSL60, in the
same positional format the configurator assembles.

They are absent from the preview catalogue for a reason that has nothing to do with
lasers: the catalogue is built from the parts the price pages quote, and 17,858 hierarchy
parts are not in it. The laser is simply the only technology where that exclusion removes
every machine.

So the sentence below — "there is nothing to put in a list" — is wrong, and this is what
is actually true: there is a list, and it cannot be read yet. Those 144 rows carry a
part number, a model and a product class, and **no description**; the hierarchy has no
description column. A machine list built from them today would be 36 rows all reading
"CSL30 laser", distinguishable only by a part number whose meaning is in the configurator.

Which makes the decode the whole job, and it is now the only thing between a rep and a
laser quote:

1. Extract `Lists and data` into option groups — list type, code, description, and which
   position of the part number it fills.
2. Decode the 144 hierarchy part numbers against those groups, giving each a real
   description: "CSL60, 60W, 10.2μm, IP65, 90° head".
3. Include hierarchy printers in the preview catalogue for any technology whose price
   pages quote no machine, which today means the laser alone. The general case is 5,192
   unpriced hierarchy printers across all seven technologies, so this has to stay a
   targeted rule and not become "include everything".

Four laser spec sheets arrived the same day and are in `Datasheets/`. They carry the
figures rules need — 2,952 ft/min, 41–104°F on the CSL, 50–104°F on the fiber, IP54 with
IP65 optional, the substrates each is meant for. Those rules are not written yet, because
until step 3 there is no laser for them to grade and a rule that cannot fire is worse
than no rule.

## The two earlier answers, both wrong

**"The laser has no machines because the extract missed them."** That was my reading
when the TIJ and VIJ sheets turned out to be unharvested. It is not true of the laser:
its rows were harvested. The `CORVUS CSL Configuration` and `CORVUS FSL Configuration`
sheets contributed 82 rows, and every machine row on them says *"THIS WILL BE PROVIDED
BY PSE and/or AE"* — a placeholder for a person, which the extractor correctly dropped
as an instruction rather than a part.

**"So the laser is quoted by an application engineer, off-catalogue."** Also not the
whole truth, and it is what the app currently tells the rep. There is a workbook that
does the configuring, and it is systematic rather than a matter of judgement.

## What the configurator is

Two sheets of pull-downs — `CSL Configurator` for the CO2 scribing lasers, `FSLX0
Configurator` for the fiber lasers — that assemble one part number out of positional
option codes, and a `Lists and data` sheet of 564 rows holding the options.

The assembled result is a single string with a description beside it:

    L465E651BXABFUSAXX      Laser, 60W, 10.2um, IP54

Read across row 3 and 4 of the sheet, each character position is a choice: `L` `465`
`E` `65` `1` `B` `X` `A` `BF`. Wavelength, power, enclosure rating, marking head, lens,
country. There is no list of finished lasers because the combinations are the product.

It also carries its own rules, on the sheet, as warnings under the pull-downs:

- "IP65 versions require fibre-coupled marking head"
- "Marking head not compatible with …"

Those are `excludes` and `requires` rules in this tool's vocabulary, keyed on option
codes rather than part numbers.

## Why it is not built yet

Everything else in this tool quotes a part somebody can look up. A configured part
number is a different shape of problem:

- The catalogue has no row to point at until the options are chosen, so the machine
  list, the fit rules and the price lookup all have nothing to key on.
- `cpq.quote_line.item_no` expects a Orbit part. A configured laser is a part number
  that may not exist in Orbit until it is ordered, which is a question for whoever
  owns item creation, not something to invent here.
- The option lists carry prices per option in three yearly columns
  (`2021 DLP 1.47% Increase`, `2021 DLP 1% Increase`, `2020 DLP`). Which column is
  current is not something this file can decide, and the price has to come from Orbit
  anyway.

## What building it would take

1. Extract `Lists and data` into option groups: list type, code, description, and
   which position in the part number it fills.
2. A configurator step in the builder — the same shape as the machine step, but
   choosing option by option with the assembled part number shown as it grows.
3. The warnings on the sheet become ordinary rules with `sourceRef` pointing here, so
   an incompatible marking head is caught by the engine rather than by reading a note.
4. A decision from somebody who owns Orbit item creation about what
   `quote_line.item_no` holds for a configured laser.

Steps 1 to 3 are ordinary work. Step 4 is the one that needs an answer first, which is
why the honest thing on screen today is to say the laser is configured and name the
workbook, rather than either hiding the technology or pretending a list exists.
