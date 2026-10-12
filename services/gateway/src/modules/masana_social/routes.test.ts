import Fastify from "fastify";
import {describe,it,expect} from "vitest";
import {registerMasanaSocialRoutes} from "./routes.js";
import {createMasanaSocialService,type TrustedStaffActor} from "./service.js";
import type {SocialStore} from "@masanawa/masana-social";
const base = {identityId:"soc-a",tenantId:"t-a",characterId:"masana-a",
  provider:"whatsapp" as const,providerAccountId:"2348012345678",handle:"+2348012345678",
  publicUrl:"https://wa.me/2348012345678",verifiedAt:null,publishState:"draft" as const,
  mode:"profile_link_only" as const,paused:false,revision:1};
function harness(actor?:TrustedStaffActor){
 const records=[{...base}];
 const store:SocialStore={
  publicForCharacter:async(t,c)=>records.filter(x=>x.tenantId===t && x.characterId===c),
  adminForCharacter:async(t,c)=>records.filter(x=>x.tenantId===t && x.characterId===c),
  create:async(i)=>({...base,...i}),
  transition:async(i)=>{
    const found=records.find(x=>x.tenantId===i.tenantId&&x.characterId===i.characterId&&x.identityId===i.identityId);
    if(!found)throw new Error("missing");
    if(found.revision!==i.revision)throw Object.assign(new Error("stale"),{code:"SOCIAL_REVISION_CONFLICT"});
    return {...found,revision:found.revision+1};
  },
 };
 const app=Fastify();registerMasanaSocialRoutes(app,createMasanaSocialService(store),
   {authenticateStaff:async()=>actor,publicTenant:async()=>"t-a"});
 return app;
}
describe("J21 public links and admin authorization",()=>{
 it("denies fan and missing staff session before any mutation",async()=>{
    const app=harness();
    try{
      const r=await app.inject({method:"POST",url:"/v1/admin/masana/masana-a/social-accounts",
        payload:{provider:"whatsapp",providerAccountId:base.providerAccountId,handle:base.handle,publicUrl:base.publicUrl,
         tenantId:"t-b",verifiedAt:"2026-01-01"}});
      expect(r.statusCode).toBe(403);
    }finally{await app.close();}
 });
 it("fails closed on bogus staff action and exposes no pending identity",async()=>{
    const app=harness({tenantId:"t-a",userId:"staff-a",roles:["content_editor"],principalType:"staff"});
    try{
      const out=await app.inject({method:"GET",url:"/v1/masana/masana-a/social-links"});
      expect(out.statusCode).toBe(200);expect(out.json()).toEqual({links:[]});
      const verify=await app.inject({method:"POST",url:"/v1/admin/masana/masana-a/social-accounts/soc-a/verify",
        payload:{revision:1,evidenceRef:"case-1"}});
      expect(verify.statusCode).toBe(403);
    }finally{await app.close();}
 });
 it("denies unapproved website and forged revision",async()=>{
   const app=harness({tenantId:"t-a",userId:"staff-a",roles:["ops_admin"],principalType:"staff"});
   try{
      const invalid=await app.inject({method:"POST",url:"/v1/admin/masana/masana-a/social-accounts",
        payload:{provider:"whatsapp",providerAccountId:base.providerAccountId,handle:base.handle,
          publicUrl:"https://wa.me.evil.test/"+base.providerAccountId}});
      expect(invalid.statusCode).toBe(422);
      const noRev=await app.inject({method:"POST",url:"/v1/admin/masana/masana-a/social-accounts/soc-a/publish",
         payload:{}});
      expect(noRev.statusCode).toBe(403); // publish restricted to content editor
   }finally{await app.close();}
 });
});