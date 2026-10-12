import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {registerTelegramIngressRoutes} from "./telegram_routes.js";
import type {TelegramInboxStore,TelegramPrivateContentStore,TelegramIngestResult} from "@masanawa/masana-social";
const secret="Official_test_secret_with_40_characters_1234";
const fanKey="separate_32byte_fan_hash_key_for_tests_123456";
const update=(text:string)=>({update_id:45,message:{text,
 chat:{type:"private",id:554433},from:{id:554433,is_bot:false}}});
function make({enabled=true,approved=true,consent=true}={}){
 const bot={tenantId:"tenant_one",identityId:"social_valididentity123",
  characterId:"masana_a",consentVersion:"telegram-consent-v1"};
 const admit=vi.fn(async (..._args:Parameters<TelegramInboxStore["admit"]>):Promise<TelegramIngestResult>=> "queued");
 const put=vi.fn(async (..._args:Parameters<TelegramPrivateContentStore["put"]>)=> "private:encrypted/source/45");
 const discard=vi.fn(async (..._args:Parameters<TelegramPrivateContentStore["discard"]>)=>{});
 const inbox={
  authorizedBot:vi.fn(async()=>approved?bot:null),
  isConsented:vi.fn(async()=>consent),
  admit,
  canDispatch:vi.fn(async()=>consent),
 } satisfies TelegramInboxStore;
 const app=Fastify();
 registerTelegramIngressRoutes(app,{enabled:()=>enabled,inbox,
  vault:{webhookSecret:async()=>secret,fanHashKey:async()=>fanKey},
  privateContent:{put,discard}});
 return {app,inbox,admit,put,discard};
}
describe("J22 Telegram webhook authentication, consent and privacy",()=>{
 it("rejects forged secret before parsing or storing a message",async()=>{
  const x=make();
  const r=await x.app.inject({method:"POST",url:"/v1/webhooks/telegram/social_valididentity123",
   headers:{"x-telegram-bot-api-secret-token":"attacker_invalid_secret_40_chars_1234"},
   payload:update("private text")});
  expect(r.statusCode).toBe(403);expect(x.put).not.toHaveBeenCalled();
  expect(x.admit).not.toHaveBeenCalled();await x.app.close();
 });
 it("stays off without qualified bot permission",async()=>{
  const x=make({enabled:false});const r=await x.app.inject({method:"POST",
   url:"/v1/webhooks/telegram/social_valididentity123",
   headers:{"x-telegram-bot-api-secret-token":secret},payload:update("/agree")});
  expect(r.statusCode).toBe(410);expect(x.admit).not.toHaveBeenCalled();await x.app.close();
 });
 it("persists /agree without storing raw chat content",async()=>{
  const x=make();const r=await x.app.inject({method:"POST",
   url:"/v1/webhooks/telegram/social_valididentity123",
   headers:{"x-telegram-bot-api-secret-token":secret},payload:update("/agree")});
  expect(r.statusCode).toBe(202);expect(x.put).not.toHaveBeenCalled();
  expect(x.admit.mock.calls[0]?.[2]).toMatch(/^[a-f0-9]{64}$/);
  expect(x.admit.mock.calls[0]?.[2]).not.toContain("554433");await x.app.close();
 });
 it("never stores unsolicited text without consent",async()=>{
  const x=make({consent:false});const r=await x.app.inject({method:"POST",
   url:"/v1/webhooks/telegram/social_valididentity123",
   headers:{"x-telegram-bot-api-secret-token":secret},payload:update("hello")});
  expect(r.statusCode).toBe(202);expect(x.put).not.toHaveBeenCalled();await x.app.close();
 });
 it("only queues opaque private refs for consented fans",async()=>{
  const x=make();const r=await x.app.inject({method:"POST",
   url:"/v1/webhooks/telegram/social_valididentity123",
   headers:{"x-telegram-bot-api-secret-token":secret},payload:update("hello")});
  expect(r.statusCode).toBe(202);expect(x.put).toHaveBeenCalledTimes(1);
  expect(x.admit.mock.calls[0]?.[3]).toBe("private:encrypted/source/45");
  expect(x.put.mock.calls[0]?.[0]?.chatId).toBe("554433");
  expect(x.discard).not.toHaveBeenCalled();
  expect(r.body).not.toContain("hello");await x.app.close();
 });
 it("discards encrypted content on consent revocation between read and atomic admission",async()=>{
  const x=make();x.admit.mockResolvedValueOnce("denied");
  const r=await x.app.inject({method:"POST",url:"/v1/webhooks/telegram/social_valididentity123",
   headers:{"x-telegram-bot-api-secret-token":secret},payload:update("hello")});
  expect(r.statusCode).toBe(200);expect(x.discard).toHaveBeenCalledTimes(1);
  await x.app.close();
 });
});
