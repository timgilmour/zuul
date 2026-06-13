// lib/assemble.mjs — deterministic prompt assembly for characters/creatures.
// Pure logic: takes already-parsed pools, returns a structured report. No I/O.
// Implements core/assembly.md; the prose doc documents THIS engine's behavior.
// Semantic judgment is confined to the conflicts[] output — the engine never
// guesses on a same-precedence exclusive-slot collision.

export const PRECEDENCE = ["user", "intersection", "descriptor", "role", "species", "subgenre", "genre"];
const rank = (source) => PRECEDENCE.indexOf(source);

// Generic "species-level descriptor defaults": each entry maps a descriptor
// category to the species field that supplies its default id, auto-applied
// unless the caller passes an explicit descriptor of that category. Size is the
// only axis today; a future axis is one entry here + a species field + a slot.
export const SPECIES_DEFAULTS = { size: "default_size" };
// Per-axis neutral value that means "no auto-derivation" (a no-op default).
export const SPECIES_DEFAULT_NEUTRAL = { size: "medium" };

// kind "style": highest-precedence supplying source wins the slot outright.
// kind "subject": additive slots compose; exclusive slots surface conflicts
// when fragments from ≥2 distinct sources survive demotion.
export const SLOT_TABLE = {
  art_style:      { kind: "style" },
  tone:           { kind: "style" },
  scale:          { kind: "subject", mode: "additive" },
  build:          { kind: "subject", mode: "additive" },
  features:       { kind: "subject", mode: "additive" },
  surface:        { kind: "subject", mode: "additive" },
  armor_clothing: { kind: "subject", mode: "exclusive" },
  gear:           { kind: "subject", mode: "additive" },
  weapon:         { kind: "subject", mode: "exclusive" },
  materials:      { kind: "subject", mode: "additive" },
  palette:        { kind: "palette" },
  marks:          { kind: "subject", mode: "additive" },
  aura:           { kind: "subject", mode: "additive" },
  bearing:        { kind: "subject", mode: "additive" },
  expression:     { kind: "subject", mode: "additive" },
};

export const DETAILS_ORDER = [
  "scale", "build", "features", "surface", "armor_clothing", "gear", "weapon",
  "marks", "aura", "bearing", "materials", "tone", "expression",
];

// Palette resolves to ONE source. Note: differs from global precedence —
// subgenre beats species (core/assembly.md palette special-case).
export const PALETTE_ORDER = ["user", "subgenre", "genre", "species", "intersection", "descriptor"];

export class AssembleError extends Error {}

function findEntry(pool, id, poolName) {
  const e = (pool ?? []).find((x) => x.id === id);
  if (!e) {
    const near = (pool ?? []).map((x) => x.id).filter((x) => x.includes(id) || id.includes(x)).slice(0, 5);
    throw new AssembleError(`unknown ${poolName} id "${id}"${near.length ? ` — nearest: ${near.join(", ")}` : ""}`);
  }
  return e;
}

function typedFragments(entry, source, listKey = "prompt_fragments") {
  const out = [];
  for (const f of entry[listKey] ?? []) {
    if (typeof f === "string")
      throw new AssembleError(`${source} "${entry.id}" has a bare-string fragment "${f}" — character-path pools must be typed (run the validator)`);
    out.push({ slot: f.slot, text: f.text, source });
  }
  return out;
}

