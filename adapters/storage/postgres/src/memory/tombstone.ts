import {
  PlatformError,
  toInstant,
  type ApprovalId,
  type Instant,
  type OperationId,
} from "@masanawa/contracts";
import type { OperationRecord } from "@masanawa/events";
import {
  assertCurrentAuthority,
  principalKey,
  type ApprovalBinding,
  type AuthorityContext,
} from "@masanawa/security";
import {
  assertMemoryRecordTombstoneAuthority,
  createMemoryRecordTombstoneApprovalBinding,
  memoryRecordTombstoneAuthorityScopeHash,
  memoryRecordTombstoneCapability,
  memoryRecordTombstoneRequestFingerprint,
  memoryScopeStorage,
  normalizeMemoryTombstoneReason,
  type MemoryRecordSnapshot,
  type MemoryRecordTombstone,
  type MemoryRecordTombstoneTarget,
} from "@masanawa/memory";
import type { Pool, PoolClient } from "pg";
import {
  loadOperation,
  prepareOperation,
  transitionOperation,
} from "../events/operations.js";
import {
  consumeOnceApproval,
  createPostgresCurrentAuthoritySource,
} from "../security/approvals.js";
import { withTransaction } from "../transaction.js";
import { getMemoryRecordInScope } from "./repository.js";

export interface PrepareMemoryRecordTombstoneInput
  extends MemoryRecordTombstoneTarget {
  readonly authority: AuthorityContext;
  readonly idempotencyKey: string;
  readonly expiresAt: Instant;
}

export interface PreparedMemoryRecordTombstone {
  readonly operation: OperationRecord;
  readonly binding: ApprovalBinding;
  readonly reused: boolean;
}

export interface ExecuteMemoryRecordTombstoneInput
  extends MemoryRecordTombstoneTarget {
  readonly authority: AuthorityContext;
  readonly operationId: OperationId;
  readonly approvalId: ApprovalId;
  readonly tombstonedAt: Instant;
}

export interface ExecutedMemoryRecordTombstone {
  readonly operation: OperationRecord;
  readonly tombstone: MemoryRecordTombstone;
  readonly record: MemoryRecordSnapshot;
  readonly reused: boolean;
}

interface TombstoneRow {
  tenant_id: MemoryRecordTombstone["tenantId"];
  operation_id: OperationId;
  memory_record_id: MemoryRecordTombstone["memoryRecordId"];
  memory_revision_id: MemoryRecordTombstone["memoryRevisionId"];
  authority_context_id: MemoryRecordTombstone["authorityContextId"];
  approval_id: ApprovalId;
  policy_revision: string;
  principal_key: string;
  prior_lifecycle_revision: string;
  tombstoned_lifecycle_revision: string;
  reason: string;
  tombstoned_at: Date;
}

function lifecycleRevision(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid tombstone lifecycle revision returned by PostgreSQL");
  }
  return parsed;
}

function tombstoneFromRow(row: TombstoneRow): MemoryRecordTombstone {
  return Object.freeze({
    tenantId: row.tenant_id,
    memoryRecordId: row.memory_record_id,
    memoryRevisionId: row.memory_revision_id,
    operationId: row.operation_id,
    authorityContextId: row.authority_context_id,
    approvalId: row.approval_id,
    policyRevision: row.policy_revision,
    principalKey: row.principal_key,
    priorLifecycleRevision: lifecycleRevision(row.prior_lifecycle_revision),
    tombstonedLifecycleRevision: lifecycleRevision(
      row.tombstoned_lifecycle_revision,
    ),
    reason: row.reason,
    tombstonedAt: toInstant(row.tombstoned_at),
  });
}

async function loadTombstone(
  client: PoolClient,
  tenantId: MemoryRecordTombstone["tenantId"],
  operationId: OperationId,
): Promise<MemoryRecordTombstone | null> {
  const result = await client.query<TombstoneRow>(
    `SELECT tenant_id,
            operation_id,
            memory_record_id,
            memory_revision_id,
            authority_context_id,
            approval_id,
            policy_revision,
            principal_key,
            prior_lifecycle_revision::text,
            tombstoned_lifecycle_revision::text,
            reason,
            tombstoned_at
       FROM memory.record_tombstones
      WHERE tenant_id = $1
        AND operation_id = $2`,
    [tenantId, operationId],
  );
  return result.rows[0] ? tombstoneFromRow(result.rows[0]) : null;
}

function invalidOperation(
  message: string,
  operationId: OperationId,
): PlatformError {
  return new PlatformError({
    code: "memory.tombstone_operation_mismatch",
    category: "authorization",
    message,
    retryable: false,
    operationId,
  });
}

