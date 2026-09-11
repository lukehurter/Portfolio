"""
Harvest the thermal jet and valve jet price pages, which the first extract missed.

    cd "CPQ System/data" && python extract_tij_vij.py

WHY THIS EXISTS

`Price Page Extract/quotable-items.json` covers CIJ, PALM, TTO, LSR and PIJ — its own
README says so. All eight workbooks were opened and their structure recorded, but rows
were only harvested from sheets whose names were recognised, and the thermal jet and
valve jet books name their sheets differently: `TJ Thermal Jet`, `IV Porous`,
`IV NonPorous`. So 216 quotable rows were walked past, and the consequence in the app
was that a rep could not quote either technology at all — the eleven TIJ and twelve VIJ
datasheet rules had no machine to grade.

WHY A SECOND FILE RATHER THAN A REWRITE

This writes `quotable-items-tij-vij.json` beside the original and leaves the original
alone. Regenerating all 1,847 rows to add 216 would put every existing part, rule
citation and golden case at risk for no gain, and the first extract was done by hand so
there is no script to re-run. `build_classification.py` reads both files.

THE LASER IS NOT HERE, AND WILL NOT BE

`CLEAN Axim Laser System Configurator 2025 REV B May 30 2025.xlsx` was the third
book with unharvested rows, and reading it changes the answer rather than adding to it.
It holds no list of laser machines. It is a configurator: pull-downs assemble one part
number out of option codes — `L465E651BXABFUSAXX`, "Laser, 60W, 10.2um, IP54" — against
564 rows of option lists on a `Lists and data` sheet. There is nothing to put in a
machine list, because a laser is specified rather than picked. See `laser-configurator.md`
for what it holds and what building it would take.

ROLE COMES FROM THE SECTION HEADING

These sheets are laid out in sections, and the heading says what the parts under it are:
"TJ Print Head Kits", "Controllers (Stand Alone Only)", "Ink & Cleaning Supplies",
"Service for Standard Systems". That is a better source than one role per sheet, which
is the mistake that put fume extractors in the laser machine list. `demote_role` in
build_classification.py still narrows anything a section files loosely.

A row whose part number begins "(1)" is a component inside the kit above it, not
separately quotable, and is skipped.
"""

from __future__ import annotations

import json
import pathlib
import re

import openpyxl

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
EXTRACT = ROOT / "Price Page Extract"
OUT = EXTRACT / "quotable-items-tij-vij.json"

SOURCES = [
    ("TIJ", "CLEAN Axim TIJ Price Pages H1 REV A JAN 1 2026.xlsm", ["TJ Thermal Jet"]),
    ("VIJ", "CLEAN Axim VIJ Price Pages H1 REV A JAN 1 2026.xlsm", ["IV Porous", "IV NonPorous"]),
]

# Section heading -> role. First match wins, so the specific patterns come first:
# "Printhead Mounting Brackets" is a bracket, not a printhead.
SECTION_ROLE: list[tuple[str, str]] = [
    (r"mounting\s+bracket|bracket", "accessory"),
    (r"\bcables?\b|photo\s*sensor|photosensor|\bencoder\b", "accessory"),
    (r"ink cap|tubing", "accessory"),
    (r"\bsoftware\b|peripherals", "accessory"),
    (r"\bcontrollers?\b", "accessory"),
    (r"com kits|print head kits|printhead kits|system components", "printer"),
    (r"printheads?\b", "printhead"),
    (r"\bink\b|cleaning|conditioner|supplies", "consumable"),
    (r"maintenance items|spare|additional parts", "spare"),
    (r"\bservice\b", "service"),
    (r"miscellaneous", "accessory"),
]

# Headings that introduce nothing quotable.
NOT_A_SECTION = re.compile(r"^important note|click \"plus\"", re.I)


