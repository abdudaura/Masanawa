import type {
  ApprovalId,
  AuthorityContextId,
  Instant,
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
import { assertMemoryScopeAuthority } from "./governance.js";
import { memoryScopeKey } from "./invariants.js";
import type { MemoryScope } from "./model.js";

export const memoryRecordTombstoneCapability = "memory.record.tombstone";
export const memoryRecordTombstoneActionVersion = "1";
export const memoryRecordTombstoneRiskClass = "consequential";

export interface MemoryRecordTombstoneTarget {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly scope: MemoryScope;
  readonly expectedLifecycleRevision: number;
  readonly reason: string;
}

export interface CreateMemoryRecordTombstoneApprovalBindingInput
  extends MemoryRecordTombstoneTarget {
  readonly operationId: OperationId;
  readonly authority: AuthorityContext;
}

export interface MemoryRecordTombstone {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly operationId: OperationId;
  readonly authorityContextId: AuthorityContextId;
  readonly approvalId: ApprovalId;
  readonly policyRevision: string;
  readonly principalKey: string;
  readonly priorLifecycleRevision: number;
  readonly tombstonedLifecycleRevision: number;
  readonly reason: string;
  readonly tombstonedAt: Instant;
}

export function normalizeMemoryTombstoneReason(reason: string): string {
  if (typeof reason !== "string") {
    throw new TypeError("tombstone reason must be a string");
  }
  const normalized = reason.trim();
  if (normalized.length < 1 || normalized.length > 2000) {
    throw new TypeError("tombstone reason is invalid");
  }
  return normalized;
}

export function assertMemoryRecordTombstoneAuthority(
  authority: AuthorityContext,
  target: MemoryRecordTombstoneTarget,
  approvalId?: ApprovalId,
): void {
  if (authority.tenantId !== target.tenantId) {
    throw new PlatformError({
      code: "memory.tombstone_tenant_mismatch",
      category: "authorization",
      message: "Authority belongs to a different tenant",
      retryable: false,
    });
  }
  if (!authority.capabilities.includes(memoryRecordTombstoneCapability)) {
    throw new PlatformError({
      code: "memory.tombstone_capability_missing",
      category: "authorization",
      message:
        `Authority lacks required capability ${memoryRecordTombstoneCapability}`,
      retryable: false,
    });
  }
  if (
    !Number.isSafeInteger(target.expectedLifecycleRevision) ||
    target.expectedLifecycleRevision < 1
  ) {
    throw new RangeError(
      "expectedLifecycleRevision must be a positive safe integer",
    );
  }

  normalizeMemoryTombstoneReason(target.reason);
  assertMemoryScopeAuthority(
    authority,
    target.tenantId,
    target.scope,
    "memory.tombstone_scope_mismatch",
  );

  if (approvalId && !authority.approvalIds.includes(approvalId)) {
    throw new PlatformError({
      code: "memory.tombstone_approval_not_admitted",
      category: "authorization",
      message: "Authority does not admit the supplied approval",
      retryable: false,
    });
  }
}

export function memoryRecordTombstoneRequestFingerprint(
  target: MemoryRecordTombstoneTarget,
): string {
  return fingerprintCanonicalJson({
    tenantId: target.tenantId,
    memoryRecordId: target.memoryRecordId,
    memoryRevisionId: target.memoryRevisionId,
    scope: memoryScopeKey(target.scope),
    expectedLifecycleRevision: target.expectedLifecycleRevision,
    reason: normalizeMemoryTombstoneReason(target.reason),
  });
}

export function memoryRecordTombstoneAuthorityScopeHash(
  authority: AuthorityContext,
  target: MemoryRecordTombstoneTarget,
): string {
  return fingerprintCanonicalJson({
    tenantId: target.tenantId,
    principalKey: principalKey(authority.principal),
    capability: memoryRecordTombstoneCapability,
    scope: memoryScopeKey(target.scope),
    policyRevision: authority.policyRevision,
  });
}

export function memoryRecordTombstoneResourceKey(
  target: MemoryRecordTombstoneTarget,
): string {
  return `memory:${target.memoryRecordId}:tombstone`;
}

export function createMemoryRecordTombstoneApprovalBinding(
  input: CreateMemoryRecordTombstoneApprovalBindingInput,
): ApprovalBinding {
  assertMemoryRecordTombstoneAuthority(input.authority, input);
  return createApprovalBinding({
    operationId: input.operationId,
    tenantId: input.tenantId,
    principal: input.authority.principal,
    action: memoryRecordTombstoneCapability,
    actionVersion: memoryRecordTombstoneActionVersion,
    resourceKey: memoryRecordTombstoneResourceKey(input),
    arguments: {
      requestFingerprint: memoryRecordTombstoneRequestFingerprint(input),
    },
    riskClass: memoryRecordTombstoneRiskClass,
  });
}
