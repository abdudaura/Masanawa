import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {registerDeliveryPreferenceRoutes} from "./delivery_preferences_routes.js";
const actor={tenantId:"tenant_1",fanUserId:"fan_1",signedIn:true as const};
function fixture(auth=true,enabled=true){
 const app=Fastify();
 const list=vi.fn().mockResolvedValue([{kind:"room_answer",enabled:false}]);
 const set=vi.fn().mockImplementation(async (_who,choice)=>choice);
 const principal=vi.fn().mockResolvedValue(auth?actor:null);
 registerDeliveryPreferenceRoutes(app,{preferences:{list,set,pushEnabled:vi.fn()},resolvePrincipal:principal,enabled:()=>enabled});
 return {app,list,set,principal};
}
describe("C06 Gateway optional push preferences",()=>{
 it("does no identity or database work when feature is off",async()=>{
  const f=fixture(true,false);
  const r=await f.app.inject({method:"GET",url:"/v1/notification-preferences"});
  expect(r.statusCode).toBe(503);expect(f.principal).not.toHaveBeenCalled();
 });
 it("blocks unauthenticated reads and mutation",async()=>{
  const f=fixture(false);
  expect((await f.app.inject({method:"GET",url:"/v1/notification-preferences"})).statusCode).toBe(401);
  expect((await f.app.inject({method:"PUT",url:"/v1/notification-preferences/wallet",payload:{enabled:true}})).statusCode).toBe(401);
  expect(f.set).not.toHaveBeenCalled();
 });
 it("blocks forged fields, invalid kind and nonboolean choices",async()=>{
  const f=fixture();
  for (const payload of [{enabled:true,userId:"other"},{enabled:"true"},{enabled:1},{}]) {
    const r=await f.app.inject({method:"PUT",url:"/v1/notification-preferences/wallet",payload});
    expect(r.statusCode).toBe(422);
  }
  const r=await f.app.inject({method:"PUT",url:"/v1/notification-preferences/other",payload:{enabled:true}});
  expect(r.statusCode).toBe(422);expect(f.set).not.toHaveBeenCalled();
 });
 it("persists choice, returns verified readback and no-store",async()=>{
  const f=fixture();
  const r=await f.app.inject({method:"PUT",url:"/v1/notification-preferences/comment_reply",payload:{enabled:false}});
  expect(r.statusCode).toBe(200);expect(r.json()).toEqual({kind:"comment_reply",enabled:false});
  expect(r.headers["cache-control"]).toBe("no-store");
  expect(f.set).toHaveBeenCalledWith({tenantId:"tenant_1",fanUserId:"fan_1"},{kind:"comment_reply",enabled:false});
 });
});
