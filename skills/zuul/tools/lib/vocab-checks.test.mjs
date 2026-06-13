import { test, expect } from "bun:test";
import {
  checkFragments, checkGenres, checkStyles, checkPoses, checkDescriptors, checkNoExt, checkTaxonomy, checkIntersections,
  checkLabels, checkTaggedPool, checkVisualOverride,
} from "./vocab-checks.mjs";

test("checkFragments flags an unknown slot", () => {
  const errs = checkFragments("x", [{ slot: "bogus", text: "hi" }]);
  expect(errs.some((e) => e.includes('unknown slot "bogus"'))).toBe(true);
});

test("checkFragments flags empty text", () => {
  const errs = checkFragments("x", [{ slot: "build", text: "   " }]);
  expect(errs.some((e) => e.includes("empty text"))).toBe(true);
});

test("checkFragments accepts a valid mix", () => {
  expect(checkFragments("x", ["plain string", { slot: "build", text: "stocky" }])).toEqual([]);
});

test("checkGenres flags a missing level", () => {
  const ids = ["fantasy","horror","scifi","modern","science-fantasy","historical","western"];
  const errs = checkGenres(ids.map((id, i) => ({ id, level: i === 0 ? "WRONG" : "genre", prompt_fragments: ["x"] })));
  expect(errs).toHaveLength(1);
  expect(errs[0]).toContain("missing level");
});

test("checkStyles requires exactly one default", () => {
  const two = [
    { id: "a", label: "A", mesh_safe: true, uses_framing: false, prompt: "p", default: true },
    { id: "b", label: "B", mesh_safe: true, uses_framing: false, prompt: "p", default: true },
  ];
  expect(checkStyles(two).some((e) => e.includes("exactly one default"))).toBe(true);
});

test("checkStyles accepts a single valid default style", () => {
  expect(checkStyles([{ id: "a", label: "A", mesh_safe: true, uses_framing: false, prompt: "p", default: true }])).toEqual([]);
});

test("checkPoses accepts full mesh-safe body-plan coverage", () => {
  const poses = ["biped","quadruped","winged","floating"].map((plan) => (
    { id: `${plan}-pose`, label: plan, category: "mesh-gen", mesh_safe: true, applies_to: [plan], phrase: "x", aspect: "2:3" }
  ));
  expect(checkPoses(poses)).toEqual([]);
});

test("checkPoses requires a mesh-safe pose for every body plan", () => {
  const onlyBiped = [{ id: "a-pose", label: "A", category: "mesh-gen", mesh_safe: true, applies_to: ["biped"], phrase: "x", aspect: "2:3" }];
  expect(checkPoses(onlyBiped).some((e) => e.includes('no mesh-safe pose for body plan "quadruped"'))).toBe(true);
});

test("checkDescriptors flags a bad category", () => {
  const errs = checkDescriptors([{ id: "x", taxonomy: "descriptor", category: "bogus", label: "X", prompt_fragments: ["y"] }]);
  expect(errs.some((e) => e.includes("category"))).toBe(true);
});

test("checkDescriptors accepts a valid entry", () => {
  expect(checkDescriptors([{ id: "tiny", taxonomy: "descriptor", category: "size", label: "Tiny", prompt_fragments: ["tiny figure"] }])).toEqual([]);
});

test("checkNoExt flags a lingering ext field", () => {
  const errs = checkNoExt([{ id: "a", ext: {} }], "x.json");
  expect(errs.some((e) => e.includes('still has an "ext" field'))).toBe(true);
});

test("checkNoExt passes when ext is gone", () => {
  expect(checkNoExt([{ id: "a" }], "x.json")).toEqual([]);
});

test("checkTaxonomy flags a missing/wrong taxonomy", () => {
  const errs = checkTaxonomy([{ id: "barbarian" }], "role", "roles.json");
  expect(errs.some((e) => e.includes('expected "role"'))).toBe(true);
});

test("checkTaxonomy passes when taxonomy matches", () => {
  expect(checkTaxonomy([{ id: "barbarian", taxonomy: "role" }], "role", "roles.json")).toEqual([]);
});

test("checkTaxonomy flags a wrong value in a mixed pool", () => {
  const errs = checkTaxonomy([{ id: "ok", taxonomy: "role" }, { id: "bad", taxonomy: "vehicle" }], "role", "roles.json");
  expect(errs).toHaveLength(1);
  expect(errs[0]).toContain('entry "bad"');
});

test("checkTaxonomy errors when expected value is undefined", () => {
  const errs = checkTaxonomy([{ id: "a", taxonomy: undefined }], undefined, "new-pool.json");
  expect(errs).toHaveLength(1);
  expect(errs[0]).toContain("no expected value");
});

const POOL_IDS = {
  species: new Set(["orc", "android"]),
  role: new Set(["barbarian", "android"]),
  descriptor: new Set(["large"]),
};
const validIntersection = (over = {}) => ({
  id: "large-orc", taxonomy: "intersection", label: "Large Orc",
  when: ["species:orc", "descriptor:large"],
  visual_override: {}, traits_add: [],
  prompt_fragments_add: ["towering even among orcs"],
  ...over,
});

