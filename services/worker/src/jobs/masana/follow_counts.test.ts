import {describe,expect,it,vi} from "vitest";
import {refreshMasanaFollowCount} from "./follow_counts.js";
describe("follower count recomputation",()=>{
  it("runs a tenant-scoped, replay-safe recompute instead of increment",async()=>{
    const query=vi.fn(async()=>({rows:[]}));
    await refreshMasanaFollowCount({query} as never,{tenantId:"tenant_demo",characterId:"masana-gwani"});
    expect(query).toHaveBeenCalledTimes(1);
    const [sql,params]=query.mock.calls[0] as unknown as [string,string[]];
    expect(sql).toContain("count(*)");expect(sql).not.toContain("follower_count+1");
    expect(params).toEqual(["tenant_demo","masana-gwani"]);
  });
  it("rejects forged tenant identifiers",async()=>expect(refreshMasanaFollowCount({query:vi.fn()} as never,{tenantId:"../../",characterId:"a"})).rejects.toThrow());
});
