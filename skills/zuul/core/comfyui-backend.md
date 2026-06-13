# ComfyUI Backend — Reference

How to use ComfyUI as a zuul render backend, covering both the agentic and headless paths, injection rules, discovery, networking, and record schema.

## When to use

Choose the ComfyUI backend when you want:

- **Local / offline generation** — no cloud API key required; renders on your own hardware.
- **Model control** — run a specific SD1.5, SDXL, FLUX.2, or fine-tuned checkpoint; use LoRA/ControlNet nodes embedded in a saved workflow.
- **Workflow fidelity** — preserve a hand-crafted ComfyUI graph (sampling schedule, refiners, upscalers, ControlNet wiring) and inject only zuul's prompt and seed into it.

Use the Gemini providers (Google, Vertex, OpenRouter) when you want the highest output quality without local infrastructure, or when the subject requires Nano Banana Pro's multi-element reasoning.

## Two paths

| Path | Command | When |
|------|---------|------|
| **Agentic** | `/zuul-comfy` | Interactive sessions — discover workflows, select a checkpoint, full guided flow |
| **Headless** | `--provider comfyui` in `generate-image.ts` | Scripted/batch generation; API-format workflow file or built-in txt2img |

Both paths use the same injection contract and networking assumptions.

## Architecture selection (SD/SDXL vs FLUX.2)

zuul supports two distinct graph paths. The correct path is auto-detected from the model name; an explicit override is available when needed.

### Model flag

`--comfyui-model <name>` (alias: `--comfyui-checkpoint`) selects the model. Auto-detect inspects which loader category the name belongs to:

- Name found in ComfyUI's **`checkpoints`** list → **SD/SDXL path** (uses `CheckpointLoaderSimple`)
- Name found in **`diffusion_models`** and filename matches `flux`/`flux2`/`klein` → **FLUX.2 path** (uses `UNETLoader`)

Use `--comfyui-arch <sd|flux2>` to override auto-detect when the model name is ambiguous or the detection is wrong.

### FLUX.2 component overrides

| Flag | Default when omitted |
|------|---------------------- |
| `--comfyui-unet <name>` | — (resolved from `--comfyui-model`) |
| `--comfyui-clip <name>` | The sole `CLIPLoader` option available on the server |
| `--comfyui-vae <name>` | `flux2-vae.safetensors` if present, else the sole VAE |

**kv guard:** selecting a `*-kv-fp8*` UNet prints a warning — this variant needs ~29 GB VRAM (RTX 5090+) and will likely OOM on smaller cards — and proceeds without blocking.

### FLUX.2 native graph

The FLUX.2 path builds a graph from scratch using native nodes:

```
UNETLoader(weight_dtype=default)
  + CLIPLoader(type=flux2)
  + VAELoader
  → CLIPTextEncode
  → EmptyFlux2LatentImage
  → BasicGuider
  → KSamplerSelect + Flux2Scheduler + RandomNoise
  → SamplerCustomAdvanced
  → VAEDecode
  → SaveImage
```

Defaults: 4 steps, `euler` sampler, no CFG, no negative prompt (klein is guidance-distilled). `FluxKontextImageScale` is not used.

## Injection contract

zuul injects the **minimal** set into the workflow by default. The saved workflow is authoritative for everything else.

### What is always injected

| Target | How it is found | What is set |
|--------|----------------|-------------|
| Positive prompt node | `CLIPTextEncode` whose `_meta.title` starts with `positive` (case-insensitive) | `inputs.text` |
| Negative prompt node | `CLIPTextEncode` whose `_meta.title` starts with `negative` | `inputs.text` |
| Seed | Every node with a numeric `seed` input (typically `KSampler`/`RandomNoise`) | `inputs.seed` |

### Fallback: link tracing

If neither prompt node carries a title, the injection code traces connections from the single sampler node's `positive` link to its source and injects there. The fallback handles both `KSampler`/`SamplerCustom` (SD/SDXL, with `positive` and `negative` inputs) and `BasicGuider` (FLUX.2, with `conditioning` input), walking through any `ReferenceLatent` or `FluxGuidance` chain. If neither title convention nor tracing resolves the positive node, a `ComfyUIError` is thrown with guidance to title the nodes.

### Size — only on explicit override

`width` and `height` are set on `EmptyLatentImage`/`EmptyFlux2LatentImage` nodes **only** when the user explicitly passes `--size` (headless) or requests a size override (agentic). When not overridden, the workflow's own latent node size wins.

### Title your prompt nodes

For reliable injection, title your `CLIPTextEncode` nodes in ComfyUI: right-click the node → "Title" → set one to `positive` and the other to `negative`. This is especially important for complex workflows with multiple text encoders (SDXL dual-CLIP, refiner chains, FLUX.2 with reference images).

## Discovery

The ComfyUI backend discovers available resources over HTTP — no filesystem access to the Windows ComfyUI install is required or used.

