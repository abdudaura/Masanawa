import type {
  AgentPresentationRepository,
} from "@masanawa/agents";
import type { CharacterId, TenantId } from "@masanawa/contracts";

export interface AgentDirectoryAuthority {
  readonly tenantId: TenantId;
  readonly characterIds?: readonly CharacterId[];
}

export interface AgentDirectoryAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "agents.directory.read";
  }): Promise<AgentDirectoryAuthority>;
}

export interface MobileAgentDirectoryEntry {
  readonly characterId: string;
  readonly characterVersionId: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly about: string;
  readonly greeting: string | null;
  readonly presence: "available";
  readonly activeWorkCount: 0;
}

export interface AgentDirectoryService {
  list(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly MobileAgentDirectoryEntry[]>;
}

/**
 * Authorized projection only. It never exposes Character Skill assignments:
 * runtime eligibility/authority stays server-side.
 *
 * Presence/work facts are intentionally conservative placeholders until the
 * canonical Presence/AgentRun projections can supply them.
 */
export function createAgentDirectoryService(input: {
  readonly presentations: AgentPresentationRepository;
  readonly authorizer: AgentDirectoryAuthorizer;
}): AgentDirectoryService {
  return Object.freeze({
    async list(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.directory.read",
      });
      const presentations = await input.presentations.listVisible({
        tenantId: authority.tenantId,
      });
      const allowed = authority.characterIds
        ? new Set(authority.characterIds)
        : null;
      return Object.freeze(
        presentations
          .filter((presentation) =>
            allowed === null || allowed.has(presentation.characterId),
          )
          .map((presentation) =>
          Object.freeze({
            characterId: presentation.characterId,
            characterVersionId: presentation.characterVersionId,
            displayName: presentation.displayName,
            roleLabel: presentation.roleLabel,
            about: presentation.about,
            greeting: presentation.greeting,
            presence: "available" as const,
            activeWorkCount: 0 as const,
          }),
        ),
      );
    },
  });
}
