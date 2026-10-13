import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerCallHistoryRoutes } from "./routes.js";
import { createCallHistoryService, encodeCallCursor } from "./service.js";
import type { TenantId, UserId } from "@masanawa/contracts";
import { createGatewayApp } from "../app.js";

const callId = "0199a000-0000-7000-8000-000000000001";
function setup() {
  const repository = {
    list: vi.fn(async () => ({ calls: [], nextCursor: null })),
    get: vi.fn(async () => null),
    report: vi.fn(async () => null),
  };
  const authorizer = { authorize: vi.fn(async () => ({ tenantId: "tenant-a" as TenantId, userId: "user-a" as UserId })) };
  const app = Fastify();
  registerCallHistoryRoutes(app, createCallHistoryService({ repository, authorizer }));
  return { app, repository, authorizer };
}

describe("Masana call history HTTP authority", () => {
  it("is registered in the real Gateway composition", async () => {
    const { app: isolated, repository, authorizer } = setup();
    await isolated.close();
    const app = createGatewayApp({ callHistory: createCallHistoryService({ repository, authorizer }) });
    try {
      expect((await app.inject({ url: "/v1/calls" })).statusCode).toBe(200);
      expect(repository.list).toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it("uses authenticated account and tenant, not caller supplied identity", async () => {
    const { app, repository, authorizer } = setup();
    try {
      const response = await app.inject({ url: "/v1/calls?limit=10", headers: { authorization: "Bearer account" } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ calls: [], nextCursor: null });
      expect(authorizer.authorize).toHaveBeenCalledWith({ authorizationHeader: "Bearer account", capability: "agents.directory.read" });
      expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", userId: "user-a", limit: 10 }));
      expect((await app.inject({ url: "/v1/calls?userId=user-b" })).statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it("defaults optional search and pagination server-side without undefined properties", async () => {
    const { app, repository } = setup();
    try {
      expect((await app.inject({ url: "/v1/calls" })).statusCode).toBe(200);
      expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
        limit: 30,
        query: "",
        cursor: null,
      }));
      expect((await app.inject({ url: "/v1/calls?q=&limit=15" })).statusCode).toBe(200);
      expect(repository.list).toHaveBeenLastCalledWith(expect.objectContaining({
        limit: 15,
        query: "",
        cursor: null,
      }));
    } finally { await app.close(); }
  });

  it("rejects unauthenticated reads before accessing storage", async () => {
    const { app, repository, authorizer } = setup();
    authorizer.authorize.mockRejectedValue(Object.assign(new Error("unauthorized"), { statusCode: 401 }));
    try {
      expect((await app.inject({ url: "/v1/calls" })).statusCode).toBe(401);
      expect(repository.list).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("rejects invalid pagination and IDs and hides missing/foreign calls", async () => {
    const { app, repository } = setup();
    try {
      for (const suffix of ["?limit=0", "?limit=51", "?limit=1.5", "?cursor=not-a-cursor"]) {
        expect((await app.inject({ url: `/v1/calls${suffix}` })).statusCode).toBe(400);
      }
      expect((await app.inject({ url: "/v1/calls/not-an-id" })).statusCode).toBe(400);
      expect((await app.inject({ url: `/v1/calls/${callId}` })).statusCode).toBe(404);
      expect(repository.get).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a", callId, characterIds: null });
    } finally { await app.close(); }
  });


  it("searches within authorized history with normalized query and rejects foreign cursor reuse", async () => {
    const { app, repository, authorizer } = setup();
    const cursor = encodeCallCursor({
      createdAt: "2026-10-12T10:00:00.000Z",
      callId,
    }, "amina");
    try {
      const response = await app.inject({
        url: `/v1/calls?q=%20AMINA%20&cursor=${encodeURIComponent(cursor)}&limit=1`,
        headers: { authorization: "Bearer account" },
      });
      expect(response.statusCode).toBe(200);
      expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: "tenant-a", userId: "user-a",
        query: "amina", limit: 1, cursor: { createdAt: "2026-10-12T10:00:00.000Z", callId },
      }));
      expect(authorizer.authorize).toHaveBeenCalledWith({
        authorizationHeader: "Bearer account", capability: "agents.directory.read",
      });
      expect((await app.inject({ url: `/v1/calls?q=bello&cursor=${cursor}` })).statusCode).toBe(400);
      expect((await app.inject({ url: `/v1/calls?cursor=${cursor}` })).statusCode).toBe(400);
      expect((await app.inject({ url: `/v1/calls?q=amina&cursor=${encodeCallCursor({ createdAt: "2026-10-12T10:00:00.000Z", callId })}` })).statusCode).toBe(400);
      expect((await app.inject({ url: `/v1/calls?q=${"x".repeat(81)}` })).statusCode).toBe(400);
      expect((await app.inject({ url: "/v1/calls?q=%00" })).statusCode).toBe(400);
      expect((await app.inject({ url: "/v1/calls?q=&userId=other-user" })).statusCode).toBe(400);
    } finally { await app.close(); }
  });
  it("keeps the two-field history cursor compatible with an empty query", async () => {
    const { app, repository } = setup();
    const cursor = encodeCallCursor({
      createdAt: "2026-10-12T10:00:00.000Z", callId,
    });
    try {
      expect((await app.inject({ url: `/v1/calls?cursor=${cursor}&q=` })).statusCode).toBe(200);
      expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
        query: "", cursor: { createdAt: "2026-10-12T10:00:00.000Z", callId },
      }));
    } finally { await app.close(); }
  });

  it("rejects financial and participant data in lifecycle reports", async () => {
    const { app, repository } = setup();
    try {
      expect((await app.inject({ method: "POST", url: `/v1/calls/${callId}/connected`, payload: { verifiedSeconds: 60 } })).statusCode).toBe(400);
      expect((await app.inject({ method: "POST", url: `/v1/calls/${callId}/end`, payload: { userId: "user-b" } })).statusCode).toBe(400);
      expect(repository.report).not.toHaveBeenCalled();
      expect((await app.inject({ method: "POST", url: `/v1/calls/${callId}/end`, payload: {} })).statusCode).toBe(404);
      expect(repository.report).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", userId: "user-a", event: "ended" }));
    } finally { await app.close(); }
  });
});
