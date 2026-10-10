import { describe, expect, it, vi } from "vitest";
import { createYouTubeReconciler, processYouTubeOutbox, type YouTubeSyncSource } from "./reconcile.js";
const source:YouTubeSyncSource={
  tenantId:"tenant1",sourceId:"source1",channelId:"UC"+"X".repeat(22),channelName:"Official Channel",
  targetRegion:"NG",enabled:true,apiQualified:true,mode:"authorized_api",
};
const id="aBcDEfg1234";
function harness() {
  const events:string[]=[];
  const api={
    uploadsPlaylist:vi.fn(async()=> "UU"+"X".repeat(22)),
    uploadsPage:vi.fn(async()=>({ids:[id],nextPageToken:null})),
    videos:vi.fn(async()=>[{id,channelId:source.channelId,privacyStatus:"public",embeddable:true,
      title:"Original video",blockedRegions:[],allowedRegions:null}]),
  };
  const quota={reserve:vi.fn(async()=>true)};
  const catalog={
    stagePending:vi.fn(async(_input:unknown)=>{events.push("pending");}),
    markUnavailable:vi.fn(async(_input:unknown)=>{events.push("unavailable");}),
  };
  return {reconciler:createYouTubeReconciler({api,quota,catalog}),api,quota,catalog,events};
}
describe("YouTube official source reconciliation",()=>{
  it("imports eligible video metadata as pending only",async()=>{
    const x=harness(),result=await x.reconciler.reconcile(source);
    expect(result).toMatchObject({staged:1,unavailable:0,pages:1});
    expect(x.catalog.stagePending).toHaveBeenCalledWith(expect.objectContaining({
      tenantId:"tenant1",sourceId:"source1",providerVideoId:id,sourceUrl:"https://www.youtube.com/watch?v="+id,
    }));
    expect(x.quota.reserve).toHaveBeenCalledTimes(3);
  });
  it("requires current API authorization before any provider request",async()=>{
    const x=harness();
    await expect(x.reconciler.reconcile({...source,apiQualified:false})).rejects.toMatchObject({code:"unauthorized_source"});
    expect(x.api.uploadsPlaylist).not.toHaveBeenCalled();
  });
  it("marks nonembeddable items unavailable, never publishes",async()=>{
    const x=harness();
    x.api.videos.mockResolvedValueOnce([{id,channelId:source.channelId,privacyStatus:"private",
      embeddable:false,title:"Hidden",blockedRegions:[],allowedRegions:null}]);
    await x.reconciler.reconcile(source);
    expect(x.events).toEqual(["unavailable"]);
    expect(x.catalog.stagePending).not.toHaveBeenCalled();
  });
  it("does not call provider when quota reservation fails",async()=>{
    const x=harness();x.quota.reserve.mockResolvedValueOnce(false);
    await expect(x.reconciler.reconcile(source)).rejects.toMatchObject({code:"quota_exhausted"});
    expect(x.api.uploadsPlaylist).not.toHaveBeenCalled();
  });
  it("blocks cross-tenant outbox payload substitution",async()=>{
    const load=vi.fn(async()=>({...source,tenantId:"other"}));const run=vi.fn();
    await expect(processYouTubeOutbox({tenantId:"tenant1",sourceId:"source1",eventType:"youtube.reconcile.requested"},load,run))
      .rejects.toMatchObject({code:"unauthorized_source"});
    expect(run).not.toHaveBeenCalled();
  });
});
