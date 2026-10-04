import {
  deviceCapabilityLimits,
  type DeviceCapabilityFact,
  type DeviceCapabilityPublication,
  type DeviceCapabilitySnapshot,
  type DeviceHealthFact,
} from "./capability-model.js";

const capabilityKeyPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

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

export function normalizeDeviceCapabilityKey(value: string): string {
  const key = bounded(
    value,
    "capability.key",
    deviceCapabilityLimits.maxCapabilityKeyLength,
  ).toLowerCase();
  if (!capabilityKeyPattern.test(key)) {
    fail("capability.key must use a stable lowercase capability format");
  }
  return key;
}

export function createDeviceCapabilityFact(
  input: DeviceCapabilityFact,
): DeviceCapabilityFact {
  if (!["ready", "degraded", "unavailable"].includes(input.readiness)) {
    fail("capability readiness is not supported");
  }
  const reason =
    input.reason === null
      ? null
      : bounded(
          input.reason,
          "capability.reason",
          deviceCapabilityLimits.maxReasonLength,
        );
  if (input.readiness === "ready" && reason !== null) {
    fail("ready capability cannot carry a degradation reason");
  }
  if (input.readiness !== "ready" && reason === null) {
    fail("non-ready capability requires a reason");
  }
  return Object.freeze({
    key: normalizeDeviceCapabilityKey(input.key),
    readiness: input.readiness,
    reason,
    observedAt: input.observedAt,
  });
}

export function createDeviceCapabilityPublication(
  input: DeviceCapabilityPublication,
): DeviceCapabilityPublication {
  if (!Number.isSafeInteger(input.generation) || input.generation < 1) {
    fail("capability generation must be a positive safe integer");
  }
  if (input.capabilities.length > deviceCapabilityLimits.maxCapabilities) {
    fail(
      `capability publication exceeds ${deviceCapabilityLimits.maxCapabilities} capabilities`,
    );
  }

  const capabilities = input.capabilities
    .map(createDeviceCapabilityFact)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const keys = capabilities.map((capability) => capability.key);
  if (new Set(keys).size !== keys.length) {
    fail("capability publication contains duplicate capability keys");
  }
  for (const capability of capabilities) {
    if (capability.observedAt > input.publishedAt) {
      fail("capability observedAt cannot follow publishedAt");
    }
  }

  return Object.freeze({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    generation: input.generation,
    capabilities: Object.freeze(capabilities),
    publishedAt: input.publishedAt,
  });
}

export function createDeviceHealthFact(
  input: DeviceHealthFact,
): DeviceHealthFact {
  if (!["healthy", "degraded", "unavailable"].includes(input.state)) {
    fail("Device health state is not supported");
  }
  const reason =
    input.reason === null
      ? null
      : bounded(
          input.reason,
          "health.reason",
          deviceCapabilityLimits.maxReasonLength,
        );
  if (input.state === "healthy" && reason !== null) {
    fail("healthy Device cannot carry a degradation reason");
  }
  if (input.state !== "healthy" && reason === null) {
    fail("non-healthy Device requires a reason");
  }
  return Object.freeze({ ...input, reason });
}

export function isDeviceHealthStale(
  health: DeviceHealthFact | null,
  at: DeviceHealthFact["observedAt"],
  staleAfterMs: number,
): boolean {
  if (!Number.isSafeInteger(staleAfterMs) || staleAfterMs <= 0) {
    fail("staleAfterMs must be a positive safe integer");
  }
  if (health === null) return true;
  return (
    new Date(at).getTime() - new Date(health.observedAt).getTime() >
    staleAfterMs
  );
}

export function createDeviceCapabilitySnapshot(input: {
  readonly publication: DeviceCapabilityPublication;
  readonly health: DeviceHealthFact | null;
  readonly at: DeviceHealthFact["observedAt"];
  readonly staleAfterMs: number;
}): DeviceCapabilitySnapshot {
  if (
    input.health !== null &&
    (input.health.tenantId !== input.publication.tenantId ||
      input.health.deviceId !== input.publication.deviceId)
  ) {
    fail("Device health does not belong to the capability publication Device");
  }
  return Object.freeze({
    tenantId: input.publication.tenantId,
    deviceId: input.publication.deviceId,
    generation: input.publication.generation,
    capabilities: input.publication.capabilities,
    health: input.health,
    healthStale: isDeviceHealthStale(
      input.health,
      input.at,
      input.staleAfterMs,
    ),
  });
}
