# What makes a quote complete, and what makes it redundant

The source for `structure-rules.json`. These rules are not derived from a datasheet
— no datasheet says how many poles a customer needs — so they cite this file
instead, and this file says where the judgement came from.

## Why they exist

Two things went through the tool in silence.

**A printer on its own.** A quote could carry one machine and nothing else and
raise no comment. In practice a coder needs something to hold it, something to
print with, and usually somebody to install it. The tool knew the roles of every
part on the quote and never once asked what was missing.

**Every alternative at once.** The CIJ book lists seven printhead-stand poles of
different lengths and five printhead brackets for different mounts. Adding all of
them priced happily. They are a choice, not a kit.

## The mechanism, and why it is a rule and not code

Both are expressed with rule primitives so they are editable in the admin screen
rather than compiled in:

- `role` + `compareOp: ne` engages when **nothing** on the quote has that role.
  ANDed with a plain `role` trigger it says "a printer is quoted, and no accessory
  is" — the shape no trigger could express before.
- `pickOne` is the mirror of `requireOneOf`: that one speaks up when none of a set
  is quoted, this one when more than one is.

Neither blocks. A rep may have a reason to quote two poles — two lines, two heads,
a spare — and a tool that refuses would be wrong more often than the rep. They are
`warn` and `info`; the rep decides.

## The alternative families, and how they were identified

From the catalogue's own descriptions, not from a guess about what goes together:

| Family | Parts | Why they are alternatives |
|---|---|---|
| Stand pole | 797711, 380413, 774936, 559427, 091570, RG28566, EH98306 | 12", 23", 36", 60", 72", 1.0 m, 0.5 m — one length of the same pole |
| Printhead bracket | YD40176, ZF24718, HB41301, LY03715, CR23741 | T-base, cabinet, conveyor, pole, cart — one way of mounting one head |
| Alarm beacon | 0108032QBE7, 9016210GKV2NAP, 8661724HQT5, 2052759BRV7ZAG | single or multistage, audible or not — one alarm |

Only CIJ families are listed. The same shape exists in the other books and the
parts have not been read carefully enough to name them yet; a wrong family would
question a correct quote, which costs more trust than the silence it replaces.

## What is deliberately not here

No rule about *quantity* within a family — two of the same pole is a two-head line,
not a mistake. No rule about unrelated parts in general: "unrelated" needs a
statement of what relates to what, and the honest version of that is the
requires-rules already recovered from the price pages, not a similarity score.

## A CIJ needs ink and solvent, and they are different roles

A pre-configured 7300 starter package, supplied 21 August 2026:

| Slot | Qty | Part | Description |
|---|---|---|---|
| Printer | 1 | K410-U0-17-CVS | 7300 IP55 PH4 MIDI 2M |
| Printhead stand | 1 | YD40176 | PH MTG ASSY FLOOR MNT MOBILE |
| Photo eye / trigger | 1 | 0210879 | P/C EZPRO CIJ "D" KIT |
| Trolley | 1 | FA62102 | TROLLEY, W/ WHEELS, SS |
| Startup ink (3103 black) | 1 | JZT1227/6E | INK,3103 5L IN (10) 0.5L CART |
| Startup solvent | 1 | ZHC8871/8H | SOLVENT,3501 5L IN 1L CART. |
| Cleaning fluid | 1 | EG02464/E | CORVUS CLEANING FLUID 0305 EZ PK |

Ink, solvent and cleaning fluid are three separate lines. The tool was checking for
one of them and describing the other.

`Q-BARE-CONSUMABLE-CIJ` triggered on the role `consumable` and said "nothing to print
with". Ink carries the role `ink`, so the rule was named after the one thing it could
not see. Run against the package, the result was wrong in both directions:

| Quote | What the tool said |
|---|---|
| printer + ink | "nothing to print with" — the ink is on it |
| printer + solvent | nothing — and this is the incomplete one |

So it is two rules, each asking about the role it means: `Q-BARE-INK-CIJ` for the ink
and `Q-BARE-CONSUMABLE-CIJ`, reworded, for the solvent and cleaning fluid.

**Five of the seven parts are already in the catalogue** — YD40176, 0210879,
JZT1227/6E, ZHC8871/8H and EG02464/E, all classified CIJ. The printer is not, because
no price page carries the 7300 series yet. Neither is **FA62102**, the trolley, which
is a gap in the catalogue rather than in the series: it is an accessory that ought to
be quotable today and cannot be found.
