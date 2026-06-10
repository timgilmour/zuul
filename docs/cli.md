# CLI Reference

Three Bun scripts live in [`skills/zuul/tools/`](../skills/zuul/tools/).
First use requires a one-time `bun install` in that directory (the installer
does this for you).

## `generate-image.ts`

The renderer. Supports Google Gemini (direct), Vertex AI, OpenRouter, and
ComfyUI (local) as providers.

```bash
bun run <zuul>/tools/generate-image.ts --prompt "<prompt>" [OPTIONS]
```

### Core flags

| Flag | Default | Notes |
|------|---------|-------|
| `--prompt <text>` | *(required)* | The generation prompt |
| `--model <model>` | `nano-banana-2` | Or `nano-banana-pro` for finals / complex compositions |
| `--provider <p>` | auto-detected | `google`, `vertex`, `openrouter`, `comfyui` |
| `--size <size>` | `2K` | `512px` (NB2 only), `1K`, `2K`, `4K` |
| `--aspect-ratio <r>` | `16:9` | `1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9`; NB2 also `1:4, 4:1, 1:8, 8:1` |
| `--output <path>` | `/tmp/generated-image.png` | Zuul's guided flow always passes an explicit path |
| `--seed <n>` | none | Best-effort determinism; unavailable with `--thinking` or OpenRouter |

### Quality & composition flags

| Flag | Notes |
|------|-------|
| `--reference-image <path>` | PNG/JPEG/WebP reference for style/composition guidance |
| `--transparent` | Adds transparency instructions — often better than white BG for mesh tools that accept PNGA |
| `--remove-bg` | Background removal post-step (needs `REMOVEBG_API_KEY`) |
| `--thinking <level>` | `minimal` (default) / `high` — NB2 + Google only; for precise multi-element layouts |
| `--grounded` | Web-search grounding for real-world subjects (NB2 + Google only) |
| `--creative-variations <n>` | N variations, suffixed `-v1`, `-v2`, … |

### ComfyUI flags

See [ComfyUI backend](comfyui.md) for the full story.

| Flag | Notes |
|------|-------|
| `--comfyui-workflow <path>` | Run an API-format workflow JSON; zuul injects prompt/negative/seed |
| `--comfyui-checkpoint <name>` | Checkpoint for built-in txt2img (omit to auto-select) |
| `--comfyui-steps <int>` / `--comfyui-cfg <n>` / `--comfyui-sampler <name>` / `--comfyui-scheduler <name>` | KSampler overrides; only applied when explicitly passed — the saved workflow stays authoritative |
| `--list-comfyui-models` | List checkpoints and exit |
| `--list-comfyui-workflows` | Print workflow-discovery guidance |

### Output behavior

- Writes a **prompt sidecar** next to every image — `<name>.txt` containing
  only the exact prompt used.
- **Corrects the file extension to match actual bytes** (some models return
  JPEG even for a `.png` path) and prints `Image saved to <path>` — trust the
  printed name, not the requested one.

### Environment variables

| Variable | For |
|----------|-----|
| `GOOGLE_API_KEY` | Google provider (Gemini API / AI Studio) |
| `GOOGLE_API_KEY_VERTEX` | Vertex AI Express Mode (API-key auth) |
| `GOOGLE_CLOUD_PROJECT` (+ optional `GOOGLE_CLOUD_LOCATION`) | Full Vertex AI via ADC (default location `us-central1`) |
| `OPENROUTER_KEY` | OpenRouter provider |
| `REMOVEBG_API_KEY` | `--remove-bg` |
| `COMFYUI_HOST` / `COMFYUI_PORT` (or `COMFYUI_URL`) | ComfyUI backend |

Loaded from `.env` in the current directory or `~/.claude/.env`. Without
`--provider`, the first credential found wins, in the table's order
(Google → Vertex → OpenRouter → ComfyUI).

Run with `--help` for the complete, always-current text.

## `validate-vocab.mjs`

Validates the vocabulary pools against the contract in
[`vocabulary/SCHEMA.md`](../skills/zuul/vocabulary/SCHEMA.md):

```bash
cd <zuul>/tools
bun run validate    # alias for: bun run validate-vocab.mjs
```

Prints `OK — 7 genres, 35 sub-genres, …` and exits 0, or `FAIL` with one
line per problem and exits 1. Run it after **any** vocabulary edit. The
check functions live in `tools/lib/vocab-checks.mjs` and are unit-tested:

```bash
bun test            # runs tools/lib/vocab-checks.test.mjs
```

## `build-index.mjs`

Rebuilds the output catalog (`index.json`) by scanning the per-subject JSON
records — the records are the source of truth, the index is derived:

```bash
bun run <zuul>/tools/build-index.mjs --output-dir <your-output-dir>
```

Defaults to `$OUTPUT_DIR` or `09-Outputs` relative to the current directory.
Use it whenever the index drifts from the records (hand edits, merges,
deleted subjects).
