import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkProfileRoutes } from "./talk_profile_routes.js";
import { createTalkProfileService } from "./talk_profiles/service.js";
import type { TalkProfileRepository } from "./talk_profiles/model.js";

function repo(initiallyMissing = false): TalkProfileRepository {
  let hasOwnProfile = !initiallyMissing;
  let handle = "amina";
  let following = false;
  let displayName = "Amina";
  let biography = "Host";
  let avatarUrl: string | null = "https://assets.example.test/avatar.jpg";
  return {
    async readHuman({ handle }) {
      if (handle !== "amina") return null;
      return {
        handle,
        displayName,
        bio: biography,
        avatarUrl,
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
      if (userId !== "user_am" && userId !== "user_viewer") return null;
      if (userId === "user_viewer" && !hasOwnProfile) return null;
      return {
        handle,
        displayName,
        bio: biography,
        avatarUrl,
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
    async createOwnHuman(input) {
      if (input.userId !== "user_viewer" || hasOwnProfile) return null;
      if (input.handle === "taken") {
        throw Object.assign(new Error("unique constraint"), { code: "23505" });
      }
      hasOwnProfile = true;
      handle = input.handle;
      displayName = input.displayName;
      biography = input.bio;
      avatarUrl = null;
      return {
        handle, displayName, bio: biography, avatarUrl,
        followerCount: 0, followingCount: 0, isFollowing: false,
        isLive: false, liveTalkId: null, twinPublicId: null,
        twinDisplayName: null, talks: [],
      };
    },
    async updateOwnHuman(input) {
      if (input.tenantId !== "tenant_1" || input.userId !== "user_viewer") {
        return null;
      }
      if (input.displayName !== undefined) displayName = input.displayName;
      if (input.bio !== undefined) biography = input.bio;
      if (input.removeAvatar === true) avatarUrl = null;
      return {
        handle,
        displayName,
        bio: biography,
        avatarUrl,
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
    async upsertHuman() {},
    async upsertPersona() {},
  };
}

function app(initiallyMissing = false) {
  const server = Fastify();
  const service = createTalkProfileService({
    repository: repo(initiallyMissing),
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
  it("requires authentication and edits only the authenticated self profile", async () => {
    const server = app();
    const denied = await server.inject({
      method: "PATCH", url: "/profiles/me",
      payload: { displayName: "Taken Over" },
    });
    expect(denied.statusCode).toBe(401);
    const self = await server.inject({
      method: "GET", url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
    });
    expect(self.statusCode).toBe(200);
    expect(self.json()).toMatchObject({
      handle: "amina", displayName: "Amina",
    });

    const edited = await server.inject({
      method: "PATCH", url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
      payload: {
        displayName: "  Amina   Bello ",
        bio: "  Learning and community  ",
        removeAvatar: true,
      },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({
      handle: "amina",
      displayName: "Amina Bello",
      bio: "Learning and community",
      avatarUrl: null,
    });
    const refreshed = await server.inject({
      method: "GET", url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
    });
    expect(refreshed.json()).toMatchObject({
      displayName: "Amina Bello",
      avatarUrl: null,
    });
    await server.close();
  });

  it("rejects invalid edits and arbitrary ownership/URL writes", async () => {
    const server = app();
    for (const payload of [
      { displayName: "  " },
      { bio: "x".repeat(301) },
      { removeAvatar: false },
      { handle: "takeover" },
      { avatarUrl: "https://attacker.example/track" },
      { userId: "user_am", displayName: "Imposter" },
    ]) {
      const reply = await server.inject({
        method: "PATCH", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload,
      });
      expect(reply.statusCode).toBe(400);
    }
    await server.close();
  });

  it.each(["userId", "tenantId", "avatarUrl"])(
    "rejects injected %s before mutating or creating an owner profile",
    async (field) => {
      const server = app();
      const edited = await server.inject({
        method: "PATCH", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload: { displayName: "Imposter", [field]: "client-authority" },
      });
      expect(edited.statusCode).toBe(400);
      const unchanged = await server.inject({
        method: "GET", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
      });
      expect(unchanged.json()).toMatchObject({
        displayName: "Amina", bio: "Host", avatarUrl: "https://assets.example.test/avatar.jpg",
      });
      const recovered = await server.inject({
        method: "PATCH", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload: { displayName: "Recovered" },
      });
      expect(recovered.statusCode).toBe(200);
      expect(recovered.json()).toMatchObject({
        displayName: "Recovered", avatarUrl: "https://assets.example.test/avatar.jpg",
      });
      await server.close();

      const missing = app(true);
      const created = await missing.inject({
        method: "PUT", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload: { handle: "imposter", displayName: "Imposter", bio: "", [field]: "client-authority" },
      });
      expect(created.statusCode).toBe(400);
      const stillMissing = await missing.inject({
        method: "GET", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
      });
      expect(stillMissing.statusCode).toBe(404);
      const retried = await missing.inject({
        method: "PUT", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload: { handle: "recovered", displayName: "Recovered", bio: "" },
      });
      expect(retried.statusCode).toBe(201);
      const readback = await missing.inject({
        method: "GET", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
      });
      expect(readback.json()).toMatchObject({
        handle: "recovered", displayName: "Recovered", avatarUrl: null,
      });
      await missing.close();
    },
  );

  it("creates an owner profile once with authenticated tenancy", async () => {
    const server = app(true);
    const before = await server.inject({
      method: "GET", url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
    });
    expect(before.statusCode).toBe(404);
    const created = await server.inject({
      method: "PUT", url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
      payload: { handle: "aminab", displayName: "Amina Bello", bio: "Author" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      handle: "aminab", displayName: "Amina Bello", bio: "Author",
    });
    const replay = await server.inject({
      method: "PUT", url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
      payload: { handle: "someone_else", displayName: "Hijack", bio: "" },
    });
    expect(replay.statusCode).toBe(409);
    await server.close();
  });

  it("rejects invalid new handles and another account's chosen handle", async () => {
    const server = app(true);
    for (const handle of ["a", "Name With Spaces", "UPPER", "@handle"]) {
      const result = await server.inject({
        method: "PUT", url: "/profiles/me",
        headers: { authorization: "Bearer viewer" },
        payload: { handle, displayName: "Amina", bio: "" },
      });
      // Uppercase and prefixed handle normalize; the malformed ones reject.
      if (handle === "UPPER" || handle === "@handle") {
        expect([201, 409]).toContain(result.statusCode);
      } else {
        expect(result.statusCode).toBe(400);
      }
    }
    await server.close();
    const occupiedServer = app(true);
    const occupied = await occupiedServer.inject({
      method: "PUT", url: "/profiles/me",
      headers: { authorization: "Bearer viewer" },
      payload: { handle: "taken", displayName: "Amina", bio: "" },
    });
    expect(occupied.statusCode).toBe(409);
    await occupiedServer.close();
  });

});
