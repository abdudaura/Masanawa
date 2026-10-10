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
  const query=vi.fn(async()=>({rows:[]}));
  const repo=new PgHomeFeedRepository({query} as unknown as Pool);
  await repo.setLike("tenantA","fanA","381026c2-9d56-47b1-b73d-1784e24e41e2",true);
  expect(query.mock.calls[0]?.[0]).toContain("p.state='published'");
  expect(query.mock.calls[0]?.[0]).toContain("p.tenant_id=$1");
 });
});
