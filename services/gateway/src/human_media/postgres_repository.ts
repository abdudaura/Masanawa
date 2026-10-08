import type { VoiceNote, VoiceNoteRepository, VoiceStaged } from "./model.js";

type Result<T> = {readonly rows:T[];readonly rowCount:number|null};
interface Query { query<T extends Record<string,unknown>=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<Result<T>> }
interface Client extends Query {release():void}
export interface VoiceSqlPool extends Query {connect():Promise<Client>}
const iso=(v:string|Date)=>new Date(v).toISOString();

/** Exactly the same C01/C02 human eligibility boundaries, re-evaluated on EVERY read
 * and again within the send transaction. The contact screen cache proves nothing.
 * SQL caller always binds $1=tenant, $2=verified user, $3=conversation.
 */
const eligible = `
 c.tenant_id=$1 AND c.conversation_id=$3
 AND $2 IN (c.first_user_id,c.second_user_id)
 AND EXISTS (SELECT 1 FROM identity.users me WHERE me.tenant_id=$1
   AND me.user_id=$2 AND me.state='active')
 AND EXISTS (SELECT 1 FROM identity.users peer WHERE peer.tenant_id=$1
   AND peer.user_id=CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END
   AND peer.state='active')
 AND COALESCE((SELECT req.status FROM talks.human_dm_contact_requests req
    WHERE req.tenant_id=$1 AND req.first_user_id=c.first_user_id
      AND req.second_user_id=c.second_user_id),'none')<>'declined'
 AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences sp WHERE sp.tenant_id=$1
   AND sp.blocked=true AND
   ((sp.viewer_user_id=c.first_user_id AND sp.subject_user_id=c.second_user_id)
    OR (sp.viewer_user_id=c.second_user_id AND sp.subject_user_id=c.first_user_id)))
 AND NOT EXISTS (SELECT 1 FROM talks.safety_enforcement s
   JOIN talks.public_profiles p ON p.tenant_id=s.tenant_id AND p.handle=s.target_id
   WHERE s.tenant_id=$1 AND s.target_kind='profile'
     AND s.visibility IN ('restricted','blocked')
     AND p.user_id IN (c.first_user_id,c.second_user_id))
`;
const eligibleByMessage=eligible.replace("c.conversation_id=$3","c.conversation_id=m.conversation_id");
const consent = `
 AND COALESCE((SELECT e.status FROM talks.human_dm_contact_requests e
   WHERE e.tenant_id=$1 AND e.first_user_id=c.first_user_id
   AND e.second_user_id=c.second_user_id),'none')<>'declined'
 AND (
  EXISTS (SELECT 1 FROM talks.human_dm_contact_requests e
   WHERE e.tenant_id=$1 AND e.first_user_id=c.first_user_id
    AND e.second_user_id=c.second_user_id AND e.status='accepted')
  OR COALESCE((SELECT p.admission_policy FROM talks.human_dm_preferences p
   WHERE p.tenant_id=$1 AND p.user_id=
    CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END),'requests')='anyone'
  OR (COALESCE((SELECT p.admission_policy FROM talks.human_dm_preferences p
   WHERE p.tenant_id=$1 AND p.user_id=
    CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END),'requests')<>'nobody'
   AND EXISTS (SELECT 1 FROM talks.human_dm_messages prior
    WHERE prior.tenant_id=$1 AND prior.conversation_id=c.conversation_id
     AND prior.sender_user_id<>$2))
 )
`;
interface AudioRow extends Record<string,unknown> {
 message_id:string;conversation_id:string;sequence:string|number;sender_user_id:string;
 client_request_id:string;duration_ms:number;size_bytes:number;
 created_at:string|Date;deleted_at:string|Date|null;object_key:string;sha256:string;
}
const projection=`m.message_id,m.conversation_id,m.sequence,m.sender_user_id,
 m.client_request_id,a.duration_ms,a.size_bytes,m.created_at,m.deleted_at,a.object_key,a.sha256`;
