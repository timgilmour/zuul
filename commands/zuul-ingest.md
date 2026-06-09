---
description: Ingest a reference image into a Zuul subject + pose
argument-hint: "<image path or @image>"
---
Use the **zuul** skill's image-ingest workflow (its `core/ingest-image.md`) to ingest the reference image below.

Image: $ARGUMENTS

Read the image visually (the Read tool ingests images), fill the skill's observation schema, and emit the two outputs:
1. A **subject identity** description, stripped of transient pose/expression so it can be re-posed.
2. A **pose object** for the skill's `vocabulary/poses.json` (body-plan tagged; captured poses are usually `observed` / `mesh_safe: false`).

Then ask which downstream route the user wants: a mesh-gen render (neutralize the pose to A/T-pose), a faithful posed render (keep the captured pose — not mesh-safe), or bank the pose only. Confirm the JSON before appending any pose, and run the skill's `tools/validate-vocab.mjs` afterward.
