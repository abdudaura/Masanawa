import { describe, expect, it, vi } from "vitest";
import {
  createCanonicalId,
  type CharacterId,
  type TenantId,
} from "@masanawa/contracts";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import {
  createPlatformSessionVerifier,
  createProductionAuthorizers,
  type ProductionIdentityResolver,
} from "./production_auth.js";

function presentation(
  tenantId: TenantId,
  characterId: CharacterId,
  displayName: string,
): AgentPresentation {
  return {
    schemaVersion: 1,
    tenantId,
    characterId,
    characterVersionId: createCanonicalId("character-version"),
    displayName,
    roleLabel: "Agent",
    about: "Configured agent",
    greeting: null,
    visibleInUserApp: true,
    sortOrder: 1,
    revision: 1,
  };
}

describe("production mobile authentication", () => {
  it("validates the existing platform access token through auth/me", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        authorization: "Bearer platform-token",
        accept: "application/json",
      });
      return new Response(JSON.stringify({ id: "legacy-user-123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const verifier = createPlatformSessionVerifier({
      baseUrl: "https://platform.example",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(verifier.verify("Bearer platform-token")).resolves.toEqual({
      externalUserId: "legacy-user-123",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects invalid platform sessions without exposing the upstream response", async () => {
    const verifier = createPlatformSessionVerifier({
      baseUrl: "https://platform.example",
      fetchImpl: (async () => new Response("private failure", { status: 401 })) as typeof fetch,
    });

    await expect(verifier.verify("Bearer bad-token")).rejects.toThrow(
      "Platform session authorization denied",
    );
  });

  it("shows support agents plus user relationships, but not another user's clone", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const supportId = createCanonicalId("character");
    const ownCloneId = createCanonicalId("character");
    const otherCloneId = createCanonicalId("character");
    const ownRelationshipId = createCanonicalId("relationship");

    const presentationsByCharacter = new Map<CharacterId, AgentPresentation>([
      [supportId, presentation(tenantId, supportId, "Gwani")],
      [ownCloneId, presentation(tenantId, ownCloneId, "My Clone")],
      [otherCloneId, presentation(tenantId, otherCloneId, "Other Clone")],
    ]);
    const presentations: AgentPresentationRepository = {
      async readForCharacter({ characterId }) {
        return presentationsByCharacter.get(characterId) ?? null;
      },
      async listAll() {
        return [...presentationsByCharacter.values()];
      },
      async listVisible() {
        return [...presentationsByCharacter.values()];
      },
      async put({ presentation: value }) {
        return value;
      },
    };
    const skills: CharacterSkillAssignmentRepository = {
      async readForCharacter() {
        return null;
      },
      async put({ assignment }) {
        return assignment;
      },
    };
    const profiles: PlatformAgentProfileRepository = {
      async readForCharacter({ characterId }) {
        return characterId === supportId
          ? {
              schemaVersion: 1,
              tenantId,
              characterId: supportId,
              supportAgent: true,
              defaultForNewUsers: true,
              voiceProvider: "gemini",
              voiceName: "Bodi",
              revision: 1,
            }
          : null;
      },
      async listSupportAgents() {
        return [{
          schemaVersion: 1,
          tenantId,
          characterId: supportId,
          supportAgent: true,
          defaultForNewUsers: true,
          voiceProvider: "gemini",
          voiceName: "Bodi",
          revision: 1,
        }];
      },
      async put({ profile }) {
        return profile;
      },
    };
    const identities: ProductionIdentityResolver = {
      async resolveOrCreateUser() {
        return userId;
      },
      async relationshipFor({ characterId }) {
        expect([supportId, ownCloneId]).toContain(characterId);
        return characterId === ownCloneId
          ? ownRelationshipId
          : createCanonicalId("relationship");
      },
      async listCharacterIdsForUser() {
        return [ownCloneId];
      },
    };

    const auth = createProductionAuthorizers({
      verifier: {
        async verify() {
          return { externalUserId: "platform-user" };
        },
      },
      identities,
      tenantId,
      policyRevision: "test-v1",
      presentations,
      skillAssignments: skills,
      platformProfiles: profiles,
    });

    const directory = await auth.directory.authorize({
      authorizationHeader: "Bearer valid",
      capability: "agents.directory.read",
    });
    expect(new Set(directory.characterIds)).toEqual(
      new Set([supportId, ownCloneId]),
    );
    expect(directory.characterIds).not.toContain(otherCloneId);

    await expect(
      auth.conversation.authorize({
        authorizationHeader: "Bearer valid",
        characterId: otherCloneId,
      }),
    ).rejects.toThrow("Character is not available to this user");

    const support = await auth.conversation.authorize({
      authorizationHeader: "Bearer valid",
      characterId: supportId,
    });
    expect(support.scope.userId).toBe(userId);

    const ownClone = await auth.conversation.authorize({
      authorizationHeader: "Bearer valid",
      characterId: ownCloneId,
    });
    expect(ownClone.scope.relationshipId).toBe(ownRelationshipId);
  });
});
