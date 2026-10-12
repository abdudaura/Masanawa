import {describe,it,expect,vi} from "vitest";
import {runSocialDelivery,type SocialDeliveryJob,type SocialDeliveryGate} from "./delivery.js";
const job:SocialDeliveryJob={tenantId:"t",identityId:"id1",characterId:"masana1",
 eventId:"evt1",externalFanHash:"opaque",action:"reply",idempotencyKey:"idem1"};
const permitted={provider:"telegram" as const,mode:"verified_automation_eligible" as const,
  paused:false,verifiedAt:"2026-10-10",authorizationRef:"approved",
  authorizationExpiresAt:"2099-01-01",permittedActions:["reply"],fanConsented:true};
describe("J22 consented social delivery",()=>{
 it("cannot automate personal WhatsApp even with a transport",async()=>{
    const send=vi.fn(async()=>{}),finish=vi.fn(async()=>{});
    const gate:SocialDeliveryGate={readPermission:async()=>({...permitted,provider:"whatsapp"}),
      claim:async()=>"acquired",finish};
    expect(await runSocialDelivery(job,gate,{send})).toBe("blocked");
    expect(send).not.toHaveBeenCalled();expect(finish).toHaveBeenCalledOnce();
 });
 it("does not send without provider capability/consent or when paused",async()=>{
    const send=vi.fn(async()=>{}),finish=vi.fn(async()=>{});
    const gate:SocialDeliveryGate={readPermission:async()=>({...permitted,fanConsented:false}),
      claim:async()=>"acquired",finish};
    expect(await runSocialDelivery(job,gate,{send})).toBe("blocked");
    expect(send).not.toHaveBeenCalled();
 });
 it("suppresses duplicate events before transport",async()=>{
   const send=vi.fn(async()=>{});
   expect(await runSocialDelivery(job,{readPermission:async()=>permitted,
    claim:async()=>"duplicate",finish:async()=>{}},{send})).toBe("duplicate");
   expect(send).not.toHaveBeenCalled();
 });
 it("routes authorized events once with the exact tenant/character envelope",async()=>{
   const send=vi.fn(async()=>{}), finish=vi.fn(async()=>{});
   expect(await runSocialDelivery(job,{readPermission:async()=>permitted,
    claim:async()=>"acquired",finish},{send},new Date("2026-10-10"))).toBe("sent");
   expect(send).toHaveBeenCalledWith(job);expect(finish).toHaveBeenCalledWith(job,"sent");
 });
});