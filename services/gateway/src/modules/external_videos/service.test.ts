import { describe, expect, it } from "vitest";
import { parseExternalVideoUrl, strictManualVideoInput } from "./contract.js";
import { createVideoAdmissionService, VideoAdmissionError, type VideoStore } from "./service.js";
import type { ExternalVideo, VideoPrincipal } from "./contract.js";
const staff: VideoPrincipal = { tenantId: "t1", actorId: "editor1", staffRoles: ["content_editor"] };
const fan: VideoPrincipal = { tenantId: "t1", actorId: "fan1", staffRoles: [] };
const items: ExternalVideo[]=[];
const store: VideoStore = {
  async submit(video) { items.push(video); return video; },
  async review(input) { const i=items.findIndex(x=>x.id===input.id&&x.tenantId===input.tenantId&&x.reviewState===input.expectedState); if(i<0)return null;
    const updated={...items[i]!,reviewState:input.state,verifiedAt:input.state==="approved"?new Date().toISOString():null};items[i]=updated;return updated; },
  async list(input){return items.filter(x=>x.tenantId===input.tenantId&&(!input.publicOnly||x.reviewState==="approved")&&(!input.provider||x.provider===input.provider)).slice(0,input.limit);}
};
describe("J15 manual source admission",()=>{
  it("accepts canonical official links only",()=>{
    expect(parseExternalVideoUrl("https://youtu.be/abcDE12_-34").provider).toBe("youtube");
    expect(parseExternalVideoUrl("https://www.tiktok.com/@teacher/video/7234567890123456789").providerVideoId).toBe("7234567890123456789");
    expect(parseExternalVideoUrl("https://facebook.com/watch/?v=123456789012345").provider).toBe("facebook");
    for(const u of ["http://tiktok.com/@x/video/7234567890123456789","https://tiktok.com.evil.com/@x/video/7234567890123456789",
      "https://user:pass@youtube.com/watch?v=abcDE12_-34","https://www.facebook.com.evil.com/watch/?v=123456789012345",
      "https://127.0.0.1/video/123456789012345"])expect(()=>parseExternalVideoUrl(u)).toThrow();
  });
  it("rejects forged authority and unexpected fields",async()=>{
    const api=createVideoAdmissionService(store);
    await expect(api.submit(fan,{url:"https://youtu.be/abcDE12_-34",title:"A",channelName:"B"})).rejects.toMatchObject({status:403});
    expect(()=>strictManualVideoInput({url:"https://youtu.be/abcDE12_-34",title:"A",channelName:"B",actorId:"admin"})).toThrow();
    await expect(api.list(fan,{},false)).rejects.toBeInstanceOf(VideoAdmissionError);
  });
  it("stays private until manually verified; hides immediately and isolates tenants",async()=>{
    const api=createVideoAdmissionService(store);
    const v=await api.submit(staff,{url:"https://www.tiktok.com/@teacher/video/7234567890123456789",title:"Lesson",channelName:"Teacher"});
    expect(await api.list(fan,{})).toEqual([]);
    await expect(api.review(staff,v.id,{state:"approved",verificationReference:null})).rejects.toMatchObject({status:400});
    await api.review(staff,v.id,{state:"approved",verificationReference:"official-player-check-123"});
    expect((await api.list(fan,{})).map(x=>x.id)).toContain(v.id);
    expect(await api.list({...staff,tenantId:"another"},{})).toEqual([]);
    await api.review(staff,v.id,{state:"hidden",verificationReference:null});
    expect(await api.list(fan,{})).toEqual([]);
    await expect(api.review(staff,v.id,{state:"approved",verificationReference:"official-player-check-123"})).rejects.toMatchObject({status:409});
  });
});
