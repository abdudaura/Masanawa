import { afterEach, describe, expect, it } from "vitest";
import type { AgentAdminService } from "./agent_admin.js";
import { createOpsApp } from "./app.js";

const apps: Array<ReturnType<typeof createOpsApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Ops agent admin routes", () => {
  it("forwards operator authorization and keeps presentation/Skills separate", async () => {
    const calls: string[] = [];
    const service: AgentAdminService = {
      async listPresentations(input) {
        calls.push(`presentations:${input.authorizationHeader ?? ""}`);
        return [];
      },
      async listSkills(input) {
        calls.push(`skills:${input.authorizationHeader ?? ""}`);
        return [];
      },
      async readSkillAssignment() {
        return null;
      },
      async putPresentation(input) {
        calls.push(`presentation-write:${input.authorizationHeader ?? ""}`);
        return {
          tenantId: "tenant_00000000-0000-7000-8000-000000000001" as never,
          ...input.presentation,
          revision: 1,
        };
      },
      async putSkillAssignment(input) {
        calls.push(`skills-write:${input.authorizationHeader ?? ""}`);
        return {
          tenantId: "tenant_00000000-0000-7000-8000-000000000001" as never,
          ...input.assignment,
          revision: 1,
        };
      },
    };
    const app = createOpsApp({ agentAdmin: service });
    apps.push(app);

    const headers = { authorization: "Bearer operator" };

    const agents = await app.inject({
      method: "GET",
      url: "/v1/agents",
      headers,
    });
    expect(agents.statusCode).toBe(200);

    const skills = await app.inject({
      method: "GET",
      url: "/v1/skills",
      headers,
    });
    expect(skills.statusCode).toBe(200);

    const presentation = await app.inject({
      method: "PUT",
      url: "/v1/agents/character_00000000-0000-7000-8000-000000000002/presentation",
      headers,
      payload: {
        schemaVersion: 1,
        characterVersionId:
          "character-version_00000000-0000-7000-8000-000000000003",
        displayName: "Amina",
        roleLabel: "Sales & Outreach",
        about: "Handles prospects",
        greeting: "What should we work on?",
        visibleInUserApp: true,
        sortOrder: 1,
        expectedRevision: null,
      },
    });
    expect(presentation.statusCode).toBe(200);
    expect(presentation.json().displayName).toBe("Amina");
    expect(presentation.json()).not.toHaveProperty("skillVersionIds");

    const assignment = await app.inject({
      method: "PUT",
      url: "/v1/agents/character_00000000-0000-7000-8000-000000000002/skills",
      headers,
      payload: {
        schemaVersion: 1,
        skillVersionIds: [
          "skill-version_00000000-0000-7000-8000-000000000004",
        ],
        expectedRevision: null,
      },
    });
    expect(assignment.statusCode).toBe(200);
    expect(assignment.json()).not.toHaveProperty("displayName");

    expect(calls).toEqual([
      "presentations:Bearer operator",
      "skills:Bearer operator",
      "presentation-write:Bearer operator",
      "skills-write:Bearer operator",
    ]);
  });
});
