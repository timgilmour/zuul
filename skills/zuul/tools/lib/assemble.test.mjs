import { test, expect } from "bun:test";
import { assemble, AssembleError } from "./assemble.mjs";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Mini fixture pools in post-Tier-4 shape, modeled on the real
// high-fantasy dwarf barbarian data. Pins engine behavior byte-for-byte.
export const FIXTURE = {
  genre: [{
    id: "fantasy", taxonomy: "genre", level: "genre", label: "Fantasy",
    prompt_fragments: [
      { slot: "art_style", text: "fantasy game concept art" },
      { slot: "tone", text: "medieval fantasy aesthetic" },
      { slot: "materials", text: "hand-crafted materials" },
    ],
  }],
  subgenres: [{
    id: "high-fantasy", taxonomy: "subgenre", level: "subgenre", parent: "fantasy",
    label: "High Fantasy", tone: "heroic", descriptors: ["gleaming"],
    prompt_fragments: [
      { slot: "art_style", text: "high fantasy concept art" },
      { slot: "armor_clothing", text: "gleaming enchanted armour" },
      { slot: "armor_clothing", text: "gold-leaf ornamental detail" },
      { slot: "tone", text: "luminous magical aesthetic" },
      { slot: "tone", text: "heroic mythic scale" },
    ],
  }],
  species: [{
    id: "dwarf", taxonomy: "species", label: "Dwarf", body_plan: "biped",
    applies_to: ["fantasy"],
    visual: { palette: ["russet brown", "iron grey", "gold", "deep slate"] },
    prompt_fragments: [
      { slot: "build", text: "stocky barrel-chested build" },
      { slot: "features", text: "thick beard" },
      { slot: "surface", text: "ruddy skin" },
      { slot: "build", text: "short stature" },
    ],
  }],
  roles: [{
    id: "barbarian", taxonomy: "role", label: "Barbarian", applies_to: ["fantasy"],
    prompt_fragments: [
      { slot: "armor_clothing", text: "minimal hide and fur armour" },
      { slot: "armor_clothing", text: "bare arms and shoulders" },
      { slot: "marks", text: "war paint on face and chest" },
      { slot: "build", text: "raw muscular physique" },
      { slot: "gear", text: "tribal bone fetishes" },
    ],
  }],
  descriptors: [],
  intersections: [],
};

test("golden: high-fantasy dwarf barbarian assembles deterministically", () => {
  const r = assemble({ pools: FIXTURE, species: "dwarf", role: "barbarian", subgenre: "high-fantasy" });
  expect(r.details).toBe(
    "stocky barrel-chested build, short stature, raw muscular physique, " +
    "thick beard, ruddy skin, minimal hide and fur armour, bare arms and shoulders, " +
    "tribal bone fetishes, war paint on face and chest, hand-crafted materials, " +
    "luminous magical aesthetic, heroic mythic scale, " +
    "palette of russet brown, iron grey, gold, deep slate"
  );
  expect(r.art_style).toBe("high fantasy concept art");
  expect(r.conflicts).toEqual([]);
  expect(r.palette_source).toBe("species");
  // subgenre armor strays demoted because role fills armor_clothing
  expect(r.demotions.map((d) => d.text)).toContain("gleaming enchanted armour");
  expect(r.demotions.map((d) => d.text)).toContain("gold-leaf ornamental detail");
  // genre style fragments demoted by subgenre (style slots: highest precedence wins)
  expect(r.demotions.map((d) => d.text)).toContain("fantasy game concept art");
  expect(r.demotions.map((d) => d.text)).toContain("medieval fantasy aesthetic");
});

test("genre-only materials survive when no owner fills the slot", () => {
  const r = assemble({ pools: FIXTURE, species: "dwarf", role: "barbarian", subgenre: "high-fantasy" });
  expect(r.details).toContain("hand-crafted materials");
});

test("unknown ids throw AssembleError naming the pool", () => {
  expect(() => assemble({ pools: FIXTURE, species: "dwraf", subgenre: "high-fantasy" }))
    .toThrow(AssembleError);
  expect(() => assemble({ pools: FIXTURE, species: "dwraf", subgenre: "high-fantasy" }))
    .toThrow(/unknown species id "dwraf"/);
});

test("bare-string fragments are a hard error", () => {
  const pools = structuredClone(FIXTURE);
  pools.roles[0].prompt_fragments.push("legacy bare string");
  expect(() => assemble({ pools, species: "dwarf", role: "barbarian", subgenre: "high-fantasy" }))
    .toThrow(/bare-string fragment/);
});

test("genre derives from subgenre parent; explicit mismatch throws", () => {
  expect(() => assemble({ pools: FIXTURE, species: "dwarf", subgenre: "high-fantasy", genre: "horror" }))
    .toThrow(/conflicts with subgenre parent/);
});

const withIntersection = () => {
  const pools = structuredClone(FIXTURE);
  pools.descriptors.push({
    id: "large", taxonomy: "descriptor", category: "size", label: "Large",
    prompt_fragments: [{ slot: "build", text: "towering large build" }],
  });
  pools.intersections.push({
    id: "large-dwarf", taxonomy: "intersection", label: "Large Dwarf",
    when: ["species:dwarf", "descriptor:large"],
    visual_override: { build: "improbably huge for a dwarf", features_add: ["knotted ogre-like shoulders"] },
    traits_add: [],
    prompt_fragments_add: [{ slot: "aura", text: "looms like a landslide" }],
  });
  return pools;
};

