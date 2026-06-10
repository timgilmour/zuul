# ComfyUI Backend — Local Generation

Render on your own hardware: no cloud key, your checkpoints, your saved
workflows. Zuul treats a local [ComfyUI](https://www.comfy.org/) server as a
fourth provider alongside Google, Vertex, and OpenRouter.

This is the quickstart; the full reference (injection contract, discovery,
record schema, troubleshooting) is
[`core/comfyui-backend.md`](../skills/zuul/core/comfyui-backend.md).

## When to use it

- **Local / offline** — renders without a cloud API key
- **Model control** — a specific SD1.5/SDXL/fine-tuned checkpoint, LoRAs,
  ControlNet embedded in a saved workflow
- **Workflow fidelity** — keep a hand-crafted ComfyUI graph authoritative;
  Zuul injects only prompt, negative, and seed

For maximum out-of-the-box quality with zero setup, the cloud providers and
Nano Banana 2/Pro remain the default.

## Setup

1. Run ComfyUI and make it reachable as `localhost:8188` (or set
   `COMFYUI_URL` for another host/port). WSL2 users: this requires mirrored
   networking — `networkingMode=mirrored` in `~/.wslconfig`, then
   `wsl --shutdown`.
2. Set `COMFYUI_HOST` (or `COMFYUI_URL`) in `.env` / `~/.claude/.env`.
   With no cloud keys present, auto-detection routes to ComfyUI; with other
   keys set, force it with `--provider comfyui`.

## Two paths

| Path | Use | When |
|------|-----|------|
| **Agentic** | [`/zuul-comfy`](commands.md#zuul-comfy) | Interactive — discover workflows, pick a checkpoint, guided flow, job polling (needs the ComfyUI MCP server) |
| **Headless** | `--provider comfyui` on the [CLI](cli.md) | Scripted/batch — API-format workflow file or built-in txt2img |

## The injection contract (short version)

Your saved workflow stays **authoritative** for model, sampler, steps, and
size. Zuul injects only:

- **Positive / negative prompt** — into the `CLIPTextEncode` nodes titled
  `positive` / `negative` (title them in ComfyUI: right-click → Title)
- **Seed** — into every node with a numeric `seed` input

Size is overridden only when you explicitly pass `--size`. Sampling settings
are overridden only by the explicit knobs:

```
--comfyui-steps 30 --comfyui-cfg 7 --comfyui-sampler dpmpp_2m --comfyui-scheduler karras
```

## Headless examples

```bash
# Built-in txt2img with a chosen checkpoint
bun run <zuul>/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-checkpoint v1-5-pruned-emaonly-fp16.safetensors \
  --prompt "a small goblin rogue, concept art, plain background" \
  --size 1K --aspect-ratio 2:3 --seed 12345 \
  --output ./zuul-output/concepts/characters/goblin-rogue/goblin-rogue-01.png

# Run a saved workflow (export via File → Save (API Format) in ComfyUI;
# requires the "Enable Dev Mode Options" setting — the regular Save format won't work)
bun run <zuul>/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-workflow ./hero-sheet-api.json \
  --prompt "a brass automaton knight, front-facing orthographic" \
  --seed 7 \
  --output ./zuul-output/concepts/characters/automaton-knight/automaton-knight-01.png

# What checkpoints does the server have?
bun run <zuul>/tools/generate-image.ts --list-comfyui-models
```

## Quality note

Local SD checkpoints follow prompts less literally than Nano Banana — expect
to lean harder on the negative prompt and the sampling knobs to hold the
mesh-gen constraints (white background, flat light, single subject). The
[mesh pipeline](mesh-pipeline.md) "failure's opposite" trick matters more
here.
