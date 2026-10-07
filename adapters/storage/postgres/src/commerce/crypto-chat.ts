import type { Pool } from "pg";
import {
  normalizeCryptoChatAction,
  type CryptoChatAction,
  type CryptoChatActionRepository,
  type CryptoChatActionScope,
} from "@masanawa/commerce";
import type { Instant, RequestId } from "@masanawa/contracts";

interface Row {
  tenant_id: string;
  user_id: string;
  character_id: string;
  request_id: string;
  kind: "convert" | "withdraw";
  provider_code: string;
  target_provider_code: string | null;
  amount: string;
  destination_address: string | null;
  quote_summary: string;
  state: "pending" | "executing" | "completed";
  created_at: Date | string;
  expires_at: Date | string;
  updated_at: Date | string;
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
function restore(row: Row): CryptoChatAction {
  return normalizeCryptoChatAction({
    tenantId: row.tenant_id as never,
    userId: row.user_id as never,
    characterId: row.character_id as never,
    requestId: row.request_id as never,
    kind: row.kind,
    providerCode: row.provider_code,
    targetProviderCode: row.target_provider_code,
    amount: row.amount,
    destinationAddress: row.destination_address,
    quoteSummary: row.quote_summary,
    state: row.state,
    createdAt: iso(row.created_at) as never,
    expiresAt: iso(row.expires_at) as never,
    updatedAt: iso(row.updated_at) as never,
  });
}

export function createPostgresCryptoChatActionRepository(
  pool: Pool,
): CryptoChatActionRepository {
  const select = `SELECT tenant_id,user_id,character_id,request_id,kind,
    provider_code,target_provider_code,amount,destination_address,quote_summary,
    state,created_at,expires_at,updated_at
    FROM commerce.crypto_chat_actions`;

  return Object.freeze({
    async put(value) {
      const action = normalizeCryptoChatAction(value);
      await pool.query(
        `INSERT INTO commerce.crypto_chat_actions(
          tenant_id,user_id,character_id,request_id,kind,provider_code,
          target_provider_code,amount,destination_address,quote_summary,state,
          created_at,expires_at,updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (tenant_id,user_id,character_id) DO UPDATE SET
          request_id=EXCLUDED.request_id,kind=EXCLUDED.kind,
          provider_code=EXCLUDED.provider_code,
          target_provider_code=EXCLUDED.target_provider_code,
          amount=EXCLUDED.amount,destination_address=EXCLUDED.destination_address,
          quote_summary=EXCLUDED.quote_summary,state=EXCLUDED.state,
          created_at=EXCLUDED.created_at,expires_at=EXCLUDED.expires_at,
          updated_at=EXCLUDED.updated_at`,
        [
          action.tenantId,action.userId,action.characterId,action.requestId,
          action.kind,action.providerCode,action.targetProviderCode,action.amount,
          action.destinationAddress,action.quoteSummary,action.state,
          action.createdAt,action.expiresAt,action.updatedAt,
        ],
      );
    },

    async readCurrent(scope: CryptoChatActionScope, at: Instant) {
      const result = await pool.query<Row>(
        `${select}
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
            AND state IN ('pending','executing') AND expires_at>$4`,
        [scope.tenantId,scope.userId,scope.characterId,at],
      );
      return result.rows[0] ? restore(result.rows[0]) : null;
    },

    async claim(scope: CryptoChatActionScope, requestId: RequestId, at: Instant) {
      const result = await pool.query<Row>(
        `UPDATE commerce.crypto_chat_actions
            SET state='executing',updated_at=$5
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
            AND request_id=$4 AND state IN ('pending','executing')
            AND expires_at>$5
          RETURNING tenant_id,user_id,character_id,request_id,kind,
            provider_code,target_provider_code,amount,destination_address,
            quote_summary,state,created_at,expires_at,updated_at`,
        [scope.tenantId,scope.userId,scope.characterId,requestId,at],
      );
      return result.rows[0] ? restore(result.rows[0]) : null;
    },

    async complete(scope: CryptoChatActionScope, requestId: RequestId, at: Instant) {
      await pool.query(
        `UPDATE commerce.crypto_chat_actions SET state='completed',updated_at=$5
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3 AND request_id=$4`,
        [scope.tenantId,scope.userId,scope.characterId,requestId,at],
      );
    },
  });
}
