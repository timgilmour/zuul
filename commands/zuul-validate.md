---
description: Validate Zuul's vocabulary pools
argument-hint: ""
---
Use the **zuul** skill to validate its vocabulary pools: run the bundled `tools/validate-vocab.mjs` and report the result.

- If it **FAILs**, list each problem and which pool/file it belongs to, and suggest the fix.
- If it passes, report the `OK` summary line (the counts plus the invariants: all nodes resolve roles, every body plan has a mesh-safe pose, exactly one default style).
