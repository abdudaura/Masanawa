import Fastify from "fastify";
import { createOpsApp } from "../app.js";
import { describe, expect, it } from "vitest";
import type { AgentAdminAuthorizer, AgentAdminService } from "../agent_admin.js";
import { createOperatorAgentControl } from "./agent_control.js";
import { registerOperatorAgentRoutes } from "./routes.js";

const tenant = "tenant_test";
const character = "character_test";
const skill = "skillversion_test";

function fixture() {
  let revision = 2;
  let assigned = [skill];
  let writeCount = 0;
  let authCount = 0;
  const authority: AgentAdminAuthorizer = {
    async authorize({ authorizationHeader, capability }) {
      authCount++;
      if (authorizationHeader !== "Bearer administrator" ||
          !["agents.presentation.read", "agents.skills.write"].includes(capability)) {
        throw new Error("Denied");
      }
      return { tenantId: tenant as Awaited<ReturnType<AgentAdminAuthorizer["authorize"]>>["tenantId"] };
    },
  };
  const service = {
    async listPresentations() {
      return [{ characterId: character, characterVersionId: "version_test",
        displayName: "Gwana", roleLabel: "Assistant", visibleInUserApp: true, revision: 4 }];
    },
    async listSkills() {
      return [{ skillVersionId: skill, key: "teach", version: "1",
        displayName: "Teaching", description: "", readiness: "ready", advertised: true }];
    },
    async readSkillAssignment() {
      return { schemaVersion: 1, tenantId: tenant, characterId: character,
        skillVersionIds: [...assigned], revision };
    },
    async putSkillAssignment() {
      throw new Error("Unsafe unaudited repository write must never be called");
    },
  } as unknown as AgentAdminService;
  const control = createOperatorAgentControl({ admin: service, authorizer: authority,
    auditedRemoval: {
      async removeAndAudit(input) {
        // Models the mandatory single atomic audit + CAS writer contract.
        if (input.expectedRevision !== revision ||
            input.characterId !== character || input.skillVersionId !== skill) {
          throw new Error("Conflicting transaction");
        }
        writeCount++;
        assigned = [...input.remainingSkillVersionIds];
        revision++;
        return { revision };
      },
    },
    now: () => "2026-10-08T00:00:00Z" });
  return { control, authority, get writeCount() { return writeCount; },
    get authCount() { return authCount; }, get revision() { return revision; },
    get assigned() { return assigned; } };
}

