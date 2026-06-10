# Mesh Pipeline — Renders That Survive Image-to-3D

Zuul's reason for existing: single-image image-to-3D generators (Meshy,
Tripo, Hunyuan3D, Rodin) reconstruct best from a very particular kind of
image. The defaults produce it; this doc explains what the knobs mean so you
know when to leave them alone.

## What a mesh-friendly render looks like

The default style, `clean-mesh-gen`, enforces the hard rules from
[`core/render-rules.md`](../skills/zuul/core/render-rules.md):

- **Flat, even, shadowless lighting** — baked-in shadows become baked-in
  geometry errors
- **Pure white seamless background, single isolated subject** — no scene,
  no companions
- **Matte surfaces** — gloss and reflections confuse photogrammetry-style
  reconstruction
- **Orthographic, no foreshortening** — perspective distortion warps the mesh
- **Entire subject in frame, centered, with margin** — cropped limbs are
  unrecoverable

If a render comes back wrong, append the failure's opposite explicitly
(*"No cast shadows on the floor. Only one subject. No motion blur."*) and
re-render with the same seed.

## Mesh-safe poses

Poses in `vocabulary/poses.json` are tagged `mesh-gen` or `observed`, and
filtered by the subject's body plan:

| Pose | Body plan | Aspect |
|------|-----------|--------|
| `a-pose` | biped | 2:3 |
| `t-pose` | biped | 1:1 |
| `quadruped-stand` | quadruped | 4:3 |
| `winged-spread` | winged | 4:3 |
| `floating-idle` | floating | 1:1 |

A-pose is generally preferred over T-pose for organic subjects (less armpit
distortion). `observed` poses (action, roar, mid-stride) make great splash
art and poor meshes — Zuul pairs them with the beauty styles
(`mesh_safe: false`), not the mesh path.

## Useful flags

| Flag | Why |
|------|-----|
| `--transparent` | PNG-with-alpha is often cleaner than white for mesh tools that accept it |
| `--remove-bg` | Hard background removal post-step (needs `REMOVEBG_API_KEY`) |
| `--seed <n>` | Lock a seed so pose/style iterations keep the same character |
| `--size 512px` | Cheap previews before committing to the 2K/4K final |

## The ingest → normalize loop

Found a reference image — a sketch, a screenshot, someone else's concept?

1. **Ingest:** `/zuul-ingest <image>` describes it into a structured subject
   record + pose (see
   [`core/ingest-image.md`](../skills/zuul/core/ingest-image.md)).
2. **Normalize:** ask for a mesh-ready version — *"Make a mesh-ready A-pose
   version of this character"*. Zuul re-renders the same identity in
   `clean-mesh-gen` style, A-pose, white background.
3. **Iterate with the seed:** the subject's JSON record stores every render's
   seed, flags, and full prompt, so you can reproduce or vary deliberately.

## Hand-off

Feed the final PNG straight to your mesh generator. The prompt sidecar
(`<slug>-NN.txt`) next to each render holds the exact prompt — useful for
re-rendering elsewhere or documenting provenance in your pipeline.
