import type { AgentAdminAuthorizer, AgentAdminService, AgentAdminSkillOption } from "../agent_admin.js";

/**
 * U27 protected projection. It deliberately does not infer a capability from a
 * model prompt, a skill name or an "advertised" flag. Skill assignments are
 * configuration, not proof a tool can execute.
 */
export interface OperatorAgentRow {
  readonly characterId: string;
  readonly characterVersionId: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly visibleInUserApp: boolean;
  readonly presentationRevision: number;
  readonly assignmentRevision: number | null;
  readonly skillVersionIds: readonly string[];
  readonly unknownSkillVersionIds: readonly string[];
}

export interface OperatorAgentSnapshot {
  readonly schemaVersion: 1;
  readonly agents: readonly OperatorAgentRow[];
  readonly skills: readonly AgentAdminSkillOption[];
  readonly readAt: string;
}

export class OperatorRevisionConflict extends Error {
  constructor() {
    super("Agent assignment changed. Reload before trying again.");
    this.name = "OperatorRevisionConflict";
  }
}

export class OperatorReadbackFailure extends Error {
  constructor() {
    super("The write could not be confirmed by authoritative readback.");
    this.name = "OperatorReadbackFailure";
  }
}

export interface OperatorAgentControl {
  snapshot(input: { authorizationHeader: string | undefined }): Promise<OperatorAgentSnapshot>;
  detachSkill(input: {
    authorizationHeader: string | undefined;
    characterId: string;
    skillVersionId: string;
    expectedRevision: number;
  }): Promise<{ characterId: string; revision: number; skillVersionIds: readonly string[] }>;
}

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,179}$/;

function requiredId(value: string): string {
  if (typeof value !== "string" || !idPattern.test(value)) {
    throw new TypeError("Invalid agent or skill identifier");
  }
  return value;
}

/**
 * Uses existing tenant-scoped AgentAdminService for every DB read and write.
 * The separately injected authorization gate is required, not optional.
 * Only a monotonic *removal* is allowed: this module cannot activate tools,
 * publish a version, grant a new skill, move Credits or change wallet state.
 * Serializes concurrent actions through the existing expectedRevision CAS.
 *
 * A full activation/publish API must use an audited atomic operation and a
 * separate approval authority; it must not be implemented as a "toggle" here.
 */
export function createOperatorAgentControl(input: {
  readonly admin: AgentAdminService;
  readonly authorizer: AgentAdminAuthorizer;
  readonly now?: () => string;
}): OperatorAgentControl {
  const now = input.now ?? (() => new Date().toISOString());

  return Object.freeze({
    async snapshot(request): Promise<OperatorAgentSnapshot> {
      await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.presentation.read",
      });
      // Authorization precedes all reads, preventing partial tenant metadata
      // leakage when an operator's grant has been revoked.
      const [presentations, skills] = await Promise.all([
        input.admin.listPresentations(request),
        input.admin.listSkills(request),
      ]);
      if (presentations.length > 200) {
        throw new RangeError("Agent projection exceeds the bounded admin page");
      }
      const known = new Set(skills.map((item) => item.skillVersionId));
      const agents = await Promise.all(presentations.map(async (presentation) => {
        const assignment = await input.admin.readSkillAssignment({
          ...request, characterId: presentation.characterId,
        });
        const ids = [...(assignment?.skillVersionIds ?? [])];
        return Object.freeze({
          characterId: presentation.characterId,
          characterVersionId: presentation.characterVersionId,
          displayName: presentation.displayName,
          roleLabel: presentation.roleLabel,
          visibleInUserApp: presentation.visibleInUserApp,
          presentationRevision: presentation.revision,
          assignmentRevision: assignment?.revision ?? null,
          skillVersionIds: Object.freeze(ids),
          unknownSkillVersionIds: Object.freeze(ids.filter((id) => !known.has(id))),
        });
      }));
      return Object.freeze({
        schemaVersion: 1 as const,
        agents: Object.freeze(agents.sort((a, b) => a.displayName.localeCompare(b.displayName))),
        skills: Object.freeze([...skills]),
        readAt: now(),
      });
    },

    async detachSkill(request) {
      requiredId(request.characterId);
      requiredId(request.skillVersionId);
      if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1) {
        throw new TypeError("Expected revision required");
      }
      // Explicit privileged capability check even when the injected admin
      // implementation is substituted; the normal service authorizes again.
      await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.skills.write",
      });
      const current = await input.admin.readSkillAssignment({
        authorizationHeader: request.authorizationHeader,
        characterId: request.characterId as Parameters<AgentAdminService["readSkillAssignment"]>[0]["characterId"],
      });
      if (!current || current.revision !== request.expectedRevision) {
        throw new OperatorRevisionConflict();
      }
      if (!current.skillVersionIds.includes(request.skillVersionId as typeof current.skillVersionIds[number])) {
        throw new OperatorRevisionConflict();
      }
      const remaining = current.skillVersionIds.filter((id) => id !== request.skillVersionId);
      // Do not rewrite the assignment on an already-removed/no-op mutation.
      const result = await input.admin.putSkillAssignment({
        authorizationHeader: request.authorizationHeader,
        expectedRevision: current.revision,
        assignment: {
          schemaVersion: 1,
          characterId: current.characterId,
          skillVersionIds: remaining,
          revision: current.revision,
        },
      });
      const confirmed = await input.admin.readSkillAssignment({
        authorizationHeader: request.authorizationHeader,
        characterId: current.characterId,
      });
      if (!confirmed || confirmed.revision !== result.revision ||
          confirmed.skillVersionIds.includes(request.skillVersionId as typeof current.skillVersionIds[number])) {
        throw new OperatorReadbackFailure();
      }
      return Object.freeze({
        characterId: current.characterId,
        revision: confirmed.revision,
        skillVersionIds: Object.freeze([...confirmed.skillVersionIds]),
      });
    },
  });
}
