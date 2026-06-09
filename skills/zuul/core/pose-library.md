# Pose Library

Named poses for character/creature subjects live in the tagged pool
**`vocabulary/poses.json`** — the canonical, appendable store. This file is the
guide to that pool: what the fields mean, the hard rule for mesh gen, and how to
add a pose (by text or by image ingest).

## The pool: `vocabulary/poses.json`

Each pose is an object:

```json
{
  "id": "a-pose",
  "label": "A-pose",
  "category": "mesh-gen",          // "mesh-gen" | "observed"
  "mesh_safe": true,               // safe for single-image image-to-3D?
  "applies_to": ["biped"],         // body plans: biped | quadruped | winged | floating | "*"
  "phrase": "standing in a symmetrical A-pose ...",   // the <POSE> phrase
  "aspect": "2:3",                 // recommended aspect ratio
  "default": true,                 // optional — the default pick for its body plan
  "expression": "...",             // optional — observed poses only
  "use": "mesh-gen",               // mesh-gen | action | beauty | idle | dramatic
  "source": "hand-curated",        // or the ingested image filename
  "ext": {}
}
```

**Two categories:**

- **`mesh-gen`** (`mesh_safe: true`) — neutral, limbs-separated, for image-to-3D.
  Hand-curated and stable: `a-pose` (default biped), `t-pose`, `quadruped-stand`,
  `winged-spread`, `floating-idle`.
- **`observed`** (`mesh_safe: false`) — beauty/action poses captured from reference
  images via `core/ingest-image.md`. Limbs may overlap — **not for mesh gen.**

**Selecting a pose:** filter the pool by the subject's body plan — include every
pose whose `applies_to` contains the subject's body plan (or `"*"`). A humanoid
character is `biped`; use the creature's shape for non-humanoids. Prefer
`mesh_safe` poses by default; offer `observed` poses only for beauty/splash renders.

## Hard requirement for mesh gen

Clear air gaps between arms and torso, and between the legs (and wings held clear
of the body). Only `mesh_safe` poses satisfy this — A-pose (natural, frames tall
figures) and T-pose (maximum separation) for bipeds; the square stands for
quadrupeds/winged/floating. Observed poses are for posed concept renders, splash
art, or pose-vocabulary reference only.

## Creating a new pose

Two paths — both end with a validated object appended to `vocabulary/poses.json`:

**A. From text** (no image needed):
1. **Draft** the object: `id` (verb-first kebab — `guard-stance`, `casting-spell`),
   `label`, `category`, `mesh_safe`, `applies_to` (body plans), `phrase`, `aspect`,
   optional `expression`/`use`, `source` (`"hand-authored"`), `ext: {}`.
2. **Confirm** the full drafted JSON with the user before writing.
3. **Append** it to `vocabulary/poses.json` — no duplicate `id`.
4. **Validate**: `bun run tools/validate-vocab.mjs` → `OK`.
5. **Use** it by name in a render.

**B. From a reference image:** run `core/ingest-image.md` — it derives a pose object
(Output 2) which you confirm and append the same way (steps 2–5 above).

Reuse any pose by name later: *"render the dwarf in the `enraged-roar` pose."*
