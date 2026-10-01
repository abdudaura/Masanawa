import {
  PlatformError,
  type ApprovalId,
  type Instant,
  type OperationId,
} from "@masanawa/contracts";
import type { OperationRecord } from "@masanawa/events";
import {
  assertCurrentAuthority,
  type ApprovalBinding,
  type AuthorityContext,
} from "@masanawa/security";
import {
  assertWorldCanonAuthority,
  createWorldCanonApprovalBinding,
  worldCanonAuthorityScopeHash,
  worldCanonCapability,
  worldCanonRequestFingerprint,
  type WorldCanonGovernanceTarget,
  type WorldEvent,
} from "@masanawa/world";
import type { PoolClient } from "pg";
import {
  loadOperation,
  prepareOperation,
  transitionOperation,
} from "../events/operations.js";
import {
  consumeOnceApproval,
  createPostgresCurrentAuthoritySource,
} from "../security/approvals.js";
import {
  approveWorldEvent,
  getWorldEvent,
  retireWorldEvent,
} from "./repository.js";

export interface PrepareWorldCanonGovernanceInput
  extends WorldCanonGovernanceTarget {
  readonly authority: AuthorityContext;
  readonly idempotencyKey: string;
  readonly expiresAt: Instant;
}

export interface PreparedWorldCanonGovernance {
  readonly operation: OperationRecord;
  readonly binding: ApprovalBinding;
  readonly reused: boolean;
}

export interface ExecuteWorldCanonGovernanceInput
  extends WorldCanonGovernanceTarget {
  readonly authority: AuthorityContext;
  readonly operationId: OperationId;
  readonly approvalId: ApprovalId;
  readonly decidedAt: Instant;
}

export interface ExecutedWorldCanonGovernance {
  readonly operation: OperationRecord;
  readonly event: WorldEvent;
  readonly reused: boolean;
}

function invalidOperation(message: string, operationId: OperationId): PlatformError {
  return new PlatformError({
    code: "world.governance_operation_mismatch",
    category: "authorization",
    message,
    retryable: false,
    operationId,
  });
}

async function requireBoundEvent(
  client: PoolClient,
  target: WorldCanonGovernanceTarget,
): Promise<WorldEvent> {
  const event = await getWorldEvent(
    client,
    target.tenantId,
    target.worldEventId,
  );
  if (!event) {
    throw new PlatformError({
      code: "world.event_not_found",
      category: "not-found",
      message: "World event does not exist in the requested tenant",
      retryable: false,
    });
  }
  if (event.worldId !== target.worldId) {
    throw new PlatformError({
      code: "world.governance_world_mismatch",
      category: "authorization",
      message: "World event does not belong to the authority-bound World",
      retryable: false,
    });
  }
  return event;
}

function assertOperationBinding(
  operation: OperationRecord,
  authority: AuthorityContext,
  target: WorldCanonGovernanceTarget,
): void {
  if (operation.kind !== worldCanonCapability(target.decision)) {
    throw invalidOperation(
      "Operation kind does not match the requested canon decision",
      operation.operationId,
    );
  }
  if (
    operation.requestFingerprint !== worldCanonRequestFingerprint(target) ||
    operation.authorityScopeHash !==
      worldCanonAuthorityScopeHash(authority, target)
  ) {
    throw invalidOperation(
      "Operation is bound to different canon arguments or authority scope",
      operation.operationId,
    );
  }
}

export async function prepareWorldCanonGovernance(
  client: PoolClient,
  input: PrepareWorldCanonGovernanceInput,
): Promise<PreparedWorldCanonGovernance> {
  assertWorldCanonAuthority(input.authority, input);
  await assertCurrentAuthority(
    input.authority,
    createPostgresCurrentAuthoritySource(client),
  );
  await requireBoundEvent(client, input);

  const prepared = await prepareOperation(client, {
    tenantId: input.tenantId,
    kind: worldCanonCapability(input.decision),
    idempotencyKey: input.idempotencyKey,
    authorityScopeHash: worldCanonAuthorityScopeHash(input.authority, input),
    requestFingerprint: worldCanonRequestFingerprint(input),
    expiresAt: input.expiresAt,
  });

  const binding = createWorldCanonApprovalBinding({
    ...input,
    operationId: prepared.operation.operationId,
  });

  return Object.freeze({
    operation: prepared.operation,
    binding,
    reused: prepared.reused,
  });
}

export async function executeWorldCanonGovernance(
  client: PoolClient,
  input: ExecuteWorldCanonGovernanceInput,
): Promise<ExecutedWorldCanonGovernance> {
  assertWorldCanonAuthority(input.authority, input, input.approvalId);
  await assertCurrentAuthority(
    input.authority,
    createPostgresCurrentAuthoritySource(client),
    input.decidedAt,
  );

  const eventBefore = await requireBoundEvent(client, input);
  const operation = await loadOperation(
    client,
    input.tenantId,
    input.operationId,
  );
  if (!operation) {
    throw new PlatformError({
      code: "world.governance_operation_not_found",
      category: "not-found",
      message: "Canon governance operation does not exist",
      retryable: false,
      operationId: input.operationId,
    });
  }
  assertOperationBinding(operation, input.authority, input);

  const expectedState = input.decision === "approve" ? "approved" : "retired";
  if (operation.state === "succeeded") {
    if (eventBefore.canonState !== expectedState) {
      throw new PlatformError({
        code: "world.governance_replay_state_mismatch",
        category: "conflict",
        message: "Succeeded governance operation no longer matches canon state",
        retryable: false,
        operationId: operation.operationId,
      });
    }
    return Object.freeze({
      operation,
      event: eventBefore,
      reused: true,
    });
  }

  if (operation.state !== "prepared") {
    throw new PlatformError({
      code: "world.governance_operation_not_prepared",
      category: "conflict",
      message: "Canon governance operation is not executable from its current state",
      retryable: false,
      operationId: operation.operationId,
      details: { state: operation.state },
    });
  }

  const binding = createWorldCanonApprovalBinding({
    ...input,
    operationId: input.operationId,
  });
  await consumeOnceApproval(client, {
    tenantId: input.tenantId,
    approvalId: input.approvalId,
    binding,
    currentPolicyRevision: input.authority.policyRevision,
    consumedAt: input.decidedAt,
  });

  await transitionOperation(client, {
    operationId: input.operationId,
    from: "prepared",
    to: "authorized",
  });
  await transitionOperation(client, {
    operationId: input.operationId,
    from: "authorized",
    to: "dispatching",
  });

  const event =
    input.decision === "approve"
      ? await approveWorldEvent(client, {
          tenantId: input.tenantId,
          worldEventId: input.worldEventId,
          approvedAt: input.decidedAt,
        })
      : await retireWorldEvent(client, {
          tenantId: input.tenantId,
          worldEventId: input.worldEventId,
          retiredAt: input.decidedAt,
        });

  await transitionOperation(client, {
    operationId: input.operationId,
    from: "dispatching",
    to: "dispatched",
  });
  await transitionOperation(client, {
    operationId: input.operationId,
    from: "dispatched",
    to: "accepted",
  });
  const succeeded = await transitionOperation(client, {
    operationId: input.operationId,
    from: "accepted",
    to: "succeeded",
  });

  return Object.freeze({
    operation: succeeded,
    event,
    reused: false,
  });
}
