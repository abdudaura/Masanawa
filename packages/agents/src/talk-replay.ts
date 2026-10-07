import { toInstant, type Instant, type TenantId, type UserId } from "@masanawa/contracts";
import type { TalkId } from "./talk-live.js";

export type TalkRecordingId = string & { readonly __talkRecordingId: unique symbol };
export type TalkRecordingSegmentId = string & { readonly __talkRecordingSegmentId: unique symbol };

export type TalkRecordingState = "recording" | "finalized" | "discarded";
export type TalkReplayPublicationState = "not_ready" | "private" | "published" | "blocked";
export type TalkReplayBlockReason = "platform_enforcement" | "policy" | null;
export type TalkReplayFinalizeReason = "host_ended" | "host_grace_expired" | "platform_ended";
export type TalkReplayPublicationPreference = "publish" | "private";

export interface TalkReplayPolicy {
  readonly recordingAllowed: boolean;
  readonly publicationAllowed: boolean;
  readonly maxSegments: number;
  readonly maxSegmentDurationMs: number;
}

export const launchTalkReplayPolicy: TalkReplayPolicy = Object.freeze({
  recordingAllowed: true,
  publicationAllowed: true,
  maxSegments: 4096,
  maxSegmentDurationMs: 10 * 60 * 1000,
});

export interface TalkRecordingSegment {
  readonly segmentId: TalkRecordingSegmentId;
  readonly sequence: number;
  readonly startedAt: Instant;
  readonly endedAt: Instant;
  readonly durationMs: number;
  /**
   * Opaque adapter-owned media reference. It is not a public URL and grants no access.
   */
  readonly mediaRef: string;
  readonly checksumSha256: string;
}

export interface TalkReplaySession {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly recordingId: TalkRecordingId;
  readonly hostUserId: UserId;
  readonly recordingState: TalkRecordingState;
  readonly publicationState: TalkReplayPublicationState;
  readonly blockReason: TalkReplayBlockReason;
  readonly publicationPreference: TalkReplayPublicationPreference;
  readonly segments: readonly TalkRecordingSegment[];
  readonly revision: number;
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly finalizedAt: Instant | null;
  readonly finalizeReason: TalkReplayFinalizeReason | null;
  readonly publishedAt: Instant | null;
  readonly unpublishedAt: Instant | null;
  readonly discardedAt: Instant | null;
}

export interface CreateTalkReplaySessionInput {
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly recordingId: TalkRecordingId;
  readonly hostUserId: UserId;
  readonly hostRecordingConsent: boolean;
  readonly publicationPreference: TalkReplayPublicationPreference;
  readonly startedAt: Instant;
}

export type TalkReplayCommand =
  | {
      readonly type: "segment_finalized";
      readonly expectedRevision: number;
      readonly segmentId: TalkRecordingSegmentId;
      readonly startedAt: Instant;
      readonly endedAt: Instant;
      readonly mediaRef: string;
      readonly checksumSha256: string;
    }
  | {
      readonly type: "live_finalized";
      readonly expectedRevision: number;
      readonly reason: TalkReplayFinalizeReason;
    }
  | {
      readonly type: "publish";
      readonly expectedRevision: number;
      readonly requesterUserId: UserId;
    }
  | {
      readonly type: "unpublish";
      readonly expectedRevision: number;
      readonly requesterUserId: UserId;
    }
  | {
      readonly type: "discard";
      readonly expectedRevision: number;
      readonly requesterUserId: UserId;
    }
  | {
      readonly type: "platform_block";
      readonly expectedRevision: number;
    };

export interface TalkReplayTransition {
  readonly session: TalkReplaySession;
  readonly event: Readonly<{
    schemaVersion: 1;
    tenantId: TenantId;
    talkId: TalkId;
    recordingId: TalkRecordingId;
    type: TalkReplayCommand["type"];
    revision: number;
    occurredAt: Instant;
    segmentId?: TalkRecordingSegmentId;
  }>;
}

function nonEmpty(value: string, label: string, max = 512): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new TypeError(`${label} is invalid`);
  return normalized;
}

