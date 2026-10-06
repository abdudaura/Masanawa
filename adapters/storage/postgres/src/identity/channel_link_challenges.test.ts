import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createCanonicalId } from "@masanawa/contracts";
import {
  ChannelLinkChallengeCoordinator,
  createChannelLinkChallenge,
} from "@masanawa/identity";
import { createPostgresChannelLinkChallengeRepository } from "./channel_link_challenges.js";

function fakePool(): Pool {
  const rows = new Map<string, any>();

  const client = {
    async query(sql: string, values: readonly unknown[] = []) {
      const normalized = sql.replace(/\s+/g, " ").trim();

      if (
        normalized === "BEGIN" ||
        normalized === "COMMIT" ||
        normalized === "ROLLBACK" ||
        normalized.startsWith("SET TRANSACTION ")
      ) {
        return { rows: [], rowCount: 0 };
      }

      if (normalized.startsWith("INSERT INTO identity.channel_link_challenges")) {
        const [
          requestId,
          tenantId,
          channelAccountId,
          channel,
          userId,
          secretHash,
          state,
          attempts,
          maxAttempts,
          revision,
          createdAt,
          expiresAt,
        ] = values as any[];
        if (rows.has(requestId)) return { rows: [], rowCount: 0 };
        const row = {
          request_id: requestId,
          tenant_id: tenantId,
          channel_account_id: channelAccountId,
          channel,
          user_id: userId,
          secret_hash: secretHash,
          state,
          attempts,
          max_attempts: maxAttempts,
          revision: String(revision),
          created_at: new Date(createdAt),
          expires_at: new Date(expiresAt),
          verified_at: null,
          verified_external_subject_id: null,
        };
        rows.set(requestId, row);
        return { rows: [row], rowCount: 1 };
      }

      if (
        normalized.startsWith("SELECT request_id, tenant_id") &&
        normalized.includes("FROM identity.channel_link_challenges")
      ) {
        const [requestId] = values as string[];
        const row = rows.get(requestId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (normalized.startsWith("UPDATE identity.channel_link_challenges")) {
        const [
          requestId,
          expectedRevision,
          state,
          attempts,
          revision,
          verifiedAt,
          verifiedExternalSubjectId,
        ] = values as any[];
        const current = rows.get(requestId);
        if (
          !current ||
          current.state !== "pending" ||
          Number(current.revision) !== expectedRevision
        ) {
          return { rows: [], rowCount: 0 };
        }
        const next = {
          ...current,
          state,
          attempts,
          revision: String(revision),
          verified_at: verifiedAt === null ? null : new Date(verifiedAt),
          verified_external_subject_id: verifiedExternalSubjectId,
        };
        rows.set(requestId, next);
        return { rows: [next], rowCount: 1 };
      }

      throw new Error(`Unhandled fake SQL: ${normalized}`);
    },
    release() {},
  };

  return {
    async connect() {
      return client as any;
    },
  } as unknown as Pool;
}

function fixture() {
  return {
    requestId: createCanonicalId("request"),
    tenantId: createCanonicalId("tenant"),
    channelAccountId: createCanonicalId("channel-account"),
    userId: createCanonicalId("user"),
    channel: "whatsapp" as const,
    secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
    createdAt: "2026-10-06T16:00:00.000Z" as never,
    expiresAt: "2026-10-06T16:10:00.000Z" as never,
  };
}

describe("Postgres channel-link challenge repository", () => {
  it("survives coordinator restart with attempt state intact", async () => {
    const pool = fakePool();
    const repository = createPostgresChannelLinkChallengeRepository(pool);
    const firstCoordinator = new ChannelLinkChallengeCoordinator({ repository });
    const input = fixture();

    await firstCoordinator.issue(input);

    const rejected = await firstCoordinator.verify({
      requestId: input.requestId,
      secret: "WRONGabcdefghijklmnopqrstuvwxyz123",
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: "wa:+2348012345678",
      attemptedAt: "2026-10-06T16:01:00.000Z" as never,
    });

    expect(rejected).toMatchObject({
      outcome: "rejected",
      reason: "invalid-secret",
      remainingAttempts: 4,
      challenge: {
        attempts: 1,
        revision: 2,
        state: "pending",
      },
    });

    const restartedCoordinator = new ChannelLinkChallengeCoordinator({
      repository: createPostgresChannelLinkChallengeRepository(pool),
    });

    const verified = await restartedCoordinator.verify({
      requestId: input.requestId,
      secret: input.secret,
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: "wa:+2348012345678",
      attemptedAt: "2026-10-06T16:02:00.000Z" as never,
    });

    expect(verified).toMatchObject({
      outcome: "verified",
      replay: false,
      challenge: {
        state: "verified",
        attempts: 2,
        revision: 3,
        verifiedExternalSubjectId: "wa:+2348012345678",
      },
      proof: {
        purpose: "account-link",
        method: "channel-possession-challenge",
      },
    });
  });

  it("returns stable verified replay after restart without another state advance", async () => {
    const pool = fakePool();
    const repository = createPostgresChannelLinkChallengeRepository(pool);
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });
    const input = fixture();

    await coordinator.issue(input);
    const first = await coordinator.verify({
      requestId: input.requestId,
      secret: input.secret,
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: "wa:+2348012345678",
      attemptedAt: "2026-10-06T16:01:00.000Z" as never,
    });

    const restarted = new ChannelLinkChallengeCoordinator({
      repository: createPostgresChannelLinkChallengeRepository(pool),
    });
    const replay = await restarted.verify({
      requestId: input.requestId,
      secret: input.secret,
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: "wa:+2348012345678",
      attemptedAt: "2026-10-06T16:02:00.000Z" as never,
    });

    expect(replay.outcome).toBe("verified");
    if (replay.outcome === "verified" && first.outcome === "verified") {
      expect(replay.replay).toBe(true);
      expect(replay.challenge).toEqual(first.challenge);
      expect(replay.proof).toEqual(first.proof);
    }
  });

  it("rejects conflicting create under the same RequestId", async () => {
    const pool = fakePool();
    const repository = createPostgresChannelLinkChallengeRepository(pool);
    const input = fixture();

    const first = createChannelLinkChallenge(input).challenge;
    await repository.create({ challenge: first });

    const changed = createChannelLinkChallenge({
      ...input,
      secret: "DIFFERENTabcdefghijklmnopqrstuvwxyz123",
    }).challenge;

    await expect(repository.create({ challenge: changed })).rejects.toThrow(
      "RequestId replay conflicted",
    );
  });

  it("persists terminal lock and refuses further CAS advancement", async () => {
    const pool = fakePool();
    const repository = createPostgresChannelLinkChallengeRepository(pool);
    const coordinator = new ChannelLinkChallengeCoordinator({ repository });
    const input = { ...fixture(), maxAttempts: 2 };

    await coordinator.issue(input);

    await coordinator.verify({
      requestId: input.requestId,
      secret: "WRONGabcdefghijklmnopqrstuvwxyz123",
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: "wa:+2348012345678",
      attemptedAt: "2026-10-06T16:01:00.000Z" as never,
    });
    const locked = await coordinator.verify({
      requestId: input.requestId,
      secret: "WRONG2abcdefghijklmnopqrstuvwxyz12",
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: "wa:+2348012345678",
      attemptedAt: "2026-10-06T16:02:00.000Z" as never,
    });

    expect(locked).toMatchObject({
      outcome: "rejected",
      reason: "locked",
      remainingAttempts: 0,
      challenge: { state: "locked", attempts: 2, revision: 3 },
    });

    const restarted = new ChannelLinkChallengeCoordinator({
      repository: createPostgresChannelLinkChallengeRepository(pool),
    });
    const replay = await restarted.verify({
      requestId: input.requestId,
      secret: input.secret,
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: "wa:+2348012345678",
      attemptedAt: "2026-10-06T16:03:00.000Z" as never,
    });

    expect(replay).toMatchObject({
      outcome: "rejected",
      reason: "locked",
      remainingAttempts: 0,
      challenge: { state: "locked", revision: 3 },
    });
  });
});
