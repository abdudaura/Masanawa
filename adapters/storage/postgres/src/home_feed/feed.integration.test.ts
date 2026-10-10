import {readFileSync} from "node:fs";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {createIsolatedPostgresTestDatabase} from "../commerce/isolated-test-database.js";
import {PgHomeFeedRepository} from "./repository.js";
const conn=process.env.MASANAWA_TEST_DATABASE_URL;
const integration=conn?describe:describe.skip;
integration("J06 real PostgreSQL18 Feed tenant/idempotency/visibility",()=>{
 let isolated:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
 let repo:PgHomeFeedRepository;
 beforeAll(async()=>{
  isolated=await createIsolatedPostgresTestDatabase(conn!);
  const {pool}=isolated;
  await pool.query(readFileSync(new URL("../../../../../packages/events/migrations/0001_event_foundation.sql",import.meta.url),"utf8"));
  await pool.query("CREATE SCHEMA masana; CREATE TABLE masana.follows(tenant_id text NOT NULL,fan_user_id text NOT NULL,character_id text NOT NULL,PRIMARY KEY(tenant_id,fan_user_id,character_id)); CREATE TABLE masana.character_revisions(tenant_id text NOT NULL,character_id text NOT NULL,state text NOT NULL); INSERT INTO masana.character_revisions VALUES ('tenant_test','masana_one','approved')");
  await pool.query(readFileSync(new URL("../../../../../packages/feed/migrations/0001_feed.sql",import.meta.url),"utf8"));
  repo=new PgHomeFeedRepository(pool);
 });
 afterAll(async()=>{await isolated?.close();});
 it("publishes once on stable key and rejects changed payload",async()=>{
  const value={authorMasanaId:"masana_one",kind:"text",body:"Welcome",media:[],transcript:null,idempotencyKey:"request-publish-001"};
  const first=await repo.publish("tenant_test","staff_one",value);
  expect((await repo.publish("tenant_test","staff_one",value)).id).toBe(first.id);
  await expect(repo.publish("tenant_test","staff_one",{...value,body:"Modified"})).rejects.toMatchObject({code:"idempotency_conflict"});
  expect((await repo.list("tenant_test",null,"for_you",null,30))).toHaveLength(1);
  expect((await repo.list("tenant_other",null,"for_you",null,30))).toHaveLength(0);
 });
 it("following uses the authoritative masana.follows table",async()=>{
  await isolated.pool.query("INSERT INTO masana.follows(tenant_id,fan_user_id,character_id) VALUES($1,$2,$3)",["tenant_test","fan_one","masana_one"]);
  expect((await repo.list("tenant_test","fan_one","following",null,30))).toHaveLength(1);
  expect((await repo.list("tenant_test","fan_other","following",null,30))).toHaveLength(0);
 });
 it("likes, saves, and pending comments remain tenant and fan fenced",async()=>{
  const [p]=await repo.list("tenant_test",null,"for_you",null,20);
  expect(p).toBeDefined();const id=p!.id;
  await repo.setLike("tenant_test","fan_one",id,true);
  await repo.setLike("tenant_test","fan_one",id,true);
  await repo.setSave("tenant_test","fan_one",id,true);
  expect((await repo.find("tenant_test","fan_one",id))!.likeCount).toBe(1);
  expect((await repo.find("tenant_test","fan_other",id))!.viewerSaved).toBe(false);
  const c=await repo.comment("tenant_test","fan_one",id,"My question","request-comment-001",true);
  expect(c.state).toBe("pending");
  const second=await repo.comment("tenant_test","fan_one",id,"My question","request-comment-001",true);
  expect(second.id).toBe(c.id);
  await expect(repo.comment("tenant_test","fan_one",id,"different","request-comment-001",true)).rejects.toMatchObject({code:"idempotency_conflict"});
  expect((await repo.comments("tenant_test",id,"fan_one",null,30))).toHaveLength(1);
  expect((await repo.comments("tenant_test",id,"fan_other",null,30))).toHaveLength(0);
  const tasks=await isolated.pool.query("SELECT * FROM events.outbox WHERE tenant_id=$1 AND event_type=$2",["tenant_test","feed.comment.pending"]);
  expect(tasks.rows).toHaveLength(1);
 });
});
