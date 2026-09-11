# From notecards to an ERP

**Katalyst Surgical, later a ZEISS company · Apr 2021 – Mar 2025 ·
Chesterfield, MO**

Most ERP implementations on a CV had a project team, a budget and an integrator
behind them. This one was two people, in a regulated medical device business
that couldn't compromise on traceability, alongside the purchasing job one of
us was hired to do.

A surgical instrument manufacturer counting inventory on index cards. Four
years later it ran on an ERP I selected, implemented and administered across
five departments, carrying about half the inventory it started with: **$9M of
working capital identified, about $6M of it realized**, with availability held
the whole way.

I was hired as a purchasing assistant.

---

## How I ended up running it

The purchaser I worked under left and I took her desk: purchasing, kitting and
receiving for the neurological forceps line. More purchasers left over the
following months and I absorbed those too, then hired and trained their
replacements, then hired the people who took back the receiving and kitting I'd
been covering myself.

Then ZEISS acquired us. The new CFO was on site his first day. He's German, I
speak some and have spent time there, so I asked him to lunch. Half of that was
being friendly. The other half was that the person who has just bought your
company is worth asking what it needs.

I told him we needed an ERP. He agreed, and put me in charge of it.

## What I walked into

Inventory on notecards, counted by hand and typed into a spreadsheet
afterwards. Planning in Excel, a separate file per department, each built by
the people who used it. Two departments planning the same part could reach two
defensible answers, and neither could see the other. Bills of material as
separate Excel and Word files, one per assembly, with no way to get anything out
of them except by opening each one and retyping it. QuickBooks for finance and
nothing else. All of it in a regulated business, so every part lot-tracked, serials
where they apply, and traceability nobody gets to negotiate.

I had one other person, hired for data entry. Then we started reading the bills
of material.

Thousands of BOMs and drawings, and once anybody compared the two there were
discrepancies everywhere: parts that had drifted from the drawing, quantities
that disagreed, revisions nobody had carried through. You can't import that. A
wrong BOM in an MRP engine multiplies the problem instead of preserving it,
because every explosion downstream inherits the error and the output looks as
trustworthy as the right answer.

So he became engineering change management, and the data-gathering scope blew
apart. Selection, the stakeholder case, configuration, migration, validation,
go-live and training stayed mine, alongside still running purchasing.

## The choices, and what each cost

**Fishbowl.** I researched the options and presented the best of them. I should
be straight that it was also where the business had been leaning before I
started. I validated a direction that already existed and built the case for
it. It fit the two binding constraints: lot and serial tracking at item level,
and QuickBooks integration so finance kept their system. What it cost was
planning quality. Its MRP ran, but on a usage basis I had no way to change,
which I only understood once we were live, and replacing it became a second
project.

**Keeping QuickBooks.** Integrating instead of replacing kept finance on side
and took a whole department's change management off the critical path. The
price is one system of record: two places a number can live, and a
reconciliation that has to keep working. It bought something I hadn't planned
for, though. Getting the integration right meant learning how finance worked,
not just which fields they needed, and finance became my second stakeholder
after supply chain. They're the people who decide whether an inventory number
gets believed.

**Traceability configured per part, before go-live.** Lot, serial or neither,
decided item by item instead of switched on in one sweep. In most
implementations you ship something thin and add rigour later; a lot number
untracked from day one is a gap in a regulated record. Getting that per-part
decision right across a full item master is also where it went wrong.

## Validating it

ZEISS has a validation standard for any system touching a regulated process,
and I ran ours to it on my own: risk analysis first, then test protocols
written against the risks, executed with screenshots kept as evidence, and the
results recorded. Nobody at the site had done one before and there was nobody
to hand it to.

I ran that protocol and the go-live still broke. Both failures below sat
outside what a protocol looks at. One was configuration assembled from what
people remembered, the other was a cost basis the vendor told us to use. A
protocol proves the system does what the specification says, and neither
failure was a defect in the specification.

## The day it broke

Two things went wrong on import. Only one was fixable in place.

**Wrong tracking configuration.** Some parts came in with lot tracking they
didn't need, some needed it and didn't have it. The transaction a user was
trying to post wouldn't post, and the person hitting it had no way to tell
whether the problem was them or the system. Annoying, embarrassing, correctable
part by part.

Underneath it was something I didn't expect. Nobody had ever written down which
parts required lot, serial or expiration tracking. The requirements were real
and the business followed them, but they lived in people's heads. There was no
list to migrate from, so we assembled the configuration out of what individuals
believed, and where two people believed different things the import picked one.
That's the ordinary condition of a business moving off notecards, and no
implementation plan budgets for it.

**Wrong costs, loaded into average costing.**

