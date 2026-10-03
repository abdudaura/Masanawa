import { PlatformError, type SkillVersionId } from "@masanawa/contracts";
import type { SkillVersionReferenceReader } from "@masanawa/skills";
import type { PoolClient } from "pg";

export function createPostgresSkillVersionReferenceReader(client: PoolClient): SkillVersionReferenceReader {
  return Object.freeze({
    async assertVersionsExist(ids: readonly SkillVersionId[]): Promise<void> {
      if (ids.length === 0) return;
      const result = await client.query<{ skill_version_id: SkillVersionId }>(
        "SELECT skill_version_id FROM skills.versions WHERE skill_version_id = ANY($1::text[]) FOR SHARE", [ids],
      );
      if (result.rows.length !== new Set(ids).size) throw new PlatformError({
        code: "skill.reference_unavailable", category: "validation", message: "An exact SkillVersion reference is unavailable", retryable: false,
      });
    },
  });
}
