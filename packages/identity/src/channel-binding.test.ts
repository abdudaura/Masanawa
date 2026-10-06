import { describe, expect, it } from "vitest";
import {
  activateChannelBinding,
  assertChannelBindingUsable,
  channelSubjectKey,
  createChannelAccount,
  createPendingChannelBinding,
  revokeChannelBinding,
  transitionChannelAccount,
} from "./channel-binding.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const channelAccountId =
  "channel-account_00000000-0000-7000-8000-000000000002" as never;
const userId = "user_00000000-0000-7000-8000-000000000003" as never;
const at = "2026-10-06T10:00:00.000Z" as never;

function account() {
  return createChannelAccount({
    tenantId,
    channelAccountId,
    channel: "whatsapp",
    providerAccountRef: " wa-business-account-1 ",
    createdAt: at,
  });
}

function pending() {
  return createPendingChannelBinding({
    account: account(),
    userId,
    externalSubjectId: " 2348012345678 ",
    createdAt: at,
  });
}

describe("channel binding lifecycle", () => {
  it("creates a canonical active ChannelAccount with normalized provider reference", () => {
    expect(account()).toMatchObject({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      providerAccountRef: "wa-business-account-1",
      state: "active",
      revision: 1,
    });
  });

  it("requires explicit proof before a pending subject becomes active", () => {
    const binding = activateChannelBinding({
      account: account(),
      binding: pending(),
      expectedRevision: 1,
      proof: {
        purpose: "account-link",
        method: "channel-possession-challenge",
        evidenceRef: "proof:wa:00000001",
        verifiedAt: "2026-10-06T10:01:00.000Z" as never,
      },
      activatedAt: "2026-10-06T10:02:00.000Z" as never,
    });
    expect(binding).toMatchObject({
      state: "active",
      externalSubjectId: "2348012345678",
      revision: 2,
    });
    expect(binding.proof?.purpose).toBe("account-link");
  });

  it("does not treat a pending transport subject as an authenticated user binding", () => {
    expect(() =>
      assertChannelBindingUsable({
        account: account(),
        binding: pending(),
        tenantId,
        externalSubjectId: "2348012345678",
      }),
    ).toThrow("proof-backed");
  });

  it("makes revoked accounts terminal while allowing disable and re-enable", () => {
    const disabled = transitionChannelAccount({
      account: account(),
      expectedRevision: 1,
      state: "disabled",
      changedAt: "2026-10-06T10:03:00.000Z" as never,
    });
    const enabled = transitionChannelAccount({
      account: disabled,
      expectedRevision: 2,
      state: "active",
      changedAt: "2026-10-06T10:04:00.000Z" as never,
    });
    const revoked = transitionChannelAccount({
      account: enabled,
      expectedRevision: 3,
      state: "revoked",
      changedAt: "2026-10-06T10:05:00.000Z" as never,
    });
    expect(revoked.state).toBe("revoked");
    expect(() =>
      transitionChannelAccount({
        account: revoked,
        expectedRevision: 4,
        state: "active",
        changedAt: "2026-10-06T10:06:00.000Z" as never,
      }),
    ).toThrow("terminal");
  });

  it("revokes a user binding without changing its stable subject identity", () => {
    const active = activateChannelBinding({
      account: account(),
      binding: pending(),
      expectedRevision: 1,
      proof: {
        purpose: "account-link",
        method: "authenticated-cross-channel-confirmation",
        evidenceRef: "proof:cross:0001",
        verifiedAt: at,
      },
      activatedAt: "2026-10-06T10:01:00.000Z" as never,
    });
    const revoked = revokeChannelBinding({
      binding: active,
      expectedRevision: 2,
      revokedAt: "2026-10-06T10:02:00.000Z" as never,
    });
    expect(revoked.state).toBe("revoked");
    expect(revoked.externalSubjectId).toBe(active.externalSubjectId);
    expect(revoked.userId).toBe(active.userId);
  });

  it("fails closed for tenant/account mismatch and changed external subject", () => {
    const active = activateChannelBinding({
      account: account(),
      binding: pending(),
      expectedRevision: 1,
      proof: {
        purpose: "account-link",
        method: "channel-possession-challenge",
        evidenceRef: "proof:wa:00000002",
        verifiedAt: at,
      },
      activatedAt: "2026-10-06T10:01:00.000Z" as never,
    });
    expect(() =>
      assertChannelBindingUsable({
        account: account(),
        binding: active,
        tenantId: "tenant_00000000-0000-7000-8000-000000000999" as never,
        externalSubjectId: active.externalSubjectId,
      }),
    ).toThrow("different tenant");
    expect(() =>
      assertChannelBindingUsable({
        account: account(),
        binding: active,
        tenantId,
        externalSubjectId: "different-subject",
      }),
    ).toThrow("does not match");
  });

  it("provides a stable account-scoped subject uniqueness key", () => {
    expect(
      channelSubjectKey({
        channelAccountId,
        externalSubjectId: " user:+234 80/123 ",
      }),
    ).toBe(
      "channel-account_00000000-0000-7000-8000-000000000002:user%3A%2B234%2080%2F123",
    );
  });

  it("rejects stale lifecycle revisions and future proof timestamps", () => {
    expect(() =>
      transitionChannelAccount({
        account: account(),
        expectedRevision: 2,
        state: "disabled",
        changedAt: at,
      }),
    ).toThrow("stale");

    expect(() =>
      activateChannelBinding({
        account: account(),
        binding: pending(),
        expectedRevision: 1,
        proof: {
          purpose: "account-link",
          method: "channel-possession-challenge",
          evidenceRef: "proof:wa:00000003",
          verifiedAt: "2026-10-06T11:00:00.000Z" as never,
        },
        activatedAt: "2026-10-06T10:00:00.000Z" as never,
      }),
    ).toThrow("future");
  });
});
