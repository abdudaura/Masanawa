import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayApp } from "../../app.js";

const apps: ReturnType<typeof createGatewayApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe("AF00 canonical C10 composition", () => {
  const character = "character_0199f0d0-0000-7000-8000-000000000003";
  it("keeps disabled inbox mutations and reads entirely off the repository", async () => {
    const resolveFan = vi.fn(async () => ({ tenantId: "tenant_a", fanUserId: "fan_a" }));
    const list = vi.fn(async () => []);
    const setPinned = vi.fn(async () => 1);
    const markRead = vi.fn(async () => 1);
    const app = createGatewayApp({ masanaInbox: {
      enabled: () => false, resolveFan, inbox: { list, setPinned, markRead },
    } });
    apps.push(app);
    const headers = { authorization: "Bearer token" };
    expect((await app.inject({ method: "GET", url: "/v1/chats", headers })).statusCode).toBe(503);
    expect((await app.inject({ method: "PATCH", url: "/v1/chats/"+character, headers,
      payload: {pinned:true,expectedRevision:0} })).statusCode).toBe(503);
    expect((await app.inject({ method: "POST", url: "/v1/chats/"+character+"/read", headers })).statusCode).toBe(503);
    expect(resolveFan).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(setPinned).not.toHaveBeenCalled();
    expect(markRead).not.toHaveBeenCalled();
  });
  it("uses server-derived scope, never request tenant or fan headers", async () => {
    const resolveFan = vi.fn(async (_authorization: string | undefined) =>
      ({ tenantId: "tenant_server", fanUserId: "fan_server" }));
    const list = vi.fn(async () => []);
    const app = createGatewayApp({ masanaInbox: {
      enabled: () => true, resolveFan,
      inbox: {list, setPinned:async()=>null, markRead:async()=>null},
    } });
    apps.push(app);
    const unauthorized = await app.inject({ method:"GET", url:"/v1/chats",
      headers:{"x-tenant-id":"other","x-user-id":"other"} });
    expect(unauthorized.statusCode).toBe(401);
    expect(resolveFan).not.toHaveBeenCalled();
    const response = await app.inject({ method:"GET", url:"/v1/chats?q=teacher",
      headers:{authorization:"Bearer token","x-tenant-id":"other","x-user-id":"other"} });
    expect(response.statusCode).toBe(200);
    expect(list).toHaveBeenCalledWith({ tenantId:"tenant_server", fanUserId:"fan_server" }, "teacher");
    expect((await app.inject({ method:"GET", url:"/v1/chats?q="+"x".repeat(81),
      headers:{authorization:"Bearer token"} })).statusCode).toBe(422);
  });
  it("does not mount a second inbox or Room implementation by default", async () => {
    const app = createGatewayApp();
    apps.push(app);
    expect((await app.inject({method:"GET",url:"/v1/chats"})).statusCode).toBe(404);
    expect((await app.inject({method:"GET",url:"/v1/rooms"})).statusCode).toBe(404);
  });
});
