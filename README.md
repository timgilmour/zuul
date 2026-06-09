# Zuul

> There is no `/art`. There is only Zuul.

Clean, isolated concept-art renders of fictional subjects — characters, creatures, vehicles, mechs, props — tuned for single-image **image-to-3D** mesh generators (Meshy, Tripo, Hunyuan3D, Rodin) and cinematic pre-production. Zuul is the Gatekeeper to concept art.

## What's here

```
zuul/
├── skills/zuul/        # the skill: SKILL.md, core/, subjects/, vocabulary/, tools/
├── commands/           # slash commands (/zuul, /zuul-prompt, …)
├── install.sh          # install bare commands + standalone skill into ~/.claude
└── .claude-plugin/     # plugin + marketplace manifest
```

## Install

### As a plugin (namespaced `/zuul:…` commands)

```
/plugin marketplace add timgilmour/zuul
/plugin install zuul@zuul
```

### As bare commands (`/zuul`)

```bash
git clone git@github.com:timgilmour/zuul.git && cd zuul
bash install.sh        # -> ~/.claude/commands/ + ~/.claude/skills/zuul
```

Then set a provider key — `GOOGLE_API_KEY` (Gemini / AI Studio), Vertex, or `OPENROUTER_KEY` — in `~/.claude/.env`, and `bun install` runs automatically for the generator's one dependency.

## Slash commands

| Command | Does |
|---------|------|
| `/zuul [subject]` | Guided render — infers what it can, asks only for gaps |
| `/zuul-prompt [subject]` | Assemble + print the prompt only — no render, no API call |
| `/zuul-ingest <image>` | Reference image → subject + pose |
| `/zuul-new <role\|species\|pose\|style\|fragment>` | Add to any vocabulary pool |
| `/zuul-vocab [type]` | List genres, sub-genres, roles, species, poses, styles |
| `/zuul-validate` | Run the vocabulary validator |

## How it works

A guided, one-question-at-a-time flow walks from subject type → genre → sub-genre → identity (species + role) → pose → style. The vocabulary is **tag-driven JSON pools** (7 genres × 35 sub-genres, a single 224-role pool, species, vehicles, props, poses, styles) that grow as you use them. Prompts are assembled with a **slot-based merge** (`core/assembly.md`) that resolves contradictions instead of naively concatenating, then rendered via Google's Nano Banana 2 / Pro with provider auto-detection. Every render writes a per-subject JSON record, a catalog index, and a plain-text prompt sidecar.

## License

MIT
