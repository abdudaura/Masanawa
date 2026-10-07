import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkLiveRoutes } from "./talk_live_routes.js";
import { createTalkLiveService } from "./talk_live/service.js";
import type { TalkLiveRepository, TalkLiveStateView } from "./talk_live/model.js";

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

function app(userId: "user_host" | "user_listener") {
  const server = Fastify();
  const service = createTalkLiveService({
    repository: repository(),
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
});
