#!/usr/bin/env bun
// Thin CLI over lib/assemble.mjs. Loads pools, parses flags, prints the
// assembled prompt (or a full JSON report with --json).
// Exit codes: 0 ok · 1 bad input/data · 2 unresolved conflicts (human mode).
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assemble, AssembleError } from "./lib/assemble.mjs";

const VOCAB = resolve(dirname(fileURLToPath(import.meta.url)), "../vocabulary");
const load = async (f) => JSON.parse(await readFile(resolve(VOCAB, f), "utf-8"));
const fail = (msg) => { console.error(`assemble-prompt: ${msg}`); process.exit(1); };

const USAGE = `usage: bun run assemble-prompt.mjs --subgenre <id> [--genre <id>] [--species <id>] [--role <id>]
       [--descriptor <id>]... [--add "<slot>:<text>"]... [--json]`;

function parseArgs(argv) {
  const args = { descriptors: [], adds: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (++i >= argv.length) fail(`${a} needs a value\n${USAGE}`); return argv[i]; };
    if (a === "--species") args.species = next();
    else if (a === "--role") args.role = next();
    else if (a === "--subgenre") args.subgenre = next();
    else if (a === "--genre") args.genre = next();
    else if (a === "--descriptor") args.descriptors.push(next());
    else if (a === "--add") {
      const v = next();
      const idx = v.indexOf(":");
      if (idx < 1 || !v.slice(idx + 1).trim()) fail(`--add wants "<slot>:<text>", got "${v}"`);
      args.adds.push({ slot: v.slice(0, idx), text: v.slice(idx + 1).trim() });
    } else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") { console.log(USAGE); process.exit(0); }
    else fail(`unknown flag "${a}"\n${USAGE}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const [genre, subgenres, species, roles, descriptors, intersections] = await Promise.all(
  ["genre.json", "subgenres.json", "species.json", "roles.json", "descriptors.json", "intersections.json"].map(load));

let report;
try {
  report = assemble({ pools: { genre, subgenres, species, roles, descriptors, intersections }, ...args });
} catch (e) {
  if (e instanceof AssembleError) fail(e.message);
  throw e;
}

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  if (report.applied_intersections.length) console.log(`intersections: ${report.applied_intersections.join(", ")}`);
  if (report.art_style) console.log(`art style: ${report.art_style}`);
  console.log(`<DETAILS>: ${report.details}`);
  console.log(report.resolution_note);
  if (report.conflicts.length) {
    console.error("\nconflicts needing resolution:");
    for (const c of report.conflicts)
      for (const cand of c.candidates) console.error(`  ${c.slot}: [${cand.source}] ${cand.text}`);
    process.exit(2);
  }
}
