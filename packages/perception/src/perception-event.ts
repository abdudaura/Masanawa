export type PerceptionSourceKind =
  | "app"
  | "channel"
  | "device"
  | "system";

export type PerceptionKind =
  | "text"
  | "file"
  | "document"
  | "audio"
  | "image"
  | "video"
  | "screen"
  | "camera"
  | "microphone"
  | "notification"
  | "device-state"
  | "location"
  | "custom";

export type PerceptionPermissionBasis =
  | "user-action"
  | "relationship-policy"
  | "device-permission"
  | "channel-consent"
  | "system-policy";

export type PerceptionPrivacyScope =
  | "user-private"
  | "relationship"
  | "character-private";

export type PerceptionRetentionClass =
  | "ephemeral"
  | "session"
  | "durable";

export type PerceptionMemoryPromotion =
  | "forbidden"
  | "review-required";

export interface PerceptionSource {
  readonly kind: PerceptionSourceKind;
  readonly sourceId: string;
  readonly deviceId: string | null;
  readonly channelAccountId: string | null;
}

export interface PerceptionSubject {
  readonly userId: string;
  readonly relationshipId: string | null;
  readonly characterId: string | null;
}

export interface PerceptionPermissionEvidence {
  readonly authorityContextId: string;
  readonly basis: PerceptionPermissionBasis;
  readonly revision: number;
  readonly purposes: readonly string[];
}

export interface PerceptionPrivacy {
  readonly scope: PerceptionPrivacyScope;
  readonly retention: PerceptionRetentionClass;
  readonly memoryPromotion: PerceptionMemoryPromotion;
}