describe("U27 privileged agent controls", () => {
  it("denies consumer snapshots before touching tenant data", async () => {
    const f = fixture();
    await expect(f.control.snapshot({ authorizationHeader: "Bearer consumer" })).rejects.toThrow();
    expect(f.authCount).toBe(1);
  });

  it("projects catalog+version+CAS without pretending skill implies executable tool", async () => {
    const f = fixture();
    const result = await f.control.snapshot({ authorizationHeader: "Bearer administrator" });
    expect(result).toEqual({
      schemaVersion: 1, readAt: "2026-10-08T00:00:00Z",
      agents: [{
        characterId: character, characterVersionId: "version_test", displayName: "Gwana",
        roleLabel: "Assistant", visibleInUserApp: true, presentationRevision: 4,
        assignmentRevision: 2, skillVersionIds: [skill], unknownSkillVersionIds: [],
      }],
      skills: [{ skillVersionId: skill, key: "teach", version: "1",
        displayName: "Teaching", description: "", readiness: "ready", advertised: true }],
    });
  });

  it("removes only the targeted assignment with revision and readback", async () => {
    const f = fixture();
    const result = await f.control.detachSkill({
      authorizationHeader: "Bearer administrator",
      characterId: character, skillVersionId: skill, expectedRevision: 2,
    });
    expect(result).toEqual({ characterId: character, revision: 3, skillVersionIds: [] });
    expect(f.assigned).toEqual([]);
    expect(f.writeCount).toBe(1);
    await expect(f.control.detachSkill({
      authorizationHeader: "Bearer administrator",
      characterId: character, skillVersionId: skill, expectedRevision: 2,
    })).rejects.toThrow("changed");
    expect(f.writeCount).toBe(1);
  });

  it("never adds or blindly re-enables a missing signed skill", async () => {
    const f = fixture();
    await expect(f.control.detachSkill({
      authorizationHeader: "Bearer administrator",
      characterId: character, skillVersionId: "unassigned_skill",
      expectedRevision: 2,
    })).rejects.toThrow("changed");
    expect(f.writeCount).toBe(0);
  });

  it("maps untrusted callers, missing If-Match and CAS collisions without leaking details", async () => {
    const f = fixture();
    const app = Fastify();
    registerOperatorAgentRoutes(app, f.control);
    try {
      const forbidden = await app.inject({
        method: "GET", url: "/v1/admin/operator/agents",
        headers: { authorization: "Bearer consumer" },
      });
      expect(forbidden.statusCode).toBe(403);
      expect(forbidden.json()).toEqual({ code: "AGENT_CONTROL_DENIED" });

      const invalid = await app.inject({
        method: "DELETE", url: "/v1/admin/operator/agents/" + character + "/skills/" + skill,
        headers: { authorization: "Bearer administrator", "if-match": "2" },
      });
      expect(invalid.statusCode).toBe(400);

      const stale = await app.inject({
        method: "DELETE", url: "/v1/admin/operator/agents/" + character + "/skills/" + skill,
        headers: { authorization: "Bearer administrator", "if-match": '"1"' },
      });
      expect(stale.statusCode).toBe(409);
      expect(f.writeCount).toBe(0);

      const good = await app.inject({
        method: "DELETE", url: "/v1/admin/operator/agents/" + character + "/skills/" + skill,
        headers: { authorization: "Bearer administrator", "if-match": '"2"' },
      });
      expect(good.statusCode).toBe(200);
      expect(good.json().revision).toBe(3);
      expect(good.headers["cache-control"]).toBe("no-store");
    } finally {
      await app.close();
    }
  });
});


describe("U27 composition gate", () => {
  it("does not expose privileged routes without explicit controller", async () => {
    const app = createOpsApp();
    try {
      const response = await app.inject({
        method: "GET", url: "/v1/admin/operator/agents",
        headers: { authorization: "Bearer administrator" },
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("uses the protected Ops path when registered, never direct public agent read", async () => {
    const f = fixture();
    const app = createOpsApp({ operatorAgentControl: f.control });
    try {
      const response = await app.inject({
        method: "GET", url: "/v1/admin/operator/agents",
        headers: { authorization: "Bearer administrator" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().agents[0].assignmentRevision).toBe(2);
      expect(response.headers["cache-control"]).toBe("no-store");
    } finally {
      await app.close();
    }
  });
});


describe("U27 mandatory atomic-audit dependency", () => {
  it("rejects all mutations when the runtime has no audited CAS writer", async () => {
    const f = fixture();
    const readonly = createOperatorAgentControl({
      admin: {
        listPresentations: async () => [],
        listSkills: async () => [],
        readSkillAssignment: async () => ({
          schemaVersion: 1, tenantId: tenant, characterId: character,
          skillVersionIds: [skill], revision: 2,
        }),
        putPresentation: async () => { throw new Error("No write"); },
        putSkillAssignment: async () => { throw new Error("Unsafe write"); },
      } as unknown as AgentAdminService,
      authorizer: f.authority,
    });
    await expect(readonly.detachSkill({
      authorizationHeader: "Bearer administrator",
      characterId: character, skillVersionId: skill, expectedRevision: 2,
    })).rejects.toThrow("Audited operator mutation is unavailable");
    const app = createOpsApp({ operatorAgentControl: readonly });
    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/v1/admin/operator/agents/" + character + "/skills/" + skill,
        headers: { authorization: "Bearer administrator", "if-match": '"2"' },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ code: "AGENT_CONTROL_UNAVAILABLE" });
    } finally {
      await app.close();
    }
  });
});
