"""The draft the client sends and the draft the service accepts are the same draft.

Pydantic ignores fields it does not declare. That is a reasonable default and a bad
failure mode here: an undeclared field is not rejected, it is deleted, so the client
sends it, the request succeeds, and the value is gone before engine.py or repo.py can
look at it. Nothing anywhere reports it.

Seven fields had gone that way by the time anyone noticed. The one that was reported —
"marking something as optional doesn't do anything on the customer copy" — was the
harmless-looking end of it. Also being discarded: `flatDiscount`, which engine.py reads
to take an amount off a quote, and `noConstraint`, which it reads in two places to keep
a rule quiet. Both would have worked perfectly in the preview, which runs the in-memory
API and never validates anything, and done nothing in production.

So this reads the field names out of the TypeScript interface and compares them. It is
a text comparison of a type declaration, which is crude, and it is the only thing that
fails when someone adds a field to one side and not the other.
"""

from __future__ import annotations

import pathlib
import re

import models

WEB_TYPES = pathlib.Path(__file__).resolve().parents[2] / "web" / "src" / "api" / "types.ts"


def ts_interface(name: str) -> set[str]:
    """The field names declared on a TypeScript interface.

    Comments are stripped first: several fields here carry a block comment holding a
    reported bug, and `optional?: boolean;` inside prose is not a field.
    """
    src = WEB_TYPES.read_text("utf-8")
    m = re.search(rf"^export interface {name} \{{\n(.*?)^\}}", src, re.S | re.M)
    assert m, f"no interface {name} in {WEB_TYPES.name}"
    body = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
    body = re.sub(r"//.*$", "", body, flags=re.M)
    return set(re.findall(r"^  ([A-Za-z][A-Za-z0-9]*)\??:", body, re.M))


def test_quote_draft_declares_every_field_the_client_sends() -> None:
    ts = ts_interface("QuoteDraft")
    py = set(models.QuoteDraft.model_fields)
    dropped = ts - py
    assert not dropped, (
        "the service would silently discard these fields of QuoteDraft: "
        + ", ".join(sorted(dropped))
        + " — declare them on models.QuoteDraft or remove them from the client"
    )


def test_draft_line_declares_every_field_the_client_sends() -> None:
    ts = ts_interface("DraftLine")
    py = set(models.DraftLine.model_fields)
    dropped = ts - py
    assert not dropped, (
        "the service would silently discard these fields of DraftLine: "
        + ", ".join(sorted(dropped))
    )


def test_the_application_profile_declares_every_field_the_client_sends() -> None:
    """The profile is a nested model, so it drops fields the same way and separately.

    QuoteDraft was checked here from the day this file was written; the profile inside
    it was not, and it declared SEVEN of the twenty-eight fields the client sends. The
    other twenty-one were deleted at the wire on every request.

    Not a cosmetic gap. Of the eighteen profile fields the shipped rules trigger on,
    eleven were among the discarded — labelWidthMm alone is read by sixteen rules — so
    those rules could not fire against the service however the quote was filled in.
    And markHeightMm is derived from charHeightMm x linesOfPrint: linesOfPrint was
    dropped, so the eighteen rules reading mark height graded a four-line mark as one
    line. Every bit of it worked in the preview, which validates nothing.
    """
    ts = ts_interface("ApplicationProfile")
    py = set(models.ApplicationProfile.model_fields)
    dropped = ts - py
    assert not dropped, (
        "the service would silently discard these answers: " + ", ".join(sorted(dropped))
        + " — declare them on models.ApplicationProfile or remove them from the client"
    )


def test_every_profile_field_has_somewhere_to_be_stored() -> None:
    """Accepting an answer and having no column for it is the same loss, one step later.

    labelWidthMm and labelLengthMm were exactly that once the model above was fixed:
    nineteen rules read them, the screen asked for them, and repo.PROFILE_COLS had no
    entry, so they were validated, held in memory and dropped at the save.
    """
    import repo

    ts = ts_interface("ApplicationProfile")
    unstored = sorted(ts - set(repo.PROFILE_COLS))
    assert not unstored, (
        "these answers reach the service and are never written: " + ", ".join(unstored)
        + " — add them to repo.PROFILE_COLS, with a column to match"
    )


def test_the_model_invents_nothing_the_client_does_not_send() -> None:
    """The other direction, which is a different bug: a field the service expects and
    no client sends is a default that looks like a decision."""
    for name, model in (("QuoteDraft", models.QuoteDraft), ("DraftLine", models.DraftLine),
                        ("ApplicationProfile", models.ApplicationProfile)):
        extra = set(model.model_fields) - ts_interface(name)
        assert not extra, f"models.{name} declares {sorted(extra)}, which no client sends"


def test_the_fields_the_engine_reads_are_all_declared() -> None:
    """engine.py reaching for a field the model drops is the failure with teeth.

    `flatDiscount` was exactly this: read on every evaluation, never declared, so the
    engine asked for it and got the default on every request the service handled.
    """
    engine = (pathlib.Path(__file__).resolve().parents[1] / "engine.py").read_text("utf-8")
    read = set(re.findall(r'_get\(\s*(?:c\.)?draft,\s*"([A-Za-z][A-Za-z0-9]*)"', engine))
    assert read, "no draft field reads found in engine.py — has _get been renamed?"
    missing = read - set(models.QuoteDraft.model_fields)
    assert not missing, (
        "engine.py reads these off the draft and models.QuoteDraft does not declare "
        "them, so it will always see the default: " + ", ".join(sorted(missing))
    )
