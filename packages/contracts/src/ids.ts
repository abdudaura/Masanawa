import { validate as validateUuid, v7 as uuidv7, version as uuidVersion } from "uuid";

export const canonicalIdKinds = [
  "tenant",
  "user",
  "character",
  "character-version",
  "relationship",
  "world",
  "world-generation",
  "world-actor",
  "world-event",
  "world-interaction",
  "character-session",
  "channel-session",
  "presence-session",
  "agent-run",
  "task",
  "workflow",
  "workflow-version",
  "workflow-run",
  "memory-record",
  "memory-revision",
  "memory-extraction",
  "memory-projection-generation",
  "skill",
  "skill-version",
  "tool",
  "tool-version",
  "provider",
  "credential-ref",
  "channel-account",
  "device",
  "device-credential",
  "authority-context",
  "approval",
  "operation",
  "external-receipt",
  "reconciliation-case",
  "event",
  "audit-event",
  "outbox-event",
  "offer",
  "quote",
  "payment",
  "ledger-entry",
  "fulfillment",
  "social-content",
  "publication",
  "media-project",
  "media-artifact",
  "service",
  "request",
  "correlation",
] as const;

export type CanonicalIdKind = (typeof canonicalIdKinds)[number];

declare const canonicalIdBrand: unique symbol;

export type CanonicalId<K extends CanonicalIdKind> = string & {
  readonly [canonicalIdBrand]: K;
};

const canonicalIdKindSet = new Set<string>(canonicalIdKinds);

export function createCanonicalId<K extends CanonicalIdKind>(kind: K): CanonicalId<K> {
  return `${kind}_${uuidv7()}` as CanonicalId<K>;
}

export function parseCanonicalId<K extends CanonicalIdKind>(
  kind: K,
  value: string,
): CanonicalId<K> {
  const prefix = `${kind}_`;
  if (!value.startsWith(prefix)) {
    throw new TypeError(`Expected ${kind} id`);
  }

  const uuid = value.slice(prefix.length);
  if (!validateUuid(uuid) || uuidVersion(uuid) !== 7) {
    throw new TypeError(`Expected RFC 9562 UUIDv7-backed ${kind} id`);
  }

  return value as CanonicalId<K>;
}

export function isCanonicalId<K extends CanonicalIdKind>(
  kind: K,
  value: unknown,
): value is CanonicalId<K> {
  if (typeof value !== "string") {
    return false;
  }
  try {
    parseCanonicalId(kind, value);
    return true;
  } catch {
    return false;
  }
}

export function getCanonicalIdKind(value: string): CanonicalIdKind | null {
  const separator = value.lastIndexOf("_");
  if (separator <= 0) {
    return null;
  }
  const kind = value.slice(0, separator);
  return canonicalIdKindSet.has(kind) ? (kind as CanonicalIdKind) : null;
}

export type TenantId = CanonicalId<"tenant">;
export type UserId = CanonicalId<"user">;
export type CharacterId = CanonicalId<"character">;
export type CharacterVersionId = CanonicalId<"character-version">;
export type RelationshipId = CanonicalId<"relationship">;
export type WorldId = CanonicalId<"world">;
export type WorldGenerationId = CanonicalId<"world-generation">;
export type WorldActorId = CanonicalId<"world-actor">;
export type WorldEventId = CanonicalId<"world-event">;
export type WorldInteractionId = CanonicalId<"world-interaction">;
export type CharacterSessionId = CanonicalId<"character-session">;
export type ChannelSessionId = CanonicalId<"channel-session">;
export type PresenceSessionId = CanonicalId<"presence-session">;
export type AgentRunId = CanonicalId<"agent-run">;
export type TaskId = CanonicalId<"task">;
export type WorkflowId = CanonicalId<"workflow">;
export type WorkflowVersionId = CanonicalId<"workflow-version">;
export type WorkflowRunId = CanonicalId<"workflow-run">;
export type MemoryRecordId = CanonicalId<"memory-record">;
export type MemoryRevisionId = CanonicalId<"memory-revision">;
export type MemoryExtractionId = CanonicalId<"memory-extraction">;
export type MemoryProjectionGenerationId =
  CanonicalId<"memory-projection-generation">;
export type SkillId = CanonicalId<"skill">;
export type SkillVersionId = CanonicalId<"skill-version">;
export type ToolId = CanonicalId<"tool">;
export type ToolVersionId = CanonicalId<"tool-version">;
export type ProviderId = CanonicalId<"provider">;
export type CredentialRefId = CanonicalId<"credential-ref">;
export type ChannelAccountId = CanonicalId<"channel-account">;
export type DeviceId = CanonicalId<"device">;
export type DeviceCredentialId = CanonicalId<"device-credential">;
export type AuthorityContextId = CanonicalId<"authority-context">;
export type ApprovalId = CanonicalId<"approval">;
export type OperationId = CanonicalId<"operation">;
export type ExternalReceiptId = CanonicalId<"external-receipt">;
export type ReconciliationCaseId = CanonicalId<"reconciliation-case">;
export type EventId = CanonicalId<"event">;
export type AuditEventId = CanonicalId<"audit-event">;
export type OutboxEventId = CanonicalId<"outbox-event">;
export type OfferId = CanonicalId<"offer">;
export type QuoteId = CanonicalId<"quote">;
export type PaymentId = CanonicalId<"payment">;
export type LedgerEntryId = CanonicalId<"ledger-entry">;
export type FulfillmentId = CanonicalId<"fulfillment">;
export type SocialContentId = CanonicalId<"social-content">;
export type PublicationId = CanonicalId<"publication">;
export type MediaProjectId = CanonicalId<"media-project">;
export type MediaArtifactId = CanonicalId<"media-artifact">;
export type ServiceId = CanonicalId<"service">;
export type RequestId = CanonicalId<"request">;
export type CorrelationId = CanonicalId<"correlation">;