| Resource | How discovered |
|----------|---------------|
| Saved workflows | `mcp__comfyui__list_workflows` (agentic) or `--list-comfyui-workflows` (headless, prints guidance) |
| Checkpoints (SD/SDXL) | `client.listCheckpoints()` via `/object_info` — reads `checkpoints` category |
| FLUX.2 UNets | `client.listDiffusionModels()` via `/object_info` — reads `diffusion_models` category |
| CLIPs / VAEs | `/object_info` for `CLIPLoader` and `VAELoader` node schemas |
| LoRAs / other models | Read from the workflow graph itself — use `analyze_workflow` or inspect the JSON |

`list_local_models` is deliberately **not used** — it requires `COMFYUI_PATH` to be set, which is intentionally left unset for the cross-OS (MCP-in-WSL, ComfyUI-on-Windows) setup.

## Headless usage (`--provider comfyui`)

### Flags

| Flag | Purpose |
|------|---------|
| `--provider comfyui` | Force ComfyUI backend (auto-detected if `COMFYUI_HOST` or `COMFYUI_URL` is set) |
| `--comfyui-workflow <path>` | Run an API-format workflow JSON file; inject prompt/negative/seed into it |
| `--comfyui-template <name>` | Run a named template: bundled first (`workflows/<name>.json`), then server saved workflow |
| `--comfyui-model <name>` | Model to use; alias: `--comfyui-checkpoint`. Auto-detects SD or FLUX.2 architecture |
| `--comfyui-arch <sd\|flux2>` | Override auto-detect when architecture is ambiguous |
| `--comfyui-unet <name>` | FLUX.2 only: explicit UNet model name |
| `--comfyui-clip <name>` | FLUX.2 only: explicit CLIP model name |
| `--comfyui-vae <name>` | FLUX.2 only: explicit VAE model name |
| `--list-comfyui-models` | List available checkpoints and diffusion models, then exit |
| `--size <size>` | `512px` / `1K` / `2K` / `4K` — also marks the size as explicit (triggers latent node override) |
| `--aspect-ratio <ratio>` | Standard aspect ratios; used when size is explicit or built-in txt2img |
| `--seed <n>` | Seed injected into every sampler-family node |
| `--reference-image <path>` | Reference image(s) for img2img / FLUX.2 reference conditioning (repeatable) |

### Sampling controls

These flags override the sampler settings. The saved workflow is authoritative — a flag only overrides the workflow's value when the flag is explicitly passed.

| Flag | Overrides | Example values |
|------|-----------|---------------|
| `--comfyui-steps <int>` | `KSampler.steps` / FLUX.2 scheduler steps | `4`, `20`, `30`, `50` |
| `--comfyui-cfg <number>` | `KSampler.cfg` | `7`, `5.5`, `12` |
| `--comfyui-sampler <name>` | `KSampler.sampler_name` | `euler`, `euler_a`, `dpmpp_2m` |
| `--comfyui-scheduler <name>` | `KSampler.scheduler` | `normal`, `karras`, `exponential` |

Overrides apply to **both** built-in txt2img mode and workflow mode. In workflow mode, only the nodes that already have the matching input key are updated — the same pattern as seed and size injection. FLUX.2's native graph uses `BasicGuider` + `Flux2Scheduler` + `RandomNoise`, so `--comfyui-cfg` has no effect on that path.

### Templates

`--comfyui-template <name>` resolves in this order:

1. **Bundled** — `04-Skills/zuul/workflows/<name>.json` (API format, ships with the skill)
2. **Server** — a workflow saved inside ComfyUI with that name

When a template or workflow is active, it is **authoritative**: only the prompt, seed, and (if `--size` is explicit) size are injected; `--comfyui-model` is ignored with a warning.

The CLI automatically converts GUI-format server workflows to API format (`guiWorkflowToApi`). It skips annotation nodes (`Note` / `MarkdownNote`). It does **not** support **subgraph** nodes — modern ComfyUI wraps saved workflows in subgraphs by default. If a subgraph is detected, a clear error is thrown. Resolution options:

- Right-click the subgraph → **"Unpack Subgraph"** (older ComfyUI builds: "Convert to Nodes") and re-save the workflow.
- Use a bundled template (`--comfyui-template`).
- Use the agentic `/zuul-comfy` path.

`Reroute` and `Primitive` nodes are likewise rejected with a clear error.

`--comfyui-workflow <path>` still runs an ad-hoc API-format file directly without template resolution.

### Reference images

`--reference-image <path>` is supported for both SD/SDXL and FLUX.2 backends.

- **FLUX.2:** the flag is repeatable — each occurrence adds a chained `ReferenceLatent` node (LoadImage → VAEEncode → ReferenceLatent). Local files are uploaded to ComfyUI's input directory first, making cross-machine operation transparent.
- **SD/SDXL:** single reference image via img2img; not repeatable.

