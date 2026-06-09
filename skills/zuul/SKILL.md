---
name: zuul
description: Use when the user wants concept art of a fictional subject (character, creature, vehicle, mech, prop, weapon) — especially renders optimized for single-image image-to-3D mesh generators (Meshy, Tripo, Hunyuan3D, Rodin); when they mention T-pose, A-pose, turnaround, or character sheet; when they provide a reference image to describe, re-render, or ingest; or when they name a D&D / sci-fi / fantasy subject and want a render or concept.
---

# Zuul

Generate clean, isolated concept-art renders of fictional subjects — optimized for single-image image-to-3D mesh generators and cinematic pre-production.

> There is no `/art`. There is only Zuul.

## When to use / routing

- **Character, creature, humanoid, or biped** → read `subjects/characters.md`
- **Vehicle, ship, aircraft, or ground craft** → read `subjects/vehicles.md`
- **Prop, weapon, artifact, or object** → read `subjects/props.md`
- **User provided a reference image to analyze, re-render, or ingest** → read `core/ingest-image.md`

## Setup (first run)

The generator is a Bun script with one dependency (`@google/genai`). Dependencies are **not** committed — on first use, install them from the skill's `tools/` directory:

```bash
cd <zuul-skill-dir>/tools && bun install
```

Then set a provider key in `.env` (CWD) or `~/.claude/.env` — `GOOGLE_API_KEY` (Gemini), `GOOGLE_API_KEY_VERTEX`/`GOOGLE_CLOUD_PROJECT` (Vertex), or `OPENROUTER_KEY`. Run the tool with `--help` for the full list.

## Always read first

**Before writing any prompt:** read `core/render-rules.md` for the universal render rules, and pick a **style (core prompt)** from `vocabulary/styles.json` — the default `clean-mesh-gen` unless the user wants another. The chosen style's `prompt` is prepended verbatim to every generation prompt, with the `<FRAMING>` slot filled in. (`mesh_safe: false` styles relax the mesh-gen rules and pair with observed poses.)

Then read the matching `subjects/` file for framing and pose vocabulary.

For character/creature subjects: look up species, genre/sub-genre, role, and descriptors in the structured `vocabulary/` JSON files (`species.json`, `genre.json` + `subgenres.json`, the tagged `roles.json` pool, `descriptors.json`, `intersections.json`) to assemble the `<DETAILS>` slot from authoritative `prompt_fragments[]` arrays. See `subjects/characters.md` for the full lookup sequence, and **`core/assembly.md` for the slot model and merge rules** that resolve those fragments into a coherent `<DETAILS>` without contradictions.

Then reference the prose `vocabulary/` markdown files as needed for theme, material, environment, and palette language.

## Guided workflow

When the user hasn't specified all dimensions, ask **one question at a time**. Never ask multiple questions in one message. Present options as a numbered list.

Typical question sequence:
1. Subject type (character, creature, vehicle, prop)
2. Genre — pick a top-level genre from `vocabulary/genre.json` (Fantasy, Horror, Sci-Fi, Modern, Science Fantasy, Historical, Western)
3. Sub-genre — pick a sub-genre of that genre from `vocabulary/subgenres.json`
4. Specific identity (name, role, species) — look up species in `vocabulary/species.json`; pick a role by filtering `vocabulary/roles.json` on the chosen genre/sub-genre (see `subjects/characters.md`). **If no role fits, create one and save it to the pool** (see `subjects/characters.md` → "Creating a new role"). Check `vocabulary/intersections.json` for matching rules
5. Pose — offer poses from `vocabulary/poses.json`, filtered by the subject's body plan (from the species' `body_plan` field in `vocabulary/species.json`; the creature's shape — `quadruped`/`winged`/`floating` — otherwise). Prefer `mesh_safe` poses by default; offer `observed` poses only when the user wants a beauty/splash render. See `core/pose-library.md` for the schema.
6. Style — default to the mesh-gen style (`clean-mesh-gen`) from `vocabulary/styles.json`; offer alternates only if the user wants a non-mesh look (cinematic, painterly, line-art…). `mesh_safe: false` styles pair with **observed** poses, not mesh-gen poses.
7. Model and size (default: nano-banana-2, 2K — only ask if user seems to care about quality/speed)

