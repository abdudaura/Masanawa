import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { OwnerAccessService } from "./owner_access.js";
import {
  registerOwnerAccessRoutes,
  registerOwnerAccessDisputeAdminRoutes,
} from "./owner_access_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("owner access routes", () => {
  it("returns a quote without creating a request", async () => {
    let quoted = false;
    const service: OwnerAccessService = {
      async quote(input) {
        quoted = true;
        return {
          requestId: "owner-request-123",
          ownerUserId: "user-owner",
          originatingCharacterId: input.characterId,
          modality: input.modality,
          durationMinutes: input.durationMinutes,
          priceCredits: 0,
          platformFeeCredits: 0,
          ownerEarningCredits: 0,
          chargeMode: "trial",
          trialDurationDays: 7,
          policyRevision: 1,
          trialPolicyRevision: 1,
          quoteExpiresAt: "2026-10-05T11:00:00Z",
        };
      },
      async request() {
        throw new Error("not used");
      },
      async act() {
        throw new Error("not used");
      },
      async read() {
        return null;
      },
      async latest() {
        return null;
      },
      async heartbeat() {
        return {
          attendanceVerified: false,
          verifiedSeconds: 0,
          sessionEndsAt: null,
          realPersonSession: true,
          recordingAllowed: false,
          messageRetentionDays: 30,
          presence: [],
        };
      },
      async messages() {
        return [];
      },
      async sendMessage() {
        throw new Error("not used");
      },
    };
    const app = Fastify();
    apps.push(app);
    registerOwnerAccessRoutes(app, service);

    const response = await app.inject({
      method: "POST",
      url: "/agent/twin/owner-access/quote",
      payload: {
        characterId:
          "character_00000000-0000-4000-8000-000000000003",
        modality: "text",
        durationMinutes: 20,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(quoted).toBe(true);
    expect(response.json().trialDurationDays).toBe(7);
  });

  it("routes private text-room heartbeat and messages", async () => {
    const calls: string[] = [];
    const service: OwnerAccessService = {
      async quote() { throw new Error("not used"); },
      async request() { throw new Error("not used"); },
      async act() { throw new Error("not used"); },
      async read() { return null; },
      async latest() { return null; },
      async heartbeat(input) {
        calls.push("heartbeat:" + input.requestId);
        return {
          attendanceVerified: true,
          verifiedSeconds: 70,
          sessionEndsAt: "2026-10-05T10:20:00Z",
          realPersonSession: true,
          recordingAllowed: false,
          messageRetentionDays: 30,
          presence: [],
        };
      },
      async messages(input) {
        calls.push("messages:" + input.requestId);
        return [];
      },
      async sendMessage(input) {
        calls.push("send:" + input.messageId);
        return {
          requestId: input.requestId,
          messageId: input.messageId,
          senderUserId: "user-requester",
          body: input.body,
          sentAt: "2026-10-05T10:00:00Z",
        };
      },
    };
    const app = Fastify();
    apps.push(app);
    registerOwnerAccessRoutes(app, service);
    const requestId = "owner-request-room-123";
    const characterId =
      "character_00000000-0000-4000-8000-000000000003";

    const heartbeat = await app.inject({
      method: "POST",
      url: "/agent/twin/owner-access/" + requestId + "/heartbeat",
      payload: { characterId },
    });
    expect(heartbeat.statusCode).toBe(200);
    expect(heartbeat.json()).toMatchObject({
      attendanceVerified: true,
      realPersonSession: true,
      recordingAllowed: false,
      messageRetentionDays: 30,
    });

    const messages = await app.inject({
      method: "GET",
      url:
        "/agent/twin/owner-access/" +
        requestId +
        "/messages?characterId=" +
        encodeURIComponent(characterId),
    });
    expect(messages.statusCode).toBe(200);

    const sent = await app.inject({
      method: "POST",
      url: "/agent/twin/owner-access/" + requestId + "/messages",
      payload: {
        characterId,
        messageId: "message-client-123",
        body: "Hello",
      },
    });
    expect(sent.statusCode).toBe(200);
    expect(sent.json().body).toBe("Hello");
    expect(calls).toEqual([
      "heartbeat:" + requestId,
      "messages:" + requestId,
      "send:message-client-123",
    ]);
  });


  it("routes requester dispute reason through the participant action endpoint", async () => {
    let captured: Record<string, unknown> | null = null;
    const service: OwnerAccessService = {
      async quote() { throw new Error("not used"); },
      async request() { throw new Error("not used"); },
      async act(input) {
        captured = input as unknown as Record<string, unknown>;
        return {
          requestId: input.requestId,
          requesterUserId: "user-requester",
          ownerUserId: "user-owner",
          originatingCharacterId: input.characterId,
          modality: "text",
          durationMinutes: 15,
          priceCredits: 100,
          platformFeeCredits: 20,
          ownerEarningCredits: 80,
          chargeMode: "paid",
          trialPolicyRevision: 1,
          state: "disputed",
          requestedAt: "2026-10-05T10:00:00Z",
          acceptBy: "2026-10-05T11:00:00Z",
          scheduledFor: null,
          startedAt: "2026-10-05T10:10:00Z",
          completedAt: "2026-10-05T10:25:00Z",
          disputeBy: "2026-10-06T10:25:00Z",
          disputedAt: "2026-10-05T10:30:00Z",
          disputeReason: "service-quality",
        };
      },
      async read() { return null; },
      async latest() { return null; },
      async heartbeat() { throw new Error("not used"); },
      async messages() { return []; },
      async sendMessage() { throw new Error("not used"); },
    };
    const app = Fastify();
    apps.push(app);
    registerOwnerAccessRoutes(app, service);
    const characterId =
      "character_00000000-0000-4000-8000-000000000003";

    const response = await app.inject({
      method: "POST",
      url: "/agent/twin/owner-access/owner-request-dispute-123/action",
      payload: {
        characterId,
        action: "dispute",
        disputeReason: "service-quality",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(captured).toEqual(
      expect.objectContaining({
        action: "dispute",
        disputeReason: "service-quality",
      }),
    );
  });

  it("keeps admin dispute resolution on a separate route", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const app = Fastify();
    apps.push(app);
    registerOwnerAccessDisputeAdminRoutes(app, {
      async resolve(input) {
        calls.push(input as unknown as Record<string, unknown>);
        return { state: input.resolution === "refund" ? "refunded" : "settled" };
      },
    });
    const characterId =
      "character_00000000-0000-4000-8000-000000000003";

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/twin/owner-access/owner-request-dispute-123/dispute",
      payload: {
        characterId,
        resolution: "refund",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      expect.objectContaining({
        characterId,
        requestId: "owner-request-dispute-123",
        resolution: "refund",
      }),
    ]);
  });

});
