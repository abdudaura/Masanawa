import {
  isCanonicalId,
  type DeviceId,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";

export type OmniSipMessagingSim = "SIM1" | "SIM2";

export interface OmniSipMessagingCapabilitySnapshot {
  readonly sms: {
    readonly readiness: "ready" | "degraded" | "unavailable";
    readonly reason: string | null;
  };
  readonly ussd: {
    readonly readiness: "ready" | "degraded" | "unavailable";
    readonly reason: string | null;
  };
  readonly availableSims: readonly OmniSipMessagingSim[];
}

interface BaseCommand {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly operationId: OperationId;
  readonly idempotencyKey: string;
  readonly sim: OmniSipMessagingSim;
}

export interface OmniSipSmsCommand extends BaseCommand {
  readonly destination: string;
  readonly body: string;
}

export interface OmniSipUssdCommand extends BaseCommand {
  readonly code: string;
}

export interface OmniSipLocalControlEdge {
  sendSms(input: {
    readonly destination: string;
    readonly body: string;
    readonly sim: OmniSipMessagingSim;
    readonly dispatchKey: string;
  }): Promise<
    | { readonly accepted: true; readonly providerReference: string }
    | { readonly accepted: false; readonly reasonCode: string }
  >;

  requestUssd(input: {
    readonly code: string;
    readonly sim: OmniSipMessagingSim;
    readonly dispatchKey: string;
  }): Promise<
    | { readonly accepted: true; readonly requestId: string }
    | { readonly accepted: false; readonly reasonCode: string }
  >;

  readUssd(input: {
    readonly requestId: string;
  }): Promise<
    | { readonly status: "pending" }
    | { readonly status: "success"; readonly response: string }
    | { readonly status: "failed"; readonly response: string }
  >;
}

export type OmniSipMessagingDispatchReceipt =
  | {
      readonly outcome: "accepted";
      readonly operationId: OperationId;
      readonly dispatchKey: string;
      readonly providerReference: string;
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

export interface OmniSipUssdStatusEvidence {
  readonly requestId: string;
  readonly status: "pending" | "success" | "failed";
  readonly response: string | null;
}

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function e164(value: string): string {
  const normalized = bounded(value, "SMS destination", 8, 32);
  if (!/^\+[1-9][0-9]{6,14}$/u.test(normalized)) {
    throw new TypeError("SMS destination must be E.164");
  }
  return normalized;
}

function sim(value: OmniSipMessagingSim): OmniSipMessagingSim {
  if (value !== "SIM1" && value !== "SIM2") {
    throw new TypeError("Explicit SIM1 or SIM2 selection is required");
  }
  return value;
}

function reason(value: string): string {
  const normalized = bounded(value, "reasonCode", 1, 160)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (!normalized) throw new TypeError("reasonCode is invalid");
  return normalized;
}

function canonicalBase<T extends BaseCommand>(input: T): T {
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("tenantId is invalid");
  }
  if (!isCanonicalId("device", input.deviceId)) {
    throw new TypeError("deviceId is invalid");
  }
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("operationId is invalid");
  }
  bounded(input.idempotencyKey, "idempotencyKey", 1, 256);
  sim(input.sim);
  return input;
}

export function normalizeOmniSipSmsCommand(
  input: OmniSipSmsCommand,
): OmniSipSmsCommand {
  canonicalBase(input);
  return Object.freeze({
    ...input,
    idempotencyKey: bounded(input.idempotencyKey, "idempotencyKey", 1, 256),
    sim: sim(input.sim),
    destination: e164(input.destination),
    body: bounded(input.body, "SMS body", 1, 4_096),
  });
}

export function normalizeOmniSipUssdCommand(
  input: OmniSipUssdCommand,
): OmniSipUssdCommand {
  canonicalBase(input);
  const code = bounded(input.code, "USSD code", 2, 160);
  if (!/^\*[0-9*#]+#$/u.test(code)) {
    throw new TypeError("USSD code must start with * and end with #");
  }
  return Object.freeze({
    ...input,
    idempotencyKey: bounded(input.idempotencyKey, "idempotencyKey", 1, 256),
    sim: sim(input.sim),
    code,
  });
}

export function omniSipMessagingDispatchKey(
  input: Pick<BaseCommand, "operationId" | "idempotencyKey">,
): string {
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("operationId is invalid");
  }
  return [
    input.operationId,
    encodeURIComponent(
      bounded(input.idempotencyKey, "idempotencyKey", 1, 256),
    ),
  ].join(":");
}

