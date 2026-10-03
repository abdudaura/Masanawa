import { PlatformError, toInstant } from "@masanawa/contracts";
import { canonicalJson, fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeSkill, normalizeSkillReadiness, normalizeSkillVersionDefinition,
  restoreSkillRegistry,
  type Skill, type SkillVersion, type SkillCatalogSnapshot,
  type SkillReadiness, type SkillReadinessRecord, type SkillRepository,
} from "@masanawa/skills";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({ code, category: "conflict", message, retryable: false });
}

interface ReadinessRow {
  skill_version_id: SkillReadiness["skillVersionId"];
  state: SkillReadiness["state"];
  advertised: boolean;
  reason_code: string | null;
  checked_at: Date;
  revision: string;
}

function readinessRecord(row: ReadinessRow): SkillReadinessRecord {
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw conflict("skill.snapshot_readiness_invalid", "Stored readiness revision is invalid");
  }
  return Object.freeze({ revision, readiness: normalizeSkillReadiness({
    skillVersionId: row.skill_version_id, state: row.state,
    advertised: row.advertised, reasonCode: row.reason_code,
    checkedAt: toInstant(row.checked_at.toISOString()),
  }) });
}

async function readSnapshot(client: PoolClient): Promise<SkillCatalogSnapshot> {
  const identities = await client.query<{ skill_id: Skill["skillId"]; key: string; created_at: Date }>(
    "SELECT skill_id, key, created_at FROM skills.skills ORDER BY key",
  );
  const definitions = await client.query<{ definition: SkillVersion; definition_hash: string }>(
    "SELECT definition, definition_hash FROM skills.versions ORDER BY key, version, skill_version_id",
  );
  const observations = await client.query<ReadinessRow>(
    "SELECT * FROM skills.readiness ORDER BY skill_version_id",
  );
  const snapshot: SkillCatalogSnapshot = Object.freeze({
    skills: Object.freeze(identities.rows.map(row => normalizeSkill({
      skillId: row.skill_id, key: row.key, createdAt: toInstant(row.created_at.toISOString()),
    }))),
    versions: Object.freeze(definitions.rows.map(row => {
      const version = normalizeSkillVersionDefinition(row.definition);
      if (fingerprintCanonicalJson(version) !== row.definition_hash ||
          fingerprintCanonicalJson(row.definition) !== row.definition_hash) {
        throw conflict("skill.snapshot_definition_invalid", "Stored SkillVersion definition fingerprint is inconsistent");
      }
      return version;
    })),
    readiness: Object.freeze(observations.rows.map(readinessRecord)),
  });
  restoreSkillRegistry(snapshot);
  return snapshot;
}

/** Only trusted catalog composition calls this port; execution still uses Tools. */
export function createPostgresSkillRepository(pool: Pool): SkillRepository {
  return Object.freeze({
    async registerBatch(inputs: readonly SkillVersion[]) {
      if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 512) {
        throw new RangeError("skill registration batch is invalid");
      }
      const versions = inputs.map(normalizeSkillVersionDefinition);
      return withTransaction(pool, async client => {
        // Serialize rare catalog admissions. No execution traffic takes this lock.
        await client.query("SELECT pg_advisory_xact_lock(731070, 1)");
        const registry = restoreSkillRegistry(await readSnapshot(client));
        const registrations = registry.registerBatch(versions);
        for (const { skill, reused } of registrations) {
          if (reused) continue;
          await client.query(
            "INSERT INTO skills.skills(skill_id, key) VALUES ($1, $2) ON CONFLICT (skill_id) DO NOTHING",
            [skill.skillId, skill.key],
          );
          await client.query(
            `INSERT INTO skills.versions(skill_version_id, skill_id, key, version, definition, definition_hash)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
            [skill.skillVersionId, skill.skillId, skill.key, skill.version,
              canonicalJson(skill), fingerprintCanonicalJson(skill)],
          );
        }
        return registrations;
      });
    },
    async readSnapshot() {
      return withTransaction(pool, readSnapshot, { isolation: "repeatable read", readOnly: true });
    },
    async putReadiness(input: { readonly readiness: SkillReadiness; readonly expectedRevision: number | null }) {
      const readiness = normalizeSkillReadiness(input.readiness);
      const expected = input.expectedRevision;
      if (expected !== null && (!Number.isSafeInteger(expected) || expected < 1 || expected === Number.MAX_SAFE_INTEGER)) {
        throw new RangeError("Expected readiness revision is invalid or exhausted");
      }
      return withTransaction(pool, async client => {
        // Validate hidden/unknown versions using the same canonical rules.
        const registry = restoreSkillRegistry(await readSnapshot(client));
        registry.setReadiness(readiness);
        const values = [readiness.skillVersionId, readiness.state, readiness.advertised,
          readiness.reasonCode, readiness.checkedAt];
        const result = expected === null
          ? await client.query<ReadinessRow>(
            `INSERT INTO skills.readiness(skill_version_id, state, advertised, reason_code, checked_at, revision)
             VALUES ($1, $2, $3, $4, $5, 1) ON CONFLICT DO NOTHING RETURNING *`, values)
          : await client.query<ReadinessRow>(
            `UPDATE skills.readiness SET state = $2, advertised = $3, reason_code = $4,
             checked_at = $5, revision = revision + 1
             WHERE skill_version_id = $1 AND revision = $6 AND checked_at <= $5 RETURNING *`,
            [...values, expected]);
        if (!result.rows[0]) {
          throw conflict("skill.readiness_revision_conflict", "Readiness changed since the supplied observation");
        }
        return readinessRecord(result.rows[0]);
      });
    },
  });
}
