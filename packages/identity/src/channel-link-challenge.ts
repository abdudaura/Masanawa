import { createHash, timingSafeEqual } from "node:crypto";
import {
  isCanonicalId,
  toInstant,
  type ChannelAccountId,
  type Instant,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import type {
  ChannelBindingProof,
  LaunchChannelKind,
} from "./channel-binding.js";

export const channelLinkChallengeStates = [
  "pending",
  "verified",
  "locked",
  "expired",
] as const;
export type ChannelLinkChallengeState =
  (typeof channelLinkChallengeStates)[number];

export interface ChannelLinkChallenge {
  readonly requestId: RequestId;
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly userId: UserId;
  readonly secretHash: string;
  readonly state: ChannelLinkChallengeState;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
  readonly verifiedAt: Instant | null;
  readonly verifiedExternalSubjectId: string | null;
}

export interface ChannelLinkChallengeIssuance {
  readonly challenge: ChannelLinkChallenge;
  /**
   * One-time plaintext value for delivery to the authenticated Masanawa user.
   * Persist only challenge.secretHash, never this secret.
   */
  readonly secret: string;
}

export type ChannelLinkChallengeVerification =
  | Readonly<{
      outcome: "verified";
      challenge: ChannelLinkChallenge;
      proof: ChannelBindingProof;
      replay: boolean;
    }>
  | Readonly<{
      outcome: "rejected";
      challenge: ChannelLinkChallenge;
      reason: "invalid-secret" | "expired" | "locked";
      remainingAttempts: number;
    }>;

const secretPattern = /^[A-Za-z0-9_-]+$/u;
const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > max ||
    normalized.includes("\u0000")
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function secret(value: string): string {
  const normalized = bounded(value, "secret", 128);
  if (normalized.length < 20 || !secretPattern.test(normalized)) {
    throw new TypeError("secret must be a high-entropy base64url-like value");
  }
  return normalized;
}

function channel(value: LaunchChannelKind): LaunchChannelKind {
  if (value !== "whatsapp" && value !== "telegram") {
    throw new TypeError("channel is invalid");
  }
  return value;
}

function attempts(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function assertIds(input: {
  readonly requestId: RequestId;
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly userId: UserId;
}): void {
  if (!isCanonicalId("request", input.requestId)) {
    throw new TypeError("requestId is invalid");
  }
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("tenantId is invalid");
  }
  if (!isCanonicalId("channel-account", input.channelAccountId)) {
    throw new TypeError("channelAccountId is invalid");
  }
  if (!isCanonicalId("user", input.userId)) {
    throw new TypeError("userId is invalid");
  }
}

function scopePayload(input: {
  readonly requestId: RequestId;
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly userId: UserId;
  readonly secret: string;
}): string {
  return [
    input.requestId,
    input.tenantId,
    input.channelAccountId,
    input.channel,
    input.userId,
    input.secret,
  ].join("\n");
}

function hashSecret(input: {
  readonly requestId: RequestId;
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly userId: UserId;
  readonly secret: string;
}): string {
  return `sha256:${createHash("sha256")
    .update(scopePayload(input), "utf8")
    .digest("hex")}`;
}

function secretMatches(challenge: ChannelLinkChallenge, candidate: string): boolean {
  const expected = challenge.secretHash;
  if (!sha256Pattern.test(expected)) {
    throw new TypeError("challenge secretHash is invalid");
  }
  const actual = hashSecret({
    requestId: challenge.requestId,
    tenantId: challenge.tenantId,
    channelAccountId: challenge.channelAccountId,
    channel: challenge.channel,
    userId: challenge.userId,
    secret: candidate,
  });
  return timingSafeEqual(
    Buffer.from(expected.slice("sha256:".length), "hex"),
    Buffer.from(actual.slice("sha256:".length), "hex"),
  );
}

function normalizeChallenge(
  input: ChannelLinkChallenge,
): ChannelLinkChallenge {
  assertIds(input);
  const createdAt = toInstant(input.createdAt);
  const expiresAt = toInstant(input.expiresAt);
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new TypeError("challenge expiry must be after creation");
  }
  const maxAttempts = attempts(input.maxAttempts, "maxAttempts", 1, 10);
  const observedAttempts = attempts(input.attempts, "attempts", 0, maxAttempts);
  if (!sha256Pattern.test(input.secretHash)) {
    throw new TypeError("challenge secretHash is invalid");
  }
  if (!channelLinkChallengeStates.includes(input.state)) {
    throw new TypeError("challenge state is invalid");
  }
  const revision = attempts(input.revision, "revision", 1, 1_000_000_000);
  const verifiedAt =
    input.verifiedAt === null ? null : toInstant(input.verifiedAt);
  const verifiedExternalSubjectId =
    input.verifiedExternalSubjectId === null
      ? null
      : bounded(
          input.verifiedExternalSubjectId,
          "verifiedExternalSubjectId",
          512,
        );

  if (input.state === "verified") {
    if (verifiedAt === null || verifiedExternalSubjectId === null) {
      throw new TypeError("verified challenge requires verification evidence");
    }
    if (
      Date.parse(verifiedAt) < Date.parse(createdAt) ||
      Date.parse(verifiedAt) > Date.parse(expiresAt)
    ) {
      throw new TypeError("verifiedAt is outside the challenge lifetime");
    }
  } else if (
    verifiedAt !== null ||
    verifiedExternalSubjectId !== null
  ) {
    throw new TypeError("unverified challenge cannot carry verification evidence");
  }

  if (input.state === "locked" && observedAttempts < maxAttempts) {
    throw new TypeError("locked challenge must exhaust its attempt limit");
  }
  if (input.state === "pending" && observedAttempts >= maxAttempts) {
    throw new TypeError("pending challenge cannot exhaust its attempt limit");
  }
  if (input.state === "verified" && observedAttempts < 1) {
    throw new TypeError("verified challenge must record a successful attempt");
  }

  return Object.freeze({
    requestId: input.requestId,
    tenantId: input.tenantId,
    channelAccountId: input.channelAccountId,
    channel: channel(input.channel),
    userId: input.userId,
    secretHash: input.secretHash,
    state: input.state,
    attempts: observedAttempts,
    maxAttempts,
    revision,
    createdAt,
    expiresAt,
    verifiedAt,
    verifiedExternalSubjectId,
  });
}

