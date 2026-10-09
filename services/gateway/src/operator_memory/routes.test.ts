import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerOperatorMemoryRoutes } from "./routes.js";
import { OperatorMemoryError, type MemoryService } from "./service.js";

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()));
});

describe("U05 isolated HTTP contract", () => {
  it("forwards bearer session only; forged tenant/user/scope body never enters service", async () => {
    let received: unknown = null;
    const service = {
      async remember(request: unknown) {
        received = request;
        return { id: "memory-record_known", revision: 1 };
      },
    } as MemoryService;
    const app = Fastify();
    apps.push(app);
    registerOperatorMemoryRoutes(app, service);
    const reply = await app.inject({
      method: "POST", url: "/operator/memory",
      headers: { authorization: "Bearer legitimate" },
      payload: {
        kind: "preference", content: "Please answer in Hausa", ttlDays: 90,
        tenantId: "tenant_attacker", userId: "user_attacker",
        scope: { kind: "organization" },
      },
    });
    expect(reply.statusCode).toBe(200);
    expect(received).toEqual({
      authorizationHeader: "Bearer legitimate",
      kind: "preference",
      content: "Please answer in Hausa",
      ttlDays: 90,
    });
  });

  it("surfaces fail-closed auth and scope errors without any fake success", async () => {
    const service = {
      async list() {
        throw new OperatorMemoryError("MEMORY_PRIVATE_SCOPE_UNAVAILABLE", 503);
      },
    } as MemoryService;
    const app = Fastify();
    apps.push(app);
    registerOperatorMemoryRoutes(app, service);
    const reply = await app.inject({ method: "GET", url: "/operator/memory" });
    expect(reply.statusCode).toBe(503);
    expect(reply.json()).toMatchObject({
      statusCode: 503, error: "Service Unavailable",
    });
  });
});
