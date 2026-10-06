import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import type { ChannelLinkingService } from "./channel_linking.js";
import { registerChannelLinkingRoutes } from "./channel_linking_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function service(overrides: Partial<ChannelLinkingService> = {}): ChannelLinkingService {
  return {
    async issue() {
      return {
        status: "issued",
        requestId: createCanonicalId("request"),
        secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
        expiresAt: toInstant("2026-10-06T16:10:00.000Z"),
      };
    },
    async verify() {
      throw new Error("not used");
    },
    async resolve() {
      return {
        status: "unlinked",
        reason: "binding-not-found",
      };
    },
    ...overrides,
  };
}

describe("channel linking routes", () => {
  it("forwards authenticated issue intent without allowing client-selected User/Tenant", async () => {
    let seen: Parameters<ChannelLinkingService["issue"]>[0] | null = null;
    const app = Fastify();
    apps.push(app);
    registerChannelLinkingRoutes(
      app,
      service({
        async issue(input) {
          seen = input;
          return {
            status: "issued",
            requestId: input.requestId as never,
            secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
            expiresAt: toInstant("2026-10-06T16:10:00.000Z"),
          };
        },
      }),
    );

    const requestId = createCanonicalId("request");
    const channelAccountId = createCanonicalId("channel-account");
    const response = await app.inject({
      method: "POST",
      url: "/v1/channels/link/challenges",
      headers: { authorization: "Bearer platform-user" },
      payload: {
        requestId,
        channelAccountId,
        channel: "whatsapp",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(seen).toEqual({
      authorizationHeader: "Bearer platform-user",
      requestId,
      channelAccountId,
      channel: "whatsapp",
    });
    expect(response.json()).toMatchObject({
      status: "issued",
      requestId,
    });
  });

  it("forwards only transport-authorized verification fields", async () => {
    let seen: Parameters<ChannelLinkingService["verify"]>[0] | null = null;
    const app = Fastify();
    apps.push(app);
    registerChannelLinkingRoutes(
      app,
      service({
        async verify(input) {
          seen = input;
          return {
            status: "rejected",
            reason: "invalid-secret",
            remainingAttempts: 4,
          };
        },
      }),
    );

    const requestId = createCanonicalId("request");
    const channelAccountId = createCanonicalId("channel-account");
    const response = await app.inject({
      method: "POST",
      url: `/v1/channels/link/challenges/${requestId}/verify`,
      payload: {
        transportEvidence: "verified-webhook-evidence",
        channelAccountId,
        channel: "telegram",
        externalSubjectId: "tg:123456789",
        secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(seen).toEqual({
      transportEvidence: "verified-webhook-evidence",
      requestId,
      channelAccountId,
      channel: "telegram",
      externalSubjectId: "tg:123456789",
      secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });
    expect(response.json()).toEqual({
      status: "rejected",
      reason: "invalid-secret",
      remainingAttempts: 4,
    });
  });

  it("rejects unknown issue fields before service invocation", async () => {
    let called = false;
    const app = Fastify();
    apps.push(app);
    registerChannelLinkingRoutes(
      app,
      service({
        async issue() {
          called = true;
          throw new Error("must not be called");
        },
      }),
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/channels/link/challenges",
      payload: {
        requestId: createCanonicalId("request"),
        channelAccountId: createCanonicalId("channel-account"),
        channel: "whatsapp",
        userId: createCanonicalId("user"),
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(called).toBe(false);
  });

  it("rejects invalid channel and short verification secret before service invocation", async () => {
    let called = false;
    const app = Fastify();
    apps.push(app);
    registerChannelLinkingRoutes(
      app,
      service({
        async verify() {
          called = true;
          throw new Error("must not be called");
        },
      }),
    );

    const requestId = createCanonicalId("request");
    const response = await app.inject({
      method: "POST",
      url: `/v1/channels/link/challenges/${requestId}/verify`,
      payload: {
        transportEvidence: "verified-webhook-evidence",
        channelAccountId: createCanonicalId("channel-account"),
        channel: "sms",
        externalSubjectId: "subject",
        secret: "too-short",
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(called).toBe(false);
  });

  it("does not register a public identity-resolution endpoint", async () => {
    const app = Fastify();
    apps.push(app);
    registerChannelLinkingRoutes(app, service());

    const response = await app.inject({
      method: "GET",
      url: "/v1/channels/identity/resolve",
    });

    expect(response.statusCode).toBe(404);
  });
});
