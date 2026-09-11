# What the application rules out before anything is graded

The source for `narrowing-rules.json`. Like `quote-completeness.md`, these rules are
not derived from a datasheet — no datasheet says "do not offer non-porous ink for a
porous carton" — so they cite this file, and this file says where the judgement came
from and what it costs.

## Why they exist

Two things a rep says in the first sentence of an enquiry rule out most of a book
before any fit rule has an opinion.

**Porosity.** "We need to code corrugated cases" is a porous substrate. The CIJ book
holds 947 printer configurations and roughly a third of them are filled with
non-porous ink. Grading those and showing them ruled out is not help; it is 284 rows
of noise between a rep and the nine machines worth reading.

**Ink colour.** "Black date code" means Black and Black Thermo. It does not mean Sky
Blue. The same argument, at a smaller scale.

## Why it was a problem

This was written as code, in `narrowFromProfile`, and it worked. What it did not do
was say so. A machine that had been removed was simply absent — no rule code, no
citation, nothing in the panel that explains every other decision the tool makes. The
tool's whole claim is that a rep can ask "why" of anything on the screen, and here the
answer was "read the source". Measured on a porous, black-ink application:

| Book | Candidates | After narrowing | Removed, silently |
|---|---|---|---|
| CIJ printers | 947 | 663 | 284 |
| VIJ printers | 8 | 4 | 4 |
| VIJ inks and consumables | 29 | 16 | 13 |

Half the VIJ book, and nothing said why.

## Why narrowing rather than grading

The obvious fix — write them as `applicationFit` rules that grade `notRecommended` —
is wrong, and was tried first in thinking rather than in code. Two reasons:

1. **It puts the noise back.** 284 rows graded and ruled out is exactly the list the
   narrowing exists to remove. A rep scrolling past them to reach the answer is worse
   off than one who never saw them, as long as they can find out that they existed.
2. **It breaks the counts.** "VIJ says 8 good when there's only 4" was reported and
   fixed by making the book-fit counter apply the same narrowing as the list. If
   narrowing became grading, the counter would count machines the list never shows,
   and the two would disagree again in the other direction.

So the narrowing stays a filter. What changes is that it is now a **rule** — declared
in data, carrying a code, a summary, a citation and an author — and that the screen
says what it removed and offers to show it.

## The mechanism, and why the matcher is named rather than expressed

Each rule names a `matcher` instead of spelling out its comparison in trigger
primitives, because both comparisons are more particular than any primitive:

- **`porosity`** — exact on the `Surface` attribute, because "Non-porous" contains the
  word "porous" and anything looser keeps precisely the inks the application rules
  out. In descriptions the pattern is `(?<!non-)(?<!non)\bporous\b`; the lookbehind is
  the whole point.
- **`inkColour`** — by word rather than by substring, so "black" does not match
  "Black" inside "Blackcurrant" and does match "Black Thermo". "Grey" and "gray" are
  one colour spelt two ways and neither denies the other.

A `compareOp` cannot express either. Writing them as primitives would mean either a
weaker comparison or a new primitive per colour, and the first is a bug and the second
is a rule set nobody can read. The rule carries the WHAT and the WHY, which is what a
rep and an admin need; the matcher name says which comparison implements it, and the
comparisons are tested by name in `narrowing.test.ts` and held identical across both
engines by `engine-cases.json`.

## What is deliberately not narrowed

**Machines, on colour.** A printer's `Color` attribute says what ink it ships filled
with, and a machine can be refilled. Only the ink lines are denied on colour; the
printer configurations are narrowed on `Color` as an attribute because a Corvus part
number IS the filled machine, but no printer is denied on the word in its description.

**Parts that say nothing.** An item without the attribute is kept. A mounting bracket
has no Surface, and saying nothing about porosity is not the same as disagreeing about
it. Only an item that carries the attribute and states a value the application rules
out is removed.

**Anything a rep typed.** A filter a rep sets is a different thing from the application
talking, and it is applied differently: an item without the attribute fails a rep's
filter and survives the application's narrowing. The rep asked; the enquiry inferred.
