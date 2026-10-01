import {
  PlatformError,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

export interface AdmitInboxEventInput {
  readonly tenantId: TenantId;
  readonly namespace: string;
  readonly eventId: string;
  readonly provider: string;
  readonly accountRef: string;
  readonly payloadHash: string;
  readonly payloadRef?: string;
  readonly tombstoneUntil: Instant;
}

export interface InboxAdmission {
  readonly tenantId: TenantId;
  readonly namespace: string;
  readonly eventId: string;
  readonly provider: string;
  readonly accountRef: string;
  readonly payloadHash: string;
  readonly payloadRef: string | null;
  readonly state: "admitted" | "processing" | "completed" | "failed" | "dead-letter";
  readonly attempt: number;
  readonly fence: number;
  readonly receivedAt: Instant;
  readonly tombstoneUntil: Instant;
  readonly reused: boolean;
}

export interface ClaimedInboxEvent {
  readonly tenantId: TenantId;
  readonly namespace: string;
  readonly eventId: string;
  readonly provider: string;
  readonly accountRef: string;
  readonly payloadHash: string;
  readonly payloadRef: string | null;
  readonly state: "processing";
  readonly attempt: number;
  readonly fence: number;
  readonly receivedAt: Instant;
  readonly tombstoneUntil: Instant;
}

interface InboxRow {
  tenant_id: TenantId;
  namespace: string;
  event_id: string;
  provider: string;
  account_ref: string;
  payload_hash: string;
  payload_ref: string | null;
  state: InboxAdmission["state"];
  attempt: number;
  fence: string;
  received_at: Date;
  tombstone_until: Date;
}

function requireNonEmpty(value: string, name: string): void {
  if (!value.trim()) {
    throw new TypeError(`${name} is required`);
  }
}

function toAdmission(row: InboxRow, reused: boolean): InboxAdmission {
  return {
    tenantId: row.tenant_id,
    namespace: row.namespace,
    eventId: row.event_id,
    provider: row.provider,
    accountRef: row.account_ref,
    payloadHash: row.payload_hash,
    payloadRef: row.payload_ref,
    state: row.state,
    attempt: row.attempt,
    fence: Number(row.fence),
    receivedAt: row.received_at.toISOString() as Instant,
    tombstoneUntil: row.tombstone_until.toISOString() as Instant,
    reused,
  };
}

async function loadInboxAdmission(
  client: PoolClient,
  input: Pick<AdmitInboxEventInput, "tenantId" | "namespace" | "eventId">,
): Promise<InboxRow | null> {
  const result = await client.query<InboxRow>(
    `SELECT tenant_id,
            namespace,
            event_id,
            provider,
            account_ref,
            payload_hash,
            payload_ref,
            state,
            attempt,
            fence::text,
            received_at,
            tombstone_until
       FROM events.inbox
      WHERE tenant_id = $1
        AND namespace = $2
        AND event_id = $3`,
    [input.tenantId, input.namespace, input.eventId],
  );
  return result.rows[0] ?? null;
}

export async function admitInboxEvent(
  client: PoolClient,
  input: AdmitInboxEventInput,
): Promise<InboxAdmission> {
  requireNonEmpty(input.namespace, "namespace");
  requireNonEmpty(input.eventId, "eventId");
  requireNonEmpty(input.provider, "provider");
  requireNonEmpty(input.accountRef, "accountRef");
  requireNonEmpty(input.payloadHash, "payloadHash");

  const inserted = await client.query<InboxRow>(
    `INSERT INTO events.inbox (
       namespace,
       event_id,
       tenant_id,
       provider,
       account_ref,
       payload_hash,
       payload_ref,
       state,
       tombstone_until
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'admitted', $8)
     ON CONFLICT (tenant_id, namespace, event_id)
     DO NOTHING
     RETURNING tenant_id,
               namespace,
               event_id,
               provider,
               account_ref,
               payload_hash,
               payload_ref,
               state,
               attempt,
               fence::text,
               received_at,
               tombstone_until`,
    [
      input.namespace,
      input.eventId,
      input.tenantId,
      input.provider,
      input.accountRef,
      input.payloadHash,
      input.payloadRef ?? null,
      input.tombstoneUntil,
    ],
  );

  const row =
    inserted.rows[0] ??
    (await loadInboxAdmission(client, {
      tenantId: input.tenantId,
      namespace: input.namespace,
      eventId: input.eventId,
    }));

  if (!row) {
    throw new PlatformError({
      code: "inbox.admission_conflict",
      category: "conflict",
      message: "Could not resolve inbox admission after a uniqueness conflict",
      retryable: false,
    });
  }

  if (
    row.tenant_id !== input.tenantId ||
    row.provider !== input.provider ||
    row.account_ref !== input.accountRef ||
    row.payload_hash !== input.payloadHash
  ) {
    throw new PlatformError({
      code: "inbox.payload_conflict",
      category: "conflict",
      message: "Inbox event identity is already bound to different admission evidence",
      retryable: false,
      details: {
        namespace: input.namespace,
        eventId: input.eventId,
      },
    });
  }

  return toAdmission(row, inserted.rowCount === 0);
}

export async function claimInboxBatch(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly namespace: string;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  },
): Promise<readonly ClaimedInboxEvent[]> {
  requireNonEmpty(input.namespace, "namespace");
  requireNonEmpty(input.workerId, "workerId");
  if (!Number.isInteger(input.limit) || input.limit <= 0 || input.limit > 500) {
    throw new RangeError("limit must be an integer between 1 and 500");
  }
  if (!Number.isInteger(input.leaseMs) || input.leaseMs <= 0) {
    throw new RangeError("leaseMs must be a positive integer");
  }

  return withTransaction(pool, async (client) => {
    const result = await client.query<InboxRow>(
      `WITH candidates AS (
         SELECT tenant_id, namespace, event_id
           FROM events.inbox
          WHERE tenant_id = $1
            AND namespace = $2
            AND (
              state IN ('admitted', 'failed')
              OR (
                state = 'processing'
                AND lease_expires_at <= clock_timestamp()
              )
            )
          ORDER BY received_at, event_id
          FOR UPDATE SKIP LOCKED
          LIMIT $3
       )
       UPDATE events.inbox AS i
          SET state = 'processing',
              attempt = i.attempt + 1,
              fence = i.fence + 1,
              lease_owner = $4,
              lease_expires_at =
                clock_timestamp() + ($5::bigint * interval '1 millisecond'),
              safe_error_code = NULL,
              updated_at = clock_timestamp()
         FROM candidates
        WHERE i.tenant_id = candidates.tenant_id
          AND i.namespace = candidates.namespace
          AND i.event_id = candidates.event_id
       RETURNING i.tenant_id,
                 i.namespace,
                 i.event_id,
                 i.provider,
                 i.account_ref,
                 i.payload_hash,
                 i.payload_ref,
                 i.state,
                 i.attempt,
                 i.fence::text,
                 i.received_at,
                 i.tombstone_until`,
      [
        input.tenantId,
        input.namespace,
        input.limit,
        input.workerId,
        input.leaseMs,
      ],
    );

    return Object.freeze(
      result.rows.map((row) => ({
        tenantId: row.tenant_id,
        namespace: row.namespace,
        eventId: row.event_id,
        provider: row.provider,
        accountRef: row.account_ref,
        payloadHash: row.payload_hash,
        payloadRef: row.payload_ref,
        state: "processing" as const,
        attempt: row.attempt,
        fence: Number(row.fence),
        receivedAt: row.received_at.toISOString() as Instant,
        tombstoneUntil: row.tombstone_until.toISOString() as Instant,
      })),
    );
  });
}

