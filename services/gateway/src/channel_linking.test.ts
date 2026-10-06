import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  createChannelAccount,
  type ChannelAccount,
  type ChannelBindingRepository,
  type ChannelLinkChallenge,
  type ChannelLinkChallengeRepository,
  type UserChannelBinding,
} from "@masanawa/identity";
import { createChannelLinkingService } from "./channel_linking.js";

function challengeRepository(): ChannelLinkChallengeRepository {
  const records = new Map<string, ChannelLinkChallenge>();
  return {
    async create({ challenge }) {
      const existing = records.get(challenge.requestId);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(challenge)) {
          throw new Error("challenge create conflict");
        }
        return existing;
      }
      records.set(challenge.requestId, challenge);
      return challenge;
    },
    async load({ requestId }) {
      return records.get(requestId) ?? null;
    },
    async compareAndSet({ requestId, expectedRevision, next }) {
      const current = records.get(requestId);
      if (!current || current.revision !== expectedRevision) {
        throw new Error("stale challenge revision");
      }
      records.set(requestId, next);
      return next;
    },
  };
}

function bindingRepository(account: ChannelAccount): ChannelBindingRepository {
  const bindings = new Map<string, UserChannelBinding>();
  return {
    async createAccount(input) {
      return createChannelAccount(input);
    },
    async readAccount(input) {
      return (
        input.tenantId === account.tenantId &&
        input.channelAccountId === account.channelAccountId
      )
        ? account
        : null;
    },
    async createPendingBinding(input) {
      const key = input.externalSubjectId.trim();
      const existing = bindings.get(key);
      if (existing) {
        if (
          existing.userId !== input.userId ||
          existing.channelAccountId !== input.account.channelAccountId
        ) {
          throw new Error("binding create conflict");
        }
        return existing;
      }
      const value: UserChannelBinding = Object.freeze({
        tenantId: input.account.tenantId,
        channelAccountId: input.account.channelAccountId,
        channel: input.account.channel,
        userId: input.userId,
        externalSubjectId: key,
        state: "pending-proof",
        proof: null,
        revision: 1,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      bindings.set(key, value);
      return value;
    },
    async readBindingBySubject(input) {
      return bindings.get(input.externalSubjectId.trim()) ?? null;
    },
    async readActiveBindingForUser(input) {
      return (
        [...bindings.values()].find(
          (value) =>
            value.tenantId === input.tenantId &&
            value.channelAccountId === input.channelAccountId &&
            value.userId === input.userId &&
            value.state === "active",
        ) ?? null
      );
    },
    async putAccount(value) {
      return value;
    },
    async putBinding(value) {
      const key = value.externalSubjectId;
      const existing = bindings.get(key);
      if (!existing || value.revision !== existing.revision + 1) {
        throw new Error("binding revision stale");
      }
      bindings.set(key, value);
      return value;
    },
  };
}

function fixture() {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");
  const channelAccountId = createCanonicalId("channel-account");
  const account = createChannelAccount({
    tenantId,
    channelAccountId,
    channel: "whatsapp",
    providerAccountRef: "wa-business-001",
    createdAt: toInstant("2026-10-06T16:00:00.000Z"),
  });
  return { tenantId, userId, channelAccountId, account };
}

describe("Gateway channel linking service", () => {
  it("issues one secret per RequestId and exact issue retry does not remint", async () => {
    const f = fixture();
    const challenges = challengeRepository();
    const bindings = bindingRepository(f.account);
    let secretCalls = 0;
    const service = createChannelLinkingService({
      userAuthorizer: {
        async authorize() {
          return { tenantId: f.tenantId, userId: f.userId };
        },
      },
      transportAuthorizer: {
        async authorize(input) {
          return {
            tenantId: f.tenantId,
            channelAccountId: input.channelAccountId,
            channel: input.channel,
            externalSubjectId: input.externalSubjectId,
          };
        },
      },
      bindings,
      challenges,
      now: () => toInstant("2026-10-06T16:01:00.000Z"),
      secretFactory: () => {
        secretCalls++;
        return "abcdefghijklmnopqrstuvwxyzABCDE123456";
      },
    });

    const requestId = createCanonicalId("request");
    const first = await service.issue({
      authorizationHeader: "Bearer user",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
    });
    expect(first).toMatchObject({
      status: "issued",
      requestId,
      secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });

    const replay = await service.issue({
      authorizationHeader: "Bearer user",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
    });
    expect(replay).toMatchObject({
      status: "already-issued",
      requestId,
    });
    expect(replay).not.toHaveProperty("secret");
    expect(secretCalls).toBe(1);
  });

  it("verifies transport-scoped possession, activates binding and resolves canonical User", async () => {
    const f = fixture();
    const challenges = challengeRepository();
    const bindings = bindingRepository(f.account);
    let currentTime = "2026-10-06T16:01:00.000Z";
    const service = createChannelLinkingService({
      userAuthorizer: {
        async authorize() {
          return { tenantId: f.tenantId, userId: f.userId };
        },
      },
      transportAuthorizer: {
        async authorize(input) {
          expect(input.transportEvidence).toBe("verified-webhook-evidence");
          return {
            tenantId: f.tenantId,
            channelAccountId: input.channelAccountId,
            channel: input.channel,
            externalSubjectId: input.externalSubjectId,
          };
        },
      },
      bindings,
      challenges,
      now: () => toInstant(currentTime),
      secretFactory: () => "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });

    const requestId = createCanonicalId("request");
    await service.issue({
      authorizationHeader: "Bearer user",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
    });

    currentTime = "2026-10-06T16:02:00.000Z";
    const linked = await service.verify({
      transportEvidence: "verified-webhook-evidence",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "wa:+2348012345678",
      secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });

    expect(linked).toMatchObject({
      status: "linked",
      replay: false,
      binding: {
        tenantId: f.tenantId,
        channelAccountId: f.channelAccountId,
        channel: "whatsapp",
        userId: f.userId,
        externalSubjectId: "wa:+2348012345678",
        state: "active",
        proof: {
          purpose: "account-link",
          method: "channel-possession-challenge",
        },
      },
    });

    const resolved = await service.resolve({
      tenantId: f.tenantId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "wa:+2348012345678",
    });
    expect(resolved).toMatchObject({
      status: "resolved",
      identity: {
        userId: f.userId,
        externalSubjectId: "wa:+2348012345678",
      },
    });
  });

  it("returns the same active binding on exact verified retry", async () => {
    const f = fixture();
    const challenges = challengeRepository();
    const bindings = bindingRepository(f.account);
    let currentTime = "2026-10-06T16:01:00.000Z";
    const service = createChannelLinkingService({
      userAuthorizer: {
        async authorize() {
          return { tenantId: f.tenantId, userId: f.userId };
        },
      },
      transportAuthorizer: {
        async authorize(input) {
          return {
            tenantId: f.tenantId,
            channelAccountId: input.channelAccountId,
            channel: input.channel,
            externalSubjectId: input.externalSubjectId,
          };
        },
      },
      bindings,
      challenges,
      now: () => toInstant(currentTime),
      secretFactory: () => "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });

    const requestId = createCanonicalId("request");
    await service.issue({
      authorizationHeader: "Bearer user",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
    });

    currentTime = "2026-10-06T16:02:00.000Z";
    const first = await service.verify({
      transportEvidence: "verified-webhook-evidence",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "wa:+2348012345678",
      secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });
    currentTime = "2026-10-06T16:03:00.000Z";
    const replay = await service.verify({
      transportEvidence: "verified-webhook-evidence",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "wa:+2348012345678",
      secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });

    expect(replay).toMatchObject({ status: "linked", replay: true });
    if (first.status === "linked" && replay.status === "linked") {
      expect(replay.binding).toEqual(first.binding);
    }
  });

  it("rejects transport authority that changes Tenant or subject scope", async () => {
    const f = fixture();
    const challenges = challengeRepository();
    const bindings = bindingRepository(f.account);
    const service = createChannelLinkingService({
      userAuthorizer: {
        async authorize() {
          return { tenantId: f.tenantId, userId: f.userId };
        },
      },
      transportAuthorizer: {
        async authorize(input) {
          return {
            tenantId: createCanonicalId("tenant"),
            channelAccountId: input.channelAccountId,
            channel: input.channel,
            externalSubjectId: input.externalSubjectId,
          };
        },
      },
      bindings,
      challenges,
      now: () => toInstant("2026-10-06T16:02:00.000Z"),
      secretFactory: () => "abcdefghijklmnopqrstuvwxyzABCDE123456",
    });

    const requestId = createCanonicalId("request");
    await service.issue({
      authorizationHeader: "Bearer user",
      requestId,
      channelAccountId: f.channelAccountId,
      channel: "whatsapp",
    });

    await expect(
      service.verify({
        transportEvidence: "verified-webhook-evidence",
        requestId,
        channelAccountId: f.channelAccountId,
        channel: "whatsapp",
        externalSubjectId: "wa:+2348012345678",
        secret: "abcdefghijklmnopqrstuvwxyzABCDE123456",
      }),
    ).rejects.toThrow("outside transport authority");
  });
});
