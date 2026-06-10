// lib/vocab-checks.mjs — pure vocabulary validation checks.
// Each check takes already-parsed data and returns an array of error strings.
// No file I/O, no process.exit — so the functions are unit-testable.

export const EXPECTED_GENRES = ["fantasy","horror","scifi","modern","science-fantasy","historical","western"];
export const EXPECTED_SUBS = {
  fantasy: ["high-fantasy","dark-fantasy","low-fantasy","fairytale","wuxia"],
  horror: ["cosmic-horror","gothic-horror","movie-horror","body-horror","folk-horror"],
  scifi: ["pulp-scifi","cyberpunk","space-opera","hard-scifi","post-human"],
  modern: ["military","superhero","wwii","wwi","noir","espionage"],
  "science-fantasy": ["steampunk","dieselpunk","atompunk","gamma-world","sword-and-planet"],
  historical: ["ancient","viking","medieval","samurai","age-of-sail"],
  western: ["classic-western","spaghetti-western","weird-west","apocalypse-west"],
};

// A prompt_fragments[] entry is a bare string (legacy) or a {slot,text} object.
export const SLOTS = new Set([
  "art_style","tone","build","features","surface","armor_clothing","gear","weapon",
  "materials","palette","marks","aura","bearing","expression",
]);
export const BODY_PLANS = ["biped","quadruped","winged","floating"];
export const DESCRIPTOR_CATEGORIES = new Set(["age","condition","physical","size","social","tier","visual"]);
export const POSE_CATEGORIES = new Set(["mesh-gen","observed"]);
export const TAXONOMY_BY_POOL = {
  "genre.json":"genre","subgenres.json":"subgenre","species.json":"species",
  "descriptors.json":"descriptor","poses.json":"pose","styles.json":"style",
  "roles.json":"role","props.json":"prop","vehicles.json":"vehicle",
  "intersections.json":"intersection",
};
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function checkFragments(label, frags) {
  const errors = [];
  for (const f of frags) {
    if (typeof f === "string") {
      if (!f.trim()) errors.push(`${label}: empty string fragment`);
      continue;
    }
    if (f && typeof f === "object" && typeof f.slot === "string" && typeof f.text === "string") {
      if (!SLOTS.has(f.slot)) errors.push(`${label}: fragment has unknown slot "${f.slot}"`);
      if (!f.text.trim()) errors.push(`${label}: fragment has empty text`);
      continue;
    }
    errors.push(`${label}: fragment must be a string or a {slot,text} object`);
  }
  return errors;
}

export function checkGenres(genres) {
  const errors = [];
  const genreIds = genres.map((g) => g.id);
  if (genreIds.slice().sort().join() !== EXPECTED_GENRES.slice().sort().join())
    errors.push(`genre.json ids != expected. got: ${genreIds.join(",")}`);
  for (const g of genres) if (g.level !== "genre") errors.push(`genre ${g.id} missing level:"genre"`);
  return errors;
}

export function checkSubgenres(subs, genreIds) {
  const errors = [];
  const subIds = subs.map((s) => s.id);
  const allExpectedSubs = Object.values(EXPECTED_SUBS).flat();
  if (subIds.slice().sort().join() !== allExpectedSubs.slice().sort().join())
    errors.push(`subgenres.json ids != expected. missing: ${allExpectedSubs.filter((i)=>!subIds.includes(i)).join(",")}; extra: ${subIds.filter((i)=>!allExpectedSubs.includes(i)).join(",")}`);
  for (const s of subs) {
    if (s.level !== "subgenre") errors.push(`subgenre ${s.id} missing level:"subgenre"`);
    if (!genreIds.includes(s.parent)) errors.push(`subgenre ${s.id} has invalid parent "${s.parent}"`);
    if (EXPECTED_SUBS[s.parent] && !EXPECTED_SUBS[s.parent].includes(s.id)) errors.push(`subgenre ${s.id} parent ${s.parent} mismatch`);
    if (!s.tone) errors.push(`subgenre ${s.id} missing tone`);
    if (!Array.isArray(s.descriptors) || !s.descriptors.length) errors.push(`subgenre ${s.id} empty descriptors`);
    if (!Array.isArray(s.prompt_fragments) || !s.prompt_fragments.length) errors.push(`subgenre ${s.id} empty prompt_fragments`);
    else errors.push(...checkFragments(`subgenre ${s.id}`, s.prompt_fragments));
  }
  return errors;
}

