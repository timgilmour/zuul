# Slash Commands

Seven commands ship with Zuul. Installed as a plugin they're namespaced
(`/zuul:zuul`, `/zuul:zuul-prompt`, …); installed bare via `install.sh`
they're top-level (`/zuul`, `/zuul-prompt`, …).

| Command | Does |
|---------|------|
| [`/zuul`](#zuul) | Guided render — infers what it can, asks only for gaps |
| [`/zuul-prompt`](#zuul-prompt) | Assemble + print the prompt only — no render, no API call |
| [`/zuul-ingest`](#zuul-ingest) | Reference image → subject + pose |
| [`/zuul-comfy`](#zuul-comfy) | Render via a local ComfyUI server (agentic path) |
| [`/zuul-new`](#zuul-new) | Add to a vocabulary pool |
| [`/zuul-vocab`](#zuul-vocab) | List the vocabulary |
| [`/zuul-validate`](#zuul-validate) | Validate the vocabulary pools |

## `/zuul`

```
/zuul [subject, e.g. "a drow paladin"]
```

The main entry point. Runs the guided flow — subject type → genre →
sub-genre → identity (species + role) → pose → style — asking **one question
at a time** and only about dimensions your description didn't already pin
down. Defaults to the mesh-gen style (`clean-mesh-gen`) and a mesh-safe pose;
asks for an output directory on first render of a session; presents a session
seed you can override or clear.

## `/zuul-prompt`

```
/zuul-prompt [subject, e.g. "a steampunk dwarf gunsmith"]
```

The same guided assembly, but stops before rendering: prints the finished
prompt, ready to paste into any image model. Free — no API call. Useful for
checking what the vocabulary resolves to, or for feeding prompts to a model
Zuul doesn't drive.

## `/zuul-ingest`

```
/zuul-ingest <image path or @image>
```

Reverse direction: give Zuul a reference image and it produces a structured
subject description + pose record (per
[`core/ingest-image.md`](../skills/zuul/core/ingest-image.md)). Combine with a
render request to normalize a found image into a mesh-ready A-pose:
*"Make a mesh-ready A-pose version of this character"* + image.

## `/zuul-comfy`

```
/zuul-comfy [workflow-filename] [subject description]
```

Render through a **local ComfyUI server** instead of a cloud provider —
agentic workflow discovery, checkpoint selection, prompt/seed injection, and
job polling. Requires the ComfyUI MCP server; see
[ComfyUI backend](comfyui.md) for setup and the headless (pure-CLI)
alternative.

## `/zuul-new`

```
/zuul-new <role|species|pose|style|fragment> [name/description]
```

Grows the vocabulary: adds a new role, species, pose, style, or prompt
fragment to the matching JSON pool, following that pool's "Creating a new …"
flow. New entries must pass the validator — see
[The vocabulary system](vocabulary.md).

## `/zuul-vocab`

```
/zuul-vocab [genres|subgenres|roles <genre>|species|poses|styles]
```

Lists what's available — all 7 genres, 35 sub-genres, the role pool filtered
by genre, species, poses, styles. Read-only.

## `/zuul-validate`

```
/zuul-validate
```

Runs the bundled vocabulary validator (`tools/validate-vocab.mjs`). On
failure it lists each problem, the pool it belongs to, and a suggested fix;
on success it reports the counts plus the pool invariants (every genre/
sub-genre resolves roles, every body plan has a mesh-safe pose, exactly one
default style).
