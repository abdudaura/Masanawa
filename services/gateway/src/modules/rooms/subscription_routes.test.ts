import Fastify from "fastify";
import {describe,it,expect,vi} from "vitest";
import type {RoomActor,RoomSubscriptionsRepository} from "@masanawa/rooms";
import {registerRoomSubscriptionRoutes} from "./subscription_routes.js";
const fan:RoomActor={tenantId:"tenant_test",userId:"fan_test",roles:["fan"]};
const price={planId:"room-plan_123456",version:1,amountMinor:"199900",
 currency:"NGN",storeProductId:"maths_monthly",effectiveAt:"2026-10-01T00:00:00Z"};
const storeToken="valid_test_purchase_token_abcdef123456789";
function setup({active=true,actor=fan,binding="bound_fan"}:{
 active?:boolean;actor?:RoomActor;binding?:string;
}={}){
 const repo={
  listPlans:vi.fn(async()=>[price]),findHistoricalPrice:vi.fn(async()=>price),
  myEntitlements:vi.fn(async()=>[]),
  createPlan:vi.fn(async()=>price.planId),addPrice:vi.fn(async()=>price),
  activatePaid:vi.fn(async()=>{}),persistVerified:vi.fn(async()=>({
   roomId:"room_maths",planId:price.planId,priceVersion:1,state:"active",
   periodEnd:"2030-01-01T00:00:00Z"
  })),
  ownerForToken:vi.fn(async()=>null),applyNotification:vi.fn(async()=>"unlinked" as const)
 } as unknown as RoomSubscriptionsRepository;
 const verify=vi.fn(async()=>({
  packageName:"ng.unigeria.unigeria",storeProductId:"maths_monthly",
  subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",periodEnd:"2030-01-01T00:00:00Z",
  orderId:"GPA.test",acknowledged:true,obfuscatedAccountId:binding,
 }));
 const app=Fastify();
 registerRoomSubscriptionRoutes(app,{
  repository:repo,authorize:async()=>actor,
  play:{verify,acknowledge:vi.fn(async()=>{})},
  playPackageName:"ng.unigeria.unigeria",
  purchaseAccountBinding:()=> "bound_fan",
  paymentsEnabled:()=>active,verifyRtdnPush:async()=>false,
 });
 return {app,repo,verify};
}
const payload={planId:price.planId,priceVersion:1,purchaseToken:storeToken};
describe("J08 server-only paid subscription authorization",()=>{
 it("denies purchases while payment qualification gate is closed",async()=>{
  const {app,verify}=setup({active:false});
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_maths/subscription/verify",payload});
  expect(r.statusCode).toBe(410);expect(verify).not.toHaveBeenCalled();await app.close();
 });
 it("denies borrowed purchase tokens with a different verified account binding",async()=>{
  const {app,repo}=setup({binding:"someone_else"});
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_maths/subscription/verify",payload});
  expect(r.statusCode).toBe(403);expect(repo.persistVerified).not.toHaveBeenCalled();await app.close();
 });
 it("denies prices and plans invented by a fan without reaching Play",async()=>{
  const {app,verify}=setup();
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_maths/subscription/verify",
   payload:{...payload,priceVersion:99}});
  expect(r.statusCode).toBe(409);expect(verify).not.toHaveBeenCalled();await app.close();
 });
 it("persists only a provider-qualified token hash and never the raw token",async()=>{
  const {app,repo}=setup();
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_maths/subscription/verify",payload});
  expect(r.statusCode).toBe(200);
  const params=vi.mocked(repo.persistVerified).mock.calls[0]?.[0];
  expect(params?.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
  expect(JSON.stringify(params)).not.toContain(storeToken);await app.close();
 });
 it("rejects a price returned for another plan without reaching Play",async()=>{
  const {app,verify,repo}=setup();
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_maths/subscription/verify",
   payload:{...payload,planId:"room-plan_other"}});
  expect(r.statusCode).toBe(409);expect(verify).not.toHaveBeenCalled();
  expect(repo.persistVerified).not.toHaveBeenCalled();await app.close();
 });
 it("requires pricing_manager staff for plan writes and OIDC auth for RTDN",async()=>{
  const {app,repo}=setup();
  const r=await app.inject({method:"POST",url:"/v1/admin/rooms/room_maths/plans",payload:{period:"month"}});
  expect(r.statusCode).toBe(403);expect(repo.createPlan).not.toHaveBeenCalled();
  const push=await app.inject({method:"POST",url:"/v1/webhooks/play",payload:{}});
  expect(push.statusCode).toBe(403);await app.close();
 });
});
