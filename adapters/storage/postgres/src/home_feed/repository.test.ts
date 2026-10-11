import {describe,it,expect,vi} from "vitest";
import type {Pool} from "pg";
import {PgHomeFeedRepository} from "./repository.js";
describe("J06 tenant-scoped SQL and no duplicate follower registry",()=>{
 it("passes viewer, tenant and follows mode via SQL binds",async()=>{
  const query=vi.fn(async()=>({rows:[]}));
  const repo=new PgHomeFeedRepository({query} as unknown as Pool);
  await repo.list("tenantA","fanA","following",null,21);
  expect(query.mock.calls[0]?.[0]).toContain("FROM masana.follows");
  expect(query.mock.calls[0]?.[1]).toEqual(["tenantA","fanA","following",null,null,21]);
 });
 it("never allows a reaction write without matching published post",async()=>{
  const query=vi.fn(async()=>({rows:[{admitted:true}]}));
  const repo=new PgHomeFeedRepository({query} as unknown as Pool);
  await repo.setLike("tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2",true);
  expect(query.mock.calls[0]?.[0]).toContain("p.state='published'");
  expect(query.mock.calls[0]?.[0]).toContain("p.tenant_id=$1");
 });
 it("C22 uses tenant, post, visible top-level parent for reply admission",async()=>{
  const query=vi.fn(async()=>({rows:[]}));
  const repo=new PgHomeFeedRepository({query} as unknown as Pool);
  await expect(repo.comment("tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2",
   "Reply","reply-key-001",true,"9b8c8884-7a31-49d9-aee5-521364b54aef")).rejects.toMatchObject({status:409});
  const sql=String(query.mock.calls[0]?.[0]);
  expect(sql).toContain("parent.tenant_id=$1");
  expect(sql).toContain("parent.post_id=p.id");
  expect(sql).toContain("parent.state='visible'");
  expect(sql).toContain("parent.parent_comment_id IS NULL");
  expect(sql).toContain("IS NOT DISTINCT FROM EXCLUDED.parent_comment_id");
  expect(query.mock.calls[0]?.[1]).toEqual(["tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2","Reply","pending","reply-key-001","9b8c8884-7a31-49d9-aee5-521364b54aef"]);
 });
 it("C22 selects deterministic oldest-first without a raw SQL order injection",async()=>{
  const query=vi.fn(async()=>({rows:[]}));
  const repo=new PgHomeFeedRepository({query} as unknown as Pool);
  await repo.comments("tenantA","381026c2-9d56-47b1-b73d-1784e24e41e2","fanA",null,30,"oldest");
  const sql=String(query.mock.calls[0]?.[0]);
  expect(sql).toContain("CASE WHEN $6::text='oldest'");
  expect(sql).toContain("c.tenant_id=$1");
  expect(query.mock.calls[0]?.[1]).toEqual(["tenantA","381026c2-9d56-47b1-b73d-1784e24e41e2","fanA",null,30,"oldest"]);
 });

 it("Status fails closed if author is revoked between read and reaction insert",async()=>{
  const query=vi.fn(async(_sql:string,_args:unknown[])=>({rows:[{admitted:false}]}));
  const repo=new PgHomeFeedRepository({query} as unknown as Pool);
  await expect(repo.setLike("tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2",true)).rejects.toMatchObject({status:404});
  await expect(repo.setSave("tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2",true)).rejects.toMatchObject({status:404});
  for(const [sql,binds] of query.mock.calls){
   expect(sql).toContain("a.state='active'");expect(sql).toContain("o.kind='platform'");
   expect(sql).toContain("m.state='approved'");expect(sql).toContain("o.tenant_id=a.tenant_id");
   expect(binds).toEqual(["tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2"]);
  }
 });
 it("Status list and detail recheck canonical character after approval",async()=>{
  const query=vi.fn(async(_sql:string,_args:unknown[])=>({rows:[]}));
  const repo=new PgHomeFeedRepository({query} as unknown as Pool);
  await repo.list("tenantA","fanA","for_you",null,21);
  await repo.find("tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2");
  for(const [sql] of query.mock.calls){
   expect(sql).toContain("a.state='active'");expect(sql).toContain("o.kind='platform'");
   expect(sql).toContain("m.tenant_id=p.tenant_id");expect(sql).toContain("m.character_id=p.author_masana_id");
  }
 });
});

