import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createChannelLinkChallenge,
  verifyChannelLinkChallenge,
} from "./channel-link-challenge.js";

const requestId = createCanonicalId("request");
const tenantId = createCanonicalId("tenant");
const channelAccountId = createCanonicalId("channel-account");
const userId = createCanonicalId("user");
const createdAt = toInstant("2026-10-06T15:00:00.000Z");
const expiresAt = toInstant("2026-10-06T15:10:00.000Z");
const secret = "AbCdEfGhIjKlMnOpQrStUvWxYz_12345";

function issuance(maxAttempts = 3) {
  return createChannelLinkChallenge({
    requestId,
    tenantId,
    channelAccountId,
    channel: "telegram",
    userId,
    secret,
    createdAt,
    expiresAt,
    maxAttempts,
  });
}

describe("channel possession challenge", () => {
  it("issues one plaintext secret but stores only scoped SHA-256 custody", () => {
    const result = issuance();
    expect(result.secret).toBe(secret);
    expect(result.challenge).toMatchObject({
      requestId,
      tenantId,
      channelAccountId,
      channel: "telegram",
      userId,
      state: "pending",
      attempts: 0,
      maxAttempts: 3,
      revision: 1,
      verifiedAt: null,
      verifiedExternalSubjectId: null,
    });
    expect(result.challenge.secretHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(JSON.stringify(result.challenge)).not.toContain(secret);
  });

  it("binds the same secret to exact request tenant account channel and user scope", () => {
    const first = issuance().challenge;
    const second = createChannelLinkChallenge({
      requestId: createCanonicalId("request"),
      tenantId,
      channelAccountId,
      channel: "telegram",
      userId,
      secret,
      createdAt,
      expiresAt,
    }).challenge;
    expect(second.secretHash).not.toBe(first.secretHash);
  });

  it("verifies a correct secret once and returns canonical linking proof", () => {
    const initial = issuance().challenge;
    const result = verifyChannelLinkChallenge({
      challenge: initial,
      expectedRevision: 1,
      secret,
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: toInstant("2026-10-06T15:01:00.000Z"),
    });

    expect(result.outcome).toBe("verified");
    if (result.outcome !== "verified") throw new Error("expected verified");
    expect(result.replay).toBe(false);
    expect(result.challenge).toMatchObject({
      state: "verified",
      attempts: 1,
      revision: 2,
      verifiedExternalSubjectId: "123456789",
    });
    expect(result.proof).toMatchObject({
      purpose: "account-link",
      method: "channel-possession-challenge",
      evidenceRef: `channel-link:${requestId}`,
    });
  });

  it("supports exact success replay but rejects another subject", () => {
    const verified = verifyChannelLinkChallenge({
      challenge: issuance().challenge,
      expectedRevision: 1,
      secret,
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: toInstant("2026-10-06T15:01:00.000Z"),
    });
    if (verified.outcome !== "verified") throw new Error("expected verified");

    const replay = verifyChannelLinkChallenge({
      challenge: verified.challenge,
      expectedRevision: verified.challenge.revision,
      secret,
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: toInstant("2026-10-06T15:02:00.000Z"),
    });
    expect(replay).toMatchObject({ outcome: "verified", replay: true });

    expect(() =>
      verifyChannelLinkChallenge({
        challenge: verified.challenge,
        expectedRevision: verified.challenge.revision,
        secret,
        channel: "telegram",
        channelAccountId,
        externalSubjectId: "999999999",
        attemptedAt: toInstant("2026-10-06T15:02:00.000Z"),
      }),
    ).toThrow(/replay does not match/);
  });

  it("increments failed attempts and locks exactly at the configured limit", () => {
    const first = verifyChannelLinkChallenge({
      challenge: issuance(2).challenge,
      expectedRevision: 1,
      secret: "WrongSecret_123456789012345",
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: toInstant("2026-10-06T15:01:00.000Z"),
    });
    expect(first).toMatchObject({
      outcome: "rejected",
      reason: "invalid-secret",
      remainingAttempts: 1,
    });

    const second = verifyChannelLinkChallenge({
      challenge: first.challenge,
      expectedRevision: first.challenge.revision,
      secret: "AnotherWrong_12345678901234",
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: toInstant("2026-10-06T15:02:00.000Z"),
    });
    expect(second).toMatchObject({
      outcome: "rejected",
      reason: "locked",
      remainingAttempts: 0,
      challenge: { state: "locked", attempts: 2 },
    });

    const locked = verifyChannelLinkChallenge({
      challenge: second.challenge,
      expectedRevision: second.challenge.revision,
      secret,
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: toInstant("2026-10-06T15:03:00.000Z"),
    });
    expect(locked).toMatchObject({
      outcome: "rejected",
      reason: "locked",
      remainingAttempts: 0,
    });
  });

  it("expires at the exact expiry instant and never verifies afterwards", () => {
    const result = verifyChannelLinkChallenge({
      challenge: issuance().challenge,
      expectedRevision: 1,
      secret,
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: expiresAt,
    });

    expect(result).toMatchObject({
      outcome: "rejected",
      reason: "expired",
      challenge: { state: "expired", revision: 2 },
    });
  });

  it("rejects stale revisions and channel/account substitution", () => {
    const challenge = issuance().challenge;

    expect(() =>
      verifyChannelLinkChallenge({
        challenge,
        expectedRevision: 2,
        secret,
        channel: "telegram",
        channelAccountId,
        externalSubjectId: "123456789",
        attemptedAt: toInstant("2026-10-06T15:01:00.000Z"),
      }),
    ).toThrow(/revision is stale/);

    expect(() =>
      verifyChannelLinkChallenge({
        challenge,
        expectedRevision: 1,
        secret,
        channel: "whatsapp",
        channelAccountId,
        externalSubjectId: "123456789",
        attemptedAt: toInstant("2026-10-06T15:01:00.000Z"),
      }),
    ).toThrow(/scope does not match/);
  });

  it("rejects attempts before creation and malformed low-entropy secrets", () => {
    expect(() =>
      verifyChannelLinkChallenge({
        challenge: issuance().challenge,
        expectedRevision: 1,
        secret,
        channel: "telegram",
        channelAccountId,
        externalSubjectId: "123456789",
        attemptedAt: toInstant("2026-10-06T14:59:59.000Z"),
      }),
    ).toThrow(/predates/);

    expect(() =>
      createChannelLinkChallenge({
        requestId,
        tenantId,
        channelAccountId,
        channel: "telegram",
        userId,
        secret: "too-short",
        createdAt,
        expiresAt,
      }),
    ).toThrow(/high-entropy/);
  });

  it("never exposes the raw secret through proof or challenge JSON", () => {
    const verified = verifyChannelLinkChallenge({
      challenge: issuance().challenge,
      expectedRevision: 1,
      secret,
      channel: "telegram",
      channelAccountId,
      externalSubjectId: "123456789",
      attemptedAt: toInstant("2026-10-06T15:01:00.000Z"),
    });
    expect(JSON.stringify(verified)).not.toContain(secret);
  });
});
