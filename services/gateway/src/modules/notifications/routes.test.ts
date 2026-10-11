import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerNotificationRoutes, type NotificationStore } from "./routes.js";

describe("C08 notification REST boundary", () => {
  function setup(actor: { tenantId: string; fanUserId: string; signedIn: true } | null) {
    const app = Fastify();
    const store: NotificationStore = {
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      acknowledge: vi.fn().mockResolvedValue(true),
    };
    registerNotificationRoutes(app, { store, resolvePrincipal: async () => actor });
    return { app, store };
  }
  it("denies guest access, ignoring forged user headers", async () => {
    const { app, store } = setup(null);
    const r = await app.inject({ method: "GET", url: "/v1/notifications",
      headers: { "x-user-id": "victim", "x-tenant-id": "other" } });
    expect(r.statusCode).toBe(401);
    expect(store.list).not.toHaveBeenCalled();
    await app.close();
  });
  it("uses only the server principal and scopes mark-read", async () => {
    const { app, store } = setup({ tenantId: "one", fanUserId: "fan_1", signedIn: true });
    const list = await app.inject({ method: "GET", url: "/v1/notifications?limit=10&fanUserId=other" });
    expect(list.statusCode).toBe(200);
    expect(store.list).toHaveBeenCalledWith(
      { tenantId: "one", fanUserId: "fan_1", signedIn: true }, 10, undefined);
    const ack = await app.inject({ method: "POST", url: "/v1/notifications/ntf_01/read",
      payload: { fanUserId: "other" } });
    expect(ack.statusCode).toBe(200);
    expect(store.acknowledge).toHaveBeenCalledWith(
      { tenantId: "one", fanUserId: "fan_1", signedIn: true }, "ntf_01");
    await app.close();
  });
  it("rejects invalid paging and missing item without leaking other accounts", async () => {
    const { app, store } = setup({ tenantId: "one", fanUserId: "fan_1", signedIn: true });
    for (const query of ["limit=0", "limit=51", "limit=1e3", "limit=-1"]) {
      expect((await app.inject({ method: "GET", url: "/v1/notifications?" + query })).statusCode).toBe(422);
    }
    (store.acknowledge as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    expect((await app.inject({ method: "POST", url: "/v1/notifications/foreign/read" })).statusCode).toBe(404);
    await app.close();
  });
});
