import Fastify from "fastify";
import { vi } from "vitest";
import { describe, it, expect, afterEach } from "vitest";
import { OperationsError, type OperationsService } from "./service.js";
import { registerAdminOperationsRoutes } from "./routes.js";
const apps:ReturnType<typeof Fastify>[]=[];
afterEach(async()=>{await Promise.all(apps.splice(0).map(x=>x.close()));});
describe("J19 actual HTTP endpoint denied paths",()=>{
 function create() {
  const app=Fastify();apps.push(app);
  const mock:OperationsService={
   overview:async()=>({pendingJobs:0,activeJobLeases:0,deadLetters:0,oldestPendingSeconds:null,
     openFinancialReconciliation:0,roomAnswerAgeSeconds:null,externalSyncLagSeconds:null,
     entitlementErrors:null,budgetWarnings:null}),
   flags:async()=>{throw new OperationsError("forbidden",403)},
   preview:async()=>{throw new OperationsError("forbidden",403)},
   setFlag:async()=>{throw new OperationsError("forbidden",403)},
   staff:async()=>{throw new OperationsError("forbidden",403)},
   audit:async()=>{throw new OperationsError("forbidden",403)}
  };
  registerAdminOperationsRoutes(app,mock);return app;
 }
 it("denies unauthorized flag reads with typed error",async()=>{
  const app=create();const reply=await app.inject({method:"GET",url:"/v1/admin/ops/flags"});
  expect(reply.statusCode).toBe(403);expect(reply.json()).toEqual({code:"admin_ops.forbidden"});
 });
 it("rejects malformed flag names before auth mutation",async()=>{
  const app=create();const reply=await app.inject({method:"PUT",url:"/v1/admin/ops/flags/finance",payload:{enabled:true,reason:"fake release reason",idempotencyKey:"request-01",expectedRevision:0}});
  expect(reply.statusCode).toBe(400);expect(reply.json()).toEqual({code:"admin_ops.invalid"});
 });
 it("does not let request body replace path-owned flag identity",async()=>{
  const app=Fastify();apps.push(app);
  const call=vi.fn(async()=>({name:"calls" as const,enabled:false,revision:1,updatedAt:null}));
  registerAdminOperationsRoutes(app,{
    overview:async()=>({pendingJobs:0,activeJobLeases:0,deadLetters:0,oldestPendingSeconds:null,
      openFinancialReconciliation:0,roomAnswerAgeSeconds:null,externalSyncLagSeconds:null,
      entitlementErrors:null,budgetWarnings:null}),
    flags:async()=>[],preview:async()=>{throw new OperationsError("forbidden",403)},
    setFlag:async(_auth,mutation)=>call(mutation),audit:async()=>[],staff:async()=>[]
  });
  const response=await app.inject({method:"PUT",url:"/v1/admin/ops/flags/calls",
    payload:{name:"paid_joins",tenantId:"victim",actorId:"attacker",enabled:false,
      expectedRevision:0,idempotencyKey:"request-xyz",reason:"Emergency service shutdown"}});
  expect(response.statusCode).toBe(200);
  expect(call).toHaveBeenCalledWith({name:"calls",enabled:false,
    expectedRevision:0,idempotencyKey:"request-xyz",reason:"Emergency service shutdown"});
 });
 it("keeps flags preview in the scoped HTTP forbidden error handler",async()=>{
  const app=create();
  const reply=await app.inject({method:"GET",url:"/v1/admin/ops/flags/preview?name=posting&enabled=true"});
  expect(reply.statusCode).toBe(403);
  expect(reply.json()).toEqual({code:"admin_ops.forbidden"});
 });
 it("rejects malformed preview requests with typed 400, never a generic 500",async()=>{
  const app=create();
  const reply=await app.inject({method:"GET",url:"/v1/admin/ops/flags/preview?name=unknown&enabled=maybe"});
  expect(reply.statusCode).toBe(400);
  expect(reply.json()).toEqual({code:"admin_ops.invalid"});
 });
 it("staff audit errors use the scoped typed 403 handler",async()=>{
  const app=create();
  const reply=await app.inject({method:"GET",url:"/v1/admin/staff/audit?limit=30"});
  expect(reply.statusCode).toBe(403);
  expect(reply.json()).toEqual({code:"admin_ops.forbidden"});
 });
 it("ops overview denies fan access via scoped error handler",async()=>{
  const app=create();
  const reply=await app.inject({method:"GET",url:"/v1/admin/ops/overview"});
  expect(reply.statusCode).toBe(200);
  expect(reply.json().pendingJobs).toBe(0);
 });
 it("denies unknown staff roles through live HTTP",async()=>{
  const app=create();const reply=await app.inject({method:"GET",url:"/v1/admin/staff"});
  expect(reply.statusCode).toBe(403);
 });
});
