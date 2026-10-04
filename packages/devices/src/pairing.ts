import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Instant } from "@masanawa/contracts";
import {
  deviceRegistrationLimits,
  type Device,
  type DevicePairingChallenge,
  type DeviceRegistrationMetadata,
} from "./device-model.js";

const stableKeyPattern = /^[a-z0-9][a-z0-9._-]*$/u;
const secretHashPattern = /^[a-f0-9]{64}$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function bounded(
  value: unknown,
  name: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    fail(`${name} must be a non-empty string no longer than ${maxLength} characters`);
  }
  return value;
}

function stableKey(
  value: unknown,
  name: string,
  maxLength: number,
): string {
  const normalized = bounded(value, name, maxLength).toLowerCase();
  if (!stableKeyPattern.test(normalized)) {
    fail(`${name} must use a stable lowercase identifier format`);
  }
  return normalized;
}

export function normalizeDeviceRegistrationMetadata(
  input: DeviceRegistrationMetadata,
): DeviceRegistrationMetadata {
  return Object.freeze({
    deviceClass: stableKey(
      input.deviceClass,
      "deviceClass",
      deviceRegistrationLimits.maxClassLength,
    ),
    platform: stableKey(
      input.platform,
      "platform",
      deviceRegistrationLimits.maxPlatformLength,
    ),
    platformVersion: bounded(
      input.platformVersion,
      "platformVersion",
      deviceRegistrationLimits.maxPlatformVersionLength,
    ),
    model: bounded(
      input.model,
      "model",
      deviceRegistrationLimits.maxModelLength,
    ),
    appVersion: bounded(
      input.appVersion,
      "appVersion",
      deviceRegistrationLimits.maxAppVersionLength,
    ),
  });
}

export function createDevice(input: Device): Device {
  if (!["pending-pairing", "active", "suspended"].includes(input.state)) {
    fail("Device state is not supported");
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    fail("Device revision must be a positive safe integer");
  }
  const enrollmentFingerprint = bounded(
    input.enrollmentFingerprint,
    "enrollmentFingerprint",
    deviceRegistrationLimits.maxEnrollmentFingerprintLength,
  );
  if (input.state === "pending-pairing" && input.pairedAt !== null) {
    fail("pending-pairing Device cannot have pairedAt");
  }
  if (input.state === "active" && input.pairedAt === null) {
    fail("active Device requires pairedAt");
  }
  if (input.updatedAt < input.registeredAt) {
    fail("Device updatedAt cannot precede registeredAt");
  }
  if (
    input.pairedAt !== null &&
    (input.pairedAt < input.registeredAt || input.pairedAt > input.updatedAt)
  ) {
    fail("Device pairedAt must fall between registeredAt and updatedAt");
  }

  return Object.freeze({
    ...input,
    enrollmentFingerprint,
    metadata: normalizeDeviceRegistrationMetadata(input.metadata),
  });
}

export function hashPairingSecret(secret: string): string {
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 256) {
    fail("pairing secret must contain 32-256 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function issuePairingSecret(): Readonly<{
  secret: string;
  secretHash: string;
}> {
  const secret = randomBytes(32).toString("base64url");
  return Object.freeze({
    secret,
    secretHash: hashPairingSecret(secret),
  });
}

export function verifyPairingSecret(
  secret: string,
  expectedHash: string,
): boolean {
  if (!secretHashPattern.test(expectedHash)) {
    fail("pairing secret hash must be lowercase sha256 hex");
  }

  let actualHash: string;
  try {
    actualHash = hashPairingSecret(secret);
  } catch {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(actualHash, "hex"),
    Buffer.from(expectedHash, "hex"),
  );
}

export function createDevicePairingChallenge(
  input: DevicePairingChallenge,
): DevicePairingChallenge {
  if (!secretHashPattern.test(input.secretHash)) {
    fail("pairing secret hash must be lowercase sha256 hex");
  }
  if (!["pending", "consumed", "expired"].includes(input.state)) {
    fail("pairing challenge state is not supported");
  }

  const lifetime =
    new Date(input.expiresAt).getTime() - new Date(input.createdAt).getTime();
  if (
    lifetime < deviceRegistrationLimits.minPairingLifetimeMs ||
    lifetime > deviceRegistrationLimits.maxPairingLifetimeMs
  ) {
    fail("pairing challenge lifetime is outside the supported range");
  }

  if ((input.state === "consumed") !== (input.consumedAt !== null)) {
    fail("pairing challenge consumedAt must exist only when consumed");
  }
  if (input.consumedAt !== null) {
    if (
      input.consumedAt < input.createdAt ||
      input.consumedAt > input.expiresAt
    ) {
      fail("pairing challenge consumedAt must fall within its lifetime");
    }
  }

  return Object.freeze({ ...input });
}

export function isPairingChallengeCurrent(
  challenge: DevicePairingChallenge,
  at: Instant,
): boolean {
  return challenge.state === "pending" && at < challenge.expiresAt;
}
