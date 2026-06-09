---
description: Add to a Zuul vocabulary pool (role, species, pose, style, or fragment)
argument-hint: "<role|species|pose|style|fragment> [name/description]"
---
Use the **zuul** skill to add a new entry to a vocabulary pool, following the matching "Creating a new …" flow.

Request: $ARGUMENTS

Route by the first word:
- `role` → the skill's `subjects/characters.md` → *Creating a new role* → `vocabulary/roles.json`
- `species` → `subjects/characters.md` → *Creating a new species* → `vocabulary/species.json` (set `body_plan`)
- `pose` → `core/pose-library.md` → *Creating a new pose* → `vocabulary/poses.json` (body-plan tagged; text or image-ingest)
- `style` → `core/render-rules.md` → *Creating a new style* → `vocabulary/styles.json` (set `mesh_safe`, `<FRAMING>` slot)
- `fragment` → `subjects/characters.md` → *Creating a new fragment* → slot-tagged `{slot,text}` on the relevant pool node

Always: draft the JSON object, **show it and get explicit confirmation**, append it (no duplicate `id`), run the skill's `tools/validate-vocab.mjs` and confirm `OK`, then it's ready to use. If the pool type is missing or ambiguous, ask which one.
