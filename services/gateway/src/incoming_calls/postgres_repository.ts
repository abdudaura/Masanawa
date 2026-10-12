import { createCanonicalId } from "@masanawa/contracts";
import {
  IncomingCallError,
  type IncomingCall,
  type IncomingRepository,
} from "./service.js";
import type { CallHistorySqlPool } from "../call_history/postgres_repository.js";
interface Client extends CallHistorySqlPool {
  release(): void;
}
export interface IncomingSqlPool extends CallHistorySqlPool {
  connect(): Promise<Client>;
}
interface Row extends Record<string, unknown> {
  tenant_id: string;
  user_id: string;
  call_id: string;
  character_id: string;
  display_name: string;
  state: IncomingCall["state"];
  created_at: Date;
  expires_at: Date;
  lease_id: string;
}
function record(r: Row): IncomingCall {
  return {
    callId: r.call_id,
    characterId: r.character_id,
    displayName: r.display_name,
    state: r.state,
    createdAt: r.created_at.toISOString(),
    expiresAt: r.expires_at.toISOString(),
  };
}
const scope = `i.tenant_id=$1 AND i.user_id=$2 AND ($3::text[] IS NULL OR i.character_id=ANY($3::text[]))`;
const roster = `EXISTS(SELECT 1 FROM agents.platform_agent_profiles p JOIN agents.agent_presentations a USING(tenant_id,character_id) WHERE p.tenant_id=i.tenant_id AND p.character_id=i.character_id AND a.visible_in_user_app)`;
const id = () => createCanonicalId("request").slice("request_".length);
export function createPostgresIncomingCallRepository(
  pool: IncomingSqlPool,
): IncomingRepository {
  async function tx<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const result = await fn(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async function history(c: CallHistorySqlPool, r: Row) {
    await c.query(
      `INSERT INTO agents.masana_call_history(tenant_id,user_id,call_id,character_id,display_name,created_at,expires_at,direction,incoming_outcome,ended_at) VALUES($1,$2,$3,$4,$5,$6,$7,'incoming',$8,CASE WHEN $8='accepted' THEN NULL ELSE clock_timestamp() END) ON CONFLICT(tenant_id,user_id,call_id) DO UPDATE SET incoming_outcome=EXCLUDED.incoming_outcome,ended_at=CASE WHEN EXCLUDED.incoming_outcome='accepted' THEN agents.masana_call_history.ended_at ELSE COALESCE(agents.masana_call_history.ended_at,EXCLUDED.ended_at) END`,
      [
        r.tenant_id,
        r.user_id,
        r.call_id,
        r.character_id,
        r.display_name,
        r.created_at,
        r.expires_at,
        r.state,
      ],
    );
  }
  async function expire() {
    await tx(async (c) => {
      await c.query(
        `UPDATE agents.masana_incoming_calls SET token_status='unknown' WHERE token_status='issuing' AND token_started_at<clock_timestamp()-interval '1 minute'`,
      );
      await c.query(
        `UPDATE agents.masana_call_history h SET ended_at=COALESCE(h.ended_at,clock_timestamp()) FROM agents.masana_incoming_calls i WHERE h.tenant_id=i.tenant_id AND h.user_id=i.user_id AND h.call_id=i.call_id AND h.ended_at IS NULL AND i.state='accepted' AND (i.token_status='unknown' OR (i.token_status='idle' AND i.expires_at+interval '2 minutes'<=clock_timestamp()))`,
      );
      const result = await c.query<Row>(
        `UPDATE agents.masana_incoming_calls SET state='missed' WHERE state='ringing' AND expires_at<=clock_timestamp() RETURNING *`,
      );
      for (const r of result.rows) await history(c, r);
    });
  }
  return {
    async initiate(input) {
      return tx(async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          JSON.stringify([input.tenantId, input.userId, input.requestId]),
        ]);
        const old = await c.query<Row>(
          "SELECT * FROM agents.masana_incoming_calls WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3",
          [input.tenantId, input.userId, input.requestId],
        );
        if (old.rows[0]) {
          if (old.rows[0].character_id !== input.characterId)
            throw new IncomingCallError("incoming.request_conflict", 409);
          return record(old.rows[0]);
        }
        const callId = id();
        const result = await c.query<Row>(
          `INSERT INTO agents.masana_incoming_calls(tenant_id,user_id,call_id,character_id,display_name,request_id,expires_at) SELECT p.tenant_id,$2,$3,p.character_id,a.display_name,$5,clock_timestamp()+($6::integer*interval '1 millisecond') FROM agents.platform_agent_profiles p JOIN agents.agent_presentations a USING(tenant_id,character_id) WHERE p.tenant_id=$1 AND p.character_id=$4 AND a.visible_in_user_app RETURNING *`,
          [
            input.tenantId,
            input.userId,
            callId,
            input.characterId,
            input.requestId,
            input.ringDurationMs ?? 60000,
          ],
        );
        const r = result.rows[0];
        if (!r) throw new IncomingCallError("incoming.masana_unavailable", 403);
        await c.query(
          "INSERT INTO agents.masana_incoming_push_outbox(tenant_id,user_id,call_id) VALUES($1,$2,$3)",
          [input.tenantId, input.userId, callId],
        );
        return record(r);
      });
    },
    async get(input) {
      await expire();
      const r = await pool.query<Row>(
        `SELECT i.* FROM agents.masana_incoming_calls i WHERE ${scope} AND ${roster} AND i.call_id=$4`,
        [input.tenantId, input.userId, input.characterIds, input.callId],
      );
      return r.rows[0] ? record(r.rows[0]) : null;
    },
    async list(input) {
      await expire();
      const r = await pool.query<Row>(
        `SELECT i.* FROM agents.masana_incoming_calls i WHERE ${scope} AND ${roster} AND state='ringing' ORDER BY created_at DESC LIMIT 50`,
        [input.tenantId, input.userId, input.characterIds],
      );
      return r.rows.map(record);
    },
    async transition(input) {
      return tx(async (c) => {
        const result = await c.query<Row>(
          `SELECT i.* FROM agents.masana_incoming_calls i WHERE ${scope} AND ${roster} AND call_id=$4 FOR UPDATE`,
          [input.tenantId, input.userId, input.characterIds, input.callId],
        );
        let r = result.rows[0];
        if (!r) return null;
        if (r.state === "ringing") {
          const changed = await c.query<Row>(
            `UPDATE agents.masana_incoming_calls SET state=CASE WHEN expires_at<=clock_timestamp() THEN 'missed' ELSE $4 END WHERE tenant_id=$1 AND user_id=$2 AND call_id=$3 RETURNING *`,
            [input.tenantId, input.userId, input.callId, input.state],
          );
          r = changed.rows[0]!;
          await history(c, r);
        }
        return record(r);
      });
    },
    expire,
    async claimPush() {
      await expire();
      const leaseId = id();
      const result = await pool.query<Row>(
        `WITH candidate AS(SELECT o.tenant_id,o.user_id,o.call_id FROM agents.masana_incoming_push_outbox o JOIN agents.masana_incoming_calls i USING(tenant_id,user_id,call_id) WHERE o.delivered_at IS NULL AND o.available_at<=clock_timestamp() AND (o.lease_until IS NULL OR o.lease_until<=clock_timestamp()) AND i.state='ringing' AND i.expires_at>clock_timestamp() AND ${roster} ORDER BY o.available_at LIMIT 1 FOR UPDATE OF o SKIP LOCKED), leased AS(UPDATE agents.masana_incoming_push_outbox o SET lease_id=$1,lease_until=clock_timestamp()+interval '1 minute',attempts=attempts+1 FROM candidate c WHERE o.tenant_id=c.tenant_id AND o.user_id=c.user_id AND o.call_id=c.call_id RETURNING o.*) SELECT i.*,l.lease_id FROM leased l JOIN agents.masana_incoming_calls i USING(tenant_id,user_id,call_id)`,
        [leaseId],
      );
      const r = result.rows[0];
      return r
        ? {
            tenantId: r.tenant_id,
            userId: r.user_id,
            call: record(r),
            leaseId: r.lease_id,
          }
        : null;
    },
    async finishPush(input) {
      await pool.query(
        `UPDATE agents.masana_incoming_push_outbox SET delivered_at=CASE WHEN $3 THEN clock_timestamp() ELSE NULL END,available_at=clock_timestamp()+LEAST(attempts*10,300)*interval '1 second',lease_until=NULL,lease_id=NULL WHERE call_id=$1 AND lease_id=$2`,
        [input.callId, input.leaseId, input.delivered],
      );
    },
    async claimToken(input) {
      const r = await pool.query(
        `UPDATE agents.masana_incoming_calls i SET token_status='issuing',token_started_at=clock_timestamp(),admission_id=$5 WHERE ${scope} AND ${roster} AND call_id=$4 AND state='accepted' AND token_status='idle' AND expires_at+interval '2 minutes'>clock_timestamp()`,
        [
          input.tenantId,
          input.userId,
          input.characterIds,
          input.callId,
          input.admissionId,
        ],
      );
      return r.rowCount === 1;
    },
    async finishToken(input) {
      await pool.query(
        `UPDATE agents.masana_incoming_calls SET token_status=CASE WHEN $5 THEN 'unknown' WHEN $4 THEN 'issued' ELSE 'idle' END WHERE tenant_id=$1 AND user_id=$2 AND call_id=$3 AND token_status='issuing'`,
        [
          input.tenantId,
          input.userId,
          input.callId,
          input.success,
          input.unknown ?? false,
        ],
      );
    },
  };
}
