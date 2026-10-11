import {readFileSync} from "node:fs";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {createIsolatedPostgresTestDatabase} from "../commerce/isolated-test-database.js";
import {PgHomeFeedRepository} from "./repository.js";
const conn=process.env.MASANAWA_TEST_DATABASE_URL;
const integration=conn?describe:describe.skip;
integration("J06 real PostgreSQL18 Feed tenant/idempotency/visibility",()=>{
 let isolated:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
 let repo:PgHomeFeedRepository;
 let legacyCommentId="";
 beforeAll(async()=>{
  isolated=await createIsolatedPostgresTestDatabase(conn!);
  const {pool}=isolated;
  await pool.query(readFileSync(new URL("../../../../../packages/events/migrations/0001_event_foundation.sql",import.meta.url),"utf8"));
  await pool.query("CREATE SCHEMA masana; CREATE TABLE masana.follows(tenant_id text NOT NULL,fan_user_id text NOT NULL,character_id text NOT NULL,PRIMARY KEY(tenant_id,fan_user_id,character_id)); CREATE TABLE masana.character_revisions(tenant_id text NOT NULL,character_id text NOT NULL,state text NOT NULL,profile jsonb NOT NULL); INSERT INTO masana.character_revisions VALUES ('tenant_test','masana_one','approved','{\"displayName\":\"Teacher\"}'::jsonb)");
  await pool.query(readFileSync(new URL("../../../../../packages/feed/migrations/0001_feed.sql",import.meta.url),"utf8"));
  // Simulate the forward-only upgrade with existing historic comments, before C22.
  const old=await pool.query("INSERT INTO feed.posts(tenant_id,author_masana_id,kind,body,idempotency_key,published_by) VALUES('tenant_upgrade','masana_one','text','Old discussion','legacy-post-001','staff_upgrader') RETURNING id");
  const legacy=await pool.query("INSERT INTO feed.comments(tenant_id,post_id,fan_id,body,state,idempotency_key) VALUES('tenant_upgrade',$1,'fan_old','Historic question','visible','legacy-comment-001') RETURNING id",[old.rows[0]!.id]);
  legacyCommentId=String(legacy.rows[0]!.id);
  const threadMigration=readFileSync(new URL("../../../../../packages/feed/migrations/0002_comment_threads.sql",import.meta.url),"utf8");
  await pool.query(threadMigration);
  await pool.query(threadMigration); // idempotent upgrade rehearsal, never rewrite 0001
  await pool.query("INSERT INTO masana.character_revisions(tenant_id,character_id,state,profile) VALUES('tenant_thread','masana_one','approved',jsonb_build_object('displayName','Teacher'))");
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
 it("C22 keeps historic comment bytes intact across forward-only migration",async()=>{
  const rows=await isolated.pool.query("SELECT body,fan_id,parent_comment_id FROM feed.comments WHERE tenant_id='tenant_upgrade' AND id=$1::uuid",[legacyCommentId]);
  expect(rows.rows).toEqual([{body:"Historic question",fan_id:"fan_old",parent_comment_id:null}]);
 });
 it("C22 real PG accepts visible top-level replies and preserves idempotency",async()=>{
  const p=await repo.publish("tenant_thread","staff_one",{authorMasanaId:"masana_one",kind:"text",
   body:"Study circle",media:[],transcript:null,idempotencyKey:"thread-post-001"});
  const root=await repo.comment("tenant_thread","fan_one",p.id,"First question","thread-root-001",false);
  const child=await repo.comment("tenant_thread","fan_two",p.id,"Answer","thread-child-001",false,root.id);
  expect(child.parentId).toBe(root.id);
  expect((await repo.comment("tenant_thread","fan_two",p.id,"Answer","thread-child-001",false,root.id)).id).toBe(child.id);
  await expect(repo.comment("tenant_thread","fan_two",p.id,"Answer","thread-child-001",false,null)).rejects.toMatchObject({code:"idempotency_conflict"});
  await expect(repo.comment("tenant_thread","fan_three",p.id,"Nested","thread-nested-001",false,child.id)).rejects.toMatchObject({code:"idempotency_conflict"});
  const hidden=await repo.comment("tenant_thread","fan_hidden",p.id,"Awaiting review","thread-pending-001",true);
  await expect(repo.comment("tenant_thread","fan_three",p.id,"Cannot reply pending","thread-pending-child-001",false,hidden.id)).rejects.toMatchObject({code:"idempotency_conflict"});
  const q=await repo.publish("tenant_thread","staff_one",{authorMasanaId:"masana_one",kind:"text",
   body:"Second discussion",media:[],transcript:null,idempotencyKey:"thread-post-002"});
  await expect(repo.comment("tenant_thread","fan_three",q.id,"Cross post","thread-cross-001",false,root.id)).rejects.toMatchObject({code:"idempotency_conflict"});
  const newest=await repo.comments("tenant_thread",p.id,"fan_two",null,30,"newest");
  const oldest=await repo.comments("tenant_thread",p.id,"fan_two",null,30,"oldest");
  expect(newest.map(c=>c.id)).toEqual([...oldest].reverse().map(c=>c.id));
  expect((await repo.comments("tenant_thread",p.id,"fan_other",null,30)).every(c=>c.id!==hidden.id)).toBe(true);
  const task=await isolated.pool.query("SELECT event_type FROM events.outbox WHERE tenant_id='tenant_thread' AND aggregate_id=$1",[hidden.id]);
  expect(task.rows).toEqual([{event_type:"feed.comment.pending"}]);
 });

});