function assertCapability(input: {
  readonly snapshot: OmniSipMessagingCapabilitySnapshot;
  readonly kind: "sms" | "ussd";
  readonly sim: OmniSipMessagingSim;
}): void {
  const capability = input.snapshot[input.kind];
  if (capability.readiness !== "ready") {
    throw new Error(
      `OmniSIP ${input.kind} capability is not ready: ${capability.reason ?? "unknown"}`,
    );
  }
  if (!input.snapshot.availableSims.includes(input.sim)) {
    throw new Error("Requested OmniSIP SIM is unavailable");
  }
}

export async function dispatchOmniSipSms(input: {
  readonly command: OmniSipSmsCommand;
  readonly capability: OmniSipMessagingCapabilitySnapshot;
  readonly edge: OmniSipLocalControlEdge;
}): Promise<OmniSipMessagingDispatchReceipt> {
  const command = normalizeOmniSipSmsCommand(input.command);
  assertCapability({
    snapshot: input.capability,
    kind: "sms",
    sim: command.sim,
  });
  const dispatchKey = omniSipMessagingDispatchKey(command);

  try {
    const result = await input.edge.sendSms({
      destination: command.destination,
      body: command.body,
      sim: command.sim,
      dispatchKey,
    });
    if (!result.accepted) {
      return Object.freeze({
        outcome: "rejected" as const,
        operationId: command.operationId,
        dispatchKey,
        reasonCode: reason(result.reasonCode),
      });
    }
    return Object.freeze({
      outcome: "accepted" as const,
      operationId: command.operationId,
      dispatchKey,
      providerReference: bounded(
        result.providerReference,
        "SMS providerReference",
        1,
        256,
      ),
    });
  } catch {
    return Object.freeze({
      outcome: "unknown" as const,
      operationId: command.operationId,
      dispatchKey,
      reasonCode: "dispatch-outcome-unknown" as const,
    });
  }
}

export async function dispatchOmniSipUssd(input: {
  readonly command: OmniSipUssdCommand;
  readonly capability: OmniSipMessagingCapabilitySnapshot;
  readonly edge: OmniSipLocalControlEdge;
}): Promise<OmniSipMessagingDispatchReceipt> {
  const command = normalizeOmniSipUssdCommand(input.command);
  assertCapability({
    snapshot: input.capability,
    kind: "ussd",
    sim: command.sim,
  });
  const dispatchKey = omniSipMessagingDispatchKey(command);

  try {
    const result = await input.edge.requestUssd({
      code: command.code,
      sim: command.sim,
      dispatchKey,
    });
    if (!result.accepted) {
      return Object.freeze({
        outcome: "rejected" as const,
        operationId: command.operationId,
        dispatchKey,
        reasonCode: reason(result.reasonCode),
      });
    }
    return Object.freeze({
      outcome: "accepted" as const,
      operationId: command.operationId,
      dispatchKey,
      providerReference: bounded(result.requestId, "USSD requestId", 1, 256),
    });
  } catch {
    return Object.freeze({
      outcome: "unknown" as const,
      operationId: command.operationId,
      dispatchKey,
      reasonCode: "dispatch-outcome-unknown" as const,
    });
  }
}

export async function readOmniSipUssdStatus(input: {
  readonly requestId: string;
  readonly edge: OmniSipLocalControlEdge;
}): Promise<OmniSipUssdStatusEvidence> {
  const requestId = bounded(input.requestId, "USSD requestId", 1, 256);
  const result = await input.edge.readUssd({ requestId });

  if (result.status === "pending") {
    return Object.freeze({
      requestId,
      status: "pending" as const,
      response: null,
    });
  }

  return Object.freeze({
    requestId,
    status: result.status,
    // This is provider transport evidence only. Domain code must never treat
    // arbitrary USSD text as settlement, balance or payment authority.
    response: bounded(result.response, "USSD response", 0, 8_192),
  });
}
