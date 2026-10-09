import type { HumanCall,HumanCallRepository,HumanCallKind,HumanCallState } from "./service.js";

interface SqlResult<T> { readonly rows: T[]; readonly rowCount: number | null }
interface SqlQuery {
  query<T extends Record<string,unknown> = Record<string,unknown>>(
    sql:string, params?:unknown[],
  ):Promise<SqlResult<T>>;
}
interface SqlClient extends SqlQuery { release():void }
export interface HumanCallSqlPool extends SqlQuery { connect():Promise<SqlClient> }
interface CallRow extends Record<string,unknown> {
  call_id:string;conversation_id:string;caller_user_id:string;callee_user_id:string;
  kind:HumanCallKind;state:HumanCallState;created_at:string|Date;
  answered_at:string|Date|null;ended_at:string|Date|null;
  client_request_id:string;expires_at:string|Date;
}
function view(r:CallRow):HumanCall {
  return Object.freeze({
    callId:r.call_id,conversationId:r.conversation_id,callerUserId:r.caller_user_id,
    calleeUserId:r.callee_user_id,kind:r.kind,state:r.state,
    createdAt:new Date(r.created_at).toISOString(),
    answeredAt:r.answered_at ? new Date(r.answered_at).toISOString():null,
    endedAt:r.ended_at ? new Date(r.ended_at).toISOString():null,
  });
}
const fields = `call_id,conversation_id,caller_user_id,callee_user_id,kind,
  state,created_at,answered_at,ended_at,expires_at,client_request_id`;
