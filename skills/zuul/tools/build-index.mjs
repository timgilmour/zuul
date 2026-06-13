#!/usr/bin/env bun
// build-index.mjs
// Rebuilds 09-Outputs/index.json (or <OUTPUT_DIR>/index.json) by scanning all
// per-subject records found at the path pattern:
//   <output_dir>/concepts/<subject_type_plural>/<id>-<slug>/<slug>.json
//
// The per-subject JSON files are the source of truth; index.json is a derived
// artifact. Run this after adding or updating any subject record.
//
// Usage:
//   bun run build-index.mjs [--output-dir <path>]
//
// The output dir defaults to "09-Outputs" (relative to cwd), or reads the
// OUTPUT_DIR environment variable if set.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Directory name → singular subject_type label used in index entries.
const SUBJECT_TYPE_MAP = {
  characters: "character",
  vehicles: "vehicle",
  props: "prop",
  creatures: "creature",
  mechs: "mech",
};

// Fields from the per-subject record that are useful for search/filter.
// Only fields that actually exist in at least one real record are listed here.
// Fields that are absent from a given record are omitted from its index entry.
const SEARCHABLE_FIELDS = [
  "created",   // "2026-06-07"
  "genre",     // "fantasy"
  "subgenre",  // (present when set)
  "species",   // "drow"
  "role",      // "paladin"
  "size",      // "medium" (body size — small/medium/large etc.)
  "age",       // "elder"
  "descriptors", // ["battle-worn", "scarred"]
  "traits",    // ["veteran", "survivor"]
];

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let outputDirArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output-dir" && args[i + 1]) {
    outputDirArg = args[i + 1];
    i++;
  }
}

const outputDir = resolve(outputDirArg ?? process.env.OUTPUT_DIR ?? "09-Outputs");
const conceptsDir = join(outputDir, "concepts");
const indexPath = join(outputDir, "index.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const errors = [];
const E = (m) => errors.push(m);

// Return repo-relative path (from cwd) with forward slashes. This preserves
// the "09-Outputs/concepts/..." style seen in the existing hand-written entry.
const repoRelative = (absPath) =>
  relative(process.cwd(), absPath).replace(/\\/g, "/");

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

if (!existsSync(conceptsDir)) {
  console.error(`FAIL — concepts dir not found: ${conceptsDir}`);
  process.exit(1);
}

// Each immediate child of conceptsDir is a subject-type directory (e.g. "characters").
const subjectTypeDirs = await readdir(conceptsDir, { withFileTypes: true });
const entries = [];

for (const typeDir of subjectTypeDirs) {
  if (!typeDir.isDirectory()) continue;

  const typeDirName = typeDir.name; // e.g. "characters"
  const subjectType = SUBJECT_TYPE_MAP[typeDirName] ?? typeDirName; // singularise
  const typePath = join(conceptsDir, typeDirName);

  // Each child is a subject folder named "<id>-<slug>" or just "<slug>".
  const subjectDirs = await readdir(typePath, { withFileTypes: true });

  for (const subDir of subjectDirs) {
    if (!subDir.isDirectory()) continue;

    const subDirName = subDir.name; // e.g. "0001-mick-o-shamrock"
    const subjectPath = join(typePath, subDirName);

    // Derive slug: the directory name is either "<id>-<slug>" or "<slug>".
    // We try to locate the record by matching <slug>.json inside the dir.
    // Strategy: list .json files in the dir and pick the one whose stem matches
    // a portion of the dir name (not "index").
    let recordFiles;
    try {
      const allFiles = await readdir(subjectPath);
      recordFiles = allFiles.filter(
        (f) => f.endsWith(".json") && f !== "index.json"
      );
    } catch (err) {
      E(`Could not read directory ${subjectPath}: ${err.message}`);
      continue;
    }

    if (recordFiles.length === 0) {
      // No JSON records in this subject dir — skip silently.
      continue;
    }

    for (const recordFile of recordFiles) {
      const recordPath = join(subjectPath, recordFile);
      let rec;
      try {
        rec = JSON.parse(await readFile(recordPath, "utf-8"));
      } catch (err) {
        E(`Could not parse ${recordPath}: ${err.message}`);
        continue;
      }

      // Skip non-record JSON (e.g. package.json, config files).
      if (typeof rec !== "object" || rec === null || Array.isArray(rec)) continue;

      // Required fields for a valid subject record.
      const slug = rec.slug;
      const title = rec.title ?? rec.name; // "title" preferred; fall back to "name"
      const id = rec.id;                   // e.g. "0001" or "0001-mick-o-shamrock"

      if (!id) {
        E(`${recordPath}: missing required field "id"`);
        continue;
      }
      if (!title) {
        E(`${recordPath}: missing required field "title" or "name"`);
        continue;
      }

      // Build the composite id used in the index (dir name serves as stable key).
      // If the record's id is just a number string ("0001"), compose with slug.
      // If it already contains the slug (unlikely but handle it), use as-is.
      const compositeId = slug
        ? `${id}-${slug}` // "0001-mick-o-shamrock"
        : String(id);

      // Path in the index is repo-relative from cwd, matching the convention
      // used in the existing hand-written entry ("09-Outputs/concepts/...").
      const entryPath = repoRelative(recordPath);

      // Build the richer entry — only include fields that exist in this record.
      const entry = {
        id: compositeId,
        title,
        subject_type: subjectType,
        slug: slug ?? subDirName,
        path: entryPath,
      };

      // Pulls from renders[0] for render-level fields (model, size, aspect_ratio, image).
      const firstRender = Array.isArray(rec.renders) && rec.renders.length > 0
        ? rec.renders[0]
        : null;

      if (firstRender) {
        if (firstRender.model) entry.model = firstRender.model;
        // Render resolution ("2K", "512px") stored as render_size to avoid
        // collision with the body-size field ("small", "medium") from the record root.
        if (firstRender.size) entry.render_size = firstRender.size;
        if (firstRender.aspect_ratio) entry.aspect_ratio = firstRender.aspect_ratio;
        if (firstRender.seed != null) entry.seed = firstRender.seed;
        if (firstRender.backend) entry.backend = firstRender.backend;
        if (firstRender.arch) entry.arch = firstRender.arch;
        // image: repo-relative path to the first PNG
        if (firstRender.path) {
          entry.image = firstRender.path; // already a relative path when present
        } else if (firstRender.file) {
          // Construct path from dir + file name
          entry.image = repoRelative(join(subjectPath, firstRender.file));
        }
      }

      // Searchable metadata fields from the root of the record.
      for (const field of SEARCHABLE_FIELDS) {
        const val = rec[field];
        if (val == null) continue;
        if (Array.isArray(val) && val.length === 0) continue;
        entry[field] = val;
      }

      entries.push(entry);
    }
  }
}

if (errors.length) {
  console.error(`FAIL — ${errors.length} problem(s):`);
  for (const m of errors) console.error("  - " + m);
  process.exit(1);
}

// Sort deterministically by id (stable across rebuilds).
entries.sort((a, b) => a.id.localeCompare(b.id));

const output = { entries };
await writeFile(indexPath, JSON.stringify(output, null, 2) + "\n", "utf-8");

console.log(`OK — wrote ${entries.length} entries to ${repoRelative(indexPath)}`);
