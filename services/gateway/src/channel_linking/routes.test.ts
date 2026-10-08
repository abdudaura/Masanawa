import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { LinkError, type LinkingService } from "./service.js";
import { registerLinkedChannelsRoutes } from "./routes.js";

describe("U26 customer-only linking routes", () => {
  const make = () => {
    const app = Fastify();
    const calls: unknown[] = [];
    const service = {
      status: vi.fn<LinkingService["status"]>(async (owner) => {
        calls.push(owner);
        return [{ channel: "telegram", linked: false, preferred: false,
          linkedAt: null, pendingUntil: null }];
      }),
      begin: vi.fn(async (owner, channel) => {
        calls.push({ owner, channel });
        return { code: "MN-AAAAAAAAAAAAAAAAAAAAAAAA",
          expiresAt: "2026-10-08T18:10:00Z", destination: "https://t.me/MasanawaBot" };
      }),
      prefer: vi.fn(async () => { throw new LinkError("LINK_NOT_FOUND", 409); }),
      unlink: vi.fn(async (owner, channel) => { calls.push({ owner, channel }); }),
      consumeVerifiedInbound: vi.fn(),
    } satisfies LinkingService;
    registerLinkedChannelsRoutes(app, {
      service,
      authorize: {
        authorize: async ({ authorizationHeader }) => {
          if (authorizationHeader !== "Bearer signed-A") throw Object.assign(
            new Error("expired"), { statusCode: 401 });
          return { tenantId: "tenant-A", userId: "user-A" } as never;
        },
      },
    });
    return { app, service, calls };
  };

  it("requires a real customer session for status and mutation", async () => {
    const { app, service } = make();
    try {
      const anon = await app.inject({ method: "GET", url: "/v1/me/linked-channels" });
      expect(anon.statusCode).toBe(401);
      expect(service.status).not.toHaveBeenCalled();
      const invalid = await app.inject({
        method: "POST", url: "/v1/me/linked-channels/telegram/begin",
        headers: { authorization: "Bearer invalid" },
      });
      expect(invalid.statusCode).toBe(401);
      expect(service.begin).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("uses identity from auth, never tenant or user supplied in JSON body", async () => {
    const { app, calls, service } = make();
    try {
      const badBody = await app.inject({
        method: "POST", url: "/v1/me/linked-channels/telegram/begin",
        headers: { authorization: "Bearer signed-A" },
        payload: { userId: "user-B" },
      });
      expect(badBody.statusCode).toBe(400);
      expect(service.begin).not.toHaveBeenCalled();
      const status = await app.inject({
        method: "GET", url: "/v1/me/linked-channels",
        headers: { authorization: "Bearer signed-A" },
      });
      expect(status.statusCode).toBe(200);
      expect(calls[0]).toEqual({ tenantId: "tenant-A", userId: "user-A" });
      const invalidChannel = await app.inject({
        method: "POST", url: "/v1/me/linked-channels/human-dm/begin",
        headers: { authorization: "Bearer signed-A" },
      });
      expect(invalidChannel.statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it("returns truthful unlink result and refuses preferences before verified link", async () => {
    const { app, service } = make();
    try {
      const response = await app.inject({
        method: "DELETE", url: "/v1/me/linked-channels/whatsapp",
        headers: { authorization: "Bearer signed-A" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ channel: "whatsapp", linked: false });
      expect(service.unlink).toHaveBeenCalledWith(
        { tenantId: "tenant-A", userId: "user-A" }, "whatsapp",
      );
      const prefer = await app.inject({
        method: "POST", url: "/v1/me/linked-channels/telegram/prefer",
        headers: { authorization: "Bearer signed-A" },
      });
      expect(prefer.statusCode).toBe(409);
      expect(prefer.json()).toEqual({ error: "LINK_NOT_FOUND" });
    } finally { await app.close(); }
  });
});