function toVoice(row:AudioRow):VoiceNote {
 return Object.freeze({
  messageId:row.message_id,conversationId:row.conversation_id,
  sequence:String(row.sequence),senderUserId:row.sender_user_id,
  clientRequestId:row.client_request_id,durationMs:row.duration_ms,
  sizeBytes:row.size_bytes,mimeType:"audio/ogg" as const,
  createdAt:iso(row.created_at),deletedAt:row.deleted_at?iso(row.deleted_at):null,
 });
}
async function trx<T>(pool:VoiceSqlPool,fn:(q:Client)=>Promise<T>):Promise<T> {
 const q=await pool.connect();
 try{
  await q.query("BEGIN");
  const value=await fn(q);
  await q.query("COMMIT");
  return value;
 }catch(e){try{await q.query("ROLLBACK")}catch{/* preserve original */}throw e}
 finally{q.release()}
}
async function lockAndAuthorize(q:Query,owner:VoiceStaged["owner"],conv:string,send:boolean):Promise<boolean> {
 const pair=await q.query<{first_user_id:string;second_user_id:string}&Record<string,unknown>>(
  `SELECT first_user_id,second_user_id FROM talks.human_dm_conversations
   WHERE tenant_id=$1 AND conversation_id=$2
    AND $3 IN(first_user_id,second_user_id)`,[owner.tenantId,conv,owner.userId]);
 const found=pair.rows[0];
 if(!found)return false;
 // User locks coordinate C02 concurrent send and account-disable paths.
 await q.query(`SELECT user_id FROM identity.users WHERE tenant_id=$1
   AND user_id IN($2,$3) ORDER BY user_id FOR UPDATE`,
   [owner.tenantId,found.first_user_id,found.second_user_id]);
 const ok=await q.query<{conversation_id:string}&Record<string,unknown>>(
  `SELECT c.conversation_id FROM talks.human_dm_conversations c
   WHERE ${eligible} ${send?consent:""} FOR UPDATE OF c`,
   [owner.tenantId,owner.userId,conv]);
 return ok.rows.length===1;
}
export function createPostgresVoiceNoteRepository(pool:VoiceSqlPool):VoiceNoteRepository {
 return Object.freeze<VoiceNoteRepository>({
  async stage(input) {
   return trx(pool,async q=>{
    if(!(await lockAndAuthorize(q,input.owner,input.conversationId,true)))return "forbidden" as const;
    const old=await q.query<{
     object_key:string;sha256:string;size_bytes:number;duration_ms:number;state:string;
    }&Record<string,unknown>>(
     `SELECT object_key,sha256,size_bytes,duration_ms,state
      FROM talks.human_dm_voice_objects WHERE tenant_id=$1 AND conversation_id=$2
      AND uploader_user_id=$3 AND client_request_id=$4 FOR UPDATE`,
     [input.owner.tenantId,input.conversationId,input.owner.userId,input.clientRequestId]);
    if(old.rows[0]){
      const r=old.rows[0];
      if(r.sha256!==input.sha256||r.size_bytes!==input.sizeBytes||
       r.duration_ms!==input.durationMs||r.state==="deleting"||r.state==="orphaned")
       return "conflict" as const;
      return {...input,objectKey:r.object_key};
    }
    const used=await q.query<Record<string,unknown>>(
      `SELECT 1 FROM talks.human_dm_messages WHERE tenant_id=$1
       AND conversation_id=$2 AND sender_user_id=$3 AND client_request_id=$4`,
      [input.owner.tenantId,input.conversationId,input.owner.userId,input.clientRequestId]);
    if(used.rows.length)return "conflict" as const;
    await q.query(
     `INSERT INTO talks.human_dm_voice_objects
      (tenant_id,conversation_id,uploader_user_id,client_request_id,
        object_key,sha256,size_bytes,duration_ms)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.owner.tenantId,input.conversationId,input.owner.userId,input.clientRequestId,
       input.objectKey,input.sha256,input.sizeBytes,input.durationMs]);
    return input;
   });
  },
  async attach(input) {
   return trx(pool,async q=>{
    if(!(await lockAndAuthorize(q,input.owner,input.conversationId,true)))
      return "forbidden" as const;
    const rows=await q.query<{
     state:string;message_id:string|null;sha256:string;size_bytes:number;duration_ms:number;
    }&Record<string,unknown>>(
      `SELECT state,message_id,sha256,size_bytes,duration_ms FROM talks.human_dm_voice_objects
       WHERE tenant_id=$1 AND conversation_id=$2 AND uploader_user_id=$3
         AND client_request_id=$4 AND object_key=$5 FOR UPDATE`,
      [input.owner.tenantId,input.conversationId,input.owner.userId,input.clientRequestId,input.objectKey]);
    const saved=rows.rows[0];
    if(!saved||saved.sha256!==input.sha256||
       saved.size_bytes!==input.sizeBytes||saved.duration_ms!==input.durationMs)
      return "conflict" as const;
    if(saved.state==="attached"&&saved.message_id){
      const present=await q.query<AudioRow>(
       `SELECT ${projection} FROM talks.human_dm_messages m
        JOIN talks.human_dm_voice_objects a ON a.tenant_id=m.tenant_id
          AND a.message_id=m.message_id WHERE m.tenant_id=$1
           AND m.message_id=$2 AND m.deleted_at IS NULL`,
       [input.owner.tenantId,saved.message_id]);
      return present.rows[0]?toVoice(present.rows[0]):"forbidden" as const;
    }
    if(saved.state!=="staged")return "conflict" as const;
    // The shared C02 text path might have used this owner/request ID
    // after C04 staged bytes but before attachment. Refuse cross-kind
    // replay deterministically, before hitting the unique SQL constraint.
    const used=await q.query<Record<string,unknown>>(
      `SELECT 1 FROM talks.human_dm_messages
        WHERE tenant_id=$1 AND conversation_id=$2
          AND sender_user_id=$3 AND client_request_id=$4`,
      [input.owner.tenantId,input.conversationId,input.owner.userId,input.clientRequestId]);
    if(used.rows.length)return "conflict" as const;
    const rate=await q.query<{count:string}&Record<string,unknown>>(
     `SELECT count(*)::text AS count FROM talks.human_dm_messages
      WHERE tenant_id=$1 AND sender_user_id=$2
        AND created_at>clock_timestamp()-interval '60 seconds'`,
      [input.owner.tenantId,input.owner.userId]);
    if(Number(rate.rows[0]?.count??0)>=30)return "rate_limited" as const;
    const inserted=await q.query<{
      message_id:string;sequence:string|number;
    }&Record<string,unknown>>(
      `INSERT INTO talks.human_dm_messages
       (tenant_id,conversation_id,sender_user_id,client_request_id,original_sha256,
        body,message_kind) VALUES($1,$2,$3,$4,$5,NULL,'voice')
       RETURNING message_id,sequence`,
      [input.owner.tenantId,input.conversationId,input.owner.userId,
       input.clientRequestId,input.sha256]);
    const msg=inserted.rows[0]!;
    await q.query(
      `UPDATE talks.human_dm_voice_objects SET state='attached',
        message_id=$5,updated_at=clock_timestamp()
       WHERE tenant_id=$1 AND conversation_id=$2 AND uploader_user_id=$3
        AND client_request_id=$4 AND state='staged'`,
      [input.owner.tenantId,input.conversationId,input.owner.userId,
       input.clientRequestId,msg.message_id]);
    await q.query(
      `UPDATE talks.human_dm_conversations
        SET last_sequence=$3,updated_at=clock_timestamp()
       WHERE tenant_id=$1 AND conversation_id=$2`,
      [input.owner.tenantId,input.conversationId,String(msg.sequence)]);
    const result=await q.query<AudioRow>(
     `SELECT ${projection} FROM talks.human_dm_messages m
      JOIN talks.human_dm_voice_objects a ON a.tenant_id=m.tenant_id
        AND a.message_id=m.message_id
      WHERE m.tenant_id=$1 AND m.message_id=$2`,
      [input.owner.tenantId,msg.message_id]);
    return toVoice(result.rows[0]!);
   });
  },
  async find({tenantId,userId,messageId}) {
    const r=await pool.query<AudioRow>(
     `SELECT ${projection} FROM talks.human_dm_messages m
      JOIN talks.human_dm_voice_objects a ON a.tenant_id=m.tenant_id
       AND a.message_id=m.message_id AND a.state='attached'
      JOIN talks.human_dm_conversations c ON c.tenant_id=m.tenant_id
       AND c.conversation_id=m.conversation_id
      WHERE ${eligibleByMessage} AND m.message_id=$3 AND m.deleted_at IS NULL`,
      [tenantId,userId,messageId]);
    // Membership is bound to the message conversation, never a caller-supplied ID.
    return r.rows[0]?{...toVoice(r.rows[0]),objectKey:r.rows[0].object_key,sha256:r.rows[0].sha256}:null;
  },
  async list({tenantId,userId,conversationId,limit,before}) {
    const access=await pool.query<Record<string,unknown>>(
      `SELECT 1 FROM talks.human_dm_conversations c WHERE ${eligible}`,
      [tenantId,userId,conversationId]);
    if(!access.rows.length)return null;
    const rows=await pool.query<AudioRow>(
     `SELECT ${projection} FROM talks.human_dm_messages m
      JOIN talks.human_dm_voice_objects a ON a.tenant_id=m.tenant_id
        AND a.message_id=m.message_id AND a.state='attached'
      JOIN talks.human_dm_conversations c ON c.tenant_id=m.tenant_id
        AND c.conversation_id=m.conversation_id
      WHERE ${eligible} AND m.deleted_at IS NULL
       AND ($4::bigint IS NULL OR m.sequence<$4::bigint)
      ORDER BY m.sequence DESC LIMIT $5`,
      [tenantId,userId,conversationId,before??null,limit]);
    return rows.rows.map(toVoice);
  },
  async remove({tenantId,userId,messageId}) {
    return trx(pool,async q=>{
      const message=await q.query<{conversation_id:string}&Record<string,unknown>>(
       `SELECT conversation_id FROM talks.human_dm_messages
        WHERE tenant_id=$1 AND message_id=$2 AND sender_user_id=$3`,
       [tenantId,messageId,userId]);
      const conversationId=message.rows[0]?.conversation_id;
      if(!conversationId||!(await lockAndAuthorize(q,{tenantId,userId},conversationId,false)))return false;
      const removed=await q.query<Record<string,unknown>>(
       `UPDATE talks.human_dm_messages SET body=NULL,deleted_at=clock_timestamp()
        WHERE tenant_id=$1 AND message_id=$2 AND sender_user_id=$3
         AND message_kind='voice' AND deleted_at IS NULL RETURNING message_id`,
       [tenantId,messageId,userId]);
      if(!removed.rows.length)return false;
      await q.query(
       `UPDATE talks.human_dm_voice_objects SET state='orphaned',updated_at=clock_timestamp()
        WHERE tenant_id=$1 AND message_id=$2 AND uploader_user_id=$3`,
       [tenantId,messageId,userId]);
      return true;
    });
  },
  async stale(limit) {
    const r=await pool.query<{object_key:string}&Record<string,unknown>>(
      `WITH victims AS (
         SELECT a.object_key FROM talks.human_dm_voice_objects a
          LEFT JOIN talks.human_dm_messages m ON m.tenant_id=a.tenant_id AND m.message_id=a.message_id
          WHERE a.state='orphaned'
            OR (a.state='staged' AND a.created_at<clock_timestamp()-interval '1 hour')
            OR (a.state='deleting' AND a.updated_at<clock_timestamp()-interval '15 minutes')
            OR (a.state='attached' AND (m.message_id IS NULL OR m.deleted_at IS NOT NULL))
          ORDER BY a.created_at FOR UPDATE OF a SKIP LOCKED LIMIT $1
       ) UPDATE talks.human_dm_voice_objects a
          SET state='deleting',updated_at=clock_timestamp()
          FROM victims WHERE victims.object_key=a.object_key RETURNING a.object_key`,[limit]);
    return r.rows.map(x=>({objectKey:x.object_key}));
  },
  async deleted(objectKey,success) {
    if(success) {
      // Only the caller that actually received successful S3 DELETE may mark
      // erasure. The marker and removal commit together: a DB crash or rollback
      // leaves the original reference and a safely retryable object DELETE.
      await trx(pool,async q=>{
        await q.query(
          `UPDATE talks.human_dm_voice_objects SET storage_erased_at=clock_timestamp()
            WHERE object_key=$1 AND state='deleting'`,[objectKey]);
        await q.query(
          `DELETE FROM talks.human_dm_voice_objects
            WHERE object_key=$1 AND state='deleting' AND storage_erased_at IS NOT NULL`,
          [objectKey]);
      });
    } else {
      await pool.query(
        `UPDATE talks.human_dm_voice_objects SET state='orphaned',
           updated_at=clock_timestamp(),attempts=attempts+1
         WHERE object_key=$1 AND state='deleting'`,[objectKey]);
    }
  }
 });
}
