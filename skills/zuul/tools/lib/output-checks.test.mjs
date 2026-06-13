import { test, expect } from "bun:test";
import { checkOutputIndex } from "./output-checks.mjs";

const POOL_IDS = {
  genre: new Set(["fantasy"]),
  species: new Set(["goblin"]),
  role: new Set(["rogue"]),
  descriptor: new Set(["battle-worn", "hooded"]),
};
const entry = (over = {}) => ({
  id: "0000-goblin-thief", title: "Nix", subject_type: "character", slug: "goblin-thief",
  path: "09-Outputs/concepts/characters/0000-goblin-thief/0000-goblin-thief.json",
  image: "09-Outputs/concepts/characters/0000-goblin-thief/goblin-thief-01.png",
  created: "2026-06-07", model: "nano-banana-2",
  genre: "fantasy", species: "goblin", role: "rogue", descriptors: ["battle-worn"],
  ...over,
});

test("accepts a valid character entry", () => {
  expect(checkOutputIndex({ entries: [entry()] }, POOL_IDS)).toEqual([]);
});

test("flags missing required fields", () => {
  const { model, ...rest } = entry();
  const errs = checkOutputIndex({ entries: [rest] }, POOL_IDS);
  expect(errs.some((e) => e.includes("missing model"))).toBe(true);
});

test("flags duplicate ids", () => {
  const errs = checkOutputIndex({ entries: [entry(), entry()] }, POOL_IDS);
  expect(errs.some((e) => e.includes("duplicate"))).toBe(true);
});

test("flags unresolved vocab references on character entries", () => {
  const errs = checkOutputIndex({ entries: [entry({ species: "gobbo", descriptors: ["battle-worn", "shiny"] })] }, POOL_IDS);
  expect(errs.some((e) => e.includes('unknown species "gobbo"'))).toBe(true);
  expect(errs.some((e) => e.includes('unknown descriptor "shiny"'))).toBe(true);
});

test("non-character entries skip vocab referential checks", () => {
  const e = entry({ subject_type: "vehicle", species: "not-checked", role: undefined });
  expect(checkOutputIndex({ entries: [e] }, POOL_IDS)).toEqual([]);
});

test("rejects a document without entries[]", () => {
  expect(checkOutputIndex({}, POOL_IDS)).toEqual(["index.json: missing entries[] array"]);
});
