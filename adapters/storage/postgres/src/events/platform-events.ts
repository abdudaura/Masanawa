import type { Instant, OutboxEventId } from "@masanawa/contracts";
import type { AuditEvent, PlatformEvent } from "@masanawa/events";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";
import { enqueueOutbox } from "./outbox.js";

export interface EventOutboxInput<TOutboxPayload> {
  readonly destination: string;
  readonly availableAt: Instant;
  readonly payload: TOutboxPayload;
}

export interface PlatformEventWithOutboxInput<
  TEventPayload,
  TOutboxPayload = TEventPayload,
> {
  readonly event: PlatformEvent<TEventPayload>;
  readonly outbox: EventOutboxInput<TOutboxPayload>;
}

export async function appendAuditEvent<TPayload>(
  client: PoolClient,
  event: AuditEvent<TPayload>,
): Promise<void> {
  await client.query(
    `INSERT INTO events.audit_events (
       audit_event_id,
       tenant_id,
       event_type,
       schema_version,
       aggregate_type,
       aggregate_id,
       occurred_at,
       recorded_at,
       actor,
       authority_ref,
       correlation_id,
       causation_event_id,
       sensitivity,
       payload
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9::jsonb, $10, $11, $12, $13, $14::jsonb
     )`,
    [
      event.auditEventId,
      event.tenantId,
      event.eventType,
      event.schemaVersion,
      event.aggregate.type,
      event.aggregate.id,
      event.occurredAt,
      event.recordedAt,
      event.actor === null ? null : JSON.stringify(event.actor),
      event.authorityRef,
      event.correlationId,
      event.causationId,
      event.sensitivity,
      JSON.stringify(event.payload),
    ],
  );
}

export async function appendPlatformEvent<TPayload>(
  client: PoolClient,
  event: PlatformEvent<TPayload>,
): Promise<void> {
  await client.query(
    `INSERT INTO events.platform_events (
       event_id,
       tenant_id,
       event_type,
       schema_version,
       aggregate_type,
       aggregate_id,
       aggregate_revision,
       occurred_at,
       recorded_at,
       actor,
       authority_ref,
       correlation_id,
       causation_id,
       request_id,
       workflow_run_id,
       character_session_id,
       provenance,
       sensitivity,
       payload
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10::jsonb, $11, $12, $13, $14, $15, $16,
       $17::jsonb, $18, $19::jsonb
     )`,
    [
      event.eventId,
      event.tenantId,
      event.eventType,
      event.schemaVersion,
      event.aggregate.type,
      event.aggregate.id,
      event.aggregate.revision ?? null,
      event.occurredAt,
      event.recordedAt,
      event.actor === null ? null : JSON.stringify(event.actor),
      event.authorityRef,
      event.correlationId,
      event.causationId,
      event.requestId,
      event.workflowRunId,
      event.characterSessionId,
      JSON.stringify(event.provenance),
      event.sensitivity,
      JSON.stringify(event.payload),
    ],
  );
}

export async function appendPlatformEventWithOutbox<
  TEventPayload,
  TOutboxPayload = TEventPayload,
>(
  client: PoolClient,
  input: PlatformEventWithOutboxInput<TEventPayload, TOutboxPayload>,
): Promise<OutboxEventId> {
  await appendPlatformEvent(client, input.event);

  return enqueueOutbox(client, {
    tenantId: input.event.tenantId,
    eventId: input.event.eventId,
    eventType: input.event.eventType,
    schemaVersion: input.event.schemaVersion,
    aggregateType: input.event.aggregate.type,
    aggregateId: input.event.aggregate.id,
    correlationId: input.event.correlationId,
    causationId: input.event.causationId,
    destination: input.outbox.destination,
    availableAt: input.outbox.availableAt,
    payload: input.outbox.payload,
  });
}

export async function persistPlatformEventWithOutbox<
  TEventPayload,
  TOutboxPayload = TEventPayload,
>(
  pool: Pool,
  input: PlatformEventWithOutboxInput<TEventPayload, TOutboxPayload>,
): Promise<OutboxEventId> {
  return withTransaction(pool, (client) =>
    appendPlatformEventWithOutbox(client, input),
  );
}
