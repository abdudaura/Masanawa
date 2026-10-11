import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerSearchRoutes } from "./routes.js";
import type { SearchStore } from "./contract.js";

describe("C26 canonical public search", () => {
  async function setup() {
    const app = Fastify();
    const search = vi.fn(async () => ({ items: [], nextCursor: null }));
    const resolveReader = vi.fn(async (header: string | undefined) => {
      if (header && header !== "Bearer valid") throw Object.assign(new Error("unauthorized"), { status: 401 });
      return { tenantId: "t_a" };
    });
    registerSearchRoutes(app, { store: { search } as SearchStore, resolveReader, enabled: () => true });
    await app.ready();
    return { app, search, resolveReader };
  }
  it("accepts guest query but server-binds tenant", async () => {
    const { app, search } = await setup();
    const res = await app.inject({ url: "/v1/search?q=math&kind=rooms" });
    expect(res.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith({ tenantId: "t_a", q: "math", kind: "rooms", limit: 15, cursor: null });
    await app.close();
  });
  it.each([
    "/v1/search?q=a", "/v1/search?q=abc&kind=humans",
    "/v1/search?q=abc&tenantId=another", "/v1/search?q=abc&limit=999",
    "/v1/search?q=abc&cursor=%2Fetc", "/v1/search?q=%00abc",
  ])("denies invalid query %s without touching storage", async url => {
    const { app, search } = await setup();
    const res = await app.inject({ url });
    expect(res.statusCode).toBe(400);
    expect(search).not.toHaveBeenCalled();
    await app.close();
  });
  it("never trusts a forged authorization header", async () => {
    const { app, search } = await setup();
    const res = await app.inject({ url: "/v1/search?q=math", headers: { authorization: "Bearer forged" } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: "search_auth_denied" });
    expect(search).not.toHaveBeenCalled();
    await app.close();
  });
  it("fails closed on optional-session outages and missing trusted tenant", async () => {
    const app = Fastify();
    const search = vi.fn();
    registerSearchRoutes(app, {
      store: { search } as unknown as SearchStore,
      resolveReader: async () => { throw new Error("session database down"); },
      enabled: () => true,
    });
    const unavailable = await app.inject({ url: "/v1/search?q=math" });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toEqual({ code: "search_session_unavailable" });
    expect(search).not.toHaveBeenCalled();
    await app.close();

    const noTenantApp = Fastify();
    registerSearchRoutes(noTenantApp, {
      store: { search } as unknown as SearchStore,
      resolveReader: async () => ({ tenantId: "" }),
      enabled: () => true,
    });
    const noTenant = await noTenantApp.inject({ url: "/v1/search?q=math" });
    expect(noTenant.statusCode).toBe(403);
    expect(noTenant.json()).toEqual({ code: "tenant_unavailable" });
    expect(search).not.toHaveBeenCalled();
    await noTenantApp.close();
  });
  it("a disabled search never resolves a session or queries storage", async () => {
    const app = Fastify(), search = vi.fn(), resolveReader = vi.fn();
    registerSearchRoutes(app, { store: { search } as unknown as SearchStore, resolveReader, enabled: () => false });
    const res = await app.inject({ url: "/v1/search?q=math" });
    expect(res.statusCode).toBe(503);
    expect(search).not.toHaveBeenCalled();
    expect(resolveReader).not.toHaveBeenCalled();
    await app.close();
  });
});
