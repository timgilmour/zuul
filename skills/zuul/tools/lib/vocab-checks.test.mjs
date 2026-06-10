import { test, expect } from "bun:test";
import {
  checkFragments, checkGenres, checkStyles, checkPoses, checkDescriptors, checkNoExt, checkTaxonomy, checkIntersections,
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
  const errs = checkGenres(ids.map((id, i) => ({ id, level: i === 0 ? "WRONG" : "genre" })));
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

test("checkIntersections flags a missing id", () => {
  const known = new Set(["orc", "large"]);
  const errs = checkIntersections([{ when: ["orc", "large"], label: "Large Orc", visual_override: {}, traits_add: [], prompt_fragments_add: ["x"] }], known);
  expect(errs.some((e) => e.includes("missing id"))).toBe(true);
});

test("checkIntersections flags an unresolved when-token", () => {
  const known = new Set(["orc"]);
  const errs = checkIntersections([{ id: "orc-ghost", when: ["orc", "ghost"], label: "L", visual_override: {}, traits_add: [], prompt_fragments_add: ["x"] }], known);
  expect(errs.some((e) => e.includes('when-token "ghost"'))).toBe(true);
});

test("checkIntersections accepts a valid entry", () => {
  const known = new Set(["orc", "large"]);
  expect(checkIntersections([{ id: "large-orc", taxonomy: "intersection", when: ["orc", "large"], label: "Large Orc", visual_override: { build: "big" }, traits_add: ["x"], prompt_fragments_add: ["towering"] }], known)).toEqual([]);
});

test("checkIntersections flags a duplicate id", () => {
  const known = new Set(["orc", "large"]);
  const entry = { id: "large-orc", taxonomy: "intersection", when: ["orc", "large"], label: "Large Orc", visual_override: {}, traits_add: [], prompt_fragments_add: ["x"] };
  const errs = checkIntersections([entry, { ...entry }], known);
  expect(errs.some((e) => e.includes('duplicate intersection id "large-orc"'))).toBe(true);
});
