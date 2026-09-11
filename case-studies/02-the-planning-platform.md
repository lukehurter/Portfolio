# A planning platform, built with no database access

**Diagraph, an ITW Company · Contract engagement, May 2026 – Oct 2026 · St
Charles, MO**

Fifteen weeks to put a production planning platform over an ERP nobody had
built reporting on, holding no SSMS access and no right to create or alter a
single database object. Every view, every stored procedure, every agent job
went to IT as a ticket and waited.

Auditing the calculation it replaced turned up six defects running at the same
time. **$3M of excess found across three sites, about $1M released.**

---

## The situation

Three manufacturing sites on one shared Macola database, no maintained
reporting, nothing reusable on the SQL Server. A purchasing workbook set the
stocking levels, and it had been running long enough that nobody questioned
what came out of it.

## Working without keys

Ten of the first sixty logged working days opened blocked on a deployment or an
access grant. The pipeline deployed on 18 June. The ticket granting me read
access to the database it had just created was actioned on 23 June, so the
platform sat finished and unreachable for three working days.

That shaped the delivery curve more than anything technical did. I spent those
days on the process automation, the documentation and the CPQ prototype, none
of which needed a deployment to make progress on.

## Three decisions, and their price

**Three layers: materialisation pipeline, semantic views, Kimball star.** The
planning rules live in one layer underneath every consumer, so a Power BI
report and a Python application read identical logic and can't contradict each
other. The star on top came out of a review rather than out of my head. IT in
Germany picked apart an earlier version of the semantic model and suggested a
Kimball star as the import contract for BI. He was right, and I rebuilt that
layer. The price is immediacy. Everything materialises on a schedule, so every
figure carries an *as at* stamp and the afternoon numbers are the morning's.
Recomputing the chain on demand takes minutes.

**Read-only, always.** Nothing writes back to the ERP; every Macola object is
reached through a read-only synonym. The price is the obvious feature. A tool
that writes approved stock levels back would save a manual import step and it's
the first thing anyone asks for. It's also a tool that can corrupt the ERP, and
I had no test environment to earn that right in.

**Weekly heavy, daily light.** Demand statistics only move when an ISO week
completes. Promise dates ride live orders. Splitting the refresh by how fast the
underlying answer can change puts the expensive half on a weekly run and the
half that moves intraday on two runs a day, at 05:30 and 11:30.

## What it does

- Demand exploded from order-line history through BOM and kit structures
- Weekly demand statistics, ABC and XYZ classification per item
- Calculated safety stock, reorder point and order-up-to level per item
- A **promise-date engine** giving Sales defensible delivery dates
- A **build-readiness view** naming the specific component blocking each held
  sales order line
- Seven-page Power BI suite on one governed semantic model, with object-level
  security restricting cost, pricing and vendor data by role
- Quarterly stock level review and kanban card printing, automated end to end

## The audit: six defects, all running at once

The workbook that set stocking levels was wrong in both directions at the same
time. It carried too much of some items and too little of the ones that needed
cover, which is why correcting it released cash and closed availability gaps
instead of trading one for the other.

| | Defect | What it did |
|---|---|---|
| 1 | Finished goods demand read from **shipment** history | Set stock against our own delivery performance instead of customer demand. Late and partial shipments fed straight back into the parameters |
| 2 | Component demand read from **work order usage** | Lot and batch sizing decisions drove component levels, overstating them |
| 3 | Variance on monthly buckets with **zero-demand months left blank** | Blanks were skipped instead of counted as zero, so the variance was wrong for exactly the intermittent items that need safety stock most |
| 4 | A **20-day working month** against an actual 21.75 | Usage overstated by about 9% across the board |
| 5 | Lead times unmaintained and **mixed calendar with working days** | Made the lead-time demand term unreliable wherever it appeared |
| 6 | Safety stock **conflated buffer and cycle stock**, computing neither | On an item with target 100 and lead-time demand near 70, the first bin emptied at 50, so the card reached purchasing after the item was already short. The trigger sat below the demand it was meant to cover |

I documented each one and published it to the people who owned it.

Correcting them moved stock in both directions at once: excess came down, and
the availability gaps purchasing had spent years working around closed at the
same time.

## Two weeks chasing a ghost

Four consecutive correct deployments went in and came back wrong the next
morning.

The SQL Agent jobs were reverting me, nightly. The refresh jobs held the entire
deploy script pasted inline as their step command, and it was an old copy.
Every night they redeployed that copy over the top of whatever had gone in that
day.

From my desk this was invisible. With no SSMS and no rights on msdb I couldn't
read a job step. All I could do was describe symptoms to IT and wait for
somebody else to look, which meant reasoning out what could possibly revert a
deployment on a schedule and then asking for exactly the right thing to be
checked.

The fix was one line of principle: a job step calls a stored procedure and
contains nothing else. No logic should live somewhere you can't read it.

Two read-only grants, `VIEW DEFINITION` and msdb read, would have turned two
weeks into an afternoon. Neither one permits a change to anything, and I'd
still ask for them before I asked for anything else.

### Six I found in my own build

Listed because a findings register that only catalogues other people's mistakes
isn't much of a register.

| Date | Defect | Fix |
|---|---|---|
| 15 Jun | A dashboard read Macola's usage figure instead of pipeline demand | Two numbers for one concept. Repointed |
| 30 Jun | PO line status stays open when the header closes | Open PO counts overstated. Source of truth moved to the header |
| 23 Jul | Implausible suggested stock levels surfaced a significant defect | Caught in review with purchasing **before any level was locked in** |
| 6 Aug | Ordering logic double-counted production allocation | Found by a user at the Marion site. Fixed and deployed the same day |
| 10 Aug | Lead times filtered to approved vendors only | Approval status isn't maintained here, so most items lost their lead time |
| 11 Aug | Stocking class read Macola's unreliable stocked flag | Removed from the logic. Levels moved a long way, all of it before anything was committed |

## Where it landed

| | |
|---|---|
| **Cash** | $3M excess found across three sites, about $1M released |
| **Time** | Fifteen weeks, first day to live platform |
| **Reach** | All three Macola sites. Presented company-wide, then to corporate supply chain, strategic sourcing, quality, the AI team and the German site |
| **Purchasing** | Supplier outreach cut from a multi-day cycle to one button: 300+ personalised files and email drafts, supplier master data to 80% completion |
| **Left behind** | The site's first supply chain SOPs, and a Macola SQL dictionary other teams now use |

## The one thing I'd change

I'd ask for the two read-only grants on day one and keep asking. I treated
access as fixed and built around it, and the workarounds were good ones. Two weeks still went into a problem that read-only visibility would have
closed in an afternoon.

---

## The demos

Two runnable applications sit alongside this write-up. **They are not
Diagraph's software.** They're rebuilt copies in which the company, the
products, the catalogue and every part number are invented, under a fictional
manufacturer called Axim, so you can read the engineering without any of the
client's data.

- **[quote-engine](../quote-engine/)**, the configure-price-quote tool.
- **[planning-suite](../planning-suite/)**, the planning dashboard.

Both compile to a single self-contained HTML file and [open in a
browser](https://lukehurter.github.io/Portfolio/), no server and no clone. The
planning suite also runs as the real FastAPI service it is, and against a live
SQL Server with `PA_DEMO=0`.

One habit carries straight over from the audit above. Every rule in the quote
engine cites the document and line its figure came from, and the build fails if
a citation doesn't resolve, because a number you can't trace is a number you
can't defend.
