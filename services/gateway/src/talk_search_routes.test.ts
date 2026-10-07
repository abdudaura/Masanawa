import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkSearchRoutes } from "./talk_search_routes.js";
import { createTalkSearchService } from "./talk_search/service.js";
import type { TalkSearchRepository } from "./talk_search/model.js";

function app() {
  const repository: TalkSearchRepository = {
    async searchTalks({ query }) {
      return [{
        id: "talk_1",
        title: "AI and work: " + query,
        summary: "",
        hostName: "Musa",
        topic: "AI",
        heroImageUrl: null,
        hostAvatarUrl: null,
        isLive: true,
        listenerCount: 14,
        commentCount: 2,
        durationSeconds: null,
        participants: [{
          id: "user_host",
          name: "Musa",
          kind: "human",
          avatarUrl: null,
          isHost: true,
        }],
      }];
    },
    async searchPeople() {
      return [{
        handle: "amina",
        displayName: "Amina",
        bio: "Host",
        avatarUrl: null,
        isLive: false,
        liveTalkId: null,
      }];
    },
    async searchPersonas({ kind }) {
      return [{
        publicId: kind === "twin" ? "amina-twin" : "economist",
        displayName: kind === "twin" ? "Amina Twin" : "Economist",
        kind: kind ?? "expert",
        seatFeeLabel: "₦300",
        isAvailable: true,
        role: "Economy",
        avatarUrl: null,
        isVerified: kind !== "twin",
      }];
    },
  };

  const server = Fastify();
  registerTalkSearchRoutes(
    server,
    createTalkSearchService({
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
    }),
  );
  return server;
}

describe("Global Talk search route", () => {
  it("serves the mobile all-search response shape", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/search?q=ai&type=all&limit=30",
      headers: { authorization: "Bearer viewer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      talks: [{ id: "talk_1", isLive: true }],
      people: [{ handle: "amina" }],
      personas: [{ publicId: "economist", kind: "expert" }],
    });
  });

  it("returns only the selected persona kind", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/search?q=amina&type=twins&limit=10",
      headers: { authorization: "Bearer viewer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      talks: [],
      people: [],
      personas: [{
        publicId: "amina-twin",
        displayName: "Amina Twin",
        kind: "twin",
        seatFeeLabel: "₦300",
        isAvailable: true,
        role: "Economy",
        avatarUrl: null,
        isVerified: false,
      }],
    });
  });

  it("rejects malformed filters before search execution", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/search?q=ai&type=agents",
      headers: { authorization: "Bearer viewer" },
    });

    expect(response.statusCode).toBe(400);
  });
});
