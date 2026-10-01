import type {
  CorrelationId,
  EventId,
  Instant,
  OutboxEventId,
  TenantId,
} from "@masanawa/contracts";

export const outboxStates = [
  "pending",
  "claimed",
  "dispatched",
  "acknowledged",
  "retry-scheduled",
  "unknown",
  "dead-letter",
] as const;

export type OutboxState = (typeof outboxStates)[number];

export interface OutboxRecord<TPayload = unknown> {
  readonly outboxEventId: OutboxEventId;
  readonly tenantId: TenantId;
  readonly eventId: EventId;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly correlationId: CorrelationId;
  readonly causationId: EventId | null;
  readonly destination: string;
  readonly state: OutboxState;
  readonly attempt: number;
  readonly fence: number;
  readonly availableAt: Instant;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly payload: TPayload;
  readonly terminalReceiptRef?: string;
  readonly safeErrorCode?: string;
}
