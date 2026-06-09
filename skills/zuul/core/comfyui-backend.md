# ComfyUI Backend — Reference

How to use ComfyUI as a zuul render backend, covering both the agentic and headless paths, injection rules, discovery, networking, and record schema.

## When to use

Choose the ComfyUI backend when you want:

- **Local / offline generation** — no cloud API key required; renders on your own hardware.
- **Model control** — run a specific SD1.5, SDXL, or fine-tuned checkpoint; use LoRA/ControlNet nodes embedded in a saved workflow.
- **Workflow fidelity** — preserve a hand-crafted ComfyUI graph (sampling schedule, refiners, upscalers, ControlNet wiring) and inject only zuul's prompt and seed into it.

Use the Gemini providers (Google, Vertex, OpenRouter) when you want the highest output quality without local infrastructure, or when the subject requires Nano Banana Pro's multi-element reasoning.

## Two paths

| Path | Command | When |
|------|---------|------|
| **Agentic** | `/zuul-comfy` | Interactive sessions — discover workflows, select a checkpoint, full guided flow |
| **Headless** | `--provider comfyui` in `generate-image.ts` | Scripted/batch generation; API-format workflow file or built-in txt2img |

Both paths use the same injection contract and networking assumptions.

## Injection contract

zuul injects the **minimal** set into the workflow by default. The saved workflow is authoritative for everything else.

### What is always injected

| Target | How it is found | What is set |
|--------|----------------|-------------|
| Positive prompt node | `CLIPTextEncode` whose `_meta.title` starts with `positive` (case-insensitive) | `inputs.text` |
| Negative prompt node | `CLIPTextEncode` whose `_meta.title` starts with `negative` | `inputs.text` |
| Seed | Every node with a numeric `seed` input (typically `KSampler`) | `inputs.seed` |

### Fallback: KSampler link tracing

If neither prompt node carries a title, the injection code traces the single `KSampler`-family node's `positive` and `negative` connections to their source nodes and injects there. This fallback requires exactly one `KSampler` / `SamplerCustom` in the graph. If neither title convention nor tracing resolves the positive node, a `ComfyUIError` is thrown with guidance to title the nodes.

### Size — only on explicit override

`width` and `height` are set on `EmptyLatentImage` nodes **only** when the user explicitly passes `--size` (headless) or requests a size override (agentic). When not overridden, the workflow's own `EmptyLatentImage` size wins. This is the concrete meaning of "the workflow is authoritative."

### Title your prompt nodes

For reliable injection, title your `CLIPTextEncode` nodes in ComfyUI: right-click the node → "Title" → set one to `positive` and the other to `negative`. This is especially important for complex workflows with multiple text encoders (SDXL dual-CLIP, refiner chains).

## Discovery

The ComfyUI backend discovers available resources over HTTP — no filesystem access to the Windows ComfyUI install is required or used.

| Resource | How discovered |
|----------|---------------|
| Saved workflows | `mcp__comfyui__list_workflows` (agentic) or `--list-comfyui-workflows` (headless, prints guidance) |
| Checkpoints | `health_check` model list or `mcp__comfyui__get_node_info(CheckpointLoaderSimple)` (agentic); `client.listCheckpoints()` via `/object_info` (headless) |
| LoRAs / other models | Read from the workflow graph itself — use `analyze_workflow` or inspect the JSON |

`list_local_models` is deliberately **not used** — it requires `COMFYUI_PATH` to be set, which is intentionally left unset for the cross-OS (MCP-in-WSL, ComfyUI-on-Windows) setup.

## Headless usage (`--provider comfyui`)

### Flags

| Flag | Purpose |
|------|---------|
| `--provider comfyui` | Force ComfyUI backend (auto-detected if `COMFYUI_HOST` or `COMFYUI_URL` is set) |
| `--comfyui-workflow <path>` | Run an API-format workflow JSON file; inject prompt/negative/seed into it |
| `--comfyui-checkpoint <name>` | Checkpoint for built-in txt2img (omit to auto-select the first available) |
| `--list-comfyui-models` | List available checkpoints and exit |
| `--size <size>` | `512px` / `1K` / `2K` / `4K` — also marks the size as explicit (triggers `EmptyLatentImage` override) |
| `--aspect-ratio <ratio>` | Standard aspect ratios; used when size is explicit or built-in txt2img |
| `--seed <n>` | Seed injected into every `KSampler`-family node |

### Sampling controls

These flags override the KSampler sampling settings. The saved workflow is authoritative — a flag only overrides the workflow's value when the flag is explicitly passed.

| Flag | Overrides | Example values |
|------|-----------|---------------|
| `--comfyui-steps <int>` | `KSampler.steps` | `20`, `30`, `50` |
| `--comfyui-cfg <number>` | `KSampler.cfg` | `7`, `5.5`, `12` |
| `--comfyui-sampler <name>` | `KSampler.sampler_name` | `euler`, `euler_a`, `dpmpp_2m` |
| `--comfyui-scheduler <name>` | `KSampler.scheduler` | `normal`, `karras`, `exponential` |

Overrides apply to **both** built-in txt2img mode and workflow mode. In workflow mode, only the nodes that already have the matching input key are updated — the same pattern as seed and size injection.

### API-format workflows

Export a workflow from ComfyUI via **File → Save (API Format)** (requires the "Enable Dev Mode Options" toggle in ComfyUI settings). The resulting JSON contains node IDs as keys — this is what `--comfyui-workflow` expects. The default "Save" format is the GUI format and will not work.

### Examples

```bash
# Built-in txt2img with an explicit checkpoint
bun run 04-Skills/zuul/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-checkpoint v1-5-pruned-emaonly-fp16.safetensors \
  --prompt "a small goblin rogue, concept art, plain background" \
  --size 1K --aspect-ratio 2:3 --seed 12345 \
  --output 09-Outputs/concepts/characters/goblin-rogue/goblin-rogue-01.png

# Run an API-format workflow file
bun run 04-Skills/zuul/tools/generate-image.ts \
  --provider comfyui \
  --comfyui-workflow /tmp/hero-sheet-api.json \
  --prompt "a brass automaton knight, front-facing orthographic" \
  --seed 7 \
  --output 09-Outputs/concepts/characters/automaton-knight/automaton-knight-01.png

# List available checkpoints
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
  "workflow": "<workflow-filename or built-in-txt2img>",
  "checkpoint": "<resolved checkpoint name>",
  "sampler": "<sampler name from KSampler>",
  "steps": 20,
  "cfg": 7,
  "size": "1024x768"
}
```

`build-index.mjs` treats these as additive fields — no breaking changes to `index.json`.

## Limits and deferred scope

| Feature | Status |
|---------|--------|
| `--reference-image` / img2img | Deferred — throws `CLIError` if attempted with `comfyui` provider |
| `--transparent` (alpha channel) | Deferred — SD has no native alpha; throws `CLIError` |
| Automatic LoRA/ControlNet wiring | Deferred — use a saved workflow that already includes them |
| `--thinking`, `--grounded` | Ignored with a warning (Gemini-only features) |
| Multi-image batch (`--creative-variations`) | Not yet wired for ComfyUI |
