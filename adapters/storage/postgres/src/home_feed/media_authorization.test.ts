import {describe,it,expect,vi} from "vitest";
import type {Pool} from "pg";
import {PgFeedMediaAuthorization} from "./media_authorization.js";
describe("J06/C23 canonical media authorization",()=>{
  it("looks up only a matching published post and approved Masana within the same tenant",async()=>{
    const query=vi.fn(async()=>({rows:[{author_masana_id:"masana",kind:"audio",transcript:"Hello"}]}));
    const source=new PgFeedMediaAuthorization({query} as unknown as Pool);
    const result=await source.find("tenantA","381026c2-9d56-47b1-b73d-1784e24e41e2","media_abcdefgh");
    expect(result?.kind).toBe("audio");
    const [sql,args]=query.mock.calls[0]!;
    expect(sql).toContain("p.tenant_id=$1");
    expect(sql).toContain("p.state='published'");
    expect(sql).toContain("ANY(p.media_ids)");
    expect(sql).toContain("m.state='approved'");
    expect(args).toEqual(["tenantA","381026c2-9d56-47b1-b73d-1784e24e41e2","media_abcdefgh"]);
  });
  it("returns no grant for unpublished or foreign media",async()=>{
    const query=vi.fn(async()=>({rows:[]}));
    const source=new PgFeedMediaAuthorization({query} as unknown as Pool);
    expect(await source.find("tenant","id","media_abcdefgh")).toBeNull();
  });
});