export async function renewInboxClaim(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly namespace: string;
    readonly eventId: string;
    readonly workerId: string;
    readonly fence: number;
    readonly leaseMs: number;
  },
): Promise<void> {
  if (!Number.isInteger(input.leaseMs) || input.leaseMs <= 0) {
    throw new RangeError("leaseMs must be a positive integer");
  }

  const result = await client.query(
    `UPDATE events.inbox
        SET lease_expires_at =
              clock_timestamp() + ($6::bigint * interval '1 millisecond'),
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND namespace = $2
        AND event_id = $3
        AND state = 'processing'
        AND lease_owner = $4
        AND fence = $5
        AND lease_expires_at > clock_timestamp()`,
    [
      input.tenantId,
      input.namespace,
      input.eventId,
      input.workerId,
      input.fence,
      input.leaseMs,
    ],
  );

  if (result.rowCount !== 1) {
    throw new PlatformError({
      code: "inbox.stale_claim",
      category: "conflict",
      message: "Inbox claim is no longer current",
      retryable: false,
    });
  }
}

export async function settleInboxClaim(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly namespace: string;
    readonly eventId: string;
    readonly workerId: string;
    readonly fence: number;
    readonly state: "completed" | "failed" | "dead-letter";
    readonly safeErrorCode?: string;
  },
): Promise<void> {
  const result = await client.query(
    `UPDATE events.inbox
        SET state = $6,
            lease_owner = NULL,
            lease_expires_at = NULL,
            completed_at = CASE
              WHEN $6 = 'completed' THEN clock_timestamp()
              ELSE NULL
            END,
            safe_error_code = CASE
              WHEN $6 = 'completed' THEN NULL
              ELSE $7
            END,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND namespace = $2
        AND event_id = $3
        AND state = 'processing'
        AND lease_owner = $4
        AND fence = $5
        AND lease_expires_at > clock_timestamp()`,
    [
      input.tenantId,
      input.namespace,
      input.eventId,
      input.workerId,
      input.fence,
      input.state,
      input.safeErrorCode ?? null,
    ],
  );

  if (result.rowCount !== 1) {
    throw new PlatformError({
      code: "inbox.stale_claim",
      category: "conflict",
      message: "Inbox claim is no longer current",
      retryable: false,
    });
  }
}
