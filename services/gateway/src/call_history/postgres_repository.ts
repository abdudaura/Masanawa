import { createCanonicalId } from "@masanawa/contracts";
import { CallHistoryError, encodeCallCursor, type CallHistoryRecorder, type CallHistoryRepository, type CallRecord } from "./service.js";

export interface CallHistorySqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
}
interface Row extends Record<string, unknown> {
  call_id: string; character_id: string; display_name: string;
  created_at: Date; connected_at: Date | null; ended_at: Date | null; expires_at: Date;
  expired: boolean; direction?: "incoming" | "outgoing"; incoming_outcome?: string | null;
}
const selection = `h.*, (h.expires_at <= clock_timestamp()) AS expired`;
const scope = `h.tenant_id=$1 AND h.user_id=$2
  AND ($3::text[] IS NULL OR h.character_id=ANY($3::text[]))`;
// Existing approved platform profiles are the Masana roster. Historical personal
// Twin identities and human contacts cannot enter this consumer projection.
const roster = `EXISTS (SELECT 1 FROM agents.platform_agent_profiles p
  JOIN agents.agent_presentations a USING (tenant_id, character_id)
  WHERE p.tenant_id=h.tenant_id AND p.character_id=h.character_id
    AND a.visible_in_user_app)`;
function record(row: Row): CallRecord {
  return {
    callId: row.call_id, characterId: row.character_id, displayName: row.display_name,
    direction: row.direction ?? "outgoing", kind: "audio",
    state: row.incoming_outcome === "missed" ? "missed" : row.incoming_outcome === "declined" ? "declined" : row.incoming_outcome === "cancelled" ? "cancelled" : row.ended_at ? "ended" : row.expired ? "expired" : row.connected_at ? "active" : "connecting",
    createdAt: row.created_at.toISOString(), connectedAt: row.connected_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null, expiresAt: row.expires_at.toISOString(),
    connectionEvidence: row.connected_at ? "client_report" : null,
  };
}
export function createPostgresCallHistoryRepository(pool: CallHistorySqlPool): CallHistoryRepository & CallHistoryRecorder {
  return {
    async attachIssued(input) {
      const result = await pool.query(`UPDATE agents.masana_call_history h SET expires_at=$5
        WHERE h.tenant_id=$1 AND h.user_id=$2 AND h.character_id=$3 AND h.call_id=$4
          AND h.direction='incoming' AND h.incoming_outcome='accepted' AND h.ended_at IS NULL
          AND ${roster} RETURNING call_id`, [input.tenantId,input.userId,input.characterId,input.callId,input.expiresAt]);
      if (result.rowCount !== 1) throw new CallHistoryError("calls.incoming_unavailable", 409);
      return input.callId;
    },
    async recordIssued(input) {
      const callId = createCanonicalId("request").slice("request_".length);
      const result = await pool.query(`INSERT INTO agents.masana_call_history
        (tenant_id,user_id,call_id,character_id,display_name,expires_at)
        SELECT p.tenant_id,$2,$3,p.character_id,a.display_name,$5
          FROM agents.platform_agent_profiles p
          JOIN agents.agent_presentations a USING (tenant_id,character_id)
         WHERE p.tenant_id=$1 AND p.character_id=$4 AND a.visible_in_user_app
        RETURNING call_id`, [input.tenantId,input.userId,callId,input.characterId,input.expiresAt]);
      if (result.rowCount !== 1) throw new CallHistoryError("calls.masana_unavailable", 403);
      return callId;
    },
    async list(input) {
      const result = await pool.query<Row>(`SELECT ${selection} FROM agents.masana_call_history h
        WHERE ${scope} AND ${roster}
          AND ($4::timestamptz IS NULL OR (h.created_at,h.call_id)<($4::timestamptz,$5::uuid))
          AND ($6::text='' OR position($6 in lower(h.display_name))>0
            OR position($6 in lower(h.character_id))>0
            OR position($6 in lower(h.call_id::text))>0
            OR position($6 in lower(h.direction))>0
            OR position($6 in lower(CASE
              WHEN h.incoming_outcome IN ('missed','declined','cancelled') THEN h.incoming_outcome
              WHEN h.ended_at IS NOT NULL THEN 'ended'
              WHEN h.expires_at<=clock_timestamp() THEN 'expired'
              WHEN h.connected_at IS NOT NULL THEN 'active'
              ELSE 'connecting' END))>0)
        ORDER BY h.created_at DESC,h.call_id DESC LIMIT $7`,
      [input.tenantId,input.userId,input.characterIds,input.cursor?.createdAt ?? null,input.cursor?.callId ?? null,input.query ?? "",input.limit+1]);
      const calls = result.rows.slice(0,input.limit).map(record);
      const last = calls.at(-1);
      return { calls, nextCursor: result.rows.length > input.limit && last ? encodeCallCursor(last, input.query ?? "") : null };
    },
    async get(input) {
      const result = await pool.query<Row>(`SELECT ${selection} FROM agents.masana_call_history h
        WHERE ${scope} AND ${roster} AND h.call_id=$4::uuid`,
      [input.tenantId,input.userId,input.characterIds,input.callId]);
      return result.rows[0] ? record(result.rows[0]) : null;
    },
    async report(input) {
      // Atomic conditional update: duplicate reports preserve original timestamps,
      // late connected reports cannot resurrect an ended or expired call.
      const result = await pool.query<Row>(`UPDATE agents.masana_call_history h SET
        connected_at=CASE WHEN $5='connected' AND h.ended_at IS NULL AND h.expires_at>clock_timestamp()
          THEN COALESCE(h.connected_at,clock_timestamp()) ELSE h.connected_at END,
        ended_at=CASE WHEN $5='ended' THEN COALESCE(h.ended_at,clock_timestamp()) ELSE h.ended_at END
        WHERE ${scope} AND ${roster} AND h.call_id=$4::uuid RETURNING ${selection}`,
      [input.tenantId,input.userId,input.characterIds,input.callId,input.event]);
      return result.rows[0] ? record(result.rows[0]) : null;
    },
  };
}
