import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkLiveRoutes } from "./talk_live_routes.js";
import { createTalkLiveService } from "./talk_live/service.js";
import type { TalkLiveRepository, TalkLiveStateView } from "./talk_live/model.js";
import type { TalkMediaTokenIssuer } from "./talk_live/livekit_media.js";

function repository(): TalkLiveRepository {
  let hostConnected = false;
  let state: TalkLiveStateView = {
    talkId: "talk_1",
    state: "reconnecting",
    hostConnected: false,
    listenerCount: 0,
    aiGenerationAllowed: false,
    reconnectGraceEndsAt: null,
  };
  return {
    async connect(input) {
      const role = input.userId === "user_host" ? "host" : "listener";
      if (role === "host") {
        hostConnected = true;
        state = {
          ...state,
          state: "live",
          hostConnected: true,
          aiGenerationAllowed: true,
          reconnectGraceEndsAt: null,
        };
      } else {
        state = { ...state, listenerCount: state.listenerCount + 1 };
      }
      return {
        sessionId: input.sessionId,
        talkId: input.talkId,
        role,
        state: state.state,
        canPublishAudio: role === "host" && state.state === "live",
        canHearAudio: state.state !== "ended",
        aiGenerationAllowed: state.aiGenerationAllowed,
        reconnectGraceEndsAt: state.reconnectGraceEndsAt,
      };
    },
    async heartbeat(input) {
      const role = input.userId === "user_host" ? "host" : "listener";
      if (role === "host") {
        hostConnected = true;
        state = { ...state, state: "live", hostConnected: true, aiGenerationAllowed: true, reconnectGraceEndsAt: null };
      }
      return {
        sessionId: input.sessionId,
        talkId: input.talkId,
        role,
        state: state.state,
        canPublishAudio: role === "host",
        canHearAudio: true,
        aiGenerationAllowed: state.aiGenerationAllowed,
        reconnectGraceEndsAt: state.reconnectGraceEndsAt,
      };
    },
    async disconnect(input) {
      if (input.userId === "user_host") {
        hostConnected = false;
        state = {
          ...state,
          state: "reconnecting",
          hostConnected: false,
          aiGenerationAllowed: false,
          reconnectGraceEndsAt: "2026-10-07T10:00:30.000Z",
        };
      }
      return state;
    },
    async state() {
      return { ...state, hostConnected };
    },
  };
}

