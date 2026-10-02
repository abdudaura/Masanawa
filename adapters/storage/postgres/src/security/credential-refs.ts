import {
  PlatformError,
  createCanonicalId,
  nowInstant,
  type CredentialRefId,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";
import type {
  CredentialAccessAuditRecord,
  CredentialAccessAuditSink,
  CredentialRefRecord,
  CredentialRefRepository,
} from "@masanawa/security";
import { normalizeCredentialRefRecord } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { appendAuditEvent } from "../events/platform-events.js";
import { withTransaction } from "../transaction.js";

interface CredentialRefRow {
  credential_ref_id: CredentialRefId;
  tenant_id: TenantId;
  provider_id: CredentialRefRecord["providerId"];
  slot_key: string;
  purpose: string;
  destination_key: string;
  vault_locator: string;
  generation: number;
  state: CredentialRefRecord["state"];
  created_at: Date;
  revoked_at: Date | null;
}

function toRecord(row: CredentialRefRow): CredentialRefRecord {
  return normalizeCredentialRefRecord({
    credentialRefId: row.credential_ref_id,
    tenantId: row.tenant_id,
    providerId: row.provider_id,
    slotKey: row.slot_key,
    purpose: row.purpose,
    destinationKey: row.destination_key,
    vaultLocator: row.vault_locator,
    generation: row.generation,
    state: row.state,
    createdAt: row.created_at.toISOString() as Instant,
    revokedAt:
      row.revoked_at === null
        ? null
        : (row.revoked_at.toISOString() as Instant),
  });
}

export async function loadCredentialRef(
  client: PoolClient,
  tenantId: TenantId,
  credentialRefId: CredentialRefId,
): Promise<CredentialRefRecord | null> {
  const result = await client.query<CredentialRefRow>(
    `SELECT credential_ref_id,
            tenant_id,
            provider_id,
            slot_key,
            purpose,
            destination_key,
            vault_locator,
            generation,
            state,
            created_at,
            revoked_at
       FROM security.credential_refs
      WHERE tenant_id = $1
        AND credential_ref_id = $2`,
    [tenantId, credentialRefId],
  );
  const row = result.rows[0];
  return row ? toRecord(row) : null;
}

function sameBinding(
  left: CredentialRefRecord,
  right: CredentialRefRecord,
): boolean {
  return (
    left.credentialRefId === right.credentialRefId &&
    left.tenantId === right.tenantId &&
    left.providerId === right.providerId &&
    left.slotKey === right.slotKey &&
    left.purpose === right.purpose &&
    left.destinationKey === right.destinationKey &&
    left.vaultLocator === right.vaultLocator &&
    left.generation === right.generation &&
    left.state === right.state &&
    left.createdAt === right.createdAt &&
    left.revokedAt === right.revokedAt
  );
}

export async function createCredentialRef(
  client: PoolClient,
  input: CredentialRefRecord,
): Promise<{
  readonly record: CredentialRefRecord;
  readonly reused: boolean;
}> {
  const record = normalizeCredentialRefRecord(input);
  const inserted = await client.query<CredentialRefRow>(
    `INSERT INTO security.credential_refs (
       credential_ref_id,
       tenant_id,
       provider_id,
       slot_key,
       purpose,
       destination_key,
       vault_locator,
       generation,
       state,
       created_at,
       revoked_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (credential_ref_id)
     DO NOTHING
     RETURNING credential_ref_id,
               tenant_id,
               provider_id,
               slot_key,
               purpose,
               destination_key,
               vault_locator,
               generation,
               state,
               created_at,
               revoked_at`,
    [
      record.credentialRefId,
      record.tenantId,
      record.providerId,
      record.slotKey,
      record.purpose,
      record.destinationKey,
      record.vaultLocator,
      record.generation,
      record.state,
      record.createdAt,
      record.revokedAt,
    ],
  );

  const admitted =
    inserted.rows[0] ??
    (
      await client.query<CredentialRefRow>(
        `SELECT credential_ref_id,
                tenant_id,
                provider_id,
                slot_key,
                purpose,
                destination_key,
                vault_locator,
                generation,
                state,
                created_at,
                revoked_at
           FROM security.credential_refs
          WHERE credential_ref_id = $1`,
        [record.credentialRefId],
      )
    ).rows[0];

  if (!admitted) {
    throw new PlatformError({
      code: "credential-ref.admission_conflict",
      category: "conflict",
      message: "Credential reference could not be resolved after conflict",
      retryable: true,
    });
  }

  const existing = toRecord(admitted);
  if (!sameBinding(existing, record)) {
    throw new PlatformError({
      code: "credential-ref.identity_conflict",
      category: "conflict",
      message: "CredentialRefId is already bound to different metadata",
      retryable: false,
    });
  }

  return Object.freeze({
    record: existing,
    reused: inserted.rowCount === 0,
  });
}

export async function revokeCredentialRef(
  client: PoolClient,
  tenantId: TenantId,
  credentialRefId: CredentialRefId,
  revokedAt: Instant,
): Promise<CredentialRefRecord> {
  const result = await client.query<CredentialRefRow>(
    `UPDATE security.credential_refs
        SET state = 'revoked',
            revoked_at = $3,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND credential_ref_id = $2
        AND state = 'active'
      RETURNING credential_ref_id,
                tenant_id,
                provider_id,
                slot_key,
                purpose,
                destination_key,
                vault_locator,
                generation,
                state,
                created_at,
                revoked_at`,
    [tenantId, credentialRefId, revokedAt],
  );
  if (result.rows[0]) {
    return toRecord(result.rows[0]);
  }

  const existing = await loadCredentialRef(
    client,
    tenantId,
    credentialRefId,
  );
  if (existing === null) {
    throw new PlatformError({
      code: "credential-ref.not_found",
      category: "not-found",
      message: "Credential reference does not exist",
      retryable: false,
    });
  }
  if (existing.state === "revoked") {
    return existing;
  }

  throw new PlatformError({
    code: "credential-ref.revoke_conflict",
    category: "conflict",
    message: "Credential reference could not be revoked",
    retryable: false,
  });
}

export function createPostgresCredentialRefRepository(
  pool: Pool,
): CredentialRefRepository {
  return Object.freeze({
    load(tenantId, credentialRefId) {
      return withTransaction(pool, (client) =>
        loadCredentialRef(client, tenantId, credentialRefId),
      );
    },
    create(record) {
      return withTransaction(pool, (client) =>
        createCredentialRef(client, record),
      );
    },
    revoke(tenantId, credentialRefId, revokedAt) {
      return withTransaction(pool, (client) =>
        revokeCredentialRef(
          client,
          tenantId,
          credentialRefId,
          revokedAt,
        ),
      );
    },
  });
}

export function createPostgresCredentialAccessAuditSink(
  pool: Pool,
): CredentialAccessAuditSink {
  return Object.freeze({
    record(entry: CredentialAccessAuditRecord): Promise<void> {
      const at = nowInstant();
      return withTransaction(pool, (client) =>
        appendAuditEvent(client, {
          auditEventId: createCanonicalId("audit-event"),
          eventType: "security.credential.access",
          schemaVersion: 1,
          tenantId: entry.tenantId,
          aggregate: {
            type: "credential-ref",
            id: entry.credentialRefId,
          },
          occurredAt: at,
          recordedAt: at,
          actor: null,
          authorityRef: entry.authorityContextId,
          correlationId: entry.correlationId,
          causationId: null,
          requestId: null,
          workflowRunId: null,
          characterSessionId: null,
          provenance: {
            source: "security.credential-resolution",
          },
          sensitivity: "restricted",
          payload: {
            credentialRefId: entry.credentialRefId,
            providerId: entry.providerId,
            slotKey: entry.slotKey,
            purpose: entry.purpose,
            destinationKey: entry.destinationKey,
            operationId: entry.operationId,
            principalKey: entry.principalKey,
            outcome: entry.outcome,
            reasonCode: entry.reasonCode,
          },
        }),
      );
    },
  });
}
