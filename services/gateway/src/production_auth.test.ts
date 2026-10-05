import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfile,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import type { UserRelationshipReader } from "@masanawa/identity";
import type { ProductionUserIdentityRepository } from "@masanawa/postgres";
import {
  createProductionAuthService,
  createProductionAuthorizers,
} from "./production_auth.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("production mobile auth", () => {
  it("defaults to email-only and rejects unadvertised SMS before provider dispatch", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    let fetchCalls = 0;
    const auth = createProductionAuthService({
      supabaseUrl: "https://projectref.supabase.co",
      publishableKey: "sb_publishable_test",
      tenantId,
      identities: {
        async resolveOrCreateSupabaseUser() { return userId; },
        async getOrCreateRelationship() { throw new Error("unused"); },
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return json({});
      },
    });

    expect(auth.capabilities()).toEqual({ otpChannels: ["email"] });
    await expect(auth.sendOtp({ phone: "+2348012345678" }))
      .rejects.toMatchObject({
        code: "OTP_CHANNEL_UNAVAILABLE",
        statusCode: 503,
      });
    expect(fetchCalls).toBe(0);
  });

  it("uses the verified Supabase subject to resolve one canonical Masanawa user", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const calls: string[] = [];
    const identities: ProductionUserIdentityRepository = {
      async resolveOrCreateSupabaseUser(input) {
        calls.push(input.subject);
        return userId;
      },
      async getOrCreateRelationship() {
        throw new Error("not used");
      },
    };
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/verify")) {
        expect(init?.method).toBe("POST");
        return json({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: "user@example.com",
            created_at: "2026-10-04T00:00:00.000Z",
            user_metadata: { name: "Amina User" },
          },
        });
      }
      if (url.endsWith("/auth/v1/user")) {
        expect((init?.headers as Record<string, string>).authorization)
          .toBe("Bearer access-token");
        return json({
          id: "11111111-1111-4111-8111-111111111111",
          email: "user@example.com",
          created_at: "2026-10-04T00:00:00.000Z",
          user_metadata: { name: "Amina User" },
        });
      }
      throw new Error("unexpected URL " + url);
    };
    const auth = createProductionAuthService({
      supabaseUrl: "https://projectref.supabase.co",
      publishableKey: "sb_publishable_test",
      tenantId,
      identities,
      fetchImpl,
    });

    const session = await auth.verifyOtp({
      email: "USER@example.com",
      code: "123456",
    });
    expect(session.user.id).toBe(userId);
    expect(session.user.name).toBe("Amina User");
    expect(session.user.isNewUser).toBe(false);

    const authority = await auth.authenticate("Bearer access-token");
    expect(authority).toMatchObject({ tenantId, userId });
    expect(calls).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("admits platform support agents but rejects another user's unrelated clone", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const supportId = createCanonicalId("character");
    const cloneId = createCanonicalId("character");
    const supportVersion = createCanonicalId("character-version");
    const cloneVersion = createCanonicalId("character-version");
    const createdRelationship = createCanonicalId("relationship");

    const supportPresentation: AgentPresentation = {
      schemaVersion: 1,
      tenantId,
      characterId: supportId,
      characterVersionId: supportVersion,
      displayName: "Gwani",
      roleLabel: "Support Agent",
      about: "Helps the user",
      greeting: "Hello",
      visibleInUserApp: true,
      sortOrder: 1,
      revision: 1,
    };
    const clonePresentation: AgentPresentation = {
      ...supportPresentation,
      characterId: cloneId,
      characterVersionId: cloneVersion,
      displayName: "Someone Else",
      roleLabel: "Personal Clone",
      sortOrder: 2,
    };

    const identities: ProductionUserIdentityRepository = {
      async resolveOrCreateSupabaseUser() {
        return userId;
      },
      async getOrCreateRelationship(input) {
        expect(input.characterId).toBe(supportId);
        return createdRelationship;
      },
    };
    const auth = createProductionAuthService({
      supabaseUrl: "https://projectref.supabase.co",
      publishableKey: "sb_publishable_test",
      tenantId,
      identities,
      fetchImpl: async () =>
        json({
          id: "11111111-1111-4111-8111-111111111111",
          user_metadata: { name: "User" },
        }),
    });

    const presentations: AgentPresentationRepository = {
      async readForCharacter(input) {
        if (input.characterId === supportId) return supportPresentation;
        if (input.characterId === cloneId) return clonePresentation;
        return null;
      },
      async listAll() {
        return [supportPresentation, clonePresentation];
      },
      async listVisible() {
        return [supportPresentation, clonePresentation];
      },
      async put(input) {
        return input.presentation;
      },
    };
    const skillAssignments: CharacterSkillAssignmentRepository = {
      async readForCharacter() {
        return null;
      },
      async put(input) {
        return input.assignment;
      },
    };
    const relationships: UserRelationshipReader = {
      async readForUserCharacter() {
        return null;
      },
      async listForUser() {
        return [];
      },
    };
    const supportProfile: PlatformAgentProfile = {
      schemaVersion: 1,
      tenantId,
      characterId: supportId,
      supportAgent: true,
      defaultForNewUsers: true,
      voiceProvider: "gemini",
      voiceName: "Bodi",
      revision: 1,
    };
    const platformProfiles: PlatformAgentProfileRepository = {
      async readForCharacter(input) {
        return input.characterId === supportId ? supportProfile : null;
      },
      async listSupportAgents() {
        return [supportProfile];
      },
      async put(input) {
        return input.profile;
      },
    };

    const authorizers = createProductionAuthorizers({
      auth,
      identities,
      presentations,
      skillAssignments,
      relationships,
      platformProfiles,
      policyRevision: "production-v1",
    });

    const directory = await authorizers.directory.authorize({
      authorizationHeader: "Bearer user-token",
      capability: "agents.directory.read",
    });
    expect(directory.characterIds).toEqual([supportId]);

    const admitted = await authorizers.conversation.authorize({
      authorizationHeader: "Bearer user-token",
      characterId: supportId,
    });
    expect(admitted.scope.relationshipId).toBe(createdRelationship);
    expect(admitted.scope.userId).toBe(userId);

    await expect(
      authorizers.conversation.authorize({
        authorizationHeader: "Bearer user-token",
        characterId: cloneId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });
});
