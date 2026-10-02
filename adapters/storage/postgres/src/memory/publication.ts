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
  assertMemoryScopePublicationAuthority,
  createMemoryScopePublicationApprovalBinding,
  memoryScopePublicationAuthorityScopeHash,
  memoryScopePublicationRequestFingerprint,
  memoryScopePublishCapability,
  memoryScopeStorage,
  type MemoryRecordSnapshot,
  type MemoryScopePublication,
  type MemoryScopePublicationTarget,
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
import {
  createMemoryRecord,
  getMemoryRecordInScope,
} from "./repository.js";

export interface PrepareMemoryScopePublicationInput
  extends MemoryScopePublicationTarget {
  readonly authority: AuthorityContext;
  readonly idempotencyKey: string;
  readonly expiresAt: Instant;
}

export interface PreparedMemoryScopePublication {
  readonly operation: OperationRecord;
  readonly binding: ApprovalBinding;
  readonly reused: boolean;
}

export interface ExecuteMemoryScopePublicationInput
  extends MemoryScopePublicationTarget {
  readonly authority: AuthorityContext;
  readonly operationId: OperationId;
  readonly approvalId: ApprovalId;
  readonly publishedAt: Instant;
}

export interface ExecutedMemoryScopePublication {
  readonly operation: OperationRecord;
  readonly publication: MemoryScopePublication;
  readonly target: MemoryRecordSnapshot;
  readonly reused: boolean;
}

interface PublicationRow {
  tenant_id: MemoryScopePublication["tenantId"];
  operation_id: OperationId;
  source_memory_record_id: MemoryScopePublication["sourceMemoryRecordId"];
  source_memory_revision_id: MemoryScopePublication["sourceMemoryRevisionId"];
  target_memory_record_id: MemoryScopePublication["targetMemoryRecordId"];
  target_memory_revision_id: MemoryScopePublication["targetMemoryRevisionId"];
  authority_context_id: MemoryScopePublication["authorityContextId"];
  approval_id: ApprovalId;
  policy_revision: string;
  principal_key: string;
  reason: string;
  published_at: Date;
}

function publicationFromRow(row: PublicationRow): MemoryScopePublication {
  return Object.freeze({
    tenantId: row.tenant_id,
    sourceMemoryRecordId: row.source_memory_record_id,
    sourceMemoryRevisionId: row.source_memory_revision_id,
    targetMemoryRecordId: row.target_memory_record_id,
    targetMemoryRevisionId: row.target_memory_revision_id,
    operationId: row.operation_id,
    authorityContextId: row.authority_context_id,
    approvalId: row.approval_id,
    policyRevision: row.policy_revision,
    principalKey: row.principal_key,
    reason: row.reason,
    publishedAt: toInstant(row.published_at),
  });
}

async function loadPublication(
  client: PoolClient,
  tenantId: MemoryScopePublication["tenantId"],
  operationId: OperationId,
): Promise<MemoryScopePublication | null> {
  const result = await client.query<PublicationRow>(
    `SELECT tenant_id,
            operation_id,
            source_memory_record_id,
            source_memory_revision_id,
            target_memory_record_id,
            target_memory_revision_id,
            authority_context_id,
            approval_id,
            policy_revision,
            principal_key,
            reason,
            published_at
       FROM memory.scope_publications
      WHERE tenant_id = $1
        AND operation_id = $2`,
    [tenantId, operationId],
  );
  return result.rows[0] ? publicationFromRow(result.rows[0]) : null;
}

function invalidOperation(
  message: string,
  operationId: OperationId,
): PlatformError {
  return new PlatformError({
    code: "memory.publication_operation_mismatch",
    category: "authorization",
    message,
    retryable: false,
    operationId,
  });
}

