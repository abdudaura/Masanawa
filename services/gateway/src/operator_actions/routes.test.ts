import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerU04ReadRoutes } from "./routes.js";
import { createU04ReadService, type U04AuthorizedRead } from "./read_service.js";
import type { PlatformSessionIdentity } from "@masanawa/security";

// Cross-PR composition evidence: explicitly point to the pinned U01 runtime.
// Normal isolated U04 runs skip this gate until the integrator supplies it.
const u01Module = process.env.MASANAWA_U01_CONTRACT_MODULE;

describe.skipIf(!u01Module)("U04 with actual pinned U01 admission", () => {
  it("reads authenticated data through U01 and rejects forged or denied proposals", async () => {
    const u01 = await import(u01Module!) as {
      parseOperatorProposal(input: unknown): unknown;
      authorizeOperatorProposal(input: Record<string, unknown>): U04AuthorizedRead;
    };
    const app = Fastify();
    const principal = { tenantId: "tenant_one", userId: "user_one", accountId: "account_one",
      sessionId: "character-session_one", deviceId: "device_one" };
    const identity = { tenantId: principal.tenantId, userId: principal.userId,
      profile: { tenantId: principal.tenantId, userId: principal.userId, name: "Hauwa", locale: "ha",
        email: "private@example.test", phone: null, createdAt: "2026-10-09T00:00:00Z" } } as PlatformSessionIdentity;
    let admitted = true;
    let active = true;
    const audit = vi.fn(async () => {});
    const reader = createU04ReadService({
      sessions: { authorize: async () => identity }, bindSession: async () => active,
      quota: { consume: async () => true }, audit: { append: audit },
    });
    registerU04ReadRoutes(app, { reader, authorizer: { authorize: async input => {
      if (input.authorizationHeader !== "Bearer current") throw { statusCode: 401 };
      return { principal, authorized: u01.authorizeOperatorProposal({
        proposal: u01.parseOperatorProposal(input.proposal), principal,
        scope: "private-assistant", region: "NG",
        catalog: [{ id: "accounts.me.read", version: 1, enabled: true, executionClass: "read",
          scopes: ["private-assistant"], regions: ["NG"], argumentKeys: [] }],
        authorizeCapability: () => admitted, authorizeContext: () => false,
      }) };
    } } });
    const proposal = { requestId: "request_0199abcd-efab-7abc-8abc-abcdefabcdef",
      capabilityId: "accounts.me.read", capabilityVersion: 1, untrustedArguments: {} };
    const send = (value: unknown, token = "Bearer current") => app.inject({ method: "POST",
      url: "/v1/operator/read", headers: { authorization: token }, payload: { proposal: value } });
    try {
      const result = await send(proposal);
      expect(result.statusCode).toBe(200);
      expect(result.json().data).toEqual({ displayName: "Hauwa", locale: "ha" });
      expect(result.body).not.toContain("private@example.test");
      expect(audit).toHaveBeenCalledTimes(1);
      for (const value of [
        { ...proposal, userId: "user_other" },
        { ...proposal, untrustedArguments: { role: "admin" } },
        { ...proposal, capabilityVersion: 0 },
      ]) expect((await send(value)).statusCode).toBe(400);
      admitted = false;
      expect((await send(proposal)).statusCode).toBe(403);
      admitted = true;
      active = false;
      expect((await send(proposal)).statusCode).toBe(401);
      expect((await send(proposal, "Bearer another")).statusCode).toBe(401);
      expect(audit).toHaveBeenCalledTimes(1);
    } finally { await app.close(); }
  });
});

