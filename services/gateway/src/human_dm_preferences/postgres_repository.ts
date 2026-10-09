import type { HumanDmPreferenceRepository,HumanDmIdentity } from "./service.js";
import type { DmNotificationPreference } from "./policy.js";
interface Result<T>{readonly rows:T[];readonly rowCount:number|null}
interface Query{query<T extends Record<string,unknown>=Record<string,unknown>>(sql:string,params?:readonly unknown[]):Promise<Result<T>>}
interface Client extends Query{release():void}
export interface DmPreferencePool extends Query{connect():Promise<Client>}
interface PrefRow extends Record<string,unknown>{
  version:number;mute_forever:boolean;muted_until:Date|string|null;preview_mode:"hidden"|"generic"
}
function value(row:PrefRow|undefined,conversationId:string):DmNotificationPreference{
  const expiry=row?.muted_until?new Date(row.muted_until).toISOString():null;
  return {conversationId,version:row?.version??0,muteMode:row?.mute_forever?"forever":expiry?"until":"off",mutedUntil:expiry,preview:row?.preview_mode??"hidden"};
}
/** C02 authorization: active participants, C01 consent, reciprocal R15 block/safety. */
const memberSql=`
 SELECT c.conversation_id FROM talks.human_dm_conversations c
 JOIN identity.users me ON me.tenant_id=c.tenant_id AND me.user_id=$2 AND me.state='active'
 JOIN identity.users peer ON peer.tenant_id=c.tenant_id AND peer.user_id=CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END AND peer.state='active'
 WHERE c.tenant_id=$1 AND c.conversation_id=$3::uuid
 AND $2 IN(c.first_user_id,c.second_user_id)
 AND NOT EXISTS(SELECT 1 FROM talks.human_dm_contact_requests r WHERE
   r.tenant_id=c.tenant_id AND r.first_user_id=c.first_user_id AND r.second_user_id=c.second_user_id AND r.status='declined')
 AND NOT EXISTS(SELECT 1 FROM talks.safety_preferences p WHERE p.tenant_id=c.tenant_id AND p.blocked=true
   AND ((p.viewer_user_id=c.first_user_id AND p.subject_user_id=c.second_user_id) OR
        (p.viewer_user_id=c.second_user_id AND p.subject_user_id=c.first_user_id)))
 AND NOT EXISTS(SELECT 1 FROM talks.safety_enforcement se
   JOIN talks.public_profiles pp ON pp.tenant_id=se.tenant_id AND pp.handle=se.target_id
   WHERE se.tenant_id=c.tenant_id AND se.target_kind='profile' AND se.visibility IN('restricted','blocked')
   AND pp.user_id IN(c.first_user_id,c.second_user_id))`;
const eligibleConversationsSql=memberSql.replace(" AND c.conversation_id=$3::uuid","");
const readSql=`SELECT version,mute_forever,muted_until,preview_mode FROM talks.human_dm_notification_preferences
 WHERE tenant_id=$1 AND user_id=$2 AND conversation_id=$3::uuid`;
