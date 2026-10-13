import type { Pool } from "pg";
export interface MessageActionScope { tenantId: string; fanUserId: string; }
export interface MasanaMessageActionStore {
  hideOwnedSentTurn(actor: MessageActionScope, characterId: string, requestId: string): Promise<boolean>;
}
const character = /^character_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const request = /^request_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeActor(actor: MessageActionScope): void {
  if (!actor || !/^[\w:.\-]{1,128}$/.test(actor.tenantId) ||
      !/^[\w:.\-]{1,128}$/.test(actor.fanUserId)) {
    throw new TypeError("invalid_fan_scope");
  }
}
/**
 * Idempotent hide for a completed turn belonging to this exact fan, tenant and
 * active, approved platform-owned Masana. Does not mutate the shared journal.
 */
export function createMasanaMessageActionStore(db: Pick<Pool, "query">): MasanaMessageActionStore {
  return {
    async hideOwnedSentTurn(actor, characterId, requestId) {
      safeActor(actor);
      if (!character.test(characterId) || !request.test(requestId))
        throw new TypeError("invalid_message_identifier");
      const result = await db.query<{ owned: boolean }>(`
        WITH eligible AS (
          SELECT 1 FROM agents.mobile_turn_commands t
          JOIN identity.users u ON u.tenant_id=t.tenant_id AND u.user_id=t.user_id
            AND u.state='active'
          JOIN identity.characters c ON c.tenant_id=t.tenant_id
            AND c.character_id=t.character_id AND c.state='active'
          JOIN identity.character_ownership o ON o.tenant_id=t.tenant_id
            AND o.character_id=t.character_id AND o.kind='platform'
          JOIN masana.character_revisions r ON r.tenant_id=t.tenant_id
            AND r.character_id=t.character_id AND r.state='approved'
          WHERE t.tenant_id=$1 AND t.user_id=$2 AND t.character_id=$3
            AND t.request_id=$4 AND t.state='completed'
          LIMIT 1
        ), hidden AS (
          INSERT INTO masana.fan_hidden_turns
            (tenant_id, fan_user_id, character_id, request_id)
          SELECT $1,$2,$3,$4 FROM eligible
          ON CONFLICT (tenant_id, fan_user_id, character_id, request_id)
          DO NOTHING
          RETURNING request_id
        )
        SELECT EXISTS(SELECT 1 FROM eligible) AS owned
      `, [actor.tenantId, actor.fanUserId, characterId, requestId]);
      return result.rows[0]?.owned === true;
    },
  };
}
