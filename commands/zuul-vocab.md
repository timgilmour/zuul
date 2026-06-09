---
description: List Zuul's vocabulary — genres, sub-genres, roles, species, poses, styles
argument-hint: "[genres|subgenres|roles <genre>|species|poses|styles]"
---
Use the **zuul** skill's `vocabulary/` pools to list what's available.

Filter: $ARGUMENTS

Read the relevant pool(s) and present a concise, readable list (not raw JSON):
- no filter / `all` → a one-line count of every pool, then the 7 top-level genres
- `genres` → top-level genres from `genre.json`
- `subgenres` → sub-genres grouped by parent from `subgenres.json`
- `roles <genre or sub-genre>` → roles whose `applies_to` contains that genre id, sub-genre id, or `*`
- `species` → species `id` + `body_plan`
- `poses` → poses grouped by `mesh-gen` vs `observed`, with body-plan tags and aspect
- `styles` → styles with `mesh_safe`, the `default` marked

For long lists (e.g. roles) group by category and keep it scannable.
