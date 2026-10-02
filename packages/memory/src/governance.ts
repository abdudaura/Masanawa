import type {
  ApprovalId,
  MemoryRecordId,
  MemoryRevisionId,
  OperationId,
  TenantId,
} from "@masanawa/contracts";
import { PlatformError } from "@masanawa/contracts";
import {
  createApprovalBinding,
  fingerprintCanonicalJson,
  principalKey,
  type ApprovalBinding,
  type AuthorityContext,
} from "@masanawa/security";
import {
  memoryScopeKey,
  type MemoryRevisionContentInput,
} from "./invariants.js";
import type { MemoryScope, MemoryType } from "./model.js";

export const memoryScopePublishCapability = "memory.scope.publish";
export const memoryScopePublishActionVersion = "1";
export const memoryScopePublishRiskClass = "consequential";

export type MemoryScopePublicationRevisionInput =
  Omit<MemoryRevisionContentInput, "evidence">;

export interface MemoryScopePublicationTarget {
  readonly tenantId: TenantId;
  readonly sourceMemoryRecordId: MemoryRecordId;
  readonly sourceMemoryRevisionId: MemoryRevisionId;
  readonly sourceScope: MemoryScope;
  readonly targetMemoryRecordId: MemoryRecordId;
  readonly targetMemoryRevisionId: MemoryRevisionId;
  readonly targetMemoryType: MemoryType;
  readonly targetScope: MemoryScope;
  readonly targetRevision: MemoryScopePublicationRevisionInput;
  readonly reason: string;
}

export interface CreateMemoryScopePublicationApprovalBindingInput
  extends MemoryScopePublicationTarget {
  readonly operationId: OperationId;
  readonly authority: AuthorityContext;
}

function requiredResource(
  authority: AuthorityContext,
  resource: string,
  errorCode: string,
): void {
  if (!authority.resourceScope.resourceKeys?.includes(resource)) {
    throw new PlatformError({
      code: errorCode,
      category: "authorization",
      message: `Authority is not explicitly scoped to ${resource}`,
      retryable: false,
    });
  }
}

export function assertMemoryScopeAuthority(
  authority: AuthorityContext,
  tenantId: TenantId,
  scope: MemoryScope,
  errorCode = "memory.scope_authority_mismatch",
): void {
  if (authority.tenantId !== tenantId) {
    throw new PlatformError({
      code: "memory.scope_tenant_mismatch",
      category: "authorization",
      message: "Authority belongs to a different tenant",
      retryable: false,
    });
  }

  switch (scope.kind) {
    case "organization":
      requiredResource(
        authority,
        `organization:${tenantId}`,
        errorCode,
      );
      return;
    case "relationship":
      if (!authority.resourceScope.relationshipIds?.includes(scope.relationshipId)) {
        throw new PlatformError({
          code: errorCode,
          category: "authorization",
          message: "Authority is not explicitly scoped to the Relationship",
          retryable: false,
        });
      }
      return;
    case "character-private":
    case "character-shared":
      requiredResource(
        authority,
        `character:${scope.characterId}`,
        errorCode,
      );
      return;
    case "world":
      if (!authority.resourceScope.worldIds?.includes(scope.worldId)) {
        throw new PlatformError({
          code: errorCode,
          category: "authorization",
          message: "Authority is not explicitly scoped to the World",
          retryable: false,
        });
      }
      return;
    case "session":
      requiredResource(
        authority,
        `character-session:${scope.characterSessionId}`,
        errorCode,
      );
      return;
    case "task":
      if (!authority.resourceScope.taskIds?.includes(scope.taskId)) {
        throw new PlatformError({
          code: errorCode,
          category: "authorization",
          message: "Authority is not explicitly scoped to the Task",
          retryable: false,
        });
      }
      return;
  }
}

function assertSourceScopeAuthority(
  authority: AuthorityContext,
  tenantId: TenantId,
  scope: MemoryScope,
): void {
  switch (scope.kind) {
    case "relationship":
    case "character-private":
    case "session":
    case "task":
      assertMemoryScopeAuthority(
        authority,
        tenantId,
        scope,
        "memory.publication_source_scope_mismatch",
      );
      return;
    case "organization":
    case "character-shared":
    case "world":
      throw new PlatformError({
        code: "memory.publication_source_not_private",
        category: "conflict",
        message: "Scope publication requires a private or bounded source scope",
        retryable: false,
      });
  }
}

