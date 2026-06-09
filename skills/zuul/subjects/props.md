# Subject Module — Props

For objects: weapons, armour pieces, artifacts/relics, tools, containers, furniture, instruments, banners. Supplies the **view selector** and the prop **vocabulary pool**. Combine with the universal `core/render-rules.md`.

Like vehicles, props are *viewed*, not posed — pick a camera angle that reveals the form cleanly.

## Prompt assembly

```
[<VIEW PHRASE> from the view selector] + [chosen style prompt from vocabulary/styles.json (default clean-mesh-gen)]
Concept reference of <SUBJECT>, a single isolated object. <DETAILS: form, materials, wear, palette>.
```

| Slot | Fill with | Example |
|------|-----------|---------|
| `<VIEW PHRASE>` | from the view selector below | `Three-quarter view, slightly above` |
| `<SUBJECT>` | the prop, one noun phrase | `an ornate elven longsword` |
| `<DETAILS>` | form, materials, wear, palette (from the prop's `prompt_fragments`) | `fluted steel blade, gold-filigree crossguard, leather-wrapped grip, matte finish` |

## View selector

Pick one view. For mesh gen, **3/4 is the default** — it shows depth and two faces at once.

| View | Framing phrase | Aspect | Best for |
|------|----------------|--------|----------|
| **3/4** *(default)* | `Three-quarter view, slightly above, showing form and depth` | `1:1` or `4:3` | Most props |
| **Front / elevation** | `Pure orthographic front elevation, perfectly level camera` | `1:1` | Symmetric props, shields, banners |
| **Profile** | `Pure orthographic side profile, perfectly level camera` | `16:9` or `4:3` | Long props — swords, spears, rifles, staves |
| **Top-down** | `Orthographic top-down view, straight overhead camera` | `1:1` | Flat props, maps, tools laid out |

Long weapons read best as a **profile** in `16:9`, or laid on a diagonal in `1:1`.

## Vocabulary lookup

Props live in the tagged pool `vocabulary/props.json`. Each entry: `id`, `label`, `category`, `applies_to` (genre ids / sub-genre ids / `"*"`), `prompt_fragments[]`, `view`, `aspect`.

**Lookup:** filter `props.json` to entries whose `applies_to` contains the chosen genre id, the sub-genre id, or `"*"`. Pick by fit, then use the prop's `prompt_fragments` for `<DETAILS>` and its `view` / `aspect` for framing. Categories: `weapon`, `armor`, `artifact`, `tool`, `container`, `furniture`, `instrument`, `banner`, `misc`.

## Creating a new prop (the pool grows as you use it)

If the user wants a prop the pool doesn't cover, **create it** — same flow as roles:

1. **Draft** the prop:
   - `id` — kebab-case; prefix when the bare name could collide (e.g. `samurai-katana`).
   - `label`, `category` — see the category list above.
   - `applies_to` — narrowest accurate option: `["*"]` for a universal object (barrel, torch, rope); the **genre id** for a whole tonal genre; explicit **sub-genre id(s)** for an era/setting-bound prop. Avoid bleed — a laser-pistol must not carry a historical tag; a flintlock must not carry a sci-fi tag.
   - `prompt_fragments` — 3–6 concrete phrases (form, materials, wear, palette), matte/mesh-friendly.
   - `view`, `aspect` — defaults from the view selector.
2. **Confirm** the full drafted JSON object with the user.
3. **Append** it to `vocabulary/props.json` — do not duplicate an existing `id`.
4. **Validate**: run `bun run tools/validate-vocab.mjs` and confirm it prints `OK`.
5. **Use** it for the render.

## Material rules

Force matte, as everywhere (see `core/render-rules.md`):

| Material | Prompt as |
|----------|-----------|
| Metal (blades, fittings, armour) | `brushed / oxidized matte metal, no specular shine` |
| Wood / leather / cloth | already matte — great as-is |
| Gems / glass / crystal / energy | hardest case — prompt `opaque, matte`, expect cleanup |

Single isolated object, pure white seamless background, centered with empty margin. No props-in-a-scene, no hands holding the object, no surface it rests on.
