import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkProfileRoutes } from "./talk_profile_routes.js";
import { createTalkProfileService } from "./talk_profiles/service.js";
import type { TalkProfileRepository } from "./talk_profiles/model.js";

function repo(): TalkProfileRepository {
  let following = false;
  return {
    async readHuman({ handle }) {
      if (handle !== "amina") return null;
      return {
        handle: "amina",
        displayName: "Amina",
        bio: "Host",
        avatarUrl: null,
        followerCount: following ? 11 : 10,
        followingCount: 2,
        isFollowing: following,
        isLive: true,
        liveTalkId: "talk_live",
        twinPublicId: "persona_twin",
        twinDisplayName: "Amina Twin",
        talks: [],
      };
    },
    async setFollowing({ handle, following: next }) {
      if (handle !== "amina") return null;
      following = next;
      return {
        handle: "amina",
        displayName: "Amina",
        bio: "Host",
        avatarUrl: null,
        followerCount: following ? 11 : 10,
        followingCount: 2,
        isFollowing: following,
        isLive: true,
        liveTalkId: "talk_live",
        twinPublicId: "persona_twin",
        twinDisplayName: "Amina Twin",
        talks: [],
      };
    },
    async readPersona({ publicId }) {
      if (publicId !== "expert_gwani") return null;
      return {
        publicId,
        displayName: "Gwani",
        kind: "expert",
        seatFeeLabel: "₦250",
        isAvailable: true,
        role: "Masanawa Expert",
        bio: "Talk expert",
        avatarUrl: null,
        ownerHandle: null,
        ownerDisplayName: null,
        topics: ["Business"],
        appearances: [],
        isVerified: true,
      };
    },
    async upsertHuman() {},
    async upsertPersona() {},
  };
}

function app() {
  const server = Fastify();
  const service = createTalkProfileService({
    repository: repo(),
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
  });
  registerTalkProfileRoutes(server, service);
  return server;
}

describe("Talk social profile API", () => {
  it("serves the human mobile projection and live target", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/profiles/amina",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      handle: "amina",
      displayName: "Amina",
      followerCount: 10,
      isFollowing: false,
      isLive: true,
      liveTalkId: "talk_live",
      twinPublicId: "persona_twin",
    });
  });

  it("makes follow/unfollow idempotent through server state", async () => {
    const server = app();
    const first = await server.inject({
      method: "POST",
      url: "/profiles/amina/follow",
      headers: { authorization: "Bearer viewer" },
      payload: { following: true },
    });
    const replay = await server.inject({
      method: "POST",
      url: "/profiles/amina/follow",
      headers: { authorization: "Bearer viewer" },
      payload: { following: true },
    });
    expect(first.json()).toMatchObject({ isFollowing: true, followerCount: 11 });
    expect(replay.json()).toMatchObject({ isFollowing: true, followerCount: 11 });
  });

  it("serves explicit verified Expert persona identity", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/personas/expert_gwani",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      publicId: "expert_gwani",
      displayName: "Gwani",
      kind: "expert",
      isVerified: true,
      seatFeeLabel: "₦250",
    });
  });
});
