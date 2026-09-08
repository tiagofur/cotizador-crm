#!/bin/bash
# Genera imágenes render de los tipos de mueble para el catálogo
cd /home/z/my-project
OUT="public/uploads/furniture"
mkdir -p "$OUT"
STYLE="professional 3D product render for furniture catalog, modern kitchen cabinet with clean white melamine body and light natural oak wood door fronts with slim metal handle, plain pure white studio background, soft floor shadow, slight three-quarter perspective view, photorealistic, high quality, no text, no watermark"

gen() {
  local name="$1"; shift
  local desc="$1"; shift
  local size="${1:-1024x1024}"
  if [ -s "$OUT/$name.png" ]; then echo "skip $name"; return; fi
  z-ai image -p "$desc, $STYLE" -o "$OUT/$name.png" -s "$size" && echo "OK $name" || echo "FAIL $name"
}

gen "ala-1pu"    "single wall-mounted kitchen cabinet with one vertical door, floating wall cabinet" 
gen "ala-2pu"    "wall-mounted kitchen cabinet with two vertical doors side by side"
gen "ala-bas"    "wide horizontal wall-mounted kitchen cabinet with a single lift-up horizontal flap door"
gen "ala-nic"    "open wall-mounted kitchen shelf unit with no doors showing two interior shelves"
gen "ala-mic"    "open wall-mounted kitchen niche cubby for a microwave oven, no doors, one open compartment"
gen "ala-rin"    "wall-mounted corner kitchen cabinet with angled front door for corner installation"
gen "gab-1pu"    "single base kitchen cabinet with one vertical door, floor standing cabinet"
gen "gab-2pu"    "base kitchen cabinet with two vertical doors side by side, floor standing"
gen "gab-3ca"    "base kitchen cabinet with three stacked horizontal drawers"
gen "gab-rin"    "base corner kitchen cabinet with countertop sink cutout visible on top, corner unit"
gen "gab-nic"    "narrow open base kitchen cabinet niche with no doors, single open compartment"
gen "tar"        "base kitchen sink cabinet with white countertop and rectangular sink cutout on top, two doors"
gen "des-1pu"    "tall freestanding kitchen pantry cabinet with one long vertical full-height door, 864x1152"
gen "des-2pu"    "tall freestanding kitchen pantry cabinet with two long vertical full-height doors, 864x1152"
gen "des-hor"    "tall kitchen cabinet tower with open niches in the middle for built-in oven and microwave, doors top and bottom, 864x1152"
gen "des-hor3ca" "tall kitchen cabinet tower with open oven and microwave niches in middle and three drawers at the bottom, 864x1152"
gen "des-nic"    "tall open kitchen pantry shelving unit with no doors and four open shelves, 864x1152"
gen "panel"      "flat rectangular kitchen finishing side panel standing vertically, thin wooden board"
gen "zoclo"      "long thin rectangular wooden kickboard strip plank for kitchen base, horizontal board"
echo "DONE"
