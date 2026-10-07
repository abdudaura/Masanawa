import { describe, expect, it, vi } from "vitest";
import {
  createTalkReplaySession,
  transitionTalkReplaySession,
  type TalkId,
  type TalkRecordingId,
  type TalkRecordingSegmentId,
} from "@masanawa/agents";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createTalkReplayService } from "./service.js";
import type { TalkReplayRecord, TalkReplayRepository } from "./model.js";

const tenantId = createCanonicalId("tenant");
const hostUserId = createCanonicalId("user");
const listenerUserId = createCanonicalId("user");
const talkId = "talk_test_1";
const recordingId = "recording_test_1" as TalkRecordingId;

function baseRecord(): TalkReplayRecord {
  const session = createTalkReplaySession({
    tenantId,
    talkId: talkId as TalkId,
    recordingId,
    hostUserId,
    hostRecordingConsent: true,
    publicationPreference: "publish",
    startedAt: toInstant("2026-10-07T10:00:00.000Z"),
  });
  return {
    tenantId,
    talkId,
    recordingId,
    hostUserId,
    session,
    egressId: null,
    objectKey: "talk-replays/test.mp4",
    providerStatus: "requested",
    providerError: null,
    createdAt: "2026-10-07T10:00:00.000Z",
    updatedAt: "2026-10-07T10:00:00.000Z",
  };
}

function repo(initial: TalkReplayRecord | null = null) {
  let record = initial;
  const repository: TalkReplayRepository = {
    async prepare() {
      record ??= baseRecord();
      return record;
    },
    async attachEgress(input) {
      if (!record) throw new Error("missing");
      record = {
        ...record,
        egressId: input.egressId,
        providerStatus: input.providerStatus,
        updatedAt: input.now,
      };
      return record;
    },
    async markProvider(input) {
      if (!record) return null;
      record = {
        ...record,
        providerStatus: input.providerStatus,
        providerError: input.providerError ?? null,
        updatedAt: input.now,
      };
      return record;
    },
    async read() {
      return record;
    },
    async finalizeSuccess(input) {
      if (!record) throw new Error("missing");
      const withSegment = transitionTalkReplaySession(
        record.session,
        {
          type: "segment_finalized",
          expectedRevision: record.session.revision,
          segmentId: "segment_1" as TalkRecordingSegmentId,
          startedAt: toInstant(input.startedAt),
          endedAt: toInstant(input.endedAt),
          mediaRef: record.objectKey,
          checksumSha256: input.checksumSha256,
        },
        toInstant(input.now),
      ).session;
      const finalized = transitionTalkReplaySession(
        withSegment,
        {
          type: "live_finalized",
          expectedRevision: withSegment.revision,
          reason: "host_ended",
        },
        toInstant(input.now),
      ).session;
      record = {
        ...record,
        session: finalized,
        providerStatus: "complete",
        updatedAt: input.now,
      };
      return record;
    },
    async finalizeFailure(input) {
      if (!record) throw new Error("missing");
      record = {
        ...record,
        providerStatus: input.providerStatus,
        providerError: input.providerError ?? null,
        updatedAt: input.now,
      };
      return record;
    },
    async setPublished() {
      if (!record) throw new Error("missing");
      return record;
    },
  };
  return { repository, current: () => record };
}

function authorizer(userId: string) {
  return {
    async authorize() {
      return {
        tenantId,
        userId: userId as never,
        profile: {
          tenantId,
          userId: userId as never,
          name: "Viewer",
          email: null,
          phone: null,
          locale: "en",
          createdAt: "2026-10-07T00:00:00.000Z",
        },
      };
    },
  };
}

describe("Talk replay service", () => {
  it("persists consent then starts Egress exactly once", async () => {
    const state = repo();
    const start = vi.fn(async () => ({
      egressId: "EG_1",
      status: "starting" as const,
      startedAt: "2026-10-07T10:00:01.000Z",
      endedAt: null,
      error: null,
    }));
    const service = createTalkReplayService({
      repository: state.repository,
      authorizer: authorizer(hostUserId),
      egress: {
        start,
        async stop() { throw new Error("not used"); },
        async inspect() { return null; },
      },
      storage: {
        bucket: "replays",
        presignGet() { return { url: "https://signed", expiresAt: "2026-10-07T10:05:00.000Z" }; },
        async sha256() { return { checksumSha256: "a".repeat(64), byteLength: 1 }; },
      },
      now: () => "2026-10-07T10:00:01.000Z",
    });

    await service.requestForHost({
      tenantId,
      hostUserId,
      talkId,
      publicationPreference: "publish",
    });
    await service.ensureStarted({ tenantId, hostUserId, talkId });

    expect(start).toHaveBeenCalledTimes(1);
    expect(state.current()?.egressId).toBe("EG_1");
  });

  it("publishes only after completed media is hashed and canonical replay finalizes", async () => {
    const initial = {
      ...baseRecord(),
      egressId: "EG_2",
      providerStatus: "ending" as const,
    };
    const state = repo(initial);
    const sha256 = vi.fn(async () => ({
      checksumSha256: "b".repeat(64),
      byteLength: 4096,
    }));
    const service = createTalkReplayService({
      repository: state.repository,
      authorizer: authorizer(listenerUserId),
      egress: {
        async start() { throw new Error("not used"); },
        async stop() { throw new Error("not used"); },
        async inspect() {
          return {
            egressId: "EG_2",
            status: "complete" as const,
            startedAt: "2026-10-07T10:00:01.000Z",
            endedAt: "2026-10-07T10:20:01.000Z",
            error: null,
          };
        },
      },
      storage: {
        bucket: "replays",
        presignGet() {
          return {
            url: "https://signed.example/replay",
            expiresAt: "2026-10-07T10:25:00.000Z",
          };
        },
        sha256,
      },
      now: () => "2026-10-07T10:20:02.000Z",
    });

    const view = await service.view({
      authorizationHeader: "Bearer listener",
      talkId,
    });

    expect(sha256).toHaveBeenCalledTimes(1);
    expect(view).toMatchObject({
      status: "published",
      published: true,
      playbackUrl: "https://signed.example/replay",
      durationSeconds: 1200,
    });
  });

  it("keeps private/unready replay media unavailable to non-Hosts", async () => {
    const state = repo(baseRecord());
    const service = createTalkReplayService({
      repository: state.repository,
      authorizer: authorizer(listenerUserId),
      egress: {
        async start() { throw new Error("not used"); },
        async stop() { throw new Error("not used"); },
        async inspect() { return null; },
      },
      storage: {
        bucket: "replays",
        presignGet() { throw new Error("must not sign"); },
        async sha256() { throw new Error("must not hash"); },
      },
    });

    const view = await service.view({
      authorizationHeader: "Bearer listener",
      talkId,
    });
    expect(view.status).toBe("unavailable");
    expect(view.playbackUrl).toBeUndefined();
  });
});