export function checkRoles(roles, validTags) {
  if (!Array.isArray(roles)) return ["roles.json is not an array"];
  const errors = [];
  const seenIds = new Set();
  for (const r of roles) {
    if (seenIds.has(r.id)) errors.push(`duplicate role id "${r.id}"`);
    seenIds.add(r.id);
    if (!Array.isArray(r.applies_to) || !r.applies_to.length) errors.push(`role ${r.id} empty applies_to`);
    for (const t of r.applies_to || []) if (!validTags.has(t)) errors.push(`role ${r.id} bad tag "${t}"`);
    if (!Array.isArray(r.prompt_fragments) || !r.prompt_fragments.length) errors.push(`role ${r.id} empty prompt_fragments`);
    else errors.push(...checkFragments(`role ${r.id}`, r.prompt_fragments));
  }
  return errors;
}

export function checkRoleCoverage(subs, roles) {
  const errors = [];
  const rolesFor = (genreId, subId) =>
    roles.filter((r) => r.applies_to.some((t) => t === genreId || t === subId || t === "*"));
  for (const s of subs) if (rolesFor(s.parent, s.id).length === 0) errors.push(`no roles resolve for ${s.parent}/${s.id}`);
  return errors;
}

// species / vehicles / props
export function checkTaggedPool(file, pool, validTags) {
  if (!Array.isArray(pool)) return [`${file} is not an array`];
  const errors = [];
  const ids = new Set();
  const SPECIES_PLANS = new Set(BODY_PLANS);
  for (const x of pool) {
    if (ids.has(x.id)) errors.push(`${file}: duplicate id "${x.id}"`);
    ids.add(x.id);
    if (!Array.isArray(x.applies_to) || !x.applies_to.length) errors.push(`${file}: ${x.id} empty applies_to`);
    for (const t of x.applies_to || []) if (!validTags.has(t)) errors.push(`${file}: ${x.id} bad tag "${t}"`);
    if (!Array.isArray(x.prompt_fragments) || !x.prompt_fragments.length) errors.push(`${file}: ${x.id} empty prompt_fragments`);
    else errors.push(...checkFragments(`${file}:${x.id}`, x.prompt_fragments));
    if (file === "species.json" && !SPECIES_PLANS.has(x.body_plan)) errors.push(`species ${x.id}: bad or missing body_plan "${x.body_plan}"`);
    if (file === "props.json" || file === "vehicles.json") {
      if (typeof x.view !== "string" || !x.view.trim()) errors.push(`${file}: ${x.id} missing view`);
      if (typeof x.aspect !== "string" || !x.aspect.trim()) errors.push(`${file}: ${x.id} missing aspect`);
    }
  }
  return errors;
}

export function checkPoses(poses) {
  if (!Array.isArray(poses)) return ["poses.json is not an array"];
  const errors = [];
  const POSE_PLANS = new Set([...BODY_PLANS, "*"]);
  const ids = new Set();
  for (const p of poses) {
    if (ids.has(p.id)) errors.push(`pose ${p.id}: duplicate id`);
    ids.add(p.id);
    if (!p.label) errors.push(`pose ${p.id}: missing label`);
    if (!POSE_CATEGORIES.has(p.category)) errors.push(`pose ${p.id}: bad category "${p.category}"`);
    if (typeof p.mesh_safe !== "boolean") errors.push(`pose ${p.id}: mesh_safe must be boolean`);
    if (!Array.isArray(p.applies_to) || !p.applies_to.length) errors.push(`pose ${p.id}: empty applies_to`);
    for (const t of p.applies_to || []) if (!POSE_PLANS.has(t)) errors.push(`pose ${p.id}: bad body-plan tag "${t}"`);
    if (typeof p.phrase !== "string" || !p.phrase.trim()) errors.push(`pose ${p.id}: missing phrase`);
    if (typeof p.aspect !== "string" || !p.aspect.trim()) errors.push(`pose ${p.id}: missing aspect`);
    if (p.category === "mesh-gen" && p.mesh_safe !== true) errors.push(`pose ${p.id}: mesh-gen pose must be mesh_safe:true`);
  }
  for (const plan of BODY_PLANS) {
    if (!poses.some((p) => p.mesh_safe && p.applies_to.includes(plan))) errors.push(`no mesh-safe pose for body plan "${plan}"`);
  }
  return errors;
}

