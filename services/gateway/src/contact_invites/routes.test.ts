import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { InviteServiceError, type InvitationService } from "./service.js";
import { registerInvitationRoutes } from "./routes.js";

describe("U23 isolated Fastify API", () => {
  it("requires canonical service authorization and emits no-store on success", async () => {
    const create = vi.fn(async () => ({
      url: "https://masanawa.com/invite/v1.iv.cipher.tag",
      expiresAt: "2026-10-09T12:00:00.000Z",
    }));
    const resolve = vi.fn(async () => ({ suggestedHandle: "public_a" }));
    const app = Fastify();
    registerInvitationRoutes(app, { create, resolve } as InvitationService);
    try {
      const issued = await app.inject({
        method: "POST", url: "/invites", headers: { authorization: "Bearer test" },
        payload: {},
      });
      expect(issued.statusCode).toBe(201);
      expect(issued.headers["cache-control"]).toBe("no-store");
      expect(create).toHaveBeenCalledWith({ authorizationHeader: "Bearer test" });
      const read = await app.inject({ method: "GET", url: "/invites/v1.iv.cipher.tag" });
      expect(read.statusCode).toBe(200);
      expect(read.headers["cache-control"]).toBe("private, no-store");
      expect(read.headers["referrer-policy"]).toBe("no-referrer");
      expect(read.json()).toEqual({ suggestedHandle: "public_a" });
      expect(resolve).toHaveBeenCalledWith("v1.iv.cipher.tag");
      const malformed = await app.inject({ method: "GET", url: "/invites/%3Fbad" });
      expect(malformed.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("does not map policy denial or unknown invite to a successful view", async () => {
    const app = Fastify();
    registerInvitationRoutes(app, {
      create: async () => { throw new InviteServiceError("INVITE_NOT_AVAILABLE", 403); },
      resolve: async () => { throw new InviteServiceError("INVITE_UNAVAILABLE", 404); },
    });
    try {
      expect((await app.inject({ method: "POST", url: "/invites" })).statusCode).toBe(403);
      expect((await app.inject({ method: "GET", url: "/invites/v1.a.b.c" })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
