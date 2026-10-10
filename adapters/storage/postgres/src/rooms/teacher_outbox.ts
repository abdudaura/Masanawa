import {randomUUID} from "node:crypto";
import type {Pool} from "pg";
import type {TeacherJob,TeacherQueue} from "@masanawa/rooms/teacher";
async function transaction<T>(pool:Pool,fn:(q:any)=>Promise<T>):Promise<T>{
 const q=await pool.connect();try{await q.query("BEGIN");const r=await fn(q);await q.query("COMMIT");return r;}
 catch(e){await q.query("ROLLBACK");throw e;}finally{q.release();}
}
/** Runs against the canonical events.outbox; no second queue or in-memory lease. */
export function createPgTeacherQueue(pool:Pool):TeacherQueue {
 return {
 async claim(workerId){
  return transaction(pool,async q=>{
   const x=await q.query(`SELECT o.outbox_event_id,o.tenant_id,o.aggregate_id,o.fence,o.payload
      FROM events.outbox o JOIN rooms.questions question
        ON question.tenant_id=o.tenant_id AND question.question_id=o.aggregate_id
      WHERE o.destination='rooms.teacher' AND o.event_type='rooms.question.queued'
        AND ((o.state IN ('pending','retry-scheduled') AND o.available_at<=now())
          OR (o.state='claimed' AND o.lease_expires_at<now()))
        AND o.attempt<5
      ORDER BY o.available_at,o.created_at,o.outbox_event_id
      LIMIT 1 FOR UPDATE OF o SKIP LOCKED`);
   if(!x.rows.length)return null;
   const r=x.rows[0],fence=Number(r.fence)+1;
   await q.query(`UPDATE events.outbox SET state='claimed',attempt=attempt+1,fence=$2,
      lease_owner=$3,lease_expires_at=now()+interval '90 seconds',updated_at=now()
      WHERE outbox_event_id=$1`,[r.outbox_event_id,fence,workerId]);
   await q.query(`UPDATE rooms.questions SET state='answering',updated_at=now()
      WHERE tenant_id=$1 AND question_id=$2 AND state='queued'`,[r.tenant_id,r.aggregate_id]);
   return {outboxId:r.outbox_event_id,tenantId:r.tenant_id,questionId:r.aggregate_id,
     roomId:String(r.payload.roomId),fence} as TeacherJob;
  });
 },
 async draft(job,answer){
   await transaction(pool,async q=>{
     const lease=await q.query(`SELECT state FROM events.outbox WHERE outbox_event_id=$1
       AND tenant_id=$2 AND fence=$3 AND state='claimed' FOR UPDATE`,[job.outboxId,job.tenantId,job.fence]);
     if(!lease.rows.length)return; // stale worker cannot publish or ack
     const source=await q.query(`SELECT question.question_id,room.teacher_character_id,question.state
       FROM rooms.questions question JOIN rooms.rooms room
       ON room.tenant_id=question.tenant_id AND room.room_id=question.room_id
       WHERE question.tenant_id=$1 AND question.question_id=$2 FOR UPDATE OF question`,[job.tenantId,job.questionId]);
     if(!source.rows.length)throw Error("missing_question");
     if(!["answered","rejected"].includes(source.rows[0].state)){
       if(answer){
         await q.query(`INSERT INTO rooms.answers
           (tenant_id,answer_id,question_id,teacher_character_id,body,state)
           VALUES ($1,$2,$3,$4,$5,'draft')
           ON CONFLICT(tenant_id,question_id) DO NOTHING`,
           [job.tenantId,"room-answer_"+randomUUID(),job.questionId,source.rows[0].teacher_character_id,answer]);
       }
       await q.query(`UPDATE rooms.questions SET state='needs_staff',updated_at=now()
         WHERE tenant_id=$1 AND question_id=$2 AND state IN ('queued','answering')`,[job.tenantId,job.questionId]);
     }
     await q.query(`UPDATE events.outbox SET state='acknowledged',lease_owner=NULL,
       lease_expires_at=NULL,updated_at=now() WHERE outbox_event_id=$1 AND fence=$2`,[job.outboxId,job.fence]);
   });
 },
 async fail(job,reason){
   await transaction(pool,async q=>{
     const x=await q.query(`SELECT attempt FROM events.outbox WHERE outbox_event_id=$1
       AND tenant_id=$2 AND state='claimed' AND fence=$3 FOR UPDATE`,[job.outboxId,job.tenantId,job.fence]);
     if(!x.rows.length)return;
     const dead=Number(x.rows[0].attempt)>=5;
     await q.query(`UPDATE events.outbox SET state=$3,safe_error_code=$4,
       available_at=now()+($5::int*interval '1 second'),
       lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
       WHERE outbox_event_id=$1 AND fence=$2`,
       [job.outboxId,job.fence,dead?"dead-letter":"retry-scheduled",reason,Math.min(900,2**Number(x.rows[0].attempt)*10)]);
     await q.query(`UPDATE rooms.questions SET state=$3,updated_at=now()
       WHERE tenant_id=$1 AND question_id=$2 AND state='answering'`,
       [job.tenantId,job.questionId,dead?"needs_staff":"queued"]);
   });
 }
 };
}
