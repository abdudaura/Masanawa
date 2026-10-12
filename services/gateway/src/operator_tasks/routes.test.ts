import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { createCanonicalId } from "@masanawa/contracts";
import type { OperatorTaskService } from "@masanawa/operator-tasks";
import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import { registerOperatorTaskRoutes } from "./routes.js";

const goodAuth = "Bearer msw_access_" + "A".repeat(43);
function server() {
  const app=Fastify();
  const tenantId=createCanonicalId("tenant"), userId=createCanonicalId("user");
  let proposes=0, confirms=0, actorDigest="";
  const authorizer={
    async authorize() { return { tenantId,userId }; },
  } as PlatformCustomerSessionAuthorizer;
  const tasks={
    async propose(req: { actor: { tenantId: string; userId: string; sessionDigest: string } }) {
      proposes++;actorDigest=req.actor.sessionDigest;
      return {taskId:"task-safe",phase:"proposed"};
    },
    async list() { return [{taskId:"task-safe",phase:"proposed"}]; },
    async read() { return {taskId:"task-safe",phase:"proposed"}; },
    async events() { return []; },
    async cancel() { return {taskId:"task-safe",phase:"cancelled"}; },
    async confirm() { confirms++;return {taskId:"task-safe",phase:"reconciling"}; },
  } as unknown as OperatorTaskService;
  registerOperatorTaskRoutes(app,{authorizer,tasks});
  return {app, state:()=>({proposes,confirms,actorDigest})};
}
describe("U02 isolated authenticated Gateway API", () => {
  it("does not admit requests without the canonical bearer token", async () => {
    const {app,state}=server();
    const res=await app.inject({method:"POST",url:"/v1/operator/tasks",payload:{
      requestId:"r-abc",scope:"private-assistant",capabilityId:"talks.create",capabilityVersion:1,arguments:{},
    }});
    expect(res.statusCode).toBe(401);
    expect(state().proposes).toBe(0);
    await app.close();
  });
  it("rejects extra untrusted top-level fields without reaching the task store", async () => {
    const {app,state}=server();
    const res=await app.inject({method:"POST",url:"/v1/operator/tasks",headers:{authorization:goodAuth},payload:{
      requestId:"r-abc",scope:"private-assistant",capabilityId:"talks.create",
      capabilityVersion:1,arguments:{},userId:"forged",
    }});
    expect(res.statusCode).toBe(400);
    expect(state().proposes).toBe(0);
    await app.close();
  });
  it("uses verified actor only and returns no-store on API readback", async () => {
    const {app,state}=server();
    const res=await app.inject({method:"POST",url:"/v1/operator/tasks",headers:{authorization:goodAuth},payload:{
      requestId:"r-abc",scope:"private-assistant",capabilityId:"talks.create",capabilityVersion:1,arguments:{},
    }});
    expect(res.statusCode).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(state().proposes).toBe(1);
    expect(state().actorDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(res.json()).not.toHaveProperty("sessionDigest");
    await app.close();
  });
  it("rejects generic yes on public confirmation before invoking service", async () => {
    const {app,state}=server();
    const res=await app.inject({method:"POST",url:"/v1/operator/tasks/task_fake/confirm",
      headers:{authorization:goodAuth},payload:{approvalToken:123,expectedVersion:2}});
    expect(res.statusCode).toBe(400);
    expect(state().confirms).toBe(0);
    await app.close();
  });
  it("does not replace the root Gateway error handler", async () => {
    const {app}=server();
    app.get("/outside-operator",async ()=>{ throw new Error("root-sentinel"); });
    const res=await app.inject({method:"GET",url:"/outside-operator"});
    expect(res.statusCode).toBe(500);
    await app.close();
  });
});