test("intersection fires only when all when-tokens are satisfied", () => {
  const pools = withIntersection();
  const without = assemble({ pools, species: "dwarf", role: "barbarian", subgenre: "high-fantasy" });
  expect(without.applied_intersections).toEqual([]);
  const withIx = assemble({ pools, species: "dwarf", role: "barbarian", subgenre: "high-fantasy", descriptors: ["large"] });
  expect(withIx.applied_intersections).toEqual(["large-dwarf"]);
});

test("visual_override bare key replaces the slot; _add appends", () => {
  const r = assemble({ pools: withIntersection(), species: "dwarf", role: "barbarian", subgenre: "high-fantasy", descriptors: ["large"] });
  // replace: all prior build fragments demoted in favor of the override
  expect(r.details).toContain("improbably huge for a dwarf");
  expect(r.details).not.toContain("stocky barrel-chested build");
  expect(r.demotions.some((d) => d.text === "stocky barrel-chested build" && d.reason.includes("large-dwarf"))).toBe(true);
  // append: features_add lands alongside species features
  expect(r.details).toContain("knotted ogre-like shoulders");
  expect(r.details).toContain("thick beard");
  // prompt_fragments_add lands in its slot
  expect(r.details).toContain("looms like a landslide");
});

test("exclusive slot with two same-precedence sources surfaces a conflict", () => {
  const pools = structuredClone(FIXTURE);
  pools.descriptors.push(
    { id: "plate-clad", taxonomy: "descriptor", category: "visual", label: "Plate-clad",
      prompt_fragments: [{ slot: "armor_clothing", text: "full plate armour" }] },
  );
  const r = assemble({ pools, species: "dwarf", role: "barbarian", subgenre: "high-fantasy", descriptors: ["plate-clad"] });
  expect(r.conflicts).toHaveLength(1);
  expect(r.conflicts[0].slot).toBe("armor_clothing");
  // candidates: barbarian's two armor fragments + plate-clad's one
  const sources = r.conflicts[0].candidates.map((c) => c.source).sort();
  expect(sources).toEqual(["descriptor", "role", "role"]);
  expect(r.resolution_note).toContain("unresolved conflict");
});

test("user --add wins an exclusive slot outright and silences the conflict", () => {
  const pools = structuredClone(FIXTURE);
  pools.descriptors.push(
    { id: "plate-clad", taxonomy: "descriptor", category: "visual", label: "Plate-clad",
      prompt_fragments: [{ slot: "armor_clothing", text: "full plate armour" }] },
  );
  const r = assemble({
    pools, species: "dwarf", role: "barbarian", subgenre: "high-fantasy", descriptors: ["plate-clad"],
    adds: [{ slot: "armor_clothing", text: "ceremonial gold-trimmed plate" }],
  });
  expect(r.conflicts).toEqual([]);
  expect(r.details).toContain("ceremonial gold-trimmed plate");
  expect(r.details).not.toContain("minimal hide and fur armour");
});

test("additive slots never conflict — multiple descriptors compose", () => {
  const pools = structuredClone(FIXTURE);
  pools.descriptors.push(
    { id: "battle-worn", taxonomy: "descriptor", category: "condition", label: "Battle-worn",
      prompt_fragments: [{ slot: "marks", text: "battle-worn scarred equipment" }] },
    { id: "tattooed", taxonomy: "descriptor", category: "visual", label: "Tattooed",
      prompt_fragments: [{ slot: "marks", text: "ritual tattoos" }] },
  );
  const r = assemble({ pools, species: "dwarf", role: "barbarian", subgenre: "high-fantasy", descriptors: ["battle-worn", "tattooed"] });
  expect(r.conflicts).toEqual([]);
  expect(r.details).toContain("battle-worn scarred equipment");
  expect(r.details).toContain("ritual tattoos");
});

test("integration: real pools assemble high-fantasy dwarf barbarian cleanly", async () => {
  const VOCAB = resolve(dirname(fileURLToPath(import.meta.url)), "../../vocabulary");
  const load = async (f) => JSON.parse(await readFile(resolve(VOCAB, f), "utf-8"));
  const [genre, subgenres, species, roles, descriptors, intersections] = await Promise.all(
    ["genre.json", "subgenres.json", "species.json", "roles.json", "descriptors.json", "intersections.json"].map(load));
  const r = assemble({
    pools: { genre, subgenres, species, roles, descriptors, intersections },
    species: "dwarf", role: "barbarian", subgenre: "high-fantasy",
  });
  expect(r.conflicts).toEqual([]);
  expect(r.details).toMatch(/^stocky barrel-chested build/);
  expect(r.details).toContain("minimal hide and fur armour");
  expect(r.details).toContain("palette of");
  expect(r.art_style).toBe("high fantasy concept art");
  expect(r.demotions.map((d) => d.text)).toContain("gleaming enchanted armour");
});