export function assemble({ pools, species, role, subgenre, genre, descriptors = [], adds = [] }) {
  // -- resolve entries ------------------------------------------------------
  const subEntry = subgenre ? findEntry(pools.subgenres, subgenre, "subgenre") : null;
  if (subEntry && genre && subEntry.parent !== genre)
    throw new AssembleError(`--genre ${genre} conflicts with subgenre parent ${subEntry.parent}`);
  const genreId = subEntry ? subEntry.parent : genre;
  if (!genreId) throw new AssembleError("need --subgenre or --genre");
  const genreEntry = findEntry(pools.genre, genreId, "genre");
  const speciesEntry = species ? findEntry(pools.species, species, "species") : null;
  const roleEntry = role ? findEntry(pools.roles, role, "role") : null;
  const descriptorEntries = descriptors.map((d) => findEntry(pools.descriptors, d, "descriptor"));

  // -- intersections fire when every when-token is satisfied ----------------
  const have = {
    species: new Set(species ? [species] : []),
    role: new Set(role ? [role] : []),
    descriptor: new Set(descriptors),
  };
  const fired = (pools.intersections ?? []).filter((ix) =>
    ix.when.every((t) => { const [p, id] = t.split(":"); return have[p]?.has(id); }));

  // -- gather fragments (insertion order = within-slot output order) --------
  let frags = [
    ...typedFragments(genreEntry, "genre"),
    ...(subEntry ? typedFragments(subEntry, "subgenre") : []),
    ...(speciesEntry ? typedFragments(speciesEntry, "species") : []),
    ...(roleEntry ? typedFragments(roleEntry, "role") : []),
    ...descriptorEntries.flatMap((d) => typedFragments(d, "descriptor")),
    ...fired.flatMap((ix) => typedFragments(ix, "intersection", "prompt_fragments_add")),
    ...adds.map(({ slot, text }) => ({ slot, text, source: "user" })),
  ];

  // -- auto-derive species-default descriptors (generic; size only today) ---
  // If the caller passed no explicit descriptor of a mapped category, inject
  // the species default's FRAGMENTS (not its id, so this can never satisfy a
  // category-keyed intersection's when[]). source "species" — derived from it.
  for (const [category, field] of Object.entries(SPECIES_DEFAULTS)) {
    if (descriptorEntries.some((d) => d.category === category)) continue; // explicit override
    const defId = speciesEntry?.[field];
    if (!defId || defId === SPECIES_DEFAULT_NEUTRAL[category]) continue;
    const defEntry = (pools.descriptors ?? []).find((d) => d.id === defId && d.category === category);
    if (defEntry) frags.push(...typedFragments(defEntry, "species"));
  }

  for (const f of frags)
    if (!(f.slot in SLOT_TABLE)) throw new AssembleError(`fragment "${f.text}" has unknown slot "${f.slot}"`);

  const demotions = [];
  const demote = (f, reason) => demotions.push({ slot: f.slot, text: f.text, source: f.source, reason });

  // -- intersection visual_override: bare slot key replaces, <slot>_add appends
  for (const ix of fired) {
    for (const [k, v] of Object.entries(ix.visual_override ?? {})) {
      if (k.endsWith("_add")) {
        const slot = k.slice(0, -4);
        frags.push(...v.map((text) => ({ slot, text, source: "intersection" })));
      } else {
        frags = frags.filter((f) => {
          if (f.slot === k && f.source !== "user") { demote(f, `replaced by intersection ${ix.id} visual_override`); return false; }
          return true;
        });
        frags.push({ slot: k, text: v, source: "intersection" });
      }
    }
  }

  // -- group by slot ---------------------------------------------------------
  const slots = {};
  for (const f of frags) (slots[f.slot] ??= []).push(f);

  // -- style slots: highest-precedence supplying source wins outright -------
  for (const slot of Object.keys(SLOT_TABLE).filter((s) => SLOT_TABLE[s].kind === "style")) {
    const fs = slots[slot];
    if (!fs?.length) continue;
    const best = Math.min(...fs.map((f) => rank(f.source)));
    slots[slot] = fs.filter((f) => {
      if (rank(f.source) !== best) { demote(f, `style slot "${slot}" taken by higher-precedence source`); return false; }
      return true;
    });
  }

  // -- demotion: genre/subgenre strays leave subject slots another source fills
  for (const [slot, fs] of Object.entries(slots)) {
    if (SLOT_TABLE[slot].kind !== "subject") continue;
    if (!fs.some((f) => f.source !== "genre" && f.source !== "subgenre")) continue;
    slots[slot] = fs.filter((f) => {
      if (f.source === "genre" || f.source === "subgenre") { demote(f, `subject slot "${slot}" filled by higher-precedence source`); return false; }
      return true;
    });
  }

  // -- user --add wins exclusive slots outright ------------------------------
  for (const [slot, fs] of Object.entries(slots)) {
    if (SLOT_TABLE[slot].mode !== "exclusive" || !fs.some((f) => f.source === "user")) continue;
    slots[slot] = fs.filter((f) => {
      if (f.source !== "user") { demote(f, `user --add overrides ${slot}`); return false; }
      return true;
    });
  }

  // -- exact-duplicate dedup within each slot (keep first) -------------------
  for (const [slot, fs] of Object.entries(slots)) {
    const seen = new Set();
    slots[slot] = fs.filter((f) => (seen.has(f.text) ? false : (seen.add(f.text), true)));
  }

  // -- palette: one source wins by PALETTE_ORDER; species may fall back to visual.palette
  const paletteBySource = {};
  for (const f of slots.palette ?? []) (paletteBySource[f.source] ??= []).push(f.text);
  if (!paletteBySource.species && speciesEntry?.visual?.palette?.length)
    paletteBySource.species = [speciesEntry.visual.palette.join(", ")];
  let palette = null, palette_source = null;
  for (const src of PALETTE_ORDER)
    if (paletteBySource[src]) { palette = paletteBySource[src].join(", "); palette_source = src; break; }
  for (const f of slots.palette ?? [])
    if (f.source !== palette_source) demote(f, `palette resolved to ${palette_source}`);
  delete slots.palette;

  // -- conflicts: exclusive slot with survivors from ≥2 distinct sources ----
  const conflicts = [];
  for (const [slot, fs] of Object.entries(slots)) {
    if (SLOT_TABLE[slot].mode !== "exclusive") continue;
    if (new Set(fs.map((f) => f.source)).size >= 2)
      conflicts.push({ slot, candidates: fs.map(({ source, text }) => ({ source, text })) });
  }

  // -- assemble ---------------------------------------------------------------
  const art_style = (slots.art_style ?? []).map((f) => f.text).join(", ");
  const parts = [];
  for (const slot of DETAILS_ORDER) for (const f of slots[slot] ?? []) parts.push(f.text);
  let details = parts.join(", ");
  if (palette) details += `${details ? ", " : ""}palette of ${palette}`;

  const noteBits = [];
  if (demotions.length)
    noteBits.push(`demoted ${demotions.map((d) => `"${d.text}" (${d.source}→${d.slot})`).join(", ")}`);
  if (palette_source) noteBits.push(`palette from ${palette_source}`);
  if (conflicts.length) noteBits.push(`${conflicts.length} unresolved conflict(s) — resolve before rendering`);

  return {
    details, art_style, slots, demotions, conflicts,
    applied_intersections: fired.map((ix) => ix.id),
    palette: palette ?? null, palette_source,
    resolution_note: `resolution: ${noteBits.length ? noteBits.join("; ") : "clean merge"}`,
  };
}