function assertOperationBinding(
  operation: OperationRecord,
  authority: AuthorityContext,
  target: MemoryRecordTombstoneTarget,
): void {
  if (operation.kind !== memoryRecordTombstoneCapability) {
    throw invalidOperation(
      "Operation kind does not match memory tombstone",
      operation.operationId,
    );
  }
  if (
    operation.requestFingerprint !==
      memoryRecordTombstoneRequestFingerprint(target) ||
    operation.authorityScopeHash !==
      memoryRecordTombstoneAuthorityScopeHash(authority, target)
  ) {
    throw invalidOperation(
      "Operation is bound to different tombstone arguments or authority scope",
      operation.operationId,
    );
  }
}

async function requireCurrentTombstoneTarget(
  client: PoolClient,
  target: MemoryRecordTombstoneTarget,
): Promise<MemoryRecordSnapshot> {
  const scope = memoryScopeStorage(target.scope);
  const locked = await client.query(
    `SELECT 1
       FROM memory.records
      WHERE tenant_id = $1
        AND memory_record_id = $2
        AND scope_kind = $3
        AND scope_ref_id IS NOT DISTINCT FROM $4
      FOR UPDATE`,
    [
      target.tenantId,
      target.memoryRecordId,
      scope.kind,
      scope.referenceId,
    ],
  );
  if (locked.rowCount !== 1) {
    throw new PlatformError({
      code: "memory.tombstone_record_not_found",
      category: "not-found",
      message: "MemoryRecord does not exist in the authorized scope",
      retryable: false,
    });
  }

  const record = await getMemoryRecordInScope(client, {
    tenantId: target.tenantId,
    memoryRecordId: target.memoryRecordId,
    scope: target.scope,
  });
  if (!record) {
    throw new Error("Locked MemoryRecord disappeared during tombstone validation");
  }
  if (record.currentRevision.memoryRevisionId !== target.memoryRevisionId) {
    throw new PlatformError({
      code: "memory.tombstone_revision_changed",
      category: "conflict",
      message: "MemoryRecord revision changed after tombstone was prepared",
      retryable: false,
    });
  }
  if (record.record.lifecycleRevision !== target.expectedLifecycleRevision) {
    throw new PlatformError({
      code: "memory.tombstone_lifecycle_changed",
      category: "conflict",
      message: "MemoryRecord lifecycle changed after tombstone was prepared",
      retryable: false,
    });
  }
  if (record.record.lifecycleState === "tombstoned") {
    throw new PlatformError({
      code: "memory.tombstone_already_applied",
      category: "conflict",
      message: "MemoryRecord is already tombstoned",
      retryable: false,
    });
  }
  return record;
}

async function prepareMemoryRecordTombstoneInTransaction(
  client: PoolClient,
  input: PrepareMemoryRecordTombstoneInput,
): Promise<PreparedMemoryRecordTombstone> {
  assertMemoryRecordTombstoneAuthority(input.authority, input);
  await assertCurrentAuthority(
    input.authority,
    createPostgresCurrentAuthoritySource(client),
  );
  await requireCurrentTombstoneTarget(client, input);

  const prepared = await prepareOperation(client, {
    tenantId: input.tenantId,
    kind: memoryRecordTombstoneCapability,
    idempotencyKey: input.idempotencyKey,
    authorityScopeHash: memoryRecordTombstoneAuthorityScopeHash(
      input.authority,
      input,
    ),
    requestFingerprint: memoryRecordTombstoneRequestFingerprint(input),
    expiresAt: input.expiresAt,
  });

  return Object.freeze({
    operation: prepared.operation,
    binding: createMemoryRecordTombstoneApprovalBinding({
      ...input,
      operationId: prepared.operation.operationId,
    }),
    reused: prepared.reused,
  });
}

