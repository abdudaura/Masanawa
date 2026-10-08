import { describe, expect, it } from "vitest";
import {
  createTalkReplaySession,
  isReplayPubliclyVisible,
  transitionTalkReplaySession,
  type TalkRecordingId,
  type TalkRecordingSegmentId,
  type TalkReplayPolicy,
} from "./talk-replay.js";
import type { TalkId } from "./talk-live.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const hostUserId = "user_00000000-0000-4000-8000-000000000002" as never;
const otherUserId = "user_00000000-0000-4000-8000-000000000003" as never;
const talkId = "talk_00000000-0000-4000-8000-000000000004" as TalkId;
const recordingId = "recording_00000000-0000-4000-8000-000000000005" as TalkRecordingId;
const startedAt = "2026-10-07T09:00:00.000Z" as never;

const policy: TalkReplayPolicy = {
  recordingAllowed: true,
  publicationAllowed: true,
  maxSegments: 4,
  maxSegmentDurationMs: 60_000,
};

function fixture(preference: "publish" | "private" = "publish") {
  return createTalkReplaySession({
    tenantId,
    talkId,
    recordingId,
    hostUserId,
    hostRecordingConsent: true,
    publicationPreference: preference,
    startedAt,
  }, policy);
}

function at(value: string) {
  return value as never;
}

function withSegment(preference: "publish" | "private" = "publish") {
  const session = fixture(preference);
  return transitionTalkReplaySession(session, {
    type: "segment_finalized",
    expectedRevision: session.revision,
    segmentId: "segment_1" as TalkRecordingSegmentId,
    startedAt: at("2026-10-07T09:00:00.000Z"),
    endedAt: at("2026-10-07T09:00:20.000Z"),
    mediaRef: "media/internal/segment-1",
    checksumSha256: "a".repeat(64),
  }, at("2026-10-07T09:00:21.000Z"), policy).session;
}

