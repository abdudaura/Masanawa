import {
  isCanonicalId,
  type DeviceId,
  type Instant,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";

export const omniSipTelephonyCapabilities = [
  "telephony.call.place",
  "telephony.audio.bridge",
] as const;

export type OmniSipSimSlot = "SIM1" | "SIM2";

export interface OmniSipStatusSnapshot {
  readonly readiness: string;
  readonly sip: {
    readonly registered: boolean;
    readonly transport: string;
    readonly secureMedia: string;
  };
  readonly activeCalls: number;
  readonly sims: readonly {
    readonly slot: number;
    readonly subscriptionId: number;
    readonly voiceCapable: boolean;
  }[];
  readonly audio: {
    readonly status: string;
    readonly profileId: string;
  };
  readonly concurrency: {
    readonly status: string;
    readonly maxConcurrentCalls: number;
  };
  readonly deviceHealth: {
    readonly allowsNewCalls: boolean;
    readonly blockReason: string | null;
  };
}

export interface OmniSipProviderProjection {
  readonly state: "ready" | "degraded" | "unavailable";
  readonly reasonCode: string | null;
  readonly capabilities: readonly {
    readonly key: (typeof omniSipTelephonyCapabilities)[number];
    readonly readiness: "ready" | "degraded" | "unavailable";
    readonly reason: string | null;
  }[];
  readonly readySims: readonly OmniSipSimSlot[];
  readonly maxConcurrentCalls: number;
  readonly activeCalls: number;
}

export interface OmniSipOutboundVoiceCommand {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly operationId: OperationId;
  readonly idempotencyKey: string;
  readonly destination: string;
  readonly callerId: string;
  readonly sim: OmniSipSimSlot;
}

export interface OmniSipIpCallEdge {
  /**
   * This edge MUST enter OmniSIP through its IP/SIP-controlled call boundary.
   * Implementations must not invoke Android Telecom dial directly.
   */
  originate(input: {
    readonly destination: string;
    readonly callerId: string;
    readonly sim: OmniSipSimSlot;
    readonly dispatchKey: string;
  }): Promise<
    | { readonly accepted: true; readonly callId: string }
    | { readonly accepted: false; readonly reasonCode: string }
  >;
}

export type OmniSipDispatchReceipt =
  | {
      readonly outcome: "accepted";
      readonly operationId: OperationId;
      readonly dispatchKey: string;
      readonly callId: string;
    }
  | {
      readonly outcome: "rejected";
      readonly operationId: OperationId;
      readonly dispatchKey: string;
      readonly reasonCode: string;
    }
  | {
      readonly outcome: "unknown";
      readonly operationId: OperationId;
      readonly dispatchKey: string;
      readonly reasonCode: "dispatch-outcome-unknown";
    };

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function e164(value: string, name: string): string {
  const normalized = bounded(value, name, 32);
  if (!/^\+[1-9][0-9]{6,14}$/u.test(normalized)) {
    throw new TypeError(`${name} must be E.164`);
  }
  return normalized;
}

function simSlotFromStatus(slot: number): OmniSipSimSlot | null {
  if (slot === 1) return "SIM1";
  if (slot === 2) return "SIM2";
  return null;
}

function reasonCode(value: string): string {
  const normalized = bounded(value, "reasonCode", 160)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (!normalized) throw new TypeError("reasonCode is invalid");
  return normalized;
}

export function projectOmniSipTelephonyProvider(
  status: OmniSipStatusSnapshot,
): OmniSipProviderProjection {
  if (!Number.isSafeInteger(status.activeCalls) || status.activeCalls < 0) {
    throw new RangeError("OmniSIP activeCalls is invalid");
  }
  if (
    !Number.isSafeInteger(status.concurrency.maxConcurrentCalls) ||
    status.concurrency.maxConcurrentCalls < 1 ||
    status.concurrency.maxConcurrentCalls > 2
  ) {
    throw new RangeError("OmniSIP maxConcurrentCalls is invalid");
  }

  const readySims = status.sims.flatMap((item) => {
    const slot = simSlotFromStatus(item.slot);
    return slot !== null && item.voiceCapable ? [slot] : [];
  });
  const uniqueReadySims = Object.freeze([...new Set(readySims)].sort());

  const sipReady = status.readiness === "ready" && status.sip.registered;
  const audioReady = status.audio.status === "BIDIRECTIONAL_VERIFIED";
  const healthReady = status.deviceHealth.allowsNewCalls;
  const capacityReady =
    status.activeCalls < status.concurrency.maxConcurrentCalls;
  const hasSim = uniqueReadySims.length > 0;

  let state: OmniSipProviderProjection["state"] = "ready";
  let reason: string | null = null;
  if (!sipReady) {
    state = "unavailable";
    reason = "sip-not-ready";
  } else if (!audioReady) {
    state = "unavailable";
    reason = "audio-not-qualified";
  } else if (!healthReady) {
    state = "unavailable";
    reason = status.deviceHealth.blockReason
      ? `device-health-${reasonCode(status.deviceHealth.blockReason)}`
      : "device-health-blocked";
  } else if (!hasSim) {
    state = "unavailable";
    reason = "no-voice-capable-sim";
  } else if (!capacityReady) {
    state = "degraded";
    reason = "call-capacity-full";
  }

  const callReadiness =
    state === "ready"
      ? { readiness: "ready" as const, reason: null }
      : {
          readiness: state === "degraded" ? ("degraded" as const) : ("unavailable" as const),
          reason,
        };
  const mediaReadiness = audioReady
    ? { readiness: "ready" as const, reason: null }
    : { readiness: "unavailable" as const, reason: "audio-not-qualified" };

  return Object.freeze({
    state,
    reasonCode: reason,
    capabilities: Object.freeze([
      Object.freeze({
        key: "telephony.call.place" as const,
        ...callReadiness,
      }),
      Object.freeze({
        key: "telephony.audio.bridge" as const,
        ...mediaReadiness,
      }),
    ]),
    readySims: uniqueReadySims,
    maxConcurrentCalls: status.concurrency.maxConcurrentCalls,
    activeCalls: status.activeCalls,
  });
}

export function normalizeOmniSipOutboundVoiceCommand(
  input: OmniSipOutboundVoiceCommand,
): OmniSipOutboundVoiceCommand {
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("tenantId is invalid");
  }
  if (!isCanonicalId("device", input.deviceId)) {
    throw new TypeError("deviceId is invalid");
  }
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("operationId is invalid");
  }
  if (input.sim !== "SIM1" && input.sim !== "SIM2") {
    throw new TypeError("Explicit SIM1 or SIM2 selection is required");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    operationId: input.operationId,
    idempotencyKey: bounded(input.idempotencyKey, "idempotencyKey", 256),
    destination: e164(input.destination, "destination"),
    callerId: e164(input.callerId, "callerId"),
    sim: input.sim,
  });
}