function assertPolicy(policy: TalkReplayPolicy): void {
  if (typeof policy.recordingAllowed !== "boolean" || typeof policy.publicationAllowed !== "boolean") {
    throw new TypeError("Talk replay policy flags are invalid");
  }
  if (!Number.isSafeInteger(policy.maxSegments) || policy.maxSegments < 1 || policy.maxSegments > 100_000) {
    throw new RangeError("Talk replay segment bound is invalid");
  }
  if (!Number.isSafeInteger(policy.maxSegmentDurationMs) ||
      policy.maxSegmentDurationMs < 1 ||
      policy.maxSegmentDurationMs > 60 * 60 * 1000) {
    throw new RangeError("Talk replay segment duration bound is invalid");
  }
}

function assertRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1 || revision >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Talk replay revision is invalid");
  }
}

function assertChecksum(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) throw new TypeError("Recording segment checksum is invalid");
  return normalized;
}

function millisecondsBetween(startedAt: Instant, endedAt: Instant): number {
  return Date.parse(endedAt) - Date.parse(startedAt);
}

function assertHost(session: TalkReplaySession, requesterUserId: UserId): void {
  if (requesterUserId !== session.hostUserId) {
    throw new Error("Only the human Talk Host may change replay publication");
  }
}

function validateSegment(
  segment: TalkRecordingSegment,
  previous: TalkRecordingSegment | undefined,
  policy: TalkReplayPolicy,
): void {
  if (!Number.isSafeInteger(segment.sequence) || segment.sequence < 1) {
    throw new RangeError("Recording segment sequence is invalid");
  }
  const startedAt = toInstant(segment.startedAt);
  const endedAt = toInstant(segment.endedAt);
  const durationMs = millisecondsBetween(startedAt, endedAt);
  if (durationMs < 1 || durationMs > policy.maxSegmentDurationMs || durationMs !== segment.durationMs) {
    throw new RangeError("Recording segment duration is invalid");
  }
  nonEmpty(segment.segmentId, "Recording segment id", 200);
  nonEmpty(segment.mediaRef, "Recording media reference", 1000);
  assertChecksum(segment.checksumSha256);
  if (previous) {
    if (segment.sequence !== previous.sequence + 1 || startedAt < previous.endedAt) {
      throw new TypeError("Recording segments must be ordered, sequential and non-overlapping");
    }
  } else if (segment.sequence !== 1) {
    throw new TypeError("First recording segment sequence must be 1");
  }
}

export function createTalkReplaySession(
  input: CreateTalkReplaySessionInput,
  policy: TalkReplayPolicy = launchTalkReplayPolicy,
): TalkReplaySession {
  assertPolicy(policy);
  if (!policy.recordingAllowed) throw new Error("Talk recording is disabled by policy");
  if (!input.hostRecordingConsent) throw new Error("Human Host consent is required before recording");
  nonEmpty(input.talkId, "Talk id", 240);
  nonEmpty(input.recordingId, "Recording id", 240);
  if (!["publish", "private"].includes(input.publicationPreference)) {
    throw new TypeError("Replay publication preference is invalid");
  }
  const startedAt = toInstant(input.startedAt);
  const session: TalkReplaySession = Object.freeze({
    schemaVersion: 1,
    tenantId: input.tenantId,
    talkId: input.talkId,
    recordingId: input.recordingId,
    hostUserId: input.hostUserId,
    recordingState: "recording",
    publicationState: "not_ready",
    blockReason: null,
    publicationPreference: input.publicationPreference,
    segments: Object.freeze([]),
    revision: 1,
    startedAt,
    updatedAt: startedAt,
    finalizedAt: null,
    finalizeReason: null,
    publishedAt: null,
    unpublishedAt: null,
    discardedAt: null,
  });
  assertTalkReplaySession(session, policy);
  return session;
}

