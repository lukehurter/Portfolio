# The CPQ service

FastAPI. Callers present a Microsoft 365 (Entra ID) access token. Same shape as
the planning suite next door, which shares the stack.

```
api/
  main.py         routes, and nothing else
  engine.py       the rule engine: the production authority
  repo.py         every SQL statement
  validation.py   the checks that decide whether a rule may be saved
  auth.py         who is calling; role resolution itself lives in SQL
  models.py       request shapes, mirroring web/src/api/types.ts
  db.py           one connection, Windows auth, no password anywhere
  tests/          the shared engine cases
```

## Running it

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080
```

It needs `sql/00`–`05` to have been run. Start it without a database and it will
come up and then fail on the first request that touches one, because there is no
demo mode in here on purpose. The web preview build is where you look at the tool
without a backend, and two places that invent data is how invented data reaches a
customer.

## The one rule this service exists to enforce

**The client sends intent. The server returns the numbers.**

There is no endpoint that accepts a price, a discount already applied, a cap, or a
computed total. `POST /api/quotes/evaluate` takes a draft (customer, application,
part numbers, quantities, the discount asked for) and returns the priced quote
with its lines, its trace and the approvals it needs.

If the browser could price a quote, a rep could reach a number the business never
sanctioned by editing a request, and the trace stored against the quote would be a
story about it rather than a record of it. `repo.write_evaluation` writes the lines
and the trace in one transaction, from the same call that produced them.

`POST /api/quotes/{no}/submit` re-evaluates before it accepts. A quote drafted last
week against a rule that has since changed is caught there. What has to be legal
is the quote being *sent*, and the rep started drafting it under rules that no
longer apply.

## Two engines, one algorithm

`engine.py` is the authority. `web/src/engine/evaluate.ts` is a port, so the preview
build works with no backend.

Two implementations is a real risk: engines that disagree would price the same quote
two ways. So neither may change alone. `../engine-cases.json` holds 14 worked
examples and both sides assert against it:

```bash
cd api && python -m pytest          # 14 passed
cd web && npx vitest run            # 14 passed
```

Change one engine and the other side's test fails.

## What is not verified

**Nothing here has run against a database.** IT does not allow development
tooling on the production network, so every statement in `repo.py` is written
from the ERP's SQL dictionary and the schema in `../sql`. A script has checked
every object and column name against those files,
which is a long way from having executed them. Treat the first run as a test, on
a restored copy.

The engine is a different matter. It is pure, it has no I/O, and it is tested.

## Authentication

The proxy authenticates and passes the identity downstream as headers
(`Authorization: Bearer <token>`; the tenant, the audience and the name of the
groups claim are all settings, because IIS, nginx and Apache each spell them
differently). A request without them is rejected: it either bypassed the proxy or
the proxy is misconfigured, and both are failures rather than anonymous
access.

Role resolution is `cpq.fn_effective_role` in SQL, not a second copy in Python.
A user who resolves to no role is denied.

`GET /api/quotes/{no}` returns **404, not 403**, for a quote the caller may not see.
A rep should not be able to discover that a quote exists by trying quote numbers.

## Route parity with the web app

`tests/test_route_parity.py` reads `web/src/api/http.ts` for the paths the client
calls and this service for the paths it serves, and compares them in both
directions.

It exists because they drifted. Ten endpoints were added to the client and to the
in-memory preview API and never here: the Classify vocabulary (types, categories,
price books), document defaults, configured part numbers, the next free rule
code, and the three quote states of sent-outside, lost and reopened. Every one of
them worked in the preview and would have been a 404 in production, behind a
button the UI offers.

That is the worst shape a gap can take: nothing fails at build time, nothing fails
in review, and the first person to find out is a rep whose quote will not save.

## What the client may not compute for itself

The requirement bands on the solution screen, the ones that say "no mount on this
quote", used to be computed in the browser from a copy of the rule set compiled
into the JavaScript.
In the preview that is the whole rule set and correct. In production the rules live
in this database and are edited from the Rules screen, so an admin adding a
structure rule changed nothing a rep saw until the front end was rebuilt, while the
Rules screen showed the new rule the whole time. Both looked like they were working.

`GET /api/rules/requirements?technology=CIJ` answers it from the live rules. Removing
that import also took 162 KB of rule data out of the production bundle.

## Deployment

Windows service under NSSM, a domain service account, internal DNS and a reverse
proxy for TLS. The install guide that spells this out is written for one
company's estate, so it stays behind rather than travelling here full of the
wrong host names.

Grants the service account needs:

| Database | Grant | Why |
|---|---|---|
| `AximQuote` | `db_datareader`, `db_datawriter` | quotes and rules are written here |
| `PlanningSuite` | `db_datareader` | promise ladders and open order lines |
| Orbit `[100]` | **nothing** | reached only through the `mac` synonyms |

That last row is the invariant. Nothing this tool does can write to Orbit, however
wrong the code gets.
