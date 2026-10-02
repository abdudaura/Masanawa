import {
  PlatformError,
  createCanonicalId,
  type ExternalReceiptId,
  type Instant,
  type OperationId,
  type ReconciliationCaseId,
  type TenantId,
} from "@masanawa/contracts";
import { canonicalJson } from "@masanawa/security";
import {
  assertReconciliationTransition,
  type OperationState,
  type ReconciliationStatus,
} from "@masanawa/events";
import type { Pool, PoolClient } from "pg";
import { transitionOperation } from "./operations.js";
import { withTransaction } from "../transaction.js";

export interface RecordExternalReceiptInput {
  readonly tenantId: TenantId;
  readonly operationId: OperationId;
  readonly provider: string;
  readonly observationKey: string;
  readonly providerReference?: string;
  readonly normalizedStatus: string;
  readonly payloadHash?: string;
  readonly payloadRef?: string;
  readonly normalizedPayload?: unknown;
  readonly observedAt: Instant;
  readonly verificationMethod: string;
  readonly providerVersion?: string;
}

export interface ExternalReceiptRecord {
  readonly externalReceiptId: ExternalReceiptId;
  readonly tenantId: TenantId;
  readonly operationId: OperationId;
  readonly provider: string;
  readonly observationKey: string;
  readonly providerReference: string | null;
  readonly normalizedStatus: string;
  readonly payloadHash: string | null;
  readonly payloadRef: string | null;
  readonly normalizedPayload: unknown | null;
  readonly observedAt: Instant;
  readonly verificationMethod: string;
  readonly providerVersion: string | null;
  readonly createdAt: Instant;
}

export interface RecordedExternalReceipt {
  readonly receipt: ExternalReceiptRecord;
  readonly reused: boolean;
}

export interface ReconciliationCaseRecord {
  readonly reconciliationCaseId: ReconciliationCaseId;
  readonly tenantId: TenantId;
  readonly operationId: OperationId;
  readonly status: ReconciliationStatus;
  readonly reasonCode: string;
  readonly safeRetry: boolean;
  readonly nextAction: string | null;
  readonly openedAt: Instant;
  readonly updatedAt: Instant;
  readonly resolvedAt: Instant | null;
}

export interface OpenedReconciliationCase {
  readonly reconciliationCase: ReconciliationCaseRecord;
  readonly reused: boolean;
}

interface ReceiptRow {
  external_receipt_id: ExternalReceiptId;
  tenant_id: TenantId;
  operation_id: OperationId;
  provider: string;
  observation_key: string;
  provider_reference: string | null;
  normalized_status: string;
  payload_hash: string | null;
  payload_ref: string | null;
  normalized_payload: unknown | null;
  observed_at: Date;
  verification_method: string;
  provider_version: string | null;
  created_at: Date;
}

interface ReconciliationRow {
  reconciliation_case_id: ReconciliationCaseId;
  tenant_id: TenantId;
  operation_id: OperationId;
  status: ReconciliationStatus;
  reason_code: string;
  safe_retry: boolean;
  next_action: string | null;
  opened_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
}

function requireNonEmpty(value: string, name: string): void {
  if (!value.trim()) {
    throw new TypeError(`${name} is required`);
  }
}

function toReceipt(row: ReceiptRow): ExternalReceiptRecord {
  return {
    externalReceiptId: row.external_receipt_id,
    tenantId: row.tenant_id,
    operationId: row.operation_id,
    provider: row.provider,
    observationKey: row.observation_key,
    providerReference: row.provider_reference,
    normalizedStatus: row.normalized_status,
    payloadHash: row.payload_hash,
    payloadRef: row.payload_ref,
    normalizedPayload: row.normalized_payload,
    observedAt: row.observed_at.toISOString() as Instant,
    verificationMethod: row.verification_method,
    providerVersion: row.provider_version,
    createdAt: row.created_at.toISOString() as Instant,
  };
}

function toReconciliationCase(row: ReconciliationRow): ReconciliationCaseRecord {
  return {
    reconciliationCaseId: row.reconciliation_case_id,
    tenantId: row.tenant_id,
    operationId: row.operation_id,
    status: row.status,
    reasonCode: row.reason_code,
    safeRetry: row.safe_retry,
    nextAction: row.next_action,
    openedAt: row.opened_at.toISOString() as Instant,
    updatedAt: row.updated_at.toISOString() as Instant,
    resolvedAt:
      row.resolved_at === null
        ? null
        : (row.resolved_at.toISOString() as Instant),
  };
}

