import {describe,it,expect,vi} from "vitest";
import {createFanMemoryService,FanMemoryError,type FanMemoryStore} from "./service.js";
const id="character_018e2c08-6bf7-7b18-96db-013326750ad1";
const actor={tenantId:"tenant_self",userId:"user_self"};
function store():FanMemoryStore{
 return {read:vi.fn().mockResolvedValue({characterId:id,enabled:false,revision:0,
  items:[{id:"private",content:"SECRET",updatedAt:"",expiresAt:null}]}),
 setEnabled:vi.fn().mockResolvedValue({characterId:id,enabled:false,revision:1,
  items:[{id:"private",content:"SECRET",updatedAt:"",expiresAt:null}]}),
 enqueueErase:vi.fn().mockResolvedValue({requestId:"r",state:"queued"})};
}
describe("J11 fan memory",()=>{
 it("hides all stored content while consent disabled",async()=>{
  const api=createFanMemoryService(store());
  expect((await api.view(actor,id)).items).toEqual([]);
  expect((await api.consent(actor,id,{enabled:false,expectedRevision:0})).items).toEqual([]);
 });
 it("rejects client-supplied privilege fields",async()=>{
  await expect(createFanMemoryService(store()).consent(actor,id,
    {enabled:true,expectedRevision:0,admin:true})).rejects.toBeInstanceOf(FanMemoryError);
 });
 it("fails closed on invalid idempotency and cross-record-shaped IDs",async()=>{
  const api=createFanMemoryService(store());
  await expect(api.erase(actor,id,null,"x")).rejects.toMatchObject({status:400});
  await expect(api.erase(actor,id,"foreign_record","valid-erasure-key")).rejects.toMatchObject({status:400});
  expect((await api.erase(actor,id,null,"valid-erasure-key")).state).toBe("queued");
 });
});
