# Prompting Guide — Gemini Image Models

Practical techniques for getting consistent, high-quality results from Nano Banana 2 and Nano Banana Pro. Applies to all generation in zuul.

## Core prompt formula

```
[Action] the [Subject] by [Specific Change]. The goal is [Desired Outcome].
```

Example for concept renders:
```
Render the drow paladin in A-pose by neutralizing the action stance to a relaxed symmetrical standing pose. The goal is a clean mesh-generation reference with no foreshortening.
```

## Action verb vocabulary

Use specific verbs — they anchor what the model is actually being asked to do:

| Verb | Use for |
|------|---------|
| **Render** | Generating a new subject from description |
| **Recolor** | Changing color schemes or palettes |
| **Retouch** | Subtle refinements and cleanup |
| **Adjust** | Lighting, composition, positioning |
| **Enhance** | Improving quality or adding detail |
| **Transform** | Major changes — pose, style, era |
| **Add** | Inserting new elements into a scene |
| **Remove** | Deleting unwanted objects |
| **Replace** | Swapping one element for another |
| **Blend** | Combining or transitioning between references |

## Prompt construction rules

**Name colors, never use hex codes.** `#1A8A9B` renders as visible text in the image. Use "deep teal," "rust orange," "charcoal grey" instead.

**Explicit positioning beats implicit.** "Top-left," "centered," "horizontal row" works. "Arrange nicely" does not.

**Name each subject in multi-element prompts.** For a scene with multiple figures, name each one, describe distinguishing features, and specify spatial relationships explicitly.

**Semantic world knowledge works — use it.** The model understands:
- **Physics:** gravity, cast shadows, reflections, weight distribution
- **Cultural context:** era-appropriate clothing, symbols, environments
- **Time of day / season:** golden hour, winter light, overcast diffuse

Mentioning these in the prompt activates that knowledge without spelling out every detail.

## Common issues and fixes

| Problem | Fix |
|---------|-----|
| Subject looks too polished / vector-like | Add "rough surface texture, natural imperfections, hand-worn quality" |
| Wrong color intensity | Specify "muted," "desaturated," "deeply saturated," "flat" — avoid relying on named colors alone |
| Fused or cluttered forms | Reduce to single subject; explicitly state "single isolated subject, no overlapping forms" |
| Inconsistent style across a set | Use `--reference-image` pointing to a previous render in the same set |
| Wrong pose / unexpected foreshortening | Add "orthographic, no foreshortening, neutral eye-level camera, no perspective distortion" |
| Glossy surfaces on mesh | Add "matte surfaces, no specular highlights, no reflections" — see `core/render-rules.md` for the full material table |
| Subject cropped | Add "entire subject in frame, centered with empty margin on all sides" |
| Background appearing | Add "pure white seamless background, single subject fully isolated" |

## Iterative refinement

The model retains context across turns in a session — use this:

1. **Start with the subject identity** — get the face/silhouette right first
2. **Lock the pose** — A-pose or target pose once identity is confirmed
3. **Refine materials** — armour, skin, clothing details
4. **Finalize with a 4K nano-banana-pro run** — once everything else is locked

Pass the approved lower-resolution render as `--reference-image` in later steps to lock style continuity.

## Preview → final workflow

```bash
# Step 1: fast preview to check composition
bun run <ZUUL>/tools/generate-image.ts \
  --prompt "..." --size 512px --output /tmp/preview.png

# Step 2: approved? generate final
bun run <ZUUL>/tools/generate-image.ts \
  --prompt "..." --size 2K --output <OUTPUT_DIR>/concepts/.../slug-01.png

# Step 3: final quality pass
bun run <ZUUL>/tools/generate-image.ts \
  --prompt "..." --model nano-banana-pro --size 4K \
  --reference-image <OUTPUT_DIR>/concepts/.../slug-01.png \
  --output <OUTPUT_DIR>/concepts/.../slug-01-final.png
```

## Thinking flag

Add `--thinking high` to nano-banana-2 when the composition has multiple elements that need precise spatial relationships (e.g. a character with complex armour, multiple accessories, or a vehicle with detailed greebling). Not needed for simple single-subject A-poses.
