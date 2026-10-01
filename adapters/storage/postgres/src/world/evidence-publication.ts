import {
  createCanonicalId,
  type EventId,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";
import type { EventSensitivity, PlatformEvent } from "@masanawa/events";
import {
  worldEvidenceMemoryDestination,
  worldEvidenceRecordedEventType,
  worldEvidenceRecordedSchemaVersion,
  worldEvidenceWorkflowDestination,
  worldEventRecordedEvidence,
  worldInteractionRecordedEvidence,
  type WorldEvent,
  type WorldEventVisibility,
  type WorldInteraction,
  type WorldEvidenceRecordedPayload,
} from "@masanawa/world";
import type { PoolClient } from "pg";
import { enqueueOutbox } from "../events/outbox.js";
import { appendPlatformEvent } from "../events/platform-events.js";

type PublishableWorldEvidence = WorldEvent | WorldInteraction;

function evidenceKind(
  evidence: PublishableWorldEvidence,
): "event" | "interaction" {
  return "worldEventId" in evidence ? "event" : "interaction";
}

function evidenceId(evidence: PublishableWorldEvidence): string {
  return "worldEventId" in evidence
    ? evidence.worldEventId
    : evidence.worldInteractionId;
}

function visibilitySensitivity(
  visibility: WorldEventVisibility,
): EventSensitivity {
  if (visibility === "public") return "public";
  if (visibility === "private") return "private";
  return "internal";
}

function recordedPayload(
  evidence: PublishableWorldEvidence,
): WorldEvidenceRecordedPayload {
  return "worldEventId" in evidence
    ? worldEventRecordedEvidence(evidence)
    : worldInteractionRecordedEvidence(evidence);
}

interface PublicationReceiptRow {
  event_id: EventId;
}

export async function publishWorldEvidenceRecorded(
  client: PoolClient,
  evidence: PublishableWorldEvidence,
): Promise<EventId | null> {
  const kind = evidenceKind(evidence);
  const id = evidenceId(evidence);
  const eventId = createCanonicalId("event");
  const correlationId = createCanonicalId("correlation");

  const receipt = await client.query<PublicationReceiptRow>(
    `INSERT INTO world.evidence_publications (
       tenant_id,
       evidence_kind,
       evidence_id,
       publication_kind,
       event_id,
       published_at
     )
     VALUES ($1,$2,$3,'recorded',$4,$5)
     ON CONFLICT (
       tenant_id,
       evidence_kind,
       evidence_id,
       publication_kind
     )
     DO NOTHING
     RETURNING event_id`,
    [
      evidence.tenantId,
      kind,
      id,
      eventId,
      evidence.recordedAt,
    ],
  );

  const claimed = receipt.rows[0];
  if (!claimed) {
    return null;
  }

  const payload = recordedPayload(evidence);
  const platformEvent: PlatformEvent<WorldEvidenceRecordedPayload> =
    Object.freeze({
      eventId: claimed.event_id,
      eventType: worldEvidenceRecordedEventType,
      schemaVersion: worldEvidenceRecordedSchemaVersion,
      tenantId: evidence.tenantId,
      aggregate: Object.freeze({
        type: kind === "event" ? "world-event" : "world-interaction",
        id,
      }),
      occurredAt: evidence.effectiveStart,
      recordedAt: evidence.recordedAt,
      actor: null,
      authorityRef: null,
      correlationId,
      causationId: null,
      requestId: null,
      workflowRunId: null,
      characterSessionId: null,
      provenance: Object.freeze({
        source: `world:${evidence.provenance}`,
        evidenceIds: Object.freeze([id]),
      }),
      sensitivity: visibilitySensitivity(evidence.visibility),
      payload,
    });

  await appendPlatformEvent(client, platformEvent);

  for (const destination of [
    worldEvidenceMemoryDestination,
    worldEvidenceWorkflowDestination,
  ] as const) {
    await enqueueOutbox(client, {
      tenantId: evidence.tenantId,
      eventId: claimed.event_id,
      eventType: worldEvidenceRecordedEventType,
      schemaVersion: worldEvidenceRecordedSchemaVersion,
      aggregateType: platformEvent.aggregate.type,
      aggregateId: platformEvent.aggregate.id,
      correlationId,
      causationId: null,
      destination,
      availableAt: evidence.recordedAt,
      payload,
    });
  }

  return claimed.event_id;
}