async function transaction<T>(pool:HumanCallSqlPool,run:(q:SqlClient)=>Promise<T>) {
  const q=await pool.connect();
  try {
    await q.query("BEGIN");
    const result=await run(q);
    await q.query("COMMIT");
    return result;
  } catch (error) {
    try { await q.query("ROLLBACK"); } catch { /* original error wins */ }
    throw error;
  } finally { q.release(); }
}
// Order locks by canonical user ID so A→B and B→A cannot deadlock.
// This also serializes overlapping calls A→B and A→C on account A.
async function lockUsers(q:SqlQuery,tenant:string,a:string,b:string) {
  const found=await q.query<{user_id:string}&Record<string,unknown>>(
    `SELECT user_id FROM identity.users
      WHERE tenant_id=$1 AND user_id IN ($2,$3) AND state='active'
      ORDER BY user_id FOR UPDATE`,[tenant,a,b]);
  return found.rows.length===2;
}
// Deliberately stricter than C02 open/send: a private call requires BOTH
// explicitly accepted contact consent and no R15 reciprocal restriction.
// Every start/accept is checked inside the same DB transaction.
async function allowed(q:SqlQuery,tenant:string,actor:string,conversationId:string) {
  const hit=await q.query<{first_user_id:string;second_user_id:string}&Record<string,unknown>>(`
    SELECT c.first_user_id,c.second_user_id FROM talks.human_dm_conversations c
    JOIN talks.human_dm_contact_requests cr
      ON cr.tenant_id=c.tenant_id AND cr.first_user_id=c.first_user_id
        AND cr.second_user_id=c.second_user_id AND cr.status='accepted'
        AND cr.revoked_by IS NULL
    JOIN identity.users a ON a.tenant_id=c.tenant_id AND a.user_id=c.first_user_id AND a.state='active'
    JOIN identity.users b ON b.tenant_id=c.tenant_id AND b.user_id=c.second_user_id AND b.state='active'
    WHERE c.tenant_id=$1 AND c.conversation_id=$2 AND $3 IN (c.first_user_id,c.second_user_id)
    AND NOT EXISTS(SELECT 1 FROM talks.safety_preferences s
      WHERE s.tenant_id=$1 AND s.blocked=true
        AND ((s.viewer_user_id=c.first_user_id AND s.subject_user_id=c.second_user_id)
          OR (s.viewer_user_id=c.second_user_id AND s.subject_user_id=c.first_user_id)))
    AND NOT EXISTS(SELECT 1 FROM talks.safety_enforcement s
      JOIN talks.public_profiles p ON p.tenant_id=s.tenant_id AND p.handle=s.target_id
      WHERE s.tenant_id=$1 AND s.target_kind='profile' AND s.visibility IN ('blocked','restricted')
        AND p.user_id IN (c.first_user_id,c.second_user_id))
    LIMIT 1`,[tenant,conversationId,actor]);
  return hit.rows[0]??null;
}
async function emit(q:SqlQuery,tenant:string,record:CallRow) {
  await q.query(`
    INSERT INTO talks.human_call_signal_outbox
      (tenant_id,call_id,recipient_user_id,event_type)
    VALUES($1,$2,$3,$5),($1,$2,$4,$5)`,[
    tenant,record.call_id,record.caller_user_id,record.callee_user_id,record.state,
  ]);
}
async function expire(q:SqlQuery,tenant:string) {
  const r=await q.query<CallRow>(`
    UPDATE talks.human_private_calls
    SET state=CASE WHEN state='ringing' THEN 'missed' ELSE 'ended' END,
        ended_at=clock_timestamp()
    WHERE tenant_id=$1 AND state IN ('ringing','active')
      AND expires_at <= clock_timestamp()
    RETURNING ${fields}`,[tenant]);
  for (const row of r.rows) await emit(q,tenant,row);
}
export function createPostgresHumanCallRepository(pool:HumanCallSqlPool):HumanCallRepository {
  return Object.freeze({
    async start({tenantId,actorId,conversationId,requestId,kind}) {
      return transaction(pool,async q=>{
        const pair=await allowed(q,tenantId,actorId,conversationId);
        if(!pair) return "not_allowed";
        const other=pair.first_user_id===actorId?pair.second_user_id:pair.first_user_id;
        if (!await lockUsers(q,tenantId,actorId,other)) return "not_allowed";
        // A revocation may race lock acquisition. Recheck under user locks.
        if (!await allowed(q,tenantId,actorId,conversationId)) return "not_allowed";
        await expire(q,tenantId);
        const prior=await q.query<CallRow>(`
          SELECT ${fields} FROM talks.human_private_calls
          WHERE tenant_id=$1 AND caller_user_id=$2 AND client_request_id=$3
          LIMIT 1`,[tenantId,actorId,requestId]);
        if(prior.rows.length) {
          const existing=prior.rows[0]!;
          if(existing.conversation_id!==conversationId || existing.kind!==kind) return "request_conflict";
          return view(existing);
        }
        const busy=await q.query<{call_id:string}&Record<string,unknown>>(`
          SELECT call_id FROM talks.human_private_calls
          WHERE tenant_id=$1 AND state IN ('ringing','active')
            AND (caller_user_id IN ($2,$3) OR callee_user_id IN ($2,$3))
          LIMIT 1`,[tenantId,actorId,other]);
        if(busy.rows.length) return "busy";
        const created=await q.query<CallRow>(`
          INSERT INTO talks.human_private_calls
            (tenant_id,conversation_id,caller_user_id,callee_user_id,client_request_id,kind)
          VALUES($1,$2,$3,$4,$5,$6) RETURNING ${fields}`,
          [tenantId,conversationId,actorId,other,requestId,kind]);
        const row=created.rows[0]!;
        await emit(q,tenantId,row);
        return view(row);
      });
    },
    async transition({tenantId,actorId,callId,action}) {
      return transaction(pool,async q=>{
        const found=await q.query<CallRow>(`
          SELECT ${fields} FROM talks.human_private_calls
          WHERE tenant_id=$1 AND call_id=$2 AND $3 IN(caller_user_id,callee_user_id)
          LIMIT 1`,[tenantId,callId,actorId]);
        const r=found.rows[0];
        if(!r || !await lockUsers(q,tenantId,r.caller_user_id,r.callee_user_id)) return null;
        if(!await allowed(q,tenantId,actorId,r.conversation_id)) return null;
        await expire(q,tenantId);
        const next=action==="accept"?"active":action==="decline"?"declined":"ended";
        const changed=await q.query<CallRow>(`
          UPDATE talks.human_private_calls
            SET state=$4,
                answered_at=CASE WHEN $4='active' THEN clock_timestamp() ELSE answered_at END,
                ended_at=CASE WHEN $4<>'active' THEN clock_timestamp() ELSE ended_at END,
                expires_at=CASE WHEN $4='active'
                  THEN clock_timestamp()+interval '2 hours' ELSE expires_at END
          WHERE tenant_id=$1 AND call_id=$2
            AND (($4='active' AND state='ringing' AND callee_user_id=$3)
              OR ($4='declined' AND state='ringing' AND callee_user_id=$3)
              OR ($4='ended' AND state IN ('ringing','active')
                  AND ($3=caller_user_id OR (state='active' AND $3=callee_user_id))))
            AND expires_at>clock_timestamp()
          RETURNING ${fields}`,[tenantId,callId,actorId,next]);
        const updated=changed.rows[0];
        if(!updated)return null;
        // End an unanswered outgoing call as cancelled, not as an answered call.
        if(action==="end"&&r.state==="ringing"){
          const cancelled=await q.query<CallRow>(`
            UPDATE talks.human_private_calls SET state='cancelled'
            WHERE tenant_id=$1 AND call_id=$2 AND state='ended'
            RETURNING ${fields}`,[tenantId,callId]);
          if(cancelled.rows[0]) {
            await emit(q,tenantId,cancelled.rows[0]!);
            return view(cancelled.rows[0]!);
          }
        }
        await emit(q,tenantId,updated);
        return view(updated);
      });
    },
    async get({tenantId,actorId,callId}) {
      return transaction(pool,async q=>{
        await expire(q,tenantId);
        const rows=await q.query<CallRow>(`
          SELECT ${fields} FROM talks.human_private_calls
          WHERE tenant_id=$1 AND call_id=$2 AND $3 IN(caller_user_id,callee_user_id)
          LIMIT 1`,[tenantId,callId,actorId]);
        return rows.rows[0]?view(rows.rows[0]):null;
      });
    },
    async recent({tenantId,actorId,limit}) {
      return transaction(pool,async q=>{
        await expire(q,tenantId);
        const rows=await q.query<CallRow>(`
          SELECT ${fields} FROM talks.human_private_calls
          WHERE tenant_id=$1 AND $2 IN(caller_user_id,callee_user_id)
          ORDER BY created_at DESC LIMIT $3`,[tenantId,actorId,limit]);
        return Object.freeze(rows.rows.map(view));
      });
    },
  });
}
