# Render Rules — Universal (all subjects)

These rules apply to **every** subject type — characters, creatures, vehicles, mechs, props. They produce a clean, isolated render that a single-image image-to-3D generator (Meshy, Tripo, Hunyuan3D, Rodin) can reconstruct cleanly. The subject-specific `subject-*.md` files supply the framing/pose vocabulary; this file supplies everything else.

## Styles — the core prompt (pick one)

Every prompt starts with **one core prompt** — a *style* — prepended verbatim with the `<FRAMING>` slot filled in, followed by the subject's identity and description. The style language appears **exactly once, at the start** — do not paraphrase, abbreviate, or repeat it at the end.

Styles live in the tagged pool **`vocabulary/styles.json`**. Each entry's `prompt` is a full core prompt. Pick one:

- **Default:** the style flagged `default: true` — `clean-mesh-gen`, the flat / isolated / white-background render optimized for single-image image-to-3D. **Use it unless the user wants something else.**
- **`mesh_safe: true`** styles obey the mesh-gen hard rules in this file (flat light, white bg, matte, orthographic, isolated). **`mesh_safe: false`** styles (cinematic, painterly, line-art, flat-vector, photoreal, …) deliberately relax them — pair these with **observed** poses, not mesh-gen poses.

**Order of every prompt:**

```
[chosen style prompt, <FRAMING> filled in]  →  <SUBJECT identity + pose + description details>
```

`<FRAMING>` is the **camera view** phrase from the matching subject module — e.g. characters: `Front-facing orthographic`; vehicles: `Three-quarter front`. It is distinct from `<POSE>` (the body's pose, e.g. A-pose), which goes in the subject description. After the style block, append the subject's identity, pose, gear, and palette.

### Creating a new style

Same draft → confirm → append → validate → use flow as the other pools:

1. **Draft** the object: `id` (kebab), `taxonomy: "style"`, `label`, `description`, `mesh_safe` (true **only** if it keeps flat light / white bg / matte / orthographic / isolated), `uses_framing` (true if the `prompt` contains a `<FRAMING>` slot), `prompt` (the full core prompt), `source: "hand-authored"`. Do **not** set `default` — there is exactly one default.
2. **Confirm** the full JSON with the user.
3. **Append** to `vocabulary/styles.json` — no duplicate `id`.
4. **Validate**: `bun run tools/validate-vocab.mjs` → `OK`.
5. **Use** it as the core prompt for the render.

> The rules below (do/don't, materials, background, aspect) are written for **`mesh_safe`** styles — the image-to-3D path. Beauty styles (`mesh_safe: false`) relax the lighting / background / material constraints by design; keep the framing and aspect-ratio guidance.

## Do / don't (applies to all subjects)

| Do | Don't |
|----|-------|
| "flat even diffuse shadowless lighting" | "dramatic / cinematic / rim light / golden hour" |
| "pure white seamless background, isolated" | "in a scene / environment / battlefield / hangar" |
| "matte surfaces, no reflections" | "glossy, wet, polished, chrome, shiny" |
| "orthographic, no foreshortening" | "low angle", "dutch tilt", "dramatic perspective" |
| "entire subject in frame, centered, margin" | "close-up", "cropped", "detail shot" |
| "single subject" | "group", "scene", "background elements" |
| neutral, symmetrical, still | "in motion", "mid-action", "explosion", "speed lines" |

## Negative phrases to append (optional)

Add a failure's opposite explicitly when a render comes back wrong:
`No cast shadows on the floor. No colored background. Do not crop the subject. Not a glossy surface. Only one subject. No motion blur, no depth of field.`

## Materials — force matte

Specular highlights and reflections are the #1 cause of warped geometry.

| Material | Prompt as |
|----------|-----------|
| Metal (armor, hull, weapons) | `brushed / oxidized matte metal, no specular shine` |
| Skin / scales / fur / hide | naturally matte — `matte skin`, `dry scales`, `soft fur` |
| Cloth / leather | already matte; great as-is |
| Glass / gems / canopy / slime | hardest case (transparency + specular) — prompt `opaque, matte`, expect cleanup |

## Aspect ratio & resolution

Pick from the subject module; general guidance:

| Subject shape | Aspect | Why |
|---------------|--------|-----|
| Tall (standing biped, A-pose) | `2:3` | Vertical mass |
| Square (arms-out T-pose, floating creature) | `1:1` | Balanced span |
| Wide (vehicle, quadruped, dragon, mech) | `3:2` or `4:3` | Horizontal mass |
| Final / high-detail | `--size 4K --model nano-banana-pro` | Cleaner symmetry, more geometry |

Engine accepts: `1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9` (NB2 also `1:4,4:1,1:8,8:1`).

## Background: white vs transparent

- **Default: pure white in-prompt** — robust, matches what every mesh tool expects, survives JPG export.
- **`--transparent`** — prepends an alpha-channel instruction → clean PNGA cutout with *zero* segmentation error. Often the best input if the tool accepts it; occasionally softens edges slightly. Test per tool.
- **`--remove-bg`** — post-process removal (needs `REMOVEBG_API_KEY`); use only if white-bg renders leave halos around fur/hair/thin antennae.

## Iteration

- Use `--creative-variations 3` to pick the cleanest silhouette before a final 4K pro render.
- Lumpy/warped mesh → the source had shadows or specular. Re-render flatter and matter.
- Fused forms → push separation (wider pose for characters; remove occluding attachments for vehicles).
- Keep lighting/background language **identical** across a set so a batch stays consistent.

## Multi-view tools (Rodin, multi-view mode)

Single-image is the default and works for nearly everything. If the target tool takes multiple views, generate **separate** consistent renders (single-image tools choke on multi-panel sheets):
1. Render the primary view first.
2. Pass it as `--reference-image` and prompt for `exact same subject, side / back / top view, same proportions and colors`.
3. Keep lighting + background language identical across all views.
