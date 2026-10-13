import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {registerStatusRuntime,type StatusRuntime} from "./runtime.js";
function ports(){
 const list=vi.fn(async()=>({items:[],nextCursor:null}));
 const create=vi.fn(async()=>({id:"draft",state:"draft"}));
 const authorize=vi.fn(async({authorizationHeader}:{authorizationHeader:string|undefined})=>{
  if(authorizationHeader!=="Bearer valid")throw Object.assign(new Error("unauthorized"),{statusCode:401,code:"UNAUTHORIZED"});
  return {tenantId:"trusted_tenant",userId:"trusted_user"};
 });
 return {list,create,authorize,options:{
  sessions:{authorize},feed:{list} as never,editorial:{create} as never,
 } satisfies StatusRuntime};
}
describe("connected Status canonical session and feature registration",()=>{
 it("authenticates even feed reads; forged body/headers cannot select tenant or user",async()=>{
  const p=ports(),app=Fastify();await registerStatusRuntime(app,p.options);
  expect((await app.inject("/v1/feed")).statusCode).toBe(401);
  const r=await app.inject({url:"/v1/feed",headers:{authorization:"Bearer valid","x-tenant-id":"foreign","x-user-id":"another"}});
  expect(r.statusCode).toBe(200);
  expect(p.list).toHaveBeenCalledWith("trusted_tenant","trusted_user","for_you",undefined);
  await app.close();
 });
 it("maps unavailable session/storage to typed 503 without leaking internals",async()=>{
  const p=ports();p.list.mockRejectedValue(new Error("private SQL connection string"));
  const app=Fastify();await registerStatusRuntime(app,p.options);
  const r=await app.inject({url:"/v1/feed",headers:{authorization:"Bearer valid"}});
  expect(r.statusCode).toBe(503);expect(r.json()).toEqual({code:"status_unavailable"});
  await app.close();
 });
 it("editor permission comes only from the server callback, never a caller header",async()=>{
  const p=ports(),app=Fastify();await registerStatusRuntime(app,p.options);
  const r=await app.inject({method:"POST",url:"/v1/admin/feed/drafts",headers:{authorization:"Bearer valid","x-role":"content_editor"},payload:{authorMasanaId:"masana",kind:"text",body:"hello"}});
  expect(r.statusCode).toBe(403);expect(p.create).not.toHaveBeenCalled();await app.close();
 });
 it("the verified editor uses the existing draft workflow rather than direct publishing",async()=>{
  const p=ports(),app=Fastify();await registerStatusRuntime(app,{...p.options,isEditor:async s=>s.userId==="trusted_user"});
  const r=await app.inject({method:"POST",url:"/v1/admin/feed/drafts",headers:{authorization:"Bearer valid"},payload:{authorMasanaId:"masana",kind:"text",body:"hello"}});
  expect(r.statusCode).toBe(200);
  expect(p.create).toHaveBeenCalledWith(expect.objectContaining({kind:"staff",tenantId:"trusted_tenant",id:"trusted_user"}),expect.anything());
  const direct=await app.inject({method:"POST",url:"/v1/admin/feed/posts",headers:{authorization:"Bearer valid"},payload:{authorMasanaId:"masana",kind:"text",body:"bypass"}});
  expect(direct.statusCode).toBe(410);await app.close();
 });
 it("disabled feature performs no session or storage work",async()=>{
  const p=ports(),app=Fastify();await registerStatusRuntime(app,{...p.options,enabled:()=>false});
  expect((await app.inject("/v1/feed")).statusCode).toBe(503);
  expect(p.authorize).not.toHaveBeenCalled();expect(p.list).not.toHaveBeenCalled();await app.close();
 });
 it("signed media receives the authenticated tenant before its handler checks it",async()=>{
  const p=ports(),app=Fastify();const id="381026c2-9d56-47b1-b73d-1784e24e41e2";
  const find=vi.fn(async()=>({tenantId:"trusted_tenant",postId:id,mediaId:"media_abcdefgh",authorMasanaId:"masana",kind:"image" as const,transcript:null}));
  await registerStatusRuntime(app,{...p.options,media:{find,
   sign:async()=>({url:"https://approved.example/signed-object",contentType:"image/png",expiresAt:new Date(Date.now()+60000).toISOString()}),
   approvedDownloadOrigin:origin=>origin==="https://approved.example"}});
  const r=await app.inject({url:`/v1/posts/${id}/media/media_abcdefgh`,headers:{authorization:"Bearer valid","x-tenant-id":"foreign"}});
  expect(r.statusCode).toBe(200);expect(find).toHaveBeenCalledWith("trusted_tenant",id,"media_abcdefgh");
  expect(p.authorize).toHaveBeenCalledTimes(1);await app.close();
 });

});
