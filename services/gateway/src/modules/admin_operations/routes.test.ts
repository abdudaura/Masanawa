import Fastify from "fastify";
import { describe, it, expect, afterEach } from "vitest";
import { OperationsError, type OperationsService } from "./service.js";
import { registerAdminOperationsRoutes } from "./routes.js";
const apps:ReturnType<typeof Fastify>[]=[];
afterEach(async()=>{await Promise.all(apps.splice(0).map(x=>x.close()));});
describe("J19 actual HTTP endpoint denied paths",()=>{
 function create() {
  const app=Fastify();apps.push(app);
  const mock:OperationsService={
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
 it("denies unknown staff roles through live HTTP",async()=>{
  const app=create();const reply=await app.inject({method:"GET",url:"/v1/admin/staff"});
  expect(reply.statusCode).toBe(403);
 });
});