def section_name(heading: str) -> str:
    """The heading's own name, without the instruction that follows it.

    The IV headings carry a note to the rep in the same cell: "HR2600 IV Porous
    SmartIDS COM Kits. (click "plus" icon to left of kit to show or hide list of kit
    components) Print Heads, Smart IDS Brackets, Cables and Ink Cap Assemblies
    ordered separately." Matching the whole cell filed the system kits as brackets,
    because the note mentions brackets. The name is the first sentence.

    Only the full stop ends it, not the bracket: "Standard Integrated Valve (IV)
    Porous Printheads" is one name, and splitting at "(" left "Standard Integrated
    Valve", which matches nothing and silently dropped eight printheads.
    """
    return heading.split(".", 1)[0].strip()


def role_for(section: str) -> str | None:
    name = section_name(section)
    for pattern, role in SECTION_ROLE:
        if re.search(pattern, name, re.I):
            return role
    return None


def main() -> None:
    rows: list[dict] = []
    unmapped: list[tuple[str, str, int]] = []
    report: list[tuple[str, str, str, int]] = []

    for tech, filename, sheets in SOURCES:
        book = EXTRACT / filename
        if not book.exists():
            raise SystemExit(f"missing workbook: {book}")
        wb = openpyxl.load_workbook(book, read_only=True, data_only=True)
        for sheet in sheets:
            ws = wb[sheet]
            grid = list(ws.iter_rows(values_only=True))
            header = next(
                (i for i, r in enumerate(grid)
                 if any("DESCRIPTION" in str(c or "").upper() for c in r)),
                None)
            if header is None:
                raise SystemExit(f"{sheet}: no header row carrying DESCRIPTION")

            # The porous / non-porous split is the whole point of having two sheets,
            # and it is the substrate question a fit rule asks. Carrying it as an
            # attribute is what lets a rule reach it.
            surface = ("Porous" if re.search(r"(?<!non)porous", sheet, re.I) and "NonPorous" not in sheet
                       else "Non-porous" if "NonPorous" in sheet else None)

            section, per_section = "", {}
            for r in grid[header + 1:]:
                part = str(r[1] or "").strip()
                desc = str(r[2] or "").strip()
                if not part:
                    continue
                if part.startswith("("):
                    continue                        # a component of the kit above
                if not desc:
                    if not NOT_A_SECTION.match(part):
                        section = part
                    continue
                role = role_for(section)
                if role is None:
                    unmapped.append((sheet, section, 1))
                    continue
                attrs = {"Surface": surface} if surface else {}
                rows.append({
                    "technology": tech, "sheet": sheet, "section": section,
                    "row": None, "partNumber": part, "description": desc,
                    "role": role, "attributes": attrs,
                })
                per_section[section] = per_section.get(section, 0) + 1
            for sec, n in per_section.items():
                report.append((tech, sheet, f"{section_name(sec)[:52]} -> {role_for(sec)}", n))

    # A part listed on both IV sheets serves both surfaces, so it must not keep the
    # Surface of whichever sheet was read first — that would tell a rule the part is
    # porous-only when the book says otherwise.
    on_both = {r["partNumber"] for r in rows
               if sum(1 for x in rows if x["partNumber"] == r["partNumber"]) > 1}
    seen: set[str] = set()
    unique: list[dict] = []
    for row in rows:
        if row["partNumber"] in seen:
            continue
        seen.add(row["partNumber"])
        if row["partNumber"] in on_both:
            row = {**row, "attributes": {k: v for k, v in row["attributes"].items() if k != "Surface"}}
        unique.append(row)
    duplicates = len(rows) - len(unique)

    OUT.write_text(json.dumps(unique, indent=1) + "\n", encoding="utf-8")

    print(f"quotable rows harvested   {len(rows):5d}")
    print(f"distinct part numbers     {len(unique):5d}   ({duplicates} on both IV sheets, so carry no Surface)")
    print("\nby section, with the role its heading implies:")
    for tech, sheet, label, n in report:
        print(f"  {tech:4s} {sheet:14s} {label:<70} {n:4d}")
    if unmapped:
        # Loud, because a section nobody mapped is parts silently dropped — which is
        # the fault this script exists to repair.
        print("\nSECTIONS WITH NO ROLE — these rows were DROPPED:")
        for sheet, section, n in unmapped:
            print(f"  {sheet:14s} {section[:70]:<72} {n}")
    print(f"\n-> {OUT.name}")


if __name__ == "__main__":
    main()
