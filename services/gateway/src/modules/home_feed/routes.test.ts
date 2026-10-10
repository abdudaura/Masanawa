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
 it("requires authenticated identity for writes",async()=>{
  const app=Fastify();const publish=vi.fn();
  await registerHomeFeedRoutes(app,{service:{publish} as never,principal:async()=>null,tenant:()=>"tenant",isNewAccount:async()=>true,enabled:()=>true});
  const res=await app.inject({method:"POST",url:"/v1/admin/feed/posts",payload:{kind:"text",body:"No",authorMasanaId:"a"}});
  expect(res.statusCode).toBe(401);expect(publish).not.toHaveBeenCalled();await app.close();
 });
});
