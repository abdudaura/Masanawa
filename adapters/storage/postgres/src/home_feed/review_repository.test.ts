import {describe,it,expect,vi} from "vitest";
import {PgEditorialReviewRepository} from "./review_repository.js";
const post="9b8c8884-7a31-49d9-aee5-521364b54aef";
const row={id:post,tenant_id:"tenant",author_masana_id:"masana",kind:"text",body:"ok",media_ids:[],
 transcript:null,state:"in_review",review_revision:1,published_by:"author",scheduled_at:null,updated_at:new Date("2026-10-11T06:00:00Z")};
describe("A06 PostgreSQL transactional authorization invariants",()=>{
 it("checks reviewer separation inside locked transaction",async()=>{
  const q=vi.fn(async(sql:string)=>{
   if(sql.includes("FROM feed.editorial_events"))return {rowCount:0,rows:[]};
   if(sql.includes("FOR UPDATE"))return {rowCount:1,rows:[row]};
   return {rowCount:0,rows:[]};
  });
  const client={query:q,release:vi.fn()},pool={connect:async()=>client};
  const db=new PgEditorialReviewRepository(pool as never);
  await expect(db.change("tenant",post,"author",1,"approve","review-key0001",null)).rejects.toMatchObject({status:403,code:"separate_reviewer_required"});
  expect(q.mock.calls.some(x=>x[0].startsWith("UPDATE feed.posts"))).toBe(false);
  expect(q.mock.calls.some(x=>x[0]==="ROLLBACK")).toBe(true);
 });
 it("denies stale revisions before any UPDATE",async()=>{
  const q=vi.fn(async(sql:string)=>{
   if(sql.includes("FROM feed.editorial_events"))return {rowCount:0,rows:[]};
   if(sql.includes("FOR UPDATE"))return {rowCount:1,rows:[row]};
   return {rowCount:0,rows:[]};
  });
  const db=new PgEditorialReviewRepository({connect:async()=>({query:q,release:()=>{}})} as never);
  await expect(db.change("tenant",post,"reviewer",0,"approve","review-key0002",null)).rejects.toMatchObject({code:"editorial_stale_revision"});
  expect(q.mock.calls.some(x=>x[0].startsWith("UPDATE feed.posts"))).toBe(false);
 });
 it("rejects an idempotency key reused for a different approval request",async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes("FROM feed.editorial_events"))return {rowCount:1,rows:[{
    post_id:post,action:"approve",request_payload:{expectedRevision:1,scheduledAt:null}
   }]};
   return {rowCount:0,rows:[]};
  });
  const db=new PgEditorialReviewRepository({connect:async()=>({query,release:()=>{}})} as never);
  await expect(db.change("tenant",post,"reviewer",1,"schedule","review-key0003",
    "2026-10-12T10:00:00Z")).rejects.toMatchObject({code:"editorial_idempotency_conflict"});
  expect(query.mock.calls.some(x=>x[0].startsWith("UPDATE feed.posts"))).toBe(false);
 });
 it("replays a matching concurrent approval after waiting for the row lock",async()=>{
  let reads=0;
  const current={...row,state:"published",review_revision:2};
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes("FROM feed.editorial_events")){
    reads++;
    return reads===1?{rowCount:0,rows:[]}:{rowCount:1,rows:[{
     post_id:post,action:"approve",request_payload:{expectedRevision:1,scheduledAt:null}
    }]};
   }
   if(sql.includes("FOR UPDATE"))return {rowCount:1,rows:[current]};
   return {rowCount:0,rows:[]};
  });
  const db=new PgEditorialReviewRepository({connect:async()=>({query,release:()=>{}})} as never);
  const returned=await db.change("tenant",post,"reviewer",1,"approve","review-key0004",null);
  expect(returned.state).toBe("published");
  expect(query.mock.calls.some(x=>x[0].startsWith("UPDATE feed.posts"))).toBe(false);
 });
 it("scopes draft listing and scheduled work by tenant",async()=>{
  const query=vi.fn(async()=>({rows:[]}));
  const db=new PgEditorialReviewRepository({query} as never);
  await db.list("tenant",["draft"],50);await db.due("tenant",new Date("2026-10-12T10:00:00Z"));
  expect(query).toHaveBeenNthCalledWith(1,expect.stringContaining("WHERE tenant_id=$1"),["tenant",["draft"],50]);
  expect(query).toHaveBeenNthCalledWith(2,expect.stringContaining("tenant_id=$1"),expect.arrayContaining(["tenant"]));
 });
 it("rechecks active platform author in the final publication CAS and rolls back denial",async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes("FROM feed.editorial_events"))return {rowCount:0,rows:[]};
   if(sql.includes("FOR UPDATE"))return {rowCount:1,rows:[row]};
   return {rowCount:0,rows:[]};
  });
  const db=new PgEditorialReviewRepository({connect:async()=>({query,release:()=>{}})} as never);
  await expect(db.change("tenant",post,"reviewer",1,"approve","review-key-live",null)).rejects.toMatchObject({status:409});
  const update=query.mock.calls.find(([sql])=>sql.startsWith("UPDATE feed.posts"))?.[0];
  expect(update).toContain("c.state='active'");expect(update).toContain("o.kind='platform'");
  expect(update).toContain("cr.state='approved'");expect(update).toContain("cr.tenant_id=feed.posts.tenant_id");
  expect(query.mock.calls.some(([sql])=>sql==="ROLLBACK")).toBe(true);
  expect(query.mock.calls.some(([sql])=>sql.startsWith("INSERT INTO feed.editorial_events"))).toBe(false);
 });
 it("scheduled release denial commits no audit and preserves the queued post",async()=>{
  const query=vi.fn(async(_sql:string)=>({rowCount:0,rows:[]}));
  const db=new PgEditorialReviewRepository({connect:async()=>({query,release:()=>{}})} as never);
  expect(await db.releaseScheduled("tenant",post,1,new Date("2026-10-12T10:00:00Z"))).toBe(false);
  const update=query.mock.calls.find(([sql])=>sql.startsWith("UPDATE feed.posts"))?.[0];
  expect(update).toContain("c.state='active'");expect(update).toContain("o.kind='platform'");
  expect(update).toContain("cr.tenant_id=feed.posts.tenant_id");
  expect(query.mock.calls.some(([sql])=>sql.startsWith("INSERT INTO feed.editorial_events"))).toBe(false);
 });

});