export interface PerceptionPayloadDescriptor {
  readonly mediaType: string;
  readonly contentRef: string | null;
  readonly inlineText: string | null;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface PerceptionEvent {
  readonly schemaVersion: 1;
  readonly perceptionEventId: string;
  readonly tenantId: string;
  readonly kind: PerceptionKind;
  readonly source: PerceptionSource;
  readonly subject: PerceptionSubject;
  readonly permission: PerceptionPermissionEvidence;
  readonly privacy: PerceptionPrivacy;
  readonly payload: PerceptionPayloadDescriptor;
  readonly dedupeKey: string;
  readonly observedAt: string;
  readonly receivedAt: string;
}

const perceptionKinds = new Set<PerceptionKind>([
  "text",
  "file",
  "document",
  "audio",
  "image",
  "video",
  "screen",
  "camera",
  "microphone",
  "notification",
  "device-state",
  "location",
  "custom",
]);

function boundedString(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function canonicalLikeId(
  value: string,
  expectedPrefix: string,
  name: string,
): string {
  const normalized = boundedString(value, name, expectedPrefix.length + 8, 220);
  if (!normalized.startsWith(`${expectedPrefix}_`)) {
    throw new TypeError(`${name} must be a canonical ${expectedPrefix} id`);
  }
  return normalized;
}

function optionalCanonicalLikeId(
  value: string | null,
  expectedPrefix: string,
  name: string,
): string | null {
  return value === null ? null : canonicalLikeId(value, expectedPrefix, name);
}

function timestamp(value: string, name: string): string {
  const normalized = boundedString(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function normalizePurposes(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 16) {
    throw new RangeError("permission.purposes must contain 1 to 16 items");
  }
  const normalized = values.map((value) =>
    boundedString(value, "permission purpose", 1, 80).toLowerCase(),
  );
  const unique = [...new Set(normalized)];
  if (unique.length !== normalized.length) {
    throw new TypeError("permission.purposes must not contain duplicates");
  }
  return Object.freeze(unique);
}

function normalizeAttributes(
  attributes: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  if (
    attributes === null ||
    typeof attributes !== "object" ||
    Array.isArray(attributes)
  ) {
    throw new TypeError("payload.attributes must be an object");
  }

  const entries = Object.entries(attributes);
  if (entries.length > 24) {
    throw new RangeError("payload.attributes has too many entries");
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    const normalizedKey = boundedString(key, "payload attribute key", 1, 64);
    if (!/^[a-zA-Z0-9._-]+$/u.test(normalizedKey)) {
      throw new TypeError("payload attribute key is invalid");
    }
    normalized[normalizedKey] = boundedString(
      value,
      `payload.attributes.${normalizedKey}`,
      0,
      512,
    );
  }
  return Object.freeze(normalized);
}

function normalizeSource(source: PerceptionSource): PerceptionSource {
  if (
    source.kind !== "app" &&
    source.kind !== "channel" &&
    source.kind !== "device" &&
    source.kind !== "system"
  ) {
    throw new TypeError("source.kind is invalid");
  }

  const deviceId = optionalCanonicalLikeId(
    source.deviceId,
    "device",
    "source.deviceId",
  );
  const channelAccountId = optionalCanonicalLikeId(
    source.channelAccountId,
    "channel-account",
    "source.channelAccountId",
  );

  if (source.kind === "device" && deviceId === null) {
    throw new Error("device perception requires source.deviceId");
  }
  if (source.kind === "channel" && channelAccountId === null) {
    throw new Error("channel perception requires source.channelAccountId");
  }
  if (source.kind !== "device" && deviceId !== null) {
    throw new Error("source.deviceId is allowed only for device perception");
  }
  if (source.kind !== "channel" && channelAccountId !== null) {
    throw new Error(
      "source.channelAccountId is allowed only for channel perception",
    );
  }

  return Object.freeze({
    kind: source.kind,
    sourceId: boundedString(source.sourceId, "source.sourceId", 1, 180),
    deviceId,
    channelAccountId,
  });
}

function normalizeSubject(subject: PerceptionSubject): PerceptionSubject {
  const relationshipId = optionalCanonicalLikeId(
    subject.relationshipId,
    "relationship",
    "subject.relationshipId",
  );
  const characterId = optionalCanonicalLikeId(
    subject.characterId,
    "character",
    "subject.characterId",
  );

  if ((relationshipId === null) !== (characterId === null)) {
    throw new Error(
      "relationship-scoped perception requires both relationshipId and characterId",
    );
  }

  return Object.freeze({
    userId: canonicalLikeId(subject.userId, "user", "subject.userId"),
    relationshipId,
    characterId,
  });
}

function normalizePermission(
  permission: PerceptionPermissionEvidence,
  source: PerceptionSource,
): PerceptionPermissionEvidence {
  const basis = permission.basis;
  if (
    basis !== "user-action" &&
    basis !== "relationship-policy" &&
    basis !== "device-permission" &&
    basis !== "channel-consent" &&
    basis !== "system-policy"
  ) {
    throw new TypeError("permission.basis is invalid");
  }

  if (source.kind === "device" && basis !== "device-permission") {
    throw new Error("device perception requires device-permission evidence");
  }
  if (
    source.kind === "channel" &&
    basis !== "channel-consent" &&
    basis !== "user-action"
  ) {
    throw new Error(
      "channel perception requires channel-consent or user-action evidence",
    );
  }
  if (source.kind === "system" && basis !== "system-policy") {
    throw new Error("system perception requires system-policy evidence");
  }

  return Object.freeze({
    authorityContextId: canonicalLikeId(
      permission.authorityContextId,
      "authority-context",
      "permission.authorityContextId",
    ),
    basis,
    revision: positiveInteger(permission.revision, "permission.revision"),
    purposes: normalizePurposes(permission.purposes),
  });
}

function normalizePrivacy(
  privacy: PerceptionPrivacy,
  subject: PerceptionSubject,
): PerceptionPrivacy {
  if (
    privacy.scope !== "user-private" &&
    privacy.scope !== "relationship" &&
    privacy.scope !== "character-private"
  ) {
    throw new TypeError("privacy.scope is invalid");
  }
  if (
    privacy.retention !== "ephemeral" &&
    privacy.retention !== "session" &&
    privacy.retention !== "durable"
  ) {
    throw new TypeError("privacy.retention is invalid");
  }
  if (
    privacy.memoryPromotion !== "forbidden" &&
    privacy.memoryPromotion !== "review-required"
  ) {
    throw new TypeError("privacy.memoryPromotion is invalid");
  }

  if (
    privacy.scope === "relationship" &&
    (subject.relationshipId === null || subject.characterId === null)
  ) {
    throw new Error(
      "relationship privacy scope requires relationship-scoped subject",
    );
  }

  if (
    privacy.retention === "ephemeral" &&
    privacy.memoryPromotion !== "forbidden"
  ) {
    throw new Error("ephemeral perception cannot be promoted to memory");
  }

  return Object.freeze({ ...privacy });
}

function normalizePayload(
  payload: PerceptionPayloadDescriptor,
): PerceptionPayloadDescriptor {
  const mediaType = boundedString(payload.mediaType, "payload.mediaType", 3, 160)
    .toLowerCase();

  const contentRef =
    payload.contentRef === null
      ? null
      : boundedString(payload.contentRef, "payload.contentRef", 1, 2048);

  const inlineText =
    payload.inlineText === null
      ? null
      : boundedString(payload.inlineText, "payload.inlineText", 0, 16_384);

  if (contentRef === null && inlineText === null) {
    throw new Error("payload requires contentRef or inlineText");
  }
  if (contentRef !== null && inlineText !== null) {
    throw new Error("payload must not contain both contentRef and inlineText");
  }

  return Object.freeze({
    mediaType,
    contentRef,
    inlineText,
    attributes: normalizeAttributes(payload.attributes),
  });
}

export function normalizePerceptionEvent(input: PerceptionEvent): PerceptionEvent {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported PerceptionEvent schemaVersion");
  }
  if (!perceptionKinds.has(input.kind)) {
    throw new TypeError("kind is invalid");
  }

  const source = normalizeSource(input.source);
  const subject = normalizeSubject(input.subject);
  const permission = normalizePermission(input.permission, source);
  const privacy = normalizePrivacy(input.privacy, subject);
  const payload = normalizePayload(input.payload);
  const observedAt = timestamp(input.observedAt, "observedAt");
  const receivedAt = timestamp(input.receivedAt, "receivedAt");

  if (new Date(observedAt).getTime() > new Date(receivedAt).getTime()) {
    throw new Error("observedAt cannot be after receivedAt");
  }

  return Object.freeze({
    schemaVersion: 1,
    perceptionEventId: canonicalLikeId(
      input.perceptionEventId,
      "event",
      "perceptionEventId",
    ),
    tenantId: canonicalLikeId(input.tenantId, "tenant", "tenantId"),
    kind: input.kind,
    source,
    subject,
    permission,
    privacy,
    payload,
    dedupeKey: boundedString(input.dedupeKey, "dedupeKey", 8, 256),
    observedAt,
    receivedAt,
  });
}

export function assertPerceptionPurpose(
  event: PerceptionEvent,
  requiredPurpose: string,
): void {
  const normalized = normalizePerceptionEvent(event);
  const purpose = boundedString(requiredPurpose, "requiredPurpose", 1, 80)
    .toLowerCase();
  if (!normalized.permission.purposes.includes(purpose)) {
    throw new Error(`PerceptionEvent lacks required purpose: ${purpose}`);
  }
}

export function canPromotePerceptionToMemory(event: PerceptionEvent): boolean {
  const normalized = normalizePerceptionEvent(event);
  return (
    normalized.privacy.retention === "durable" &&
    normalized.privacy.memoryPromotion === "review-required"
  );
}