async function authorized(q:Query,scope:HumanDmIdentity&{conversationId:string},lock:boolean):Promise<boolean>{
 const rows=await q.query(memberSql+(lock?" FOR UPDATE OF c":""),[scope.tenantId,scope.userId,scope.conversationId]);
 return rows.rows.length===1;
}
export function createPostgresDmPreferenceRepository(pool:DmPreferencePool):HumanDmPreferenceRepository{
 const repo:HumanDmPreferenceRepository={
  async get(scope){
   if(!await authorized(pool,scope,false))return null;
   const r=await pool.query<PrefRow>(readSql,[scope.tenantId,scope.userId,scope.conversationId]);
   if(!await authorized(pool,scope,false))return null;
   return value(r.rows[0],scope.conversationId);
  },
  async set(scope){
   const c=await pool.connect();
   try{
    await c.query("BEGIN");
    // Serializes first-time insert and CAS writers on the canonical conversation row.
    if(!await authorized(c,scope,true)){await c.query("ROLLBACK");return null;}
    const old=await c.query<PrefRow>(readSql,[scope.tenantId,scope.userId,scope.conversationId]);
    const current=old.rows[0]?.version??0;
    if(current!==scope.change.expectedVersion){await c.query("ROLLBACK");return "conflict";}
    const r=await c.query<PrefRow>(`
      INSERT INTO talks.human_dm_notification_preferences
        (tenant_id,user_id,conversation_id,version,mute_forever,muted_until,preview_mode)
      VALUES($1,$2,$3::uuid,$4,$5,$6::timestamptz,$7)
      ON CONFLICT(tenant_id,user_id,conversation_id) DO UPDATE SET
        version=EXCLUDED.version,mute_forever=EXCLUDED.mute_forever,
        muted_until=EXCLUDED.muted_until,preview_mode=EXCLUDED.preview_mode,updated_at=clock_timestamp()
      WHERE talks.human_dm_notification_preferences.version=$8
      RETURNING version,mute_forever,muted_until,preview_mode`,[
      scope.tenantId,scope.userId,scope.conversationId,current+1,
      scope.change.muteMode==="forever",scope.change.muteMode==="until"?scope.change.mutedUntil:null,
      scope.change.preview,current]);
    if(!r.rows[0]){await c.query("ROLLBACK");return "conflict";}
    await c.query("COMMIT");return value(r.rows[0],scope.conversationId);
   }catch(err){try{await c.query("ROLLBACK");}catch{/* preserve cause */}throw err;}
   finally{c.release();}
  },
  async unreadCount({tenantId,userId}){
   // Never subtract globally allocated bigint sequences as if contiguous per thread.
   const rows=await pool.query<{unread_count:string}&Record<string,unknown>>(`
     WITH eligible AS (${eligibleConversationsSql})
     SELECT COUNT(*)::text AS unread_count FROM eligible c
     JOIN talks.human_dm_messages m ON m.tenant_id=$1 AND m.conversation_id=c.conversation_id
     LEFT JOIN talks.human_dm_reads r ON r.tenant_id=$1 AND r.user_id=$2 AND r.conversation_id=c.conversation_id
     WHERE m.sender_user_id<>$2 AND m.deleted_at IS NULL
       AND m.sequence>COALESCE(r.last_read_sequence,0)`,[tenantId,userId]);
   return String(rows.rows[0]?.unread_count??"0");
  },
  async eligibleEvent({tenantId,userId,event}){
   const scope={tenantId,userId,conversationId:event.conversationId};
   if(!await authorized(pool,scope,false))return null;
   const match=await pool.query<Record<string,unknown>>(`
     SELECT 1 FROM talks.human_dm_events e
     JOIN talks.human_dm_messages m ON m.tenant_id=e.tenant_id
       AND m.conversation_id=e.conversation_id AND m.message_id=e.message_id
     LEFT JOIN talks.human_dm_reads r ON r.tenant_id=m.tenant_id AND r.conversation_id=m.conversation_id AND r.user_id=$2
     WHERE e.tenant_id=$1 AND e.recipient_user_id=$2 AND e.conversation_id=$3::uuid
       AND e.event_id=$4::bigint AND e.kind='message_added'
       AND e.actor_user_id=$5 AND e.message_id=$6::uuid
       AND m.sender_user_id=$5 AND m.deleted_at IS NULL AND m.sequence>COALESCE(r.last_read_sequence,0)
     LIMIT 1`,[tenantId,userId,event.conversationId,event.eventId,event.actorUserId,event.messageId]);
   if(!match.rows.length||!await authorized(pool,scope,false))return null;
   const current=await pool.query<PrefRow>(readSql,[tenantId,userId,event.conversationId]);
   if(!await authorized(pool,scope,false))return null;
   return value(current.rows[0],event.conversationId);
  },
  async reserveHint({tenantId,userId,event}){
   // Atomic permit+claim. Duplicate events/worker restarts get zero rows and no push.
   const rows=await pool.query<Record<string,unknown>>(`
     WITH permitted AS (${memberSql})
     INSERT INTO talks.human_dm_notification_claims
       (tenant_id,recipient_user_id,event_id,conversation_id)
     SELECT e.tenant_id,$2,e.event_id,e.conversation_id
     FROM permitted c
     JOIN talks.human_dm_events e ON e.tenant_id=$1 AND e.recipient_user_id=$2
       AND e.conversation_id=c.conversation_id AND e.event_id=$4::bigint
       AND e.kind='message_added' AND e.actor_user_id=$5 AND e.message_id=$6::uuid
     JOIN talks.human_dm_messages m ON m.tenant_id=e.tenant_id
       AND m.conversation_id=e.conversation_id AND m.message_id=e.message_id
       AND m.sender_user_id=$5 AND m.deleted_at IS NULL
     LEFT JOIN talks.human_dm_reads r ON r.tenant_id=$1 AND r.user_id=$2 AND r.conversation_id=c.conversation_id
     LEFT JOIN talks.human_dm_notification_preferences p ON p.tenant_id=$1
       AND p.user_id=$2 AND p.conversation_id=c.conversation_id
     WHERE m.sequence>COALESCE(r.last_read_sequence,0) AND COALESCE(p.mute_forever,false)=false
       AND (p.muted_until IS NULL OR p.muted_until<=clock_timestamp())
     ON CONFLICT (tenant_id,recipient_user_id,event_id) DO NOTHING
     RETURNING event_id`,[tenantId,userId,event.conversationId,event.eventId,event.actorUserId,event.messageId]);
   return rows.rows.length===1;
  },
 };
 return Object.freeze(repo);
}
