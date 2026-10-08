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
    async readHumanByUserId({ userId }) {
      if (userId !== "user_am") return null;
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
    async setFollowingByUserId({ userId, following: next }) {
      if (userId !== "user_am") return null;
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
    async saveSelf(input) {
      if (input.userId !== "user_viewer" || input.tenantId !== "tenant_1") {
        throw new Error("profiles.unauthorized_owner");
      }
      if (input.handle === "already_taken") {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      return {
        handle: input.handle,
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: null,
        followerCount: 0,
        followingCount: 0,
        isFollowing: false,
        isLive: false,
        liveTalkId: null,
        twinPublicId: null,
        twinDisplayName: null,
        talks: [],
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
  it("edits only the authenticated user's normalized public identity", async () => {
    const response = await app().inject({
      method: "PUT",
      url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
      payload: { handle: "  @New_Handle ", displayName: "  Amina Bello  ", bio: "  Host and writer  " },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      handle: "new_handle",
      displayName: "Amina Bello",
      bio: "Host and writer",
      avatarUrl: null,
    });
  });

  it("does not allow editing the owner ID or setting arbitrary avatar URLs", async () => {
    for (const extra of [{ userId: "user_victim" }, { avatarUrl: "https://evil.invalid/photo.jpg" }]) {
      const response = await app().inject({
        method: "PUT",
        url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload: { handle: "new_handle", displayName: "Amina", bio: "", ...extra },
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it("requires a signed-in session and rejects untrusted profile data", async () => {
    const server = app();
    const unauthorized = await server.inject({
      method: "PUT",
      url: "/profiles/me",
      payload: { handle: "new_handle", displayName: "Amina", bio: "" },
    });
    expect(unauthorized.statusCode).toBe(401);

    for (const invalid of [
      { handle: "x", displayName: "Amina", bio: "" },
      { handle: "valid_handle", displayName: "   ", bio: "" },
      { handle: "valid_handle", displayName: "Amina", bio: "x".repeat(1001) },
    ]) {
      const response = await server.inject({
        method: "PUT",
        url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload: invalid,
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it("returns conflict when a concurrent user already owns the handle", async () => {
    const response = await app().inject({
      method: "PUT",
      url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
      payload: { handle: "already_taken", displayName: "Amina", bio: "" },
    });
    expect(response.statusCode).toBe(409);
  });


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

  it("reads and follows a Host through canonical user-id addressing", async () => {
    const server = app();

    const profile = await server.inject({
      method: "GET",
      url: "/profiles/by-user/user_am",
      headers: { authorization: "Bearer viewer" },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({
      handle: "amina",
      isFollowing: false,
      followerCount: 10,
    });

    const followed = await server.inject({
      method: "POST",
      url: "/profiles/by-user/user_am/follow",
      headers: { authorization: "Bearer viewer" },
      payload: { following: true },
    });
    expect(followed.statusCode).toBe(200);
    expect(followed.json()).toMatchObject({
      handle: "amina",
      isFollowing: true,
      followerCount: 11,
    });
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
