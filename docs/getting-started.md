# Getting Started

## Requirements

- [Claude Code](https://claude.com/claude-code) (the skill and slash commands run inside it)
- [Bun](https://bun.sh) v1.3+ (runtime for the image-generation CLI)
- One provider credential (see [Provider keys](#provider-keys)) — or a local
  [ComfyUI](comfyui.md) server if you'd rather render offline

## Install

### As a plugin (namespaced `/zuul:…` commands)

Inside Claude Code:

```
/plugin marketplace add timgilmour/zuul
/plugin install zuul@zuul
```

### As bare commands (`/zuul`)

```bash
git clone git@github.com:timgilmour/zuul.git && cd zuul
bash install.sh
```

The installer copies the commands to `~/.claude/commands/`, the skill to
`~/.claude/skills/zuul`, and runs `bun install` for the generator's one
dependency (`@google/genai`). To uninstall:

```bash
rm ~/.claude/commands/zuul*.md && rm -rf ~/.claude/skills/zuul
```

## Provider keys

Set **one** of these in `.env` (current directory) or `~/.claude/.env`:

| Variable | Provider | Notes |
|----------|----------|-------|
| `GOOGLE_API_KEY` | Google Gemini (AI Studio) | Simplest setup |
| `GOOGLE_API_KEY_VERTEX` | Vertex AI Express Mode | API key only, no GCP project setup |
| `GOOGLE_CLOUD_PROJECT` | Full Vertex AI | Uses ADC: `gcloud auth application-default login` |
| `OPENROUTER_KEY` | OpenRouter | Alternative cloud provider |
| `COMFYUI_HOST` / `COMFYUI_URL` | ComfyUI (local) | No cloud key needed — see [ComfyUI backend](comfyui.md) |

The CLI auto-detects the provider from whichever credential it finds (in the
order above) — you never need a `--provider` flag unless you want to force one.

Optional: `REMOVEBG_API_KEY` enables the `--remove-bg` post-processing flag.

## First render

In Claude Code, just describe what you want:

```
/zuul a goblin warrior
```

Zuul runs a guided flow — one question at a time — walking from subject type
→ genre → sub-genre → identity (species + role) → pose → style. It infers
everything it can from your phrasing and only asks about the gaps. Phrases
like these route straight into the skill:

```
"Fantastic concept of a goblin warrior"
"A-pose reference of a tiefling rogue, 4K, nano-banana-pro"
"Here's an image — describe this orc and capture its pose"     # ingest
"Make a mesh-ready A-pose version of this character" + image   # ingest → normalize → render
```

Want to see the prompt without spending an API call? Use
[`/zuul-prompt`](commands.md#zuul-prompt).

## Where output goes

At the start of a session Zuul asks where to save renders (default:
`./zuul-output`, relative to *your* working directory). Each subject gets:

```
<output>/
├── concepts/<subject-type>/<slug>/
│   ├── <slug>-01.png        # the render
│   ├── <slug>-01.txt        # prompt sidecar — the exact prompt, ready to copy
│   └── <slug>.json          # subject record: identity, renders[], seeds, flags
└── index.json               # catalog of every subject
```

The per-subject JSON records are the source of truth; `index.json` is derived
and can be rebuilt at any time with `tools/build-index.mjs`.

## Models

| Model | Flag | Best for |
|-------|------|----------|
| **Nano Banana 2** (default) | `--model nano-banana-2` | Most tasks, fast iteration, 512px–4K |
| **Nano Banana Pro** | `--model nano-banana-pro` | Maximum quality, complex compositions |

Tip: preview at `--size 512px` (Nano Banana 2 only) before committing to a 2K/4K final.
