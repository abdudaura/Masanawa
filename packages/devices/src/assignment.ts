import type { CharacterId, Instant } from "@masanawa/contracts";
import {
  normalizeDeviceCapabilityKey,
} from "./capability.js";
import type {
  DeviceCapabilitySnapshot,
} from "./capability-model.js";
import type { Device } from "./device-model.js";
import {
  characterDeviceAssignmentLimits,
  characterDeviceAssignmentRoles,
  characterDeviceAssignmentStates,
  type CharacterDeviceAssignment,
  type CharacterDeviceAssignmentRole,
  type CharacterDeviceAssignmentState,
  type CharacterDeviceCapabilityDecision,
  type CharacterDeviceCapabilityPolicy,
} from "./assignment-model.js";

const roleSet = new Set<string>(characterDeviceAssignmentRoles);
const stateSet = new Set<string>(characterDeviceAssignmentStates);

function fail(message: string): never {
  throw new TypeError(message);
}

function instantMs(value: Instant, name: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`${name} must be a valid instant`);
  return ms;
}

function normalizePolicy(
  input: CharacterDeviceCapabilityPolicy,
): CharacterDeviceCapabilityPolicy {
  if (
    input.allowedCapabilityKeys.length < 1 ||
    input.allowedCapabilityKeys.length >
      characterDeviceAssignmentLimits.maxAllowedCapabilities
  ) {
    fail(
      `allowedCapabilityKeys must contain 1-${characterDeviceAssignmentLimits.maxAllowedCapabilities} entries`,
    );
  }
  if (
    typeof input.allowDegradedCapability !== "boolean" ||
    typeof input.allowDegradedDeviceHealth !== "boolean"
  ) {
    fail("degraded capability policy flags must be boolean");
  }
  const keys = input.allowedCapabilityKeys
    .map(normalizeDeviceCapabilityKey)
    .sort();
  if (new Set(keys).size !== keys.length) {
    fail("assignment capability policy contains duplicate keys");
  }
  return Object.freeze({
    allowedCapabilityKeys: Object.freeze(keys),
    allowDegradedCapability: input.allowDegradedCapability,
    allowDegradedDeviceHealth: input.allowDegradedDeviceHealth,
  });
}

