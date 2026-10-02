import {
  PlatformError,
  createCanonicalId,
  type Instant,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";
import { assertOperationTransition, type OperationRecord, type OperationState } from "@masanawa/events";
import type { PoolClient } from "pg";

export interface PrepareOperationInput {
  readonly tenantId: TenantId;
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly authorityScopeHash: string;
  readonly requestFingerprint: string;
  readonly expiresAt: Instant;
}

export interface PreparedOperation {
  readonly operation: OperationRecord;
  readonly reused: boolean;
}

interface OperationRow {
  operation_id: OperationId;
  tenant_id: TenantId;
  kind: string;
  idempotency_key: string;
  authority_scope_hash: string;
  request_fingerprint: string;
  state: OperationState;
  created_at: Date;
  updated_at: Date;
}

function toOperationRecord(row: OperationRow): OperationRecord {
  return {
    operationId: row.operation_id,
    tenantId: row.tenant_id,
    kind: row.kind,
    idempotencyKey: row.idempotency_key,
    authorityScopeHash: row.authority_scope_hash,
    requestFingerprint: row.request_fingerprint,
    state: row.state,
    createdAt: row.created_at.toISOString() as Instant,
    updatedAt: row.updated_at.toISOString() as Instant,
  };
}

export async function loadOperation(
  client: PoolClient,
  tenantId: TenantId,
  operationId: OperationId,
): Promise<OperationRecord | null> {
  const result = await client.query<OperationRow>(
    `SELECT operation_id,
            tenant_id,
            kind,
            idempotency_key,
            authority_scope_hash,
            request_fingerprint,
            state,
            created_at,
            updated_at
       FROM events.operations
      WHERE tenant_id = $1
        AND operation_id = $2`,
    [tenantId, operationId],
  );
  return result.rows[0] ? toOperationRecord(result.rows[0]) : null;
}

async function loadOperationByIdempotency(
  client: PoolClient,
  input: PrepareOperationInput,
): Promise<OperationRow | null> {
  const result = await client.query<OperationRow>(
    `SELECT operation_id,
            tenant_id,
            kind,
            idempotency_key,
            authority_scope_hash,
            request_fingerprint,
            state,
            created_at,
            updated_at
       FROM events.operations
      WHERE tenant_id = $1
        AND kind = $2
        AND idempotency_key = $3
        AND authority_scope_hash = $4`,
    [
      input.tenantId,
      input.kind,
      input.idempotencyKey,
      input.authorityScopeHash,
    ],
  );
  return result.rows[0] ?? null;
}

export async function prepareOperation(
  client: PoolClient,
  input: PrepareOperationInput,
): Promise<PreparedOperation> {
  if (!input.idempotencyKey.trim()) {
    throw new TypeError("idempotencyKey is required");
  }
  if (!input.requestFingerprint.trim()) {
    throw new TypeError("requestFingerprint is required");
  }

  const operationId = createCanonicalId("operation");
  const inserted = await client.query<OperationRow>(
    `INSERT INTO events.operations (
       operation_id,
       tenant_id,
       kind,
       idempotency_key,
       authority_scope_hash,
       request_fingerprint,
       state
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'prepared')
     ON CONFLICT (tenant_id, kind, idempotency_key, authority_scope_hash)
     DO NOTHING
     RETURNING operation_id,
               tenant_id,
               kind,
               idempotency_key,
               authority_scope_hash,
               request_fingerprint,
               state,
               created_at,
               updated_at`,
    [
      operationId,
      input.tenantId,
      input.kind,
      input.idempotencyKey,
      input.authorityScopeHash,
      input.requestFingerprint,
    ],
  );

  const row = inserted.rows[0] ?? (await loadOperationByIdempotency(client, input));
  if (!row) {
    throw new PlatformError({
      code: "operation.prepare_race_unresolved",
      category: "conflict",
      message: "Could not resolve operation after idempotency conflict",
      retryable: true,
    });
  }

  if (row.request_fingerprint !== input.requestFingerprint) {
    throw new PlatformError({
      code: "idempotency.fingerprint_conflict",
      category: "conflict",
      message: "Idempotency key is already bound to a different canonical request",
      retryable: false,
      operationId: row.operation_id,
    });
  }

  await client.query(
    `INSERT INTO events.idempotency_records (
       tenant_id,
       operation_kind,
       idempotency_key,
       authority_scope_hash,
       request_fingerprint,
       operation_id,
       expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, operation_kind, idempotency_key, authority_scope_hash)
     DO NOTHING`,
    [
      input.tenantId,
      input.kind,
      input.idempotencyKey,
      input.authorityScopeHash,
      input.requestFingerprint,
      row.operation_id,
      input.expiresAt,
    ],
  );

  const idempotency = await client.query<{
    request_fingerprint: string;
    operation_id: OperationId;
  }>(
    `SELECT request_fingerprint, operation_id
       FROM events.idempotency_records
      WHERE tenant_id = $1
        AND operation_kind = $2
        AND idempotency_key = $3
        AND authority_scope_hash = $4`,
    [
      input.tenantId,
      input.kind,
      input.idempotencyKey,
      input.authorityScopeHash,
    ],
  );

  const bound = idempotency.rows[0];
  if (
    !bound ||
    bound.request_fingerprint !== input.requestFingerprint ||
    bound.operation_id !== row.operation_id
  ) {
    throw new PlatformError({
      code: "idempotency.binding_conflict",
      category: "conflict",
      message: "Idempotency record is bound to incompatible operation state",
      retryable: false,
      operationId: row.operation_id,
    });
  }

  return {
    operation: toOperationRecord(row),
    reused: inserted.rowCount === 0,
  };
}

export async function transitionOperation(
  client: PoolClient,
  input: {
    readonly operationId: OperationId;
    readonly tenantId?: TenantId;
    readonly from: OperationState;
    readonly to: OperationState;
    readonly expectedFence?: number;
  },
): Promise<OperationRecord> {
  assertOperationTransition(input.from, input.to);

  const result = await client.query<OperationRow>(
    `UPDATE events.operations
        SET state = $3,
            updated_at = clock_timestamp()
      WHERE operation_id = $1
        AND state = $2
        AND ($4::text IS NULL OR tenant_id = $4)
        AND ($5::bigint IS NULL OR fence = $5)
      RETURNING operation_id,
                tenant_id,
                kind,
                idempotency_key,
                authority_scope_hash,
                request_fingerprint,
                state,
                created_at,
                updated_at`,
    [
      input.operationId,
      input.from,
      input.to,
      input.tenantId ?? null,
      input.expectedFence ?? null,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "operation.stale_transition",
      category: "conflict",
      message: "Operation state, tenant or fence changed before transition",
      retryable: false,
      operationId: input.operationId,
      details: {
        expectedState: input.from,
        requestedState: input.to,
      },
    });
  }

  return toOperationRecord(row);
}

export async function touchOperationFence(
  client: PoolClient,
  operationId: OperationId,
): Promise<number> {
  const result = await client.query<{ fence: string }>(
    `UPDATE events.operations
        SET fence = fence + 1,
            updated_at = clock_timestamp()
      WHERE operation_id = $1
      RETURNING fence::text`,
    [operationId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "operation.not_found",
      category: "not-found",
      message: "Operation does not exist",
      retryable: false,
      operationId,
    });
  }
  return Number(row.fence);
}
