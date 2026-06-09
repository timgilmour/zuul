# Subject Module — Vehicles

For spacecraft, aircraft, ground vehicles, naval craft, and fantastical conveyances. Supplies the **view selector** and vehicle **detail vocabulary**. Combine with the universal `core/render-rules.md`.

Unlike characters (which pose), vehicles are *viewed* — the camera angle is the main compositional choice.

## Prompt assembly

```
[<VIEW PHRASE> from the view selector] + [chosen style prompt from vocabulary/styles.json (default clean-mesh-gen)]
Concept reference of <SUBJECT>, <SCALE CONTEXT>. <DETAILS: hull, propulsion, features, wear, palette>.
```

| Slot | Fill with | Example |
|------|-----------|---------|
| `<VIEW PHRASE>` | from the view selector below | `Three-quarter front view, slightly above eye level` |
| `<SUBJECT>` | vehicle noun phrase, genre-inflected | `a battered rebel starfighter` |
| `<SCALE CONTEXT>` | optional scale cue | `single-pilot fighter-class` or omit |
| `<DETAILS>` | hull, propulsion, features, wear, palette | `angular matte hull panels, twin rear thrusters, scorched heat shields, slate grey + orange accent stripe` |

## View selector

Pick one view per render. For mesh gen, **3/4 front is the default** — it reveals two faces simultaneously and gives depth cues that pure front cannot.

| View | Framing phrase | Aspect | Best for |
|------|----------------|--------|----------|
| **3/4 front** *(default)* | `Three-quarter front view, slightly above eye level, showing front face and one full side` | `3:2` | Mesh gen — primary render |
| **Side** | `Pure orthographic side profile, perfectly level camera, no perspective distortion` | `16:9` | Side reference sheet, multi-view decks |
| **Front** | `Pure orthographic front view, perfectly level camera, no perspective distortion` | `4:3` | Front reference, symmetric subjects |
| **Top-down** | `Orthographic top-down plan view, straight overhead camera` | `1:1` | Footprint, deck layout reference |
| **Rear** | `Pure orthographic rear view, perfectly level camera` | `4:3` | Engine / thruster detail reference |

For a full multi-view reference deck, render all five and composite manually.

## Vehicle vocabulary

### Vehicle type (by genre)

| Genre | Types |
|-------|-------|
| **Fantasy** | war-galleon, longship, war-galley, war-chariot, siege-engine, magical-barge, airship (cloth-and-wood), drake-sled |
| **Sci-Fi** | starfighter, interceptor, heavy bomber, gunship, dropship, shuttle, freighter, capital ship, dreadnought, scout probe, hoverbike, speeder, APC, mech-suit |
| **Steampunk** | steam-galleon, ironclad, clockwork-walker, aether-barge, ornithopter, armoured-train, dirigible, submarine |
| **Modern** | fighter jet, helicopter, attack helicopter, APC, main battle tank, submarine, destroyer, aircraft carrier, motorcycle, cargo truck |
| **Superhero** | supercar, armoured jet, power-armour (vehicle-scale), flying-fortress, orbital platform |
| **Xianxia** | flying-sword-platform, spirit-beast-carriage, cloud-boat, war-pagoda, cultivation-ship |

### Scale

Scale informs framing and how much cockpit/crew-space to suggest:

| Scale | Description | Examples |
|-------|-------------|---------|
| **Personal** | single operator | motorcycle, hoverbike, speeder, flying-sword-platform |
| **Crew** | 2–8 crew | starfighter, shuttle, helicopter, longship |
| **Platoon** | 8–50 | APC, dropship, gunship, ornithopter |
| **Strategic** | 50+ | capital ship, dreadnought, aircraft carrier, war-pagoda |

### Propulsion

| Type | Visual cues | Genres |
|------|-------------|--------|
| Thruster/jet | glowing exhaust ports, heat discolouration | scifi, steampunk, modern, superhero |
| Grav-plate | no visible exhaust, flat underbelly emitters | scifi, superhero |
| Sail/oar | mast, rigging, oar banks | fantasy, steampunk, xianxia |
| Steam-piston | visible piston rods, pressure vents, riveted boiler | steampunk |
| Combustion | exhaust stacks, radiator vents, rubber tyres | modern |
| Magic/qi | glowing runic engravings, levitation glow at base, no mechanical propulsion visible | fantasy, xianxia |

### Hull & wear

| Descriptor | Prompt phrase |
|------------|---------------|
| Pristine | `factory-fresh matte hull panels, clean edges, no wear` |
| Battle-worn | `scorch marks, hull dents, patched plating, asymmetric wear` |
| Rusted | `oxidation streaks, flaking metal, discolouration at joints` |
| Field-repaired | `mismatched replacement panels, visible weld seams, salvage parts` |
| Ancient | `moss or lichen growth, cracked hull, corroded fittings, age-pitting` |
| Ceremonial | `polished, decorative inlays, gilded trim, pennants or banners` |

### Hull material rules (critical for mesh gen)