function assertOperationBinding(
  operation: OperationRecord,
  authority: AuthorityContext,
  target: MemoryScopePublicationTarget,
): void {
  if (operation.kind !== memoryScopePublishCapability) {
    throw invalidOperation(
      "Operation kind does not match memory scope publication",
      operation.operationId,
    );
  }
  if (
    operation.requestFingerprint !==
      memoryScopePublicationRequestFingerprint(target) ||
    operation.authorityScopeHash !==
      memoryScopePublicationAuthorityScopeHash(authority, target)
  ) {
    throw invalidOperation(
      "Operation is bound to different memory publication arguments or authority scope",
      operation.operationId,
    );
  }
}

async function requireCurrentSource(
  client: PoolClient,
  target: MemoryScopePublicationTarget,
): Promise<MemoryRecordSnapshot> {
  const scope = memoryScopeStorage(target.sourceScope);
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
      target.sourceMemoryRecordId,
      scope.kind,
      scope.referenceId,
    ],
  );
  if (locked.rowCount !== 1) {
    throw new PlatformError({
      code: "memory.publication_source_not_found",
      category: "not-found",
      message: "Source MemoryRecord does not exist in the authorized source scope",
      retryable: false,
    });
  }

  const source = await getMemoryRecordInScope(client, {
    tenantId: target.tenantId,
    memoryRecordId: target.sourceMemoryRecordId,
    scope: target.sourceScope,
  });
  if (!source) {
    throw new Error("Locked MemoryRecord disappeared before publication validation");
  }
  if (
    source.currentRevision.memoryRevisionId !== target.sourceMemoryRevisionId
  ) {
    throw new PlatformError({
      code: "memory.publication_source_revision_changed",
      category: "conflict",
      message: "Source MemoryRecord changed after publication was prepared",
      retryable: false,
    });
  }
  if (source.record.lifecycleState !== "active") {
    throw new PlatformError({
      code: "memory.publication_source_not_active",
      category: "conflict",
      message: "Only an active MemoryRecord can be published",
      retryable: false,
    });
  }
  return source;
}

async function prepareMemoryScopePublicationInTransaction(
  client: PoolClient,
  input: PrepareMemoryScopePublicationInput,
): Promise<PreparedMemoryScopePublication> {
  assertMemoryScopePublicationAuthority(input.authority, input);
  await assertCurrentAuthority(
    input.authority,
    createPostgresCurrentAuthoritySource(client),
  );
  await requireCurrentSource(client, input);

  const prepared = await prepareOperation(client, {
    tenantId: input.tenantId,
    kind: memoryScopePublishCapability,
    idempotencyKey: input.idempotencyKey,
    authorityScopeHash: memoryScopePublicationAuthorityScopeHash(
      input.authority,
      input,
    ),
    requestFingerprint: memoryScopePublicationRequestFingerprint(input),
    expiresAt: input.expiresAt,
  });

  return Object.freeze({
    operation: prepared.operation,
    binding: createMemoryScopePublicationApprovalBinding({
      ...input,
      operationId: prepared.operation.operationId,
    }),
    reused: prepared.reused,
  });
}