test("checkIntersections accepts pool-qualified when-tokens", () => {
  expect(checkIntersections([validIntersection()], POOL_IDS)).toEqual([]);
});

test("checkIntersections rejects bare when-tokens", () => {
  const errs = checkIntersections([validIntersection({ when: ["orc", "large"] })], POOL_IDS);
  expect(errs.some((e) => e.includes('"orc"') && e.includes("<pool>:<id>"))).toBe(true);
});

test("checkIntersections rejects a token whose id is missing from the named pool", () => {
  const errs = checkIntersections([validIntersection({ when: ["species:orc", "descriptor:bogus"] })], POOL_IDS);
  expect(errs.some((e) => e.includes('"descriptor:bogus"'))).toBe(true);
});

test("checkIntersections rejects an unknown pool prefix", () => {
  const errs = checkIntersections([validIntersection({ when: ["species:orc", "vehicle:android"] })], POOL_IDS);
  expect(errs.some((e) => e.includes('"vehicle:android"'))).toBe(true);
});

test("checkIntersections disambiguates colliding ids by pool prefix", () => {
  // "android" exists as both species and role; the prefix decides.
  const ok = checkIntersections([validIntersection({ when: ["species:android", "role:barbarian"] })], POOL_IDS);
  expect(ok).toEqual([]);
  // The prefix is load-bearing: the same id under a pool that lacks it must fail.
  const errs = checkIntersections([validIntersection({ when: ["descriptor:android", "descriptor:large"] })], POOL_IDS);
  expect(errs.some((e) => e.includes('"descriptor:android"'))).toBe(true);
});

test("checkIntersections flags a missing id", () => {
  const errs = checkIntersections([{ when: ["species:orc", "descriptor:large"], label: "Large Orc", visual_override: {}, traits_add: [], prompt_fragments_add: ["x"] }], POOL_IDS);
  expect(errs.some((e) => e.includes("missing id"))).toBe(true);
});

test("checkIntersections flags a duplicate id", () => {
  const entry = validIntersection();
  const errs = checkIntersections([entry, { ...entry }], POOL_IDS);
  expect(errs.some((e) => e.includes('duplicate intersection id "large-orc"'))).toBe(true);
});

test("checkLabels flags a missing label on any pool", () => {
  const errs = checkLabels([{ id: "x" }, { id: "y", label: "Y" }], "roles.json");
  expect(errs).toHaveLength(1);
  expect(errs[0]).toContain('"x"');
});

test("checkTaggedPool requires category on props", () => {
  const prop = { id: "p", taxonomy: "prop", label: "P", applies_to: ["*"], view: "v", aspect: "1:1", prompt_fragments: ["x"] };
  const errs = checkTaggedPool("props.json", [prop], new Set(["*"]));
  expect(errs.some((e) => e.includes("missing category"))).toBe(true);
});

test("checkGenres validates prompt_fragments", () => {
  const ids = ["fantasy","horror","scifi","modern","science-fantasy","historical","western"];
  const genres = ids.map((id) => ({ id, level: "genre", prompt_fragments: id === "fantasy" ? [] : ["ok"] }));
  const errs = checkGenres(genres);
  expect(errs.some((e) => e.includes("fantasy") && e.includes("empty prompt_fragments"))).toBe(true);
});

test("checkVisualOverride accepts slot keys and <slot>_add keys", () => {
  expect(checkVisualOverride("x", { build: "huge", features_add: ["horns"] })).toEqual([]);
});

test("checkVisualOverride rejects non-slot keys and bad value shapes", () => {
  const errs = checkVisualOverride("x", { bogus: "v", build: ["not-a-string"], features_add: "not-an-array" });
  expect(errs.some((e) => e.includes('"bogus"'))).toBe(true);
  // an array on a bare slot key fails the string-shape rule, not the _add rule
  expect(errs.some((e) => e.includes('"build"') && e.includes("non-empty string"))).toBe(true);
  expect(errs.some((e) => e.includes('"features_add"'))).toBe(true);
});

test("checkVisualOverride accepts an empty _add array (benign no-op, pinned as deliberate)", () => {
  expect(checkVisualOverride("x", { features_add: [] })).toEqual([]);
});

test("checkVisualOverride rejects a bare _add key with no slot base", () => {
  const errs = checkVisualOverride("x", { _add: ["x"] });
  expect(errs.some((e) => e.includes('"_add"'))).toBe(true);
});

test("checkFragments rejects bare strings when typedRequired", () => {
  const errs = checkFragments("x", ["legacy string"], { typedRequired: true });
  expect(errs.some((e) => e.includes("requires {slot,text}"))).toBe(true);
});

test("checkFragments still accepts bare strings by default", () => {
  expect(checkFragments("x", ["legacy string"])).toEqual([]);
});
