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
} from "@masanawa/agents";
import { createAuthorityContext } from "@masanawa/security";
import type { UserRelationshipReader } from "@masanawa/identity";
import type {
  AgentConversationAdmission,
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import type { AgentDirectoryAuthorizer } from "./agent_directory.js";
import type { CreatorCloneAuthorizer } from "./creator_clone.js";
import type { CommerceUserAuthorizer } from "./commerce_catalog.js";

export interface AlphaDevAuthorizerConfig {
  readonly token: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly policyRevision: string;
  readonly relationshipIds: Readonly<Record<string, RelationshipId>>;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function createAlphaDevAuthorizer(input: {
  readonly config: AlphaDevAuthorizerConfig;
  readonly presentations: AgentPresentationRepository;
  readonly skillAssignments: CharacterSkillAssignmentRepository;
  readonly relationships?: UserRelationshipReader;
}): AgentConversationAuthorizer {
  const expectedToken = input.config.token.trim();
  if (expectedToken.length < 24) {
    throw new TypeError("Alpha development token must be at least 24 characters");
  }
  const policyRevision = input.config.policyRevision.trim();
  if (!policyRevision) {
    throw new TypeError("Alpha policy revision is required");
  }

  return Object.freeze({
    async authorize(
      request: Parameters<AgentConversationAuthorizer["authorize"]>[0],
    ): Promise<AgentConversationAdmission> {
      if (bearerToken(request.authorizationHeader) !== expectedToken) {
        throw new Error("Alpha development authorization denied");
      }

      const characterId = parseCanonicalId("character", request.characterId);
      const dynamicRelationship = await input.relationships?.readForUserCharacter({
        tenantId: input.config.tenantId,
        userId: input.config.userId,
        characterId,
      });
      const relationshipId =
        dynamicRelationship?.relationshipId ??
        input.config.relationshipIds[characterId];
      if (!relationshipId) {
        throw new Error("Character is not admitted to this Alpha user");
      }

      const presentation = await input.presentations.readForCharacter({
        tenantId: input.config.tenantId,
        characterId,
      });
      if (!presentation || !presentation.visibleInUserApp) {
        throw new Error("Character is not visible in this Alpha app");
      }

      const assignment = await input.skillAssignments.readForCharacter({
        tenantId: input.config.tenantId,
        characterId,
      });
      const requestId = createCanonicalId("request");
      const correlationId = createCanonicalId("correlation");

      return Object.freeze({
        scope: Object.freeze({
          tenantId: input.config.tenantId,
          userId: input.config.userId,
          characterId,
          relationshipId,
        }),
        characterVersionId: presentation.characterVersionId,
        bindings: Object.freeze({
          channelSessionId: null,
          presenceSessionId: null,
          skillVersionIds: Object.freeze([
            ...(assignment?.skillVersionIds ?? []),
          ]),
          taskIds: Object.freeze([]),
          workflowRunIds: Object.freeze([]),
        }),
        presentation: Object.freeze({
          displayName: presentation.displayName,
          roleLabel: presentation.roleLabel,
          about: presentation.about,
        }),
        authority: createAuthorityContext({
          tenantId: input.config.tenantId,
          principal: Object.freeze({
            kind: "user" as const,
            userId: input.config.userId,
          }),
          scopes: Object.freeze(["alpha.mobile"]),
          capabilities: Object.freeze([
            "agents.session.create",
            "agents.session.read",
            "agents.session.close",
            "agents.run.create",
            "agents.run.read",
            "agents.run.finish",
          ]),
          resourceScope: Object.freeze({
            relationshipIds: Object.freeze([relationshipId]),
          }),
          policyRevision,
          approvalIds: Object.freeze([]),
          delegationChain: Object.freeze([]),
          requestId,
          correlationId,
        }),
      });
    },
  });
}

export function parseAlphaRelationshipMap(
  value: string,
): Readonly<Record<string, RelationshipId>> {
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Alpha relationship map must be an object");
  }
  const result: Record<string, RelationshipId> = {};
  for (const [character, relationship] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    const characterId = parseCanonicalId("character", character);
    if (typeof relationship !== "string") {
      throw new TypeError("Alpha relationship map value must be a string");
    }
    result[characterId] = parseCanonicalId("relationship", relationship);
  }
  return Object.freeze(result);
}

export function parseAlphaDevIds(input: {
  readonly tenantId: string;
  readonly userId: string;
}): { readonly tenantId: TenantId; readonly userId: UserId } {
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
  });
}


export function createAlphaDirectoryAuthorizer(input: {
  readonly token: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly relationshipIds: Readonly<Record<string, RelationshipId>>;
  readonly relationships?: UserRelationshipReader;
}): AgentDirectoryAuthorizer {
  const expectedToken = input.token.trim();
  if (expectedToken.length < 24) {
    throw new TypeError("Alpha development token must be at least 24 characters");
  }
  return Object.freeze({
    async authorize(
      request: Parameters<AgentDirectoryAuthorizer["authorize"]>[0],
    ) {
      if (bearerToken(request.authorizationHeader) !== expectedToken) {
        throw new Error("Alpha development authorization denied");
      }
      const dynamic =
        (await input.relationships?.listForUser({
          tenantId: input.tenantId,
          userId: input.userId,
        })) ?? [];
      const characterIds = new Set<CharacterId>(
        Object.keys(input.relationshipIds).map((id) =>
          parseCanonicalId("character", id),
        ),
      );
      for (const relationship of dynamic) {
        characterIds.add(relationship.characterId);
      }
      return Object.freeze({
        tenantId: input.tenantId,
        userId: input.userId,
        characterIds: Object.freeze([...characterIds]),
      });
    },
  });
}


export function createAlphaCreatorAuthorizer(input: {
  readonly token: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
}): CreatorCloneAuthorizer {
  const expectedToken = input.token.trim();
  if (expectedToken.length < 24) {
    throw new TypeError("Alpha development token must be at least 24 characters");
  }
  return Object.freeze({
    async authorize(request) {
      if (bearerToken(request.authorizationHeader) !== expectedToken) {
        throw new Error("Alpha development authorization denied");
      }
      return Object.freeze({
        tenantId: input.tenantId,
        userId: input.userId,
      });
    },
  });
}


export function createAlphaCommerceAuthorizer(input: {
  readonly token: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
}): CommerceUserAuthorizer {
  const expectedToken = input.token.trim();
  if (expectedToken.length < 24) {
    throw new TypeError("Alpha development token must be at least 24 characters");
  }
  return Object.freeze({
    async authorize(request) {
      if (bearerToken(request.authorizationHeader) !== expectedToken) {
        throw new Error("Alpha development authorization denied");
      }
      return Object.freeze({
        tenantId: input.tenantId,
        userId: input.userId,
      });
    },
  });
}
