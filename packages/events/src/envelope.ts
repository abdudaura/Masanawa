import type {
  ActorRef,
  AuditEventId,
  CorrelationId,
  EventId,
  Instant,
  RequestId,
  TenantId,
  WorkflowRunId,
  CharacterSessionId,
} from "@masanawa/contracts";

export const eventSensitivities = [
  "public",
  "internal",
  "private",
  "sensitive",
  "restricted",
] as const;

export type EventSensitivity = (typeof eventSensitivities)[number];

export interface AggregateRef {
  readonly type: string;
  readonly id: string;
  readonly revision?: number;
}

export interface EventProvenance {
  readonly source: string;
  readonly externalRef?: string;
  readonly evidenceIds?: readonly string[];
}

export interface PlatformEvent<TPayload = unknown> {
  readonly eventId: EventId;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly tenantId: TenantId;
  readonly aggregate: AggregateRef;
  readonly occurredAt: Instant;
  readonly recordedAt: Instant;
  readonly actor: ActorRef | null;
  readonly authorityRef: string | null;
  readonly correlationId: CorrelationId;
  readonly causationId: EventId | null;
  readonly requestId: RequestId | null;
  readonly workflowRunId: WorkflowRunId | null;
  readonly characterSessionId: CharacterSessionId | null;
  readonly provenance: EventProvenance;
  readonly sensitivity: EventSensitivity;
  readonly payload: TPayload;
}

export interface AuditEvent<TPayload = unknown>
  extends Omit<PlatformEvent<TPayload>, "eventId"> {
  readonly auditEventId: AuditEventId;
}
