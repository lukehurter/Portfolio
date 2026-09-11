"""Write announced-machines.json for the Corvus 9000 Series.

A one-off transcription script, kept because the transcription is the part worth
reviewing. Run it again only to correct a figure.

WHY THIS FILE EXISTS AT ALL

The 9000 Series is real, published by Corvus in June 2026 and on axim.example now, and
no price page carries it: the CIJ book in this repo is 2026 H1 and predates it. So
there is no part number and no price, and inventing either to make the machine
"appear" would put a fake part on a customer's quote. It sits here instead — a
machine a rep can read about and cannot order, which is the truth.

WHERE THE FIGURES COME FROM

Every figure is transcribed from the Corvus 7300 Series brochure MP41306/2. The
brochure's table merges cells across models, so the columns were resolved by matching
each value's centre against the column header centres rather than by reading order —
"Up to 3" sits between the 7300 and 7310 headers because it is one cell spanning both,
and reading it as two values would have given the 7310 nothing.

Nothing is carried across between models. Four figures independently match ones
already in this repo from the Corvus 6440 datasheet (1,791 fpm, 522 fpm, 504 fpm, and
557 fpm from the 6400 Plus sheet), which is a cross-check rather than a copy.

The feet-per-minute figures are computed here, not typed.
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
OUT = HERE / "announced-machines.json"

FPM = 196.8503937  # 1 m/s


def speed(*pairs: tuple[float, str]) -> str:
    """'6.25 m/s / 1,230 fpm (Standard)' — the conversion done rather than typed."""
    return "; ".join(f"{ms:.2f} m/s / {round(ms * FPM):,} fpm ({who})" for ms, who in pairs)


BROCHURE = ("Corvus 7300 Series brochure MP41306/2 — "
            "https://www.corvus.example/wp-content/uploads/2026/06/Corvus-7300-Brochure-v2.pdf")

# Shared rows, stated once here and written into every model that carries them, so
# that a model which differs is visibly different rather than silently inheriting.
TEMP = "5 to 45 °C / 41 to 113 °F (0 to 50 °C for Corvus 1240, 1010, 1014 and 3240 inks)"
DYE_SOFT = "Dye based black and colours; soft pigmented colours"

MODELS = {
    "7300": {
        "Printhead": "PH4 Standard (62 µm) or PH4 Standard Plus (75 µm). "
                     "The brochure lists no PH4 Compact figures for this model.",
        "Lines of print": "Up to 3",
        "Character height": "1.8 to 8.8 mm (Standard); 2.1 to 10.7 mm (Standard Plus)",
        "Max speed, single line": speed((2.83, "Standard"), (2.83, "Standard Plus")),
        "Max speed, two line": speed((1.41, "Standard"), (1.41, "Standard Plus")),
        "Throw distance": "12 mm (Standard); 20 mm (Standard Plus). "
                          "35 mm and 45 mm for carton coding",
        "Ingress protection": "IP55",
        "Operating temperature": TEMP,
        "Ink range": DYE_SOFT,
        "Service interval": "Up to 18 months (13,000 hours) on dye based; "
                            "up to 12 months (6,000 hours) on soft pigmented",
        "Weight": "23.2 kg including fluids and 2 m printhead",
    },
    "7310": {
        "Printhead": "PH4 Compact (50 µm), PH4 Standard (62 µm) or PH4 Standard Plus (75 µm)",
        "Lines of print": "Up to 3",
        "Character height": "1.2 to 9 mm (Compact); 1.8 to 20 mm (Standard); "
                            "2.1 to 20 mm (Standard Plus)",
        "Max speed, single line": speed((4.39, "Compact"), (6.25, "Standard"), (7.28, "Standard Plus")),
        "Max speed, two line": speed((1.57, "Compact"), (2.09, "Standard"), (2.02, "Standard Plus")),
        "Throw distance": "4 mm (Compact); 12 mm (Standard); 20 mm (Standard Plus). "
                          "35 mm and 45 mm for carton coding",
        "Ingress protection": "IP55",
        "Operating temperature": TEMP,
        "Ink range": DYE_SOFT,
        "Service interval": "Up to 18 months (13,000 hours) on dye based; "
                            "up to 12 months (6,000 hours) on soft pigmented",
        "Weight": "23.2 kg including fluids and 2 m printhead",
    },
    "7320": {
        "Printhead": "PH4 Compact (50 µm), PH4 Standard (62 µm) or PH4 Standard Plus (75 µm)",
        "Lines of print": "Up to 6",
        "Character height": "1.2 to 11.2 mm (Compact); 1.8 to 20 mm (Standard); "
                            "2.1 to 20 mm (Standard Plus)",
        "Max speed, single line": speed((6.28, "Compact"), (6.25, "Standard"), (7.28, "Standard Plus")),
        "Max speed, two line": speed((2.19, "Compact"), (2.46, "Standard"), (2.38, "Standard Plus")),
        "Throw distance": "4 mm (Compact); 12 mm (Standard); 20 mm (Standard Plus). "
                          "35 mm and 45 mm for carton coding",
        "Ingress protection": "IP55",
        "Operating temperature": TEMP,
        "Ink range": DYE_SOFT,
        "Service interval": "Up to 24 months (17,400 hours) on dye based; "
                            "up to 12 months (6,000 hours) on soft pigmented",
        "Weight": "23.2 kg including fluids and 2 m printhead",
    },
    "7340": {
        "Printhead": "PH4 Compact (50 µm), PH4 Standard (62 µm) or PH4 Standard Plus (75 µm)",
        "Lines of print": "Up to 6",
        "Character height": "1.2 to 11.2 mm (Compact); 1.8 to 20 mm (Standard); "
                            "2.1 to 20 mm (Standard Plus)",
        "Max speed, single line": speed((6.28, "Compact"), (7.50, "Standard"), (9.10, "Standard Plus"))
                                  + "; " + speed((10.0, "Standard Plus tower print, 5 dot high")),
        "Max speed, two line": speed((2.44, "Compact"), (2.65, "Standard"), (2.56, "Standard Plus")),
        "Throw distance": "4 mm (Compact); 12 mm (Standard); 20 mm (Standard Plus). "
                          "35 mm and 45 mm for carton coding, 5 mm for high speed cabling",
        "Ingress protection": "IP65",
        "Operating temperature": TEMP,
        "Ink range": DYE_SOFT,
        "Service interval": "Up to 24 months (17,400 hours) on dye based; "
                            "up to 12 months (6,000 hours) on soft pigmented",
        "Weight": "23.2 kg including fluids and 2 m printhead",
    },
    "7340 Prism": {
        "Printhead": "PH4 Compact (50 µm), PH4 Standard (62 µm) or PH4 Standard Plus (75 µm). "
                     "No 6 m conduit option on this model.",
        "Lines of print": "Up to 6",
        "Character height": "1.2 to 9 mm (Compact); 1.8 to 16 mm (Standard); "
                            "2.1 to 17 mm (Standard Plus)",
        "Max speed, single line": speed((6.28, "Compact"), (7.50, "Standard"), (9.10, "Standard Plus"))
                                  + "; " + speed((10.0, "Standard Plus tower print, 5 dot high")),
        "Max speed, two line": speed((2.44, "Compact"), (2.65, "Standard"), (2.56, "Standard Plus")),
        "Throw distance": "4 mm (Compact); 12 mm (Standard); 20 mm (Standard Plus). "
                          "35 mm and 45 mm for carton coding, 5 mm for high speed cabling",
        "Ingress protection": "IP65",
        "Operating temperature": "5 to 45 °C / 41 to 113 °F",
        "Ink range": "Hard pigmented white and colours",
        "Service interval": "Up to 12 months (8,000 hours) on hard pigmented",
        "Weight": "25.1 kg including fluids and 2 m printhead",
    },
}

DOC = {
    "$comment": [
        "Machines that exist and cannot be quoted yet.",
        "",
        "REPORTED: \"Also you can add the corvus 9000 series. Here is the brochure / specs",
        "/ datasheet.\" Added — but not to the catalogue, because no price page carries",
        "it. The CIJ book in this repo is 2026 H1 and Corvus published the 9000 Series in",
        "June 2026, so there is no Orbit part number and no price. Inventing either to",
        "make the machine appear in the machine list would put a part number that does",
        "not exist onto a customer's quote, which is worse than the machine being",
        "absent. It is shown as what it is instead: announced, documented, not",
        "orderable. The moment Orbit carries the parts they come through the catalogue",
        "like everything else and this entry can go.",
        "",
        "Every figure is transcribed from the Corvus brochure named in `documents` — see",
        "make_announced.py for how the merged table columns were resolved, and for the",
        "four figures that independently match the Corvus 6440 datasheet already in this",
        "repo.",
        "",
        "Axim's own page does not publish the brochure: both its brochure links go",
        "to a contact form. The Corvus link is the document itself.",
    ],
    "series": [
        {
            "name": "Corvus 9000 Series",
            "technologyCode": "CIJ",
            "announced": "June 2026",
            "page": "https://www.axim.example/products/productcoding/"
                    "smallcharactercontinuousinkjet(cij)printer/9000",
            "whyNotQuotable": "No Orbit part numbers yet — the CIJ price pages in this "
                              "preview are 2026 H1 and predate the range.",
            "summary": "Corvus's replacement for the 6400 range: up to six lines, "
                       "IP65 on the 7340 and 7340 Prism, automatic printhead "
                       "flushing, and a 10 m/s tower print mode on the 7340s.",
            "documents": [
                {
                    "kind": "brochure",
                    "name": "Corvus 7300 Series brochure (MP41306/2)",
                    "url": "https://www.corvus.example/wp-content/uploads/2026/06/"
                           "Corvus-7300-Brochure-v2.pdf",
                },
            ],
            "specSource": BROCHURE,
            "models": MODELS,
        },
    ],
}

OUT.write_text(json.dumps(DOC, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"-> {OUT.name}: {len(MODELS)} models")
for m, s in MODELS.items():
    print(f"   {m:<15} {s['Max speed, single line'][:70]}")
