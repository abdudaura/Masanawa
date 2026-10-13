import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayApp } from "../../app.js";

const apps: ReturnType<typeof createGatewayApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe("AF00 composed C10 inbox routes", () => {
  it("does not consult auth or PostgreSQL when unqualified backend is disabled", async () => {
    const resolveFan = vi.fn(async () => ({ tenantId: "tenant_a", fanUserId: "fan_a" }));
    const list = vi.fn(async () => []);
    const setPinned = vi.fn(async () => 1);
    const markRead = vi.fn(async () => 1);
    const app = createGatewayApp({
      masanaInbox: { enabled: () => false, resolveFan,
        inbox: { list, setPinned, markRead } },
    });
    apps.push(app);
    const auth = { authorization: "Bearer inert" };
    expect((await app.inject({ method: "GET", url: "/v1/chats", headers: auth })).statusCode).toBe(503);
    expect((await app.inject({ method: "PATCH", url: "/v1/chats/character_123", headers: auth,
      payload: { pinned: true, expectedRevision: 0 } })).statusCode).toBe(503);
    expect((await app.inject({ method: "POST", url: "/v1/chats/character_123/read", headers: auth })).statusCode).toBe(503);
    expect(resolveFan).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(setPinned).not.toHaveBeenCalled();
    expect(markRead).not.toHaveBeenCalled();
  });

  it("requires a bearer and obtains actor scope only from canonical authorizer", async () => {
    const resolveFan = vi.fn(async (_header: string | undefined) =>
      ({ tenantId: "tenant_server", fanUserId: "fan_server" }));
    const list = vi.fn(async () => []);
    const app = createGatewayApp({
      masanaInbox: { enabled: () => true, resolveFan,
        inbox: { list, setPinned: async () => null, markRead: async () => null } },
    });
    apps.push(app);
    expect((await app.inject({ method: "GET", url: "/v1/chats",
      headers: { "x-tenant-id": "tenant_foreign", "x-user-id": "other" } })).statusCode).toBe(401);
    expect(resolveFan).not.toHaveBeenCalled();
    const response = await app.inject({ method: "GET", url: "/v1/chats?q=teacher",
      headers: { authorization: "Bearer signed-token",
        "x-tenant-id": "tenant_foreign", "x-user-id": "other" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ chats: [] });
    expect(list).toHaveBeenCalledWith(
      { tenantId: "tenant_server", fanUserId: "fan_server" }, "teacher",
    );
    expect((await app.inject({ method: "GET", url: "/v1/chats?q=" + "a".repeat(81),
      headers: { authorization: "Bearer signed-token" } })).statusCode).toBe(422);
  });
});
