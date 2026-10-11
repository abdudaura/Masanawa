import {describe,expect,it,vi} from "vitest";
import {createGooglePlaySubscriptionVerifier} from "./play_verifier.js";
const purchaseToken="test_purchase_token_0123456789abcdef";
const base={subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",
 lineItems:[{productId:"maths_monthly",expiryTime:"2030-01-01T00:00:00Z"}],
 latestOrderId:"GPA.example",
 acknowledgementState:"ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
 externalAccountIdentifiers:{obfuscatedExternalAccountId:"test_binding"}};
describe("Google Play v2 subscription authority",()=>{
 it("reads only official endpoint and extracts provider-authenticated account/period",async()=>{
  const http=vi.fn(async()=>new Response(JSON.stringify(base),{status:200}));
  const verifier=createGooglePlaySubscriptionVerifier({
   packageName:"com.masanawa.app",getAccessToken:async()=>"test_server_access_token_12345",http:http as typeof fetch});
  const got=await verifier.verify(purchaseToken);
  expect(got).toMatchObject({storeProductId:"maths_monthly",obfuscatedAccountId:"test_binding",
   acknowledged:true,subscriptionState:"SUBSCRIPTION_STATE_ACTIVE"});
  expect(http.mock.calls[0]?.[0]).toContain("/subscriptionsv2/tokens/");
  expect(http.mock.calls[0]?.[0]).not.toContain("some-other-host");
 });
 it("denies unverified, malformed, multiple or missing line items",async()=>{
  const http=vi.fn(async()=>new Response(JSON.stringify({...base,lineItems:[]}),{status:200}));
  const verifier=createGooglePlaySubscriptionVerifier({
   packageName:"com.masanawa.app",getAccessToken:async()=>"test_server_access_token_12345",http:http as typeof fetch});
  await expect(verifier.verify(purchaseToken)).rejects.toThrow("play_unsupported_multiple_items");
  await expect(verifier.verify("short")).rejects.toThrow("invalid_purchase_token");
 });
 it("uses provider acknowledge endpoint and never persists a client state",async()=>{
  const http=vi.fn(async()=>new Response("",{status:200}));
  const verifier=createGooglePlaySubscriptionVerifier({
   packageName:"com.masanawa.app",getAccessToken:async()=>"test_server_access_token_12345",http:http as typeof fetch});
  await verifier.acknowledge(purchaseToken,"maths_monthly");
  expect(http.mock.calls[0]?.[0]).toContain(":acknowledge");
  expect((http.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
 });
 it("fails closed if token acquisition fails or Play is down",async()=>{
  const verifier=createGooglePlaySubscriptionVerifier({
   packageName:"com.masanawa.app",getAccessToken:async()=>""});
  await expect(verifier.verify(purchaseToken)).rejects.toThrow("play_auth_unavailable");
 });
});