async function executeMemoryRecordTombstoneInTransaction(
  client: PoolClient,
  input: ExecuteMemoryRecordTombstoneInput,
): Promise<ExecutedMemoryRecordTombstone> {
  assertMemoryRecordTombstoneAuthority(
    input.authority,
    input,
    input.approvalId,
  );
  await assertCurrentAuthority(
    input.authority,
    createPostgresCurrentAuthoritySource(client),
    input.tombstonedAt,
  );

  const operation = await loadOperation(
    client,
    input.tenantId,
    input.operationId,
  );
  if (!operation) {
    throw new PlatformError({
      code: "memory.tombstone_operation_not_found",
      category: "not-found",
      message: "Memory tombstone operation does not exist",
      retryable: false,
      operationId: input.operationId,
    });
  }
  assertOperationBinding(operation, input.authority, input);

  if (operation.state === "succeeded") {
    const tombstone = await loadTombstone(
      client,
      input.tenantId,
      input.operationId,
    );
    const record = await getMemoryRecordInScope(client, {
      tenantId: input.tenantId,
      memoryRecordId: input.memoryRecordId,
      scope: input.scope,
    });
    if (
      !tombstone ||
      !record ||
      record.record.lifecycleState !== "tombstoned" ||
      tombstone.memoryRevisionId !== record.currentRevision.memoryRevisionId ||
      tombstone.tombstonedLifecycleRevision !==
        record.record.lifecycleRevision
    ) {
      throw new PlatformError({
        code: "memory.tombstone_replay_state_mismatch",
        category: "conflict",
        message:
          "Succeeded tombstone operation no longer matches canonical memory state",
        retryable: false,
        operationId: operation.operationId,
      });
    }
    return Object.freeze({
      operation,
      tombstone,
      record,
      reused: true,
    });
  }

  if (operation.state !== "prepared") {
    throw new PlatformError({
      code: "memory.tombstone_operation_not_prepared",
      category: "conflict",
      message: "Memory tombstone operation is not executable from its current state",
      retryable: false,
      operationId: operation.operationId,
      details: { state: operation.state },
    });
  }

  await requireCurrentTombstoneTarget(client, input);

  const binding = createMemoryRecordTombstoneApprovalBinding({
    ...input,
    operationId: input.operationId,
  });
  await consumeOnceApproval(client, {
    tenantId: input.tenantId,
    approvalId: input.approvalId,
    binding,
    currentPolicyRevision: input.authority.policyRevision,
    consumedAt: input.tombstonedAt,
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

  const tombstonedAt = toInstant(input.tombstonedAt);
  const reason = normalizeMemoryTombstoneReason(input.reason);
  const nextLifecycleRevision = input.expectedLifecycleRevision + 1;

  const inserted = await client.query<TombstoneRow>(
    `INSERT INTO memory.record_tombstones (
       tenant_id,
       operation_id,
       memory_record_id,
       memory_revision_id,
       authority_context_id,
       approval_id,
       policy_revision,
       principal_key,
       prior_lifecycle_revision,
       tombstoned_lifecycle_revision,
       reason,
       tombstoned_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING tenant_id,
               operation_id,
               memory_record_id,
               memory_revision_id,
               authority_context_id,
               approval_id,
               policy_revision,
               principal_key,
               prior_lifecycle_revision::text,
               tombstoned_lifecycle_revision::text,
               reason,
               tombstoned_at`,
    [
      input.tenantId,
      input.operationId,
      input.memoryRecordId,
      input.memoryRevisionId,
      input.authority.authorityContextId,
      input.approvalId,
      input.authority.policyRevision,
      principalKey(input.authority.principal),
      input.expectedLifecycleRevision,
      nextLifecycleRevision,
      reason,
      tombstonedAt,
    ],
  );

  const updated = await client.query(
    `UPDATE memory.records
        SET lifecycle_state = 'tombstoned',
            lifecycle_revision = lifecycle_revision + 1,
            updated_at = $5
      WHERE tenant_id = $1
        AND memory_record_id = $2
        AND lifecycle_revision = $3
        AND lifecycle_state <> 'tombstoned'
        AND EXISTS (
          SELECT 1
            FROM memory.revisions v
           WHERE v.tenant_id = memory.records.tenant_id
             AND v.memory_record_id = memory.records.memory_record_id
             AND v.revision_number = memory.records.revision
             AND v.memory_revision_id = $4
        )`,
    [
      input.tenantId,
      input.memoryRecordId,
      input.expectedLifecycleRevision,
      input.memoryRevisionId,
      tombstonedAt,
    ],
  );
  if (updated.rowCount !== 1) {
    throw new PlatformError({
      code: "memory.tombstone_cas_conflict",
      category: "conflict",
      message: "MemoryRecord changed before tombstone could be committed",
      retryable: false,
      operationId: input.operationId,
    });
  }

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

  const record = await getMemoryRecordInScope(client, {
    tenantId: input.tenantId,
    memoryRecordId: input.memoryRecordId,
    scope: input.scope,
  });
  if (!record || record.record.lifecycleState !== "tombstoned") {
    throw new Error("MemoryRecord tombstone committed without readable canonical state");
  }

  return Object.freeze({
    operation: succeeded,
    tombstone: tombstoneFromRow(inserted.rows[0]!),
    record,
    reused: false,
  });
}

export async function prepareMemoryRecordTombstone(
  pool: Pool,
  input: PrepareMemoryRecordTombstoneInput,
): Promise<PreparedMemoryRecordTombstone> {
  return withTransaction(pool, (client) =>
    prepareMemoryRecordTombstoneInTransaction(client, input),
  );
}

export async function executeMemoryRecordTombstone(
  pool: Pool,
  input: ExecuteMemoryRecordTombstoneInput,
): Promise<ExecutedMemoryRecordTombstone> {
  return withTransaction(pool, (client) =>
    executeMemoryRecordTombstoneInTransaction(client, input),
  );
}
