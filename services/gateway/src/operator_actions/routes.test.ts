import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerU04ReadRoutes } from "./routes.js";

describe("U04 gated operator-read HTTP seam", () => {
  it("requires server-side U01 authorization before any read", async () => {
    const app = Fastify();
    const authorizer = { authorize: vi.fn(async () => {
      throw { name: "OperatorContractError", code: "not_authorized" };
    }) };
    const reader = { read: vi.fn() };
    registerU04ReadRoutes(app, { authorizer, reader });
    try {
      const reply = await app.inject({ method: "POST", url: "/operator/v1/read",
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
      const reply = await app.inject({ method: "POST", url: "/operator/v1/read",
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
        const reply = await app.inject({ method: "POST", url: "/operator/v1/read",
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
        const reply = await app.inject({ method: "POST", url: "/operator/v1/read",
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
      const response = await app.inject({ method: "POST", url: "/operator/v1/read",
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
      const error = await app.inject({ method: "POST", url: "/operator/v1/read",
        payload: { proposal: {} },
      });
      expect(error.statusCode).toBe(503);
      expect(error.body).not.toContain("postgres-password-secret");
      const huge = await app.inject({ method: "POST", url: "/operator/v1/read",
        payload: { proposal: { text: "a".repeat(13_000) } },
      });
      expect(huge.statusCode).toBe(413);
    } finally { await app.close(); }
  });
});

