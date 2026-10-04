import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignment,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import { nowInstant, type CharacterId, type TenantId } from "@masanawa/contracts";
import type { CharacterVersionReferenceReader } from "@masanawa/identity";
import type { SkillRepository } from "@masanawa/skills";

export type AgentAdminCapability =
  | "agents.presentation.read"
  | "agents.presentation.write"
  | "agents.skills.read"
  | "agents.skills.write"
  | "skills.catalog.read"
  | "skills.catalog.write"
  | "platform.summary.read"
  | "identity.users.read"
  | "identity.users.write"
  | "agents.runs.read"
  | "commerce.read"
  | "operations.read"
  | "reconciliation.read"
  | "providers.credentials.read"
  | "audit.read"
  | "memory.admin.read"
  | "world.admin.read"
  | "approvals.admin.read"
  | "queues.admin.read";

export interface AgentAdminAuthority {
  readonly tenantId: TenantId;
}

export interface AgentAdminAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: AgentAdminCapability;
  }): Promise<AgentAdminAuthority>;
}

export interface AgentAdminSkillOption {
  readonly skillVersionId: string;
  readonly key: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string;
  readonly readiness: "ready" | "degraded" | "blocked" | "disabled" | "unknown";
  readonly advertised: boolean;
  readonly reasonCode: string | null;
  readonly checkedAt: string | null;
  readonly revision: number | null;
}

export interface AgentAdminService {
  listPresentations(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly AgentPresentation[]>;

  listSkills(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly AgentAdminSkillOption[]>;

  readSkillAssignment(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: CharacterId;
  }): Promise<CharacterSkillAssignment | null>;

  putSkillReadiness(input: {
    readonly authorizationHeader: string | undefined;
    readonly skillVersionId: string;
    readonly state: "ready" | "degraded" | "blocked" | "disabled";
    readonly advertised: boolean;
    readonly reasonCode: string | null;
    readonly expectedRevision: number | null;
  }): Promise<AgentAdminSkillOption>;

  putPresentation(input: {
    readonly authorizationHeader: string | undefined;
    readonly expectedRevision: number | null;
    readonly presentation: Omit<AgentPresentation, "tenantId">;
  }): Promise<AgentPresentation>;

  putSkillAssignment(input: {
    readonly authorizationHeader: string | undefined;
    readonly expectedRevision: number | null;
    readonly assignment: Omit<CharacterSkillAssignment, "tenantId">;
  }): Promise<CharacterSkillAssignment>;
}

/**
 * Ops-facing use-case layer. Authentication/current-authority validation is
 * deliberately injected: if the runtime cannot validate an operator, callers
 * must not construct this service.
 */
export function createAgentAdminService(input: {
  readonly presentations: AgentPresentationRepository;
  readonly skillAssignments: CharacterSkillAssignmentRepository;
  readonly characterVersions: CharacterVersionReferenceReader;
  readonly skills: SkillRepository;
  readonly authorizer: AgentAdminAuthorizer;
}): AgentAdminService {
  return Object.freeze<AgentAdminService>({
    async listPresentations(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.presentation.read",
      });
      return input.presentations.listAll({ tenantId: authority.tenantId });
    },

    async listSkills(request) {
      await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "skills.catalog.read",
      });
      const snapshot = await input.skills.readSnapshot();
      const readiness = new Map(
        snapshot.readiness.map((record) => [
          record.readiness.skillVersionId,
          record.readiness,
        ]),
      );
      return Object.freeze(
        snapshot.versions.map((version) => {
          const status = readiness.get(version.skillVersionId);
          const record = snapshot.readiness.find(
            (candidate) =>
              candidate.readiness.skillVersionId === version.skillVersionId,
          );
          return Object.freeze({
            skillVersionId: version.skillVersionId,
            key: version.key,
            version: version.version,
            displayName: version.displayName,
            description: version.description,
            readiness: status?.state ?? "unknown",
            advertised: status?.advertised ?? false,
            reasonCode: status?.reasonCode ?? null,
            checkedAt: status?.checkedAt ?? null,
            revision: record?.revision ?? null,
          });
        }),
      );
    },

    async putSkillReadiness(request) {
      await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "skills.catalog.write",
      });
      const snapshot = await input.skills.readSnapshot();
      const version = snapshot.versions.find(
        (candidate) => candidate.skillVersionId === request.skillVersionId,
      );
      if (!version) {
        throw new TypeError("SkillVersion is unavailable");
      }
      const record = await input.skills.putReadiness({
        expectedRevision: request.expectedRevision,
        readiness: {
          skillVersionId: version.skillVersionId,
          state: request.state,
          advertised: request.advertised,
          reasonCode: request.reasonCode,
          checkedAt: nowInstant(),
        },
      });
      return Object.freeze({
        skillVersionId: version.skillVersionId,
        key: version.key,
        version: version.version,
        displayName: version.displayName,
        description: version.description,
        readiness: record.readiness.state,
        advertised: record.readiness.advertised,
        reasonCode: record.readiness.reasonCode,
        checkedAt: record.readiness.checkedAt,
        revision: record.revision,
      });
    },

    async readSkillAssignment(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.skills.read",
      });
      return input.skillAssignments.readForCharacter({
        tenantId: authority.tenantId,
        characterId: request.characterId,
      });
    },

    async putPresentation(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.presentation.write",
      });
      await input.characterVersions.assertCharacterVersion({
        tenantId: authority.tenantId,
        characterId: request.presentation.characterId,
        characterVersionId: request.presentation.characterVersionId,
      });
      return input.presentations.put({
        expectedRevision: request.expectedRevision,
        presentation: {
          ...request.presentation,
          tenantId: authority.tenantId,
        },
      });
    },

    async putSkillAssignment(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.skills.write",
      });
      const presentation = await input.presentations.readForCharacter({
        tenantId: authority.tenantId,
        characterId: request.assignment.characterId,
      });
      if (presentation === null) {
        throw new TypeError("Character must be configured before Skills can be assigned");
      }
      const snapshot = await input.skills.readSnapshot();
      const available = new Set(
        snapshot.versions.map((version) => version.skillVersionId),
      );
      const missing = request.assignment.skillVersionIds.filter(
        (skillVersionId) => !available.has(skillVersionId),
      );
      if (missing.length > 0) {
        throw new TypeError("Character Skill assignment contains an unavailable SkillVersion");
      }
      return input.skillAssignments.put({
        expectedRevision: request.expectedRevision,
        assignment: {
          ...request.assignment,
          tenantId: authority.tenantId,
        },
      });
    },
  });
}
