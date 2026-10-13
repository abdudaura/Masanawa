import {randomUUID} from "node:crypto";
import type {Pool} from "pg";
import type {TeacherJob,TeacherQueue} from "@masanawa/rooms";

async function transaction<T>(pool:Pool,fn:(q:any)=>Promise<T>):Promise<T>{
 const q=await pool.connect();
 try{await q.query("BEGIN");const r=await fn(q);await q.query("COMMIT");return r;}
 catch(e){await q.query("ROLLBACK");throw e;}finally{q.release();}
}
/** Single canonical events.outbox. No staff-review or secondary queue for
 * ordinary questions. Leases, tenant, question and room must match. */
export function createPgTeacherQueue(pool:Pool):TeacherQueue {
 return {
 async claim(workerId){
  return transaction(pool,async q=>{
   const x=await q.query(`SELECT o.outbox_event_id,o.tenant_id,o.aggregate_id,o.fence,
      question.room_id,question.body AS question_body,
      room.profession_title,room.language
      FROM events.outbox o
      JOIN rooms.questions question
        ON question.tenant_id=o.tenant_id AND question.question_id=o.aggregate_id
      JOIN rooms.rooms room
        ON room.tenant_id=question.tenant_id AND room.room_id=question.room_id
      WHERE o.destination='rooms.teacher' AND o.event_type='rooms.question.queued'
        AND (
           (o.state IN ('pending','retry-scheduled') AND o.available_at<=now())
           OR (o.state='claimed' AND o.lease_expires_at<now())
           -- Bring legacy staff-review questions back into normal AI delivery.
           OR (o.state='acknowledged' AND question.state='needs_staff'
               AND NOT EXISTS(SELECT 1 FROM rooms.answers a
                 WHERE a.tenant_id=question.tenant_id
                   AND a.question_id=question.question_id AND a.state='approved'))
        )
        AND question.state IN ('queued','answering','needs_staff')
      ORDER BY o.available_at,o.created_at,o.outbox_event_id
      LIMIT 1 FOR UPDATE OF o SKIP LOCKED`);
   if(!x.rows.length)return null;
   const row=x.rows[0],fence=Number(row.fence)+1;
   const claimed=await q.query(`UPDATE events.outbox
      SET state='claimed',attempt=attempt+1,fence=$2,
      lease_owner=$3,lease_expires_at=now()+interval '90 seconds',updated_at=now()
      WHERE outbox_event_id=$1 RETURNING outbox_event_id`,
      [row.outbox_event_id,fence,workerId]);
   if(claimed.rowCount!==1)throw Error("rooms_claim_conflict");
   await q.query(`UPDATE rooms.questions SET state='answering',updated_at=now()
      WHERE tenant_id=$1 AND question_id=$2 AND state IN ('queued','needs_staff')`,
      [row.tenant_id,row.aggregate_id]);
   return {
     outboxId:row.outbox_event_id,tenantId:row.tenant_id,
     questionId:row.aggregate_id,roomId:row.room_id,
     question:row.question_body,professionTitle:row.profession_title,
     language:row.language,fence,
   } as TeacherJob;
  });
 },
 async publish(job,answer){
   if(typeof answer!=="string" || !answer.trim() || answer.trim().length>6000)
     throw new Error("rooms_answer_invalid");
   await transaction(pool,async q=>{
     const lease=await q.query(`SELECT state FROM events.outbox
       WHERE outbox_event_id=$1 AND tenant_id=$2 AND fence=$3
         AND state='claimed' AND lease_expires_at>now()
       FOR UPDATE`,[job.outboxId,job.tenantId,job.fence]);
     if(!lease.rows.length)return; // stale worker cannot publish or ack
     const found=await q.query(`SELECT question.question_id,question.user_id,
       question.room_id,question.state,room.teacher_character_id
       FROM rooms.questions question JOIN rooms.rooms room
       ON room.tenant_id=question.tenant_id AND room.room_id=question.room_id
       WHERE question.tenant_id=$1 AND question.question_id=$2
         AND question.room_id=$3 FOR UPDATE OF question`,
       [job.tenantId,job.questionId,job.roomId]);
     if(!found.rows.length)throw Error("rooms_question_missing");
     const source=found.rows[0];
     if(!["answered","rejected"].includes(source.state)){
       // reviewed_by records a MACHINE provenance marker required by the
       // existing schema; it is NOT a person or a manual approval requirement.
       const inserted=await q.query(`INSERT INTO rooms.answers
         (tenant_id,answer_id,question_id,teacher_character_id,
          body,state,reviewed_by,reviewed_at)
         VALUES ($1,$2,$3,$4,$5,'approved','masanawa-ai',now())
         ON CONFLICT(tenant_id,question_id) DO UPDATE
         SET body=EXCLUDED.body,state='approved',
             reviewed_by='masanawa-ai',reviewed_at=now()
         WHERE rooms.answers.state='draft' RETURNING answer_id`,
         [job.tenantId,"room-answer_"+randomUUID(),job.questionId,
          source.teacher_character_id,answer.trim()]);
       if(inserted.rowCount===1){
         await q.query(`UPDATE rooms.questions SET state='answered',updated_at=now()
           WHERE tenant_id=$1 AND question_id=$2
             AND state IN ('queued','answering','needs_staff')`,
           [job.tenantId,job.questionId]);
         await q.query(`INSERT INTO events.outbox
           (outbox_event_id,tenant_id,event_id,event_type,schema_version,
            aggregate_type,aggregate_id,correlation_id,destination,payload)
           VALUES($1,$2,$3,'rooms.answer.approved',1,'room_question',$4,$5,
             'notifications.rooms',jsonb_build_object('userId',$6::text,'roomId',$7::text,'questionId',$4::text))`,
           ["outbox-event_"+randomUUID(),job.tenantId,"event_"+randomUUID(),
            job.questionId,"correlation_"+randomUUID(),source.user_id,job.roomId]);
       }
     }
     const result=await q.query(`UPDATE events.outbox SET state='acknowledged',
       lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
       WHERE outbox_event_id=$1 AND tenant_id=$2 AND fence=$3 AND state='claimed'`,
       [job.outboxId,job.tenantId,job.fence]);
     if(result.rowCount!==1)throw Error("rooms_ack_conflict");
   });
 },
 async fail(job,reason){
   await transaction(pool,async q=>{
     const x=await q.query(`SELECT attempt FROM events.outbox
       WHERE outbox_event_id=$1 AND tenant_id=$2 AND state='claimed'
         AND fence=$3 AND lease_expires_at>now() FOR UPDATE`,
       [job.outboxId,job.tenantId,job.fence]);
     if(!x.rows.length)return;
     const delay=Math.min(3600,10*2**Math.min(Number(x.rows[0].attempt),9));
     await q.query(`UPDATE events.outbox SET state='retry-scheduled',
       safe_error_code=$3,available_at=now()+($4::int*interval '1 second'),
       lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
       WHERE outbox_event_id=$1 AND fence=$2`,
       [job.outboxId,job.fence,reason,delay]);
     await q.query(`UPDATE rooms.questions SET state='queued',updated_at=now()
       WHERE tenant_id=$1 AND question_id=$2 AND state='answering'`,
       [job.tenantId,job.questionId]);
   });
 }
 };
}
