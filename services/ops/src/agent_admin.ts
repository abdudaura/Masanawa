import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignment,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import type { CharacterId, TenantId } from "@masanawa/contracts";

export type AgentAdminCapability =
  | "agents.presentation.read"
  | "agents.presentation.write"
  | "agents.skills.read"
  | "agents.skills.write";

export interface AgentAdminAuthority {
  readonly tenantId: TenantId;
}

export interface AgentAdminAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: AgentAdminCapability;
  }): Promise<AgentAdminAuthority>;
}

export interface AgentAdminService {
  listPresentations(input: {
    readonly authorizationHeader?: string;
  }): Promise<readonly AgentPresentation[]>;

  readSkillAssignment(input: {
    readonly authorizationHeader?: string;
    readonly characterId: CharacterId;
  }): Promise<CharacterSkillAssignment | null>;

  putPresentation(input: {
    readonly authorizationHeader?: string;
    readonly expectedRevision: number | null;
    readonly presentation: Omit<AgentPresentation, "tenantId">;
  }): Promise<AgentPresentation>;

  putSkillAssignment(input: {
    readonly authorizationHeader?: string;
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
  readonly authorizer: AgentAdminAuthorizer;
}): AgentAdminService {
  return Object.freeze({
    async listPresentations(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.presentation.read",
      });
      return input.presentations.listAll({ tenantId: authority.tenantId });
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
