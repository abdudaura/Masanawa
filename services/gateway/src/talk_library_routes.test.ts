import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import type { TalkRecord } from "./talks/model.js";
import type {
  TalkLibraryRepository,
  TalkLibraryRow,
} from "./talk_library/model.js";
import { createTalkLibraryService } from "./talk_library/service.js";
import { registerTalkLibraryRoutes } from "./talk_library_routes.js";

function talk(
  input: Partial<TalkRecord> & Pick<TalkRecord, "talkId" | "hostUserId" | "state">,
): TalkLibraryRow {
  return Object.freeze({
    talk: Object.freeze({
      tenantId: "tenant_1",
      talkId: input.talkId,
      hostUserId: input.hostUserId,
      hostName: input.hostUserId === "user_viewer" ? "Viewer" : "Amina",
      title: input.talkId,
      topic: "AI",
      summary: "",
      state: input.state,
      listenerCount: 7,
      durationSeconds: input.state === "ended" ? 300 : null,
      createdAt: "2026-10-07T08:00:00.000Z",
      updatedAt: "2026-10-07T09:00:00.000Z",
    }),
    commentCount: 2,
  });
}

function app() {
  const saved = new Set<string>(["talk_saved"]);
  const owned = [
    talk({ talkId: "talk_live", hostUserId: "user_viewer", state: "live" }),
    talk({ talkId: "talk_replay", hostUserId: "user_viewer", state: "ended" }),
  ];
  const savedRows = [
    talk({ talkId: "talk_saved", hostUserId: "user_other", state: "ended" }),
  ];

  const repository: TalkLibraryRepository = {
    async listOwned({ tenantId, userId }) {
      expect(tenantId).toBe("tenant_1");
      expect(userId).toBe("user_viewer");
      return owned;
    },
    async listSaved({ tenantId, userId }) {
      expect(tenantId).toBe("tenant_1");
      expect(userId).toBe("user_viewer");
      return savedRows.filter((row) => saved.has(row.talk.talkId));
    },
    async readSaved({ tenantId, userId, talkId }) {
      expect(tenantId).toBe("tenant_1");
      expect(userId).toBe("user_viewer");
      if (!["talk_saved", "talk_live", "talk_replay"].includes(talkId)) {
        return null;
      }
      return saved.has(talkId);
    },
    async setSaved({ tenantId, userId, talkId, saved: next }) {
      expect(tenantId).toBe("tenant_1");
      expect(userId).toBe("user_viewer");
      if (!["talk_saved", "talk_live", "talk_replay"].includes(talkId)) {
        return null;
      }
      if (next) saved.add(talkId);
      else saved.delete(talkId);
      return next;
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
  it("returns owned live and replay Talks with Host projection", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/me/talks",
      headers: { authorization: "Bearer viewer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      live: [{ id: "talk_live", viewerIsHost: true, isLive: true }],
      replays: [{ id: "talk_replay", viewerIsHost: true, isLive: false }],
      drafts: [],
    });
  });

  it("returns only the authenticated viewer's Saved Talks", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/me/saved-talks",
      headers: { authorization: "Bearer viewer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({ id: "talk_saved", viewerIsHost: undefined }),
    ]);
  });

  it("saves and unsaves idempotently", async () => {
    const server = app();
    const headers = { authorization: "Bearer viewer" };

    const first = await server.inject({
      method: "PUT",
      url: "/me/saved-talks/talk_live",
      headers,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ talkId: "talk_live", saved: true });

    const second = await server.inject({
      method: "PUT",
      url: "/me/saved-talks/talk_live",
      headers,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ talkId: "talk_live", saved: true });

    const remove = await server.inject({
      method: "DELETE",
      url: "/me/saved-talks/talk_live",
      headers,
    });
    expect(remove.statusCode).toBe(200);
    expect(remove.json()).toEqual({ talkId: "talk_live", saved: false });
  });

  it("returns 404 for a Talk outside the visible tenant library", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/me/saved-talks/talk_missing",
      headers: { authorization: "Bearer viewer" },
    });

    expect(response.statusCode).toBe(404);
  });
});
