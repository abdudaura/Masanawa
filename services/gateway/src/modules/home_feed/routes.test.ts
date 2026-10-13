import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {registerHomeFeedRoutes} from "./routes.js";
describe("J06 HTTP cannot publish as fan or leak across tenant",()=>{
 it("fails closed without feature enablement",async()=>{
  const app=Fastify();
  await registerHomeFeedRoutes(app,{service:{} as never,principal:async()=>null,tenant:()=>"tenant",isNewAccount:async()=>true,enabled:()=>false});
  const res=await app.inject({method:"GET",url:"/v1/feed"});
  expect(res.statusCode).toBe(503);await app.close();
 });
 it("denies a mismatched tenant before querying",async()=>{
  const app=Fastify();const list=vi.fn();
  await registerHomeFeedRoutes(app,{service:{list} as never,principal:async()=>({kind:"fan",tenantId:"foreign",id:"fan"}),tenant:()=>"tenant",isNewAccount:async()=>true,enabled:()=>true});
  const res=await app.inject({method:"GET",url:"/v1/feed"});
  expect(res.statusCode).toBe(403);expect(list).not.toHaveBeenCalled();await app.close();
 });
 it("rejects invalid discovery modes instead of expanding user visibility",async()=>{
  const app=Fastify();const list=vi.fn();
  await registerHomeFeedRoutes(app,{service:{list} as never,principal:async()=>null,tenant:()=>"tenant",isNewAccount:async()=>true,enabled:()=>true});
  const res=await app.inject({method:"GET",url:"/v1/feed?mode=administration"});
  expect(res.statusCode).toBe(422);expect(list).not.toHaveBeenCalled();await app.close();
 });
 it("requires authenticated identity for writes",async()=>{
  const app=Fastify();const publish=vi.fn();
  await registerHomeFeedRoutes(app,{service:{publish} as never,principal:async()=>null,tenant:()=>"tenant",isNewAccount:async()=>true,enabled:()=>true});
  const res=await app.inject({method:"POST",url:"/v1/admin/feed/posts",payload:{kind:"text",body:"No",authorMasanaId:"a"}});
  expect(res.statusCode).toBe(401);expect(publish).not.toHaveBeenCalled();await app.close();
 });
 it("C22 rejects arbitrary sort before querying the thread",async()=>{
  const app=Fastify(),comments=vi.fn();
  await registerHomeFeedRoutes(app,{service:{comments} as never,principal:async()=>null,
   tenant:()=>"tenant",isNewAccount:async()=>false,enabled:()=>true});
  const r=await app.inject({method:"GET",url:"/v1/posts/381026c2-9d56-47b1-b73d-1784e24e41e2/comments?sort=staff"});
  expect(r.statusCode).toBe(422);expect(comments).not.toHaveBeenCalled();await app.close();
 });
 it("C22 denies a reply from a guest and does not enqueue",async()=>{
  const app=Fastify(),comment=vi.fn();
  await registerHomeFeedRoutes(app,{service:{comment} as never,principal:async()=>null,
   tenant:()=>"tenant",isNewAccount:async()=>false,enabled:()=>true});
  const r=await app.inject({method:"POST",url:"/v1/posts/381026c2-9d56-47b1-b73d-1784e24e41e2/comments",
   headers:{"idempotency-key":"key-reply-001"},payload:{body:"secret",parentId:"9b8c8884-7a31-49d9-aee5-521364b54aef"}});
  expect(r.statusCode).toBe(401);expect(comment).not.toHaveBeenCalled();await app.close();
 });
 it("C22 takes author only from authenticated principal, not reply payload",async()=>{
  const app=Fastify(),comment=vi.fn(async()=>({id:"ok"}));
  await registerHomeFeedRoutes(app,{service:{comment} as never,
   principal:async()=>({kind:"fan",tenantId:"tenant",id:"trusted_fan"}),
   tenant:()=>"tenant",isNewAccount:async()=>true,enabled:()=>true});
  const parent="9b8c8884-7a31-49d9-aee5-521364b54aef",id="381026c2-9d56-47b1-b73d-1784e24e41e2";
  const r=await app.inject({method:"POST",url:"/v1/posts/"+id+"/comments",
   headers:{"idempotency-key":"key-reply-001"},payload:{body:"Answer",parentId:parent,fanId:"forged"}});
  expect(r.statusCode).toBe(200);
  expect(comment).toHaveBeenCalledWith({kind:"fan",tenantId:"tenant",id:"trusted_fan"},id,"Answer","key-reply-001",true,parent);
  await app.close();
 });

 it("C22 refuses non-string parent rather than creating a different root comment",async()=>{
  const app=Fastify(),comment=vi.fn();
  await registerHomeFeedRoutes(app,{service:{comment} as never,
   principal:async()=>({kind:"fan",tenantId:"tenant",id:"trusted_fan"}),
   tenant:()=>"tenant",isNewAccount:async()=>false,enabled:()=>true});
  const r=await app.inject({method:"POST",url:"/v1/posts/381026c2-9d56-47b1-b73d-1784e24e41e2/comments",
   headers:{"idempotency-key":"key-reply-001"},payload:{body:"Reply",parentId:{foreign:"id"}}});
  expect(r.statusCode).toBe(422);expect(comment).not.toHaveBeenCalled();
  await app.close();
 });

});
