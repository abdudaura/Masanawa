import type { InteractionIdentity, InteractionIdentityKey, InteractionIdentityReader } from "@masanawa/identity";
import type { PoolClient } from "pg";

/** Identity-owned read adapter, composed inside the caller's transaction. */
export function createPostgresInteractionIdentityReader(client: PoolClient): InteractionIdentityReader {
  return Object.freeze({
    async readInteraction(key: InteractionIdentityKey): Promise<InteractionIdentity | null> {
      const result = await client.query<InteractionIdentity>(
        `SELECT t.tenant_id AS "tenantId", u.user_id AS "userId", c.character_id AS "characterId",
                r.relationship_id AS "relationshipId", v.character_version_id AS "characterVersionId",
                t.state AS "tenantState", u.state AS "userState", c.state AS "characterState",
                r.state AS "relationshipState", v.state AS "versionState",
                c.active_character_version_id AS "activeCharacterVersionId"
           FROM identity.tenants t
           JOIN identity.users u ON u.tenant_id = t.tenant_id AND u.user_id = $2
           JOIN identity.characters c ON c.tenant_id = t.tenant_id AND c.character_id = $3
           JOIN identity.relationships r ON r.tenant_id = t.tenant_id AND r.relationship_id = $4
             AND r.user_id = u.user_id AND r.character_id = c.character_id
           JOIN identity.character_versions v ON v.tenant_id = t.tenant_id AND v.character_version_id = $5
             AND v.character_id = c.character_id
          WHERE t.tenant_id = $1
          FOR SHARE OF t, u, c, r, v`,
        [key.tenantId, key.userId, key.characterId, key.relationshipId, key.characterVersionId],
      );
      return result.rows[0] ? Object.freeze(result.rows[0]) : null;
    },
  });
}
