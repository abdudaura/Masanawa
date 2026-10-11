import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {registerFeedMediaRoutes,type FeedMediaOptions} from "./media_routes.js";
const postId="381026c2-9d56-47b1-b73d-1784e24e41e2";
const mediaId="media_abcdefgh";
const url=`/v1/posts/${postId}/media/${mediaId}`;
const proof={tenantId:"tenant",postId,mediaId,authorMasanaId:"masana",kind:"audio" as const,transcript:"Speech"};
function options(overrides:Partial<FeedMediaOptions>={}):FeedMediaOptions{
 return {enabled:()=>true,tenant:()=>"tenant",principal:async()=>null,
 find:vi.fn(async()=>proof),sign:vi.fn(async()=>({url:"https://s3.example.test/token?sig=abc",contentType:"audio/mpeg",expiresAt:new Date(Date.now()+60000).toISOString()})),
 ...overrides};
}
describe("C23 signed media HTTP denial",()=>{
 it("returns only bounded no-store signed grants for approved media",async()=>{
  const app=Fastify();const o=options();await registerFeedMediaRoutes(app,o);
  const res=await app.inject({method:"GET",url});
  expect(res.statusCode).toBe(200);
  expect(res.headers["cache-control"]).toContain("no-store");
  expect(res.json().url).toMatch(/^https:/);
  expect(res.json().transcript).toBe("Speech");await app.close();
 });
 it("does not query storage when disabled",async()=>{
  const app=Fastify(),o=options({enabled:()=>false});await registerFeedMediaRoutes(app,o);
  expect((await app.inject({method:"GET",url})).statusCode).toBe(503);
  expect(o.find).not.toHaveBeenCalled();expect(o.sign).not.toHaveBeenCalled();await app.close();
 });
 it("denies mismatched tenant before media authorization",async()=>{
  const app=Fastify(),o=options({principal:async()=>({tenantId:"other"})});await registerFeedMediaRoutes(app,o);
  expect((await app.inject({method:"GET",url})).statusCode).toBe(403);
  expect(o.find).not.toHaveBeenCalled();await app.close();
 });
 it("does not sign unknown posts, invalid IDs or foreign proof",async()=>{
  const app=Fastify(),o=options({find:vi.fn(async()=>null)});await registerFeedMediaRoutes(app,o);
  expect((await app.inject({method:"GET",url})).statusCode).toBe(404);
  expect((await app.inject({method:"GET",url:"/v1/posts/wrong/media/media_abcdefgh"})).statusCode).toBe(422);
  expect(o.sign).not.toHaveBeenCalled();await app.close();
 });
 it("rejects HTTP, unbounded expiry and wrong content types",async()=>{
  for(const signed of [
   {url:"http://s3.example.test/object",contentType:"audio/mpeg",expiresAt:new Date(Date.now()+60000).toISOString()},
   {url:"https://s3.example.test/object",contentType:"audio/mpeg",expiresAt:new Date(Date.now()+600000).toISOString()},
   {url:"https://s3.example.test/object",contentType:"text/html",expiresAt:new Date(Date.now()+60000).toISOString()},
  ]){const app=Fastify();await registerFeedMediaRoutes(app,options({sign:async()=>signed}));
    expect((await app.inject({method:"GET",url})).statusCode).toBe(503);await app.close();}
 });
});
