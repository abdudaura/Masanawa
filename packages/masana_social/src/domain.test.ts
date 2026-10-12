import {describe, expect, it} from "vitest";
import {approvedPublicUrl, canDeliver, publicLink, type SocialIdentity} from "./domain.js";
const sample: SocialIdentity = {identityId:"soc_a", tenantId:"t",characterId:"masana-a",
provider:"whatsapp",providerAccountId:"2348012345678",handle:"+2348012345678",
publicUrl:"https://wa.me/2348012345678",verifiedAt:"2026-10-10T12:00:00Z",
publishState:"published",mode:"profile_link_only",paused:false,revision:3};
describe("J21 verified public social identity",()=>{
  it("hides pending, revoked, disabled and paused identities",()=>{
    expect(publicLink(sample)?.publicUrl).toBe("https://wa.me/2348012345678");
    expect(publicLink({...sample,mode:"verified_automation_eligible"})?.availability).toBe("link_only");
    expect(publicLink({...sample, verifiedAt:null})).toBeNull();
    expect(publicLink({...sample,publishState:"revoked"})).toBeNull();
    expect(publicLink({...sample,paused:true})).toBeNull();
    expect(publicLink({...sample,mode:"disabled"})).toBeNull();
  });
  it("rejects spoofed URLs, credentials and unapproved hosts",()=>{
    for(const url of ["http://wa.me/2348012345678","https://wa.me/2348012345678?text=hi","https://wa.me.evil.test/2348012345678"]){
      expect(()=>approvedPublicUrl("whatsapp",sample.providerAccountId,url)).toThrow();
    }
    expect(()=>approvedPublicUrl("telegram","room","https://t.me.evil.test/room")).toThrow();
    expect(()=>approvedPublicUrl("x","test","javascript:alert(1)")).toThrow();
    expect(()=>approvedPublicUrl("telegram","room","https://t.me/room?redirect=evil")).toThrow();
  });
  it("never assumes personal WhatsApp is automatable",()=>{
    expect(canDeliver({provider:"whatsapp",mode:"verified_automation_eligible",paused:false,
      verifiedAt:sample.verifiedAt,authorizationRef:"evidence",authorizationExpiresAt:"2099-01-01",
      permittedActions:["reply"],fanConsented:true},"reply",new Date())).toBe(false);
  });
  it("fails closed on Telegram consent, scope, expiry and pause",()=>{
    const auth={provider:"telegram" as const,mode:"verified_automation_eligible" as const,paused:false,
      verifiedAt:sample.verifiedAt,authorizationRef:"vault-ref",authorizationExpiresAt:"2099-01-01",
      permittedActions:["reply"],fanConsented:true};
    expect(canDeliver(auth,"reply",new Date("2026-10-10"))).toBe(true);
    expect(canDeliver({...auth,fanConsented:false},"reply",new Date())).toBe(false);
    expect(canDeliver({...auth,paused:true},"reply",new Date())).toBe(false);
    expect(canDeliver({...auth,authorizationExpiresAt:"2020-01-01"},"reply",new Date())).toBe(false);
    expect(canDeliver(auth,"bulk-message",new Date())).toBe(false);
  });
});