export function createCharacterDeviceAssignment(input: {
  readonly device: Device;
  readonly characterId: CharacterId;
  readonly role: CharacterDeviceAssignmentRole;
  readonly policy: CharacterDeviceCapabilityPolicy;
  readonly validFrom: Instant;
  readonly validUntil: Instant | null;
  readonly createdAt: Instant;
}): CharacterDeviceAssignment {
  if (input.device.state !== "active") {
    fail("Character can be assigned only to an active Device");
  }
  if (!roleSet.has(input.role)) fail("assignment role is invalid");

  const createdAtMs = instantMs(input.createdAt, "createdAt");
  const validFromMs = instantMs(input.validFrom, "validFrom");
  if (validFromMs < createdAtMs) {
    fail("validFrom cannot precede assignment creation");
  }
  if (
    input.validUntil !== null &&
    instantMs(input.validUntil, "validUntil") <= validFromMs
  ) {
    fail("validUntil must follow validFrom");
  }

  return Object.freeze({
    tenantId: input.device.tenantId,
    characterId: input.characterId,
    deviceId: input.device.deviceId,
    role: input.role,
    state: "active",
    policy: normalizePolicy(input.policy),
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    revision: 1,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function transitionCharacterDeviceAssignment(input: {
  readonly assignment: CharacterDeviceAssignment;
  readonly expectedRevision: number;
  readonly state: CharacterDeviceAssignmentState;
  readonly changedAt: Instant;
}): CharacterDeviceAssignment {
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  ) {
    fail("expectedRevision must be a positive safe integer");
  }
  if (input.expectedRevision !== input.assignment.revision) {
    throw new Error("Character Device assignment revision is stale");
  }
  if (!stateSet.has(input.state)) fail("assignment state is invalid");
  if (input.assignment.state === "revoked") {
    throw new Error("Revoked Character Device assignment is terminal");
  }
  if (input.state === input.assignment.state) return input.assignment;

  const allowed =
    (input.assignment.state === "active" &&
      (input.state === "suspended" || input.state === "revoked")) ||
    (input.assignment.state === "suspended" &&
      (input.state === "active" || input.state === "revoked"));
  if (!allowed) throw new Error("Invalid Character Device assignment transition");

  const changedAtMs = instantMs(input.changedAt, "changedAt");
  if (changedAtMs < instantMs(input.assignment.updatedAt, "updatedAt")) {
    fail("assignment changedAt cannot move backwards");
  }

  return Object.freeze({
    ...input.assignment,
    state: input.state,
    revision: input.assignment.revision + 1,
    updatedAt: input.changedAt,
  });
}

function deny(
  capabilityKey: string,
  reason: CharacterDeviceCapabilityDecision["reason"],
): CharacterDeviceCapabilityDecision {
  return Object.freeze({ allowed: false, reason, capabilityKey });
}

export function evaluateCharacterDeviceCapability(input: {
  readonly assignment: CharacterDeviceAssignment;
  readonly device: Device;
  readonly snapshot: DeviceCapabilitySnapshot;
  readonly characterId: CharacterId;
  readonly capabilityKey: string;
  readonly at: Instant;
}): CharacterDeviceCapabilityDecision {
  const capabilityKey = normalizeDeviceCapabilityKey(input.capabilityKey);

  if (
    input.assignment.tenantId !== input.device.tenantId ||
    input.assignment.tenantId !== input.snapshot.tenantId ||
    input.assignment.deviceId !== input.device.deviceId ||
    input.assignment.deviceId !== input.snapshot.deviceId ||
    input.assignment.characterId !== input.characterId
  ) {
    return deny(capabilityKey, "scope-mismatch");
  }

  if (input.assignment.state !== "active") {
    return deny(capabilityKey, "assignment-inactive");
  }
  if (input.device.state !== "active") {
    return deny(capabilityKey, "device-inactive");
  }

  const atMs = instantMs(input.at, "at");
  if (
    atMs < instantMs(input.assignment.validFrom, "validFrom") ||
    (input.assignment.validUntil !== null &&
      atMs >= instantMs(input.assignment.validUntil, "validUntil"))
  ) {
    return deny(capabilityKey, "outside-validity-window");
  }

  if (!input.assignment.policy.allowedCapabilityKeys.includes(capabilityKey)) {
    return deny(capabilityKey, "capability-not-granted");
  }

  if (input.snapshot.health === null) {
    return deny(capabilityKey, "device-health-missing");
  }
  if (input.snapshot.healthStale) {
    return deny(capabilityKey, "device-health-stale");
  }
  if (input.snapshot.health.state === "unavailable") {
    return deny(capabilityKey, "device-health-unavailable");
  }
  if (
    input.snapshot.health.state === "degraded" &&
    !input.assignment.policy.allowDegradedDeviceHealth
  ) {
    return deny(capabilityKey, "device-health-degraded");
  }

  const capability = input.snapshot.capabilities.find(
    (candidate) => candidate.key === capabilityKey,
  );
  if (!capability) {
    return deny(capabilityKey, "capability-not-published");
  }
  if (capability.readiness === "unavailable") {
    return deny(capabilityKey, "capability-unavailable");
  }
  if (
    capability.readiness === "degraded" &&
    !input.assignment.policy.allowDegradedCapability
  ) {
    return deny(capabilityKey, "capability-degraded");
  }

  return Object.freeze({
    allowed: true,
    reason: "allowed",
    capabilityKey,
  });
}

export function sameCharacterDeviceAssignment(
  left: CharacterDeviceAssignment,
  right: CharacterDeviceAssignment,
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.characterId === right.characterId &&
    left.deviceId === right.deviceId
  );
}
