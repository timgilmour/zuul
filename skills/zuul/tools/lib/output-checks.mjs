// lib/output-checks.mjs — pure checks for 09-Outputs/index.json render records.
// No file I/O; the runner (validate-outputs.mjs) loads files and prints.

export const REQUIRED_FIELDS = ["id", "title", "subject_type", "slug", "path", "image", "created", "model"];

// poolIds = { genre: Set, species: Set, role: Set, descriptor: Set }
export function checkOutputIndex(indexDoc, poolIds) {
  if (!indexDoc || !Array.isArray(indexDoc.entries)) return ["index.json: missing entries[] array"];
  const errors = [];
  const ids = new Set();
  for (const e of indexDoc.entries) {
    const tag = e.id ?? e.title ?? "(unknown)";
    for (const f of REQUIRED_FIELDS)
      if (typeof e[f] !== "string" || !e[f].trim()) errors.push(`entry ${tag}: missing ${f}`);
    if (e.id != null) {
      if (ids.has(e.id)) errors.push(`duplicate entry id "${e.id}"`);
      ids.add(e.id);
    }
    if (e.subject_type === "character") {
      if (e.genre && !poolIds.genre.has(e.genre)) errors.push(`entry ${tag}: unknown genre "${e.genre}"`);
      if (e.species && !poolIds.species.has(e.species)) errors.push(`entry ${tag}: unknown species "${e.species}"`);
      if (e.role && !poolIds.role.has(e.role)) errors.push(`entry ${tag}: unknown role "${e.role}"`);
      for (const d of e.descriptors ?? [])
        if (!poolIds.descriptor.has(d)) errors.push(`entry ${tag}: unknown descriptor "${d}"`);
    }
    // traits[] are free-text by design — never validated against pools.
  }
  return errors;
}
