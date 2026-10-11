import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {RoomError,requireFan,validateIdempotencyKey} from "@masanawa/rooms";
import {validateDiscussionBody,validateDiscussionTarget,requireDiscussionModerator} from "@masanawa/rooms";
import type {DiscussionReply,DiscussionPage,DiscussionDecision,DiscussionTarget,DiscussionCursor} from "@masanawa/rooms";
import type {RoomActor} from "@masanawa/rooms/ports";
import {assertRoom,lookupRoom,requirePublishedEligible,requireMember} from "./repository.js";
const rid=(prefix:string)=>prefix+randomUUID();
const project=(r:any,a:RoomActor):DiscussionReply=>({
 replyId:r.reply_id,roomId:r.room_id,parentKind:r.lesson_id?"lesson":"question",
 parentId:r.lesson_id??r.question_id,parentReplyId:r.parent_reply_id??null,
 body:r.body,state:r.moderation_state,authoredByMe:r.user_id===a.userId,
 createdAt:r.sort_created_at??new Date(r.created_at).toISOString()
});
async function tx<T>(pool:Pool,run:(q:PoolClient)=>Promise<T>):Promise<T>{
 const q=await pool.connect();
 try{await q.query("BEGIN");const result=await run(q);await q.query("COMMIT");return result;}
 catch(e){await q.query("ROLLBACK");throw e;}finally{q.release();}
}
async function access(q:Pool|PoolClient,a:RoomActor,roomId:string,lock=false){
 assertRoom(roomId);requireFan(a.userId);
 const room=await lookupRoom(q,a.tenantId,roomId);
 await requirePublishedEligible(q,a,room);
 await requireMember(q,a,roomId,lock);
}
async function root(q:PoolClient,a:RoomActor,roomId:string,kind:DiscussionTarget,targetId:string){
 validateDiscussionTarget(kind,targetId);
 const table=kind==="lesson"?"rooms.lessons":"rooms.questions";
 const col=kind==="lesson"?"lesson_id":"question_id";
 const state=kind==="lesson"?"state='published' AND (publish_at IS NULL OR publish_at<=now())":
   "state<>'rejected'";
 const r=await q.query("SELECT 1 FROM "+table+" WHERE tenant_id=$1 AND room_id=$2 AND "+col+"=$3 AND "+state,
   [a.tenantId,roomId,targetId]);
 if(!r.rows.length)throw new RoomError(404,"discussion_target_not_found");
}
async function parent(q:PoolClient,a:RoomActor,roomId:string,id:string,kind:DiscussionTarget,targetId:string){
 const r=await q.query(
   "SELECT lesson_id,question_id,parent_reply_id FROM rooms.discussion_replies WHERE tenant_id=$1 AND room_id=$2 AND reply_id=$3 AND moderation_state='visible'",
   [a.tenantId,roomId,id]);
 if(!r.rows.length||r.rows[0].parent_reply_id ||
   (kind==="lesson"?r.rows[0].lesson_id!==targetId:r.rows[0].question_id!==targetId))
   throw new RoomError(422,"invalid_parent_reply");
}
export function createPgRoomDiscussionRepository(pool:Pool){
 return Object.freeze({
 async list(a:RoomActor,roomId:string,kind:DiscussionTarget,targetId:string,cursor:DiscussionCursor|null):Promise<DiscussionPage>{
   assertRoom(roomId);validateDiscussionTarget(kind,targetId);
   // All reads, including paginated/cached screens, re-check current paid entitlement.
   return tx(pool,async q=>{
     await access(q,a,roomId);await root(q,a,roomId,kind,targetId);
     const col=kind==="lesson"?"lesson_id":"question_id";
     const c=cursor;
     const r=await q.query(
       "SELECT *, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS sort_created_at FROM rooms.discussion_replies WHERE tenant_id=$1 AND room_id=$2 AND "+col+"=$3 "+
       "AND (moderation_state='visible' OR (user_id=$4 AND moderation_state='held')) "+
       "AND ($5::timestamptz IS NULL OR (created_at,reply_id)<($5::timestamptz,$6::text)) "+
       "ORDER BY created_at DESC,reply_id DESC LIMIT 51",
       [a.tenantId,roomId,targetId,a.userId,c?.before??null,c?.beforeId??null]);
     const items=r.rows.slice(0,50).map(x=>project(x,a));
     const last=items.at(-1);
     return {items,nextCursor:r.rows.length>50&&last?last.createdAt+"|"+last.replyId:null};
   });
 },
 async create(a:RoomActor,roomId:string,kind:DiscussionTarget,targetId:string,raw:string,key:string,parentReplyId:string|null):Promise<DiscussionReply>{
   const body=validateDiscussionBody(raw);validateIdempotencyKey(key);
   assertRoom(roomId);validateDiscussionTarget(kind,targetId);
   const userId=requireFan(a.userId);
   return tx(pool,async q=>{
     await access(q,a,roomId,true);await root(q,a,roomId,kind,targetId);
     if(parentReplyId)await parent(q,a,roomId,parentReplyId,kind,targetId);
     const previous=await q.query(
       "SELECT * FROM rooms.discussion_replies WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 AND idempotency_key=$4",
       [a.tenantId,roomId,userId,key]);
     if(previous.rows.length){
       const old=previous.rows[0];
       if(old.body!==body || (old.lesson_id??old.question_id)!==targetId ||
          (old.parent_reply_id??null)!==parentReplyId)throw new RoomError(409,"idempotency_conflict");
       return project(old,a);
     }
     const inserted=await q.query(
       "INSERT INTO rooms.discussion_replies(tenant_id,reply_id,room_id,user_id,question_id,lesson_id,parent_reply_id,body,idempotency_key) "+
       "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING *",
       [a.tenantId,rid("room-reply_"),roomId,userId,kind==="question"?targetId:null,
        kind==="lesson"?targetId:null,parentReplyId,body,key]);
     if(!inserted.rows.length){
       const raced=await q.query(
         "SELECT * FROM rooms.discussion_replies WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 AND idempotency_key=$4",
         [a.tenantId,roomId,userId,key]);
       if(!raced.rows.length)throw new RoomError(409,"discussion_conflict");
       const old=raced.rows[0];
       if(old.body!==body || (old.lesson_id??old.question_id)!==targetId ||
         (old.parent_reply_id??null)!==parentReplyId)throw new RoomError(409,"idempotency_conflict");
       return project(old,a);
     }
     const result=project(inserted.rows[0],a);
     await q.query(
       "INSERT INTO events.audit_events(audit_event_id,tenant_id,event_type,schema_version,aggregate_type,aggregate_id,occurred_at,actor,correlation_id,sensitivity,payload) "+
       "VALUES($1,$2,'rooms.discussion.submitted',1,'room_discussion',$3,now(),jsonb_build_object('userId',$4),$5,'internal','{}'::jsonb)",
       [rid("audit-event_"),a.tenantId,result.replyId,userId,rid("correlation_")]);
     return result;
   });
 },
 async staffQueue(a:RoomActor):Promise<DiscussionReply[]>{
   requireDiscussionModerator(a.roles);
   const r=await pool.query(
     "SELECT * FROM rooms.discussion_replies WHERE tenant_id=$1 AND moderation_state='held' "+
     "ORDER BY created_at ASC,reply_id ASC LIMIT 100",[a.tenantId]);
   return r.rows.map(x=>project(x,a));
 },
 async decide(a:RoomActor,replyId:string,decision:DiscussionDecision):Promise<void>{
   requireDiscussionModerator(a.roles);const userId=requireFan(a.userId);
   if(!/^room-reply_[A-Za-z0-9_-]{8,120}$/.test(replyId))throw new RoomError(422,"invalid_reply_id");
   if(!["approve","hide","remove"].includes(decision))throw new RoomError(422,"invalid_decision");
   await tx(pool,async q=>{
     const r=await q.query(
       "SELECT * FROM rooms.discussion_replies WHERE tenant_id=$1 AND reply_id=$2 FOR UPDATE",
       [a.tenantId,replyId]);
     if(!r.rows.length)throw new RoomError(404,"discussion_reply_not_found");
     const old=r.rows[0];
     if(!["held","visible"].includes(old.moderation_state) ||
       (decision==="approve"&&old.moderation_state!=="held"))
       throw new RoomError(409,"discussion_review_conflict");
     const next=decision==="approve"?"visible":decision==="hide"?"hidden":"removed";
     await q.query(
       "UPDATE rooms.discussion_replies SET moderation_state=$3,reviewed_by=$4,reviewed_at=now() "+
       "WHERE tenant_id=$1 AND reply_id=$2",[a.tenantId,replyId,next,userId]);
     await q.query(
       "INSERT INTO events.audit_events(audit_event_id,tenant_id,event_type,schema_version,aggregate_type,aggregate_id,occurred_at,actor,correlation_id,sensitivity,payload) "+
       "VALUES($1,$2,'rooms.discussion.reviewed',1,'room_discussion',$3,now(),jsonb_build_object('userId',$4),$5,'internal',jsonb_build_object('decision',$6))",
       [rid("audit-event_"),a.tenantId,replyId,userId,rid("correlation_"),decision]);
     if(next!=="visible")return;
     const recipient=old.parent_reply_id
       ?await q.query("SELECT user_id FROM rooms.discussion_replies WHERE tenant_id=$1 AND room_id=$2 AND reply_id=$3",
           [a.tenantId,old.room_id,old.parent_reply_id])
       :old.question_id
       ?await q.query("SELECT user_id FROM rooms.questions WHERE tenant_id=$1 AND room_id=$2 AND question_id=$3",
           [a.tenantId,old.room_id,old.question_id])
       :null;
     const to=recipient?.rows[0]?.user_id;
     if(!to||to===old.user_id)return;
     await q.query(
       "INSERT INTO events.outbox(outbox_event_id,tenant_id,event_id,event_type,schema_version,aggregate_type,aggregate_id,correlation_id,destination,payload) "+
       "VALUES($1,$2,$3,'rooms.discussion.approved',1,'room_discussion',$4,$5,'notifications.room_discussion', "+
       "jsonb_build_object('recipientUserId',$6,'senderUserId',$7,'roomId',$8,'replyId',$4))",
       [rid("outbox-event_"),a.tenantId,rid("event_"),replyId,rid("correlation_"),to,old.user_id,old.room_id]);
   });
 }
 });
}