export function omniSipDispatchKey(
  command: OmniSipOutboundVoiceCommand,
): string {
  const normalized = normalizeOmniSipOutboundVoiceCommand(command);
  return [
    normalized.operationId,
    encodeURIComponent(normalized.idempotencyKey),
  ].join(":");
}

export function assertOmniSipVoiceAdmission(input: {
  readonly command: OmniSipOutboundVoiceCommand;
  readonly status: OmniSipStatusSnapshot;
}): OmniSipProviderProjection {
  const command = normalizeOmniSipOutboundVoiceCommand(input.command);
  const projection = projectOmniSipTelephonyProvider(input.status);
  if (projection.state !== "ready") {
    throw new Error(
      `OmniSIP voice provider is not ready: ${projection.reasonCode ?? "unknown"}`,
    );
  }
  if (!projection.readySims.includes(command.sim)) {
    throw new Error("Requested OmniSIP SIM is not voice-capable/available");
  }
  return projection;
}

export async function dispatchOmniSipVoiceCall(input: {
  readonly command: OmniSipOutboundVoiceCommand;
  readonly status: OmniSipStatusSnapshot;
  readonly edge: OmniSipIpCallEdge;
}): Promise<OmniSipDispatchReceipt> {
  const command = normalizeOmniSipOutboundVoiceCommand(input.command);
  assertOmniSipVoiceAdmission({ command, status: input.status });
  const dispatchKey = omniSipDispatchKey(command);

  try {
    const outcome = await input.edge.originate({
      destination: command.destination,
      callerId: command.callerId,
      sim: command.sim,
      dispatchKey,
    });
    if (!outcome.accepted) {
      return Object.freeze({
        outcome: "rejected" as const,
        operationId: command.operationId,
        dispatchKey,
        reasonCode: reasonCode(outcome.reasonCode),
      });
    }
    return Object.freeze({
      outcome: "accepted" as const,
      operationId: command.operationId,
      dispatchKey,
      callId: bounded(outcome.callId, "OmniSIP callId", 256),
    });
  } catch {
    // The call may have crossed the device/SIP boundary. The caller must
    // reconcile by dispatchKey/call evidence and MUST NOT blindly redispatch.
    return Object.freeze({
      outcome: "unknown" as const,
      operationId: command.operationId,
      dispatchKey,
      reasonCode: "dispatch-outcome-unknown" as const,
    });
  }
}

export interface OmniSipProviderEvidence {
  readonly observedAt: Instant;
  readonly projection: OmniSipProviderProjection;
}