The costs went in following the exact instructions given by a Fishbowl
representative, and those instructions were vague about what the values meant
in our context. I did what the vendor said and the vendor was wrong, or at
least not right enough. The consequence landed on me either way, so I keep the
lesson instead of the grievance: the person on the phone knows their product,
not your data, your industry, or what your numbers are for. Anything
irreversible gets tried on a sample first, whoever told you to do it.

Average costing is cumulative. Every receipt averages into the running cost, so
a wrong cost becomes an input to every subsequent transaction on that item.
Post against it once and the error distributes through the history. I corrected
the costs as soon as I saw them, which fixed the field and nothing else.
Fishbowl gives you no reset: you can't recalculate average cost, and you can't
unwind the transactions that already consumed it.

So we reset. Cleared the affected data, corrected the configuration and the
costs, reloaded and relaunched **the same day**, with no meaningful downtime
and nothing that reached a customer. Patching would have left every affected
item carrying a cost nobody could explain, in a business where those numbers
reach finance and the margin on a surgical instrument matters. There's a
credibility argument that points the same way, but it was the lesser reason.
The real one is that average costing had no undo.

**What I'd do differently:** post real transactions against a sample before
go-live, not just validate the import file. Ours was structurally valid: every
field populated, every record accepted. Nothing about a clean import tells you
the costs are right, and by the time a transaction proves otherwise the damage
has already averaged in.

The general version, which I've used since: find out what your system cannot
undo before you go live on it. Knowing where the one-way operations are tells
you where validation has to be strict and where you can afford to fix things in
flight.

## After go-live

Fishbowl's planning could run the business. It ran it on the wrong basis: usage
for finished goods came from shipments and usage for components came from
production, so the parameters answered what we had already done instead of what
customers had ordered. I built the planning and analytics layer alongside it to
fix the basis, exploding demand from order dates instead: MRP, forecasting,
safety stock and reorder logic, scheduling, costing, inventory and supplier
performance, with Power BI over the top, used daily by leadership, purchasing
and operations.

Those same two defects turned up again at Diagraph four years later, in a
different ERP that nobody had connected to this one. They are the first two
entries in the audit in the next case study.

Then the company bought the unit next door and everything moved, which handed
me something you rarely get: an empty warehouse and permission to decide where
things go. I set the layout from usage data and BOM pick order, then put
barcodes and scanners on receiving, picking, packing and shipping over a layout
designed for them. Barcodes came after go-live and were better for it, because
by then the system knew what moved.

I wrote the supply chain SOPs and trained across five departments.

## What it produced

| | |
|---|---|
| **Inventory** | **$9M of working capital identified, about $6M realized.** Availability maintained throughout |
| **Scope** | Five departments live on one system, from notecards, spreadsheets and QuickBooks |
| **Compliance** | Full lot and serial traceability from day one, in a regulated medical device business |
| **Sourcing** | MOQs and pricing renegotiated across 5 primary and about 100 additional suppliers |
| **People** | Purchasers and receiving staff hired and trained, 20+ trained on the system, SOPs authored |
| **Then** | Promoted out of purchasing into BI and ERP Administrator, and was the primary ERP resource through the acquisition transition |

**On the two numbers**, since they're the first thing anyone asks about. $9M is
the gap between what the business was carrying and what the planning work
established it needed to carry. About $6M of that gap closed while I was there,
as stock turned and the excess went back to vendors or into write-offs.
Availability held the whole time, which is the part I'd check first if somebody
showed me this number.

## The foundation I'd change

The planning engine ran off a scheduled report export out of Fishbowl. That was
a reasonable design and never painful to run. The export ran itself, the engine
read it, nobody pulled files by hand, and it worked for years. It's still the
wrong foundation, for three narrower reasons than "exports are bad":

- **An export is a contract nobody signed.** Rename a column upstream and the
  thing that breaks is downstream, where the person who broke it never finds
  out.
- **A new question needs a new report.** Querying, you write a different query.
  Exporting, you go and change the export, so some questions never get asked.
- **Logic drifts into the consumer.** Anything the flat file doesn't say gets
  worked out where it lands. That's how planning rules ended up spread back
  across Power BI and Excel. Workbooks, one storey up.

I didn't do it that way partly because I wasn't good enough at SQL then. I have
a memory of something structural too, IT making direct database access
impractical, but I can't confirm it now and I won't claim a constraint I can't
stand behind. The skill gap I'm sure of, and closing it is most of what the
next four years were. That's why the platform in the next case study puts
planning rules in one layer beneath every consumer. Nothing in it reads a file.

## Why I left

The pay didn't move with the scope, and once the system was built and running
the work was administration. I'd rather say both than dress them up.

---

**Next:** [A planning platform, built with no database
access](02-the-planning-platform.md)
