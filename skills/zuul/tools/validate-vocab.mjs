#!/usr/bin/env bun
// Validates the genre/sub-genre/role vocabulary against the design acceptance criteria.
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VOCAB = resolve(dirname(fileURLToPath(import.meta.url)), "../vocabulary");
const load = async (f) => JSON.parse(await readFile(resolve(VOCAB, f), "utf-8"));

const EXPECTED_GENRES = ["fantasy","horror","scifi","modern","science-fantasy","historical","western"];
const EXPECTED_SUBS = {
  fantasy: ["high-fantasy","dark-fantasy","low-fantasy","fairytale","wuxia"],
  horror: ["cosmic-horror","gothic-horror","movie-horror","body-horror","folk-horror"],
  scifi: ["pulp-scifi","cyberpunk","space-opera","hard-scifi","post-human"],
  modern: ["military","superhero","wwii","wwi","noir","espionage"],
  "science-fantasy": ["steampunk","dieselpunk","atompunk","gamma-world","sword-and-planet"],
  historical: ["ancient","viking","medieval","samurai","age-of-sail"],
  western: ["classic-western","spaghetti-western","weird-west","apocalypse-west"],
};

const errors = [];
const E = (m) => errors.push(m);

// A prompt_fragments[] entry is a bare string (legacy) or a {slot,text} object.
const SLOTS = new Set([
  "art_style", "tone",
  "build", "features", "surface", "armor_clothing", "gear", "weapon",
  "materials", "palette", "marks", "aura", "bearing", "expression",
]);
const checkFragments = (label, frags) => {
  for (const f of frags) {
    if (typeof f === "string") continue;
    if (f && typeof f === "object" && typeof f.slot === "string" && typeof f.text === "string") {
      if (!SLOTS.has(f.slot)) E(`${label}: fragment has unknown slot "${f.slot}"`);
      continue;
    }
    E(`${label}: fragment must be a string or a {slot,text} object`);
  }
};

// Body plans — used by species (body_plan: single value) and poses (applies_to[]).
const BODY_PLANS = ["biped", "quadruped", "winged", "floating"];
const SPECIES_PLANS = new Set(BODY_PLANS);

const genres = await load("genre.json");
const subs = await load("subgenres.json");
const roles = await load("roles.json");

const genreIds = genres.map((g) => g.id);
const subIds = subs.map((s) => s.id);

// Genres
if (genreIds.slice().sort().join() !== EXPECTED_GENRES.slice().sort().join())
  E(`genre.json ids != expected. got: ${genreIds.join(",")}`);
for (const g of genres) if (g.level !== "genre") E(`genre ${g.id} missing level:"genre"`);

// Sub-genres
const allExpectedSubs = Object.values(EXPECTED_SUBS).flat();
if (subIds.slice().sort().join() !== allExpectedSubs.slice().sort().join())
  E(`subgenres.json ids != expected. missing: ${allExpectedSubs.filter((i)=>!subIds.includes(i)).join(",")}; extra: ${subIds.filter((i)=>!allExpectedSubs.includes(i)).join(",")}`);
for (const s of subs) {
  if (s.level !== "subgenre") E(`subgenre ${s.id} missing level:"subgenre"`);
  if (!genreIds.includes(s.parent)) E(`subgenre ${s.id} has invalid parent "${s.parent}"`);
  if (EXPECTED_SUBS[s.parent] && !EXPECTED_SUBS[s.parent].includes(s.id)) E(`subgenre ${s.id} parent ${s.parent} mismatch`);
  if (!s.tone) E(`subgenre ${s.id} missing tone`);
  if (!Array.isArray(s.descriptors) || !s.descriptors.length) E(`subgenre ${s.id} empty descriptors`);
  if (!Array.isArray(s.prompt_fragments) || !s.prompt_fragments.length) E(`subgenre ${s.id} empty prompt_fragments`);
  else checkFragments(`subgenre ${s.id}`, s.prompt_fragments);
}

// Roles
const validTags = new Set([...genreIds, ...subIds, "*"]);
const seenIds = new Set();
if (!Array.isArray(roles)) E("roles.json is not an array");
for (const r of roles) {
  if (seenIds.has(r.id)) E(`duplicate role id "${r.id}"`);
  seenIds.add(r.id);
  if (!Array.isArray(r.applies_to) || !r.applies_to.length) E(`role ${r.id} empty applies_to`);
  for (const t of r.applies_to || []) if (!validTags.has(t)) E(`role ${r.id} bad tag "${t}"`);
  if (!Array.isArray(r.prompt_fragments) || !r.prompt_fragments.length) E(`role ${r.id} empty prompt_fragments`);
  else checkFragments(`role ${r.id}`, r.prompt_fragments);
}

// Lookup coverage: every genre and sub-genre must yield >=1 role
const rolesFor = (genreId, subId) =>
  roles.filter((r) => r.applies_to.some((t) => t === genreId || t === subId || t === "*"));
for (const s of subs) {
  if (rolesFor(s.parent, s.id).length === 0) E(`no roles resolve for ${s.parent}/${s.id}`);
}

