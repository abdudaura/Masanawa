import type {
  ApprovalId,
  AuthorityContextId,
  Instant,
  RelationshipId,
  TaskId,
  TenantId,
  WorldId,
  WorkflowRunId,
} from "@masanawa/contracts";
import { PlatformError, createCanonicalId, nowInstant } from "@masanawa/contracts";
import type { Principal } from "./principal.js";

export interface AuthorityResourceScope {
  readonly relationshipIds?: readonly RelationshipId[];
  readonly worldIds?: readonly WorldId[];
  readonly taskIds?: readonly TaskId[];
  readonly workflowRunIds?: readonly WorkflowRunId[];
  readonly resourceKeys?: readonly string[];
}

export interface AuthorityContext {
  readonly authorityContextId: AuthorityContextId;
  readonly tenantId: TenantId;
  readonly principal: Principal;
  readonly scopes: readonly string[];
  readonly capabilities: readonly string[];
  readonly resourceScope: AuthorityResourceScope;
  readonly policyRevision: string;
  readonly approvalIds: readonly ApprovalId[];
  readonly delegationChain: readonly AuthorityContextId[];
  readonly issuedAt: Instant;
  readonly expiresAt?: Instant;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface AuthorityContextInput
  extends Omit<AuthorityContext, "authorityContextId" | "issuedAt"> {
  readonly issuedAt?: Instant;
}

export function createAuthorityContext(input: AuthorityContextInput): AuthorityContext {
  return Object.freeze({
    ...input,
    authorityContextId: createCanonicalId("authority-context"),
    issuedAt: input.issuedAt ?? nowInstant(),
    scopes: Object.freeze([...new Set(input.scopes)].sort()),
    capabilities: Object.freeze([...new Set(input.capabilities)].sort()),
    approvalIds: Object.freeze([...input.approvalIds]),
    delegationChain: Object.freeze([...input.delegationChain]),
    resourceScope: Object.freeze({
      ...(input.resourceScope.relationshipIds
        ? { relationshipIds: Object.freeze([...input.resourceScope.relationshipIds]) }
        : {}),
      ...(input.resourceScope.worldIds
        ? { worldIds: Object.freeze([...input.resourceScope.worldIds]) }
        : {}),
      ...(input.resourceScope.taskIds
        ? { taskIds: Object.freeze([...input.resourceScope.taskIds]) }
        : {}),
      ...(input.resourceScope.workflowRunIds
        ? { workflowRunIds: Object.freeze([...input.resourceScope.workflowRunIds]) }
        : {}),
      ...(input.resourceScope.resourceKeys
        ? { resourceKeys: Object.freeze([...input.resourceScope.resourceKeys]) }
        : {}),
    }),
  });
}

export interface CurrentAuthoritySource {
  getPolicyRevision(tenantId: TenantId): string | Promise<string>;
  isRevoked?(context: AuthorityContext): boolean | Promise<boolean>;
}

export async function assertCurrentAuthority(
  context: AuthorityContext,
  source: CurrentAuthoritySource,
  at: Instant = nowInstant(),
): Promise<void> {
  if (context.expiresAt && context.expiresAt <= at) {
    throw new PlatformError({
      code: "authority.expired",
      category: "authorization",
      message: "Authority context has expired",
      retryable: false,
    });
  }

  const revision = await source.getPolicyRevision(context.tenantId);
  if (revision !== context.policyRevision) {
    throw new PlatformError({
      code: "authority.stale_policy",
      category: "authorization",
      message: "Authority was prepared under a stale policy revision",
      retryable: false,
      details: {
        admittedRevision: context.policyRevision,
        currentRevision: revision,
      },
    });
  }

  if (source.isRevoked && (await source.isRevoked(context))) {
    throw new PlatformError({
      code: "authority.revoked",
      category: "authorization",
      message: "Authority has been revoked",
      retryable: false,
    });
  }
}

export function intersectCapabilities(
  parent: readonly string[],
  requested: readonly string[],
): readonly string[] {
  const parentSet = new Set(parent);
  return Object.freeze([...new Set(requested.filter((item) => parentSet.has(item)))].sort());
}
