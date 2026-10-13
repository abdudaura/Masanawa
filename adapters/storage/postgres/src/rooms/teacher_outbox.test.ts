import {describe,expect,it,vi} from "vitest";
import type {Pool} from "pg";
import {createPgTeacherQueue} from "./teacher_outbox.js";
const job={outboxId:"outbox-event_1",tenantId:"tenant_1",
 questionId:"room-question_1",roomId:"room_1",fence:2,
 question:"What is algebra?",professionTitle:"Mathematics",language:"en"};
function poolFor(rows:(sql:string)=>any[]){
 const calls:{sql:string;params:unknown[]}[]=[];
 const query=vi.fn(async(sql:string,params:unknown[]=[])=>{
   calls.push({sql,params});
   const result=rows(sql);
   return {rows:result,rowCount:sql.includes("UPDATE")||sql.includes("INSERT")?1:result.length};
 });
 const pool={query,connect:async()=>({query,release:vi.fn()})} as unknown as Pool;
 return {queue:createPgTeacherQueue(pool),calls};
}
describe("Rooms canonical outbox direct-answer boundary",()=>{
 it("claims tenant-matched question text/subject and recovers former review items",async()=>{
   const p=poolFor(sql=>sql.includes("SELECT o.outbox_event_id")?[{
     outbox_event_id:job.outboxId,tenant_id:job.tenantId,
     aggregate_id:job.questionId,room_id:job.roomId,fence:1,
     question_body:job.question,profession_title:job.professionTitle,language:job.language,
   }]:[]);
   expect(await p.queue.claim("worker1")).toEqual(job);
   const query=p.calls.find(x=>x.sql.includes("SELECT o.outbox_event_id"))?.sql||"";
   expect(query).toContain("question.state='needs_staff'");
   expect(query).toContain("rooms.questions");
   expect(query).not.toContain("attempt<5");
 });
 it("persists an AI answer directly approved with machine provenance, not human review",async()=>{
   const p=poolFor(sql=>sql.includes("lease_expires_at>now() FOR UPDATE")||sql.includes("AND lease_expires_at>now()\n")?[{state:"claimed"}]
     : sql.includes("SELECT question.question_id")?[{question_id:job.questionId,
       room_id:job.roomId,state:"answering",teacher_character_id:"character_1",user_id:"fan_1"}]:[]);
   await p.queue.publish(job,"The answer.");
   const joined=p.calls.map(x=>x.sql).join("\n");
   expect(joined).toContain("'approved','masanawa-ai',now()");
   expect(joined).toContain("UPDATE rooms.questions SET state='answered'");
   expect(joined).toContain("'notifications.rooms'");
   expect(joined).toContain("COMMIT");
 });
 it("requeues provider outages indefinitely with bounded backoff, not staff review/dead letter",async()=>{
   const p=poolFor(sql=>sql.includes("SELECT attempt")?[{attempt:12}]:[]);
   await p.queue.fail(job,"temporary_failure");
   const update=p.calls.find(x=>x.sql.includes("state='retry-scheduled'"));
   expect(update?.params).toEqual([job.outboxId,job.fence,"temporary_failure",3600]);
   expect(p.calls.map(x=>x.sql).join(" ")).not.toContain("dead-letter");
   expect(p.calls.map(x=>x.sql).join(" ")).not.toContain("needs_staff");
 });
 it("refuses empty publication before writing to PostgreSQL",async()=>{
   const p=poolFor(()=>[]);
   await expect(p.queue.publish(job," ")).rejects.toThrow("rooms_answer_invalid");
   expect(p.calls).toEqual([]);
 });
});