// Tagged pools (species, vehicles, props): valid array, unique ids, valid tags, non-empty prompt_fragments
const poolCounts = {};
for (const file of ["species.json", "vehicles.json", "props.json"]) {
  let pool;
  try { pool = await load(file); } catch { E(`${file} missing or invalid JSON`); continue; }
  if (!Array.isArray(pool)) { E(`${file} is not an array`); continue; }
  const ids = new Set();
  for (const x of pool) {
    if (ids.has(x.id)) E(`${file}: duplicate id "${x.id}"`);
    ids.add(x.id);
    if (!Array.isArray(x.applies_to) || !x.applies_to.length) E(`${file}: ${x.id} empty applies_to`);
    for (const t of x.applies_to || []) if (!validTags.has(t)) E(`${file}: ${x.id} bad tag "${t}"`);
    if (!Array.isArray(x.prompt_fragments) || !x.prompt_fragments.length) E(`${file}: ${x.id} empty prompt_fragments`);
    else checkFragments(`${file}:${x.id}`, x.prompt_fragments);
    if (file === "species.json" && !SPECIES_PLANS.has(x.body_plan)) E(`species ${x.id}: bad or missing body_plan "${x.body_plan}"`);
  }
  poolCounts[file] = pool.length;
}

// Poses pool: body-plan-tagged, category mesh-gen | observed
const POSE_PLANS = new Set([...BODY_PLANS, "*"]);
const POSE_CATEGORIES = new Set(["mesh-gen", "observed"]);
let poses = [];
try { poses = await load("poses.json"); } catch { E("poses.json missing or invalid JSON"); }
if (!Array.isArray(poses)) { E("poses.json is not an array"); poses = []; }
const poseIds = new Set();
for (const p of poses) {
  if (poseIds.has(p.id)) E(`pose ${p.id}: duplicate id`);
  poseIds.add(p.id);
  if (!p.label) E(`pose ${p.id}: missing label`);
  if (!POSE_CATEGORIES.has(p.category)) E(`pose ${p.id}: bad category "${p.category}"`);
  if (typeof p.mesh_safe !== "boolean") E(`pose ${p.id}: mesh_safe must be boolean`);
  if (!Array.isArray(p.applies_to) || !p.applies_to.length) E(`pose ${p.id}: empty applies_to`);
  for (const t of p.applies_to || []) if (!POSE_PLANS.has(t)) E(`pose ${p.id}: bad body-plan tag "${t}"`);
  if (typeof p.phrase !== "string" || !p.phrase.trim()) E(`pose ${p.id}: missing phrase`);
  if (typeof p.aspect !== "string" || !p.aspect.trim()) E(`pose ${p.id}: missing aspect`);
  if (p.category === "mesh-gen" && p.mesh_safe !== true) E(`pose ${p.id}: mesh-gen pose must be mesh_safe:true`);
}
// Coverage: every body plan must have at least one mesh-safe pose
for (const plan of ["biped", "quadruped", "winged", "floating"]) {
  if (!poses.some((p) => p.mesh_safe && p.applies_to.includes(plan)))
    E(`no mesh-safe pose for body plan "${plan}"`);
}

// Styles pool: each entry is a full core prompt; exactly one default
let styles = [];
try { styles = await load("styles.json"); } catch { E("styles.json missing or invalid JSON"); }
if (!Array.isArray(styles)) { E("styles.json is not an array"); styles = []; }
const styleIds = new Set();
let defaultStyles = 0;
for (const st of styles) {
  if (styleIds.has(st.id)) E(`style ${st.id}: duplicate id`);
  styleIds.add(st.id);
  if (!st.label) E(`style ${st.id}: missing label`);
  if (typeof st.mesh_safe !== "boolean") E(`style ${st.id}: mesh_safe must be boolean`);
  if (typeof st.uses_framing !== "boolean") E(`style ${st.id}: uses_framing must be boolean`);
  if (typeof st.prompt !== "string" || !st.prompt.trim()) E(`style ${st.id}: missing prompt`);
  if (st.uses_framing && typeof st.prompt === "string" && !st.prompt.includes("<FRAMING>"))
    E(`style ${st.id}: uses_framing is true but prompt has no <FRAMING> slot`);
  if (st.default === true) defaultStyles++;
}
if (styles.length && defaultStyles !== 1) E(`styles.json must have exactly one default:true (found ${defaultStyles})`);

if (errors.length) {
  console.error(`FAIL — ${errors.length} problem(s):`);
  for (const m of errors) console.error("  - " + m);
  process.exit(1);
}
console.log(`OK — ${genres.length} genres, ${subs.length} sub-genres, ${roles.length} roles, ${poolCounts["species.json"]||0} species, ${poolCounts["vehicles.json"]||0} vehicles, ${poolCounts["props.json"]||0} props, ${poses.length} poses, ${styles.length} styles; all nodes resolve roles, all body plans have a mesh-safe pose, exactly one default style.`);
