import type {
  DeviceId,
  Instant,
  RequestId,
  TenantId,
} from "@masanawa/contracts";

export const deviceRegistrationLimits = Object.freeze({
  maxClassLength: 64,
  maxPlatformLength: 64,
  maxPlatformVersionLength: 96,
  maxModelLength: 160,
  maxAppVersionLength: 96,
  maxEnrollmentFingerprintLength: 256,
  minPairingLifetimeMs: 60_000,
  maxPairingLifetimeMs: 900_000,
} as const);

export type DeviceLifecycleState =
  | "pending-pairing"
  | "active"
  | "suspended";

export interface DeviceRegistrationMetadata {
  readonly deviceClass: string;
  readonly platform: string;
  readonly platformVersion: string;
  readonly model: string;
  readonly appVersion: string;
}

export interface Device {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly enrollmentFingerprint: string;
  readonly metadata: DeviceRegistrationMetadata;
  readonly state: DeviceLifecycleState;
  readonly revision: number;
  readonly registeredAt: Instant;
  readonly updatedAt: Instant;
  readonly pairedAt: Instant | null;
}

export type DevicePairingChallengeState =
  | "pending"
  | "consumed"
  | "expired";

export interface DevicePairingChallenge {
  readonly tenantId: TenantId;
  readonly pairingRequestId: RequestId;
  readonly deviceId: DeviceId;
  readonly secretHash: string;
  readonly state: DevicePairingChallengeState;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
  readonly consumedAt: Instant | null;
}
