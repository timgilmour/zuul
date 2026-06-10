# Ingest Image — Reference → Description + Pose

Turn a reference image into reusable text: a **subject description** (identity, for re-rendering) and a **pose description** (transient, banked into the `vocabulary/poses.json` pool). The engine can't see — **Claude reads the image** (the Read tool ingests images visually) and derives the text.

## When to use

- User drops in a reference image and wants concept renders *of that subject*.
- User wants to *capture a pose* from an image into the pose library.
- User wants a clean mesh-gen render derived from an existing illustration.

## Workflow

1. **Read the image** with the Read tool (it loads visually).
2. Fill the **observation schema** below by looking at the image.
3. Emit the **two outputs**: a subject (identity) description and a pose-library entry.
4. Route to a downstream use (mesh-gen render / faithful posed render / pose-bank only).

## Observation schema

Look at the image and record:

| Field | Capture | Persistence |
|-------|---------|-------------|
| `subject-type` | character / creature / vehicle / mech / prop | identity |
| `species/material` | e.g. orc; brushed steel | identity |
| `silhouette` | overall shape, proportions, build | identity |
| `key-features` | head, face shape, distinctive anatomy | identity |
| `gear/attachments` | armor, trophies, weapons, props worn | identity |
| `palette` | 2–4 dominant colors | identity |
| `surface/wear` | matte/glossy, scars, rust, dirt, age | identity |
| `pose` | stance, limb positions, weight, head | **transient** |
| `expression/attitude` | facial expression, mood, action | **transient** |
| `view/camera` | front / 3-4 / side; angle | transient |

**Rule of thumb:** identity fields → subject description (survive into a 3D model). Transient fields → pose-library entry (the *moment*, not the *thing*).

## Output 1 — Subject (identity) description

A render-ready noun phrase + details, **stripped of transient pose/expression** so it can be re-posed:

```
<SUBJECT identity phrase>, <key-features>, <gear/attachments>,
<surface/wear>, <palette> palette.
```

**Example** (from an image of a raging orc):
```
A burly green-skinned orc warrior, heavy brow and prominent lower tusks,
muscular build, bare scarred torso, a belt of bone skull trophies around
his waist, fur-and-leather kilt, matte skin, weathered, deep green +
bone-white + ox-blood palette.
```

> Note: "screaming and enraged" is **deliberately omitted** here — it's transient. It goes to Output 2.

## Output 2 — Pose entry (for `vocabulary/poses.json`)

Emit a pose **object** to append to the `vocabulary/poses.json` pool (confirm with the user first; see `core/pose-library.md` → "Creating a new pose"). Captured poses are almost always `observed` / `mesh_safe: false`. Tag `applies_to` with the subject's body plan (`biped` | `quadruped` | `winged` | `floating`).

```json
{
  "id": "<verb-first-slug>",
  "taxonomy": "pose",
  "label": "<Readable Name>",
  "category": "observed",
  "mesh_safe": false,
  "applies_to": ["biped"],
  "phrase": "<body + limbs + head + weight, imperative>",
  "expression": "<face/attitude>",
  "aspect": "<ratio>",
  "use": "action / beauty / idle / dramatic",
  "source": "<image filename>"
}
```

**Example:**
```json
{
  "id": "enraged-roar",
  "taxonomy": "pose",
  "label": "Enraged roar",
  "category": "observed",
  "mesh_safe": false,
  "applies_to": ["biped"],
  "phrase": "standing wide with weight low, torso leaning forward, both arms raised and bent with fists clenched, shoulders hunched, head tilted back mid-roar",
  "expression": "screaming, enraged, furious",
  "aspect": "2:3",
  "use": "action / dramatic",
  "source": "orc-ref.png"
}
```

## Downstream: three routes

| Goal | Pose | Reference image | Result |
|------|------|-----------------|--------|
| **Mesh-gen render of this subject** | force A-pose / T-pose (neutralize) | pass source as `--reference-image` for fidelity | clean isolated model-ready render of the same character |
| **Faithful posed concept render** | use the captured pose + expression | optional `--reference-image` | a clean-background render that keeps the drama (not for mesh gen) |
| **Bank the pose only** | — | — | append Output 2 (a pose object) to `vocabulary/poses.json`; reuse by name later |

### Mesh-gen render command (subject from image, normalized pose)

```bash
bun run <ZUUL>/tools/generate-image.ts \
  --prompt "<clean-mesh-gen style prompt from vocabulary/styles.json, <FRAMING> = Front-facing orthographic>. Full-body character concept reference of <Output 1 identity>, <POSE PHRASE>, NEUTRAL expression." \
  --reference-image <path/to/source-image> \
  --model nano-banana-2 --size 2K --aspect-ratio 2:3 \
  --output <OUTPUT_DIR>/concepts/<subject-type>/<slug>/<slug>-tpose-01.png
```

Substitute `<POSE PHRASE>` with the mesh pose the user asked for, copied from `vocabulary/poses.json` — A-pose by default, T-pose when the user requests it (e.g. T-pose → *"standing in a symmetrical T-pose with both arms extended straight out horizontally to the sides at shoulder height, palms down, legs shoulder-width apart"*). Use the ingested subject's real `<subject-type>` in the output path (`characters`, `creatures`, `vehicles`, `props`…), not `characters` literally.

`--reference-image` biases the render toward the source subject; the prompt overrides the pose to the chosen mesh pose and the expression to neutral. This is the canonical "illustration → mesh-ready" path.

## Notes & cautions

- **Always neutralize for mesh gen.** Copying a dramatic source pose (raised arms, open mouth) produces overlapping limbs and warped geometry. Keep the subject, drop the drama.
- **Don't copy lighting.** Re-render with flat diffuse light per `core/render-rules.md` even if the source is dramatically lit.
- **Trademark/likeness:** describe original fictional subjects only; don't reproduce real people or trademarked characters from a reference.
- **Multi-subject images:** ingest one subject at a time; name which one.
