# Axim CPQ, the handbook

Two audiences. Sections 1 to 4 are for reps and cover getting a good quote out of the
tool. Sections 5 to 12 are for whoever keeps it current.

`README.md` explains why it is built this way, `IT_INSTALL.md` covers standing it up,
`DESIGN.md` covers how it looks. This one is about using it.

---

## Contents

**Selling**

1. [What it does for you, and what it will not do](#1-what-it-does-for-you-and-what-it-will-not-do)
2. [The application, and why it decides everything](#2-the-application-and-why-it-decides-everything)
3. [Reading the grades](#3-reading-the-grades)
4. [Lines, discount, send, outcome](#4-lines-discount-send-outcome)

**Keeping it current**

5. [Who can do what](#5-who-can-do-what)
6. [Adding a product](#6-adding-a-product)
7. [Retiring a product](#7-retiring-a-product)
8. [Rules](#8-rules)
9. [Discount policy and approvals](#9-discount-policy-and-approvals)
10. [Vocabulary and taxonomy](#10-vocabulary-and-taxonomy)
11. [Routine care](#11-routine-care)
12. [What needs a developer](#12-what-needs-a-developer)

---

## 1. What it does for you, and what it will not do

You describe a customer's production line. The tool grades which machines suit that
line and cites the specification behind each verdict, prices the quote, holds discount
to policy, routes anything past the ceiling for approval, and produces the document.

Three things you get that a price-page workbook never gave you:

- **Prices you did not type.** The tool stores no price of its own.
- **A verdict you can defend.** Each rule shows its original wording and the datasheet
  or price-page cell it came from. Six months on, you can still show your working.
- **A reason a machine was ruled out.** Not "the system says no". The rule, the figure,
  and the document the figure came from.

Four things it will not do, and each one has bitten somebody:

| It will not | So somebody has to |
|---|---|
| Write to Orbit | Re-key a won quote into order entry |
| Send email | Download the document and send it from your own Outlook |
| Notify an approver | Tell them. An approval waits in their **Waiting on you** list until they next open the tool |
| Invent a price or a margin | Get the part into Orbit with a price and a standard cost |

The Orbit gap is deliberate. A tool that can write to the ERP is a tool that can
corrupt it. The other three are gaps somebody should close, and §12 says what that
would take.

### The six screens

| Screen | What you go there for |
|---|---|
| **Quotes** | Build and track quotes |
| **Open orders** | Where a customer's order has got to |
| **Analytics** | What is being quoted, and what customers asked for |
| **Rules** | Why the tool said what it said |
| **Classify** | The technology and type behind every part |
| **Price book** | Where today's prices came from, and when |

You can read all six. Rules and Classify used to be shut to reps, which meant anyone
asking "why was the 6440 not recommended" got told a rule existed and shown a door they
could not open. Reading is not editing: everybody reads, an admin edits.

---

## 2. The application, and why it decides everything

Start a quote from **Quotes**. You can begin from an enquiry, pasting the customer's
email so the parser fills what it can, or from a machine, or from a customer.

Then the application. Twenty-eight questions about the line, in five groups.

| Group | Questions |
|---|---|
| **What is being marked** | Substrate, porosity, product width, product length, product temperature, label width, label length |
| **The line it runs on** | Line speed, throughput, product spacing, new or existing conveyor, guide rails, moving or stationary |
| **The code it has to print** | Character height, throw distance, lines of print, marking window, message content, barcode requirements, print quality |
| **Ink and adhesion** | Ink type, dry time, adhesion requirements, whether a sample has been tested |
| **The room it lives in** | Environment, minimum ambient, maximum ambient, notes |

**The grading only knows what you tell it.** Rules read these fields. A field you leave
blank is a rule that cannot fire.

### Three fields that carry more weight than they look

- **Label width** is read by sixteen rules. On any label application, fill it in first.
- **Lines of print** looks trivial and is not. The tool multiplies character height by
  lines of print to get the height of the whole mark, and eighteen rules read that mark
  height. Leave lines of print blank and every multi-line mark grades as a single line.
- **Throw distance** decides whether a printhead can reach the product at all. It is the
  question customers answer worst, because they estimate it instead of measuring.

### Blank and "no constraint" are different answers

Blank means nobody asked. No constraint means the customer does not care. A rule
reading an unconstrained field stays quiet rather than guessing, and that is the answer
you want. A rule reading a blank field also stays quiet, but you have lost a grading you
could have had.

Say no constraint when you know. Leave blank when you do not know yet, then go back and
fill it in when the customer answers.

### Filling it in is also the only record

These answers are the only place Axim records what customers **ask** for, including
on quotes that go nowhere. The Analytics screen reads them. A line speed you did not
record is a line speed nobody will ever know a customer needed.

### Stations

A quote can carry more than one station: a coder on the case line and a labeller on the
pallet line, each with its own application, each graded on its own terms.

A station's application inherits from the quote's and holds only what it answers
differently. Correct the line speed on the quote and it corrects on every station that
never overrode it. That is worth knowing before you go and change the same number in
four places.

---

## 3. Reading the grades

Four verdicts. Three of them are opinions and one is silence.

| What you see | What it means | What to do |
|---|---|---|
| **good fit** | A rule read this application and endorsed this machine | Quote it, and read the reasons so you can say why |
| **with a caveat** | It works, with a condition attached | Read the caveat. It is usually a thing to confirm with the customer, and it is usually cheaper to confirm now |
| **not recommended** | A rule ruled it out on a published figure | Open the rule. It names the figure and the document |
| **not assessed** | No rule looked at it | Go back to the application |

**"Not assessed" is the one to understand.** It is grey, not green, and it means the
tool has no opinion. An empty application means nothing fires, and without the grey
label every printer in every technology would come back looking like a good fit. That
is the absence of a grading wearing a green chip.

So a screen full of "not assessed" is telling you the application is too thin to grade
against, not that the catalogue is fine.

### Why the list is in the order it is

Best fit first, then within a grade:

1. **Fit.** Nothing outranks it. A popular machine that cannot code the pack is not an
   answer.
2. **Endorsement.** A machine a rule speaks for outranks one nothing is known about.
   Among 947 CIJ printers, most carry no fit rule at all, and without this the one
   machine a datasheet recommends would be buried under them.
3. **Order history.** A machine Axim sells every week is a safer recommendation
   than an equally suitable one nobody has ordered since 2019. Parts availability, field
   familiarity and installation experience all follow the volume.
4. **Documentation.** Whether you can put a datasheet and a photograph in front of the
   customer. Last, because it describes the quote rather than the machine.

### Using the trace in front of a customer

Click any rule code to read the rule. You get the summary, the original wording, and the
source. When a customer asks why you did not quote the cheaper machine, that is your
answer, and it holds up because it is the manufacturer's own figure rather than yours.

If a verdict names no rule, report it. Every verdict is supposed to cite one.

---

## 4. Lines, discount, send, outcome

### Adding lines

Add the machine and whatever goes with it. A rule may require a part, a bracket, a
photocell, a mount, and will say so.

**Optional lines** are priced and graded like any other line and stay out of the totals,
so the customer's copy can carry them under their own heading. Use them for the second
printhead nobody has decided on yet.

### Discount

Discount is per category: system, consumables, accessories, customs.

A part can also carry a cap of its own, and **the tighter of the two wins**. Ask 30% on
a part capped at 5% and you get 5%, with the trace naming the rule that held it. A cap
only bites when it is tighter than what you asked, so asking 0% on a part capped at 5%
is not a capped line.

Going past a category ceiling raises an approval. It does not block the quote. A
category with no stated ceiling raises nothing.

**Margin** shows when every part on the quote carries a standard cost in Orbit. If one
line does not, the tool withholds margin and says so. A blank margin is the tool
refusing to state a number it cannot stand behind.

### Send

**Send** re-prices the quote against current rules before it leaves. A rule that changed
since you drafted applies now, and a rule that blocks stops the send. Record the
recipient and a covering note.

Then download the document and email it yourself. The tool does not send it.

If an approval is raised, tell the approver. Nothing notifies them.

### Mark what happened

Won, lost with a reason, or sent outside the tool.

Analytics is built out of these. Lost reasons are what tell you whether you are losing
on price, on lead time, or on a capability Axim does not sell yet, and a quote left
in limbo contributes nothing to that.

### When something looks wrong

| What you see | Usually means |
|---|---|
| Everything is "not assessed" | The application is too thin. See §2 |
| A part has no price | No price in Orbit, or none on the `MAIN` location |
| A part will not go on a quote | Marked not quotable on Classify, or absent from Orbit |
| A new machine appears as a spare part | It has no model. §6 step 4 |
| Margin is blank with a note | A line has no standard cost in Orbit |
| A discount dropped without you asking | A per-part cap. The trace names the rule |
| A machine you expected was ruled out | Open the rule. Check the figure against what the customer told you, because the input is wrong more often than the rule is |
| A quote is stuck awaiting approval | Nobody was notified. Tell the approver |
| Prices look out of date | Check the Price book screen for when it was last refreshed |
| Everybody is refused at sign-in | Microsoft 365 group mapping. An IT question, see `IT_INSTALL.md` |

---

## 5. Who can do what

Three roles, and they come from Microsoft 365 group membership. There is no list of
users inside the tool. IT adds somebody to a group and the tool follows. A user who
resolves to no role is refused, so somebody grants access by adding a person, never by
forgetting to remove one.

| | Rep | Approver | Admin |
|---|---|---|---|
| Build, price and send quotes | ✅ | ✅ | ✅ |
| Read Rules, Classify, Analytics, Price book | ✅ | ✅ | ✅ |
| See own quotes and own customers' history | ✅ | ✅ | ✅ |
| See everybody's quotes | | | ✅ |
| Decide discount approvals | | ✅ | ✅ |
| Classify a part, confirm a product line | | | ✅ |
| Write and retire rules | | | ✅ |
| Add a technology, item type or category | | | ✅ |

Keep the admin group small. It can change the rules deciding what customers are quoted
and at what discount, which makes it the first group an access review should look at.

---

## 6. Adding a product

The most common maintenance job. It starts in Orbit and finishes on Classify.

### Step 1. The part exists in Orbit

Nothing to do in the CPQ. The item master is the source: part number, description,
product category, list price, standard cost. Until the part is in Orbit with a price it
cannot be quoted, and that is correct.

### Step 2. See whether it classified itself

Open **Classify**. The tool works out what a part is in this order, first answer wins:

1. **A person's classification**, entered on this screen. Beats everything below.
2. **The product hierarchy**, the 43-row product line map. Most parts land here.
3. **The price page it sat on**, which is a filing decision rather than a statement of
   what the part is.
4. **Unclassified**, and it appears in the worklist.

If the part inherited a sensible technology and type from its product line, check it and
move on.

### Step 3. Classify it if it did not

- **Technology.** CIJ, TIJ, TTO, PIJ, VIJ, LSR or PALM. Which price book it belongs to.
- **Type.** Printer, printhead, ink, consumable, accessory, spare, service, warranty,
  promo. You will also see `part` on the worklist and you cannot pick it: it is where
  the tool puts something it could not commit to, and resolving it means choosing one of
  the nine.
- **Model.** Machines only, and it matters. Next step.
- **Quotable.** Clear this for a part that exists in Orbit but should never reach a
  quote.
- **Reason.** Say why. It is recorded with your name, and it is what stops the next
  person undoing your decision because they could not tell it was deliberate.

### Step 4. If it is a machine, give it a model

A machine carries a model. Something with no model is filed as `part` until a person
says otherwise.

That rule exists because it was once wrong in the expensive direction. A product line
mapped to "printer" handed that type to everything filed under it, and the tool offered
Handclean hand cleaner as a machine at forty-six thousand dollars.

So a new machine appears as a `part` until you set its model and type. The worklist is
where it waits for you.

### Step 5. Does it need a rule?

Only if something about it constrains a quote:

- Does it require something else to work?
- Is it incompatible with something?
- Does it carry a discount ceiling of its own?
- Does it suit, or fail to suit, particular speeds, throw distances or substrates? Those
  are fit rules, and every figure needs a published source.

Most parts need none.

### Step 6. Check it quotes

Build a throwaway quote with the part on it. Confirm the price comes through, the type
looks right, and any rule you wrote fires when it should. Delete the quote afterwards.

---

## 7. Retiring a product

Delete nothing. Quotes already sent cite these parts and have to stay readable.

- **The part stops being sold.** Mark it not quotable on Classify. It keeps its
  classification and its history and stops appearing on new quotes.
- **A rule stops applying.** Set its **effective to** date. It stops firing on that date
  by itself and stays in the history of the quotes it touched.
- **A whole technology goes.** Retire the rules, mark the parts not quotable, leave the
  technology in place if any quote ever used it.

---

## 8. Rules

A rule is a row with typed fields. Not code, not a document. The editor is pickers and
plain fields, validation runs as you type, and save stays disabled until the errors are
gone.

### The parts of a rule

- **Rule code.** What it is cited by: `R-091`, `A-CIJ-SPD-6400`, `Q-BARE-MOUNT`. The
  tool suggests the next one.
- **Summary.** What a rep reads on the quote. It cannot be blank, and it is the field
  that matters most, because it is the whole of what most people will ever see.
- **Detail.** The original wording and where it came from. The tool warns when this is
  empty and saves anyway. Fill it in. Without it a rep cannot see where the rule came
  from, and in six months neither can you.
- **Trigger.** When the rule looks at a quote: a part, a role, a model, an application
  answer, the order total, or always.
- **Action.** Grade a fit, warn, require a part, exclude one, cap a discount, ask for
  approval, or offer a choice between alternatives.
- **Conditions.** For eligibility rules. Each is listed separately so a rep sees which
  one failed rather than only that the answer was no.
- **Effective from and to.** A promotion stops applying on its own.

### What the tool refuses to save

A rule with no trigger, which could never fire. A rule with no action and no condition,
which would do nothing. A part number that does not resolve in Orbit. A cap outside 0
to 100%. An end date before the start date. A `require` action that does not say which
part.

### After you save

The rule applies to new evaluations at once, including when an existing draft is
re-priced on send. Quotes already sent do not change. The history panel records who
changed what, and when.

---

## 9. Discount policy and approvals

**Category ceilings** are the stated maximum for system, consumables, accessories and
customs. Asking past one raises an approval. It does not block the quote.

**Per-part caps** are a ceiling on one part, written as a rule with a `cap` action. The
tightest active cap wins.

**Approvals** go to the approver for that rep and nobody is notified. The approval sits
in the manager's *Waiting on you* list until they open the tool. When quotes stall, check
that first. It is a process question rather than a tool one, until somebody builds
notification.

---

## 10. Vocabulary and taxonomy

All of it editable by an admin, in the tool.

**Technologies** are the price books. Adding one means Axim has taken on a new
product line, so it is not maintenance.

**Item types and categories** are what a part can be, and the level below it. The
category exists because "accessory" covers 145 things on the PALM book, and knowing that
much does not help anybody quote. Stands, Conveyor, Brackets, Ribbon and Solvents are
categories.

All three refuse to delete a value that still has parts under it. Reclassify the parts
first. A taxonomy with orphans causes more trouble than one carrying a value nobody uses.

**The product line map** is 43 rows saying which price book and which type a product
line belongs to. Thirteen are marked `assumed`, read off a line name rather than
confirmed by anybody, and the screen sorts those first. Confirming one records who did
it. Everything the grading says about those thirteen lines rests on a guess until
somebody works through them.

---

## 11. Routine care

**Whenever a product changes.** Orbit first, then Classify if it did not classify
itself.

**Monthly**

- Work the Classify worklist. It is ordered by what has moved recently, so the top of it
  is the part worth doing.
- Confirm a few `assumed` product lines.
- Read Analytics for two things: questions the rules lean on that reps are not
  answering, and questions everybody answers that no rule reads. Both are actionable, and
  the first one tells you what to coach.

**Quarterly**

- Compare the discount ceilings against what the business approves. If everything is
  being approved, the ceiling is in the wrong place.
- Review the admin group.
- Look at *Live rules that have never fired* on Analytics. Such a rule is either waiting
  for a quote that has not come up, or cannot fire as written.

**When a datasheet is republished.** Check the fit rules citing it. A rule quoting a
figure the manufacturer has changed is worse than no rule, because it looks sourced.

---

## 12. What needs a developer

Being clear about the boundary, so nobody waits on a ticket for something they could do
in ten minutes, or hand-edits something they should not.

**No developer needed for** products, prices, classification, the product line map,
rules of every type, discount ceilings, per-part caps, technologies, item types,
categories, effective dates, retiring anything.

**A developer needed for:**

- A new kind of rule, a trigger or action that does not exist yet.
- A new question on the application. The 28 are fixed in the code, the database and both
  grading engines, and adding one touches all three.
- How the quote document is laid out.
- Connecting the tool to anything new. Writing back to Orbit, sending email and
  notifying approvers are three real gaps, and all three are projects. None of them is
  a setting somebody can switch on.

**One rule for anybody who does touch the code.** The grading logic exists twice, once
in Python and once in TypeScript, held equal by a file of worked examples. Neither
changes without the other and without a new example. That is what stops the price a rep
sees differing from the price the service records.
