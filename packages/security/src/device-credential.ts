import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  PlatformError,
  toInstant,
  type DeviceCredentialId,
  type DeviceId,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";
import {
  createAuthenticationEvidence,
  type AuthenticationEvidence,
} from "./authentication.js";
import { CredentialSecret } from "./credentials.js";
import type { Principal } from "./principal.js";

export type DeviceCredentialState = "active" | "revoked";

export interface DeviceOperationalCredential {
  readonly tenantId: TenantId;
  readonly deviceCredentialId: DeviceCredentialId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly secretHash: string;
  readonly state: DeviceCredentialState;
  readonly issuedAt: Instant;
  readonly expiresAt: Instant | null;
  readonly revokedAt: Instant | null;
}

export interface IssuedDeviceOperationalCredential {
  readonly credential: DeviceOperationalCredential;
  readonly secret: CredentialSecret;
}

export interface VerifiedDeviceOperationalCredential {
  readonly principal: Extract<Principal, { readonly kind: "device" }>;
  readonly evidence: AuthenticationEvidence;
  readonly credential: DeviceOperationalCredential;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const MIN_SECRET_BYTES = 32;
const MAX_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

function authenticationError(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "authentication",
    message,
    retryable: false,
  });
}

function generation(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("Device credential generation must be a positive safe integer");
  }
  return value;
}

function instantMs(value: Instant, name: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new TypeError(`${name} must be a valid instant`);
  }
  return ms;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function generateDeviceCredentialSecret(
  byteLength = MIN_SECRET_BYTES,
): CredentialSecret {
  if (!Number.isSafeInteger(byteLength) || byteLength < MIN_SECRET_BYTES || byteLength > 128) {
    throw new RangeError("Device credential secret size must be between 32 and 128 bytes");
  }
  return CredentialSecret.fromString(randomBytes(byteLength).toString("base64url"));
}

export function deviceCredentialSecretHash(
  secret: CredentialSecret,
): string {
  return secret.use(hashSecret);
}

export function issueDeviceOperationalCredential(input: {
  readonly tenantId: TenantId;
  readonly deviceCredentialId: DeviceCredentialId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly issuedAt: Instant;
  readonly expiresAt?: Instant | null;
  readonly secret?: CredentialSecret;
}): IssuedDeviceOperationalCredential {
  const issuedAt = toInstant(input.issuedAt);
  const expiresAt =
    input.expiresAt === undefined || input.expiresAt === null
      ? null
      : toInstant(input.expiresAt);
  if (expiresAt !== null) {
    const lifetime = instantMs(expiresAt, "expiresAt") - instantMs(issuedAt, "issuedAt");
    if (lifetime <= 0 || lifetime > MAX_LIFETIME_MS) {
      throw new RangeError("Device credential expiry must follow issuance by at most 365 days");
    }
  }

  const secret = input.secret ?? generateDeviceCredentialSecret();
  const credential = Object.freeze<DeviceOperationalCredential>({
    tenantId: input.tenantId,
    deviceCredentialId: input.deviceCredentialId,
    deviceId: input.deviceId,
    generation: generation(input.generation),
    secretHash: deviceCredentialSecretHash(secret),
    state: "active",
    issuedAt,
    expiresAt,
    revokedAt: null,
  });
  return Object.freeze({ credential, secret });
}

export function revokeDeviceOperationalCredential(input: {
  readonly credential: DeviceOperationalCredential;
  readonly expectedGeneration: number;
  readonly revokedAt: Instant;
}): DeviceOperationalCredential {
  if (generation(input.expectedGeneration) !== input.credential.generation) {
    throw new Error("Device credential generation is stale");
  }
  if (input.credential.state === "revoked") return input.credential;

  const revokedAt = toInstant(input.revokedAt);
  if (instantMs(revokedAt, "revokedAt") < instantMs(input.credential.issuedAt, "issuedAt")) {
    throw new RangeError("Device credential revocation cannot precede issuance");
  }
  return Object.freeze({
    ...input.credential,
    state: "revoked" as const,
    revokedAt,
  });
}

