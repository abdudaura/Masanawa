import Fastify from "fastify";
import {describe,expect,it,vi} from "vitest";
import {registerFanSetupRoutes} from "./fan_setup_routes.js";
import type {FanSetupProfile} from "@masanawa/identity";
const profile:FanSetupProfile={
 userId:"fan_a",displayName:null,avatarMediaId:null,preferredLanguage:"en",
 interests:[],ageAttested18Plus:false,disclosureAccepted:false,
 disclosureVersion:null,completed:false,revision:1
};
const payload=()=>({
 expectedRevision:1,displayName:"Fan Account",preferredLanguage:"en",
 interests:["learning"],ageAttested18Plus:true,
 disclosureAccepted:true,disclosureVersion:"masana-ai-v1"
});
function setup(enabled=true){
 const writes:unknown[]=[];
 const auth=vi.fn(async(header:string|undefined)=>{
  if(header!=="Bearer fan")throw Object.assign(new Error("Unauthorized"),{statusCode:401});
  return {tenantId:"tenant_real",userId:"fan_a"};
 });
 const store={
  read:vi.fn(async()=>profile),
  update:vi.fn(async(input:unknown)=>{
   writes.push(input);
   return {...profile,displayName:"Fan Account",revision:2,completed:true};
  })
 };
 const verifyAvatar=vi.fn(async()=>false);
 const app=Fastify();
 registerFanSetupRoutes(app,{auth,store,verifyAvatar,enabled:()=>enabled});
 return {app,auth,store,writes,verifyAvatar};
}
describe("C04 /v1/me actor and consent boundary",()=>{
 it("defaults to disabled and does not consult authorization",async()=>{
  const s=setup(false);
  const res=await s.app.inject({method:"GET",url:"/v1/me",headers:{authorization:"Bearer fan"}});
  expect(res.statusCode).toBe(503);
  expect(s.auth).not.toHaveBeenCalled();
  await s.app.close();
 });
 it("denies guests before DB reads or mutations",async()=>{
  const s=setup();
  const read=await s.app.inject({method:"GET",url:"/v1/me"});
  const write=await s.app.inject({method:"PATCH",url:"/v1/me",payload:payload()});
  expect([read.statusCode,write.statusCode]).toEqual([401,401]);
  expect(s.store.read).not.toHaveBeenCalled();
  expect(s.store.update).not.toHaveBeenCalled();
  await s.app.close();
 });
 it("ignores no caller-supplied tenancy and rejects identity override",async()=>{
  const s=setup();
  const r=await s.app.inject({method:"PATCH",url:"/v1/me",
   headers:{authorization:"Bearer fan"},payload:{...payload(),userId:"victim"}});
  expect(r.statusCode).toBe(400);
  expect(s.store.update).not.toHaveBeenCalled();
  const ok=await s.app.inject({method:"PATCH",url:"/v1/me?tenantId=other",
   headers:{authorization:"Bearer fan"},payload:payload()});
  expect(ok.statusCode).toBe(200);
  expect(s.writes).toEqual([expect.objectContaining({tenantId:"tenant_real",userId:"fan_a"})]);
  await s.app.close();
 });
 it("does not save without consent or a verified photo",async()=>{
  const s=setup();
  const h={authorization:"Bearer fan"};
  const age=await s.app.inject({method:"PATCH",url:"/v1/me",headers:h,
   payload:{...payload(),ageAttested18Plus:false}});
  expect(age.statusCode).toBe(400);
  const image=await s.app.inject({method:"PATCH",url:"/v1/me",headers:h,
   payload:{...payload(),avatarMediaId:"media_0123456789"}});
  expect(image.statusCode).toBe(403);
  expect(s.verifyAvatar).toHaveBeenCalledWith({
   tenantId:"tenant_real",userId:"fan_a",mediaId:"media_0123456789"});
  expect(s.store.update).not.toHaveBeenCalled();
  await s.app.close();
 });
 it("returns current actor profile from canonical store",async()=>{
  const s=setup();
  const response=await s.app.inject({method:"GET",url:"/v1/me",
   headers:{authorization:"Bearer fan"}});
  expect(response.statusCode).toBe(200);
  expect(s.store.read).toHaveBeenCalledWith({tenantId:"tenant_real",userId:"fan_a"});
  await s.app.close();
 });
});
