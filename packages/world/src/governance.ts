import type {
  ApprovalId,
  OperationId,
  TenantId,
  WorldEventId,
  WorldId,
} from "@masanawa/contracts";
import {
  PlatformError,
} from "@masanawa/contracts";
import {
  createApprovalBinding,
  type ApprovalBinding,
  type AuthorityContext,
} from "@masanawa/security";

export const worldCanonGovernanceActionVersion = "1";
export const worldCanonApproveCapability = "world.canon.approve";
export const worldCanonRetireCapability = "world.canon.retire";
export const worldCanonGovernanceRiskClass = "consequential";

export type WorldCanonDecision = "approve" | "retire";

export interface WorldCanonGovernanceTarget {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly worldEventId: WorldEventId;
  readonly decision: WorldCanonDecision;
}

export interface CreateWorldCanonApprovalBindingInput
  extends WorldCanonGovernanceTarget {
  readonly operationId: OperationId;
  readonly authority: AuthorityContext;
}

export function worldEventResourceKey(
  worldId: WorldId,
  worldEventId: WorldEventId,
): string {
  return `world:${worldId}:event:${worldEventId}`;
}

export function worldCanonCapability(
  decision: WorldCanonDecision,
): string {
  return decision === "approve"
    ? worldCanonApproveCapability
    : worldCanonRetireCapability;
}

export function assertWorldCanonAuthority(
  authority: AuthorityContext,
  target: WorldCanonGovernanceTarget,
  approvalId?: ApprovalId,
): void {
  if (authority.tenantId !== target.tenantId) {
    throw new PlatformError({
      code: "world.governance_tenant_mismatch",
      category: "authorization",
      message: "Authority belongs to a different tenant",
      retryable: false,
    });
  }

  const capability = worldCanonCapability(target.decision);
  if (!authority.capabilities.includes(capability)) {
    throw new PlatformError({
      code: "world.governance_capability_missing",
      category: "authorization",
      message: `Authority lacks required capability ${capability}`,
      retryable: false,
    });
  }

  const allowedWorlds = authority.resourceScope.worldIds;
  if (allowedWorlds && !allowedWorlds.includes(target.worldId)) {
    throw new PlatformError({
      code: "world.governance_scope_mismatch",
      category: "authorization",
      message: "Authority is not scoped to the requested World",
      retryable: false,
    });
  }

  if (approvalId && !authority.approvalIds.includes(approvalId)) {
    throw new PlatformError({
      code: "world.governance_approval_not_admitted",
      category: "authorization",
      message: "Authority does not admit the supplied approval",
      retryable: false,
    });
  }
}

export function createWorldCanonApprovalBinding(
  input: CreateWorldCanonApprovalBindingInput,
): ApprovalBinding {
  assertWorldCanonAuthority(input.authority, input);

  return createApprovalBinding({
    operationId: input.operationId,
    tenantId: input.tenantId,
    principal: input.authority.principal,
    action: worldCanonCapability(input.decision),
    actionVersion: worldCanonGovernanceActionVersion,
    resourceKey: worldEventResourceKey(input.worldId, input.worldEventId),
    arguments: {
      worldId: input.worldId,
      worldEventId: input.worldEventId,
      decision: input.decision,
    },
    riskClass: worldCanonGovernanceRiskClass,
  });
}
