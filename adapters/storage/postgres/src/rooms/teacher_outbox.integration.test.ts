import {randomUUID} from "node:crypto";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import {Pool} from "pg";
import {platformProductMigrationRoots} from "../readiness.js";
import {runMigrations} from "../migrations.js";
import {createPgRoomsRepository} from "./repository.js";
import {createPgTeacherQueue} from "./teacher_outbox.js";
import {createRoomTeacherWorker} from "../../../../services/worker/src/jobs/rooms/teacher.js";

const connection=process.env.MASANAWA_TEST_DATABASE_URL;
describe.skipIf(!connection)("actual PG18 Rooms customer question to Gemini-model response",()=>{
 const db="rooms_ai_"+randomUUID().replaceAll("-","").slice(0,20);
 const first={tenantId:"tenant_rooms_ai",userId:"fan_one",roles:[] as string[]};
 const foreign={tenantId:"tenant_other",userId:"fan_one",roles:[] as string[]};
 const roomId="room_math_ai";
 let admin:Pool,pool:Pool;
 let repo:ReturnType<typeof createPgRoomsRepository>;
 beforeAll(async()=>{
   const url=new URL(connection!);
   if(!["localhost","127.0.0.1"].includes(url.hostname))
     throw new Error("real-pg-room-qualification-requires-local-disposable-database");
   admin=new Pool({connectionString:connection!});
   await admin.query('CREATE DATABASE "'+db+'"');
   url.pathname="/"+db;
   pool=new Pool({connectionString:url.toString(),max:8});
   await runMigrations(pool,platformProductMigrationRoots());
   repo=createPgRoomsRepository(pool);
   for(const tenant of ["tenant_rooms_ai","tenant_other"]){
     await pool.query("INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES($1,now(),now())",[tenant]);
     await pool.query("INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES($1,'fan_one',now(),now())",[tenant]);
     await pool.query("INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at) VALUES($1,'character_teacher',now(),now())",[tenant]);
   }
   await pool.query("INSERT INTO rooms.rooms(tenant_id,room_id,slug,profession_title,teacher_character_id,state) VALUES($1,$2,'mathematics','Mathematics','character_teacher','published')",[first.tenantId,roomId]);
   await repo.join(first,roomId);
 },90_000);
 afterAll(async()=>{
   if(pool)await pool.end();
   if(admin){
     await admin.query('DROP DATABASE IF EXISTS "'+db+'" WITH (FORCE)');
     await admin.end();
   }
 },30_000);

 it("answer is visible automatically without human review or staff roles",async()=>{
   const key="idempotency_key_"+randomUUID().replaceAll("-","");
   const question=await repo.ask(first,roomId,"?",key);
   expect(question.body).toBe("?");
   expect(question.state).toBe("queued");
   expect((await repo.ask(first,roomId,"?",key)).questionId).toBe(question.questionId);
   expect((await repo.questions(first,roomId)).find(q=>q.questionId===question.questionId)?.answer).toBeNull();

   const model=vi.fn(async()=> "I can help with that question.");
   const queue=createPgTeacherQueue(pool);
   const worker=createRoomTeacherWorker(queue,{generate:model},"rooms-ai-test",()=>true);
   expect(await worker.tick()).toBe("processed");
   expect(model).toHaveBeenCalledWith(expect.objectContaining({
     questionId:question.questionId,question:"?",roomId,
     professionTitle:"Mathematics",language:"en",
   }));
   const result=(await repo.questions(first,roomId)).find(q=>q.questionId===question.questionId);
   expect(result).toMatchObject({state:"answered",answer:"I can help with that question."});
   expect((await repo.question(first,roomId,question.questionId))?.answer).toBe("I can help with that question.");
   const rows=await pool.query("SELECT state,reviewed_by FROM rooms.answers WHERE tenant_id=$1 AND question_id=$2",[first.tenantId,question.questionId]);
   expect(rows.rows).toEqual([{state:"approved",reviewed_by:"masanawa-ai"}]);
   const notices=await pool.query("SELECT count(*)::integer AS count FROM events.outbox WHERE tenant_id=$1 AND aggregate_id=$2 AND destination='notifications.rooms'",[first.tenantId,question.questionId]);
   expect(notices.rows[0].count).toBe(1);
   expect((await worker.tick())).toBe("idle");
   await expect(repo.questions(foreign,roomId)).rejects.toMatchObject({status:404});
 });
 it("provider outage keeps the question durable, and later processing succeeds",async()=>{
   const key="idempotency_key_"+randomUUID().replaceAll("-","");
   const question=await repo.ask(first,roomId,"Why?",key);
   const queue=createPgTeacherQueue(pool);
   const worker=createRoomTeacherWorker(queue,{generate:async()=>{throw Error("provider_unavailable");}},"rooms-ai-retry",()=>true);
   expect(await worker.tick()).toBe("retry");
   const event=await pool.query("SELECT state,attempt,safe_error_code FROM events.outbox WHERE tenant_id=$1 AND aggregate_id=$2 AND destination='rooms.teacher'",[first.tenantId,question.questionId]);
   expect(event.rows).toEqual([{state:"retry-scheduled",attempt:1,safe_error_code:"temporary_failure"}]);
   expect((await repo.questions(first,roomId)).find(q=>q.questionId===question.questionId))
    .toMatchObject({state:"queued",answer:null});
   await pool.query("UPDATE events.outbox SET available_at=now()-interval '1 second' WHERE tenant_id=$1 AND aggregate_id=$2 AND destination='rooms.teacher'",[first.tenantId,question.questionId]);
   const successful=createRoomTeacherWorker(queue,{generate:async()=>"Here is an explanation."},"rooms-ai-retry",()=>true);
   expect(await successful.tick()).toBe("processed");
   expect((await repo.questions(first,roomId)).find(q=>q.questionId===question.questionId))
    .toMatchObject({state:"answered",answer:"Here is an explanation."});
 });
});
