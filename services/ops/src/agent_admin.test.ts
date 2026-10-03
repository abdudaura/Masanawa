import { describe, expect, it } from "vitest";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignment,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import type { CharacterId, TenantId } from "@masanawa/contracts";
import type { CharacterVersionReferenceReader } from "@masanawa/identity";
import type { SkillRepository } from "@masanawa/skills";
import {
  createAgentAdminService,
  type AgentAdminAuthorizer,
} from "./agent_admin.js";

const tenantId =
  "tenant_00000000-0000-4000-8000-000000000001" as TenantId;
const characterId =
  "character_00000000-0000-4000-8000-000000000002" as CharacterId;

const assignedSkillVersionId =
  "skill-version_00000000-0000-4000-8000-000000000004" as never;

const skills: SkillRepository = {
  async registerBatch() {
    return [];
  },
  async readSnapshot() {
    return {
      skills: [],
      versions: [
        {
          skillVersionId: assignedSkillVersionId,
        } as never,
      ],
      readiness: [],
    };
  },
  async putReadiness() {
    throw new Error("not used");
  },
};

const characterVersions: CharacterVersionReferenceReader = {
  async assertCharacterVersion() {},
};

function repositories() {
  let presentation: AgentPresentation | null = null;
  let assignment: CharacterSkillAssignment | null = null;

  const presentations: AgentPresentationRepository = {
    async readForCharacter() {
      return presentation;
    },
    async listAll() {
      return presentation ? [presentation] : [];
    },
    async listVisible() {
      return presentation?.visibleInUserApp ? [presentation] : [];
    },
    async put(input) {
      presentation = Object.freeze({
        ...input.presentation,
        revision: input.expectedRevision === null
          ? 1
          : input.expectedRevision + 1,
      });
      return presentation;
    },
  };

  const skillAssignments: CharacterSkillAssignmentRepository = {
    async readForCharacter() {
      return assignment;
    },
    async put(input) {
      assignment = Object.freeze({
        ...input.assignment,
        revision: input.expectedRevision === null
          ? 1
          : input.expectedRevision + 1,
      });
      return assignment;
    },
  };

  return { presentations, skillAssignments };
}

describe("Ops agent administration", () => {
  it("lists the catalog without requiring a Character assignment", async () => {
    const capabilities: string[] = [];
    const service = createAgentAdminService({
      ...repositories(), characterVersions, skills,
      authorizer: { async authorize(input) { capabilities.push(input.capability); return { tenantId }; } },
    });
    const catalog = await service.listSkills({ authorizationHeader: "Bearer operator" });
    expect(catalog[0]?.skillVersionId).toBe(assignedSkillVersionId);
    expect(catalog[0]?.readiness).toBe("unknown");
    expect(capabilities).toEqual(["skills.catalog.read"]);
  });

  it("rejects Skill assignment to an unconfigured Character before writing", async () => {
    const repos = repositories();
    let writes = 0;
    const service = createAgentAdminService({
      ...repos, characterVersions, skills,
      skillAssignments: {
        ...repos.skillAssignments,
        async put(input) { writes++; return repos.skillAssignments.put(input); },
      },
      authorizer: { async authorize() { return { tenantId }; } },
    });
    await expect(service.putSkillAssignment({
      authorizationHeader: "Bearer operator", expectedRevision: null,
      assignment: { schemaVersion: 1, characterId, skillVersionIds: [assignedSkillVersionId], revision: 1 },
    })).rejects.toThrow("Character must be configured");
    expect(writes).toBe(0);
  });
  it("keeps presentation writes and Skill writes as separate operations", async () => {
    const seen: string[] = [];
    const authorizer: AgentAdminAuthorizer = {
      async authorize(input) {
        seen.push(input.capability);
        return { tenantId };
      },
    };
    const repos = repositories();
    const service = createAgentAdminService({
      ...repos,
      characterVersions,
      skills,
      authorizer,
    });

    const presentation = await service.putPresentation({
      authorizationHeader: "Bearer operator",
      expectedRevision: null,
      presentation: {
        schemaVersion: 1,
        characterId,
        characterVersionId:
          "character-version_00000000-0000-4000-8000-000000000003" as never,
        displayName: "Amina",
        roleLabel: "Sales & Outreach",
        about: "Handles prospecting",
        greeting: "What should we work on?",
        visibleInUserApp: true,
        sortOrder: 10,
        revision: 1,
      },
    });

    const assignment = await service.putSkillAssignment({
      authorizationHeader: "Bearer operator",
      expectedRevision: null,
      assignment: {
        schemaVersion: 1,
        characterId,
        skillVersionIds: [
          assignedSkillVersionId,
        ],
        revision: 1,
      },
    });

    expect(presentation.displayName).toBe("Amina");
    expect(presentation).not.toHaveProperty("skillVersionIds");
    expect(assignment).not.toHaveProperty("displayName");
    expect(seen).toEqual([
      "agents.presentation.write",
      "agents.skills.write",
    ]);
  });

  it("never touches repositories when authorization fails", async () => {
    let writes = 0;
    const repos = repositories();
    const presentations: AgentPresentationRepository = {
      ...repos.presentations,
      async put(input) {
        writes += 1;
        return repos.presentations.put(input);
      },
    };
    const authorizer: AgentAdminAuthorizer = {
      async authorize() {
        throw new Error("denied");
      },
    };
    const service = createAgentAdminService({
      presentations,
      skillAssignments: repos.skillAssignments,
      characterVersions,
      skills,
      authorizer,
    });

    await expect(
      service.putPresentation({
        authorizationHeader: undefined,
        expectedRevision: null,
        presentation: {
          schemaVersion: 1,
          characterId,
          characterVersionId:
            "character-version_00000000-0000-4000-8000-000000000003" as never,
          displayName: "Amina",
          roleLabel: "Research",
          about: "",
          greeting: null,
          visibleInUserApp: true,
          sortOrder: 0,
          revision: 1,
        },
      }),
    ).rejects.toThrow("denied");

    expect(writes).toBe(0);
  });
});