describe("U04 gated operator-read HTTP seam", () => {
  it("bounds stalled admission and never dispatches after a late authorization", async () => {
    const app = Fastify();
    const read = vi.fn();
    let finish: (value: never) => void = () => {};
    const admission = new Promise<never>(resolve => { finish = resolve; });
    registerU04ReadRoutes(app, { authorizationTimeoutMs: 50,
      authorizer: { authorize: () => admission }, reader: { read } });
    try {
      const reply = await app.inject({ method: "POST", url: "/v1/operator/read", payload: { proposal: {} } });
      expect(reply.statusCode).toBe(504);
      expect(reply.json()).toEqual({ error: "OPERATOR_SOURCE_TIMEOUT" });
      expect(reply.headers["cache-control"]).toBe("no-store");
      finish({} as never);
      await admission;
      await Promise.resolve();
      expect(read).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it("requires server-side U01 authorization before any read", async () => {
    const app = Fastify();
    const authorizer = { authorize: vi.fn(async () => {
      throw { name: "OperatorContractError", code: "not_authorized" };
    }) };
    const reader = { read: vi.fn() };
    registerU04ReadRoutes(app, { authorizer, reader });
    try {
      const reply = await app.inject({ method: "POST", url: "/v1/operator/read",
        headers: { authorization: "Bearer user-token" },
        payload: { proposal: { capabilityId: "wallet.balance.read", approved: true } },
      });
      expect(reply.statusCode).toBe(403);
      expect(reply.json()).toEqual({ error: "OPERATOR_FORBIDDEN" });
      expect(reader.read).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("passes the exact server-derived principal and authorization to the reader", async () => {
    const app = Fastify();
    const principal = { tenantId: "tenant_one", userId: "user_one",
      accountId: "account_one", sessionId: "session_one", deviceId: "device_one" };
    const authorized = { requestId: "request_0199abcd-efab-7abc-8abc-abcdefabcdef",
      classification: "read", capability: {
        id: "accounts.me.read", version: 1, enabled: true,
        executionClass: "read", argumentKeys: [],
      }, arguments: {}, contextRef: null };
    const authorizer = { authorize: vi.fn(async () => ({ principal, authorized })) };
    const reader = { read: vi.fn(async () => ({
      capabilityId: "accounts.me.read" as const, contractVersion: 1 as const,
      requestId: authorized.requestId,
      readAt: "2026-10-09T00:00:00.000Z", data: { displayName: "Hauwa" },
    })) };
    registerU04ReadRoutes(app, { authorizer, reader });
    try {
      const reply = await app.inject({ method: "POST", url: "/v1/operator/read",
        headers: { authorization: "Bearer real-token" },
        payload: { proposal: { requestId: authorized.requestId } },
      });
      expect(reply.statusCode).toBe(200);
      expect(reply.headers["cache-control"]).toBe("no-store");
      expect(reply.json().data).toEqual({ displayName: "Hauwa" });
      expect(authorizer.authorize).toHaveBeenCalledWith({
        authorizationHeader: "Bearer real-token", proposal: { requestId: authorized.requestId },
      });
      expect(reader.read).toHaveBeenCalledWith({
        authorizationHeader: "Bearer real-token", principal, authorized,
      });
    } finally { await app.close(); }
  });

  it("does not accept caller-injected tenant, region, role or session data", async () => {
    const app = Fastify();
    const authorize = vi.fn();
    registerU04ReadRoutes(app, { authorizer: { authorize },
      reader: { read: vi.fn() } });
    try {
      for (const hostileField of ["tenantId", "userId", "accountId", "deviceId", "region", "role", "sessionId", "authorized", "principal", "__proto__", "constructor", "prototype"]) {
        const reply = await app.inject({ method: "POST", url: "/v1/operator/read",
          payload: { proposal: {}, [hostileField]: "admin" },
        });
        expect(reply.statusCode).toBe(400);
        // Fastify's secure JSON parser rejects prototype keys even earlier.
        if (hostileField !== "__proto__" && hostileField !== "constructor") {
          expect(reply.json()).toEqual({ error: "OPERATOR_INVALID_PROPOSAL" });
        }
        expect(reply.headers["cache-control"]).toBe("no-store");
      }
      expect(authorize).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("rejects malformed envelopes before any authorizer or reader call", async () => {
    const app = Fastify();
    const authorize = vi.fn();
    const read = vi.fn();
    registerU04ReadRoutes(app, { authorizer: { authorize }, reader: { read } });
    try {
      for (const payload of ["null", "[]", '"text"', "{}", '{"proposal":{},"tenantId":"forged"}']) {
        const reply = await app.inject({ method: "POST", url: "/v1/operator/read",
          headers: { "content-type": "application/json" }, payload });
        expect(reply.statusCode).toBe(400);
        expect(reply.headers["cache-control"]).toBe("no-store");
      }
      expect(authorize).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("maps malformed U01 proposals without exposing validator details", async () => {
    const app = Fastify();
    registerU04ReadRoutes(app, { authorizer: {
      authorize: async () => { throw { name: "OperatorContractError",
        code: "privileged_argument", secret: "must-not-leak" }; },
    }, reader: { read: vi.fn() } });
    try {
      const response = await app.inject({ method: "POST", url: "/v1/operator/read",
        payload: { proposal: { untrustedArguments: { role: "admin" } } },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "OPERATOR_INVALID_PROPOSAL" });
      expect(response.body).not.toContain("must-not-leak");
    } finally { await app.close(); }
  });

  it("does not expose upstream errors or allow oversized JSON", async () => {
    const app = Fastify();
    const read = vi.fn(async () => { throw new Error("postgres-password-secret"); });
    registerU04ReadRoutes(app, { authorizer: {
      authorize: async () => ({
        principal: { tenantId: "t", userId: "u", accountId: "a", sessionId: "s", deviceId: "d" },
        authorized: { classification: "read", requestId: "request_0199abcd-efab-7abc-8abc-abcdefabcdef",
          capability: { id: "accounts.me.read", version: 1, enabled: true, executionClass: "read",
            argumentKeys: [] }, arguments: {}, contextRef: null },
      }),
    }, reader: { read } });
    try {
      const error = await app.inject({ method: "POST", url: "/v1/operator/read",
        payload: { proposal: {} },
      });
      expect(error.statusCode).toBe(503);
      expect(error.body).not.toContain("postgres-password-secret");
      const huge = await app.inject({ method: "POST", url: "/v1/operator/read",
        payload: { proposal: { text: "a".repeat(13_000) } },
      });
      expect(huge.statusCode).toBe(413);
    } finally { await app.close(); }
  });
});

