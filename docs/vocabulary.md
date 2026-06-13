# The Vocabulary System

Zuul's prompts aren't freehand — they're assembled from **tag-driven JSON
pools** under [`skills/zuul/vocabulary/`](../skills/zuul/vocabulary/). The
pools are the single source of truth for what Zuul knows, and they grow as
you use the skill.

## The pools

| Pool | Entries | What it holds |
|------|---------|---------------|
| `genre.json` | 7 | Fantasy, Horror, Sci-Fi, Modern, Science Fantasy, Historical, Western |
| `subgenres.json` | 35 | 4–6 per genre (cyberpunk, gothic-horror, weird-west, …) with tone + fragments |
| `roles.json` | 224 | One pool for all genres; each role tagged with the genres/sub-genres it fits |
| `species.json` | 23 | Playable-species archetypes with a `body_plan` (biped/quadruped/winged/floating) |
| `descriptors.json` | 41 | Cross-cutting modifiers (age, size, condition, tier, …) |
| `vehicles.json` / `props.json` | 22 / 59 | Non-character subjects, each with a preferred `view` + `aspect` |
| `poses.json` | 19 | Mesh-gen poses (A-pose, T-pose, …) + observed poses, per body plan |
| `styles.json` | 6 | Core prompts — `clean-mesh-gen` (default) plus beauty styles |
| `intersections.json` | 38 | Combination rules — what changes when *orc* meets *barbarian* |

Plus four prose files (`themes.md`, `materials.md`, `environments.md`,
`palettes.md`) for flavor language.

## How resolution works

1. **Tags scope the pools.** Roles, species, vehicles, and props carry an
   `applies_to` array of genre ids, sub-genre ids, or `"*"`. Picking
   *horror / gothic-horror* filters the 224-role pool down to what fits.
2. **Entries carry `prompt_fragments[]`** — the authoritative phrases that
   describe that entry visually. Assembly never invents identity language; it
   pulls from the pools. In the six character-path pools every fragment is a
   typed `{ "slot": "...", "text": "..." }` object (the validator rejects bare
   strings) so the engine knows which slot each phrase belongs to without
   guessing.
3. **Intersections fire on combinations.** Each entry in
   `intersections.json` has a `when[]` of ids (e.g. `["orc", "barbarian"]`);
   when all match the subject, its `visual_override` and extra fragments
   apply. The validator enforces that every `when` token resolves to a real
   species/descriptor/role id.
4. **A deterministic engine resolves the merge.** Fragments land in slots
   (build, surface, palette, gear, …) and the engine in
   [`tools/assemble-prompt.mjs`](../skills/zuul/tools/assemble-prompt.mjs)
   — spec'd by [`core/assembly.md`](../skills/zuul/core/assembly.md) — merges
   them by precedence instead of naive concatenation, so an intersection can
   *override* a species build rather than contradict it. It demotes losing
   fragments automatically and only stops on a genuine same-precedence tie.
   See the [CLI reference](cli.md#assemble-promptmjs) to run it directly.
5. **Poses and styles gate the mesh path.** Species `body_plan` selects
   compatible poses; `mesh_safe` poses and styles keep renders
   reconstruction-friendly (see [Mesh pipeline](mesh-pipeline.md)).

## The contract

[`vocabulary/SCHEMA.md`](../skills/zuul/vocabulary/SCHEMA.md) documents the
exact shape of every pool — required fields, controlled vocabularies
(slots, categories, body plans), casing rules, and which rules are
validator-enforced versus authoring convention. Read it before hand-editing
any pool.

## Extending the vocabulary

The supported path is [`/zuul-new`](commands.md#zuul-new):

```
/zuul-new role a plague-doctor alchemist for gothic-horror
/zuul-new species a crystalline construct, biped
/zuul-new style isometric game-asset render
```

Every "Creating a new …" flow follows the same shape:
**draft → confirm with you → append to the pool → validate → use**.

Hand edits are fine too — just run the validator afterwards:

```bash
cd <zuul>/tools && bun run validate
```

It enforces referential integrity (tags resolve, intersection tokens
resolve, every sub-genre has roles, every body plan has a mesh-safe pose,
exactly one default style) and fails with a per-problem list if an edit
breaks the contract. `/zuul-validate` runs the same check from inside
Claude Code.
