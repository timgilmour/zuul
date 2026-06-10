#!/usr/bin/env bun
// Thin CLI runner over lib/vocab-checks.mjs. Loads pools, runs checks, prints, exits.
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as C from "./lib/vocab-checks.mjs";

const VOCAB = resolve(dirname(fileURLToPath(import.meta.url)), "../vocabulary");
const load = async (f) => JSON.parse(await readFile(resolve(VOCAB, f), "utf-8"));

let genres, subs, roles, species, vehicles, props, descriptors, poses, styles, intersections;
try {
  [genres, subs, roles, species, vehicles, props, descriptors, poses, styles, intersections] =
    await Promise.all(
      ["genre.json","subgenres.json","roles.json","species.json","vehicles.json","props.json","descriptors.json","poses.json","styles.json","intersections.json"].map(load),
    );
} catch (e) {
  console.error(`FAIL — could not load vocabulary: ${e.message}`);
  process.exit(1);
}

const genreIds = genres.map((g) => g.id);
const subIds = subs.map((s) => s.id);
const validTags = new Set([...genreIds, ...subIds, "*"]);
const knownIds = new Set([...species.map((s) => s.id), ...descriptors.map((d) => d.id), ...roles.map((r) => r.id)]);

const errors = [
  ...C.checkGenres(genres),
  ...C.checkSubgenres(subs, genreIds),
  ...C.checkRoles(roles, validTags),
  ...C.checkRoleCoverage(subs, roles),
  ...C.checkTaggedPool("species.json", species, validTags),
  ...C.checkTaggedPool("vehicles.json", vehicles, validTags),
  ...C.checkTaggedPool("props.json", props, validTags),
  ...C.checkDescriptors(descriptors),
  ...C.checkPoses(poses),
  ...C.checkStyles(styles),
  ...C.checkIntersections(intersections, knownIds),
];

const POOLS = {
  "genre.json": genres, "subgenres.json": subs, "roles.json": roles,
  "species.json": species, "vehicles.json": vehicles, "props.json": props,
  "descriptors.json": descriptors, "poses.json": poses, "styles.json": styles,
  "intersections.json": intersections,
};
for (const [file, pool] of Object.entries(POOLS)) {
  errors.push(...C.checkNoExt(pool, file));
  errors.push(...C.checkTaxonomy(pool, C.TAXONOMY_BY_POOL[file], file));
}

if (errors.length) {
  console.error(`FAIL — ${errors.length} problem(s):`);
  for (const m of errors) console.error("  - " + m);
  process.exit(1);
}
console.log(`OK — ${genres.length} genres, ${subs.length} sub-genres, ${roles.length} roles, ${species.length} species, ${vehicles.length} vehicles, ${props.length} props, ${descriptors.length} descriptors, ${poses.length} poses, ${styles.length} styles, ${intersections.length} intersections.`);
