# Prompt Assembly — Slot Model & Merge Rules

How to turn the `prompt_fragments[]` pulled from the vocabulary into a single
coherent `<DETAILS>` string — **without** producing contradictory prompts.

Read this whenever you assemble `<DETAILS>` for a character or creature. It
replaces "just concatenate the fragments."

> **The engine implements this spec.** Don't merge by hand — run:
>
> ```bash
> bun run tools/assemble-prompt.mjs --species dwarf --role barbarian --subgenre high-fantasy
> ```
>
> The prose below documents the engine's behaviour. The only part that needs
> agent/user judgment is a non-empty `conflicts[]` in its output (exit code 2):
> a same-precedence collision in an exclusive slot — resolve it with the user
> (or a `--add "<slot>:<text>"` override), exactly as the rules below describe.

## Why this exists

Every vocabulary source (`species.json`, `genre.json`, `subgenres.json`,
`roles.json`, `descriptors.json`, `intersections.json`) exposes a flat
`prompt_fragments[]` array. Naively unioning them produces prompts that
contradict themselves — e.g. a High Fantasy Barbarian whose sub-genre says
`gleaming enchanted armour` **and** whose role says `minimal hide and fur armour`.
The image model then blends or randomly picks. The fix: classify each fragment
into a **slot**, then resolve each slot.

## Slots

**Style slots — the highest-precedence supplying source wins (subgenre beats genre):**

| Slot | Holds | Example |
|------|-------|---------|
| `art_style` | the rendering style phrase | `high fantasy concept art` |
| `tone` | mood / scale language | `heroic mythic scale` |

**Subject slots — one coherent value each (compose if compatible, resolve if not):**

| Slot | Natural owner | Example fragment |
|------|---------------|------------------|
| `scale` | species (via `default_size`) → descriptor | `small in stature, compact proportions` |
| `build` | species | `stocky barrel-chested build` |
| `features` | species (+ intersection) | `thick beard`, `curling horns` |
| `surface` | species | `ruddy skin`, `scaled hide` |
| `armor_clothing` | **role** | `minimal hide and fur armour` |
| `gear` | role | `herb pouches at belt` |
| `weapon` | role | `longsword and tower shield` |
| `materials` | role → subgenre | `brushed matte metal` |
| `palette` | subgenre → genre → species | `warm oak, bronze, bare iron` |
| `marks` | descriptor | `war paint on face and chest` |
| `aura` | descriptor / intersection | `faint qi glow`, `halo` |
| `bearing` | descriptor / role | `noble upright bearing` |
| `expression` | pose | `neutral`, `enraged` |

## Precedence (high → low)

```
per-render user instruction → intersection → descriptor → role → species → subgenre → genre
```

"Owner" in the table above is the source that should win for that slot. Precedence
is the global tie-breaker when two sources both reach a slot.

## The two rules that prevent breakage

1. **Compose vs contradict.** Within a slot, *compatible* fragments compose — keep
   all, dedup near-duplicates (`stocky barrel-chested` + `raw muscular physique` +
   `short stature` all describe one build, fine). Two fragments **contradict** only
   when they make mutually-exclusive physical claims for one slot: two armor types,
   two glow colors, pristine vs battle-worn. Additive detail is never a
   contradiction.
2. **Demotion.** On a contradiction, the owning / higher-precedence source wins and
   the loser is **dropped**. A genre/sub-genre fragment that lands in a slot owned
   by role or species (e.g. `gleaming enchanted armour` → `armor_clothing`) is
   demoted the moment the role fills that slot.

When two sources at the **same** precedence contradict in one slot and neither
owns it → **stop and ask the user** which wins (or whether they coexist as
deliberate tension). Never guess on a same-precedence collision.

## Procedure

1. **Pull** fragments from each source via the lookup sequence in
   `subjects/characters.md` (species → genre+subgenre → role → descriptors →
   intersections).
1b. **Auto-derive scale.** If no explicit `size`-category descriptor was supplied and
   the species' `default_size` is set and not `medium`, pull the matching `size`
   descriptor's (`scale`-slotted) fragments as a species-sourced default. An explicit
   size descriptor suppresses this (it is the override). This is the one instance of a
   generic species-default mechanism (`SPECIES_DEFAULTS` in the engine), keyed by
   descriptor category — size is the only axis today.
