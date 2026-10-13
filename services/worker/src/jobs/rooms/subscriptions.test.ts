import {describe,expect,it,vi} from "vitest";
import {createRoomSubscriptionJob} from "./subscriptions.js";
import type {RoomSubscriptionsRepository} from "@masanawa/rooms";
const purchaseToken="room_token_that_is_long_enough_012345";
function build({enabled=true,owner="t1",period="2030-01-01T00:00:00Z"}={}){
 const applyNotification=vi.fn(async (_input:Parameters<RoomSubscriptionsRepository['applyNotification']>[0])=>"linked" as const);
 const repo={ownerForToken:vi.fn(async()=>owner),applyNotification} as unknown as RoomSubscriptionsRepository;
 const verify=vi.fn(async()=>({
  packageName:"ng.unigeria.unigeria",storeProductId:"maths_monthly",
  subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",periodEnd:period,
  orderId:"GPA.test",acknowledged:true,obfuscatedAccountId:"bound"
 }));
 const notify=vi.fn(async()=>{});
 const process=createRoomSubscriptionJob({enabled:()=>enabled,
  play:{verify,acknowledge:vi.fn(async()=>{})},
  repository:repo,playPackageName:"ng.unigeria.unigeria",onChanged:notify});
 const event={tenantId:"t1",roomId:"room_math",userId:"fan_1",purchaseToken,
  notificationId:"google-event-123",eventType:"renewed"};
 return {process,verify,repo,applyNotification,notify,event};
}
describe("J08 subscription worker fail-closed",()=>{
 it("does not contact Play if the feature is disabled",async()=>{
  const x=build({enabled:false});expect(await x.process(x.event)).toBe("disabled");
  expect(x.verify).not.toHaveBeenCalled();
 });
 it("fails closed for cross-tenant token before Play",async()=>{
  const x=build({owner:"other"});expect(await x.process(x.event)).toBe("unlinked");
  expect(x.verify).not.toHaveBeenCalled();
 });
 it("applies only provider reverified token hash, then notifies",async()=>{
  const x=build();expect(await x.process(x.event)).toBe("linked");
  const input=x.applyNotification.mock.calls[0]?.[0];
  expect(input?.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
  expect(JSON.stringify(input)).not.toContain(purchaseToken);
  expect(x.notify).toHaveBeenCalledTimes(1);
 });
 it("must not grant future access for an expired receipt",async()=>{
  const x=build({period:"2020-01-01T00:00:00Z"});
  expect(await x.process(x.event)).toBe("linked");
  expect(x.applyNotification.mock.calls[0]?.[0]?.state).toBe("expired");
 });
});
