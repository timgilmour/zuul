---
description: Generate concept art via local ComfyUI — agentic workflow selection, prompt injection, and retrieval
argument-hint: "[workflow-filename] [subject description]"
allowed-tools: Bash(bun run:*), Read, Write, Edit, mcp__comfyui__health_check, mcp__comfyui__list_workflows, mcp__comfyui__get_workflow, mcp__comfyui__get_node_info, mcp__comfyui__enqueue_workflow, mcp__comfyui__get_job_status, mcp__comfyui__get_history, mcp__comfyui__get_image
---
Use the **zuul** skill with the local ComfyUI server as the render backend.

Arguments: $ARGUMENTS
(Optional: first word may be a workflow filename, e.g. `hero-sheet.json`; remaining words describe the subject.)

## Flow

### 1. Preflight

Call `mcp__comfyui__health_check`. If the server is unreachable, stop immediately and tell the user:

> ComfyUI is not reachable. Check that ComfyUI is running on Windows and that WSL2 mirrored networking is configured — see `~/.wslconfig` and `04-Skills/zuul/core/comfyui-backend.md`.

### 2. Discover

- **Workflows:** call `mcp__comfyui__list_workflows` to get available saved graphs.
- **Checkpoints:** the `health_check` response includes a model list — read it to find available checkpoints. If the list is empty or unclear, call `mcp__comfyui__get_node_info` with `node_type="CheckpointLoaderSimple"` to read the live checkpoint list from ComfyUI's `/object_info` endpoint.
- Do NOT use `list_local_models` — it requires `COMFYUI_PATH`, which is intentionally unset for the cross-OS (WSL/Windows) setup.

### 3. Select

Present the available workflows and checkpoints. If `$ARGUMENTS` names a workflow file, pre-select it; otherwise ask the user to choose. The user may optionally override the checkpoint embedded in the workflow.

### 4. Assemble prompt

Build the positive and negative prompt using zuul's normal assembly pipeline:
- Read `core/assembly.md` for the slot-merge rules.
- Look up subject vocabulary in `vocabulary/` (species, genre, roles, descriptors, intersections, styles).
- Choose a style from `vocabulary/styles.json` (default: `clean-mesh-gen`).
- Apply the render rules from `core/render-rules.md`.

Pick a seed integer and present it to the user before rendering.

### 5. Inject

Call `mcp__comfyui__get_workflow(filename, format="api")` to retrieve the selected workflow in API format.

Inject zuul's assembled values into the workflow graph:

- **Positive prompt node:** find the `CLIPTextEncode` node whose `_meta.title` contains `positive` (case-insensitive). Fallback: trace `KSampler.positive` to its source node. Set `inputs.text`.
- **Negative prompt node:** same approach via `_meta.title` containing `negative` or `KSampler.negative`. Set `inputs.text`.
- **Seed:** set `inputs.seed` on every node that has a numeric `seed` field (typically the `KSampler`).
- **Size:** inject `width`/`height` into `EmptyLatentImage` nodes **only** if the user explicitly requested a size override. Otherwise leave the workflow's size intact — the workflow is authoritative.

Do not alter any other inputs. For complex graphs (SDXL dual-CLIP, refiner chains), read the workflow structure carefully before injecting.

### 6. Run and await

Call `mcp__comfyui__enqueue_workflow` with the modified workflow.

Poll `mcp__comfyui__get_job_status` at ~3-second intervals until the job status is `completed` or `error`. Do not rely on push notifications — the completion hook is not installed.

If the job errors, surface the error message and stop.

### 7. Retrieve and record

Get the output filename from the job status or `mcp__comfyui__get_history`.

**Copy the file from the Windows output mount:**

```bash
cp /mnt/c/Users/tim/ComfyUI-Shared/output/<filename> \
   09-Outputs/concepts/<type>/<slug>/<slug>-NN.png
```

If the mounted path is not readable, fall back to `mcp__comfyui__get_image` to fetch the bytes.

Write the `.txt` prompt sidecar alongside the image:

```bash
echo "<positive prompt>" > 09-Outputs/concepts/<type>/<slug>/<slug>-NN.txt
```

Write or update the subject `.json` record at `09-Outputs/concepts/<type>/<slug>/<slug>.json`. The render entry must include:

```json
{
  "file": "<slug>-NN.png",
  "backend": "comfyui",
  "workflow": "<workflow-filename or built-in-txt2img>",
  "checkpoint": "<resolved checkpoint name>",
  "seed": <seed>,
  "sampler": "<sampler from workflow>",
  "steps": <steps>,
  "cfg": <cfg>,
  "size": "<WxH>",
  "type": "action | a-pose | t-pose | turnaround",
  "prompt": "<full positive prompt>"
}
```

Rebuild the output index:

```bash
bun run 04-Skills/zuul/tools/build-index.mjs
```

## Examples

```
/zuul-comfy
```
Interactive: discover workflows and checkpoints, ask the user to select, then run the full guided flow.

```
/zuul-comfy hero-sheet.json a brass automaton knight
```
Pre-select `hero-sheet.json`, infer subject from "a brass automaton knight", skip or shorten the questionnaire for dimensions already clear from the description, then render.
