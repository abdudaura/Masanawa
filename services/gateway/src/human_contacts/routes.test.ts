import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerHumanContactRoutes } from "./routes.js";
import { createHumanContactService } from "./service.js";
import type { HumanContactRepository } from "./model.js";

function harness() {
  const pool: HumanContactRepository = {
    async lookup({ handle }) {
      if (handle !== "bob") return null;
      return { userId: "user_bo", handle: "bob", displayName: "Bob", avatarUrl: null, canMessage: false, status: "none", requestRevision: null };
    },
    async getOwnPreferences() { return { policy: "requests", discoverableByHandle: true }; },
    async setOwnPreferences({ policy, discoverableByHandle }) { return { policy: policy ?? "requests", discoverableByHandle: discoverableByHandle ?? true }; },
    async request({ handle }) { return handle === "bob" ? "pending" : "unavailable"; },
    async respond({ requesterId }) { return requesterId === "user_al"; },
    async list() { return []; },
    async listPage() { return { contacts: [], next: null }; },
    async revoke({ otherUserId }) { return otherUserId === "user_bo"; },
  };
  const svc = createHumanContactService({
    repository: pool,
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer valid") {
          throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        }
        return { tenantId: "tenant_1", userId: "user_al" } as never;
      },
    },
  });
  const app = Fastify();
  registerHumanContactRoutes(app, svc);
  return app;
}

describe("C01 contact HTTP surface", () => {
  it("keeps every private C01 response out of HTTP caches, even on rejection", async () => {
    const app = harness();
    const headers = { authorization: "Bearer valid" };
    // Exercise all eight C01 routes (reads AND writes). This is a per-route
    // onRequest guard, not a global mutation of other Gateway responses.
    const cases = [
      { method: "GET", url: "/messages/contacts/lookup/bob" },
      { method: "GET", url: "/messages/contacts/preferences" },
      { method: "PATCH", url: "/messages/contacts/preferences", payload: { policy: "requests" } },
      { method: "POST", url: "/messages/contacts/requests", payload: { handle: "bob" } },
      { method: "POST", url: "/messages/contacts/requests/user_al/response",
        payload: { accept: true, requestRevision: "1" } },
      { method: "DELETE", url: "/messages/contacts/user_bo" },
      { method: "GET", url: "/messages/contacts/page?limit=2" },
      { method: "GET", url: "/messages/contacts?limit=2" },
    ] as const;
    for (const options of cases) {
      for (const authenticated of [true, false]) {
        const response = await app.inject({
          ...options, ...(authenticated ? { headers } : {}),
        });
        expect(response.statusCode, options.url).toBe(authenticated ? 200 : 401);
        expect(response.headers["cache-control"], options.url).toBe("no-store");
        expect(response.headers.pragma, options.url).toBe("no-cache");
        expect(response.headers.expires, options.url).toBe("0");
      }
    }
    // Fastify validates before the handler. Errors must be uncacheable too.
    for (const options of [
      { method: "GET" as const, url: "/messages/contacts/page?limit=200" },
      { method: "POST" as const, url: "/messages/contacts/requests",
        payload: { handle: "bob", forgedActorId: "user_else" } },
    ]) {
      const response = await app.inject({ ...options, headers });
      expect(response.statusCode).toBe(400);
      expect(response.headers["cache-control"]).toBe("no-store");
    }
    await app.close();
  });

  it("never discovers a private contact without authentication", async () => {
    const app = harness();
    const response = await app.inject({ method: "GET", url: "/messages/contacts/lookup/bob" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("normalizes an exact handle and exposes action eligibility rather than private policy", async () => {
    const app = harness();
    const response = await app.inject({
      method: "GET", url: "/messages/contacts/lookup/%40BoB", headers: { authorization: "Bearer valid" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: "user_bo", handle: "bob", displayName: "Bob", avatarUrl: null,
      canMessage: false, status: "none", requestRevision: null,
    });
    expect(JSON.stringify(response.json())).not.toContain("admission_policy");
    await app.close();
  });

  it("accepts policy updates only with exact allowlisted body", async () => {
    const app = harness();
    const opts = { method: "PATCH" as const, url: "/messages/contacts/preferences", headers: { authorization: "Bearer valid" } };
    const ok = await app.inject({ ...opts, payload: { policy: "nobody" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ policy: "nobody", discoverableByHandle: true });
    for (const invalid of [{ policy: "all_users" }, { policy: "anyone", userId: "user_bo" },
      { policy: "anyone", authorizationHeader: "Bearer other" }, {}]) {
      const denied = await app.inject({ ...opts, payload: invalid });
      expect(denied.statusCode).toBe(400);
    }
    const hidden = await app.inject({ ...opts, payload: { discoverableByHandle: false } });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json()).toEqual({ policy: "requests", discoverableByHandle: false });
    await app.close();
  });

  it("requires explicit request before contact, with bounded list and incoming response", async () => {
    const app = harness();
    const headers = { authorization: "Bearer valid" };
    const forgedRequest = await app.inject({ method: "POST", url: "/messages/contacts/requests",
      headers, payload: { handle: "bob", requesterId: "user_else" } });
    expect(forgedRequest.statusCode).toBe(400);
    const forgedResponse = await app.inject({ method: "POST", url: "/messages/contacts/requests/user_al/response",
      headers, payload: { accept: true, requestRevision: "1", recipientId: "user_else" } });
    expect(forgedResponse.statusCode).toBe(400);
    const sent = await app.inject({ method: "POST", url: "/messages/contacts/requests", headers, payload: { handle: "bob" } });
    expect(sent.statusCode).toBe(200);
    expect(sent.json()).toEqual({ status: "pending" });
    const returned = await app.inject({ method: "POST", url: "/messages/contacts/requests/user_al/response", headers, payload: { accept: true, requestRevision: "1" } });
    expect(returned.statusCode).toBe(200);
    expect(returned.json()).toEqual({ status: "accepted" });
    const stale = await app.inject({ method: "POST", url: "/messages/contacts/requests/user_al/response", headers, payload: { accept: true } });
    expect(stale.statusCode).toBe(400);
    const invalid = await app.inject({ method: "GET", url: "/messages/contacts?limit=2000", headers });
    expect(invalid.statusCode).toBe(400);
    const list = await app.inject({ method: "GET", url: "/messages/contacts?limit=30", headers });
    expect(list.json()).toEqual({ contacts: [] });
    const revoked = await app.inject({ method: "DELETE", url: "/messages/contacts/user_bo", headers });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toEqual({ status: "revoked" });
    await app.close();
  });

  it("keeps legacy contacts intact and exposes separately authenticated bounded pages", async () => {
    const app = harness();
    const headers = { authorization: "Bearer valid" };
    const unauthorized = await app.inject({ method: "GET", url: "/messages/contacts/page?limit=10" });
    expect(unauthorized.statusCode).toBe(401);
    const first = await app.inject({ method: "GET", url: "/messages/contacts/page?limit=10", headers });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ contacts: [], nextCursor: null });
    const old = await app.inject({ method: "GET", url: "/messages/contacts?limit=10", headers });
    expect(old.json()).toEqual({ contacts: [] });
    for (const suffix of ["?limit=101", "?cursor=!", "?actor=user_bo"]) {
      const response = await app.inject({ method: "GET", url: "/messages/contacts/page" + suffix, headers });
      expect(response.statusCode).toBe(400);
    }
    await app.close();
  });
});
