import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {RoomError,validateQuestion,validateIdempotencyKey,requireFan,requireRoomStaff} from "@masanawa/rooms";
import type {RoomActor,RoomsRepository} from "@masanawa/rooms";
import type {RoomPreview,RoomQuestion} from "@masanawa/rooms";
export type Queryable=Pick<PoolClient,"query">;
const newId=(prefix:string)=>prefix+randomUUID();
const uuidRoom=(id:string)=>/^room_[a-zA-Z0-9_-]{3,100}$/.test(id);
export const assertRoom=(id:string)=>{if(!uuidRoom(id))throw new RoomError(422,"invalid_room");};
const parsePreview=(r:any):RoomPreview=>({
 roomId:r.room_id,slug:r.slug,professionTitle:r.profession_title,
 teacherCharacterId:r.teacher_character_id,language:r.language,
 planMode:r.plan_mode,state:r.state,memberCount:Number(r.member_count||0),
 joined:r.joined===true
});
const parseQuestion=(r:any):RoomQuestion=>({
 questionId:r.question_id,roomId:r.room_id,body:r.body,state:r.state,
 queuedAt:new Date(r.queued_at).toISOString(),answer:r.answer||null
});
async function transaction<T>(pool:Pool, fn:(client:PoolClient)=>Promise<T>):Promise<T>{
 const client=await pool.connect();try{
   await client.query("BEGIN");const result=await fn(client);await client.query("COMMIT");return result;
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
export async function lookupRoom(q:Queryable,tenantId:string,id:string,lock=false){
 const r=await q.query("SELECT * FROM rooms.rooms WHERE tenant_id=$1 AND room_id=$2"+(lock?" FOR UPDATE":""),[tenantId,id]);
 if(!r.rows.length)throw new RoomError(404,"room_not_found");
 return r.rows[0];
}
/** Every restricted paid read/join rechecks the server-verified, unexpired Play entitlement. */
export async function requirePublishedEligible(q:Queryable,a:RoomActor,row:any):Promise<void>{
 if(row.state!=="published")throw new RoomError(404,"room_not_found");
 if(row.plan_mode==="free")return;
 if(row.plan_mode!=="paid")throw new RoomError(403,"room_plan_invalid");
 const userId=requireFan(a.userId);
 const verified=await q.query(`SELECT 1 FROM rooms.entitlements
   WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3
   AND state IN ('active','grace') AND period_end>now()`,
   [a.tenantId,row.room_id,userId]);
 if(!verified.rows.length)throw new RoomError(403,"subscription_not_verified");
}
export async function requireMember(q:Queryable,a:RoomActor,id:string,lock=false){
 const u=requireFan(a.userId);
 const r=await q.query("SELECT state FROM rooms.memberships WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3"+(lock?" FOR UPDATE":""),[a.tenantId,id,u]);
 if(!r.rows.length||r.rows[0].state!=="active")throw new RoomError(403,"room_membership_required");
}
export function createPgRoomsRepository(pool:Pool):RoomsRepository {
 return {
 async list(a,filters){
   const search=(filters.search||"").trim().slice(0,100);
   const r=await pool.query(
    `SELECT r.*, (SELECT count(*) FROM rooms.memberships m WHERE m.tenant_id=r.tenant_id AND m.room_id=r.room_id AND m.state='active') AS member_count,
    EXISTS(SELECT 1 FROM rooms.memberships m WHERE m.tenant_id=r.tenant_id AND m.room_id=r.room_id AND m.user_id=$2 AND m.state='active') AS joined
    FROM rooms.rooms r WHERE r.tenant_id=$1 AND r.state='published'
    AND ($3::text='' OR r.profession_title ILIKE '%' || $3 || '%')
    AND ($4::text='' OR r.language=$4)
    AND ($5::boolean=false OR EXISTS(SELECT 1 FROM rooms.memberships m WHERE m.tenant_id=r.tenant_id AND m.room_id=r.room_id AND m.user_id=$2 AND m.state='active'))
    ORDER BY r.profession_title,r.room_id LIMIT 100`,
    [a.tenantId,a.userId,search,filters.language||"",filters.joined===true]);
   return r.rows.map(parsePreview);
 },
 async get(a,id){
   assertRoom(id);
   const r=await pool.query(`SELECT r.*,
    (SELECT count(*) FROM rooms.memberships m WHERE m.tenant_id=r.tenant_id AND m.room_id=r.room_id AND m.state='active') AS member_count,
    EXISTS(SELECT 1 FROM rooms.memberships m WHERE m.tenant_id=r.tenant_id AND m.room_id=r.room_id AND m.user_id=$3 AND m.state='active') AS joined
    FROM rooms.rooms r WHERE r.tenant_id=$1 AND r.room_id=$2 AND r.state='published'`,
    [a.tenantId,id,a.userId]);
   return r.rows.length?parsePreview(r.rows[0]):null;
 },
 async staffRooms(a){
   requireRoomStaff(a.roles);
   const r=await pool.query("SELECT * FROM rooms.rooms WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100",[a.tenantId]);
   return r.rows.map(parsePreview);
 },
 async staffRoom(a,id){
   requireRoomStaff(a.roles);assertRoom(id);
   const r=await pool.query("SELECT * FROM rooms.rooms WHERE tenant_id=$1 AND room_id=$2",[a.tenantId,id]);
   return r.rows.length?parsePreview(r.rows[0]):null;
 },
 async create(a,input){
   requireRoomStaff(a.roles);
   if(!/^[a-z0-9-]{3,90}$/.test(input.slug)||input.title.trim().length<3||input.title.length>140)
     throw new RoomError(422,"invalid_room");
   if(input.title.trim().toLowerCase()===input.teacherCharacterId.trim().toLowerCase())
     throw new RoomError(422,"profession_title_required");
   const id=newId("room_");
   await pool.query(`INSERT INTO rooms.rooms
    (tenant_id,room_id,slug,profession_title,teacher_character_id,language)
    SELECT $1,$2,$3,$4,c.character_id,$6 FROM identity.characters c
    WHERE c.tenant_id=$1 AND c.character_id=$5 AND c.state='active'`,
    [a.tenantId,id,input.slug,input.title.trim(),input.teacherCharacterId,input.language||"en"]);
   const x=await pool.query("SELECT * FROM rooms.rooms WHERE tenant_id=$1 AND room_id=$2",[a.tenantId,id]);
   if(!x.rows.length)throw new RoomError(422,"teacher_not_found");
   return parsePreview(x.rows[0]);
 },
 async publish(a,id,eligibleMasana){
   requireRoomStaff(a.roles);assertRoom(id);
   if(!eligibleMasana)throw new RoomError(403,"masana_teacher_required");
   const r=await pool.query(`UPDATE rooms.rooms SET state='published',updated_at=now()
     WHERE tenant_id=$1 AND room_id=$2 AND state='draft' RETURNING room_id`,[a.tenantId,id]);
   if(!r.rows.length)throw new RoomError(409,"room_publish_conflict");
 },
 async join(a,id){
   assertRoom(id);const userId=requireFan(a.userId);
   await transaction(pool,async q=>{
     const room=await lookupRoom(q,a.tenantId,id,true);await requirePublishedEligible(q,a,room);
     const prev=await q.query("SELECT state FROM rooms.memberships WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 FOR UPDATE",[a.tenantId,id,userId]);
     if(prev.rows[0]?.state==="banned")throw new RoomError(403,"room_banned");
     await q.query(`INSERT INTO rooms.memberships(tenant_id,room_id,user_id) VALUES ($1,$2,$3)
       ON CONFLICT(tenant_id,room_id,user_id) DO UPDATE SET state='active',updated_at=now()`,[a.tenantId,id,userId]);
   });
 },
 async leave(a,id){
   assertRoom(id);const userId=requireFan(a.userId);
   await pool.query("UPDATE rooms.memberships SET state='left',updated_at=now() WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 AND state='active'",[a.tenantId,id,userId]);
 },
 async ask(a,id,raw,key){
   assertRoom(id);const userId=requireFan(a.userId);
   const body=validateQuestion(raw);validateIdempotencyKey(key);
   return transaction(pool,async q=>{
     const room=await lookupRoom(q,a.tenantId,id);
     await requirePublishedEligible(q,a,room);await requireMember(q,a,id,true);
     const duplicate=await q.query(`SELECT question_id,room_id,body,state,queued_at,NULL::text AS answer
       FROM rooms.questions WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 AND idempotency_key=$4`,
       [a.tenantId,id,userId,key]);
     if(duplicate.rows.length){
       if(duplicate.rows[0].body!==body)throw new RoomError(409,"idempotency_conflict");
       return parseQuestion(duplicate.rows[0]);
     }
     const count=await q.query(`SELECT count(*)::int AS n FROM rooms.questions
       WHERE tenant_id=$1 AND user_id=$2 AND queued_at>=now()-interval '24 hours'`,[a.tenantId,userId]);
     if(Number(count.rows[0].n)>=20)throw new RoomError(429,"question_quota_reached");
     const questionId=newId("room-question_");
     await q.query(`INSERT INTO rooms.questions(tenant_id,question_id,room_id,user_id,body,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6)`,[a.tenantId,questionId,id,userId,body,key]);
     const eid=newId("event_"),correlation=newId("correlation_");
     await q.query(`INSERT INTO events.outbox
       (outbox_event_id,tenant_id,event_id,event_type,schema_version,aggregate_type,aggregate_id,correlation_id,destination,payload)
       VALUES ($1,$2,$3,'rooms.question.queued',1,'room_question',$4,$5,'rooms.teacher',jsonb_build_object('roomId',$6,'questionId',$4))`,
       [newId("outbox-event_"),a.tenantId,eid,questionId,correlation,id]);
     return {questionId,roomId:id,body,state:"queued" as const,queuedAt:new Date().toISOString(),answer:null};
   });
 },
 async questions(a,id){
   assertRoom(id);const room=await lookupRoom(pool,a.tenantId,id);await requirePublishedEligible(pool,a,room);
   await requireMember(pool,a,id);
   const res=await pool.query(`SELECT q.question_id,q.room_id,q.body,q.state,q.queued_at,
     CASE WHEN ans.state='approved' THEN ans.body ELSE NULL END AS answer
     FROM rooms.questions q LEFT JOIN rooms.answers ans
     ON ans.tenant_id=q.tenant_id AND ans.question_id=q.question_id
     WHERE q.tenant_id=$1 AND q.room_id=$2 AND q.state<>'rejected'
     ORDER BY q.queued_at DESC,q.question_id LIMIT 100`,[a.tenantId,id]);
   return res.rows.map(parseQuestion);
 },
 async question(a,id,qid){
   const rows=await this.questions(a,id);
   return rows.find(r=>r.questionId===qid)||null;
 },
 async staffQueue(a){
   requireRoomStaff(a.roles);
   const r=await pool.query(`SELECT q.question_id,q.room_id,q.body,q.state,q.queued_at,
       ans.body AS answer FROM rooms.questions q
       JOIN rooms.rooms room ON room.tenant_id=q.tenant_id AND room.room_id=q.room_id
       LEFT JOIN rooms.answers ans ON ans.tenant_id=q.tenant_id AND ans.question_id=q.question_id
       WHERE q.tenant_id=$1 AND q.state IN ('queued','answering','needs_staff')
       ORDER BY q.queued_at,q.question_id LIMIT 100`,[a.tenantId]);
   return r.rows.map(parseQuestion);
 },
 async review(a,qid,raw,decision){
   requireRoomStaff(a.roles);const userId=requireFan(a.userId);
   const body=raw.trim();
   if(body.length<1||body.length>6000)throw new RoomError(422,"invalid_answer");
   await transaction(pool,async q=>{
     const r=await q.query(`SELECT q.*,r.teacher_character_id
       FROM rooms.questions q JOIN rooms.rooms r ON r.tenant_id=q.tenant_id AND r.room_id=q.room_id
       WHERE q.tenant_id=$1 AND q.question_id=$2 FOR UPDATE OF q`,[a.tenantId,qid]);
     if(!r.rows.length)throw new RoomError(404,"question_not_found");
     if(r.rows[0].state==="answered"||r.rows[0].state==="rejected")throw new RoomError(409,"question_already_reviewed");
     await q.query(`INSERT INTO rooms.answers(tenant_id,answer_id,question_id,teacher_character_id,body,state,reviewed_by,reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT(tenant_id,question_id) DO UPDATE SET body=$5,state=$6,reviewed_by=$7,reviewed_at=now()`,
       [a.tenantId,newId("room-answer_"),qid,r.rows[0].teacher_character_id,body,decision==="approve"?"approved":"rejected",userId]);
     await q.query("UPDATE rooms.questions SET state=$3,updated_at=now() WHERE tenant_id=$1 AND question_id=$2",
       [a.tenantId,qid,decision==="approve"?"answered":"rejected"]);
     if(decision==="approve"){
       await q.query(`INSERT INTO events.outbox
         (outbox_event_id,tenant_id,event_id,event_type,schema_version,aggregate_type,aggregate_id,correlation_id,destination,payload)
         VALUES($1,$2,$3,'rooms.answer.approved',1,'room_question',$4,$5,'notifications.rooms',
           jsonb_build_object('userId',$6,'roomId',$7,'questionId',$4))`,
         [newId("outbox-event_"),a.tenantId,newId("event_"),qid,newId("correlation_"),r.rows[0].user_id,r.rows[0].room_id]);
     }
     await q.query(`INSERT INTO events.audit_events
       (audit_event_id,tenant_id,event_type,schema_version,aggregate_type,aggregate_id,occurred_at,actor,correlation_id,sensitivity,payload)
       VALUES($1,$2,'rooms.answer.reviewed',1,'room_question',$3,now(),jsonb_build_object('userId',$4),$5,'internal',jsonb_build_object('decision',$6))`,
       [newId("audit-event_"),a.tenantId,qid,userId,newId("correlation_"),decision]);
   });
 },
 async lessons(a,id){
   const room=await lookupRoom(pool,a.tenantId,id);await requirePublishedEligible(pool,a,room);
   await requireMember(pool,a,id);
   const r=await pool.query(`SELECT lesson_id,body,kind FROM rooms.lessons
     WHERE tenant_id=$1 AND room_id=$2 AND state='published' AND (publish_at IS NULL OR publish_at<=now())
     ORDER BY publish_at DESC NULLS LAST,lesson_id DESC LIMIT 100`,[a.tenantId,id]);
   return r.rows.map(x=>({lessonId:x.lesson_id,body:x.body,kind:x.kind}));
 },
 async createLesson(a,id,body,kind){
   requireRoomStaff(a.roles);assertRoom(id);
   if(!["lesson","announcement"].includes(kind)||!body.trim()||body.length>10000)
     throw new RoomError(422,"invalid_lesson");
   await lookupRoom(pool,a.tenantId,id);
   await pool.query(`INSERT INTO rooms.lessons(tenant_id,lesson_id,room_id,kind,body,state,publish_at)
     VALUES ($1,$2,$3,$4,$5,'published',now())`,
     [a.tenantId,newId("room-lesson_"),id,kind,body.trim()]);
 }
 };
}
