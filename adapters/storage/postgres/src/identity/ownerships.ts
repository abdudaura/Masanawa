import type {
  CharacterOwnership,
  CharacterOwnershipReader,
} from "@masanawa/identity";
import { toInstant } from "@masanawa/contracts";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

interface OwnershipRow {
  tenant_id: CharacterOwnership["tenantId"];
  character_id: CharacterOwnership["characterId"];
  kind: CharacterOwnership["kind"];
  owner_user_id: CharacterOwnership["ownerUserId"];
  created_at: Date;
}

function fromRow(row: OwnershipRow): CharacterOwnership {
  return Object.freeze({
    tenantId: row.tenant_id,
    characterId: row.character_id,
    kind: row.kind,
    ownerUserId: row.owner_user_id,
    createdAt: toInstant(row.created_at),
  });
}

export function createPostgresCharacterOwnershipReader(
  pool: Pool,
): CharacterOwnershipReader {
  return Object.freeze({
    async readForCharacter(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<OwnershipRow>(
            `SELECT tenant_id, character_id, kind, owner_user_id, created_at
               FROM identity.character_ownership
              WHERE tenant_id=$1 AND character_id=$2`,
            [input.tenantId, input.characterId],
          );
          return result.rows[0] ? fromRow(result.rows[0]) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}
