import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {createOfficialTelegramVerifier,registerTelegramAuthorizationRoutes} from "./telegram_admin.js";
import type {TelegramAuthorizationStore} from "@masanawa/masana-social";
const tenant="t1",id="social_telegram12345";
const valid={botId:"123456789",username:"SampleMasanaBot",authorizationRef:"vault:telegram/bot_12345",
 evidenceRef:"evidence:approved/bot_12345",checkedAt:"2030-01-01T00:00:00Z",
 expiresAt:"2030-01-02T00:00:00Z"};
const actor={tenantId:tenant,userId:"staff1",principalType:"staff" as const,
 roles:["ops_admin"] as const};
function setup(enabled=true,staff:typeof actor|undefined=actor){
 const authorize=vi.fn(async (..._args:Parameters<TelegramAuthorizationStore["authorize"]>)=>({identityId:id,revision:2,
  mode:"verified_automation_eligible" as const,expiresAt:valid.expiresAt}));
 const verifier={verify:vi.fn(async()=>valid)};
 const app=Fastify();
 registerTelegramAuthorizationRoutes(app,{enabled:()=>enabled,
  auth:{authenticateStaff:async()=>staff},verifier,store:{authorize}});
 return {app,authorize,verifier};
}
const url="/v1/admin/masana/masana_gwani/telegram/"+id+"/authorize";
describe("J22 staff bot credential authorization",()=>{
 it("denies when global provider gate is disabled",async()=>{
  const s=setup(false);const r=await s.app.inject({method:"POST",url,
   payload:{credentialAlias:"safealias",revision:1}});
  expect(r.statusCode).toBe(410);expect(s.authorize).not.toHaveBeenCalled();await s.app.close();
 });
 it("requires trusted ops principal; never accepts spoofed request roles",async()=>{
  const s=setup(true,undefined);const r=await s.app.inject({method:"POST",url,
   payload:{credentialAlias:"safealias",revision:1,roles:["super_admin"],tenantId:"other"}});
  expect(r.statusCode).toBe(403);expect(s.verifier.verify).not.toHaveBeenCalled();
  await s.app.close();
 });
 it("writes only vetted provider proof through tenant-scoped transactional store",async()=>{
  const s=setup();const r=await s.app.inject({method:"POST",url,
   payload:{credentialAlias:"safealias",revision:1}});
  expect(r.statusCode).toBe(200);
  expect(s.authorize.mock.calls[0]?.[0]?.tenantId).toBe(tenant);
  expect(JSON.stringify(s.authorize.mock.calls)).not.toContain("secret");
  await s.app.close();
 });
 it("checks the official Telegram getMe and webhook rather than caller claims",async()=>{
  const http=vi.fn(async(url:string)=>new Response(JSON.stringify({
   ok:true,result:url.endsWith("/getMe")?{id:123456789,is_bot:true,username:"SampleMasanaBot"}
     :{url:"https://gateway.example.com/v1/webhooks/telegram/"+id}}),{status:200}));
  const proof=createOfficialTelegramVerifier({
   vault:{get:async()=>({token:"123456789:"+("T".repeat(40)),
    authorizationRef:valid.authorizationRef,evidenceRef:valid.evidenceRef,webhookSecretConfigured:true})},
   expectedWebhookUrl:(x)=>"https://gateway.example.com/v1/webhooks/telegram/"+x,
   http:http as unknown as typeof fetch,clock:()=>1893456000000});
  const checked=await proof.verify({tenantId:tenant,identityId:id,credentialAlias:"safealias"});
  expect(checked.username).toBe("SampleMasanaBot");
  expect(checked.expiresAt).toBe("2030-01-02T00:00:00.000Z");
  expect(http).toHaveBeenCalledTimes(2);
 });
});
