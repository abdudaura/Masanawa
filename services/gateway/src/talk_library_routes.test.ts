import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkLibraryRoutes } from "./talk_library_routes.js";
import { createTalkLibraryService } from "./talk_library/service.js";
import type { TalkLibraryRepository } from "./talk_library/model.js";

const talk = {
  id: "talk_1",
  title: "A Talk",
  summary: "",
  hostName: "Viewer",
  topic: "AI",
  heroImageUrl: null,
  hostAvatarUrl: null,
  isLive: false,
  listenerCount: 8,
  commentCount: 2,
  durationSeconds: 90,
  participants: [{
    id: "user_viewer",
    name: "Viewer",
    kind: "human" as const,
    avatarUrl: null,
    isHost: true,
  }],
};

function app() {
  let saved = false;
  const repository: TalkLibraryRepository = {
    async loadMine() {
      return {
        live: [],
        replays: [talk],
        drafts: [{
          id: "draft_1",
          topic: "Draft topic",
          title: "Draft",
          updatedAt: "2026-10-07T10:00:00.000Z",
        }],
      };
    },
    async loadSaved() {
      return saved ? [talk] : [];
    },
    async savedState() {
      return { saved };
    },
    async setSaved(input) {
      saved = input.saved;
      return { saved };
    },
  };

  const server = Fastify();
  registerTalkLibraryRoutes(
    server,
    createTalkLibraryService({
      repository,
      authorizer: {
        async authorize({ authorizationHeader }) {
          if (authorizationHeader !== "Bearer viewer") {
            throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
          }
          return {
            tenantId: "tenant_1" as never,
            userId: "user_viewer" as never,
            profile: {
              tenantId: "tenant_1" as never,
              userId: "user_viewer" as never,
              name: "Viewer",
              email: null,
              phone: null,
              locale: "en",
              createdAt: "2026-10-07T00:00:00.000Z",
            },
          };
        },
      },
      now: () => "2026-10-07T10:00:00.000Z",
    }),
  );
  return server;
}

describe("Talk library routes", () => {
  it("serves My Talks in the mobile projection", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/me/talks",
      headers: { authorization: "Bearer viewer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      live: [],
      replays: [{ id: "talk_1" }],
      drafts: [{ id: "draft_1" }],
    });
  });

  it("saves idempotently and then lists the Talk", async () => {
    const server = app();

    const saved = await server.inject({
      method: "POST",
      url: "/talks/talk_1/saved",
      headers: { authorization: "Bearer viewer" },
      payload: { saved: true },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ saved: true });

    const replay = await server.inject({
      method: "POST",
      url: "/talks/talk_1/saved",
      headers: { authorization: "Bearer viewer" },
      payload: { saved: true },
    });
    expect(replay.json()).toEqual({ saved: true });

    const list = await server.inject({
      method: "GET",
      url: "/me/saved-talks",
      headers: { authorization: "Bearer viewer" },
    });
    expect(list.json()).toMatchObject([{ id: "talk_1" }]);
  });

  it("removes a saved Talk and exposes saved state", async () => {
    const server = app();
    await server.inject({
      method: "POST",
      url: "/talks/talk_1/saved",
      headers: { authorization: "Bearer viewer" },
      payload: { saved: true },
    });

    const removed = await server.inject({
      method: "POST",
      url: "/talks/talk_1/saved",
      headers: { authorization: "Bearer viewer" },
      payload: { saved: false },
    });
    expect(removed.json()).toEqual({ saved: false });

    const state = await server.inject({
      method: "GET",
      url: "/talks/talk_1/saved",
      headers: { authorization: "Bearer viewer" },
    });
    expect(state.json()).toEqual({ saved: false });
  });
});
