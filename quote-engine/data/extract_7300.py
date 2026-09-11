"""Pull the Corvus 7300-series items out of the price-page workbook.

    python data/extract_7300.py

Reads
    ../../Price Page Extract/CLEAN Axim Direct Corvus 7300 Series Price Pages v1.4.xlsx

Writes
    corvus-7300-items.json      133 part numbers, descriptions, availability
    corvus-7300-inks.json       50 inks, their category code and printhead compatibility

NO PRICES. The workbook is a CLEAN copy — every List Price column in it is empty, the
same as the other price-page workbooks in this repository. So this carries part
numbers and structure and nothing commercial, and the preview keeps inventing its
prices as it does for the other 1,700 parts.

The workbook itself stays in Price Page Extract/, which never travels: see that
folder's README and the guard in tools/build_download_pages.py.
"""
from __future__ import annotations

import json
import pathlib
import re

import openpyxl

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
BOOK = (ROOT / "Price Page Extract"
        / "CLEAN Axim Direct Corvus 7300 Series Price Pages v1.4.xlsx")
ITEMS = HERE / "corvus-7300-items.json"
INKS = HERE / "corvus-7300-inks.json"

PART = re.compile(r"^P99(\d)-([A-Z0-9])(\d)-(\d\d)-LNX$")

# "Stocked" and "Active - PTO, 20 days lead time" are orderable; "Inactive" is not.
# The distinction matters more here than usually: 112 of the 133 are inactive, so a
# catalogue that ignored it would offer a rep five times as many machines as exist.
def orderable(availability: str) -> bool:
    return not availability.lower().startswith("inactive")


def main() -> None:
    if not BOOK.exists():
        raise SystemExit(f"workbook not found: {BOOK}")
    wb = openpyxl.load_workbook(BOOK, data_only=True, read_only=True)

    # ---------------------------------------------------------------- the items
    rows = list(wb["Item List"].iter_rows(values_only=True))[1:]
    items = []
    priced = 0
    for r in rows:
        if not r or not r[0]:
            continue
        part = str(r[0]).strip()
        m = PART.match(part)
        if not m:
            raise SystemExit(f"{part} does not fit the 7300 part-number grammar")
        if r[2] not in (None, ""):
            priced += 1
        availability = str(r[3] or "").strip()
        items.append({
            "itemNo": part,
            "description": str(r[1] or "").strip(),
            "availability": availability,
            "isActive": orderable(availability),
            "printer": m.group(1),
            "printhead": m.group(2),
            "length": m.group(3),
            "ink": m.group(4),
        })
    if priced:
        raise SystemExit(
            f"{priced} rows carry a price. This extractor is written for a CLEAN "
            f"workbook and must not be used to move real pricing into the repository.")

    # ---------------------------------------------------------------- the inks
    inks = []
    head_cols = {}
    for row in wb["Ink Types"].iter_rows(values_only=True):
        cells = [("" if c is None else str(c).strip()) for c in row]
        if not any(cells):
            continue
        if cells[0].lower() == "ink":
            # "PH4 MIDI+", "PH4 MIDI", "PH4 MINI" -> the column each sits in
            for i, c in enumerate(cells):
                if c.upper().startswith("PH4"):
                    head_cols[c] = i
            continue
        if not head_cols or not cells[0]:
            continue
        inks.append({
            "ink": cells[0],
            "name": cells[1],
            "category": cells[2],
            "printheads": sorted(h for h, i in head_cols.items()
                                 if i < len(cells) and cells[i] not in ("", "x", "X")),
        })

    ITEMS.write_text(json.dumps({
        "$comment": [
            "The Corvus 7300 series as the price page lists it.",
            "",
            "Extracted by data/extract_7300.py from the CLEAN workbook in",
            "Price Page Extract/, which carries no prices — every List Price column in",
            "it is empty. Part numbers, descriptions and availability only.",
            "",
            "112 of the 133 are Inactive. A catalogue that ignored that would offer a",
            "rep five times as many machines as can actually be ordered.",
        ],
        "source": BOOK.name,
        "counts": {
            "items": len(items),
            "orderable": sum(1 for i in items if i["isActive"]),
            "inactive": sum(1 for i in items if not i["isActive"]),
        },
        "items": items,
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    INKS.write_text(json.dumps({
        "$comment": [
            "Which ink goes with which printhead, from the workbook's Ink Types sheet.",
            "",
            "`category` is the two-digit ink position in the part number, so this is",
            "what turns a category back into the inks it stands for — the part number",
            "says 17 and the rep needs to know that means 1010, 1014, 1015 and the",
            "rest, and which printheads each will run on.",
        ],
        "source": BOOK.name,
        "counts": {"inks": len(inks)},
        "inks": inks,
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"-> {ITEMS.name}  {len(items)} parts, "
          f"{sum(1 for i in items if i['isActive'])} orderable, no prices")
    print(f"-> {INKS.name}   {len(inks)} inks")


if __name__ == "__main__":
    main()
