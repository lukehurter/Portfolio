# What the item descriptions say a part needs

REPORTED: *"I added some items onto a quote that said they required another item in the
description but I don't see the item in the catalogue and it never gave a warning about
it either."*

Both halves were true, and they are separate faults.

## The warning

Thirteen catalogue rows state a requirement in their own description — `MUST INCLUDE
L6127757`, `Requires 9592660`, `Requires I/O Board 5760-392`. **Not one had a rule.**
Both engines implement the `require` action and the one-click fix that goes with it, and
across all five rule files there were zero `require` actions. The mechanism was built,
tested and never given any data, so the sentence sat in the description where only a rep
who read it and knew what it meant would act on it.

They are written as rules in `catalogue-requirements.json`, one per row, each citing the
row it came from.

## Finding the part

Three of these point at a part filed under a **different technology** from the item that
needs it:

| Item | Its technology | Requires | Filed under |
|---|---|---|---|
| `1334426` I/O Alarm Tower | VIJ | `6870691` I/O Board Kit | **PIJ** |
| `6727262` Vertical Adjustment PH Bracket | PIJ | `9592660` Single Print Head Conveyor Mounting Kit | **VIJ** |
| `5334300` Linear Adjustment PH Bracket | PIJ | `9592660` | **VIJ** |

`searchItems` filters to the quote's technology plus `ALL`, so on a VIJ quote the I/O
board the alarm tower needs is not in the list. Searching for it returns nothing, which
is what was reported. The part exists; the picker cannot see it.

The `require` action is the answer rather than a change to the filter. It hands the rep
the part number, the description and a button that adds it, so the item never has to be
found by searching — and nothing rejects a line whose technology differs from the
quote's, which was checked before these rules were written. Widening the filter instead
would put nine hundred parts from other books into every search to solve three cases.

**One of them cannot be searched for even on the right book.** `1334426`'s description
writes the part as `5760-392` and the catalogue row is `6870691`. The description is
Orbit's and is not edited here; the rule states the number that will actually find it.

## Where a requirement is stated and no part is named

Five rows state a condition rather than a part, and are written as notes rather than
requirements. Naming a part for any of these would mean choosing one, which is the thing
this tool exists not to do:

- **`830440` Quickswitch Kit 6400 RS232** — "requires i/o board". Which board is not
  stated. `6870691` is an I/O board, and it is the HR2600 controller's; assuming an 6400
  takes the same one would put a wrong part on a quote with a rule's authority behind it.
- **`553698` M12A-5pin-F Connector** — "MUST INCLUDE WITH Airvex". A pairing condition, and
  "Airvex" names a manufacturer rather than a row.
- **`669569` Tamp Arm Cover Extension** — "REQUIRED FOR 20/30" TAMP". A condition on the
  tamp size, which is not a field the quote carries.
- **`0337317` Logo Fixture for IV18** — "Requires support structure for mounting. Support
  structure may be special quoted or customer supplied." Explicitly not a catalogue part.
- **`3425425` 6420 5 year Maintenance Modules** — "Need RSM Approval, Existing only". Not
  a requirement at all: an approval, and a restriction to installed machines.

`L6127757`'s own description ends "(MUST INCLUDE)" with nothing after it. It is the other
side of the four extractor rows that name it, and needs no rule of its own.

## Keeping this true

`catalogueRequirements.test.ts` re-reads every description in `catalog.ts`, finds the ones
stating a requirement, and fails when one has neither a rule nor an entry in the list
above. A new price page that adds another "MUST INCLUDE" row cannot go unnoticed.
