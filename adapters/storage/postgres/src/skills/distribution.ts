import { canonicalJson } from "@masanawa/security";
import {
  normalizeSkillDistributionProfile,
  type SkillDistributionAudience,
  type SkillDistributionProfile,
  type SkillDistributionRepository,
} from "@masanawa/skills";
import { PlatformError } from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function fromDefinition(value: unknown): SkillDistributionProfile {
  return normalizeSkillDistributionProfile(value as SkillDistributionProfile);
}

export function createPostgresSkillDistributionRepository(
  pool: Pool | PoolClient,
): SkillDistributionRepository {
  return Object.freeze<SkillDistributionRepository>({
    async put(input) {
      const profile = normalizeSkillDistributionProfile(input);
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: SkillDistributionProfile }>(
          `INSERT INTO skills.distribution(skill_version_id, definition)
           VALUES ($1,$2::jsonb)
           ON CONFLICT DO NOTHING
           RETURNING definition`,
          [profile.skillVersionId, canonicalJson(profile)],
        );
        if (result.rows[0]) return fromDefinition(result.rows[0].definition);
        const existing = await client.query<{ definition: SkillDistributionProfile }>(
          "SELECT definition FROM skills.distribution WHERE skill_version_id=$1",
          [profile.skillVersionId],
        );
        const replay = existing.rows[0]
          ? fromDefinition(existing.rows[0].definition)
          : null;
        if (!replay || canonicalJson(replay) !== canonicalJson(profile)) {
          throw conflict(
            "skill.distribution_conflict",
            "SkillVersion already has different distribution metadata",
          );
        }
        return replay;
      });
    },

    async read(skillVersionId) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: SkillDistributionProfile }>(
            "SELECT definition FROM skills.distribution WHERE skill_version_id=$1",
            [skillVersionId],
          );
          return result.rows[0] ? fromDefinition(result.rows[0].definition) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async listForAudience(audience: SkillDistributionAudience) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: SkillDistributionProfile }>(
            `SELECT definition
               FROM skills.distribution
              WHERE definition -> 'audiences' ? $1
              ORDER BY (definition ->> 'sortOrder')::integer, skill_version_id`,
            [audience],
          );
          return Object.freeze(result.rows.map((row) => fromDefinition(row.definition)));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}

