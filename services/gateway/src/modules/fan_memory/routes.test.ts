import Fastify from "fastify";
import {describe,it,expect} from "vitest";
import {registerFanMemoryRoutes} from "./routes.js";
import type {FanMemoryStore} from "./service.js";
const characterId="character_018e2c08-6bf7-7b18-96db-013326750ad1";
describe("J11 fan memory Fastify boundary",()=>{
 it("denies anonymous, ignores client role spoofing and keeps disabled memory private",async()=>{
  const app=Fastify();
  const store:FanMemoryStore={
   async read(p,ch){
    if(ch!==characterId)return null;
    return {characterId:ch,revision:1,enabled:p.userId==="user_A",
     items:p.userId==="user_A"?[{
      id:"memory-record_018e2c08-6bf7-7b18-96db-013326750ad1",content:"A's private preference",
      updatedAt:new Date().toISOString(),expiresAt:null}]:[]};
   },
   async setEnabled(_p,ch,_on,_revision){return {characterId:ch,enabled:false,revision:2,items:[]};},
   async enqueueErase(_p,_ch,_id,_key){return {requestId:"receipt_123",state:"queued"};},
  };
  registerFanMemoryRoutes(app,{store,async resolvePrincipal(r){
   if(r.headers.authorization!=="Bearer test-session")
    throw Object.assign(new Error("unauthorized"),{statusCode:401});
   return {tenantId:"tenant_abc",userId:r.headers["x-test-account"]==="b"?"user_B":"user_A"};
  }});
  const anon=await app.inject({method:"GET",url:`/v1/me/memory?characterId=${characterId}`});
  expect(anon.statusCode).toBe(401);
  const a=await app.inject({method:"GET",url:`/v1/me/memory?characterId=${characterId}`,
   headers:{authorization:"Bearer test-session"}});
  expect(a.json().items).toHaveLength(1);
  const b=await app.inject({method:"GET",url:`/v1/me/memory?characterId=${characterId}`,
   headers:{authorization:"Bearer test-session","x-test-account":"b"}});
  expect(b.json().items).toEqual([]);
  const rejected=await app.inject({method:"DELETE",url:"/v1/me/memory",
   headers:{authorization:"Bearer test-session", "idempotency-key":"x"},
   payload:{characterId,recordId:null,role:"super_admin"}});
  expect(rejected.statusCode).toBe(400);
  const queued=await app.inject({method:"DELETE",url:"/v1/me/memory",
   headers:{authorization:"Bearer test-session","idempotency-key":"stable-delete-key"},
   payload:{characterId,recordId:null}});
  expect(queued.statusCode).toBe(202);
  expect(queued.json().state).toBe("queued");
  await app.close();
 });
});
