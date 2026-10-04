import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { AgentPresentationRepository, CharacterSkillAssignmentRepository } from "@masanawa/agents";
import { createAlphaDevAuthorizer, createAlphaDirectoryAuthorizer } from "./alpha_dev.js";
import { createAgentDirectoryService } from "./agent_directory.js";
import { createGatewayApp } from "./app.js";

const tenantId = createCanonicalId("tenant");
const userId = createCanonicalId("user");
const characterId = createCanonicalId("character");
const relationshipId = createCanonicalId("relationship");
const token = "alpha-private-test-token-of-at-least-32-characters";
const apps: Array<ReturnType<typeof createGatewayApp>> = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe("Alpha HTTP authorization", () => {
  it.each([undefined, "Basic invalid", "Bearer wrong", "Bearer "])(
    "returns 401 without reading directory data for %s",
    async authorizationHeader => {
      const listVisible = vi.fn(async () => []);
      const presentations = { listVisible } as unknown as AgentPresentationRepository;
      const authorizer = createAlphaDirectoryAuthorizer({ token, tenantId, userId, relationshipIds: { [characterId]: relationshipId } });
      const app = createGatewayApp({ agentDirectory: createAgentDirectoryService({ presentations, authorizer }) });
      apps.push(app);
      const response = await app.inject({ method: "GET", url: "/v1/agent/directory",
        ...(authorizationHeader ? { headers: { authorization: authorizationHeader } } : {}) });
      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("ALPHA_UNAUTHORIZED");
      expect(response.body).not.toContain(token);
      expect(listVisible).not.toHaveBeenCalled();
    },
  );

  it("conversation denies an invalid token before repository access", async () => {
    const readForCharacter = vi.fn(async () => null);
    const authorizer = createAlphaDevAuthorizer({
      config: { token, tenantId, userId, policyRevision: "test-policy",
        relationshipIds: { [characterId]: relationshipId } },
      presentations: { readForCharacter } as unknown as AgentPresentationRepository,
      skillAssignments: { readForCharacter } as unknown as CharacterSkillAssignmentRepository,
    });
    await expect(authorizer.authorize({ characterId, authorizationHeader: "Bearer wrong" }))
      .rejects.toMatchObject({ statusCode: 401, code: "ALPHA_UNAUTHORIZED" });
    expect(readForCharacter).not.toHaveBeenCalled();
  });

  it("uses the same non-disclosing 403 for unadmitted and hidden Characters", async () => {
    const readForCharacter = vi.fn(async () => null);
    for (const relationshipIds of [{}, { [characterId]: relationshipId }]) {
      const authorizer = createAlphaDevAuthorizer({
        config: { token, tenantId, userId, policyRevision: "test-policy", relationshipIds },
        presentations: { readForCharacter } as unknown as AgentPresentationRepository,
        skillAssignments: { readForCharacter } as unknown as CharacterSkillAssignmentRepository,
      });
      await expect(authorizer.authorize({ characterId, authorizationHeader: `Bearer ${token}` }))
        .rejects.toMatchObject({ statusCode: 403, code: "ALPHA_FORBIDDEN", message: "Character access denied" });
    }
    expect(readForCharacter).toHaveBeenCalledTimes(1);
  });

  it("still admits the configured directory token", async () => {
    const authorizer = createAlphaDirectoryAuthorizer({ token, tenantId, userId, relationshipIds: { [characterId]: relationshipId } });
    await expect(authorizer.authorize({ capability: "agents.directory.read", authorizationHeader: `Bearer ${token}` }))
      .resolves.toEqual({ tenantId, userId, characterIds: [characterId] });
  });
});