2. **Classify** each fragment into a slot. Mostly free, because classification is
   *by source*:

   | Source | Default slots (no per-string thought) |
   |--------|----------------------------------------|
   | species | `build`, `features`, `surface` |
   | role | `armor_clothing`, `gear`, `weapon`, `marks`, `bearing` |
   | descriptor | by its `category`: size/age→`build`, condition→`marks`/`aura`/`surface`, tier→`gear`/`materials`, social→`bearing`, physical→`features`, visual→`armor_clothing`/`features` |
   | intersection | by cue (highest precedence) |
   | **genre / subgenre** | **the only bag needing per-string care** — `art_style`/`tone` (keep) vs stray subject fragments (demotable) |
   | explicit `{slot, text}` | use the field; skip classification |

3. **Resolve** each subject slot: compose compatibles; on contradiction apply
   demotion (owner/precedence wins) or, for same-precedence with no owner, ask.
4. **Palette special-case:** always resolve to **one** coherent palette
   (`subgenre → genre → species`), dropping colors incompatible with the subject.
5. **Assemble** in this fixed order so prompts read consistently:

   ```
   scale → build → features → surface → armor_clothing → gear → weapon → marks → aura → bearing → materials → tone → expression → palette clause
   ```

   `art_style` rides with the subject identity line (per `subjects/characters.md`
   assembly template), not inside `<DETAILS>`.
6. **Report** a one-line **resolution note** under the prompt naming anything
   demoted or asked — e.g.
   `resolution: demoted "gleaming enchanted armour" (subgenre→armor_clothing, owned by role)`.

## Fragment schema

A `prompt_fragments[]` entry is either:

- a **bare string** (legal only in vehicles/props pools — the engine and the six character-path pools require objects), or
- an **object** `{ "slot": "<slot id>", "text": "<phrase>" }` (preferred for new
  fragments — slot is taken from the field, no classification guess).

Valid `slot` ids are exactly the style + subject slots listed above. New
user-authored fragments should be objects; see "Creating a new fragment" in
`subjects/characters.md`. `validate-vocab.mjs` enforces this.

## Worked example — High Fantasy Dwarf Barbarian

Raw fragments pulled:

```
genre/fantasy      → fantasy game concept art · medieval fantasy aesthetic · hand-crafted materials
subgenre/high-fant → high fantasy concept art · gleaming enchanted armour · gold-leaf ornamental
                     detail · luminous magical aesthetic · heroic mythic scale
species/dwarf      → stocky barrel-chested build · thick beard · ruddy skin · short stature
role/barbarian     → minimal hide and fur armour · bare arms and shoulders · war paint on face
                     and chest · raw muscular physique · tribal bone fetishes
```

Resolved per slot:

| Slot | Result | Demoted |
|------|--------|---------|
| `art_style` | high fantasy concept art | ~~fantasy game concept art~~ |
| `tone` | luminous magical aesthetic, heroic mythic scale | ~~medieval fantasy aesthetic~~ |
| `scale` | small in stature, roughly child- to halfling-height, well under adult size, compact proportions with a slightly enlarged head and short stocky limbs | (auto-derived from dwarf `default_size: small`) |
| `build` | stocky barrel-chested build, short stature, raw muscular physique | |
| `features` | thick beard | |
| `surface` | ruddy skin | |
| `armor_clothing` | minimal hide and fur armour, bare arms and shoulders | ~~gleaming enchanted armour~~, ~~gold-leaf ornamental detail~~ |
| `gear` | tribal bone fetishes | |
| `marks` | war paint on face and chest | |
| `materials` | hand-crafted materials | |
| `palette` | russet brown, iron grey, gold, deep slate (from species) | |

Final `<DETAILS>`:

> small in stature, roughly child- to halfling-height, well under adult size, compact proportions with a slightly enlarged head and short stocky limbs, stocky barrel-chested build, short stature, raw muscular physique, thick beard, ruddy skin, minimal hide and fur armour, bare arms and shoulders, tribal bone fetishes, war paint on face and chest, hand-crafted materials, luminous magical aesthetic, heroic mythic scale, palette of russet brown, iron grey, gold, deep slate

> resolution: demoted "fantasy game concept art" (genre→art_style), "medieval fantasy aesthetic" (genre→tone), "gleaming enchanted armour" (subgenre→armor_clothing), "gold-leaf ornamental detail" (subgenre→armor_clothing); palette from species
