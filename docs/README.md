# Zuul Documentation

> There is no `/art`. There is only `/zuul`.

Zuul generates clean, isolated concept-art renders of fictional subjects —
characters, creatures, vehicles, mechs, props — tuned for single-image
**image-to-3D** mesh generators (Meshy, Tripo, Hunyuan3D, Rodin) and
cinematic pre-production.

## Where to start

| Doc | Read it when |
|-----|--------------|
| [Getting started](getting-started.md) | Installing, setting a provider key, first render |
| [Slash commands](commands.md) | What each `/zuul*` command does and when to use it |
| [CLI reference](cli.md) | Driving `generate-image.ts` directly — every flag, provider, and env var |
| [The vocabulary system](vocabulary.md) | How the tag-driven JSON pools work and how to extend them |
| [Mesh pipeline](mesh-pipeline.md) | Getting renders that survive image-to-3D conversion |
| [ComfyUI backend](comfyui.md) | Local/offline generation on your own hardware |

## Deep references (inside the skill)

The skill ships its own authoritative references — these docs summarize and
link rather than duplicate them:

- [`skills/zuul/SKILL.md`](../skills/zuul/SKILL.md) — the skill entry point and guided workflow
- [`skills/zuul/core/render-rules.md`](../skills/zuul/core/render-rules.md) — universal render rules
- [`skills/zuul/core/assembly.md`](../skills/zuul/core/assembly.md) — slot-based prompt merge
- [`skills/zuul/core/pose-library.md`](../skills/zuul/core/pose-library.md) — pose schema
- [`skills/zuul/core/ingest-image.md`](../skills/zuul/core/ingest-image.md) — reference-image ingestion
- [`skills/zuul/core/comfyui-backend.md`](../skills/zuul/core/comfyui-backend.md) — full ComfyUI reference
- [`skills/zuul/vocabulary/SCHEMA.md`](../skills/zuul/vocabulary/SCHEMA.md) — the vocabulary pool contract
