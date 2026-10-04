import { PlatformError } from "@masanawa/contracts";
import { canonicalJson } from "@masanawa/security";
import {
  normalizeSkillGuide,
  type SkillGuide,
  type SkillGuideRepository,
} from "@masanawa/skills";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function fromDefinition(value: unknown): SkillGuide {
  return normalizeSkillGuide(value as SkillGuide);
}

export function createPostgresSkillGuideRepository(
  pool: Pool,
): SkillGuideRepository {
  return Object.freeze<SkillGuideRepository>({
    async putGuide(input) {
      const guide = normalizeSkillGuide(input);
      return withTransaction(pool, async (client) => {
        const inserted = await client.query<{ definition: SkillGuide }>(
          `INSERT INTO skills.guides(skill_version_id, definition, content_hash)
           VALUES ($1,$2::jsonb,$3)
           ON CONFLICT DO NOTHING
           RETURNING definition`,
          [guide.skillVersionId, canonicalJson(guide), guide.contentHash],
        );
        if (inserted.rows[0]) return fromDefinition(inserted.rows[0].definition);

        const existing = await client.query<{ definition: SkillGuide }>(
          "SELECT definition FROM skills.guides WHERE skill_version_id = $1",
          [guide.skillVersionId],
        );
        const replay = existing.rows[0]
          ? fromDefinition(existing.rows[0].definition)
          : null;
        if (!replay || canonicalJson(replay) !== canonicalJson(guide)) {
          throw conflict(
            "skill.guide_conflict",
            "SkillVersion already has different immutable guidance",
          );
        }
        return replay;
      });
    },

    async readGuide(skillVersionId) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: SkillGuide }>(
            "SELECT definition FROM skills.guides WHERE skill_version_id = $1",
            [skillVersionId],
          );
          return result.rows[0] ? fromDefinition(result.rows[0].definition) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async readGuides(skillVersionIds) {
      if (!Array.isArray(skillVersionIds) || skillVersionIds.length > 512) {
        throw new RangeError("Skill guide batch is invalid");
      }
      if (skillVersionIds.length === 0) return Object.freeze([]);
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: SkillGuide }>(
            `SELECT definition
               FROM skills.guides
              WHERE skill_version_id = ANY($1::text[])
              ORDER BY skill_version_id`,
            [skillVersionIds],
          );
          return Object.freeze(result.rows.map((row) => fromDefinition(row.definition)));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}
