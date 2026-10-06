import {
  isCanonicalId,
  toInstant,
  type DeviceCredentialId,
  type DeviceId,
  type Instant,
  type RequestId,
  type TenantId,
} from "@masanawa/contracts";
import {
  createAuthenticationEvidence,
  type AuthenticationEvidence,
} from "./authentication.js";

export type DeviceOperationalCredentialState = "active" | "revoked";
export type DeviceReconnectChallengeState =
  | "pending"
  | "consumed"
  | "expired";

export interface DeviceOperationalCredential {
  readonly tenantId: TenantId;
  readonly deviceCredentialId: DeviceCredentialId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly state: DeviceOperationalCredentialState;
  readonly verificationKeyRef: string;
  readonly keyFingerprint: string;
  readonly issuedAt: Instant;
  readonly expiresAt: Instant;
  readonly revokedAt: Instant | null;
  readonly revision: number;
}

export interface DeviceReconnectChallenge {
  readonly tenantId: TenantId;
  readonly requestId: RequestId;
  readonly deviceId: DeviceId;
  readonly deviceCredentialId: DeviceCredentialId;
  readonly credentialGeneration: number;
  readonly challengeDigest: string;
  readonly state: DeviceReconnectChallengeState;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
  readonly consumedAt: Instant | null;
  readonly revision: number;
}

export interface DeviceReconnectProofVerifier {
  verify(input: {
    readonly verificationKeyRef: string;
    readonly keyFingerprint: string;
    readonly tenantId: TenantId;
    readonly deviceId: DeviceId;
    readonly deviceCredentialId: DeviceCredentialId;
    readonly credentialGeneration: number;
    readonly requestId: RequestId;
    readonly challengeDigest: string;
    readonly proof: string;
  }): Promise<boolean>;
}

export interface CompleteDeviceReconnectInput {
  readonly credential: DeviceOperationalCredential;
  readonly challenge: DeviceReconnectChallenge;
  readonly currentCredentialGeneration: number;
  readonly expectedChallengeRevision: number;
  readonly proof: string;
  readonly authenticatedAt: Instant;
}

export interface CompletedDeviceReconnect {
  readonly challenge: DeviceReconnectChallenge;
  readonly authentication: AuthenticationEvidence;
}

