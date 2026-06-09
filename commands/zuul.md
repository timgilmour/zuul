---
description: Generate concept art with Zuul — guided render of a fictional subject
argument-hint: "[subject, e.g. 'a drow paladin']"
allowed-tools: Bash(bun run:*), Read, Write, Edit
---
Use the **zuul** skill to produce a concept-art render.

Subject: $ARGUMENTS

- If a subject is given, infer what you can — subject type, genre, sub-genre, species, role, pose, style — from it and the skill's `vocabulary/` pools, then ask **only** for the dimensions you still need, one question at a time (numbered options).
- If no subject is given, run the skill's full guided questionnaire.

Establish the session seed and ask for the output directory as the skill specifies, assemble `<DETAILS>` via the skill's `core/assembly.md` slot-merge (never naive concatenation), prepend the chosen style's core prompt from `vocabulary/styles.json` (default `clean-mesh-gen`) with `<FRAMING>` filled in, apply the chosen pose, then render with the skill's `tools/generate-image.ts`. Write the prompt record and update `index.json` as the skill describes.