function app(userId: "user_host" | "user_listener", liveRepo: TalkLiveRepository = repository(), mediaTokens?: TalkMediaTokenIssuer) {
  const server = Fastify();
  const service = createTalkLiveService({
    repository: liveRepo,
    ...(mediaTokens ? { mediaTokens } : {}),
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer ok") {
          throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        }
        return {
          tenantId: "tenant_1" as never,
          userId: userId as never,
          profile: {
            tenantId: "tenant_1" as never,
            userId: userId as never,
            name: userId,
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
    now: () => "2026-10-07T10:00:00.000Z",
    createSessionId: () => "talk-live_test-session",
  });
  registerTalkLiveRoutes(server, service);
  return server;
}

describe("Talk live runtime API", () => {
  it("grants publish authority only to the real human Host", async () => {
    const host = await app("user_host").inject({
      method: "POST",
      url: "/talks/talk_1/live/connect",
      headers: { authorization: "Bearer ok" },
    });
    expect(host.statusCode).toBe(201);
    expect(host.json()).toMatchObject({
      role: "host",
      state: "live",
      canPublishAudio: true,
      aiGenerationAllowed: true,
    });

    const listener = await app("user_listener").inject({
      method: "POST",
      url: "/talks/talk_1/live/connect",
      headers: { authorization: "Bearer ok" },
    });
    expect(listener.json()).toMatchObject({
      role: "listener",
      canPublishAudio: false,
    });
  });

  it("stops AI generation immediately when Host disconnects", async () => {
    const server = app("user_host");
    await server.inject({
      method: "POST",
      url: "/talks/talk_1/live/connect",
      headers: { authorization: "Bearer ok" },
    });
    const disconnected = await server.inject({
      method: "POST",
      url: "/talks/talk_1/live/disconnect",
      headers: { authorization: "Bearer ok" },
      payload: { sessionId: "talk-live_test-session" },
    });
    expect(disconnected.json()).toMatchObject({
      state: "reconnecting",
      hostConnected: false,
      aiGenerationAllowed: false,
    });
  });

  it("returns conflict rather than an internal error when a persisted Talk already ended", async () => {
    const terminalRepository: TalkLiveRepository = {
      ...repository(),
      async connect() {
        throw new Error("talks.live.ended");
      },
    };
    const server = app("user_host", terminalRepository);
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_ended/live/connect",
      headers: { authorization: "Bearer ok" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      message: "talks.live.ended",
    });
    const unauthorized = await server.inject({
      method: "POST",
      url: "/talks/talk_ended/live/connect",
    });
    expect(unauthorized.statusCode).toBe(401);
    await server.close();
  });

  it("does not misclassify unknown storage failures as an ended Talk", async () => {
    const brokenRepository: TalkLiveRepository = {
      ...repository(),
      async connect() {
        throw new Error("database_connection_lost");
      },
    };
    const server = app("user_host", brokenRepository);
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_1/live/connect",
      headers: { authorization: "Bearer ok" },
    });
    expect(response.statusCode).toBe(500);
    await server.close();
  });

  it("fails closed with retryable 503 when LiveKit Host eviction cannot be verified", async () => {
    const server = app("user_host", repository(), {
      async mint() {
        throw new Error("talks.live.media_admin_list_failed");
      },
    });
    await server.inject({
      method: "POST",
      url: "/talks/talk_1/live/connect",
      headers: { authorization: "Bearer ok" },
    });
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_1/live/media-token",
      headers: { authorization: "Bearer ok" },
      payload: { sessionId: "talk-live_test-session" },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      statusCode: 503,
      message: "talks.live.media_unavailable",
    });
    await server.close();
  });

  it("does not turn unrelated token-signing failures into false provider outages", async () => {
    const server = app("user_host", repository(), {
      async mint() {
        throw new TypeError("unexpected_signing_failure");
      },
    });
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_1/live/media-token",
      headers: { authorization: "Bearer ok" },
      payload: { sessionId: "talk-live_test-session" },
    });
    expect(response.statusCode).toBe(500);
    await server.close();
  });

  it("withholds a signed token when a concurrent Host resume supersedes the lease during LiveKit I/O", async () => {
    const original = repository();
    let heartbeats = 0;
    const resumedRepository: TalkLiveRepository = {
      ...original,
      async heartbeat(input) {
        heartbeats += 1;
        if (heartbeats > 1) return null;
        return original.heartbeat(input);
      },
    };
    let minted = 0;
    const server = app("user_host", resumedRepository, {
      async mint() {
        minted += 1;
        return {
          server_url: "wss://live.example.test",
          participant_token: "signed-token-must-not-leak",
          room_name: "talk_1",
          participant_identity: "user_host:talk-live_test-session",
          expires_at: "2026-10-08T09:00:00.000Z",
        };
      },
    });
    await server.inject({
      method: "POST", url: "/talks/talk_1/live/connect",
      headers: { authorization: "Bearer ok" },
    });
    const response = await server.inject({
      method: "POST", url: "/talks/talk_1/live/media-token",
      headers: { authorization: "Bearer ok" },
      payload: { sessionId: "talk-live_test-session" },
    });
    expect(minted).toBe(1);
    expect(heartbeats).toBe(2);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      message: "talks.live.session_changed",
    });
    expect(response.body).not.toContain("signed-token-must-not-leak");
    await server.close();
  });
});