async function executeMemoryScopePublicationInTransaction(
  client: PoolClient,
  input: ExecuteMemoryScopePublicationInput,
): Promise<ExecutedMemoryScopePublication> {
  assertMemoryScopePublicationAuthority(
    input.authority,
    input,
    input.approvalId,
  );
  await assertCurrentAuthority(
    input.authority,
    createPostgresCurrentAuthoritySource(client),
    input.publishedAt,
  );

  const operation = await loadOperation(
    client,
    input.tenantId,
    input.operationId,
  );
  if (!operation) {
    throw new PlatformError({
      code: "memory.publication_operation_not_found",
      category: "not-found",
      message: "Memory publication operation does not exist",
      retryable: false,
      operationId: input.operationId,
    });
  }
  assertOperationBinding(operation, input.authority, input);

  if (operation.state === "succeeded") {
    const publication = await loadPublication(
      client,
      input.tenantId,
      input.operationId,
    );
    const target = await getMemoryRecordInScope(client, {
      tenantId: input.tenantId,
      memoryRecordId: input.targetMemoryRecordId,
      scope: input.targetScope,
    });
    if (
      !publication ||
      !target ||
      publication.targetMemoryRevisionId !==
        target.currentRevision.memoryRevisionId
    ) {
      throw new PlatformError({
        code: "memory.publication_replay_state_mismatch",
        category: "conflict",
        message: "Succeeded publication operation no longer matches canonical memory state",
        retryable: false,
        operationId: operation.operationId,
      });
    }
    return Object.freeze({
      operation,
      publication,
      target,
      reused: true,
    });
  }

  if (operation.state !== "prepared") {
    throw new PlatformError({
      code: "memory.publication_operation_not_prepared",
      category: "conflict",
      message: "Memory publication operation is not executable from its current state",
      retryable: false,
      operationId: operation.operationId,
      details: { state: operation.state },
    });
  }

  // A completed publication must remain replayable even if the private source is
  // later superseded/absorbed. Only a not-yet-executed publication revalidates that
  // its source revision is still current and active before consuming authority.
  await requireCurrentSource(client, input);

  const binding = createMemoryScopePublicationApprovalBinding({
    ...input,
    operationId: input.operationId,
  });
  await consumeOnceApproval(client, {
    tenantId: input.tenantId,
    approvalId: input.approvalId,
    binding,
    currentPolicyRevision: input.authority.policyRevision,
    consumedAt: input.publishedAt,
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

  const publicationFingerprint =
    memoryScopePublicationRequestFingerprint(input);
  const target = await createMemoryRecord(client, {
    tenantId: input.tenantId,
    memoryRecordId: input.targetMemoryRecordId,
    memoryRevisionId: input.targetMemoryRevisionId,
    memoryType: input.targetMemoryType,
    scope: input.targetScope,
    ...input.targetRevision,
    evidence: [
      {
        sourceKind: "operator",
        sourceReference: `memory-publication:${input.operationId}`,
        sourceContentHash: publicationFingerprint,
        observedAt: input.targetRevision.observedAt,
      },
    ],
    createdAt: input.publishedAt,
  });

  const inserted = await client.query<PublicationRow>(
    `INSERT INTO memory.scope_publications (
       tenant_id,
       operation_id,
       source_memory_record_id,
       source_memory_revision_id,
       target_memory_record_id,
       target_memory_revision_id,
       authority_context_id,
       approval_id,
       policy_revision,
       principal_key,
       reason,
       published_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING tenant_id,
               operation_id,
               source_memory_record_id,
               source_memory_revision_id,
               target_memory_record_id,
               target_memory_revision_id,
               authority_context_id,
               approval_id,
               policy_revision,
               principal_key,
               reason,
               published_at`,
    [
      input.tenantId,
      input.operationId,
      input.sourceMemoryRecordId,
      input.sourceMemoryRevisionId,
      input.targetMemoryRecordId,
      input.targetMemoryRevisionId,
      input.authority.authorityContextId,
      input.approvalId,
      input.authority.policyRevision,
      principalKey(input.authority.principal),
      input.reason.trim(),
      input.publishedAt,
    ],
  );

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
    publication: publicationFromRow(inserted.rows[0]!),
    target,
    reused: false,
  });
}

export async function prepareMemoryScopePublication(
  pool: Pool,
  input: PrepareMemoryScopePublicationInput,
): Promise<PreparedMemoryScopePublication> {
  return withTransaction(pool, (client) =>
    prepareMemoryScopePublicationInTransaction(client, input),
  );
}

export async function executeMemoryScopePublication(
  pool: Pool,
  input: ExecuteMemoryScopePublicationInput,
): Promise<ExecutedMemoryScopePublication> {
  return withTransaction(pool, (client) =>
    executeMemoryScopePublicationInTransaction(client, input),
  );
}
