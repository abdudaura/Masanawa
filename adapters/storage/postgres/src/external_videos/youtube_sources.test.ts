import {describe,expect,it,vi} from "vitest";
import type {Pool} from "@masanawa/postgres";
import {createPostgresYouTubeSourceAdminStore} from "./youtube_sources.js";

function setup(found=true){
  const statements:string[]=[];
  const client={
    query:vi.fn(async(sql:string,_values?:unknown[])=>{
      statements.push(sql);
      if(sql.includes("INSERT INTO external_videos.sources"))return {rows:[{
        source_id:"source_1",provider_channel_id:"UC"+"X".repeat(22),
        channel_name:"Publisher",target_region:"NG",enabled:false,sync_mode:"manual",
      }]};
      if(sql.includes("UPDATE external_videos.sources"))return {rows:found?[{source_id:"source_1"}]:[]};
      return {rows:[]};
    }),
    release:vi.fn(),
  };
  const pool={connect:async()=>client,query:client.query} as unknown as Pool;
  const audit=vi.fn(async()=>{});
  return {store:createPostgresYouTubeSourceAdminStore(pool,audit),client,audit,statements};
}
const input={
  tenantId:"tenant_1",id:"source_1",channelId:"UC"+"X".repeat(22),
  channelName:"Publisher",targetRegion:"NG",actorId:"staff_1",
};
describe("YouTube source persistence and mandatory audit",()=>{
  it("creates only paused manual records and audits in same transaction",async()=>{
    const v=setup();
    await expect(v.store.create(input)).resolves.toMatchObject({enabled:false,syncMode:"manual"});
    expect(v.audit).toHaveBeenCalledWith(expect.anything(),
      {tenantId:"tenant_1",actorId:"staff_1",sourceId:"source_1",action:"create_manual"});
    expect(v.statements.join(" ")).toContain("'manual',false");
    expect(v.statements).toContain("COMMIT");
  });
  it("refuses to commit an unaudited source creation",async()=>{
    const v=setup();
    v.audit.mockRejectedValueOnce(new Error("audit_offline"));
    await expect(v.store.create(input)).rejects.toThrow("audit_offline");
    expect(v.statements).toContain("ROLLBACK");
    expect(v.statements).not.toContain("COMMIT");
  });
  it("pauses both source and subscription inside one tenant-scoped transaction",async()=>{
    const v=setup();
    expect(await v.store.pause({tenantId:"tenant_1",id:"source_1",actorId:"staff_1"})).toBe(true);
    expect(v.statements.some(s=>s.includes("UPDATE external_videos.youtube_subscriptions"))).toBe(true);
    expect(v.audit).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({tenantId:"tenant_1",action:"pause"}));
  });
  it("never audits or modifies a subscription for a missing tenant-scoped source",async()=>{
    const v=setup(false);
    expect(await v.store.pause({tenantId:"other",id:"source_1",actorId:"staff_1"})).toBe(false);
    expect(v.statements.some(s=>s.includes("UPDATE external_videos.youtube_subscriptions"))).toBe(false);
    expect(v.audit).not.toHaveBeenCalled();
  });
  it("lists only the authenticated tenant using bound SQL, never a global source scan",async()=>{
    const v=setup();
    await v.store.list("tenant_a");
    expect(v.client.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE tenant_id=$1 AND provider='youtube'"),["tenant_a"]);
    expect(v.statements.some(sql=>/FROM external_videos.sources/u.test(sql)
      && !sql.includes("tenant_id=$1"))).toBe(false);
  });
  it("a paused source update never targets other tenants, and audit failure rolls back",async()=>{
    const v=setup();
    v.audit.mockRejectedValueOnce(new Error("audit_unavailable"));
    await expect(v.store.pause({tenantId:"tenant_a",id:"source_1",actorId:"staff_1"}))
      .rejects.toThrow("audit_unavailable");
    const updates=v.client.query.mock.calls.filter(([sql])=>
      typeof sql==="string"&&sql.startsWith("UPDATE external_videos."));
    expect(updates).toHaveLength(2);
    for(const [,args] of updates) expect(args).toEqual(["tenant_a","source_1"]);
    expect(v.statements).toContain("ROLLBACK");
    expect(v.statements).not.toContain("COMMIT");
  });

});
