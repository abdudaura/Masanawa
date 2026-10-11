import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { registerExternalVideoRoutes } from "../../../services/gateway/src/modules/external_videos/routes.js";
import { applyVerifiedVideoWithdrawal } from "../../../services/worker/src/jobs/external_videos/recovery.js";
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

describe("J14/C29 official withdrawal → canonical catalog → player admission",()=>{
  it("revokes playback after verified provider removal, without cross-tenant disclosure",async()=>{
    const itemId="11111111-1111-4111-8111-111111111111";
    const tenantId="tenant-c29", otherTenant="tenant-foreign";
    const providerVideoId="abcDE12_-34";
    let state:"approved"|"unavailable"="approved";
    const item={
      id:itemId,tenantId,provider:"youtube" as const,providerVideoId,
      sourceUrl:"https://www.youtube.com/watch?v="+providerVideoId,
      title:"Verified source",channelName:"Original Publisher",
      reviewState:"approved" as const,verifiedAt:new Date().toISOString(),
      createdAt:new Date().toISOString(),
    };
    const store={
      async submit(){return item;},
      async review(){return null;},
      async list(){return [];},
      async isApproved(input:{tenantId:string;id:string}){
        return input.tenantId===tenantId && input.id===itemId && state==="approved";
      },
    };
    const app=Fastify();
    registerExternalVideoRoutes(app,{
      store,
      resolvePrincipal:async request=>({
        tenantId:request.headers["x-test-foreign"]?otherTenant:tenantId,
        actorId:null,staffRoles:[],
      }),
    });
    const url="/v1/videos/"+itemId+"/availability";
    expect((await app.inject({method:"GET",url})).json()).toEqual({available:true});
    expect((await app.inject({method:"GET",url,headers:{"x-test-foreign":"yes"}})).json())
      .toEqual({available:false});
    let calls=0;
    const result=await applyVerifiedVideoWithdrawal({
      tenantId,itemId,provider:"youtube",providerVideoId,
    },{
      enabled:true,
      verifyOfficialWithdrawal:async()=>{calls++;return {
        provider:"youtube",providerVideoId,status:"officially_removed",
        evidenceReference:"official-youtube-removal-check-123",
      };},
      reviewStore:{review:async input=>{
        if(input.tenantId!==tenantId || input.id!==itemId ||
          input.expectedState!=="approved" || state!=="approved") return null;
        state="unavailable";
        return {reviewState:"unavailable"};
      }},
    });
    expect(result).toBe("unavailable");
    expect(calls).toBe(1);
    expect((await app.inject({method:"GET",url})).json()).toEqual({available:false});
    expect((await app.inject({method:"GET",url,headers:{"x-test-foreign":"yes"}})).json())
      .toEqual({available:false});
    await app.close();
  });
});
