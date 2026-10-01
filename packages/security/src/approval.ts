import type {
  ApprovalId,
  Instant,
  OperationId,
  TenantId,
} from "@masanawa/contracts";
import { PlatformError, createCanonicalId, nowInstant } from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "./canonical-json.js";
import type { Principal } from "./principal.js";
import { principalKey } from "./principal.js";

export const approvalStates = [
  "pending",
  "approved",
  "denied",
  "expired",
  "revoked",
  "consumed",
] as const;

export type ApprovalState = (typeof approvalStates)[number];
export type ApprovalKind = "once" | "session" | "policy";

export interface ApprovalBinding {
  readonly operationId: OperationId;
  readonly tenantId: TenantId;
  readonly principalKey: string;
  readonly action: string;
  readonly actionVersion: string;
  readonly resourceKey: string;
  readonly argumentsFingerprint: string;
  readonly riskClass: string;
}

export interface ApprovalRecord {
  readonly approvalId: ApprovalId;
  readonly kind: ApprovalKind;
  readonly state: ApprovalState;
  readonly binding: ApprovalBinding;
  readonly policyRevision: string;
  readonly requestedAt: Instant;
  readonly expiresAt: Instant;
  readonly decidedAt?: Instant;
  readonly approverKey?: string;
}

export interface CreateApprovalBindingInput {
  readonly operationId: OperationId;
  readonly tenantId: TenantId;
  readonly principal: Principal;
  readonly action: string;
  readonly actionVersion: string;
  readonly resourceKey: string;
  readonly arguments: unknown;
  readonly riskClass: string;
}

export function createApprovalBinding(input: CreateApprovalBindingInput): ApprovalBinding {
  return Object.freeze({
    operationId: input.operationId,
    tenantId: input.tenantId,
    principalKey: principalKey(input.principal),
    action: input.action,
    actionVersion: input.actionVersion,
    resourceKey: input.resourceKey,
    argumentsFingerprint: fingerprintCanonicalJson(input.arguments),
    riskClass: input.riskClass,
  });
}

export function createPendingApproval(input: {
  readonly kind: ApprovalKind;
  readonly binding: ApprovalBinding;
  readonly policyRevision: string;
  readonly expiresAt: Instant;
  readonly requestedAt?: Instant;
}): ApprovalRecord {
  return Object.freeze({
    approvalId: createCanonicalId("approval"),
    kind: input.kind,
    state: "pending",
    binding: input.binding,
    policyRevision: input.policyRevision,
    requestedAt: input.requestedAt ?? nowInstant(),
    expiresAt: input.expiresAt,
  });
}

export function assertApprovalMatches(
  approval: ApprovalRecord,
  binding: ApprovalBinding,
  now: Instant = nowInstant(),
): void {
  if (approval.state !== "approved") {
    throw new PlatformError({
      code: "approval.not_approved",
      category: "authorization",
      message: `Approval is not usable in state ${approval.state}`,
      retryable: false,
    });
  }

  if (approval.expiresAt <= now) {
    throw new PlatformError({
      code: "approval.expired",
      category: "authorization",
      message: "Approval has expired",
      retryable: false,
    });
  }

  const keys = Object.keys(binding) as Array<keyof ApprovalBinding>;
  for (const key of keys) {
    if (approval.binding[key] !== binding[key]) {
      throw new PlatformError({
        code: "approval.binding_changed",
        category: "authorization",
        message: `Approval is not valid for changed ${key}`,
        retryable: false,
      });
    }
  }
}

export function approvePendingApproval(
  approval: ApprovalRecord,
  approver: Principal,
  decidedAt: Instant = nowInstant(),
): ApprovalRecord {
  if (approval.state !== "pending") {
    throw new PlatformError({
      code: "approval.already_settled",
      category: "conflict",
      message: "Approval already has a terminal decision",
      retryable: false,
    });
  }

  if (approval.expiresAt <= decidedAt) {
    throw new PlatformError({
      code: "approval.expired",
      category: "authorization",
      message: "Approval expired before decision",
      retryable: false,
    });
  }

  return Object.freeze({
    ...approval,
    state: "approved",
    decidedAt,
    approverKey: principalKey(approver),
  });
}