function assertTargetScopeAuthority(
  authority: AuthorityContext,
  tenantId: TenantId,
  scope: MemoryScope,
): void {
  switch (scope.kind) {
    case "character-shared":
    case "world":
    case "organization":
      assertMemoryScopeAuthority(
        authority,
        tenantId,
        scope,
        "memory.publication_target_scope_mismatch",
      );
      return;
    case "relationship":
    case "character-private":
    case "session":
    case "task":
      throw new PlatformError({
        code: "memory.publication_target_not_shared",
        category: "conflict",
        message: "Publication target must be Character-shared, World, or Organization scope",
        retryable: false,
      });
  }
}

function boundedReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 1 || normalized.length > 2000) {
    throw new TypeError("publication reason is invalid");
  }
  return normalized;
}

function assertTargetRevisionHasNoCallerEvidence(
  targetRevision: MemoryScopePublicationRevisionInput,
): void {
  if ("evidence" in (targetRevision as Record<string, unknown>)) {
    throw new PlatformError({
      code: "memory.publication_target_evidence_forbidden",
      category: "authorization",
      message:
        "Cross-scope publication target evidence is generated from the governed publication operation",
      retryable: false,
    });
  }
}

export function assertMemoryScopePublicationAuthority(
  authority: AuthorityContext,
  target: MemoryScopePublicationTarget,
  approvalId?: ApprovalId,
): void {
  if (authority.tenantId !== target.tenantId) {
    throw new PlatformError({
      code: "memory.publication_tenant_mismatch",
      category: "authorization",
      message: "Authority belongs to a different tenant",
      retryable: false,
    });
  }
  if (!authority.capabilities.includes(memoryScopePublishCapability)) {
    throw new PlatformError({
      code: "memory.publication_capability_missing",
      category: "authorization",
      message: `Authority lacks required capability ${memoryScopePublishCapability}`,
      retryable: false,
    });
  }
  if (target.sourceMemoryRecordId === target.targetMemoryRecordId) {
    throw new PlatformError({
      code: "memory.publication_record_reuse_forbidden",
      category: "conflict",
      message: "Scope publication must create a distinct target MemoryRecord",
      retryable: false,
    });
  }
  boundedReason(target.reason);
  assertTargetRevisionHasNoCallerEvidence(target.targetRevision);
  assertSourceScopeAuthority(authority, target.tenantId, target.sourceScope);
  assertTargetScopeAuthority(authority, target.tenantId, target.targetScope);

  if (approvalId && !authority.approvalIds.includes(approvalId)) {
    throw new PlatformError({
      code: "memory.publication_approval_not_admitted",
      category: "authorization",
      message: "Authority does not admit the supplied approval",
      retryable: false,
    });
  }
}

export function memoryScopePublicationRequestFingerprint(
  target: MemoryScopePublicationTarget,
): string {
  return fingerprintCanonicalJson({
    tenantId: target.tenantId,
    sourceMemoryRecordId: target.sourceMemoryRecordId,
    sourceMemoryRevisionId: target.sourceMemoryRevisionId,
    sourceScope: memoryScopeKey(target.sourceScope),
    targetMemoryRecordId: target.targetMemoryRecordId,
    targetMemoryRevisionId: target.targetMemoryRevisionId,
    targetMemoryType: target.targetMemoryType,
    targetScope: memoryScopeKey(target.targetScope),
    targetRevision: target.targetRevision,
    reason: boundedReason(target.reason),
  });
}

export function memoryScopePublicationAuthorityScopeHash(
  authority: AuthorityContext,
  target: MemoryScopePublicationTarget,
): string {
  return fingerprintCanonicalJson({
    tenantId: target.tenantId,
    principalKey: principalKey(authority.principal),
    capability: memoryScopePublishCapability,
    sourceScope: memoryScopeKey(target.sourceScope),
    targetScope: memoryScopeKey(target.targetScope),
    policyRevision: authority.policyRevision,
  });
}

export function memoryScopePublicationResourceKey(
  target: MemoryScopePublicationTarget,
): string {
  return `memory:${target.sourceMemoryRecordId}:publish:${memoryScopeKey(target.targetScope)}`;
}

export function createMemoryScopePublicationApprovalBinding(
  input: CreateMemoryScopePublicationApprovalBindingInput,
): ApprovalBinding {
  assertMemoryScopePublicationAuthority(input.authority, input);
  return createApprovalBinding({
    operationId: input.operationId,
    tenantId: input.tenantId,
    principal: input.authority.principal,
    action: memoryScopePublishCapability,
    actionVersion: memoryScopePublishActionVersion,
    resourceKey: memoryScopePublicationResourceKey(input),
    arguments: {
      requestFingerprint: memoryScopePublicationRequestFingerprint(input),
    },
    riskClass: memoryScopePublishRiskClass,
  });
}
