"""
Request and response shapes.

These mirror `web/src/api/types.ts` exactly. That file is the contract; this one
enforces it at the wire. Where the two disagree the TypeScript is wrong, because
the client is not allowed to send anything the server has not agreed to accept.

Notice what is NOT here: there is no request model that carries a price, a
discount already applied, a cap, or a computed total. The client sends intent
and nothing else. If it could post a price, a rep could reach a number the
business never sanctioned by editing a request.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Severity = Literal["info", "warn", "block"]
RuleType = Literal["requires", "excludes", "duplicate", "eligibility", "substitution",
                   "applicationFit", "approval", "discountCap", "note"]


class ApplicationProfile(BaseModel):
    """The 28 answers the application asks for — all of them.

    This declared SEVEN. Pydantic deletes what it does not declare, so the other
    twenty-one were dropped at the wire: the client sent them, the request succeeded,
    and they were gone before engine.py or repo.py saw anything. In the preview, which
    runs the in-memory API and validates nothing, every one of them worked.

    That is not a partial feature. Of the eighteen profile fields the shipped rules
    actually read, eleven were among the discarded — labelWidthMm alone is read by
    sixteen rules — so those rules could never fire in production. Worse, markHeightMm
    is DERIVED from charHeightMm x linesOfPrint, and linesOfPrint was dropped, so the
    eighteen rules reading mark height graded every multi-line mark as a single line.

    The type of each field mirrors web/src/api/types.ts, which is the contract.
    test_draft_contract.py now compares the two field by field.
    """

    # what is being marked
    substrate: str | None = None
    porosity: Literal["porous", "nonPorous", "semiPorous", "unknown"] | None = None
    productWidthMm: float | None = None
    productLengthMm: float | None = None
    productTempF: float | None = None
    labelWidthMm: float | None = None
    labelLengthMm: float | None = None
    # the line it runs on
    lineSpeedFpm: int | None = None
    throughputPpm: float | None = None
    productSpacingMm: float | None = None
    conveyor: Literal["new", "existing"] | None = None
    guideRails: Literal["yes", "no"] | None = None
    productMotion: Literal["moving", "stationary"] | None = None
    # the code it has to print
    charHeightMm: float | None = None
    throwDistMm: float | None = None
    linesOfPrint: int | None = None
    markingWindowMm: float | None = None
    messageContent: str | None = None
    barcodeRequirements: str | None = None
    printQuality: Literal["humanReadable", "scannable", "graded", "graphics"] | None = None
    # ink and adhesion
    inkType: str | None = None
    dryTimeSeconds: float | None = None
    adhesionRequirements: str | None = None
    sampleTested: Literal["yes", "no"] | None = None
    # the room it lives in
    environment: str | None = None
    ambientTempMinF: float | None = None
    ambientTempMaxF: float | None = None
    notes: str | None = None


class DraftLine(BaseModel):
    itemNo: str
    quantity: float = Field(gt=0)
    #: Which solution this line serves. Null on a quote that predates solutions, and
    #: on the parts that belong to the quote rather than to a station — freight, an
    #: installation day — which grade against the quote's own application.
    solutionId: str | None = None
    #: Offered, not bought — priced and graded like any other line and kept out of
    #: the totals, so the customer's copy can put it under its own heading.
    optional: bool = False


class Solution(BaseModel):
    """One station on a quote: a name, a price book and its own application.

    `profile` is sparse and inherits — it holds only what this station answers
    differently from the quote, so correcting the line speed once corrects it
    everywhere it was never overridden.
    """

    id: str
    name: str | None = None
    technologyCode: str
    profile: ApplicationProfile = ApplicationProfile()
    #: Fields this station's customer has no constraint on. None means 'as the
    #: quote says'; a list — even an empty one — means this station was asked.
    noConstraint: list[str] | None = None


class NewCustomer(BaseModel):
    """A prospect who is not in Orbit yet."""

    companyName: str
    contactName: str = ""
    email: str = ""
    city: str = ""
    state: str = ""


class QuoteDraft(BaseModel):
    """One quote, in the shape the rep is editing it.

    Every field the client sends has to be declared here. Pydantic drops what it does
    not know about, silently and before the engine or the repository sees any of it,
    so an undeclared field is not a missing feature — it is a feature that appears to
    work in the preview and does nothing against the service.

    Seven were missing when the optional-line fault was traced. `flatDiscount` is read
    by engine.py and was being discarded, so an amount off a quote was ignored;
    `noConstraint` is read in two places there, so every "any / does not matter" answer
    was thrown away and rules the customer had waved off fired again. The rest —
    `newCustomer`, `document`, the recipient and the two notes — were written by the
    client and stored by nothing.

    test_draft_contract.py compares this class against the TypeScript interface field
    by field, so the next field added to one has to be added to the other.
    """

    technologyCode: str
    customerNo: str | None = None
    customerName: str | None = None
    #: Set instead of customerNo when the customer is not in Orbit yet.
    newCustomer: NewCustomer | None = None
    lineName: str | None = None
    profile: ApplicationProfile = ApplicationProfile()
    #: Profile fields the customer said they have no constraint on. Read by
    #: engine.py to keep a rule quiet; an empty list re-fires all of them.
    noConstraint: list[str] = []
    flags: dict[str, bool] = {}
    categoryDiscounts: dict[str, float] = {}
    #: A flat amount off the whole quote, clamped to the net by the engine.
    flatDiscount: float | None = None
    #: The stations on this quote, each with its own name, price book and application.
    #: Keyed by id rather than by price book, because two stations may both want a CIJ
    #: coder and a book cannot tell them apart. A solution's profile holds only what it
    #: answers DIFFERENTLY; absent means "as the quote says".
    solutions: list[Solution] = []
    lines: list[DraftLine] = []
    #: The customer copy's own wording and layout. Free-form for the same reason
    #: /document-defaults takes a dict: it is a template blob, not a schema.
    document: dict | None = None
    recipientEmail: str | None = None
    coveringNote: str | None = None
    approvalNote: str | None = None


ItemRole = Literal["printer", "printhead", "ink", "consumable", "accessory",
                   "spare", "service", "warranty", "promo"]


class ProductLineMapping(BaseModel):
    """One row of the taxonomy: Product Line -> price book and type.

    43 rows replace the prod_cat mechanism entirely. `confidence` is not decoration
    — 13 rows were seeded as 'assumed' from a line name, and the screen sorts those
    first so they get confirmed before anyone trusts the machine list.
    """
    productLine: str
    productClass: str | None = None
    technologyCode: str | None = None
    itemRole: ItemRole
    isQuotable: bool = True
    confidence: Literal["confirmed", "assumed"] = "assumed"
    notes: str | None = None
    itemCount: int = 0


class ItemClassification(BaseModel):
    """A classification a person entered. Always beats every automated source."""
    itemNo: str
    technologyCode: str | None = None
    itemRole: ItemRole
    model: str | None = None
    isQuotable: bool = True
    reason: str | None = None


class BookFitRequest(BaseModel):
    """Grade every price book against one application.

    No technologyCode: the whole point is that the rep has not chosen one yet.
    """

    profile: ApplicationProfile = ApplicationProfile()
    noConstraint: list[str] = []


class SuggestRequest(BaseModel):
    technologyCode: str
    profile: ApplicationProfile = ApplicationProfile()
    #: attribute name -> chosen value. Narrows the candidates BEFORE grading;
    #: a CIJ book holds over a thousand printer configurations and grading all
    #: of them to throw most away is wasted work while a rep is typing.
    attributes: dict[str, str] = {}
    q: str | None = None
    limit: int = 8


class RuleTrigger(BaseModel):
    triggerType: Literal["item", "role", "category", "attribute", "profile", "total", "always"]
    itemNo: str | None = None
    itemRole: str | None = None
    prodCat: str | None = None
    attrName: str | None = None
    attrValue: str | None = None
    profileField: str | None = None
    compareOp: Literal["eq", "ne", "gt", "gte", "lt", "lte", "includes"] | None = None
    compareValue: str | None = None
    minCount: int | None = None


class RuleAction(BaseModel):
    actionType: Literal["require", "requireOneOf", "exclude", "warn", "substitute",
                        "cap", "approve", "grade", "allowance"]
    itemNo: str | None = None
    quantity: float | None = None
    maxDiscount: float | None = None
    fitGrade: Literal["good", "caveat", "notRecommended"] | None = None
    approverRole: str | None = None
    allowanceAmt: float | None = None
    message: str | None = None
    remedy: str | None = None


class RuleCondition(BaseModel):
    seq: int
    label: str
    conditionKind: Literal["attribute", "item", "flag", "term"]
    attrName: str | None = None
    attrValue: str | None = None
    itemNo: str | None = None
    flagName: str | None = None


class Rule(BaseModel):
    ruleCode: str
    technologyCode: str | None = None
    ruleType: RuleType
    summary: str
    detail: str | None = None
    sourceRef: str | None = None
    author: str | None = None
    severity: Severity
    effectiveFrom: str
    effectiveTo: str | None = None
    isActive: bool
    triggers: list[RuleTrigger] = []
    actions: list[RuleAction] = []
    conditions: list[RuleCondition] = []
    updatedBy: str | None = None
    updatedAt: str | None = None


class ValidationIssue(BaseModel):
    level: Literal["error", "warning"]
    field: str
    message: str


class ValidationResult(BaseModel):
    ok: bool
    issues: list[ValidationIssue]


class ApprovalDecision(BaseModel):
    decision: Literal["approved", "declined"]
    note: str = ""


# Responses are returned as plain dicts built by the engine and the repo, so
# they are documented here rather than modelled twice. FastAPI serialises them
# as-is; the shapes are asserted by engine-cases.json on both sides of the wire.
Evaluation = dict[str, Any]
Quote = dict[str, Any]


# --------------------------------------------------- the Classify vocabulary


class VocabularyName(BaseModel):
    """A type or a category being added. Validated in the route, where the rule
    that a category may not repeat a type needs to see the other list."""
    name: str


class TechnologyName(BaseModel):
    code: str
    name: str = ""


class ConfiguredItem(BaseModel):
    """A part number composed rather than looked up.

    `listPrice` is optional and usually absent: a configured machine has no price
    until Orbit carries one, and the tool withholds a total rather than inventing
    one. See repo.add_configured_item.
    """
    itemNo: str
    description: str
    technologyCode: str
    itemRole: str = "printer"
    model: str | None = None
    listPrice: float | None = None
    discountCatCode: str | None = None


# ------------------------------------------- how a quote ended, and how it went


class SentFile(BaseModel):
    """The document a rep actually sent, when they attach it as proof."""
    name: str
    type: str | None = None
    size: int | None = None
    dataUrl: str


class SentOutside(BaseModel):
    """Free text, deliberately: it may have gone to four people and a phone call."""
    to: str
    note: str | None = None
    file: SentFile | None = None


class LostReason(BaseModel):
    reason: str | None = None