function bounded(
  value: string,
  name: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (
    normalized.length < minLength ||
    normalized.length > maxLength ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function positiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function requireDeviceCredentialId(
  value: DeviceCredentialId,
): DeviceCredentialId {
  if (!isCanonicalId("device-credential", value)) {
    throw new TypeError("deviceCredentialId is invalid");
  }
  return value;
}

function requireDeviceId(value: DeviceId): DeviceId {
  if (!isCanonicalId("device", value)) {
    throw new TypeError("deviceId is invalid");
  }
  return value;
}

function requireTenantId(value: TenantId): TenantId {
  if (!isCanonicalId("tenant", value)) {
    throw new TypeError("tenantId is invalid");
  }
  return value;
}

function requireRequestId(value: RequestId): RequestId {
  if (!isCanonicalId("request", value)) {
    throw new TypeError("requestId is invalid");
  }
  return value;
}

function assertChronology(
  earlier: Instant,
  later: Instant,
  message: string,
): void {
  if (Date.parse(later) <= Date.parse(earlier)) {
    throw new RangeError(message);
  }
}

export function createDeviceOperationalCredential(input: {
  readonly tenantId: TenantId;
  readonly deviceCredentialId: DeviceCredentialId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly verificationKeyRef: string;
  readonly keyFingerprint: string;
  readonly issuedAt: Instant;
  readonly expiresAt: Instant;
}): DeviceOperationalCredential {
  const issuedAt = toInstant(input.issuedAt);
  const expiresAt = toInstant(input.expiresAt);
  assertChronology(
    issuedAt,
    expiresAt,
    "Device credential expiry must follow issuance",
  );

  return Object.freeze({
    tenantId: requireTenantId(input.tenantId),
    deviceCredentialId: requireDeviceCredentialId(input.deviceCredentialId),
    deviceId: requireDeviceId(input.deviceId),
    generation: positiveSafeInteger(input.generation, "generation"),
    state: "active",
    verificationKeyRef: bounded(
      input.verificationKeyRef,
      "verificationKeyRef",
      8,
      512,
    ),
    keyFingerprint: bounded(
      input.keyFingerprint,
      "keyFingerprint",
      16,
      512,
    ),
    issuedAt,
    expiresAt,
    revokedAt: null,
    revision: 1,
  });
}

export function revokeDeviceOperationalCredential(input: {
  readonly credential: DeviceOperationalCredential;
  readonly expectedRevision: number;
  readonly revokedAt: Instant;
}): DeviceOperationalCredential {
  if (
    positiveSafeInteger(input.expectedRevision, "expectedRevision") !==
    input.credential.revision
  ) {
    throw new Error("Device credential revision is stale");
  }
  if (input.credential.state === "revoked") {
    return input.credential;
  }

  const revokedAt = toInstant(input.revokedAt);
  if (Date.parse(revokedAt) < Date.parse(input.credential.issuedAt)) {
    throw new RangeError("Device credential revocation cannot precede issuance");
  }

  return Object.freeze({
    ...input.credential,
    state: "revoked",
    revokedAt,
    revision: input.credential.revision + 1,
  });
}

export function rotateDeviceOperationalCredential(input: {
  readonly current: DeviceOperationalCredential;
  readonly expectedRevision: number;
  readonly deviceCredentialId: DeviceCredentialId;
  readonly verificationKeyRef: string;
  readonly keyFingerprint: string;
  readonly rotatedAt: Instant;
  readonly expiresAt: Instant;
}): Readonly<{
  revoked: DeviceOperationalCredential;
  replacement: DeviceOperationalCredential;
}> {
  if (input.current.state !== "active") {
    throw new Error("Only an active Device credential can rotate");
  }
  if (
    input.deviceCredentialId === input.current.deviceCredentialId ||
    input.keyFingerprint.trim() === input.current.keyFingerprint
  ) {
    throw new Error("Device credential rotation requires new credential identity");
  }

  const revoked = revokeDeviceOperationalCredential({
    credential: input.current,
    expectedRevision: input.expectedRevision,
    revokedAt: input.rotatedAt,
  });
  const replacement = createDeviceOperationalCredential({
    tenantId: input.current.tenantId,
    deviceCredentialId: input.deviceCredentialId,
    deviceId: input.current.deviceId,
    generation: input.current.generation + 1,
    verificationKeyRef: input.verificationKeyRef,
    keyFingerprint: input.keyFingerprint,
    issuedAt: input.rotatedAt,
    expiresAt: input.expiresAt,
  });

  return Object.freeze({ revoked, replacement });
}

export function issueDeviceReconnectChallenge(input: {
  readonly credential: DeviceOperationalCredential;
  readonly requestId: RequestId;
  readonly challengeDigest: string;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
}): DeviceReconnectChallenge {
  if (input.credential.state !== "active") {
    throw new Error("Reconnect challenge requires an active Device credential");
  }

  const createdAt = toInstant(input.createdAt);
  const expiresAt = toInstant(input.expiresAt);
  assertChronology(
    createdAt,
    expiresAt,
    "Reconnect challenge expiry must follow creation",
  );
  if (Date.parse(createdAt) >= Date.parse(input.credential.expiresAt)) {
    throw new Error("Cannot issue reconnect challenge for expired credential");
  }
  if (Date.parse(expiresAt) > Date.parse(input.credential.expiresAt)) {
    throw new Error("Reconnect challenge cannot outlive Device credential");
  }

  return Object.freeze({
    tenantId: input.credential.tenantId,
    requestId: requireRequestId(input.requestId),
    deviceId: input.credential.deviceId,
    deviceCredentialId: input.credential.deviceCredentialId,
    credentialGeneration: input.credential.generation,
    challengeDigest: bounded(
      input.challengeDigest,
      "challengeDigest",
      16,
      512,
    ),
    state: "pending",
    createdAt,
    expiresAt,
    consumedAt: null,
    revision: 1,
  });
}

export function expireDeviceReconnectChallenge(input: {
  readonly challenge: DeviceReconnectChallenge;
  readonly expectedRevision: number;
  readonly at: Instant;
}): DeviceReconnectChallenge {
  if (
    positiveSafeInteger(input.expectedRevision, "expectedRevision") !==
    input.challenge.revision
  ) {
    throw new Error("Device reconnect challenge revision is stale");
  }
  if (input.challenge.state === "consumed") {
    throw new Error("Consumed reconnect challenge cannot expire");
  }
  if (input.challenge.state === "expired") {
    return input.challenge;
  }
  const at = toInstant(input.at);
  if (Date.parse(at) < Date.parse(input.challenge.expiresAt)) {
    throw new Error("Reconnect challenge is not expired yet");
  }
  return Object.freeze({
    ...input.challenge,
    state: "expired",
    revision: input.challenge.revision + 1,
  });
}

function assertReconnectScope(
  credential: DeviceOperationalCredential,
  challenge: DeviceReconnectChallenge,
): void {
  if (
    credential.tenantId !== challenge.tenantId ||
    credential.deviceId !== challenge.deviceId ||
    credential.deviceCredentialId !== challenge.deviceCredentialId ||
    credential.generation !== challenge.credentialGeneration
  ) {
    throw new Error("Reconnect challenge is not bound to the Device credential");
  }
}

export async function completeDeviceReconnect(
  input: CompleteDeviceReconnectInput,
  verifier: DeviceReconnectProofVerifier,
): Promise<CompletedDeviceReconnect> {
  assertReconnectScope(input.credential, input.challenge);

  if (input.credential.state !== "active") {
    throw new Error("Device credential is revoked");
  }
  if (
    positiveSafeInteger(
      input.currentCredentialGeneration,
      "currentCredentialGeneration",
    ) !== input.credential.generation
  ) {
    throw new Error("Device credential generation is no longer current");
  }
  if (
    positiveSafeInteger(
      input.expectedChallengeRevision,
      "expectedChallengeRevision",
    ) !== input.challenge.revision
  ) {
    throw new Error("Device reconnect challenge revision is stale");
  }
  if (input.challenge.state !== "pending") {
    throw new Error("Device reconnect challenge is not pending");
  }

  const authenticatedAt = toInstant(input.authenticatedAt);
  if (Date.parse(authenticatedAt) >= Date.parse(input.credential.expiresAt)) {
    throw new Error("Device credential is expired");
  }
  if (Date.parse(authenticatedAt) >= Date.parse(input.challenge.expiresAt)) {
    throw new Error("Device reconnect challenge is expired");
  }
  if (Date.parse(authenticatedAt) < Date.parse(input.challenge.createdAt)) {
    throw new Error("Reconnect authentication cannot precede challenge creation");
  }

  const proof = bounded(input.proof, "proof", 16, 16384);
  const verified = await verifier.verify({
    verificationKeyRef: input.credential.verificationKeyRef,
    keyFingerprint: input.credential.keyFingerprint,
    tenantId: input.credential.tenantId,
    deviceId: input.credential.deviceId,
    deviceCredentialId: input.credential.deviceCredentialId,
    credentialGeneration: input.credential.generation,
    requestId: input.challenge.requestId,
    challengeDigest: input.challenge.challengeDigest,
    proof,
  });
  if (!verified) {
    throw new Error("Device reconnect proof is invalid");
  }

  const challenge = Object.freeze({
    ...input.challenge,
    state: "consumed" as const,
    consumedAt: authenticatedAt,
    revision: input.challenge.revision + 1,
  });

  const authentication = createAuthenticationEvidence({
    method: "device-key",
    issuer: "masanawa-device-credential",
    subject: input.credential.deviceId,
    strength: "strong",
    authenticatedAt,
    expiresAt: input.credential.expiresAt,
    metadata: {
      deviceCredentialId: input.credential.deviceCredentialId,
      credentialGeneration: String(input.credential.generation),
      reconnectRequestId: input.challenge.requestId,
    },
  });

  return Object.freeze({ challenge, authentication });
}
