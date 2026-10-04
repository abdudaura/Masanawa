import {
  createCanonicalId,
  parseCanonicalId,
  type CharacterId,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import type {
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import { createAuthorityContext } from "@masanawa/security";
import type {
  AgentConversationAdmission,
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import type { AgentDirectoryAuthorizer } from "./agent_directory.js";
import type { CreatorCloneAuthorizer } from "./creator_clone.js";
import type { CommerceUserAuthorizer } from "./commerce_catalog.js";

export interface ProductionIdentityResolver {
  resolveOrCreateUser(input: {
    readonly tenantId: TenantId;
    readonly externalUserId: string;
  }): Promise<UserId>;
  relationshipFor(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterId: CharacterId;
  }): Promise<RelationshipId>;
  listCharacterIdsForUser(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
  }): Promise<readonly CharacterId[]>;
}

export interface PlatformSessionVerifier {
  verify(authorizationHeader: string | undefined): Promise<{ readonly externalUserId: string }>;
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new TypeError("Platform auth base URL must be an HTTPS origin");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new TypeError("Platform auth base URL must not contain a path");
  }
  return url.origin;
}

function requireBearer(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    throw new Error("Platform session authorization denied");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token || token.length > 8192 || /\s/u.test(token)) {
    throw new Error("Platform session authorization denied");
  }
  return token;
}

export function createPlatformSessionVerifier(input: {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
}): PlatformSessionVerifier {
  const baseUrl = normalizeOrigin(input.baseUrl);
  const fetchImpl = input.fetchImpl ?? fetch;
  return Object.freeze({
    async verify(authorizationHeader) {
      const token = requireBearer(authorizationHeader);
      const response = await fetchImpl(`${baseUrl}/auth/me`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error("Platform session authorization denied");
      }
      const body = await response.json() as Record<string, unknown>;
      const id = body.id;
      if (typeof id !== "string" || !id.trim() || id.length > 512) {
        throw new Error("Platform session authorization denied");
      }
      return Object.freeze({ externalUserId: id.trim() });
    },
  });
}

export function createProductionAuthorizers(input: {
  readonly verifier: PlatformSessionVerifier;
  readonly identities: ProductionIdentityResolver;
  readonly tenantId: TenantId;
  readonly policyRevision: string;
  readonly presentations: AgentPresentationRepository;
  readonly skillAssignments: CharacterSkillAssignmentRepository;
  readonly platformProfiles: PlatformAgentProfileRepository;
}): {
  readonly directory: AgentDirectoryAuthorizer;
  readonly conversation: AgentConversationAuthorizer;
  readonly creator: CreatorCloneAuthorizer;
  readonly commerce: CommerceUserAuthorizer;
} {
  const policyRevision = input.policyRevision.trim();
  if (!policyRevision) throw new TypeError("Production auth policy revision is required");

  const authorizeUser = async (authorizationHeader: string | undefined) => {
    const verified = await input.verifier.verify(authorizationHeader);
    const userId = await input.identities.resolveOrCreateUser({
      tenantId: input.tenantId,
      externalUserId: verified.externalUserId,
    });
    return Object.freeze({ tenantId: input.tenantId, userId });
  };

  const directory: AgentDirectoryAuthorizer = Object.freeze({
    async authorize(request) {
      const user = await authorizeUser(request.authorizationHeader);
      const [related, support] = await Promise.all([
        input.identities.listCharacterIdsForUser({
          tenantId: user.tenantId,
          userId: user.userId,
        }),
        input.platformProfiles.listSupportAgents({ tenantId: user.tenantId }),
      ]);
      return Object.freeze({
        ...user,
        characterIds: Object.freeze([
          ...new Set([
            ...related,
            ...support.map((profile) => profile.characterId),
          ]),
        ]),
      });
    },
  });

  const creator: CreatorCloneAuthorizer = Object.freeze({
    async authorize(request) {
      return authorizeUser(request.authorizationHeader);
    },
  });

  const commerce: CommerceUserAuthorizer = Object.freeze({
    async authorize(request) {
      return authorizeUser(request.authorizationHeader);
    },
  });

  const conversation: AgentConversationAuthorizer = Object.freeze({
    async authorize(request): Promise<AgentConversationAdmission> {
      const user = await authorizeUser(request.authorizationHeader);
      const characterId = parseCanonicalId("character", request.characterId);
      const presentation = await input.presentations.readForCharacter({
        tenantId: user.tenantId,
        characterId,
      });
      if (!presentation || !presentation.visibleInUserApp) {
        throw new Error("Character is not available to this user");
      }
      const existingCharacterIds =
        await input.identities.listCharacterIdsForUser({
          tenantId: user.tenantId,
          userId: user.userId,
        });
      const alreadyRelated = existingCharacterIds.includes(characterId);
      const profile = await input.platformProfiles.readForCharacter({
        tenantId: user.tenantId,
        characterId,
      });
      if (!alreadyRelated && profile?.supportAgent !== true) {
        throw new Error("Character is not available to this user");
      }
      const relationshipId = await input.identities.relationshipFor({
        tenantId: user.tenantId,
        userId: user.userId,
        characterId,
      });
      const assignment = await input.skillAssignments.readForCharacter({
        tenantId: user.tenantId,
        characterId,
      });
      const requestId = createCanonicalId("request");
      const correlationId = createCanonicalId("correlation");
      return Object.freeze({
        scope: Object.freeze({
          tenantId: user.tenantId,
          userId: user.userId,
          characterId,
          relationshipId,
        }),
        characterVersionId: presentation.characterVersionId,
        bindings: Object.freeze({
          channelSessionId: null,
          presenceSessionId: null,
          skillVersionIds: Object.freeze([...(assignment?.skillVersionIds ?? [])]),
          taskIds: Object.freeze([]),
          workflowRunIds: Object.freeze([]),
        }),
        presentation: Object.freeze({
          displayName: presentation.displayName,
          roleLabel: presentation.roleLabel,
          about: presentation.about,
        }),
        authority: createAuthorityContext({
          tenantId: user.tenantId,
          principal: Object.freeze({ kind: "user" as const, userId: user.userId }),
          scopes: Object.freeze(["mobile.app"]),
          capabilities: Object.freeze([
            "agents.session.create",
            "agents.session.read",
            "agents.session.close",
            "agents.run.create",
            "agents.run.read",
            "agents.run.finish",
          ]),
          resourceScope: Object.freeze({ relationshipIds: Object.freeze([relationshipId]) }),
          policyRevision,
          approvalIds: Object.freeze([]),
          delegationChain: Object.freeze([]),
          requestId,
          correlationId,
        }),
      });
    },
  });

  return Object.freeze({ directory, conversation, creator, commerce });
}
