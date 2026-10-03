import { PlatformError } from "@masanawa/contracts";
import type { CharacterVersionReferenceReader } from "@masanawa/identity";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

export function createPostgresCharacterVersionReferenceReader(
  pool: Pool,
): CharacterVersionReferenceReader {
  return Object.freeze({
    async assertCharacterVersion(input): Promise<void> {
      await withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ exists: boolean }>(
            `SELECT EXISTS(
               SELECT 1
                 FROM identity.character_versions
                WHERE tenant_id = $1
                  AND character_id = $2
                  AND character_version_id = $3
             ) AS exists`,
            [
              input.tenantId,
              input.characterId,
              input.characterVersionId,
            ],
          );
          if (result.rows[0]?.exists !== true) {
            throw new PlatformError({
              code: "identity.character_version_reference_unavailable",
              category: "validation",
              message:
                "The selected CharacterVersion does not belong to this Character",
              retryable: false,
            });
          }
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}