export function assertTalkReplaySession(
  session: TalkReplaySession,
  policy: TalkReplayPolicy = launchTalkReplayPolicy,
): void {
  assertPolicy(policy);
  if (session.schemaVersion !== 1) throw new TypeError("Unsupported Talk replay schema");
  nonEmpty(session.talkId, "Talk id", 240);
  nonEmpty(session.recordingId, "Recording id", 240);
  assertRevision(session.revision);
  if (!["publish", "private"].includes(session.publicationPreference)) {
    throw new TypeError("Replay publication preference is invalid");
  }
  const startedAt = toInstant(session.startedAt);
  const updatedAt = toInstant(session.updatedAt);
  if (updatedAt < startedAt) throw new TypeError("Talk replay timestamps are inconsistent");
  if (session.segments.length > policy.maxSegments) throw new RangeError("Talk replay segment bound exceeded");
  const ids = new Set<string>();
  let previous: TalkRecordingSegment | undefined;
  for (const segment of session.segments) {
    validateSegment(segment, previous, policy);
    if (ids.has(segment.segmentId)) throw new TypeError("Recording segment identifiers must be unique");
    ids.add(segment.segmentId);
    previous = segment;
  }

  if (session.recordingState === "recording") {
    if (session.publicationState !== "not_ready" || session.blockReason !== null ||
        session.finalizedAt !== null || session.finalizeReason !== null ||
        session.publishedAt !== null || session.unpublishedAt !== null || session.discardedAt !== null) {
      throw new TypeError("Active recording replay state is inconsistent");
    }
    return;
  }

  if (session.recordingState === "discarded") {
    if (session.publicationState !== "private" || session.blockReason !== null ||
        session.discardedAt === null || toInstant(session.discardedAt) !== updatedAt) {
      throw new TypeError("Discarded replay state is inconsistent");
    }
    return;
  }

  if (session.finalizedAt === null || session.finalizeReason === null || session.discardedAt !== null) {
    throw new TypeError("Finalized replay state is incomplete");
  }
  if (toInstant(session.finalizedAt) > updatedAt) throw new TypeError("Replay finalization time is invalid");

  if (session.publicationState === "not_ready") {
    throw new TypeError("Finalized replay cannot remain not_ready");
  }
  if (session.publicationState === "published") {
    if (session.blockReason !== null || session.publishedAt === null || toInstant(session.publishedAt) > updatedAt) {
      throw new TypeError("Published replay state is inconsistent");
    }
  } else if (session.publicationState === "blocked") {
    if (session.blockReason === null || session.publishedAt !== null) {
      throw new TypeError("Blocked replay state is inconsistent");
    }
  } else if (session.blockReason !== null || session.publishedAt !== null) {
    throw new TypeError("Private replay state is inconsistent");
  }
}

function event(
  session: TalkReplaySession,
  type: TalkReplayCommand["type"],
  occurredAt: Instant,
  segmentId?: TalkRecordingSegmentId,
): TalkReplayTransition["event"] {
  return Object.freeze({
    schemaVersion: 1 as const,
    tenantId: session.tenantId,
    talkId: session.talkId,
    recordingId: session.recordingId,
    type,
    revision: session.revision,
    occurredAt,
    ...(segmentId === undefined ? {} : { segmentId }),
  });
}

function next(
  previous: TalkReplaySession,
  patch: Omit<Partial<TalkReplaySession>, "revision" | "updatedAt">,
  at: Instant,
  policy: TalkReplayPolicy,
): TalkReplaySession {
  const candidate = Object.freeze({
    ...previous,
    ...patch,
    revision: previous.revision + 1,
    updatedAt: at,
  }) as TalkReplaySession;
  assertTalkReplaySession(candidate, policy);
  return candidate;
}

