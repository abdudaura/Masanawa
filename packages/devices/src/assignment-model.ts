import type {
  CharacterId,
  DeviceId,
  Instant,
  TenantId,
} from "@masanawa/contracts";

export const characterDeviceAssignmentRoles = [
  "primary",
  "secondary",
  "pooled",
] as const;
export type CharacterDeviceAssignmentRole =
  (typeof characterDeviceAssignmentRoles)[number];

export const characterDeviceAssignmentStates = [
  "active",
  "suspended",
  "revoked",
] as const;
export type CharacterDeviceAssignmentState =
  (typeof characterDeviceAssignmentStates)[number];

export const characterDeviceAssignmentLimits = Object.freeze({
  maxAllowedCapabilities: 128,
} as const);

export interface CharacterDeviceCapabilityPolicy {
  readonly allowedCapabilityKeys: readonly string[];
  readonly allowDegradedCapability: boolean;
  readonly allowDegradedDeviceHealth: boolean;
}

export interface CharacterDeviceAssignment {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly deviceId: DeviceId;
  readonly role: CharacterDeviceAssignmentRole;
  readonly state: CharacterDeviceAssignmentState;
  readonly policy: CharacterDeviceCapabilityPolicy;
  readonly validFrom: Instant;
  readonly validUntil: Instant | null;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export type CharacterDeviceCapabilityDecisionReason =
  | "allowed"
  | "assignment-inactive"
  | "outside-validity-window"
  | "device-inactive"
  | "scope-mismatch"
  | "capability-not-granted"
  | "capability-not-published"
  | "capability-unavailable"
  | "capability-degraded"
  | "device-health-missing"
  | "device-health-stale"
  | "device-health-unavailable"
  | "device-health-degraded";

export interface CharacterDeviceCapabilityDecision {
  readonly allowed: boolean;
  readonly reason: CharacterDeviceCapabilityDecisionReason;
  readonly capabilityKey: string;
}
