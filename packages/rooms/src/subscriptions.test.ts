import {describe,expect,it} from "vitest";
import {RoomError} from "./index.js";
import {authorizedState,parsePurchaseToken,requirePricingStaff,validatePrice,purchaseTokenHash} from "./subscriptions.js";
const evidence={packageName:"com.masanawa.app",storeProductId:"maths_monthly",subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",periodEnd:"2030-01-01T00:00:00Z",orderId:"GPA.test",acknowledged:true,obfuscatedAccountId:'bound_account'};
describe("J08 no client-granted entitlements",()=>{
 it("accepts only provider states with an unexpired period",()=>{
  expect(authorizedState(evidence,Date.parse("2029-01-01"))).toBe("active");
  expect(authorizedState({...evidence,subscriptionState:"SUBSCRIPTION_STATE_IN_GRACE_PERIOD"},Date.parse("2029-01-01"))).toBe("grace");
  expect(authorizedState({...evidence,subscriptionState:"SUBSCRIPTION_STATE_CANCELED"},Date.parse("2029-01-01"))).toBe("active");
  expect(authorizedState({...evidence,subscriptionState:"SUBSCRIPTION_STATE_ON_HOLD"})).toBe("on_hold");
  expect(authorizedState(evidence,Date.parse("2031-01-01"))).toBe("expired");
  expect(()=>authorizedState({...evidence,subscriptionState:"SUBSCRIPTION_STATE_PENDING"})).toThrow(RoomError);
 });
 it("never accepts arbitrary purchase identities or forged staff",()=>{
  for(const token of ["short","https://evil","a".repeat(2049),null])expect(()=>parsePurchaseToken(token)).toThrow(RoomError);
  expect(purchaseTokenHash("x".repeat(30))).toHaveLength(64);
  expect(()=>requirePricingStaff(["rooms_editor","fan"])).toThrow(RoomError);
  expect(()=>requirePricingStaff(["pricing_manager"])).not.toThrow();
 });
 it("requires exact minor units and permitted product IDs",()=>{
  expect(()=>validatePrice({amountMinor:"100.25",currency:"NGN",storeProductId:"maths_monthly",effectiveAt:"2026-11-01"})).toThrow(RoomError);
  expect(()=>validatePrice({amountMinor:"1000",currency:"NGN",storeProductId:"https://bad",effectiveAt:"2026-11-01"})).toThrow(RoomError);
  expect(()=>validatePrice({amountMinor:"1000",currency:"NGN",storeProductId:"maths_monthly",effectiveAt:"2026-11-01"})).not.toThrow();
 });
});

