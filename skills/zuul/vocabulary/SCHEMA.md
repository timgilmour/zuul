# Zuul Vocabulary Schema

The contract enforced by `tools/validate-vocab.mjs`. Every pool is a JSON array of
entries. Run `bun run tools/validate-vocab.mjs` (or `bun run validate` in `tools/`)
after any edit.

## Universal rules

- **`id`** — required, unique within the pool (enforced by the validator for all pools),
  kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) (format enforced by the validator only for
  `intersections.json`; kebab-case is a data/authoring convention for all other pools).
  Exception: `intersections.json` historically had none; ids are now derived from the slug of `label`.
- **`label`** — required by convention on all pools (human-readable display name); the
  validator enforces it only on `poses.json`, `styles.json`, `descriptors.json`, and
  `intersections.json`. Genre, subgenres, roles, species, vehicles, and props carry
  `label` by authoring convention but it is not validator-checked.
- **`taxonomy`** — required, equals the pool's type (see table).
- **No `ext` field.** Removed by design; the validator rejects any entry that re-adds it.
  When a real extension need appears, introduce a typed field instead.

| Pool | `taxonomy` | Notable required fields |
|------|-----------|-------------------------|
| `genre.json` | `genre` | `level:"genre"`, `prompt_fragments[]`¹ |
| `subgenres.json` | `subgenre` | `level:"subgenre"`, `parent` (a genre id), `tone`, `descriptors[]`, `prompt_fragments[]` |
| `roles.json` | `role` | `applies_to[]`, `prompt_fragments[]` |
| `species.json` | `species` | `applies_to[]`, `body_plan`, `prompt_fragments[]` |
| `descriptors.json` | `descriptor` | `category`, `prompt_fragments[]` |
| `poses.json` | `pose` | `category`, `mesh_safe`, `applies_to[]`, `phrase`, `aspect` |
| `styles.json` | `style` | `mesh_safe`, `uses_framing`, `prompt` (with `<FRAMING>` if `uses_framing`)³ |
| `props.json` | `prop` | `applies_to[]`, `category`², `view`, `aspect`, `prompt_fragments[]` |
| `vehicles.json` | `vehicle` | `applies_to[]`, `view`, `aspect`, `prompt_fragments[]` |
| `intersections.json` | `intersection` | `when[]` (≥2 tokens), `visual_override{}`, `traits_add[]`, `prompt_fragments_add[]` |

¹ `genre.json` entries carry `prompt_fragments[]` in data but `checkGenres` does not
currently validate them; presence and content is a data/authoring convention.

² `props.json` entries carry `category` in data but `checkTaggedPool` does not currently
validate it; only `view` and `aspect` are validator-enforced for props. `category` is a
data/authoring convention.

³ `checkStyles` enforces a pool-level invariant: exactly one entry in `styles.json` must
have `default: true` (an error is raised if found count ≠ 1).

## Controlled vocabularies

- **`applies_to` tags** (roles/species/props/vehicles): a genre id, a sub-genre id, or `"*"`.
- **`body_plan`** (species) / **pose `applies_to`**: `biped` | `quadruped` | `winged` | `floating` (poses also allow `"*"`).
- **descriptor `category`**: `age` | `condition` | `physical` | `size` | `social` | `tier` | `visual`.
- **pose `category`**: `mesh-gen` | `observed`. Every `mesh-gen` pose must be `mesh_safe: true`.
  Every body plan must have at least one mesh-safe pose.
- **intersection `when` tokens**: each must resolve to a real `species`, `descriptor`, or `role` id.

## `prompt_fragments` format

Each entry is either a bare string (legacy) or a `{ "slot": <SLOT>, "text": <string> }` object.
Valid slots: `art_style, tone, build, features, surface, armor_clothing, gear, weapon,
materials, palette, marks, aura, bearing, expression`. Empty strings/text are rejected.

> Migrating all fragments to typed `{slot,text}` objects is **Tier 4** (future work), not required by this schema.

## Casing convention

Fragments are lowercase by default. Proper nouns are allowed to retain their natural casing:
acronyms (`HUD`, `IR`, `EVA`, `IFAK`), model/designation numbers (`M1 Garand`, `M1917`,
`Springfield 1903`), and named items (`Iron Cross`, `Webley`). Do **not** machine-lowercase
fragments — it would corrupt these designations. (The validator does not enforce casing;
this is an authoring rule.)

## Known intentional gaps (not validator failures)

- `subgenres[].descriptors[]` are free-text flavour tokens, **not** references into
  `descriptors.json`. (Whether to formalize this is a separate decision — Tier 3.)
- `historical` genre has zero direct-genre roles; historical characters are sub-genre scoped.
- All current species are `body_plan: biped`; `quadruped`/`winged`/`floating` poses exist
  for creatures supplied outside the species pool.