export function checkStyles(styles) {
  if (!Array.isArray(styles)) return ["styles.json is not an array"];
  const errors = [];
  const ids = new Set();
  let defaultStyles = 0;
  for (const st of styles) {
    if (ids.has(st.id)) errors.push(`style ${st.id}: duplicate id`);
    ids.add(st.id);
    if (!st.label) errors.push(`style ${st.id}: missing label`);
    if (typeof st.mesh_safe !== "boolean") errors.push(`style ${st.id}: mesh_safe must be boolean`);
    if (typeof st.uses_framing !== "boolean") errors.push(`style ${st.id}: uses_framing must be boolean`);
    if (typeof st.prompt !== "string" || !st.prompt.trim()) errors.push(`style ${st.id}: missing prompt`);
    if (st.uses_framing && typeof st.prompt === "string" && !st.prompt.includes("<FRAMING>"))
      errors.push(`style ${st.id}: uses_framing is true but prompt has no <FRAMING> slot`);
    if (st.default === true) defaultStyles++;
  }
  if (styles.length && defaultStyles !== 1) errors.push(`styles.json must have exactly one default:true (found ${defaultStyles})`);
  return errors;
}

// Generic guards applied to every pool by the runner.
export function checkNoExt(pool, label) {
  const errors = [];
  for (const x of pool)
    if (Object.prototype.hasOwnProperty.call(x, "ext"))
      errors.push(`${label}: entry "${x.id ?? x.label}" still has an "ext" field (removed by design)`);
  return errors;
}

export function checkTaxonomy(pool, expected, label) {
  if (expected === undefined) return [`${label}: checkTaxonomy called with no expected value (missing TAXONOMY_BY_POOL entry?)`];
  const errors = [];
  for (const x of pool)
    if (x.taxonomy !== expected)
      errors.push(`${label}: entry "${x.id ?? x.label}" taxonomy is "${x.taxonomy ?? "(missing)"}", expected "${expected}"`);
  return errors;
}

// Per-pool checks for descriptors and intersections.
export function checkDescriptors(descriptors) {
  if (!Array.isArray(descriptors)) return ["descriptors.json is not an array"];
  const errors = [];
  const ids = new Set();
  for (const d of descriptors) {
    if (ids.has(d.id)) errors.push(`descriptor ${d.id}: duplicate id`);
    ids.add(d.id);
    if (!d.label) errors.push(`descriptor ${d.id}: missing label`);
    if (!DESCRIPTOR_CATEGORIES.has(d.category)) errors.push(`descriptor ${d.id}: bad or missing category "${d.category}"`);
    if (!Array.isArray(d.prompt_fragments) || !d.prompt_fragments.length) errors.push(`descriptor ${d.id}: empty prompt_fragments`);
    else errors.push(...checkFragments(`descriptor ${d.id}`, d.prompt_fragments));
  }
  return errors;
}

// knownIds = Set of species ∪ descriptor ∪ role ids.
// Note: ids that exist in more than one pool (e.g. android, elder, noble, outcast)
// are ambiguous to when-token resolution — the Set union cannot tell which pool
// a token refers to. Disambiguating those ids is future hygiene work (Tier 3).
export function checkIntersections(intersections, knownIds) {
  if (!Array.isArray(intersections)) return ["intersections.json is not an array"];
  const errors = [];
  const ids = new Set();
  for (const x of intersections) {
    const tag = x.id ?? x.label ?? "(unknown)";
    if (typeof x.id !== "string" || !x.id.trim()) errors.push(`intersection ${tag}: missing id`);
    else {
      if (!KEBAB.test(x.id)) errors.push(`intersection ${x.id}: id is not kebab-case`);
      if (ids.has(x.id)) errors.push(`duplicate intersection id "${x.id}"`);
      ids.add(x.id);
    }
    if (!x.label) errors.push(`intersection ${tag}: missing label`);
    if (!Array.isArray(x.when) || x.when.length < 2) errors.push(`intersection ${tag}: "when" must list at least two tokens`);
    for (const t of x.when || []) if (!knownIds.has(t)) errors.push(`intersection ${tag}: when-token "${t}" resolves to no species/descriptor/role id`);
    if (typeof x.visual_override !== "object" || x.visual_override === null) errors.push(`intersection ${tag}: visual_override must be an object`);
    if (!Array.isArray(x.traits_add)) errors.push(`intersection ${tag}: traits_add must be an array`);
    if (!Array.isArray(x.prompt_fragments_add) || !x.prompt_fragments_add.length) errors.push(`intersection ${tag}: empty prompt_fragments_add`);
    else errors.push(...checkFragments(`intersection ${tag}`, x.prompt_fragments_add));
  }
  return errors;
}