async function loadOperationState(
  client: PoolClient,
  tenantId: TenantId,
  operationId: OperationId,
  forUpdate = false,
): Promise<OperationState> {
  const result = await client.query<{ state: OperationState }>(
    `SELECT state
       FROM events.operations
      WHERE tenant_id = $1 AND operation_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, operationId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "operation.not_found",
      category: "not-found",
      message: "Operation does not exist in the requested tenant",
      retryable: false,
      operationId,
    });
  }
  return row.state;
}

async function loadReceiptByObservation(
  client: PoolClient,
  input: Pick<RecordExternalReceiptInput, "tenantId" | "provider" | "observationKey">,
): Promise<ReceiptRow | null> {
  const result = await client.query<ReceiptRow>(
    `SELECT external_receipt_id,
            tenant_id,
            operation_id,
            provider,
            observation_key,
            provider_reference,
            normalized_status,
            payload_hash,
            payload_ref,
            normalized_payload,
            observed_at,
            verification_method,
            provider_version,
            created_at
       FROM events.external_receipts
      WHERE tenant_id = $1
        AND provider = $2
        AND observation_key = $3`,
    [input.tenantId, input.provider, input.observationKey],
  );
  return result.rows[0] ?? null;
}

export async function recordExternalReceipt(
  client: PoolClient,
  input: RecordExternalReceiptInput,
): Promise<RecordedExternalReceipt> {
  requireNonEmpty(input.provider, "provider");
  requireNonEmpty(input.observationKey, "observationKey");
  requireNonEmpty(input.normalizedStatus, "normalizedStatus");
  requireNonEmpty(input.verificationMethod, "verificationMethod");
  await loadOperationState(client, input.tenantId, input.operationId);

  const externalReceiptId = createCanonicalId("external-receipt");
  const inserted = await client.query<ReceiptRow>(
    `INSERT INTO events.external_receipts (
       external_receipt_id,
       operation_id,
       tenant_id,
       provider,
       observation_key,
       provider_reference,
       normalized_status,
       payload_hash,
       payload_ref,
       normalized_payload,
       observed_at,
       verification_method,
       provider_version
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
     ON CONFLICT (tenant_id, provider, observation_key)
     DO NOTHING
     RETURNING external_receipt_id,
               tenant_id,
               operation_id,
               provider,
               observation_key,
               provider_reference,
               normalized_status,
               payload_hash,
               payload_ref,
               observed_at,
               verification_method,
               provider_version,
               created_at`,
    [
      externalReceiptId,
      input.operationId,
      input.tenantId,
      input.provider,
      input.observationKey,
      input.providerReference ?? null,
      input.normalizedStatus,
      input.payloadHash ?? null,
      input.payloadRef ?? null,
      input.normalizedPayload === undefined
        ? null
        : canonicalJson(input.normalizedPayload),
      input.observedAt,
      input.verificationMethod,
      input.providerVersion ?? null,
    ],
  );

  const row =
    inserted.rows[0] ?? (await loadReceiptByObservation(client, input));
  if (!row) {
    throw new PlatformError({
      code: "external-receipt.admission_conflict",
      category: "conflict",
      message: "Could not resolve external receipt after idempotency conflict",
      retryable: true,
      operationId: input.operationId,
    });
  }

  if (
    row.operation_id !== input.operationId ||
    row.provider_reference !== (input.providerReference ?? null) ||
    row.normalized_status !== input.normalizedStatus ||
    row.payload_hash !== (input.payloadHash ?? null) ||
    canonicalJson(row.normalized_payload) !==
      canonicalJson(input.normalizedPayload ?? null) ||
    row.verification_method !== input.verificationMethod ||
    row.provider_version !== (input.providerVersion ?? null)
  ) {
    throw new PlatformError({
      code: "external-receipt.observation_conflict",
      category: "conflict",
      message: "External receipt observation key is bound to different evidence",
      retryable: false,
      operationId: input.operationId,
      details: { provider: input.provider, observationKey: input.observationKey },
    });
  }

  return {
    receipt: toReceipt(row),
    reused: inserted.rowCount === 0,
  };
}

export async function listExternalReceiptsForOperation(
  client: PoolClient,
  tenantId: TenantId,
  operationId: OperationId,
): Promise<readonly ExternalReceiptRecord[]> {
  await loadOperationState(client, tenantId, operationId);
  const result = await client.query<ReceiptRow>(
    `SELECT external_receipt_id,
            tenant_id,
            operation_id,
            provider,
            observation_key,
            provider_reference,
            normalized_status,
            payload_hash,
            payload_ref,
            normalized_payload,
            observed_at,
            verification_method,
            provider_version,
            created_at
       FROM events.external_receipts
      WHERE tenant_id = $1 AND operation_id = $2
      ORDER BY observed_at, created_at, external_receipt_id`,
    [tenantId, operationId],
  );
  return Object.freeze(result.rows.map(toReceipt));
}

async function loadActiveReconciliationCase(
  client: PoolClient,
  tenantId: TenantId,
  operationId: OperationId,
): Promise<ReconciliationRow | null> {
  const result = await client.query<ReconciliationRow>(
    `SELECT reconciliation_case_id,
            tenant_id,
            operation_id,
            status,
            reason_code,
            safe_retry,
            next_action,
            opened_at,
            updated_at,
            resolved_at
       FROM events.reconciliation_cases
      WHERE tenant_id = $1
        AND operation_id = $2
        AND status IN ('open', 'checking', 'needs-attention')`,
    [tenantId, operationId],
  );
  return result.rows[0] ?? null;
}

export async function openReconciliationCase(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly operationId: OperationId;
    readonly reasonCode: string;
    readonly safeRetry: boolean;
    readonly nextAction: string | null;
  },
): Promise<OpenedReconciliationCase> {
  requireNonEmpty(input.reasonCode, "reasonCode");
  const state = await loadOperationState(client, input.tenantId, input.operationId);
  if (state !== "partial" && state !== "unknown" && state !== "reconciling") {
    throw new PlatformError({
      code: "reconciliation.operation_not_ambiguous",
      category: "conflict",
      message: "Operation is not in a state that requires reconciliation",
      retryable: false,
      operationId: input.operationId,
      details: { state },
    });
  }

  const reconciliationCaseId = createCanonicalId("reconciliation-case");
  const inserted = await client.query<ReconciliationRow>(
    `INSERT INTO events.reconciliation_cases (
       reconciliation_case_id,
       operation_id,
       tenant_id,
       status,
       reason_code,
       safe_retry,
       next_action
     )
     VALUES ($1, $2, $3, 'open', $4, $5, $6)
     ON CONFLICT (operation_id)
       WHERE status IN ('open', 'checking', 'needs-attention')
     DO NOTHING
     RETURNING reconciliation_case_id,
               tenant_id,
               operation_id,
               status,
               reason_code,
               safe_retry,
               next_action,
               opened_at,
               updated_at,
               resolved_at`,
    [
      reconciliationCaseId,
      input.operationId,
      input.tenantId,
      input.reasonCode,
      input.safeRetry,
      input.nextAction,
    ],
  );

  const row =
    inserted.rows[0] ??
    (await loadActiveReconciliationCase(
      client,
      input.tenantId,
      input.operationId,
    ));
  if (!row) {
    throw new PlatformError({
      code: "reconciliation.open_conflict",
      category: "conflict",
      message: "Could not resolve active reconciliation case",
      retryable: true,
      operationId: input.operationId,
    });
  }

  return {
    reconciliationCase: toReconciliationCase(row),
    reused: inserted.rowCount === 0,
  };
}

export async function beginReconciliation(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly operationId: OperationId;
    readonly reasonCode: string;
    readonly safeRetry: boolean;
    readonly nextAction: string | null;
  },
): Promise<OpenedReconciliationCase> {
  return withTransaction(pool, async (client) => {
    const state = await loadOperationState(
      client,
      input.tenantId,
      input.operationId,
      true,
    );
    if (state === "partial" || state === "unknown") {
      await transitionOperation(client, {
        operationId: input.operationId,
        from: state,
        to: "reconciling",
      });
    } else if (state !== "reconciling") {
      throw new PlatformError({
        code: "reconciliation.operation_not_ambiguous",
        category: "conflict",
        message: "Operation is not in a state that requires reconciliation",
        retryable: false,
        operationId: input.operationId,
        details: { state },
      });
    }

    return openReconciliationCase(client, input);
  });
}

export async function transitionReconciliationCase(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly reconciliationCaseId: ReconciliationCaseId;
    readonly from: ReconciliationStatus;
    readonly to: ReconciliationStatus;
    readonly safeRetry: boolean;
    readonly nextAction: string | null;
  },
): Promise<ReconciliationCaseRecord> {
  assertReconciliationTransition(input.from, input.to);

  const result = await client.query<ReconciliationRow>(
    `UPDATE events.reconciliation_cases
        SET status = $4,
            safe_retry = $5,
            next_action = $6,
            resolved_at = CASE
              WHEN $4 = 'resolved' THEN clock_timestamp()
              ELSE NULL
            END,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND reconciliation_case_id = $2
        AND status = $3
      RETURNING reconciliation_case_id,
                tenant_id,
                operation_id,
                status,
                reason_code,
                safe_retry,
                next_action,
                opened_at,
                updated_at,
                resolved_at`,
    [
      input.tenantId,
      input.reconciliationCaseId,
      input.from,
      input.to,
      input.safeRetry,
      input.nextAction,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "reconciliation.stale_transition",
      category: "conflict",
      message: "Reconciliation case state changed before transition",
      retryable: false,
    });
  }
  return toReconciliationCase(row);
}
