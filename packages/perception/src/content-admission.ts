import {
  normalizePerceptionEvent,
  type PerceptionEvent,
  type PerceptionPermissionEvidence,
  type PerceptionPrivacy,
  type PerceptionSource,
  type PerceptionSubject,
} from "./perception-event.js";

export interface PerceptionAdmissionEnvelope {
  readonly perceptionEventId: string;
  readonly tenantId: string;
  readonly source: PerceptionSource;
  readonly subject: PerceptionSubject;
  readonly permission: PerceptionPermissionEvidence;
  readonly privacy: PerceptionPrivacy;
  readonly upstreamEventId: string;
  readonly observedAt: string;
  readonly receivedAt: string;
}

export interface TextPerceptionAdmission {
  readonly kind: "text";
  readonly text: string;
  readonly language?: string | null;
}

export interface FilePerceptionAdmission {
  readonly kind: "file";
  readonly contentRef: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly fileName: string;
}

export interface DocumentPerceptionAdmission {
  readonly kind: "document";
  readonly contentRef: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly fileName: string;
}

export type ContentPerceptionAdmission =
  | TextPerceptionAdmission
  | FilePerceptionAdmission
  | DocumentPerceptionAdmission;

const allowedFileMediaTypes = new Set([
  "text/plain",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const documentMediaTypes = new Set([
  "application/pdf",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function size(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 25 * 1024 * 1024) {
    throw new RangeError("sizeBytes must be between 1 and 26214400");
  }
  return value;
}

function mediaType(value: string): string {
  return bounded(value, "mediaType", 3, 160).toLowerCase();
}

function dedupeKey(source: PerceptionSource, upstreamEventId: string): string {
  const eventId = bounded(upstreamEventId, "upstreamEventId", 1, 180);
  return `${source.kind}:${bounded(source.sourceId, "source.sourceId", 1, 180)}:${eventId}`;
}

function fileName(value: string): string {
  const normalized = bounded(value, "fileName", 1, 255);
  if (normalized.includes("/") || normalized.includes("\\")) {
    throw new TypeError("fileName must not contain path separators");
  }
  return normalized;
}

export function admitContentPerception(input: {
  readonly envelope: PerceptionAdmissionEnvelope;
  readonly content: ContentPerceptionAdmission;
}): PerceptionEvent {
  const common = {
    schemaVersion: 1 as const,
    perceptionEventId: input.envelope.perceptionEventId,
    tenantId: input.envelope.tenantId,
    source: input.envelope.source,
    subject: input.envelope.subject,
    permission: input.envelope.permission,
    privacy: input.envelope.privacy,
    dedupeKey: dedupeKey(
      input.envelope.source,
      input.envelope.upstreamEventId,
    ),
    observedAt: input.envelope.observedAt,
    receivedAt: input.envelope.receivedAt,
  };

  if (input.content.kind === "text") {
    const text = bounded(input.content.text, "text", 1, 128_000);
    const attributes: Record<string, string> = {};
    if (input.content.language !== undefined && input.content.language !== null) {
      attributes.language = bounded(input.content.language, "language", 2, 40)
        .toLowerCase();
    }
    return normalizePerceptionEvent({
      ...common,
      kind: "text",
      payload: {
        mediaType: "text/plain",
        contentRef: null,
        inlineText: text,
        attributes,
      },
    });
  }

  const type = mediaType(input.content.mediaType);
  if (!allowedFileMediaTypes.has(type)) {
    throw new TypeError("mediaType is not admitted for file/document perception");
  }
  if (input.content.kind === "document" && !documentMediaTypes.has(type)) {
    throw new TypeError("document mediaType is unsupported");
  }

  const normalizedSize = size(input.content.sizeBytes);
  const normalizedName = fileName(input.content.fileName);
  const ref = bounded(input.content.contentRef, "contentRef", 1, 2048);

  return normalizePerceptionEvent({
    ...common,
    kind: input.content.kind,
    payload: {
      mediaType: type,
      contentRef: ref,
      inlineText: null,
      attributes: {
        fileName: normalizedName,
        sizeBytes: String(normalizedSize),
      },
    },
  });
}
