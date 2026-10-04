import type {
  DeviceId,
  Instant,
  TenantId,
} from "@masanawa/contracts";

export const deviceCapabilityLimits = Object.freeze({
  maxCapabilities: 128,
  maxCapabilityKeyLength: 160,
  maxReasonLength: 500,
} as const);

export type DeviceCapabilityReadiness =
  | "ready"
  | "degraded"
  | "unavailable";

export interface DeviceCapabilityFact {
  readonly key: string;
  readonly readiness: DeviceCapabilityReadiness;
  readonly reason: string | null;
  readonly observedAt: Instant;
}

export interface DeviceCapabilityPublication {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly capabilities: readonly DeviceCapabilityFact[];
  readonly publishedAt: Instant;
}

export type DeviceHealthState =
  | "healthy"
  | "degraded"
  | "unavailable";

export interface DeviceHealthFact {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly state: DeviceHealthState;
  readonly reason: string | null;
  readonly observedAt: Instant;
}

export interface DeviceCapabilitySnapshot {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly capabilities: readonly DeviceCapabilityFact[];
  readonly health: DeviceHealthFact | null;
  readonly healthStale: boolean;
}
