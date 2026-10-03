import { PlatformError, parseCanonicalId, toInstant, type SkillVersionId } from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import { createSkillRegistry, normalizeSkillVersionDefinition, type SkillVersion, type SkillRegistry } from "@masanawa/skills";
import type { PoolClient } from "pg";

/** Exact bounded graph only; immutable definitions and current readiness stay Skills-owned. */
export async function readPostgresSkillRegistryForSelection(client: PoolClient, root: SkillVersionId): Promise<SkillRegistry> {
  const versions = new Map<SkillVersionId, SkillVersion>();
  let pending = [parseCanonicalId("skill-version", root)];
  while (pending.length) {
    if (versions.size + pending.length > 64) throw new RangeError("Skill selection graph exceeds runtime bound");
    const result = await client.query<{ skill_version_id: SkillVersionId; definition: SkillVersion; definition_hash: string }>(
      "SELECT skill_version_id, definition, definition_hash FROM skills.versions WHERE skill_version_id = ANY($1::text[]) ORDER BY skill_version_id FOR SHARE", [pending]);
    if (result.rows.length !== pending.length) throw new PlatformError({ code: "skill.selection_version_missing",
      category: "not-found", message: "An exact selected SkillVersion is unavailable.", retryable: false });
    const next = new Set<SkillVersionId>();
    for (const row of result.rows) {
      const version = normalizeSkillVersionDefinition(row.definition);
      if (!pending.includes(version.skillVersionId) || row.skill_version_id !== version.skillVersionId ||
        fingerprintCanonicalJson(version) !== row.definition_hash || fingerprintCanonicalJson(row.definition) !== row.definition_hash) {
        throw new PlatformError({ code: "skill.snapshot_definition_invalid", category: "conflict",
          message: "Stored SkillVersion evidence is inconsistent.", retryable: false });
      }
      versions.set(version.skillVersionId, version);
    }
    for (const version of result.rows) for (const id of version.definition.dependencies) if (!versions.has(id)) next.add(id);
    pending = [...next].sort();
  }
  const registry = createSkillRegistry();
  registry.registerBatch([...versions.values()]);
  const readiness = await client.query<{ skill_version_id: SkillVersionId; state: "ready"|"degraded"|"blocked"|"disabled";
    advertised: boolean; reason_code: string|null; checked_at: Date }>(
    "SELECT skill_version_id, state, advertised, reason_code, checked_at FROM skills.readiness WHERE skill_version_id = ANY($1::text[]) ORDER BY skill_version_id FOR SHARE", [[...versions.keys()].sort()]);
  for (const row of readiness.rows) registry.setReadiness({ skillVersionId: row.skill_version_id,
    state: row.state, advertised: row.advertised, reasonCode: row.reason_code, checkedAt: toInstant(row.checked_at) });
  return registry;
}