export function createChannelLinkChallenge(input: {
  readonly requestId: RequestId;
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly userId: UserId;
  readonly secret: string;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
  readonly maxAttempts?: number;
}): ChannelLinkChallengeIssuance {
  assertIds(input);
  const issuedSecret = secret(input.secret);
  const createdAt = toInstant(input.createdAt);
  const expiresAt = toInstant(input.expiresAt);
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new TypeError("challenge expiry must be after creation");
  }
  const maxAttempts = attempts(input.maxAttempts ?? 5, "maxAttempts", 1, 10);

  const challenge = normalizeChallenge({
    requestId: input.requestId,
    tenantId: input.tenantId,
    channelAccountId: input.channelAccountId,
    channel: channel(input.channel),
    userId: input.userId,
    secretHash: hashSecret({
      requestId: input.requestId,
      tenantId: input.tenantId,
      channelAccountId: input.channelAccountId,
      channel: input.channel,
      userId: input.userId,
      secret: issuedSecret,
    }),
    state: "pending",
    attempts: 0,
    maxAttempts,
    revision: 1,
    createdAt,
    expiresAt,
    verifiedAt: null,
    verifiedExternalSubjectId: null,
  });

  return Object.freeze({
    challenge,
    secret: issuedSecret,
  });
}

function proofFor(challenge: ChannelLinkChallenge): ChannelBindingProof {
  if (
    challenge.state !== "verified" ||
    challenge.verifiedAt === null ||
    challenge.verifiedExternalSubjectId === null
  ) {
    throw new TypeError("challenge is not verified");
  }
  return Object.freeze({
    purpose: "account-link",
    method: "channel-possession-challenge",
    evidenceRef: `channel-link:${challenge.requestId}`,
    verifiedAt: challenge.verifiedAt,
  });
}

export function verifyChannelLinkChallenge(input: {
  readonly challenge: ChannelLinkChallenge;
  readonly expectedRevision: number;
  readonly secret: string;
  readonly channel: LaunchChannelKind;
  readonly channelAccountId: ChannelAccountId;
  readonly externalSubjectId: string;
  readonly attemptedAt: Instant;
}): ChannelLinkChallengeVerification {
  const current = normalizeChallenge(input.challenge);
  const expectedRevision = attempts(
    input.expectedRevision,
    "expectedRevision",
    1,
    1_000_000_000,
  );
  if (expectedRevision !== current.revision) {
    throw new Error("Channel link challenge revision is stale");
  }
  if (
    input.channel !== current.channel ||
    input.channelAccountId !== current.channelAccountId
  ) {
    throw new Error("Channel link challenge scope does not match");
  }

  const attemptedAt = toInstant(input.attemptedAt);
  if (Date.parse(attemptedAt) < Date.parse(current.createdAt)) {
    throw new Error("Channel link attempt predates challenge creation");
  }
  const externalSubjectId = bounded(
    input.externalSubjectId,
    "externalSubjectId",
    512,
  );
  const candidate = secret(input.secret);

  if (current.state === "verified") {
    if (
      current.verifiedExternalSubjectId !== externalSubjectId ||
      !secretMatches(current, candidate)
    ) {
      throw new Error("Verified channel link challenge replay does not match");
    }
    return Object.freeze({
      outcome: "verified" as const,
      challenge: current,
      proof: proofFor(current),
      replay: true,
    });
  }

  if (current.state === "locked") {
    return Object.freeze({
      outcome: "rejected" as const,
      challenge: current,
      reason: "locked" as const,
      remainingAttempts: 0,
    });
  }

  if (
    current.state === "expired" ||
    Date.parse(attemptedAt) >= Date.parse(current.expiresAt)
  ) {
    const expired =
      current.state === "expired"
        ? current
        : normalizeChallenge({
            ...current,
            state: "expired",
            revision: current.revision + 1,
          });
    return Object.freeze({
      outcome: "rejected" as const,
      challenge: expired,
      reason: "expired" as const,
      remainingAttempts: Math.max(
        0,
        expired.maxAttempts - expired.attempts,
      ),
    });
  }

  if (!secretMatches(current, candidate)) {
    const nextAttempts = current.attempts + 1;
    const locked = nextAttempts >= current.maxAttempts;
    const next = normalizeChallenge({
      ...current,
      state: locked ? "locked" : "pending",
      attempts: nextAttempts,
      revision: current.revision + 1,
    });
    return Object.freeze({
      outcome: "rejected" as const,
      challenge: next,
      reason: locked ? ("locked" as const) : ("invalid-secret" as const),
      remainingAttempts: Math.max(0, next.maxAttempts - next.attempts),
    });
  }

  const verified = normalizeChallenge({
    ...current,
    state: "verified",
    attempts: current.attempts + 1,
    revision: current.revision + 1,
    verifiedAt: attemptedAt,
    verifiedExternalSubjectId: externalSubjectId,
  });

  return Object.freeze({
    outcome: "verified" as const,
    challenge: verified,
    proof: proofFor(verified),
    replay: false,
  });
}