export function transitionTalkReplaySession(
  session: TalkReplaySession,
  command: TalkReplayCommand,
  atInput: Instant,
  policy: TalkReplayPolicy = launchTalkReplayPolicy,
): TalkReplayTransition {
  assertTalkReplaySession(session, policy);
  if (command.expectedRevision !== session.revision) throw new Error("Talk replay revision conflict");
  const at = toInstant(atInput);
  if (at < session.updatedAt) throw new TypeError("Talk replay transition time cannot move backwards");

  switch (command.type) {
    case "segment_finalized": {
      if (session.recordingState !== "recording") throw new Error("Recording is no longer accepting segments");
      if (session.segments.length >= policy.maxSegments) throw new RangeError("Talk replay segment bound exceeded");
      if (session.segments.some((segment) => segment.segmentId === command.segmentId)) {
        throw new Error("Recording segment already exists");
      }
      const startedAt = toInstant(command.startedAt);
      const endedAt = toInstant(command.endedAt);
      if (startedAt < session.startedAt || endedAt > at) {
        throw new TypeError("Recording segment falls outside admitted recording time");
      }
      const segment: TalkRecordingSegment = Object.freeze({
        segmentId: command.segmentId,
        sequence: session.segments.length + 1,
        startedAt,
        endedAt,
        durationMs: millisecondsBetween(startedAt, endedAt),
        mediaRef: nonEmpty(command.mediaRef, "Recording media reference", 1000),
        checksumSha256: assertChecksum(command.checksumSha256),
      });
      validateSegment(segment, session.segments.at(-1), policy);
      const updated = next(session, {
        segments: Object.freeze([...session.segments, segment]),
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, command.type, at, command.segmentId) });
    }
    case "live_finalized": {
      if (session.recordingState !== "recording") throw new Error("Recording is already terminal");
      const canPublish = policy.publicationAllowed &&
        session.publicationPreference === "publish" &&
        session.segments.length > 0;
      const updated = next(session, {
        recordingState: "finalized",
        publicationState: policy.publicationAllowed ? (canPublish ? "published" : "private") : "blocked",
        blockReason: policy.publicationAllowed ? null : "policy",
        finalizedAt: at,
        finalizeReason: command.reason,
        publishedAt: canPublish ? at : null,
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, command.type, at) });
    }
    case "publish": {
      assertHost(session, command.requesterUserId);
      if (session.recordingState !== "finalized") throw new Error("Replay is not finalized");
      if (!policy.publicationAllowed || session.publicationState === "blocked") {
        throw new Error("Replay publication is blocked");
      }
      if (session.segments.length === 0) throw new Error("Replay has no recorded media");
      if (session.publicationState === "published") throw new Error("Replay is already published");
      const updated = next(session, {
        publicationState: "published",
        publishedAt: at,
        unpublishedAt: session.unpublishedAt,
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, command.type, at) });
    }
    case "unpublish": {
      assertHost(session, command.requesterUserId);
      if (session.recordingState !== "finalized" || session.publicationState !== "published") {
        throw new Error("Replay is not currently published");
      }
      const updated = next(session, {
        publicationState: "private",
        publishedAt: null,
        unpublishedAt: at,
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, command.type, at) });
    }
    case "discard": {
      assertHost(session, command.requesterUserId);
      if (session.recordingState === "discarded") throw new Error("Recording is already discarded");
      if (session.publicationState === "published") throw new Error("Published replay must be unpublished before discard");
      if (session.publicationState === "blocked") throw new Error("Platform-blocked replay cannot be discarded by Host");
      const updated = next(session, {
        recordingState: "discarded",
        publicationState: "private",
        segments: Object.freeze([]),
        blockReason: null,
        publishedAt: null,
        finalizedAt: session.recordingState === "recording" ? null : session.finalizedAt,
        finalizeReason: session.recordingState === "recording" ? null : session.finalizeReason,
        discardedAt: at,
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, command.type, at) });
    }
    case "platform_block": {
      if (session.recordingState !== "finalized") throw new Error("Only finalized replay can be publication-blocked");
      if (session.publicationState === "blocked") throw new Error("Replay is already blocked");
      const updated = next(session, {
        publicationState: "blocked",
        blockReason: "platform_enforcement",
        publishedAt: null,
        unpublishedAt: session.publicationState === "published" ? at : session.unpublishedAt,
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, command.type, at) });
    }
  }
}

export function isReplayPubliclyVisible(session: TalkReplaySession): boolean {
  assertTalkReplaySession(session);
  return session.recordingState === "finalized" && session.publicationState === "published";
}
