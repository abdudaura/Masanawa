import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  activateChannelBinding,
  createChannelAccount,
  createPendingChannelBinding,
  revokeChannelBinding,
  transitionChannelAccount,
  type ChannelAccount,
  type ChannelBindingRepository,
  type UserChannelBinding,
} from "./channel-binding.js";
import { createChannelIdentityResolver } from "./channel-identity-resolution.js";

const tenantId = createCanonicalId("tenant");
const channelAccountId = createCanonicalId("channel-account");
const userId = createCanonicalId("user");
const at = toInstant("2026-10-06T16:00:00.000Z");

function account(): ChannelAccount {
  return createChannelAccount({
    tenantId,
    channelAccountId,
    channel: "whatsapp",
    providerAccountRef: "wa-business-1",
    createdAt: at,
  });
}

function pending(): UserChannelBinding {
  return createPendingChannelBinding({
    account: account(),
    userId,
    externalSubjectId: "2348012345678",
    createdAt: at,
  });
}

function active(): UserChannelBinding {
  return activateChannelBinding({
    account: account(),
    binding: pending(),
    expectedRevision: 1,
    proof: {
      purpose: "account-link",
      method: "channel-possession-challenge",
      evidenceRef: "channel-link:request-123",
      verifiedAt: toInstant("2026-10-06T16:01:00.000Z"),
    },
    activatedAt: toInstant("2026-10-06T16:01:01.000Z"),
  });
}

function repository(input: {
  account?: ChannelAccount | null;
  binding?: UserChannelBinding | null;
  throwRead?: boolean;
} = {}): ChannelBindingRepository {
  const storedAccount = input.account === undefined ? account() : input.account;
  const storedBinding = input.binding === undefined ? active() : input.binding;
  return {
    async createAccount(value) {
      return createChannelAccount(value);
    },
    async readAccount() {
      if (input.throwRead) throw new Error("database unavailable");
      return storedAccount;
    },
    async createPendingBinding(value) {
      return createPendingChannelBinding(value);
    },
    async readBindingBySubject() {
      if (input.throwRead) throw new Error("database unavailable");
      return storedBinding;
    },
    async readActiveBindingForUser() {
      return storedBinding?.state === "active" ? storedBinding : null;
    },
    async putAccount(value) {
      return value;
    },
    async putBinding(value) {
      return value;
    },
  };
}

describe("proof-backed channel identity resolution", () => {
  it("resolves only an active proof-backed binding to canonical User identity", async () => {
    const result = await createChannelIdentityResolver({
      repository: repository(),
    }).resolve({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "2348012345678",
    });

    expect(result).toMatchObject({
      status: "resolved",
      identity: {
        tenantId,
        channelAccountId,
        channel: "whatsapp",
        userId,
        externalSubjectId: "2348012345678",
        bindingRevision: 2,
        proof: {
          purpose: "account-link",
          method: "channel-possession-challenge",
        },
      },
    });
  });

  it("does not treat a transport-verified pending subject as a User", async () => {
    const result = await createChannelIdentityResolver({
      repository: repository({ binding: pending() }),
    }).resolve({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "2348012345678",
    });

    expect(result).toEqual({
      status: "unlinked",
      reason: "binding-unusable",
    });
  });

  it("rejects revoked bindings", async () => {
    const value = revokeChannelBinding({
      binding: active(),
      expectedRevision: 2,
      revokedAt: toInstant("2026-10-06T16:02:00.000Z"),
    });
    const result = await createChannelIdentityResolver({
      repository: repository({ binding: value }),
    }).resolve({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "2348012345678",
    });

    expect(result).toEqual({
      status: "unlinked",
      reason: "binding-unusable",
    });
  });

  it("rejects disabled channel accounts before binding authority is considered", async () => {
    const disabled = transitionChannelAccount({
      account: account(),
      expectedRevision: 1,
      state: "disabled",
      changedAt: toInstant("2026-10-06T16:03:00.000Z"),
    });
    const result = await createChannelIdentityResolver({
      repository: repository({ account: disabled }),
    }).resolve({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "2348012345678",
    });

    expect(result).toEqual({
      status: "unlinked",
      reason: "account-unavailable",
    });
  });

  it("returns explicit not-found outcomes without inventing identity", async () => {
    const resolver = createChannelIdentityResolver({
      repository: repository({ account: null }),
    });
    await expect(
      resolver.resolve({
        tenantId,
        channelAccountId,
        channel: "whatsapp",
        externalSubjectId: "2348012345678",
      }),
    ).resolves.toEqual({
      status: "unlinked",
      reason: "account-not-found",
    });

    const bindingResolver = createChannelIdentityResolver({
      repository: repository({ binding: null }),
    });
    await expect(
      bindingResolver.resolve({
        tenantId,
        channelAccountId,
        channel: "whatsapp",
        externalSubjectId: "2348012345678",
      }),
    ).resolves.toEqual({
      status: "unlinked",
      reason: "binding-not-found",
    });
  });

  it("rejects cross-channel routing even when account ids are reused incorrectly", async () => {
    const result = await createChannelIdentityResolver({
      repository: repository(),
    }).resolve({
      tenantId,
      channelAccountId,
      channel: "telegram",
      externalSubjectId: "2348012345678",
    });

    expect(result).toEqual({
      status: "unlinked",
      reason: "account-unavailable",
    });
  });

  it("rejects changed subject evidence", async () => {
    const result = await createChannelIdentityResolver({
      repository: repository(),
    }).resolve({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      externalSubjectId: "2348099999999",
    });

    expect(result).toEqual({
      status: "unlinked",
      reason: "binding-unusable",
    });
  });

  it("propagates repository outages instead of misclassifying them as unlinked", async () => {
    const resolver = createChannelIdentityResolver({
      repository: repository({ throwRead: true }),
    });

    await expect(
      resolver.resolve({
        tenantId,
        channelAccountId,
        channel: "whatsapp",
        externalSubjectId: "2348012345678",
      }),
    ).rejects.toThrow("database unavailable");
  });
});