describe("Talk replay recording runtime", () => {
  it("requires human Host recording consent and current recording policy", () => {
    expect(() => createTalkReplaySession({
      tenantId,
      talkId,
      recordingId,
      hostUserId,
      hostRecordingConsent: false,
      publicationPreference: "publish",
      startedAt,
    }, policy)).toThrow("Host consent");

    expect(() => createTalkReplaySession({
      tenantId,
      talkId,
      recordingId,
      hostUserId,
      hostRecordingConsent: true,
      publicationPreference: "publish",
      startedAt,
    }, { ...policy, recordingAllowed: false })).toThrow("disabled by policy");
  });

  it("accepts only ordered finalized media metadata while the Talk is recording", () => {
    let session = withSegment();

    expect(session.segments).toHaveLength(1);
    expect(session.segments[0]).toMatchObject({
      sequence: 1,
      durationMs: 20_000,
      mediaRef: "media/internal/segment-1",
    });

    session = transitionTalkReplaySession(session, {
      type: "segment_finalized",
      expectedRevision: session.revision,
      segmentId: "segment_2" as TalkRecordingSegmentId,
      startedAt: at("2026-10-07T09:00:20.000Z"),
      endedAt: at("2026-10-07T09:00:40.000Z"),
      mediaRef: "media/internal/segment-2",
      checksumSha256: "b".repeat(64),
    }, at("2026-10-07T09:00:41.000Z"), policy).session;

    expect(session.segments.map((segment) => segment.sequence)).toEqual([1, 2]);

    expect(() => transitionTalkReplaySession(session, {
      type: "segment_finalized",
      expectedRevision: session.revision,
      segmentId: "segment_overlap" as TalkRecordingSegmentId,
      startedAt: at("2026-10-07T09:00:39.000Z"),
      endedAt: at("2026-10-07T09:00:50.000Z"),
      mediaRef: "media/internal/overlap",
      checksumSha256: "c".repeat(64),
    }, at("2026-10-07T09:00:51.000Z"), policy)).toThrow("non-overlapping");
  });

  it("publishes automatically on finalization only when Host preference and policy allow it", () => {
    const recording = withSegment("publish");
    const finalized = transitionTalkReplaySession(recording, {
      type: "live_finalized",
      expectedRevision: recording.revision,
      reason: "host_ended",
    }, at("2026-10-07T09:01:00.000Z"), policy).session;

    expect(finalized.recordingState).toBe("finalized");
    expect(finalized.publicationState).toBe("published");
    expect(finalized.publishedAt).toBe("2026-10-07T09:01:00.000Z");
    expect(isReplayPubliclyVisible(finalized)).toBe(true);

    const privateRecording = withSegment("private");
    const privateFinalized = transitionTalkReplaySession(privateRecording, {
      type: "live_finalized",
      expectedRevision: privateRecording.revision,
      reason: "host_ended",
    }, at("2026-10-07T09:01:00.000Z"), policy).session;
    expect(privateFinalized.publicationState).toBe("private");
    expect(isReplayPubliclyVisible(privateFinalized)).toBe(false);
  });

  it("blocks publication when server policy forbids replays even if the Host requested publish", () => {
    const recording = withSegment("publish");
    const blockedPolicy = { ...policy, publicationAllowed: false };
    const finalized = transitionTalkReplaySession(recording, {
      type: "live_finalized",
      expectedRevision: recording.revision,
      reason: "platform_ended",
    }, at("2026-10-07T09:01:00.000Z"), blockedPolicy).session;

    expect(finalized.publicationState).toBe("blocked");
    expect(finalized.blockReason).toBe("policy");
    expect(isReplayPubliclyVisible(finalized)).toBe(false);
  });

  it("allows only the recorded Talk Host to publish, unpublish or discard", () => {
    const recording = withSegment("private");
    let finalized = transitionTalkReplaySession(recording, {
      type: "live_finalized",
      expectedRevision: recording.revision,
      reason: "host_ended",
    }, at("2026-10-07T09:01:00.000Z"), policy).session;

    expect(() => transitionTalkReplaySession(finalized, {
      type: "publish",
      expectedRevision: finalized.revision,
      requesterUserId: otherUserId,
    }, at("2026-10-07T09:01:01.000Z"), policy)).toThrow("human Talk Host");

    finalized = transitionTalkReplaySession(finalized, {
      type: "publish",
      expectedRevision: finalized.revision,
      requesterUserId: hostUserId,
    }, at("2026-10-07T09:01:01.000Z"), policy).session;
    expect(finalized.publicationState).toBe("published");

    finalized = transitionTalkReplaySession(finalized, {
      type: "unpublish",
      expectedRevision: finalized.revision,
      requesterUserId: hostUserId,
    }, at("2026-10-07T09:01:02.000Z"), policy).session;
    expect(finalized.publicationState).toBe("private");
    expect(finalized.unpublishedAt).toBe("2026-10-07T09:01:02.000Z");

    const discarded = transitionTalkReplaySession(finalized, {
      type: "discard",
      expectedRevision: finalized.revision,
      requesterUserId: hostUserId,
    }, at("2026-10-07T09:01:03.000Z"), policy).session;
    expect(discarded.recordingState).toBe("discarded");
    expect(discarded.segments).toEqual([]);
  });

  it("lets platform enforcement remove a published replay without granting Host override", () => {
    const recording = withSegment("publish");
    let session = transitionTalkReplaySession(recording, {
      type: "live_finalized",
      expectedRevision: recording.revision,
      reason: "host_ended",
    }, at("2026-10-07T09:01:00.000Z"), policy).session;

    session = transitionTalkReplaySession(session, {
      type: "platform_block",
      expectedRevision: session.revision,
    }, at("2026-10-07T09:01:05.000Z"), policy).session;

    expect(session.publicationState).toBe("blocked");
    expect(session.blockReason).toBe("platform_enforcement");
    expect(session.publishedAt).toBeNull();
    expect(session.unpublishedAt).toBe("2026-10-07T09:01:05.000Z");

    expect(() => transitionTalkReplaySession(session, {
      type: "publish",
      expectedRevision: session.revision,
      requesterUserId: hostUserId,
    }, at("2026-10-07T09:01:06.000Z"), policy)).toThrow("blocked");

    expect(() => transitionTalkReplaySession(session, {
      type: "discard",
      expectedRevision: session.revision,
      requesterUserId: hostUserId,
    }, at("2026-10-07T09:01:06.000Z"), policy)).toThrow("Platform-blocked");
  });

  it("never publishes an empty recording and stops accepting segments after finalization", () => {
    const empty = fixture("publish");
    const finalized = transitionTalkReplaySession(empty, {
      type: "live_finalized",
      expectedRevision: empty.revision,
      reason: "host_grace_expired",
    }, at("2026-10-07T09:00:30.000Z"), policy).session;

    expect(finalized.publicationState).toBe("private");
    expect(() => transitionTalkReplaySession(finalized, {
      type: "publish",
      expectedRevision: finalized.revision,
      requesterUserId: hostUserId,
    }, at("2026-10-07T09:00:31.000Z"), policy)).toThrow("no recorded media");

    expect(() => transitionTalkReplaySession(finalized, {
      type: "segment_finalized",
      expectedRevision: finalized.revision,
      segmentId: "segment_late" as TalkRecordingSegmentId,
      startedAt: at("2026-10-07T09:00:00.000Z"),
      endedAt: at("2026-10-07T09:00:10.000Z"),
      mediaRef: "media/internal/late",
      checksumSha256: "d".repeat(64),
    }, at("2026-10-07T09:00:32.000Z"), policy)).toThrow("no longer accepting");
  });

  it("rejects stale revisions, malformed checksums, unbounded segments and backwards time", () => {
    const session = fixture();

    expect(() => transitionTalkReplaySession(session, {
      type: "live_finalized",
      expectedRevision: session.revision + 1,
      reason: "host_ended",
    }, at("2026-10-07T09:00:10.000Z"), policy)).toThrow("revision conflict");

    expect(() => transitionTalkReplaySession(session, {
      type: "segment_finalized",
      expectedRevision: session.revision,
      segmentId: "segment_bad" as TalkRecordingSegmentId,
      startedAt: at("2026-10-07T09:00:00.000Z"),
      endedAt: at("2026-10-07T09:00:10.000Z"),
      mediaRef: "media/internal/bad",
      checksumSha256: "not-a-checksum",
    }, at("2026-10-07T09:00:11.000Z"), policy)).toThrow("checksum");

    expect(() => transitionTalkReplaySession(session, {
      type: "segment_finalized",
      expectedRevision: session.revision,
      segmentId: "segment_too_long" as TalkRecordingSegmentId,
      startedAt: at("2026-10-07T09:00:00.000Z"),
      endedAt: at("2026-10-07T09:02:00.000Z"),
      mediaRef: "media/internal/too-long",
      checksumSha256: "e".repeat(64),
    }, at("2026-10-07T09:02:01.000Z"), policy)).toThrow("duration");

    expect(() => transitionTalkReplaySession(session, {
      type: "live_finalized",
      expectedRevision: session.revision,
      reason: "host_ended",
    }, at("2026-10-07T08:59:59.000Z"), policy)).toThrow("cannot move backwards");
  });
});
