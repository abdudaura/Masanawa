import {
  PlatformError,
  createCanonicalId,
  type CorrelationId,
  type EventId,
  type Instant,
  type OutboxEventId,
  type TenantId,
} from "@masanawa/contracts";
import type { OutboxState } from "@masanawa/events";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

export interface EnqueueOutboxInput<TPayload> {
  readonly tenantId: TenantId;
  readonly eventId: EventId;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly correlationId: CorrelationId;
  readonly causationId: EventId | null;
  readonly destination: string;
  readonly availableAt: Instant;
  readonly payload: TPayload;
}

export interface ClaimedOutboxRecord<TPayload = unknown> {
  readonly outboxEventId: OutboxEventId;
  readonly tenantId: TenantId;
  readonly eventId: EventId;
  readonly eventType: string;
  readonly destination: string;
  readonly state: "claimed";
  readonly attempt: number;
  readonly fence: number;
  readonly payload: TPayload;
}

interface ClaimedRow<TPayload> {
  outbox_event_id: OutboxEventId;
  tenant_id: TenantId;
  event_id: EventId;
  event_type: string;
  destination: string;
  state: "claimed";
  attempt: number;
  fence: string;
  payload: TPayload;
}

export async function enqueueOutbox<TPayload>(
  client: PoolClient,
  input: EnqueueOutboxInput<TPayload>,
): Promise<OutboxEventId> {
  if (!input.destination.trim()) {
    throw new TypeError("outbox destination is required");
  }

  const outboxEventId = createCanonicalId("outbox-event");
  await client.query(
    `INSERT INTO events.outbox (
       outbox_event_id,
       tenant_id,
       event_id,
       event_type,
       schema_version,
       aggregate_type,
       aggregate_id,
       correlation_id,
       causation_id,
       destination,
       available_at,
       payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
    [
      outboxEventId,
      input.tenantId,
      input.eventId,
      input.eventType,
      input.schemaVersion,
      input.aggregateType,
      input.aggregateId,
      input.correlationId,
      input.causationId,
      input.destination,
      input.availableAt,
      JSON.stringify(input.payload),
    ],
  );
  return outboxEventId;
}

export async function claimOutboxBatch(
  pool: Pool,
  input: {
    readonly workerId: string;
    readonly destination: string;
    readonly limit: number;
    readonly leaseMs: number;
  },
): Promise<readonly ClaimedOutboxRecord[]> {
  if (!input.workerId.trim()) {
    throw new TypeError("workerId is required");
  }
  if (!Number.isInteger(input.limit) || input.limit <= 0 || input.limit > 500) {
    throw new RangeError("limit must be an integer between 1 and 500");
  }
  if (!Number.isInteger(input.leaseMs) || input.leaseMs <= 0) {
    throw new RangeError("leaseMs must be a positive integer");
  }

  return withTransaction(pool, async (client) => {
    const result = await client.query<ClaimedRow<unknown>>(
      `WITH candidates AS (
         SELECT outbox_event_id
           FROM events.outbox
          WHERE destination = $1
            AND (
              (
                state IN ('pending', 'retry-scheduled')
                AND available_at <= clock_timestamp()
              )
              OR (
                state = 'claimed'
                AND lease_expires_at <= clock_timestamp()
              )
            )
          ORDER BY available_at, created_at, outbox_event_id
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE events.outbox AS o
          SET state = 'claimed',
              attempt = o.attempt + 1,
              fence = o.fence + 1,
              lease_owner = $3,
              lease_expires_at = clock_timestamp() + ($4::bigint * interval '1 millisecond'),
              updated_at = clock_timestamp()
         FROM candidates
        WHERE o.outbox_event_id = candidates.outbox_event_id
       RETURNING o.outbox_event_id,
                 o.tenant_id,
                 o.event_id,
                 o.event_type,
                 o.destination,
                 o.state,
                 o.attempt,
                 o.fence::text,
                 o.payload`,
      [input.destination, input.limit, input.workerId, input.leaseMs],
    );

    return Object.freeze(
      result.rows.map((row) => ({
        outboxEventId: row.outbox_event_id,
        tenantId: row.tenant_id,
        eventId: row.event_id,
        eventType: row.event_type,
        destination: row.destination,
        state: "claimed" as const,
        attempt: row.attempt,
        fence: Number(row.fence),
        payload: row.payload,
      })),
    );
  });
}

export async function renewOutboxClaim(
  client: PoolClient,
  input: {
    readonly outboxEventId: OutboxEventId;
    readonly workerId: string;
    readonly fence: number;
    readonly leaseMs: number;
  },
): Promise<void> {
  if (!input.workerId.trim()) {
    throw new TypeError("workerId is required");
  }
  if (!Number.isInteger(input.leaseMs) || input.leaseMs <= 0) {
    throw new RangeError("leaseMs must be a positive integer");
  }

  const result = await client.query(
    `UPDATE events.outbox
        SET lease_expires_at =
              clock_timestamp() + ($4::bigint * interval '1 millisecond'),
            updated_at = clock_timestamp()
      WHERE outbox_event_id = $1
        AND state = 'claimed'
        AND lease_owner = $2
        AND fence = $3
        AND lease_expires_at > clock_timestamp()`,
    [
      input.outboxEventId,
      input.workerId,
      input.fence,
      input.leaseMs,
    ],
  );

  if (result.rowCount !== 1) {
    throw new PlatformError({
      code: "outbox.stale_claim",
      category: "conflict",
      message: "Outbox claim is no longer current",
      retryable: false,
    });
  }
}

export async function settleOutboxClaim(
  client: PoolClient,
  input: {
    readonly outboxEventId: OutboxEventId;
    readonly workerId: string;
    readonly fence: number;
    readonly state: Extract<
      OutboxState,
      "acknowledged" | "retry-scheduled" | "unknown" | "dead-letter"
    >;
    readonly terminalReceiptRef?: string;
    readonly safeErrorCode?: string;
    readonly availableAt?: Instant;
  },
): Promise<void> {
  const result = await client.query(
    `UPDATE events.outbox
        SET state = $4,
            lease_owner = NULL,
            lease_expires_at = NULL,
            terminal_receipt_ref = $5,
            safe_error_code = $6,
            available_at = COALESCE($7::timestamptz, available_at),
            updated_at = clock_timestamp()
      WHERE outbox_event_id = $1
        AND state = 'claimed'
        AND lease_owner = $2
        AND fence = $3
        AND lease_expires_at > clock_timestamp()`,
    [
      input.outboxEventId,
      input.workerId,
      input.fence,
      input.state,
      input.terminalReceiptRef ?? null,
      input.safeErrorCode ?? null,
      input.availableAt ?? null,
    ],
  );

  if (result.rowCount !== 1) {
    throw new PlatformError({
      code: "outbox.stale_claim",
      category: "conflict",
      message: "Outbox claim is no longer current",
      retryable: false,
    });
  }
}
