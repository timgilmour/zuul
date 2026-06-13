#!/usr/bin/env bun
// Thin CLI over lib/output-checks.mjs. Default index path assumes the
// gatekeeper repo layout; standalone installs pass --index explicitly.
import { readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkOutputIndex } from "./lib/output-checks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VOCAB = resolve(HERE, "../vocabulary");

let indexPath = resolve(HERE, "../../../09-Outputs/index.json");
let checkFs = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--index") indexPath = resolve(argv[++i]);
  else if (argv[i] === "--fs") checkFs = true;
  else { console.error(`unknown flag "${argv[i]}" — usage: validate-outputs.mjs [--index <path>] [--fs]`); process.exit(1); }
}

const load = async (f) => JSON.parse(await readFile(resolve(VOCAB, f), "utf-8"));
let indexDoc;
try { indexDoc = JSON.parse(await readFile(indexPath, "utf-8")); }
catch (e) { console.error(`FAIL — could not load ${indexPath}: ${e.message}`); process.exit(1); }

const [genre, species, roles, descriptors] = await Promise.all(
  ["genre.json", "species.json", "roles.json", "descriptors.json"].map(load));
const poolIds = {
  genre: new Set(genre.map((x) => x.id)),
  species: new Set(species.map((x) => x.id)),
  role: new Set(roles.map((x) => x.id)),
  descriptor: new Set(descriptors.map((x) => x.id)),
};

const errors = checkOutputIndex(indexDoc, poolIds);

if (checkFs) {
  const root = resolve(dirname(indexPath), "..");  // repo root when index sits at <root>/09-Outputs/index.json
  for (const e of indexDoc.entries ?? [])
    for (const f of ["path", "image"])
      if (typeof e[f] === "string")
        try { await access(resolve(root, e[f])); } catch { errors.push(`entry ${e.id}: ${f} "${e[f]}" not found on disk`); }
}

if (errors.length) {
  console.error(`FAIL — ${errors.length} problem(s):`);
  for (const m of errors) console.error("  - " + m);
  process.exit(1);
}
console.log(`OK — ${indexDoc.entries.length} output record(s) valid.`);
