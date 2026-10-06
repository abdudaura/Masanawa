import {
  parseCanonicalId,
  toInstant,
  type DeviceId,
  type Instant,
} from "@masanawa/contracts";

export type AndroidRuntimeState =
  | "booting"
  | "probing"
  | "ready"
  | "degraded"
  | "disabled"
  | "stopped";

export type AndroidRootState = "available" | "unavailable" | "unknown";

export interface AndroidCapabilityProbeResult {
  readonly key: string;
  readonly readiness: "ready" | "degraded" | "unavailable";
  readonly reason: string | null;
  readonly observedAt: Instant;
}

export interface AndroidAgentDeviceRuntimeSnapshot {
  readonly schemaVersion: 1;
  readonly deviceId: DeviceId;
  readonly bootId: string;
  readonly appVersion: string;
  readonly androidSdk: number;
  readonly abi: string;
  readonly rootState: AndroidRootState;
  readonly state: AndroidRuntimeState;
  readonly probeGeneration: number;
  readonly capabilities: readonly AndroidCapabilityProbeResult[];
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly disabledReason: string | null;
}

export interface AndroidRuntimeHealthProjection {
  readonly state: "healthy" | "degraded" | "unavailable";
  readonly reason: string | null;
  readonly observedAt: Instant;
}

const capabilityKeyPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function positiveInteger(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function normalizeRootState(value: AndroidRootState): AndroidRootState {
  if (value !== "available" && value !== "unavailable" && value !== "unknown") {
    throw new TypeError("rootState is invalid");
  }
  return value;
}

function normalizeCapabilityKey(value: string): string {
  const key = bounded(value, "capability.key", 1, 160).toLowerCase();
  if (!capabilityKeyPattern.test(key)) {
    throw new TypeError("capability.key is invalid");
  }
  return key;
}

function normalizeProbe(
  input: AndroidCapabilityProbeResult,
): AndroidCapabilityProbeResult {
  if (
    input.readiness !== "ready" &&
    input.readiness !== "degraded" &&
    input.readiness !== "unavailable"
  ) {
    throw new TypeError("capability readiness is invalid");
  }
  const reason =
    input.reason === null
      ? null
      : bounded(input.reason, "capability.reason", 1, 500);
  if (input.readiness === "ready" && reason !== null) {
    throw new Error("ready capability cannot carry a reason");
  }
  if (input.readiness !== "ready" && reason === null) {
    throw new Error("non-ready capability requires a reason");
  }
  return Object.freeze({
    key: normalizeCapabilityKey(input.key),
    readiness: input.readiness,
    reason,
    observedAt: toInstant(input.observedAt),
  });
}

function normalizeProbes(
  inputs: readonly AndroidCapabilityProbeResult[],
  at: Instant,
): readonly AndroidCapabilityProbeResult[] {
  if (!Array.isArray(inputs) || inputs.length > 256) {
    throw new RangeError("capability probe batch is invalid");
  }
  const now = toInstant(at);
  const probes = inputs
    .map(normalizeProbe)
    .sort((a, b) => a.key.localeCompare(b.key));
  const keys = probes.map((probe) => probe.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("capability probe batch contains duplicate keys");
  }
  if (probes.some((probe) => probe.observedAt > now)) {
    throw new Error("capability probe observation cannot be in the future");
  }
  return Object.freeze(probes);
}

function assertMutable(
  runtime: AndroidAgentDeviceRuntimeSnapshot,
): void {
  if (runtime.state === "disabled") {
    throw new Error("Android Agent Device runtime is disabled");
  }
  if (runtime.state === "stopped") {
    throw new Error("Android Agent Device runtime is stopped");
  }
}

export function createAndroidAgentDeviceRuntime(input: {
  readonly deviceId: DeviceId;
  readonly bootId: string;
  readonly appVersion: string;
  readonly androidSdk: number;
  readonly abi: string;
  readonly rootState: AndroidRootState;
  readonly startedAt: Instant;
}): AndroidAgentDeviceRuntimeSnapshot {
  const startedAt = toInstant(input.startedAt);
  return Object.freeze({
    schemaVersion: 1,
    deviceId: parseCanonicalId("device", input.deviceId),
    bootId: bounded(input.bootId, "bootId", 8, 180),
    appVersion: bounded(input.appVersion, "appVersion", 1, 80),
    androidSdk: positiveInteger(input.androidSdk, "androidSdk", 10_000),
    abi: bounded(input.abi, "abi", 3, 80).toLowerCase(),
    rootState: normalizeRootState(input.rootState),
    state: "booting" as const,
    probeGeneration: 0,
    capabilities: Object.freeze([]),
    startedAt,
    updatedAt: startedAt,
    disabledReason: null,
  });
}

export function beginAndroidCapabilityProbe(input: {
  readonly runtime: AndroidAgentDeviceRuntimeSnapshot;
  readonly now: Instant;
}): AndroidAgentDeviceRuntimeSnapshot {
  assertMutable(input.runtime);
  const now = toInstant(input.now);
  if (now < input.runtime.updatedAt) {
    throw new Error("probe cannot move runtime time backwards");
  }
  return Object.freeze({
    ...input.runtime,
    state: "probing" as const,
    probeGeneration: input.runtime.probeGeneration + 1,
    updatedAt: now,
  });
}

export function completeAndroidCapabilityProbe(input: {
  readonly runtime: AndroidAgentDeviceRuntimeSnapshot;
  readonly expectedGeneration: number;
  readonly capabilities: readonly AndroidCapabilityProbeResult[];
  readonly now: Instant;
}): AndroidAgentDeviceRuntimeSnapshot {
  assertMutable(input.runtime);
  if (input.runtime.state !== "probing") {
    throw new Error("runtime is not awaiting a capability probe");
  }
  if (
    !Number.isSafeInteger(input.expectedGeneration) ||
    input.expectedGeneration !== input.runtime.probeGeneration
  ) {
    throw new Error("stale capability probe generation");
  }

  const now = toInstant(input.now);
  if (now < input.runtime.updatedAt) {
    throw new Error("probe completion cannot move runtime time backwards");
  }
  const capabilities = normalizeProbes(input.capabilities, now);
  const state: AndroidRuntimeState =
    capabilities.length > 0 &&
    capabilities.every((capability) => capability.readiness === "ready")
      ? "ready"
      : "degraded";

  return Object.freeze({
    ...input.runtime,
    state,
    capabilities,
    updatedAt: now,
  });
}

export function disableAndroidAgentDeviceRuntime(input: {
  readonly runtime: AndroidAgentDeviceRuntimeSnapshot;
  readonly reason: string;
  readonly now: Instant;
}): AndroidAgentDeviceRuntimeSnapshot {
  if (input.runtime.state === "disabled") {
    const normalizedReason = bounded(input.reason, "disabled reason", 1, 500);
    if (normalizedReason !== input.runtime.disabledReason) {
      throw new Error("disabled runtime cannot change terminal reason");
    }
    return input.runtime;
  }
  if (input.runtime.state === "stopped") {
    throw new Error("stopped runtime cannot transition to disabled");
  }
  const now = toInstant(input.now);
  if (now < input.runtime.updatedAt) {
    throw new Error("disable cannot move runtime time backwards");
  }
  return Object.freeze({
    ...input.runtime,
    state: "disabled" as const,
    capabilities: Object.freeze([]),
    updatedAt: now,
    disabledReason: bounded(input.reason, "disabled reason", 1, 500),
  });
}

export function stopAndroidAgentDeviceRuntime(input: {
  readonly runtime: AndroidAgentDeviceRuntimeSnapshot;
  readonly now: Instant;
}): AndroidAgentDeviceRuntimeSnapshot {
  if (input.runtime.state === "disabled") {
    return input.runtime;
  }
  if (input.runtime.state === "stopped") {
    return input.runtime;
  }
  const now = toInstant(input.now);
  if (now < input.runtime.updatedAt) {
    throw new Error("stop cannot move runtime time backwards");
  }
  return Object.freeze({
    ...input.runtime,
    state: "stopped" as const,
    capabilities: Object.freeze([]),
    updatedAt: now,
  });
}

export function projectAndroidRuntimeHealth(
  runtime: AndroidAgentDeviceRuntimeSnapshot,
): AndroidRuntimeHealthProjection {
  if (runtime.state === "disabled") {
    return Object.freeze({
      state: "unavailable" as const,
      reason: runtime.disabledReason ?? "runtime-disabled",
      observedAt: runtime.updatedAt,
    });
  }
  if (runtime.state === "stopped") {
    return Object.freeze({
      state: "unavailable" as const,
      reason: "runtime-stopped",
      observedAt: runtime.updatedAt,
    });
  }
  if (runtime.state === "ready") {
    return Object.freeze({
      state: "healthy" as const,
      reason: null,
      observedAt: runtime.updatedAt,
    });
  }

  const unavailable = runtime.capabilities.filter(
    (capability) => capability.readiness === "unavailable",
  ).length;
  const degraded = runtime.capabilities.filter(
    (capability) => capability.readiness === "degraded",
  ).length;

  const reason =
    runtime.state === "booting"
      ? "runtime-booting"
      : runtime.state === "probing"
        ? "capability-probe-in-progress"
        : runtime.capabilities.length === 0
          ? "no-capabilities-ready"
          : `capabilities-not-ready:${unavailable} unavailable,${degraded} degraded`;

  return Object.freeze({
    state: "degraded" as const,
    reason,
    observedAt: runtime.updatedAt,
  });
}
