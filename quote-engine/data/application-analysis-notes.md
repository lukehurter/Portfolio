# Application analysis notes

Engineering guidance quoted from Axim's own application analysis forms, so
that rules citing it can be checked against something in this repository.

## Why this file exists

Axim publishes technical datasheets for the 6400, CSL60, PL6300, Ridgeline 3200
and ScanMark, and every rule keyed to those is cited to the PDF in
`data/sources/documents/`. TTO, TIJ and VIJ have no published datasheet in
the capture, so for a long time they had no rules at all.

They do, however, have something better than a guess. The application analysis
form a rep fills in for every TIJ and VIJ order carries Axim's own engineering
warnings in parentheses beside each question — written by the people who install
these machines, and phrased as the reasons a job goes wrong. That is exactly the
knowledge this tool is supposed to carry, and until now it existed only inside a
workbook on a laptop.

The quotes below are verbatim, including their abbreviations. They are the source
for the `A-TIJ-*` and `A-VIJ-*` rules in `application-rules.json`.

No prices appear here, and none may. The forms live alongside the price pages;
only the application guidance was taken.

## Source

`CLEAN Axim <technology> Price Pages.xlsm`, sheet `App Analysis`, the
question column and its parenthetical note. The TIJ and VIJ workbooks carry the
same sheet, and its printhead list — `IV18, IV9, IV12, IJ384E, IJ768E, TJ500,
TJ1000` — spans both impulse jet (IJ) and thermal jet (TJ) heads, which is why
the same note applies to both technologies.

The workbooks themselves are not in this repository and must not be added to it.

## Quoted guidance — TIJ and VIJ App Analysis

> Wash Down Environs?: yes/no (controllers, ink sys & PH's aren't IP rated)

The strongest statement on either form. It is not a derating, it is an absence of
any ingress rating on the controller, the ink system and the printheads alike.

> Condensation/Humidity?: yes/no (if exists to problem extent)

> Dust?: yes/no (corrugate dust or other? How severe?)

> Vibration affecting print?: yes/no (in conveyor or print head mount? Explain.)

> Air Turbulence near PH?: yes/no (Fast moving air at PH can adversely affect
> print quality in hi-res applications (IJ & TJ). It can also carry ink vapor to
> accumulate on surroundings.)

Two distinct consequences from one condition: print quality, and ink vapour
settling on everything around the head.

> Guide Rails or other product positioning?: Yes/No (Describe. Distance from
> product to PH is critical for quality hi-res print)

> Belt type?: Smooth, seamless or seamed, segmented…etc. (seamed or textured
> belts can affect print quality if encoder is impaired by belt irregularities.)

Belt type has no field on the application profile, so no rule reads it. It is
recorded here because it is a real cause of poor print and belongs in whatever
captures conveyor detail next.

## What is still missing

TTO's own application sheet (`CUSTOMER & CAE INFO`) carries no parenthetical
engineering notes and no figures. TTO is not without rules, though: the captured
product pages under `data/sources/pages/` carry specification tables for
the T400 series and the T800, and those are what the `A-TTO-*` rules cite. Going
looking for a datasheet PDF and concluding the technology was undocumented was a
mistake — the capture had it.

The same applies to TIJ, whose figures are on the `tj500-thermal-jet-printhead`
and `tj1000-thermal-jet-printhead` pages. Its published print heads — `1/2"` and
`1"` — are exactly the `HP 0.5"` and `HP 1.0"` the hierarchy names, so the two
sources agree without any guessing in between.

Still genuinely absent:

- **The rest of the TTO range.** `T200`, `NX Series`, `SST Series`, `LT Series`,
  `TP Series` and `TP4100` appear in the hierarchy with no captured page. The
  `A-TTO-*` rules that key on a model use `T400`, so they do not touch these.
- **Belt type**, which the form warns about and no profile field holds.
- **The T402+ versus T404+ distinction.** The hierarchy files every one of them
  under a single Product Type of `T400 Series`, so a rule cannot tell a 53 mm
  thermal bar from a 107 mm one. `A-TTO-BAR-53` is a caveat rather than a refusal
  for exactly that reason, and it would become a refusal if the hierarchy ever
  distinguished them.