### API-format workflows

Export a workflow from ComfyUI via **File → Save (API Format)** (requires the "Enable Dev Mode Options" toggle in ComfyUI settings). The resulting JSON contains node IDs as keys — this is what `--comfyui-workflow` expects. The default "Save" format is the GUI format; it is auto-converted but is subject to the subgraph limitation above.

### Examples

```bash
# Built-in txt2img with an SD checkpoint
bun run 04-Skills/zuul/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-model v1-5-pruned-emaonly-fp16.safetensors \
  --prompt "a small goblin rogue, concept art, plain background" \
  --size 1K --aspect-ratio 2:3 --seed 12345 \
  --output 09-Outputs/concepts/characters/goblin-rogue/goblin-rogue-01.png

# FLUX.2 (klein, guidance-distilled) — fast local draft
bun run 04-Skills/zuul/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-model flux-2-klein-9b-fp8.safetensors \
  --prompt "a brass automaton knight, front-facing orthographic, plain white background" \
  --size 2K --aspect-ratio 2:3 --seed 7 \
  --output 09-Outputs/concepts/characters/automaton-knight/automaton-knight-01.png

# FLUX.2 with a reference image
bun run 04-Skills/zuul/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-model flux-2-klein-9b-fp8.safetensors \
  --reference-image /tmp/ref-sketch.png \
  --prompt "a drow rogue, side-lit, cinematic" \
  --size 2K --aspect-ratio 2:3 --seed 42 \
  --output 09-Outputs/concepts/characters/drow-rogue/drow-rogue-02.png

# Run an API-format workflow file
bun run 04-Skills/zuul/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-workflow /tmp/hero-sheet-api.json \
  --prompt "a brass automaton knight, front-facing orthographic" \
  --seed 7 \
  --output 09-Outputs/concepts/characters/automaton-knight/automaton-knight-01.png

# Use a bundled template
bun run 04-Skills/zuul/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-template flux2-portrait \
  --prompt "tiefling warlock, dramatic rim lighting" \
  --seed 99 \
  --output 09-Outputs/concepts/characters/tiefling-warlock/tiefling-warlock-01.png

# List available models
bun run 04-Skills/zuul/tools/generate-image.ts --list-comfyui-models
```

## Networking

The ComfyUI backend connects over HTTP to `COMFYUI_HOST:COMFYUI_PORT` (default `127.0.0.1:8188`) from inside WSL2. This requires **WSL2 mirrored networking** — the Windows ComfyUI server must be reachable at `localhost` from WSL.

Configure mirrored networking in `~/.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
```

Restart WSL after changing this file (`wsl --shutdown`). If `health_check` fails, verify that ComfyUI is running on Windows and that `localhost:8188` is reachable from a WSL terminal (`curl http://localhost:8188/system_stats`).

Override the URL with `COMFYUI_URL=http://...` for non-default hosts, ports, or remote servers.

## Record fields

ComfyUI renders add the following fields to the subject `.json` render entry (alongside the standard `file`, `type`, `size`, `seed`, `prompt`):

```json
{
  "backend": "comfyui",
  "arch": "sd | flux2",
  "workflow": "<workflow-filename, template name, or built-in-txt2img>",
  "checkpoint": "<resolved checkpoint name (SD/SDXL)>",
  "unet": "<UNet model name (FLUX.2)>",
  "clip": "<CLIP model name (FLUX.2)>",
  "vae": "<VAE model name (FLUX.2)>",
  "template": "<template name if --comfyui-template was used>",
  "references": ["<reference image filename>"],
  "sampler": "<sampler name>",
  "steps": 20,
  "cfg": 7,
  "size": "1024x768"
}
```

`arch` is `"sd"` for SD1.5/SDXL checkpoints and `"flux2"` for FLUX.2 UNet models. `build-index.mjs` treats these as additive fields — no breaking changes to `index.json`. Fields that don't apply to a given render (e.g. `unet`/`clip`/`vae` on an SD render, or `checkpoint` on a FLUX.2 render) are omitted.

## Limits and deferred scope

| Feature | Status |
|---------|--------|
| `--reference-image` / img2img | **Supported** — FLUX.2: repeatable, chained `ReferenceLatent`; SD/SDXL: single reference |
| `--transparent` (alpha channel) | Deferred — SD has no native alpha; throws `CLIError` |
| Automatic LoRA/ControlNet wiring | Deferred — use a saved workflow that already includes them |
| `--thinking`, `--grounded` | Ignored with a warning (Gemini-only features) |
| Multi-image batch (`--creative-variations`) | Not yet wired for ComfyUI |
| Subgraph expansion in the CLI | Deferred — unpack subgraphs manually in ComfyUI (right-click → Unpack Subgraph) |
| `control_after_generate` seed widget | Known quirk: can misalign for a mid-list KSampler; harmless on the FLUX.2 `RandomNoise` path where the widget is trailing |