### Output location

**Before the first render of a session, ask the user where renders should be saved.** Suggest a default of `./zuul-output` (relative to the **user's** current working directory — the project they launched from, **not** this skill's directory). Store the chosen path as the **output root** — referred to below as `<OUTPUT_DIR>` — and use it for every output path: the PNG renders go under `<OUTPUT_DIR>/concepts/...`, each subject's JSON record alongside them, and the catalog at `<OUTPUT_DIR>/index.json`. Do not assume any particular vault or folder layout; the skill ships to arbitrary machines. (Keep `<OUTPUT_DIR>` distinct from the `concepts/` subfolder — e.g. default gives `./zuul-output/concepts/...`, never `./concepts/concepts/...`.)

### Session seed

At the start of every guided session, pick a seed integer and present it:

> **Seed: [NUMBER]** *(override this or type "no seed" to clear it before rendering)*

Store the seed in the prompt record. If the user clears it, omit `--seed` from the generation command entirely.

## Prompt record schema

Every time a render is produced, create or update the subject's JSON file at:
`<OUTPUT_DIR>/concepts/[subject-type]/[slug]/[slug].json`

> The generator also writes a plain-text **prompt sidecar** next to every image it saves — `[slug]-NN.txt` containing only the exact prompt — so the user can read it or paste it straight into another LLM without digging through the JSON record. It also **corrects the image extension to match the actual bytes** (some models return JPEG even for a `.png` output path) and prints `Image saved to <path>` — record that actual filename in `file`.

The outer object is the subject definition. `renders[]` is the array of generation records.

Each render entry must include:

```json
{
  "file": "slug-NN.png",
  "type": "action | a-pose | t-pose | turnaround | ingest",
  "model": "nano-banana-2 | nano-banana-pro",
  "style": "clean-mesh-gen | (any id from vocabulary/styles.json)",
  "size": "512px | 1K | 2K | 4K",
  "aspect_ratio": "2:3",
  "seed": 847392,
  "flags": ["--transparent"],
  "prompt": "full prompt text used"
}
```

> **TODO (`type` enum):** The current values (`action | a-pose | t-pose | turnaround | ingest`) are pose/workflow-oriented and fit bipedal characters best. They map awkwardly onto other subject classes — vehicles, jets, aliens, beasts, dragons — where "pose" isn't the right axis (a vehicle render is a *view*, not a pose). Revisit what `type` should capture per subject class (e.g. a view-based vocabulary for vehicles/objects vs. a pose-based one for creatures) before finalizing the schema.

**Title:** Use the subject's proper name if the user provided one. Otherwise derive it from species + role (e.g. "Drow Fallen Paladin"). Store as `"title"` at the root of the JSON object.

After writing the JSON, update `<OUTPUT_DIR>/index.json` — add an entry:

```json
{
  "id": "slug",
  "title": "Title",
  "subject_type": "character",
  "path": "concepts/characters/slug/slug.json"
}
```

Do not duplicate existing entries.

## Generation command

Invoke the generator by **this skill's own absolute path** (so `--output` stays relative to the user's working directory, not the skill folder). Run `bun install` in the skill's `tools/` once first — see Setup. Below, `<ZUUL>` is the absolute path to this skill's directory:

```bash
bun run <ZUUL>/tools/generate-image.ts \
  --prompt "<base prompt prefix + subject framing + details>" \
  --model nano-banana-2 \
  --size 2K \
  --aspect-ratio 2:3 \
  --seed 847392 \
  --output <OUTPUT_DIR>/concepts/<subject-type>/<slug>/<slug>-NN.png
```

| Flag | Default | Notes |
|------|---------|-------|
| `--model` | `nano-banana-2` | Switch to `nano-banana-pro` for finals or complex compositions |
| `--size` | `2K` | Use `512px` for fast cheap previews before committing |
| `--transparent` | off | Often better than white BG for mesh tools that accept PNGA |
| `--thinking high` | off | Add for complex multi-element compositions (nano-banana-2 only) |
| `--seed` | none | Omit entirely if user cleared the seed |
