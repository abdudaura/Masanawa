import { describe,expect,it,vi } from "vitest";
import { createYouTubeSourceAdminService } from "./source_admin.js";
const staff={tenantId:"t1",actorId:"staff_1",staffRoles:["content_editor"]};
function harness(){
 const store={list:vi.fn(async()=>[]),create:vi.fn(async(x:Record<string,unknown>)=>({
   id:String(x.id),channelId:String(x.channelId),channelName:String(x.channelName),
   targetRegion:String(x.targetRegion),enabled:false,syncMode:"manual" as const,
 })),pause:vi.fn(async()=>true)};
 return {service:createYouTubeSourceAdminService(store),store};
}
describe("admin YouTube source authority",()=>{
 it("denies fan and agent role spoof before any database call",async()=>{
   const h=harness();
   await expect(h.service.create({...staff,staffRoles:[]},{channelId:"UC"+"X".repeat(22),channelName:"Official",targetRegion:"NG"}))
     .rejects.toMatchObject({status:403});
   expect(h.store.create).not.toHaveBeenCalled();
 });
 it("rejects client-driven automation or hidden credential fields",async()=>{
   const h=harness();
   await expect(h.service.create(staff,{channelId:"UC"+"X".repeat(22),channelName:"Official",targetRegion:"NG",authorized_api:true}))
     .rejects.toMatchObject({status:422,code:"unexpected_source_field"});
 });
 it("creates PAUSED manual source only",async()=>{
   const h=harness();
   const row=await h.service.create(staff,{channelId:"UC"+"X".repeat(22),channelName:"Channel",targetRegion:"NG"});
   expect(row).toMatchObject({enabled:false,syncMode:"manual"});
   expect(h.store.create).toHaveBeenCalledWith(expect.objectContaining({tenantId:"t1",actorId:"staff_1"}));
 });
 it("tenant-fences pause authority",async()=>{
   const h=harness();
   await h.service.pause(staff,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
   expect(h.store.pause).toHaveBeenCalledWith({tenantId:"t1",actorId:"staff_1",id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"});
 });
 it("fences listing, including blank principals, before reaching storage",async()=>{
   const h=harness();
   await expect(h.service.list({...staff,staffRoles:[]})).rejects.toMatchObject({status:403});
   await expect(h.service.list({...staff,tenantId:" "}))
     .rejects.toMatchObject({status:403});
   await expect(h.service.list({...staff,tenantId:"tenant\\nother"}))
     .rejects.toMatchObject({status:403});
   await expect(h.service.list({...staff,actorId:" "}))
     .rejects.toMatchObject({status:403});
   expect(h.store.list).not.toHaveBeenCalled();
   await h.service.list(staff);
   expect(h.store.list).toHaveBeenCalledExactlyOnceWith("t1");
 });
 it("rejects malformed source IDs or user-supplied authority before pause",async()=>{
   const h=harness();
   await expect(h.service.pause(staff,"------------------------------------"))
     .rejects.toMatchObject({status:422,code:"invalid_source_id"});
   await expect(h.service.pause({...staff,staffRoles:[]},"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))
     .rejects.toMatchObject({status:403});
   expect(h.store.pause).not.toHaveBeenCalled();
 });

});
