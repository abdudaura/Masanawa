import {describe,it,expect,vi} from "vitest";
import {createPgDeliveryPreferences} from "./delivery_preferences.js";
const actor={tenantId:"tenant_1",fanUserId:"fan_1"};
describe("C06 tenant-fenced delivery choices",()=>{
 it("selects only principal tenant/user and defaults absent categories off",async()=>{
  const query=vi.fn().mockResolvedValue({rows:[{kind:"room_answer",enabled:true}]});
  const data=createPgDeliveryPreferences({query} as never);
  const items=await data.list(actor);
  expect(items).toHaveLength(6);
  expect(items.find(v=>v.kind==="wallet")?.enabled).toBe(false);
  expect(items.find(v=>v.kind==="room_answer")?.enabled).toBe(true);
  expect(query.mock.calls[0]?.[1]).toEqual(["tenant_1","fan_1"]);
 });
 it("rejects forged principal and malformed values before SQL",async()=>{
  const query=vi.fn();
  const data=createPgDeliveryPreferences({query} as never);
  await expect(data.set({tenantId:"",fanUserId:"fan_1"},{kind:"wallet",enabled:true})).rejects.toThrow();
  await expect(data.set(actor,{kind:"wallet",enabled:"yes" as never})).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
 });
 it("requires authoritative state readback, stable opt in and exact SQL scope",async()=>{
  const query=vi.fn().mockResolvedValue({rows:[{kind:"wallet",enabled:true}]});
  const data=createPgDeliveryPreferences({query} as never);
  await expect(data.set(actor,{kind:"wallet",enabled:true})).resolves.toEqual({kind:"wallet",enabled:true});
  expect(query.mock.calls[0]?.[1]).toEqual(["tenant_1","fan_1","wallet",true]);
 });
 it("fails closed when preference row does not exist",async()=>{
  const query=vi.fn().mockResolvedValue({rows:[]});
  const data=createPgDeliveryPreferences({query} as never);
  await expect(data.pushEnabled(actor,"comment_reply")).resolves.toBe(false);
 });
});
