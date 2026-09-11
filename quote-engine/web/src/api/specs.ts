/**
 * What the product pages say about each machine.
 *
 * Lifted from the Specifications table on the captured axim.example pages by
 * data/build_specs.py. The portfolio had been supplying a thumbnail and a link and
 * nothing else, while carrying this.
 *
 * Nothing here is interpreted. A row is the words the page uses, in the order the
 * page uses them — no figure is parsed out and no rule is derived from one. Rules are
 * written deliberately and cited, in data/datasheet-rules.json; a specification that
 * quietly became a constraint would be a tool refusing quotes nobody can explain.
 *
 * Generated — do not hand-edit.
 *
 * That line has been true and ignored twice: the vendor fallback below was added to
 * this file rather than to data/build_specs.py, and rebuilding dropped it both times.
 * It is emitted here now, so a rebuild keeps it.
 */

import { VENDOR_SPECS } from './vendorDocs';

export interface ModelSpecs {
  /** The page on axim.example this came from. */
  page: string;
  /** Specification name -> what the page says, in its own words. */
  specs: Record<string, string>;
}

/** 22 models, from 10 product pages, 456 stated figures. */
export const MODEL_SPECS: Record<string, ModelSpecs> = {
  "5400": {
    "page": "corvus-5400-continuous-ink-jet-coder",
    "specs": {
      "Print": "5400 & Prism",
      "Printhead with 2M conduit, standard": "MK7",
      "Printhead/conduit options": "4M, 90D,Short Reach 90D",
      "Max lines of print": "3 standard, 5 optional",
      "Character Height Range": "0.04\" to 0.54\"",
      "Max speed; single line print": "1,230 fpm",
      "Ink Range": "Dye Based, Pigmented with Prism",
      "Automatic date codes, sequential numbering": "Yes",
      "Timed messages": "Yes",
      "Graphics/Logo printing": "Yes",
      "Barcodes, common linear and 2D Datamatrix": "Yes",
      "Memory capacity (number of messages)": "999",
      "Touch Screen": "No",
      "Logojet PC Based message and logo creation software and DDE Driver Software": "Optional",
      "RS232 port": "Yes",
      "Ethernet Option": "Yes",
      "Parallel I/O Option": "Yes",
      "USB port for message and printer setting back up and restore": "Yes",
      "Shaft encoder, product detector, external single stage alarm, volt-free contact alarm connection": "Yes",
      "Ingress Protection rating": "IP55, optional IP65. Prism IP65 as standard",
      "Base and Enclosure": "Stainless Steel",
      "Operating temperature range": "41-113°F",
      "Humidity Range (r.h., non-condensing)": "90% max",
      "Power Supply": "100-230V 50/60 Hz",
      "Power Consumption": "200W",
      "Weight": "46.3-52.9 lbs",
      "Regulatory approvals": "TÜV/GS, CE mark, FCC, RoHS"
    }
  },
  "5400 IP65": {
    "page": "corvus-5400-continuous-ink-jet-coder",
    "specs": {
      "Print": "5400 & Prism",
      "Printhead with 2M conduit, standard": "MK7",
      "Printhead/conduit options": "4M, 90D,Short Reach 90D",
      "Max lines of print": "3 standard, 5 optional",
      "Character Height Range": "0.04\" to 0.54\"",
      "Max speed; single line print": "1,230 fpm",
      "Ink Range": "Dye Based, Pigmented with Prism",
      "Automatic date codes, sequential numbering": "Yes",
      "Timed messages": "Yes",
      "Graphics/Logo printing": "Yes",
      "Barcodes, common linear and 2D Datamatrix": "Yes",
      "Memory capacity (number of messages)": "999",
      "Touch Screen": "No",
      "Logojet PC Based message and logo creation software and DDE Driver Software": "Optional",
      "RS232 port": "Yes",
      "Ethernet Option": "Yes",
      "Parallel I/O Option": "Yes",
      "USB port for message and printer setting back up and restore": "Yes",
      "Shaft encoder, product detector, external single stage alarm, volt-free contact alarm connection": "Yes",
      "Ingress Protection rating": "IP55, optional IP65. Prism IP65 as standard",
      "Base and Enclosure": "Stainless Steel",
      "Operating temperature range": "41-113°F",
      "Humidity Range (r.h., non-condensing)": "90% max",
      "Power Supply": "100-230V 50/60 Hz",
      "Power Consumption": "200W",
      "Weight": "46.3-52.9 lbs",
      "Regulatory approvals": "TÜV/GS, CE mark, FCC, RoHS"
    }
  },
  "5400 Prism": {
    "page": "corvus-5400-continuous-ink-jet-coder",
    "specs": {
      "Print": "5400 & Prism",
      "Printhead with 2M conduit, standard": "MK7",
      "Printhead/conduit options": "4M, 90D,Short Reach 90D",
      "Max lines of print": "3 standard, 5 optional",
      "Character Height Range": "0.04\" to 0.54\"",
      "Max speed; single line print": "1,230 fpm",
      "Ink Range": "Dye Based, Pigmented with Prism",
      "Automatic date codes, sequential numbering": "Yes",
      "Timed messages": "Yes",
      "Graphics/Logo printing": "Yes",
      "Barcodes, common linear and 2D Datamatrix": "Yes",
      "Memory capacity (number of messages)": "999",
      "Touch Screen": "No",
      "Logojet PC Based message and logo creation software and DDE Driver Software": "Optional",
      "RS232 port": "Yes",
      "Ethernet Option": "Yes",
      "Parallel I/O Option": "Yes",
      "USB port for message and printer setting back up and restore": "Yes",
      "Shaft encoder, product detector, external single stage alarm, volt-free contact alarm connection": "Yes",
      "Ingress Protection rating": "IP55, optional IP65. Prism IP65 as standard",
      "Base and Enclosure": "Stainless Steel",
      "Operating temperature range": "41-113°F",
      "Humidity Range (r.h., non-condensing)": "90% max",
      "Power Supply": "100-230V 50/60 Hz",
      "Power Consumption": "200W",
      "Weight": "46.3-52.9 lbs",
      "Regulatory approvals": "TÜV/GS, CE mark, FCC, RoHS"
    }
  },
  "6400": {
    "page": "corvus-6400-continuous-inkjet-printer",
    "specs": {
      "Print head": "Mk11 Standard, Mk11 right-angle",
      "Print head - conduit options": "2M (standard), 4M, 6M",
      "Max lines of print": "6400/6410: 3 lines 6420/6440: 5 lines",
      "Character height range": "6400/6410: 0.07″ – 0.34″ 6420/6440: 0.07″ – 0.47″",
      "Max speed single line": "6400: up to 574 fpm 6410/6420: up to 1,433 fpm 6440: up to 1,791 fpm",
      "Ink delivery system": "Fluid cartridges",
      "Automatic date codes, sequentiel numbering": "6400/6410: Single range 6420/6440: Multiple ranges",
      "Graphics/Logo printing": "Yes, via imported bitmap files using USB port",
      "Barcodes": "ITF 2of5, Code 39, Code 128, EAN 8, EAN 13, UPCA, Pharmacode, Data Matrix, QR Code",
      "Ingress protection rating": "6400/6410/6420: IP55 6440: IP65"
    }
  },
  "6400LI": {
    "page": "corvus-6400-continuous-inkjet-printer",
    "specs": {
      "Print head": "Mk11 Standard, Mk11 right-angle",
      "Print head - conduit options": "2M (standard), 4M, 6M",
      "Max lines of print": "6400/6410: 3 lines 6420/6440: 5 lines",
      "Character height range": "6400/6410: 0.07″ – 0.34″ 6420/6440: 0.07″ – 0.47″",
      "Max speed single line": "6400: up to 574 fpm 6410/6420: up to 1,433 fpm 6440: up to 1,791 fpm",
      "Ink delivery system": "Fluid cartridges",
      "Automatic date codes, sequentiel numbering": "6400/6410: Single range 6420/6440: Multiple ranges",
      "Graphics/Logo printing": "Yes, via imported bitmap files using USB port",
      "Barcodes": "ITF 2of5, Code 39, Code 128, EAN 8, EAN 13, UPCA, Pharmacode, Data Matrix, QR Code",
      "Ingress protection rating": "6400/6410/6420: IP55 6440: IP65"
    }
  },
  "HP 0.5\"": {
    "page": "tj500-thermal-jet-printhead",
    "specs": {
      "Controller": "HR2600 handheld",
      "Touchscreen display": "7\" color",
      "Operator interface": "Graphical user interface, WYSIWYG",
      "QWERTY keypad": "Touchscreen pop-up, Unicode compatible",
      "Enclosure": "Industrial thermoplastic, drop resistant",
      "Memory": "512 MB",
      "Connectivity": "1-Ethernet, 1-USB, 2-RS232",
      "IO interface": "No",
      "Auto codes": "Time, date, use by, Julian, count, user defined, shifts, variable input",
      "Barcodes": "UPC, GTIN, I2of5, 128, Code 39, EAN, UCC, 2D Data Matrix, QR",
      "Logos": "BMP, JPEG, TIF, PNG",
      "Fonts": "TrueType available",
      "Windows PC GUI software": "Graphical user interface, WYSIWYG editor",
      "Networking software w/ database": "No",
      "Direct interface": "Protocol provided",
      "Technology": "Thermal et with HP inkjet technology",
      "Print height": "1/2\" & 1\" print heads",
      "Print resolution": "300 x 300 DPI",
      "Standard print speeds": "Up to 200 FPM",
      "Print speeds w/ reduced resolution": "Up to 500 FPM",
      "Print options": "Side, top down",
      "Print distance": "Up to 1/4\"",
      "Ink delivery": "Cartridge",
      "Ink supplies": "42 ml",
      "Ink types": "Porous & non-porous inks Water based for porous & aqueous coated cartons, solvent based for non- porous stock",
      "Regulatory listings": "TUV (CE/CSA/UL)",
      "Operating environment": "50°F to 104°F"
    }
  },
  "HP 1.0\"": {
    "page": "tj1000-thermal-jet-printhead",
    "specs": {
      "Controller": "HR2600 Hand Held",
      "Touch Screen Display": "7\" Color",
      "Operator Interface": "Graphical User Interface, WYSIWYG",
      "QWERTY Keypad": "Touchscreen Pop-up, Unicode Compatible",
      "Enclosure": "Industrial Thermoplastic, Drop Resistant",
      "Memory": "512 MB",
      "Connectivity": "1-Ethernet, 1-USB, 2-RS232",
      "IO Interface": "No",
      "Auto Codes": "Time, Date, Use By, Julian, Count, User Defined, Shifts, Variable Input",
      "Bar Codes": "GTIN, UPC, 12of5, Code 128, GS1-128, Code 39, EAN, UCC, 2D Data Matrix, QR",
      "Logos": "BMP, JPEG, TIF, PNG",
      "Fonts": "TrueType Available",
      "Windows PC GUI Software": "Graphical User Interface, WYSIWYG Editor",
      "Networking Software w/Database": "No",
      "Direct Interface": "Protocol Provided",
      "Technology": "Thermal Jet (HP)",
      "Print Height": "1/2\" & 1\" Print Heads",
      "Print Resolution": "300 x 300 dpi",
      "Standard Print Speeds": "Up to 200 fpm",
      "Print Speeds w/reduced resolution": "Up to 500fpm",
      "Print Options": "Side, Top Down",
      "Print Distance": "Up to 1/4\"",
      "Ink Delivery": "Cartridge",
      "Ink Supplies": "42 ml",
      "Ink Types": "Porous & Non-Porous inks Water Based for porous & aqueous coated cartons, Solvent Based for non- porous stock",
      "Regulatory Listings": "TUV (CE/CSA/UL)",
      "Operating Environment": "50° F to 104° F (10° C to 40° C)"
    }
  },
  "IV18": {
    "page": "iv18-dot-integrated-valve-print-head",
    "specs": {
      "Controller": "HR2600 HH",
      "Touchscreen display": "7\" plastic color",
      "Operator interface": "Graphical user interface, WYSIWYG editor",
      "QWERTY keypad": "Pop up on touchscreen",
      "Enclosure": "Stainless steel, environmentally sealed",
      "Memory": "512 MB for unlimited message storage",
      "Connectivity": "1 - Ethernet, 1 - USB, 2 - RS232",
      "IO interface": "IO board optional",
      "Auto codes": "Time, date, use by, Julian, count, user defined, shifts, variable input",
      "Logos": "Bitmap images, multiple formats",
      "Fonts": "Arial Standard, True Type available",
      "Window PC GUI software": "Graphical user interface, WYSIWYG editor",
      "Networking software w/ database": "Yes",
      "Direct interface": "Protocol provided",
      "Technology": "Drop on demand (integrated valve jet)",
      "Print height": "1\" and 2\" print heads",
      "Print resolution": "8 x 25 DPI",
      "Standard print speeds": "Up to 200 FPM",
      "Print speeds w/ reduced resolution": "Up to 650 FPM",
      "Print options": "Side, angled, top down, bottom up",
      "Print distance": "Up to 1/2\"",
      "Ink delivery": "Large bulk supply",
      "Ink supplies": "5 & 30 gallon",
      "Ink types": "Porous, non-porous, water based, solvent based (including non-VOC solvent inks)",
      "Regulatory listings": "TUV (CE/CSA/UL)",
      "Operating environment": "40°F to 104°F"
    }
  },
  "IV9": {
    "page": "iv9-dot-integrated-valve-print-head",
    "specs": {
      "Controller": "HR2600 HH",
      "Touchscreen display": "7\" plastic color",
      "Operator interface": "Graphical user interface, WYSIWYG editor",
      "QWERTY keypad": "Pop up on touchscreen",
      "Enclosure": "Stainless steel, environmentally sealed",
      "Memory": "512 MB for unlimited message storage",
      "Connectivity": "1 - Ethernet, 1 - USB, 2 - RS232",
      "IO interface": "IO board optional",
      "Auto codes": "Time, date, use by, Julian, count, user defined, shifts, variable input",
      "Logos": "Bitmap images, multiple formats",
      "Fonts": "Arial Standard, True Type available",
      "Window PC GUI software": "Graphical user interface, WYSIWYG editor",
      "Networking software w/ database": "Yes",
      "Direct interface": "Protocol provided",
      "Technology": "Drop on demand (integrated valve jet)",
      "Print height": "1/2\" and 7/8\"",
      "Print resolution": "9 x 25 DPI",
      "Standard print speeds": "Up to 200 FPM",
      "Print speeds w/ reduced resolution": "Up to 650 FPM",
      "Print options": "Side, angled, top down, bottom up",
      "Print distance": "Up to 1/2\"",
      "Ink delivery": "Large bulk supply",
      "Ink supplies": "5 & 30 gallon",
      "Ink types": "Porous, non-porous, Water based, solvent Based (including non-VOC solvent inks)",
      "Regulatory Listings": "TUV (CE/CSA/UL)",
      "Operating environment": "40°F to 104°F"
    }
  },
  "LB5200/LS7000": {
    "page": "la7000-automated-labeling-machine",
    "specs": {
      "Dimensions": "31” (787 mm) L x 27” (686 mm) H x 26” (660 mm) D",
      "Certifications": "IEC 61000-6-2 2005/AC:2005 Immunity, IEC 61000-6-4 2007/A1: 2011 Emission, FCC Part 15b, CSA CAN/CSA-C22.2 No. 62368-1:2014, UL62368-1:2014",
      "Supply Roll Capacity": "14” (355.6 mm) OD",
      "Core Diameter": "3” (76.2 mm) ID",
      "Label Length": "1” (25.4 mm) Min. to 22” (558.8 mm) Max.",
      "Label Width": "NARROW: 0.5” (12.7 mm) Min. to 6” (152.4 mm) Max.",
      "Temperature": "41°F - 104°F (5°C - 40°C)",
      "Humidity": "10 to 85% Relative Humidity, Non-Condensing",
      "E-Tamp": "98 lbs (44.5 kg) (includes yoke, no stand)",
      "E-WASA": "98 lbs (44.5 kg) (includes yoke, no stand)",
      "E-FASA": "101 lbs (45.8 kg)",
      "Chi-Stand": "83 lbs (37.6 kg)",
      "High Speed Tamp": "98 lbs (44.5 kg) (includes yoke, no stand)",
      "Wipe": "±0.06” (±1.6 mm)",
      "E-Tamp Blow": "±0.09” (±2.4 mm)"
    }
  },
  "PH4": {
    "page": "corvus-6400-continuous-inkjet-printer",
    "specs": {
      "Print head": "Mk11 Standard, Mk11 right-angle",
      "Print head - conduit options": "2M (standard), 4M, 6M",
      "Max lines of print": "6400/6410: 3 lines 6420/6440: 5 lines",
      "Character height range": "6400/6410: 0.07″ – 0.34″ 6420/6440: 0.07″ – 0.47″",
      "Max speed single line": "6400: up to 574 fpm 6410/6420: up to 1,433 fpm 6440: up to 1,791 fpm",
      "Ink delivery system": "Fluid cartridges",
      "Automatic date codes, sequentiel numbering": "6400/6410: Single range 6420/6440: Multiple ranges",
      "Graphics/Logo printing": "Yes, via imported bitmap files using USB port",
      "Barcodes": "ITF 2of5, Code 39, Code 128, EAN 8, EAN 13, UPCA, Pharmacode, Data Matrix, QR Code",
      "Ingress protection rating": "6400/6410/6420: IP55 6440: IP65"
    }
  },
  "MK5": {
    "page": "corvus-6400-continuous-inkjet-printer",
    "specs": {
      "Print head": "Mk11 Standard, Mk11 right-angle",
      "Print head - conduit options": "2M (standard), 4M, 6M",
      "Max lines of print": "6400/6410: 3 lines 6420/6440: 5 lines",
      "Character height range": "6400/6410: 0.07″ – 0.34″ 6420/6440: 0.07″ – 0.47″",
      "Max speed single line": "6400: up to 574 fpm 6410/6420: up to 1,433 fpm 6440: up to 1,791 fpm",
      "Ink delivery system": "Fluid cartridges",
      "Automatic date codes, sequentiel numbering": "6400/6410: Single range 6420/6440: Multiple ranges",
      "Graphics/Logo printing": "Yes, via imported bitmap files using USB port",
      "Barcodes": "ITF 2of5, Code 39, Code 128, EAN 8, EAN 13, UPCA, Pharmacode, Data Matrix, QR Code",
      "Ingress protection rating": "6400/6410/6420: IP55 6440: IP65"
    }
  },
  "MK7": {
    "page": "corvus-6400-continuous-inkjet-printer",
    "specs": {
      "Print head": "Mk11 Standard, Mk11 right-angle",
      "Print head - conduit options": "2M (standard), 4M, 6M",
      "Max lines of print": "6400/6410: 3 lines 6420/6440: 5 lines",
      "Character height range": "6400/6410: 0.07″ – 0.34″ 6420/6440: 0.07″ – 0.47″",
      "Max speed single line": "6400: up to 574 fpm 6410/6420: up to 1,433 fpm 6440: up to 1,791 fpm",
      "Ink delivery system": "Fluid cartridges",
      "Automatic date codes, sequentiel numbering": "6400/6410: Single range 6420/6440: Multiple ranges",
      "Graphics/Logo printing": "Yes, via imported bitmap files using USB port",
      "Barcodes": "ITF 2of5, Code 39, Code 128, EAN 8, EAN 13, UPCA, Pharmacode, Data Matrix, QR Code",
      "Ingress protection rating": "6400/6410/6420: IP55 6440: IP65"
    }
  },
  "MK9": {
    "page": "corvus-6400-continuous-inkjet-printer",
    "specs": {
      "Print head": "Mk11 Standard, Mk11 right-angle",
      "Print head - conduit options": "2M (standard), 4M, 6M",
      "Max lines of print": "6400/6410: 3 lines 6420/6440: 5 lines",
      "Character height range": "6400/6410: 0.07″ – 0.34″ 6420/6440: 0.07″ – 0.47″",
      "Max speed single line": "6400: up to 574 fpm 6410/6420: up to 1,433 fpm 6440: up to 1,791 fpm",
      "Ink delivery system": "Fluid cartridges",
      "Automatic date codes, sequentiel numbering": "6400/6410: Single range 6420/6440: Multiple ranges",
      "Graphics/Logo printing": "Yes, via imported bitmap files using USB port",
      "Barcodes": "ITF 2of5, Code 39, Code 128, EAN 8, EAN 13, UPCA, Pharmacode, Data Matrix, QR Code",
      "Ingress protection rating": "6400/6410/6420: IP55 6440: IP65"
    }
  },
  "PL6300/LS7100": {
    "page": "pa7100-print-and-apply-labeler",
    "specs": {
      "Print Engines": "Available with Palisade or Kestrel print engines",
      "Dimensions (with yoke)": "31″L x 27″H x 26″D",
      "Supply Roll Capacity": "14\" OD",
      "Core Diameter": "3\" ID",
      "Label Length": "0.5\" min. to 14\" max.",
      "Label Width": "0.5\" min. to 6.5\" max.",
      "Line Speed": "E-Tamp: 150 FPM max. E-FASA: 75 FPM max.",
      "Temperature": "41°F - 104°F",
      "Humidity": "10-85% relative humidity, non-condensing",
      "Controllers": "Touch One, HH-4000",
      "Certifications": "IEC 61000-6-2 2005/AC: 2005 Immunity, IEC 61000-6-4 2007/A1: 2011 Emission, FCC Part 15b, CSA CAN/CSA-C22.2 No. 62368-1:2014, UL62368-1:2014"
    }
  },
  "SL1": {
    "page": "corvus-fsl20-fsl50-fiber-lasers",
    "specs": {
      "Laser Type": "Ytterbium (Yb) Pulsed Fiber Laser",
      "Laser Class": "4 (IV) (acc. To DIN EN 60825-1:2008-05)",
      "Nominal Laser Output": "20W and 50W",
      "Laser Wavelength": "Central Emission Wavelength: 1064 nm (min: 1055 nm, max: 1075 nm)",
      "Laser Source Life Expectancy": ">100,000 Hours",
      "Marking Speed": "Up to 236 in/s (6,000 mm/s)",
      "No of Lines of Text": "Only Limited by Character Size and Marking Field",
      "Character Height": "Up to Marking Field",
      "Print Rotation": "0-360 Degrees",
      "Weight (Marking Unit/Supply Unit)": "17.6 lb / 41.8 lb",
      "Laser Head Protection Class": "IP54",
      "Conduit Length": "8.8 ft (2.7m)",
      "Compactmum Bend Radius of Conduit": "2.3 in (60 mm)",
      "Head Mounting Options": "90-Degree (Standard), Straight-Out (Option)",
      "Cooling System": "Air Cooled with Automatic Overheat Detection",
      "Supply Voltage/Frequency": "Auto-selection range 100 to 240 V/ 50/60 Hz (Auto Range)",
      "Maximum Power Consumption": "500 VA",
      "Operating Temperature Range": "50-104°F Ambient",
      "Fonts": "Standard (Windows® TrueType®/TTF; PostScript®/PFA, PFB; OpenType®/OTF)",
      "Graphics": "Yes (DXF, JPG, AI)",
      "Sequence & Serial Numbering": "Automatic Date, Layer, Time Coding, Real-Time Click, Online Coding of Individual Data (Weight, Contents, etc.), Serialization",
      "Encoder Inputs": "Dual Channel, 24 V, Hard Wire CHA; CHB; Index",
      "Product Sensor Input": "Single, PNP Only, 24 V, Hard Wire",
      "Ethernet (to PC)": "RJ45 Connector (100 Mb/s)",
      "Customer Interface": "Input and Output Signals are 0 V or +24 V",
      "Bi-Directional Signals": "RS-232 (TXD, RXD, CTS, RTS)"
    }
  },
  "SL101": {
    "page": "corvus-fsl20-fsl50-fiber-lasers",
    "specs": {
      "Laser Type": "Ytterbium (Yb) Pulsed Fiber Laser",
      "Laser Class": "4 (IV) (acc. To DIN EN 60825-1:2008-05)",
      "Nominal Laser Output": "20W and 50W",
      "Laser Wavelength": "Central Emission Wavelength: 1064 nm (min: 1055 nm, max: 1075 nm)",
      "Laser Source Life Expectancy": ">100,000 Hours",
      "Marking Speed": "Up to 236 in/s (6,000 mm/s)",
      "No of Lines of Text": "Only Limited by Character Size and Marking Field",
      "Character Height": "Up to Marking Field",
      "Print Rotation": "0-360 Degrees",
      "Weight (Marking Unit/Supply Unit)": "17.6 lb / 41.8 lb",
      "Laser Head Protection Class": "IP54",
      "Conduit Length": "8.8 ft (2.7m)",
      "Compactmum Bend Radius of Conduit": "2.3 in (60 mm)",
      "Head Mounting Options": "90-Degree (Standard), Straight-Out (Option)",
      "Cooling System": "Air Cooled with Automatic Overheat Detection",
      "Supply Voltage/Frequency": "Auto-selection range 100 to 240 V/ 50/60 Hz (Auto Range)",
      "Maximum Power Consumption": "500 VA",
      "Operating Temperature Range": "50-104°F Ambient",
      "Fonts": "Standard (Windows® TrueType®/TTF; PostScript®/PFA, PFB; OpenType®/OTF)",
      "Graphics": "Yes (DXF, JPG, AI)",
      "Sequence & Serial Numbering": "Automatic Date, Layer, Time Coding, Real-Time Click, Online Coding of Individual Data (Weight, Contents, etc.), Serialization",
      "Encoder Inputs": "Dual Channel, 24 V, Hard Wire CHA; CHB; Index",
      "Product Sensor Input": "Single, PNP Only, 24 V, Hard Wire",
      "Ethernet (to PC)": "RJ45 Connector (100 Mb/s)",
      "Customer Interface": "Input and Output Signals are 0 V or +24 V",
      "Bi-Directional Signals": "RS-232 (TXD, RXD, CTS, RTS)"
    }
  },
  "SL102": {
    "page": "corvus-fsl20-fsl50-fiber-lasers",
    "specs": {
      "Laser Type": "Ytterbium (Yb) Pulsed Fiber Laser",
      "Laser Class": "4 (IV) (acc. To DIN EN 60825-1:2008-05)",
      "Nominal Laser Output": "20W and 50W",
      "Laser Wavelength": "Central Emission Wavelength: 1064 nm (min: 1055 nm, max: 1075 nm)",
      "Laser Source Life Expectancy": ">100,000 Hours",
      "Marking Speed": "Up to 236 in/s (6,000 mm/s)",
      "No of Lines of Text": "Only Limited by Character Size and Marking Field",
      "Character Height": "Up to Marking Field",
      "Print Rotation": "0-360 Degrees",
      "Weight (Marking Unit/Supply Unit)": "17.6 lb / 41.8 lb",
      "Laser Head Protection Class": "IP54",
      "Conduit Length": "8.8 ft (2.7m)",
      "Compactmum Bend Radius of Conduit": "2.3 in (60 mm)",
      "Head Mounting Options": "90-Degree (Standard), Straight-Out (Option)",
      "Cooling System": "Air Cooled with Automatic Overheat Detection",
      "Supply Voltage/Frequency": "Auto-selection range 100 to 240 V/ 50/60 Hz (Auto Range)",
      "Maximum Power Consumption": "500 VA",
      "Operating Temperature Range": "50-104°F Ambient",
      "Fonts": "Standard (Windows® TrueType®/TTF; PostScript®/PFA, PFB; OpenType®/OTF)",
      "Graphics": "Yes (DXF, JPG, AI)",
      "Sequence & Serial Numbering": "Automatic Date, Layer, Time Coding, Real-Time Click, Online Coding of Individual Data (Weight, Contents, etc.), Serialization",
      "Encoder Inputs": "Dual Channel, 24 V, Hard Wire CHA; CHB; Index",
      "Product Sensor Input": "Single, PNP Only, 24 V, Hard Wire",
      "Ethernet (to PC)": "RJ45 Connector (100 Mb/s)",
      "Customer Interface": "Input and Output Signals are 0 V or +24 V",
      "Bi-Directional Signals": "RS-232 (TXD, RXD, CTS, RTS)"
    }
  },
  "SL301": {
    "page": "corvus-fsl20-fsl50-fiber-lasers",
    "specs": {
      "Laser Type": "Ytterbium (Yb) Pulsed Fiber Laser",
      "Laser Class": "4 (IV) (acc. To DIN EN 60825-1:2008-05)",
      "Nominal Laser Output": "20W and 50W",
      "Laser Wavelength": "Central Emission Wavelength: 1064 nm (min: 1055 nm, max: 1075 nm)",
      "Laser Source Life Expectancy": ">100,000 Hours",
      "Marking Speed": "Up to 236 in/s (6,000 mm/s)",
      "No of Lines of Text": "Only Limited by Character Size and Marking Field",
      "Character Height": "Up to Marking Field",
      "Print Rotation": "0-360 Degrees",
      "Weight (Marking Unit/Supply Unit)": "17.6 lb / 41.8 lb",
      "Laser Head Protection Class": "IP54",
      "Conduit Length": "8.8 ft (2.7m)",
      "Compactmum Bend Radius of Conduit": "2.3 in (60 mm)",
      "Head Mounting Options": "90-Degree (Standard), Straight-Out (Option)",
      "Cooling System": "Air Cooled with Automatic Overheat Detection",
      "Supply Voltage/Frequency": "Auto-selection range 100 to 240 V/ 50/60 Hz (Auto Range)",
      "Maximum Power Consumption": "500 VA",
      "Operating Temperature Range": "50-104°F Ambient",
      "Fonts": "Standard (Windows® TrueType®/TTF; PostScript®/PFA, PFB; OpenType®/OTF)",
      "Graphics": "Yes (DXF, JPG, AI)",
      "Sequence & Serial Numbering": "Automatic Date, Layer, Time Coding, Real-Time Click, Online Coding of Individual Data (Weight, Contents, etc.), Serialization",
      "Encoder Inputs": "Dual Channel, 24 V, Hard Wire CHA; CHB; Index",
      "Product Sensor Input": "Single, PNP Only, 24 V, Hard Wire",
      "Ethernet (to PC)": "RJ45 Connector (100 Mb/s)",
      "Customer Interface": "Input and Output Signals are 0 V or +24 V",
      "Bi-Directional Signals": "RS-232 (TXD, RXD, CTS, RTS)"
    }
  },
  "SL302": {
    "page": "corvus-fsl20-fsl50-fiber-lasers",
    "specs": {
      "Laser Type": "Ytterbium (Yb) Pulsed Fiber Laser",
      "Laser Class": "4 (IV) (acc. To DIN EN 60825-1:2008-05)",
      "Nominal Laser Output": "20W and 50W",
      "Laser Wavelength": "Central Emission Wavelength: 1064 nm (min: 1055 nm, max: 1075 nm)",
      "Laser Source Life Expectancy": ">100,000 Hours",
      "Marking Speed": "Up to 236 in/s (6,000 mm/s)",
      "No of Lines of Text": "Only Limited by Character Size and Marking Field",
      "Character Height": "Up to Marking Field",
      "Print Rotation": "0-360 Degrees",
      "Weight (Marking Unit/Supply Unit)": "17.6 lb / 41.8 lb",
      "Laser Head Protection Class": "IP54",
      "Conduit Length": "8.8 ft (2.7m)",
      "Compactmum Bend Radius of Conduit": "2.3 in (60 mm)",
      "Head Mounting Options": "90-Degree (Standard), Straight-Out (Option)",
      "Cooling System": "Air Cooled with Automatic Overheat Detection",
      "Supply Voltage/Frequency": "Auto-selection range 100 to 240 V/ 50/60 Hz (Auto Range)",
      "Maximum Power Consumption": "500 VA",
      "Operating Temperature Range": "50-104°F Ambient",
      "Fonts": "Standard (Windows® TrueType®/TTF; PostScript®/PFA, PFB; OpenType®/OTF)",
      "Graphics": "Yes (DXF, JPG, AI)",
      "Sequence & Serial Numbering": "Automatic Date, Layer, Time Coding, Real-Time Click, Online Coding of Individual Data (Weight, Contents, etc.), Serialization",
      "Encoder Inputs": "Dual Channel, 24 V, Hard Wire CHA; CHB; Index",
      "Product Sensor Input": "Single, PNP Only, 24 V, Hard Wire",
      "Ethernet (to PC)": "RJ45 Connector (100 Mb/s)",
      "Customer Interface": "Input and Output Signals are 0 V or +24 V",
      "Bi-Directional Signals": "RS-232 (TXD, RXD, CTS, RTS)"
    }
  },
  "SL501": {
    "page": "corvus-fsl20-fsl50-fiber-lasers",
    "specs": {
      "Laser Type": "Ytterbium (Yb) Pulsed Fiber Laser",
      "Laser Class": "4 (IV) (acc. To DIN EN 60825-1:2008-05)",
      "Nominal Laser Output": "20W and 50W",
      "Laser Wavelength": "Central Emission Wavelength: 1064 nm (min: 1055 nm, max: 1075 nm)",
      "Laser Source Life Expectancy": ">100,000 Hours",
      "Marking Speed": "Up to 236 in/s (6,000 mm/s)",
      "No of Lines of Text": "Only Limited by Character Size and Marking Field",
      "Character Height": "Up to Marking Field",
      "Print Rotation": "0-360 Degrees",
      "Weight (Marking Unit/Supply Unit)": "17.6 lb / 41.8 lb",
      "Laser Head Protection Class": "IP54",
      "Conduit Length": "8.8 ft (2.7m)",
      "Compactmum Bend Radius of Conduit": "2.3 in (60 mm)",
      "Head Mounting Options": "90-Degree (Standard), Straight-Out (Option)",
      "Cooling System": "Air Cooled with Automatic Overheat Detection",
      "Supply Voltage/Frequency": "Auto-selection range 100 to 240 V/ 50/60 Hz (Auto Range)",
      "Maximum Power Consumption": "500 VA",
      "Operating Temperature Range": "50-104°F Ambient",
      "Fonts": "Standard (Windows® TrueType®/TTF; PostScript®/PFA, PFB; OpenType®/OTF)",
      "Graphics": "Yes (DXF, JPG, AI)",
      "Sequence & Serial Numbering": "Automatic Date, Layer, Time Coding, Real-Time Click, Online Coding of Individual Data (Weight, Contents, etc.), Serialization",
      "Encoder Inputs": "Dual Channel, 24 V, Hard Wire CHA; CHB; Index",
      "Product Sensor Input": "Single, PNP Only, 24 V, Hard Wire",
      "Ethernet (to PC)": "RJ45 Connector (100 Mb/s)",
      "Customer Interface": "Input and Output Signals are 0 V or +24 V",
      "Bi-Directional Signals": "RS-232 (TXD, RXD, CTS, RTS)"
    }
  },
  "XL Series": {
    "page": "thorne-xl5000",
    "specs": {
      "Print Area (HxW) Intermittent": "53 x 80 mm (2.1 x 3.1 inches)",
      "Print Area (HxW) Continuous": "53 x 300 mm (2.1 x 11.8 inches)",
      "Print Speed Intermittent": "75mm/sec to 400mm/sec (3 in/sec to 15.7 in/sec)",
      "Print Speed Continuous": "75mm/sec to 450mm/sec (3 in/sec to 17.7 in/sec)",
      "Performance IM at 5mm Print Height": "450 prints per minute",
      "Performance CM at 5mm Print Height": "250 prints per minute",
      "Print Resolution": "300 dpi",
      "Dimensions Printer (HxWxD)": "178 x 212 x 246 mm",
      "Weight": "8 kg (17.6 lb)",
      "Ribbon Type": "Outside coated",
      "Ribbon Width": "55 mm",
      "Air Pressure": "5 bar",
      "Operating Environment": "5-40°C, humidity 20-75% non-condensing",
      "IP Rate": "IP 20",
      "Standard and Opposite Version Available": "Yes",
      "Voltage": "100-240 VAC",
      "Frequency": "50-60 Hz",
      "Current": "2A",
      "Controller": "a:touch Lite, a:touch2",
      "Automatic Functions": "Real time, various date formats (with offset), counter, variable field, formula",
      "Fonts": "3 Internal fonts (New Gothic Bold compatibility font, Swiss 721 Bold, Swiss 721 Roman), mirror print, up to 12 fonts expandable by the customer",
      "Internal Barcodes": "2/5 interleaved, Code39, UPC, EAN8, EAN13, Code93, DUN14, Code128, EAN128, Databar, Databar trunced/limited/stickered/omnidirectional, Datamatrix, GS1-Datamatrix",
      "Communication": "Ethernet, RS232",
      "General Error": "Yes",
      "Inhibit": "Yes",
      "Print on Cycle": "Yes",
      "Encoder Signal": "Yes"
    }
  }
};

/** What the page says about this model, or null. */
export function specsFor(model?: string | null): ModelSpecs | null {
  if (!model) return null;
  /* The captured axim.example pages first, then anything a vendor publishes that the
     capture could never hold — a Palisade print engine is documented by Palisade, and the
     Corvus 7300 series has figures on axim.example's page but no table. */
  return MODEL_SPECS[model] ?? VENDOR_SPECS[model] ?? null;
}
