# Luke Hurter

**ERP and supply chain systems.** SQL Server, Power BI, Python, React. CPIM.

I find the working capital trapped in inventory and build the systems that keep
it out. Two manufacturers so far, and availability improved both times instead
of being traded away. I started as a purchasing assistant kitting parts and
typing notecards into a spreadsheet, which is a large part of why the tools I
build get used.

luke.h.hurter@gmail.com · St Charles, MO ·
[LinkedIn](https://linkedin.com/in/luke-hurter)

[Run both tools in your browser](https://lukehurter.github.io/Portfolio/). No
install, no clone.

---

## Case studies

### [1 · From notecards to an ERP](case-studies/01-notecards-to-erp.md)
*Katalyst Surgical, a ZEISS company · 2021–2025*

Inventory on index cards, planning in a different Excel file for every
department, finance in QuickBooks. I selected, implemented and administered the
Fishbowl ERP across five departments of a regulated medical device
manufacturer, with full lot and serial traceability at go-live, one colleague
to help, and the purchasing job I was hired for still to do. It started when I
invited the incoming CFO to lunch on his first day. It nearly ended on an
average-costing error that Fishbowl gives no way to undo. **About $6M of
working capital realized, from $9M identified.**

### [2 · A planning platform, built with no database access](case-studies/02-the-planning-platform.md)
*Diagraph, an ITW Company · 2026*

Fifteen weeks to a production planning platform over Macola, holding no SSMS
access and no right to alter a database object. Auditing the stocking
calculation it replaced turned up six defects running at once, biasing
inventory in both directions. **$3M of excess found across three sites, about
$1M released.**

---

## Runnable demos

Both come from case study 2, rebuilt for a **fictional** manufacturer. Every
company, brand, model, supplier and part number was rewritten by a mechanical
transform rather than by hand, and a checker fails the build on anything real
that survives it. No real company, product, person or price appears in either.

### quote-engine

Configure, price, quote. 1,833 parts, 315 rules, 598 tests. **[Open
it](https://lukehurter.github.io/Portfolio/quote-engine.html)**, or build it
yourself:

```bash
cd quote-engine/web && npm install && npm run build:preview
```

Either way you get one self-contained HTML file. The whole application, its
catalogue and its rule engine compile into a single page that needs no server,
no database and no network.

If you only open three things:

- **`web/src/engine/evaluate.ts` and `api/engine.py`.** One grading algorithm,
  written twice. The front end prices a draft while you type and the service
  prices the one that gets sent, so both need it. Two engines that disagree
  hand a customer a price nobody sanctioned, so `engine-cases.json` holds
  worked examples and both assert against it. Neither can change without the
  other and a new case.
- **Provenance.** Every rule states the document and line its figure came from,
  and the build fails if a citation doesn't resolve.
- **The grey verdict.** Four grades: `good fit`, `with a caveat`, `not
  recommended`, `not assessed`. The last one means no rule looked at the
  machine, which usually means the application is too thin to grade against. An
  earlier version showed those green. A green chip that means nobody checked is
  worse than no chip at all, so now it's grey.

### planning-suite

The supply chain dashboard. **[Open
it](https://lukehurter.github.io/Portfolio/planning-suite.html)**, or run the
real service:

```bash
cd planning-suite && run.bat
```

Or `pip install -r requirements.txt && python -m uvicorn app:app --port 8080`.
It serves an in-memory dataset by default, so there's nothing to configure.

The browser version is the same page with its network removed. In demo mode the
service is a pure function of fixed data, so a build step records every
response it can give and inlines them as a lookup table, and the one free-text
endpoint, item search, becomes a client-side filter. Point it at
a SQL Server with `PA_DEMO=0` and it is an ordinary client/server app again.

Three things it does differently:

- **Seven pages, one question each.** The nav says who each page is for,
  because a dashboard that tries to serve everybody serves nobody.
- **The Trust page.** What fed a number, and when it was last computed. The
  argument that follows a surprising figure is rarely about the figure itself.
- **The thirteen-week position walk.** Two tracks on one row: what you can
  commit, counting everything on order, and what will physically sit on the
  shelf. A part can look healthy on one and empty on the other. Catching that
  gap is the point. ATP runs as a minimum across the window, since you can't
  promise past the tightest week between now and the one you're looking at.
- **Excess measured in time, not tiers.** Excess is on-hand above the
  order-up-to level, and the figure beside it is how long current demand takes
  to consume it. An item with no demand reports *never clears*, which is worth
  more than a label reading `OBSOLETE`: it names the consequence instead of the
  category.

