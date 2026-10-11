import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {registerAdminFeedReviewRoutes} from "./admin_review_routes.js";
import {registerHomeFeedRoutes} from "./routes.js";
const editor={kind:"staff" as const,tenantId:"t1",id:"editor",permissions:["content_editor"]};
const draft={authorMasanaId:"m1",kind:"text",body:"Approved story",idempotencyKey:"editorial-req01"};
function mock(){return {create:vi.fn(async()=>({id:"new",state:"draft",revision:0})),list:vi.fn(async()=>[]),get:vi.fn(async()=>null),change:vi.fn(async()=>({state:"in_review",revision:1}))};}
const options=(service:ReturnType<typeof mock>,principal:()=>Promise<any>=async()=>editor)=>
 ({service:service as never,principal,tenant:()=>"t1",enabled:()=>true});
describe("A05/A06 admin editorial HTTP",()=>{
 it("retired direct publisher refuses even an authorized staff principal",async()=>{
  const app=Fastify(),publish=vi.fn();
  await registerHomeFeedRoutes(app,{service:{publish} as never,
   principal:async()=>editor,tenant:()=>"t1",isNewAccount:async()=>false,enabled:()=>true});
  const r=await app.inject({method:"POST",url:"/v1/admin/feed/posts",
   headers:{"idempotency-key":"direct-bypass"},payload:{authorMasanaId:"m1",kind:"text",body:"bypass"}});
  expect(r.statusCode).toBe(410);expect(publish).not.toHaveBeenCalled();await app.close();
 });

 it("fan and foreign-tenant staff cannot draft, review or approve",async()=>{
  const app=Fastify(),service=mock();await registerAdminFeedReviewRoutes(app,options(service,async()=>({kind:"fan",tenantId:"t1",id:"fan"})));
  const a=await app.inject({method:"POST",url:"/v1/admin/feed/drafts",headers:{"idempotency-key":"editorial-req01"},payload:draft});
  expect(a.statusCode).toBe(403);expect(service.create).not.toHaveBeenCalled();await app.close();
  const foreign=Fastify();await registerAdminFeedReviewRoutes(foreign,options(service,async()=>({...editor,tenantId:"foreign"})));
  const r=await foreign.inject({method:"GET",url:"/v1/admin/feed/review"});
  expect(r.statusCode).toBe(403);expect(service.list).not.toHaveBeenCalled();await foreign.close();
 });
 it("author derives only from session, never forged actor body",async()=>{
  const app=Fastify(),service=mock();await registerAdminFeedReviewRoutes(app,options(service));
  const r=await app.inject({method:"POST",url:"/v1/admin/feed/drafts",headers:{"idempotency-key":"editorial-req01"},
   payload:{...draft,actor:{id:"super_admin"},tenantId:"other"}});
  expect(r.statusCode).toBe(200);expect(service.create).toHaveBeenCalledWith(editor,expect.objectContaining({authorMasanaId:"m1",idempotencyKey:"editorial-req01"}));await app.close();
 });
 it("validates action and revision before touching persistence",async()=>{
  const app=Fastify(),service=mock();await registerAdminFeedReviewRoutes(app,options(service));
  const r=await app.inject({method:"POST",url:"/v1/admin/feed/posts/uuid/transition",
   payload:{action:"delete_financial_data",expectedRevision:0}});
  expect(r.statusCode).toBe(422);expect(service.change).not.toHaveBeenCalled();await app.close();
 });
 it("fails closed without feature activation",async()=>{
  const app=Fastify(),service=mock();await registerAdminFeedReviewRoutes(app,{...options(service),enabled:()=>false});
  const r=await app.inject({method:"GET",url:"/v1/admin/feed/review"});
  expect(r.statusCode).toBe(503);expect(service.list).not.toHaveBeenCalled();await app.close();
 });
 it("requires independent authorization to be enforced by service",async()=>{
  const app=Fastify(),service=mock();
  service.change.mockRejectedValue(Object.assign(new Error("forbidden"),{status:403,code:"separate_reviewer_required"}));
  await registerAdminFeedReviewRoutes(app,options(service));
  const r=await app.inject({method:"POST",url:"/v1/admin/feed/posts/uuid/transition",
   headers:{"idempotency-key":"approve-req001"},payload:{action:"approve",expectedRevision:2}});
  expect(r.statusCode).toBe(403);expect(r.json().code).toBe("separate_reviewer_required");await app.close();
 });
});
