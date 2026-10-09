import Fastify from "fastify";
import { afterEach,describe,expect,it,vi } from "vitest";
import { registerHumanVoiceRoutes } from "./routes.js";
import { createPrivateVoiceNoteService } from "./service.js";
import type { VoiceNoteRepository } from "./model.js";
import { validOpus } from "./ogg_opus_test_fixture.js";

const conversationId="00000000-0000-4000-8000-000000000001";
const messageId="00000000-0000-4000-8000-000000000002";
const requestId="requestABC1234";
const audio=validOpus();
function fixture(){
 let permitted=true,objects=0;
 const receipt={
  messageId,conversationId,sequence:"1",senderUserId:"user_a",
  clientRequestId:requestId,durationMs:1000,sizeBytes:audio.length,
  mimeType:"audio/ogg" as const,createdAt:new Date().toISOString(),deletedAt:null,
 };
 const repository={
  stage:vi.fn(async(stage)=>permitted?stage:"forbidden" as const),
  attach:vi.fn(async()=>permitted?receipt:"forbidden" as const),
  find:vi.fn(async()=>permitted?{...receipt,objectKey:"dm-voice/private",sha256:
   "bad"}:null),
  list:vi.fn(async()=>permitted?[receipt]:null),
  remove:vi.fn(async()=>permitted),
  stale:vi.fn(async()=>[]),
  deleted:vi.fn(async()=>{}),
 } satisfies VoiceNoteRepository;
 const svc=createPrivateVoiceNoteService({
  authorizer:{authorize:async ({authorizationHeader})=>{
   if(authorizationHeader!=="Bearer approved")throw Object.assign(new Error("unauthorized"),{statusCode:401});
   return {tenantId:"tenant_a",userId:"user_a"} as never;
  }},
  repository,
  objects:{
   put:async()=>{objects++},get:async()=>audio,delete:async()=>{},
  },
 });
 const app=Fastify();
 app.setErrorHandler((error,_request,reply)=>reply.code((error as Error & {statusCode?: number}).statusCode??500)
  .send({code:(error as Error).message}));
 registerHumanVoiceRoutes(app,svc);
 return {app,repository,deny:()=>{permitted=false},get objects(){return objects}};
}
const opened:ReturnType<typeof fixture>[]=[];
afterEach(async()=>{for(const f of opened.splice(0))await f.app.close()});
describe("C04 private audio HTTP admission",()=>{
 it("needs a verified bearer and never stages anonymous payloads",async()=>{
  const f=fixture();opened.push(f);
  const r=await f.app.inject({method:"POST",url:`/messages/${conversationId}/voice-notes`,
   headers:{"content-type":"audio/ogg","x-message-client-request-id":requestId},payload:audio});
  expect(r.statusCode).toBe(401);
  expect(r.headers['cache-control']).toBe('no-store, private');
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  expect(f.repository.stage).not.toHaveBeenCalled();
 });
 it("returns 201 only after durable upload; 413 for oversized audio",async()=>{
  const f=fixture();opened.push(f);
  const headers={"content-type":"audio/ogg","authorization":"Bearer approved",
   "x-message-client-request-id":requestId};
  const ok=await f.app.inject({method:"POST",url:`/messages/${conversationId}/voice-notes`,
   headers,payload:audio});
  expect(ok.statusCode).toBe(201);
  expect(ok.headers['cache-control']).toBe('no-store, private');
  expect(ok.json()).toMatchObject({messageId,clientRequestId:requestId});
  expect(f.objects).toBe(1);
  const big=await f.app.inject({method:"POST",url:`/messages/${conversationId}/voice-notes`,
   headers,payload:Buffer.alloc(1536*1024+1)});
  expect(big.statusCode).toBe(413);
  expect(f.objects).toBe(1);
 });
 it("rechecks revoked readers; does not hand out private object URLs",async()=>{
  const f=fixture();opened.push(f);
  const before=await f.app.inject({method:"GET",url:`/messages/${conversationId}/voice-notes`,
   headers:{authorization:"Bearer approved"}});
  expect(before.statusCode).toBe(200);
  expect(before.headers['cache-control']).toBe('no-store, private');
  expect(before.headers['x-content-type-options']).toBe('nosniff');
  expect(before.body).not.toContain("objectKey");
  f.deny();
  const revoked=await f.app.inject({method:"GET",url:`/messages/voice/${messageId}`,
   headers:{authorization:"Bearer approved"}});
  expect(revoked.statusCode).toBe(404);
 });
});