- **Always matte** — `matte hull panels, no chrome, no polished metal, no wet surfaces`
- **Canopy/cockpit glass → opaque** — `opaque dark canopy, no transparent glass` (transparent surfaces fail reconstruction)
- **No reflective highlights** anywhere on the hull
- **Separated structures** — weapon hardpoints, engine nacelles, and wing tips should not overlap each other in the chosen view

## Genre visual guide

| Genre | Signature visual vocabulary |
|-------|-----------------------------|
| **Fantasy** | wood, rope, canvas sail, iron fittings, carved figureheads, lanterns |
| **Sci-Fi** | angular hull plating, glowing thruster ports, sensor arrays, hull numbers |
| **Steampunk** | riveted iron, exposed pistons, brass fittings, pressure gauges, smoke stacks |
| **Modern** | national markings, camouflage or civilian livery, rubber tyres, transparent canopy (→ make opaque) |
| **Superhero** | sleek aerodynamic silhouette, team livery colours, clean lines, minimal markings |
| **Xianxia** | carved jade or lacquered wood, golden script etchings, trailing spirit-energy wisps |

## Worked example

```
Three-quarter front view, slightly above eye level, showing front face and one full
side. Clean game concept art style, crisp readable silhouette, clear forms. Entire
subject in frame, centered with empty margin on all sides. Flat even diffuse studio
lighting, soft and shadowless, no rim light, no cast shadows. Matte surfaces, no
reflections, no glossy highlights. Pure white seamless background, single subject
fully isolated. Sharp focus, high detail. Concept reference of a battered rebel
starfighter, single-pilot fighter-class. Angular matte grey hull panels, twin rear
thruster pods with glowing orange exhaust rings, swept-back delta wings with battle
damage along the leading edges, scorched heat shields below the nose, asymmetric
field-repair patch on the port wing, opaque dark cockpit canopy, hull number
stencilled on the fuselage, no chrome, no reflective surfaces.
```

Generation command:
```bash
bun run <ZUUL>/tools/generate-image.ts \
  --prompt "..." \
  --model nano-banana-2 \
  --size 2K \
  --aspect-ratio 3:2 \
  --output <OUTPUT_DIR>/concepts/vehicles/rebel-starfighter/rebel-starfighter-01.png
```

## Vehicle pool & lookup

Vehicles live in the tagged pool `vocabulary/vehicles.json` (same model as roles). Each entry: `id`, `label`, `applies_to` (genre ids / sub-genre ids / `"*"`), `prompt_fragments[]`, `view`, `aspect`.

**Lookup:** filter `vehicles.json` to entries whose `applies_to` contains the chosen genre id, the sub-genre id, or `"*"`. Pick by fit, then use the vehicle's `prompt_fragments` for `<DETAILS>` and its `view` / `aspect` for framing. The starter pool covers `rebel-starfighter`, `imperial-dreadnought`, `goblin-war-barge`, `steampunk-ironclad`, `hover-apc`, `ornithopter`, `xianxia-cloud-boat`, `attack-helicopter`.

### Creating a new vehicle (the pool grows as you use it)

If the user wants a vehicle the pool doesn't cover, **create it** — same flow as roles:
1. **Draft**: `id` (kebab-case), `label`, `applies_to` (narrowest accurate — genre id for a whole tonal genre, explicit sub-genre id(s) for an era/setting-bound craft, `"*"` only if truly universal; avoid genre/era bleed), `prompt_fragments` (3–6 concrete hull/propulsion/feature/wear/palette phrases, matte/mesh-friendly), `view`, `aspect`.
2. **Confirm** the full drafted JSON with the user.
3. **Append** it to `vocabulary/vehicles.json` — no duplicate `id`.
4. **Validate**: `bun run tools/validate-vocab.mjs` → `OK`.
5. **Use** it for the render.

## Batch render snippet (PowerShell)

```powershell
$out = "<OUTPUT_DIR>/concepts/vehicles"
$subjects = @{
  "rebel-starfighter" = @{
    prompt = "Three-quarter front view, slightly above eye level, showing front face and one full side. Clean game concept art style, crisp readable silhouette. Entire subject in frame, centered with margin, no foreshortening. Flat even diffuse shadowless lighting, no rim light, no cast shadows. Matte surfaces, no reflections. Pure white seamless background, single subject isolated. Sharp focus, high detail. Concept reference of a battered single-pilot rebel starfighter. Angular matte grey hull panels, twin rear thruster pods with glowing orange exhaust rings, swept-back delta wings with battle damage, scorched heat shields, opaque dark cockpit canopy, hull number stencil, no chrome, no reflective surfaces."
    aspect  = "3:2"
  }
}
foreach ($s in $subjects.GetEnumerator()) {
  $dir = "$out/$($s.Key)"; New-Item -ItemType Directory -Force -Path $dir | Out-Null
  bun run <ZUUL>/tools/generate-image.ts `
    --prompt $s.Value.prompt --model nano-banana-2 --size 2K `
    --aspect-ratio $s.Value.aspect `
    --output "$dir/$($s.Key)-01.png"
}
```
