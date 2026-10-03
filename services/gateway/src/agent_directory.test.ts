import { describe, expect, it } from "vitest";
import type {
  AgentPresentation,
  AgentPresentationRepository,
} from "@masanawa/agents";
import type { TenantId } from "@masanawa/contracts";
import {
  createAgentDirectoryService,
  type AgentDirectoryAuthorizer,
} from "./agent_directory.js";

const tenantId =
  "tenant_00000000-0000-4000-8000-000000000001" as TenantId;

const presentation: AgentPresentation = {
  schemaVersion: 1,
  tenantId,
  characterId:
    "character_00000000-0000-4000-8000-000000000002" as never,
  characterVersionId:
    "character-version_00000000-0000-4000-8000-000000000003" as never,
  displayName: "Amina",
  roleLabel: "Sales & Outreach",
  about: "Handles prospecting",
  greeting: "What should we work on?",
  visibleInUserApp: true,
  sortOrder: 10,
  revision: 1,
};

describe("mobile agent directory", () => {
  it("projects presentation without leaking Skill assignments", async () => {
    const presentations: AgentPresentationRepository = {
      async readForCharacter() {
        return presentation;
      },
      async listAll() {
        return [presentation];
      },
      async listVisible() {
        return [presentation];
      },
      async put() {
        return presentation;
      },
    };
    const authorizer: AgentDirectoryAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("agents.directory.read");
        expect(input.authorizationHeader).toBe("Bearer user");
        return { tenantId };
      },
    };

    const service = createAgentDirectoryService({
      presentations,
      authorizer,
    });
    const entries = await service.list({
      authorizationHeader: "Bearer user",
    });

    expect(entries).toEqual([
      {
        characterId: presentation.characterId,
        characterVersionId: presentation.characterVersionId,
        displayName: "Amina",
        roleLabel: "Sales & Outreach",
        about: "Handles prospecting",
        greeting: "What should we work on?",
        presence: "available",
        activeWorkCount: 0,
      },
    ]);
    expect(entries[0]).not.toHaveProperty("skillVersionIds");
  });

  it("does not read presentation data when authorization fails", async () => {
    let reads = 0;
    const presentations: AgentPresentationRepository = {
      async readForCharacter() {
        return null;
      },
      async listAll() {
        return [];
      },
      async listVisible() {
        reads += 1;
        return [presentation];
      },
      async put() {
        return presentation;
      },
    };
    const authorizer: AgentDirectoryAuthorizer = {
      async authorize() {
        throw new Error("denied");
      },
    };

    const service = createAgentDirectoryService({
      presentations,
      authorizer,
    });

    await expect(
      service.list({ authorizationHeader: "Bearer bad" }),
    ).rejects.toThrow("denied");
    expect(reads).toBe(0);
  });
});
