import type { Pool } from "pg";
import type { FanDevicePrincipal, FanDeviceRevokeResult, FanDeviceSession,
  FanDeviceSessionStore } from "@masanawa/security";
import { withTransaction } from "../transaction.js";

type Row = { device_id: string; created_at: Date|string; updated_at: Date|string;
  refresh_expires_at: Date|string; current: boolean };
const stamp=(v:Date|string)=>new Date(v).toISOString();
const hex=/^[0-9a-f]{64}$/u;

/**
 * C09 is only a projection and revocation of security.platform_sessions.
 * The canonical access/refresh resolver already rejects revoked/expired tokens.
 * No token hashes or peer identity metadata ever leave this adapter.
 */
export function createPgFanDeviceSessionStore(pool: Pool): FanDeviceSessionStore {
  return {
    async list(actor:FanDevicePrincipal,currentAccessHash:string):Promise<readonly FanDeviceSession[]|null> {
      if(!hex.test(currentAccessHash))return null;
      const rows=await pool.query<Row>(`SELECT device_id,created_at,updated_at,refresh_expires_at,
                 (access_hash=$3) AS current
          FROM security.platform_sessions
         WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL
           AND refresh_expires_at>now() AND device_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM security.platform_sessions authenticated
             WHERE authenticated.tenant_id=$1 AND authenticated.user_id=$2
               AND authenticated.access_hash=$3 AND authenticated.revoked_at IS NULL
               AND authenticated.access_expires_at>now() AND authenticated.refresh_expires_at>now()
           )
         ORDER BY (access_hash=$3) DESC,created_at DESC,device_id DESC LIMIT 30`,
        [actor.tenantId,actor.fanUserId,currentAccessHash]);
      // Unlike a valid empty list, revoked/rotated credentials must fail closed.
      const current=rows.rows.some(r=>r.current);
      if(!current)return null;
      return rows.rows.map(r=>({id:String(r.device_id),startedAt:stamp(r.created_at),
        lastSeenAt:stamp(r.updated_at),expiresAt:stamp(r.refresh_expires_at),
        current:Boolean(r.current)}));
    },
    async revoke(actor:FanDevicePrincipal,currentAccessHash:string,deviceId:string,key:string):
      Promise<FanDeviceRevokeResult> {
      if(!hex.test(currentAccessHash))return "unauthorized";
      return withTransaction(pool,async client=>{
        // Lock current session against refresh rotation and concurrent revoke.
        // Serializes replay with the same bearer, so checking the audit below
        // and writing it are atomic even for concurrent duplicate requests.
        const active=await client.query<{device_id:string;created_at:Date|string}>(`
          SELECT device_id,created_at FROM security.platform_sessions
           WHERE tenant_id=$1 AND user_id=$2 AND access_hash=$3
             AND revoked_at IS NULL AND access_expires_at>now() AND refresh_expires_at>now()
           FOR UPDATE`,[actor.tenantId,actor.fanUserId,currentAccessHash]);
        if(!active.rows.length)return "unauthorized" as const;
        if(active.rows[0]?.device_id===deviceId)return "current" as const;
        const old=await client.query<{device_id:string}>(`
          SELECT device_id FROM security.fan_session_revocation_audit
           WHERE tenant_id=$1 AND fan_user_id=$2 AND request_key=$3`,
          [actor.tenantId,actor.fanUserId,key]);
        if(old.rows.length)return old.rows[0]?.device_id===deviceId?"already" as const:"not_found" as const;
        // Existing OTP-only platform login supplies a recent authenticator.
        // Demanding a fresh sign-in is fail-closed step-up without inventing a
        // second OTP verifier or relying on a client-supplied 'verified' flag.
        if(Date.now()-new Date(active.rows[0]!.created_at).getTime()>5*60_000)
          return "step_up_required" as const;
        const revoked=await client.query<{device_id:string}>(`
          UPDATE security.platform_sessions SET revoked_at=now(),updated_at=now()
           WHERE tenant_id=$1 AND user_id=$2 AND device_id=$3::uuid
             AND access_hash<>$4 AND revoked_at IS NULL
           RETURNING device_id`,
          [actor.tenantId,actor.fanUserId,deviceId,currentAccessHash]);
        if(!revoked.rows.length)return "not_found" as const;
        // Durable action receipt in the *same transaction*; rollback if audit fails.
        await client.query(`INSERT INTO security.fan_session_revocation_audit
            (tenant_id,fan_user_id,device_id,request_key) VALUES($1,$2,$3::uuid,$4)`,
          [actor.tenantId,actor.fanUserId,deviceId,key]);
        return "revoked" as const;
      });
    }
  };
}
