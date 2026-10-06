import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant, type RequestId } from "@masanawa/contracts";
import {
  ChannelLinkChallengeCoordinator,
  type ChannelLinkChallengeRepository,
} from "./channel-link-coordinator.js";
import type { ChannelLinkChallenge } from "./channel-link-challenge.js";

const requestId = createCanonicalId("request");
const tenantId = createCanonicalId("tenant");
const channelAccountId = createCanonicalId("channel-account");
const userId = createCanonicalId("user");
const secret = "ChannelSecret_abcdefghijklmnopqrstuvwxyz123";
const createdAt = toInstant("2026-10-06T16:00:00.000Z");
const expiresAt = toInstant("2026-10-06T16:10:00.000Z");

class MemoryRepository implements ChannelLinkChallengeRepository {
  readonly rows = new Map<RequestId, ChannelLinkChallenge>();
  compareAndSetCalls = 0;

  async create(input: {
    readonly challenge: ChannelLinkChallenge;
  }): Promise<ChannelLinkChallenge> {
    const existing = this.rows.get(input.challenge.requestId);
    if (existing !== undefined) {
      return existing;
    }
    this.rows.set(input.challenge.requestId, input.challenge);
    return input.challenge;
  }

  async load(input: {
    readonly requestId: RequestId;
  }): Promise<ChannelLinkChallenge | null> {
    return this.rows.get(input.requestId) ?? null;
  }

  async compareAndSet(input: {
    readonly requestId: RequestId;
    readonly expectedRevision: number;
    readonly next: ChannelLinkChallenge;
  }): Promise<ChannelLinkChallenge> {
    this.compareAndSetCalls += 1;
    const current = this.rows.get(input.requestId);
    if (current === undefined) throw new Error("missing");
    if (current.revision !== input.expectedRevision) {
      throw new Error("stale challenge revision");
    }
    this.rows.set(input.requestId, input.next);
    return input.next;
  }
}

function issue(coordinator: ChannelLinkChallengeCoordinator, overrideSecret = secret) {
  return coordinator.issue({
    requestId,
    tenantId,
    channelAccountId,
    channel: "whatsapp",
    userId,
    secret: overrideSecret,
    createdAt,
    expiresAt,
    maxAttempts: 3,
  });
}

describe("channel link challenge durable coordinator", () => {
  it("creates one durable challenge and permits exact issuance replay", async () => {
    const repository = new MemoryRepository();
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });

    const first = await issue(coordinator);
    const replay = await issue(coordinator);

    expect(replay.challenge).toEqual(first.challenge);
    expect(replay.secret).toBe(secret);
    expect(repository.rows.size).toBe(1);
  });

  it("rejects changed secret under an existing RequestId", async () => {
    const repository = new MemoryRepository();
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });
    await issue(coordinator);

    await expect(
      issue(coordinator, "AnotherSecret_abcdefghijklmnopqrstuvwxyz9"),
    ).rejects.toThrow(/RequestId conflicts/);
  });

  it("persists failed attempt state before returning rejection", async () => {
    const repository = new MemoryRepository();
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });
    await issue(coordinator);

    const result = await coordinator.verify({
      requestId,
      secret: "WrongSecret_abcdefghijklmnopqrstuvwxyz12",
      channel: "whatsapp",
      channelAccountId,
      externalSubjectId: "2348012345678",
      attemptedAt: toInstant("2026-10-06T16:01:00.000Z"),
    });

    expect(result).toMatchObject({
      outcome: "rejected",
      reason: "invalid-secret",
      challenge: { revision: 2, attempts: 1, state: "pending" },
    });
    expect(repository.rows.get(requestId)).toMatchObject({
      revision: 2,
      attempts: 1,
    });
    expect(repository.compareAndSetCalls).toBe(1);
  });

  it("persists verified proof before returning it", async () => {
    const repository = new MemoryRepository();
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });
    await issue(coordinator);

    const result = await coordinator.verify({
      requestId,
      secret,
      channel: "whatsapp",
      channelAccountId,
      externalSubjectId: "2348012345678",
      attemptedAt: toInstant("2026-10-06T16:01:00.000Z"),
    });

    expect(result).toMatchObject({
      outcome: "verified",
      replay: false,
      challenge: {
        state: "verified",
        revision: 2,
        verifiedExternalSubjectId: "2348012345678",
      },
      proof: {
        method: "channel-possession-challenge",
      },
    });
    expect(repository.rows.get(requestId)?.state).toBe("verified");
    expect(repository.compareAndSetCalls).toBe(1);
  });

  it("returns exact verified replay without another storage mutation", async () => {
    const repository = new MemoryRepository();
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });
    await issue(coordinator);
    await coordinator.verify({
      requestId,
      secret,
      channel: "whatsapp",
      channelAccountId,
      externalSubjectId: "2348012345678",
      attemptedAt: toInstant("2026-10-06T16:01:00.000Z"),
    });
    const before = repository.compareAndSetCalls;

    const replay = await coordinator.verify({
      requestId,
      secret,
      channel: "whatsapp",
      channelAccountId,
      externalSubjectId: "2348012345678",
      attemptedAt: toInstant("2026-10-06T16:02:00.000Z"),
    });

    expect(replay).toMatchObject({ outcome: "verified", replay: true });
    expect(repository.compareAndSetCalls).toBe(before);
  });

  it("propagates stale CAS rejection instead of returning an unpersisted proof", async () => {
    const repository = new MemoryRepository();
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });
    await issue(coordinator);

    const racingRepository: ChannelLinkChallengeRepository = {
      create: repository.create.bind(repository),
      load: repository.load.bind(repository),
      async compareAndSet() {
        throw new Error("stale challenge revision");
      },
    };
    const racing = new ChannelLinkChallengeCoordinator({
      repository: racingRepository,
    });

    await expect(
      racing.verify({
        requestId,
        secret,
        channel: "whatsapp",
        channelAccountId,
        externalSubjectId: "2348012345678",
        attemptedAt: toInstant("2026-10-06T16:01:00.000Z"),
      }),
    ).rejects.toThrow(/stale challenge revision/);

    expect(repository.rows.get(requestId)).toMatchObject({
      state: "pending",
      revision: 1,
    });
  });

  it("fails when verification references an unknown RequestId", async () => {
    const coordinator = new ChannelLinkChallengeCoordinator({
      repository: new MemoryRepository(),
    });

    await expect(
      coordinator.verify({
        requestId,
        secret,
        channel: "whatsapp",
        channelAccountId,
        externalSubjectId: "2348012345678",
        attemptedAt: toInstant("2026-10-06T16:01:00.000Z"),
      }),
    ).rejects.toThrow(/does not exist/);
  });
});
