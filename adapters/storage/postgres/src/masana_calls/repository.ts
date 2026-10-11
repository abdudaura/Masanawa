import type { Pool } from "pg";
import type { CallActor, CallRecord, CallStore } from "../../../../../../services/gateway/src/modules/masana_calls/service.js";

/** Exact tenant + fan fencing; caller never supplies actor identity. */
export function createPostgresMasanaCallStore(db: Pick<Pool,"query">): CallStore & {
  claimExpired(limit: number): Promise<readonly {callId:string;roomName:string}[]>;
} {
  return Object.freeze({
    async qualified(input: CallActor & {characterId:string}): Promise<boolean> {
      const r=await db.query<{ok:boolean}>([
        "SELECT EXISTS(SELECT 1 FROM masana.character_revisions r",
        "JOIN identity.characters c USING(tenant_id,character_id)",
        "JOIN identity.character_ownership o USING(tenant_id,character_id)",
        "JOIN identity.users u ON u.tenant_id=$1 AND u.user_id=$2",
        "WHERE r.tenant_id=$1 AND r.character_id=$3",
        "AND r.state='approved' AND trim(coalesce(r.voice_profile_id,'')) <> ''",
        "AND c.state='active' AND o.kind='platform' AND u.state='active') AS ok",
      ].join(" "),[input.tenantId,input.fanUserId,input.characterId]);
      return r.rows[0]?.ok === true;
    },
    async create(input): Promise<boolean> {
      const r=await db.query([
        "INSERT INTO masana.call_sessions",
        "(tenant_id,call_id,fan_user_id,character_id,request_id,room_name,expires_at)",
        "VALUES ($1,$2,$3,$4,$5,$6,$7)",
        "ON CONFLICT DO NOTHING RETURNING call_id",
      ].join(" "),[
        input.tenantId,input.callId,input.fanUserId,input.characterId,
        input.requestId,input.roomName,input.expiresAt,
      ]);
      return r.rows.length===1;
    },
    async markActive(input): Promise<boolean> {
      const r=await db.query([
        "UPDATE masana.call_sessions SET state='active',started_at=now()",
        "WHERE tenant_id=$1 AND fan_user_id=$2 AND call_id=$3 AND state='connecting'",
        "AND expires_at > now() RETURNING call_id",
      ].join(" "),[input.tenantId,input.fanUserId,input.callId]);
      return r.rows.length===1;
    },
    async finish(input): Promise<boolean> {
      const r=await db.query([
        "UPDATE masana.call_sessions SET state=$4,ended_at=now(),failure_code=$5,",
        "billed_seconds=CASE WHEN $4='ended' THEN",
        "LEAST(900,GREATEST(0,EXTRACT(EPOCH FROM(now()-coalesce(started_at,now())))::integer))",
        "ELSE 0 END",
        "WHERE tenant_id=$1 AND fan_user_id=$2 AND call_id=$3",
        "AND state IN ('connecting','active') RETURNING call_id",
      ].join(" "),[
        input.tenantId,input.fanUserId,input.callId,input.state,input.failureCode??null,
      ]);
      return r.rows.length===1;
    },
    async get(input): Promise<CallRecord|null> {
      const r=await db.query<CallRecord>([
        'SELECT call_id AS "callId",tenant_id AS "tenantId",',
        'fan_user_id AS "fanUserId",character_id AS "characterId",',
        'room_name AS "roomName",state,expires_at AS "expiresAt"',
        "FROM masana.call_sessions",
        "WHERE tenant_id=$1 AND fan_user_id=$2 AND call_id=$3",
      ].join(" "),[input.tenantId,input.fanUserId,input.callId]);
      return r.rows[0]??null;
    },
    async claimExpired(limit): Promise<readonly {callId:string;roomName:string}[]> {
      const r=await db.query<{callId:string;roomName:string}>([
        "WITH due AS (",
        "SELECT tenant_id,call_id FROM masana.call_sessions",
        "WHERE state IN ('connecting','active') AND expires_at <= now()",
        "ORDER BY expires_at,tenant_id,call_id LIMIT $1 FOR UPDATE SKIP LOCKED)",
        "UPDATE masana.call_sessions s",
        "SET state='expired',ended_at=now(),billed_seconds=0",
        "FROM due d WHERE s.tenant_id=d.tenant_id AND s.call_id=d.call_id",
        'RETURNING s.call_id AS "callId",s.room_name AS "roomName"',
      ].join(" "),[limit]);
      return r.rows;
    },
  });
}