export function rotateDeviceOperationalCredential(input: {
  readonly current: DeviceOperationalCredential;
  readonly expectedGeneration: number;
  readonly replacementCredentialId: DeviceCredentialId;
  readonly rotatedAt: Instant;
  readonly expiresAt?: Instant | null;
  readonly replacementSecret?: CredentialSecret;
}): {
  readonly revoked: DeviceOperationalCredential;
  readonly replacement: DeviceOperationalCredential;
  readonly secret: CredentialSecret;
} {
  const expectedGeneration = generation(input.expectedGeneration);
  if (input.current.generation !== expectedGeneration) {
    throw new Error("Device credential generation is stale");
  }
  const revoked = revokeDeviceOperationalCredential({
    credential: input.current,
    expectedGeneration,
    revokedAt: input.rotatedAt,
  });
  const issued = issueDeviceOperationalCredential({
    tenantId: input.current.tenantId,
    deviceCredentialId: input.replacementCredentialId,
    deviceId: input.current.deviceId,
    generation: expectedGeneration + 1,
    issuedAt: input.rotatedAt,
    expiresAt: input.expiresAt ?? null,
    secret: input.replacementSecret,
  });
  return Object.freeze({
    revoked,
    replacement: issued.credential,
    secret: issued.secret,
  });
}

function matchesSecret(
  secret: CredentialSecret,
  expectedHash: string,
): boolean {
  if (!HASH_PATTERN.test(expectedHash)) {
    throw authenticationError(
      "device-credential.invalid_verifier",
      "Device credential verifier is invalid",
    );
  }
  const actual = Buffer.from(deviceCredentialSecretHash(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyDeviceOperationalCredential(input: {
  readonly credential: DeviceOperationalCredential;
  readonly presentedSecret: CredentialSecret;
  readonly expectedTenantId: TenantId;
  readonly expectedDeviceId: DeviceId;
  readonly currentGeneration: number;
  readonly at: Instant;
}): VerifiedDeviceOperationalCredential {
  if (
    input.credential.tenantId !== input.expectedTenantId ||
    input.credential.deviceId !== input.expectedDeviceId
  ) {
    throw authenticationError(
      "device-credential.scope_mismatch",
      "Device credential is not valid for this Device scope",
    );
  }
  if (input.credential.state !== "active") {
    throw authenticationError(
      "device-credential.revoked",
      "Device credential has been revoked",
    );
  }
  if (generation(input.currentGeneration) !== input.credential.generation) {
    throw authenticationError(
      "device-credential.stale_generation",
      "Device credential has been rotated or revoked",
    );
  }

  const at = toInstant(input.at);
  if (
    input.credential.expiresAt !== null &&
    instantMs(input.credential.expiresAt, "expiresAt") <= instantMs(at, "at")
  ) {
    throw authenticationError(
      "device-credential.expired",
      "Device credential has expired",
    );
  }
  if (!matchesSecret(input.presentedSecret, input.credential.secretHash)) {
    throw authenticationError(
      "device-credential.invalid_secret",
      "Device credential secret is invalid",
    );
  }

  const principal = Object.freeze({
    kind: "device" as const,
    deviceId: input.credential.deviceId,
  });
  const evidence = createAuthenticationEvidence({
    method: "device-key",
    issuer: "masanawa-device",
    subject: input.credential.deviceId,
    strength: "strong",
    authenticatedAt: at,
    ...(input.credential.expiresAt === null
      ? {}
      : { expiresAt: input.credential.expiresAt }),
    metadata: {
      deviceCredentialId: input.credential.deviceCredentialId,
      credentialGeneration: String(input.credential.generation),
    },
  });

  return Object.freeze({
    principal,
    evidence,
    credential: input.credential,
  });
}
