import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createYouTubeWebSubService, type YouTubeWebSubStore } from "../../../services/gateway/src/modules/youtube_websub/service.js";
import { createYouTubeReconciler, processYouTubeOutbox, type YouTubeSyncSource } from "../../../services/worker/src/jobs/youtube_websub/reconcile.js";

const channelId = "UC" + "A".repeat(22);
const token = "t".repeat(48), secret = "s".repeat(40), videoId="abcdefghijk";
const source:YouTubeSyncSource = {
  tenantId:"tenant_one",sourceId:"source_one",channelId,channelName:"Original Publisher",
  targetRegion:"NG",enabled:true,apiQualified:true,mode:"authorized_api",
};

/** Source-level J14 journey using one canonical outbox queue and catalog sink.
 * It is a deterministic integration test, NOT proof of real PG/Google/device.
 */
function setup() {
  const queue:{tenantId:string;sourceId:string;eventType:string}[]=[];
  const seen=new Set<string>();
  const publicCatalog:{id:string;state:"pending"}[]=[];
  let authorized=true, providerCalls=0;
  const store:YouTubeWebSubStore={
    findByCallbackToken:async input=>input===token?{
      tenantId:source.tenantId,sourceId:source.sourceId,channelId,
      signatureSecret:secret,enabled:true,authorized,
    }:null,
    confirmVerifiedLease:async()=>true,
    enqueueReconciliation:async op=>{
      if(seen.has(op.operationKey)) return false;
      seen.add(op.operationKey);
      queue.push({tenantId:op.tenantId,sourceId:op.sourceId,eventType:"youtube.reconcile.requested"});
      return true;
    },
  };
  const reconciler=createYouTubeReconciler({
    api:{
      async uploadsPlaylist(){providerCalls++;return "UU"+"A".repeat(22);},
      async uploadsPage(){return {ids:[videoId],nextPageToken:null};},
      async videos(){return [{
        id:videoId,channelId,privacyStatus:"public",embeddable:true,
        title:"A public video",blockedRegions:[],allowedRegions:null,
      }];},
    },
    quota:{async reserve(){return true;}},
    catalog:{
      async stagePending(v){publicCatalog.push({id:v.providerVideoId,state:"pending"});},
      async markUnavailable(){throw new Error("unexpected_unavailable");},
    },
  });
  return {
    handler:createYouTubeWebSubService(store),queue,publicCatalog,
    calls:()=>providerCalls,setAuthorized:(value:boolean)=>{authorized=value;},
    deliver:async()=>{
      for(const queued of queue.splice(0)) {
        await processYouTubeOutbox(queued,async()=>authorized?source:{...source,apiQualified:false},
          input=>reconciler.reconcile(input));
      }
    },
  };
}
describe("J14 signed notification → existing outbox → verified pending metadata",()=>{
  it("stages only pending videos and drops duplicate signed deliveries",async()=>{
    const j=setup();
    const raw=Buffer.from("<feed><entry>video uploaded</entry></feed>");
    const signature="sha1="+createHmac("sha1",secret).update(raw).digest("hex");
    await expect(j.handler.notify(token,raw,signature))
      .resolves.toEqual({accepted:true,duplicate:false});
    await expect(j.handler.notify(token,raw,signature))
      .resolves.toEqual({accepted:true,duplicate:true});
    expect(j.queue).toHaveLength(1);
    await j.deliver();
    expect(j.queue).toHaveLength(0);
    expect(j.calls()).toBe(1);
    expect(j.publicCatalog).toEqual([{id:videoId,state:"pending"}]);
  });
  it("rejects forged payload before durable enqueue",async()=>{
    const j=setup();const raw=Buffer.from("<feed><entry>forged</entry></feed>");
    await expect(j.handler.notify(token,raw,"sha1="+"0".repeat(40)))
      .rejects.toMatchObject({status:401,reason:"bad_signature"});
    expect(j.queue).toHaveLength(0);
  });
  it("rechecks authorization after enqueue, before touching the provider",async()=>{
    const j=setup();const raw=Buffer.from("<feed><entry>new video</entry></feed>");
    const signature="sha1="+createHmac("sha1",secret).update(raw).digest("hex");
    await j.handler.notify(token,raw,signature);
    j.setAuthorized(false);
    await expect(j.deliver()).rejects.toMatchObject({code:"unauthorized_source"});
    expect(j.calls()).toBe(0);
    expect(j.publicCatalog).toHaveLength(0);
  });
});
