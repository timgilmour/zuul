---
description: Assemble and print a Zuul prompt only — no render, no API call
argument-hint: "[subject, e.g. 'a steampunk dwarf gunsmith']"
allowed-tools: Read
---
Use the **zuul** skill to assemble a full generation prompt for the subject below, but **do not render** — output the finished prompt only, ready to paste into any image model.

Subject: $ARGUMENTS

Map the subject phrase to pool ids (species / role / subgenre / descriptors) via the
skill's vocabulary lookup, then build `<DETAILS>` by running
`bun run 04-Skills/zuul/tools/assemble-prompt.mjs --species <id> --role <id> --subgenre <id> [--descriptor <id>]...`
(exit 2 = unresolved conflicts: resolve them with the user, re-run with `--add "<slot>:<text>"`).
Fall back to the manual `core/assembly.md` slot-merge only if the CLI is unavailable.
Prepend the chosen style's core prompt from `vocabulary/styles.json` (default `clean-mesh-gen`) with `<FRAMING>` filled in, and apply the chosen pose's phrase. Ask only for dimensions you genuinely can't infer.

Then:
1. Print the assembled prompt in a fenced code block (nothing else inside the block).
2. Below it, add a one-line note of the genre / sub-genre / species / role / pose / style used, and any fragments the slot merge demoted.

Do **not** run `tools/generate-image.ts`; this command never spends an API call.
