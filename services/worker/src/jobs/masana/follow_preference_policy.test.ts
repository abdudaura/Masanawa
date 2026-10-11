import { describe,expect,it,vi } from "vitest";
import type {Pool} from "pg";
import {mayNotifyFollower} from "./follow_preference_policy.js";
const input={tenantId:"tenant_one",fanId:"fan_a",characterId:"masana_a"};
describe("C46 send-time follow and mute policy",()=>{
  it("allows only current eligible, unmuted following",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{allowed:true}]});
    expect(await mayNotifyFollower({query} as unknown as Pick<Pool,"query">,input)).toBe(true);
    const [sql,args]=query.mock.calls[0] as [string,unknown[]];
    expect(sql).toContain("f.fan_user_id=$2");
    expect(sql).toContain("r.state='approved'");
    expect(sql).toContain("o.kind='platform'");
    expect(sql).toContain("coalesce(p.muted,false)=false");
    expect(args).toEqual(["tenant_one","fan_a","masana_a"]);
  });
  it("rejects unfollow, mute, missing rows and storage errors",async()=>{
    for(const row of [{allowed:false},undefined]){
      const query=vi.fn().mockResolvedValue({rows:row?[row]:[]});
      expect(await mayNotifyFollower({query} as unknown as Pick<Pool,"query">,input)).toBe(false);
    }
    const query=vi.fn().mockRejectedValue(new Error("database_unavailable"));
    expect(await mayNotifyFollower({query} as unknown as Pick<Pool,"query">,input)).toBe(false);
  });
});
