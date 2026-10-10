import {fileURLToPath} from "node:url";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import type {Pool} from "pg";
import {runMigrations} from "../migrations.js";
import {createIsolatedPostgresTestDatabase} from "../commerce/isolated-test-database.js";
import {createPostgresCaseRepository} from "./repository.js";
import {createPostgresModerationDeliveryRepository} from "./delivery.js";
const testDatabase=process.env.MASANAWA_TEST_DATABASE_URL;
const pgDescribe=testDatabase?describe:describe.skip;
pgDescribe("J13 actual PostgreSQL18 case lifecycle",()=>{
 let isolated:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
 let pool:Pool;
 beforeAll(async()=>{
  isolated=await createIsolatedPostgresTestDatabase(testDatabase!);
  pool=isolated.pool;
  const version=Number((await pool.query<{server_version_num:string}>("SHOW server_version_num")).rows[0]?.server_version_num);
  expect(version).toBeGreaterThanOrEqual(180000);
  expect(version).toBeLessThan(190000);
  await runMigrations(pool,[
   {owner:"events",directory:fileURLToPath(new URL("../../../../../packages/events/migrations",import.meta.url))},
   {owner:"moderation",directory:fileURLToPath(new URL("../../../../../packages/moderation/migrations",import.meta.url))},
  ]);
 });
 afterAll(async()=>{if(isolated)await isolated.close();});
 it("idempotent fan report, distinct staff approval, outbox apply, appeal and reversal",async()=>{
  const r=createPostgresCaseRepository(pool);
  const now="2026-10-10T12:00:00Z";
  const record={tenantId:"tenant_j13",caseId:"case_j13",reporterUserId:"user_a",
   targetKind:"comment" as const,targetId:"comment_a",category:"spam" as const,
   details:"spam",clientRequestId:"client_a",state:"open" as const,version:1,
   slaDueAt:"2026-10-11T12:00:00Z",createdAt:now,updatedAt:now};
  const first=await r.create(record);
  expect(first.caseId).toBe("case_j13");
  const reused=await r.create({...record,caseId:"case_different"});
  expect(reused.caseId).toBe("case_j13");
  await expect(r.create({...record,caseId:"case_other",details:"changed"}))
   .rejects.toMatchObject({code:"moderation.idempotency_conflict"});
  expect(await r.find("tenant_other","case_j13")).toBeNull();
  const a=await r.propose({tenantId:record.tenantId,caseId:record.caseId,
   actionId:"action_j13",targetKind:"comment",targetId:"comment_a",
   kind:"hide_comment",state:"proposed",reason:"spam",proposedBy:"masana-gwani",
   approvedBy:null,secondApprovedBy:null,expiresAt:"2027-01-01T00:00:00Z",version:1},1);
  expect(a.state).toBe("proposed");
  await expect(r.review("tenant_j13","case_j13","action_j13","masana-gwani",true,1))
   .rejects.toMatchObject({statusCode:403});
  const approved=await r.review("tenant_j13","case_j13","action_j13","staff1",true,1);
  expect(approved.state).toBe("approved");
  const enqueued=await pool.query<{destination:string;state:string;outbox_event_id:string}>(
   "SELECT destination,state,outbox_event_id FROM events.outbox WHERE tenant_id='tenant_j13' AND aggregate_id='action_j13'");
  expect(enqueued.rows[0]).toMatchObject({destination:"moderation.action.apply",state:"pending"});
  await pool.query("UPDATE events.outbox SET state='claimed',fence=1,lease_expires_at=now()+interval '2 minutes' WHERE outbox_event_id=$1",
   [enqueued.rows[0]?.outbox_event_id]);
  const ack=createPostgresModerationDeliveryRepository(pool);
  expect(await ack.acknowledge({tenantId:"tenant_j13",actionId:"action_j13",
   operationId:enqueued.rows[0]!.outbox_event_id,fence:1,evidenceId:"receipt1"})).toBe(true);
  expect((await r.find("tenant_j13","case_j13"))?.state).toBe("actioned");
  await r.appeal("tenant_j13","case_j13","appeal_j13","user_a","wrong decision");
  const review1=await r.resolveAppeal("tenant_j13","case_j13","appeal_j13","staff2",true,1);
  expect(review1.state).toBe("under_review");
  await expect(r.resolveAppeal("tenant_j13","case_j13","appeal_j13","staff2",true,2))
   .rejects.toMatchObject({statusCode:403});
  const review2=await r.resolveAppeal("tenant_j13","case_j13","appeal_j13","staff3",true,2);
  expect(review2.state).toBe("upheld");
  const reverse=await pool.query<{outbox_event_id:string}>(
   "SELECT outbox_event_id FROM events.outbox WHERE destination='moderation.action.reverse' AND event_type='moderation.action.appeal_reversal'");
  expect(reverse.rowCount).toBe(1);
  const reverseId=reverse.rows[0]!.outbox_event_id;
  await pool.query("UPDATE events.outbox SET state='claimed',fence=1,lease_expires_at=now()+interval '2 minutes' WHERE outbox_event_id=$1",[reverseId]);
  expect(await ack.acknowledgeReversal({tenantId:"tenant_j13",actionId:"action_j13",
    operationId:reverseId,fence:1,evidenceId:"reversal1"})).toBe(true);
  expect((await r.find("tenant_j13","case_j13"))?.actions[0]?.state).toBe("reversed");
 });
});
