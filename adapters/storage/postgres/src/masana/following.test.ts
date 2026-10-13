import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createFollowingStore } from "./following.js";

describe("C46 private Following PostgreSQL adapter", () => {
  it("only returns the requesting fan's currently approved platform Masana and cursor", async () => {
    const query=vi.fn().mockResolvedValue({rows:[
      {character_id:"masana_a",revision:3,profile:{displayName:"A"},
        follower_count:"12",muted:false},
      {character_id:"masana_b",revision:4,profile:{displayName:"B"},
        follower_count:"2",muted:true}
    ]});
    const store=createFollowingStore({query} as unknown as Pick<Pool,"query">);
    const result=await store.list({tenantId:"tenant_one",fanId:"fan_one",q:"Teacher",
      language:"ha",cursor:"masana_start",limit:1});
    expect(result).toEqual({items:[{
      characterId:"masana_a",revision:3,profile:{displayName:"A"},
      followerCount:12,following:true,muted:false
    }],nextCursor:"masana_a"});
    const [sql,args]=query.mock.calls[0] as [string,unknown[]];
    expect(sql).toContain("f.tenant_id=$1 AND f.fan_user_id=$2");
    expect(sql).toContain("r.state='approved'");
    expect(sql).toContain("jsonb_array_elements_text");
    expect(sql).toContain("o.kind='platform'");
    expect(sql).toContain("u.state='active'");
    expect(sql).toContain("c.state='active'");
    expect(sql).toContain("f.character_id > $5");
    expect(args).toEqual(["tenant_one","fan_one","Teacher","ha","masana_start",2]);
  });
  it("does not expose a cursor when no more results exist",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[]});
    const result=await createFollowingStore({query} as unknown as Pick<Pool,"query">)
      .list({tenantId:"tenant_a",fanId:"fan_a",q:"",language:"",cursor:null,limit:20});
    expect(result).toEqual({items:[],nextCursor:null});
  });
  it("atomically writes muted preference only from an eligible existing Follow",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{muted:true}]});
    const muted=await createFollowingStore({query} as unknown as Pick<Pool,"query">)
      .setMute({tenantId:"tenant_a",fanId:"fan_a",characterId:"masana_1",muted:true});
    expect(muted).toBe(true);
    const [sql,args]=query.mock.calls[0] as [string,unknown[]];
    expect(sql).toMatch(/INSERT INTO masana\.follow_preferences/);
    expect(sql).toContain("SELECT f.tenant_id,f.fan_user_id,f.character_id,$4");
    expect(sql).toContain("WHERE f.tenant_id=$1 AND f.fan_user_id=$2 AND f.character_id=$3");
    expect(sql).toContain("ON CONFLICT(tenant_id,fan_user_id,character_id)");
    expect(args).toEqual(["tenant_a","fan_a","masana_1",true]);
  });
  it("returns null, not a phantom preference, after unfollow or denied target",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[]});
    const value=await createFollowingStore({query} as unknown as Pick<Pool,"query">)
      .setMute({tenantId:"tenant_a",fanId:"fan_a",characterId:"other",muted:false});
    expect(value).toBeNull();
  });
});
