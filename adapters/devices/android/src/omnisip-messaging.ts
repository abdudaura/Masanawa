import {
  toInstant,
  type Instant,
  type OperationId,
} from "@masanawa/contracts";
import {
  fingerprintCanonicalJson,
  type CanonicalJson,
} from "@masanawa/security";
import type {
  AndroidDeviceExecutionOutcome,
  AndroidDeviceOperationExecutor,
} from "./operation-queue.js";

export type OmniSipSimSlot = "SIM1" | "SIM2";

export interface OmniSipMessagingStatusSnapshot {
  readonly smsPermissionGranted: boolean;
  readonly ussdPermissionGranted: boolean;
  readonly smsReadySims: readonly OmniSipSimSlot[];
  readonly ussdReadySims: readonly OmniSipSimSlot[];
  readonly observedAt: Instant;
}

export interface OmniSipMessagingEdge {
  sendSms(input: {
    readonly destination: string;
    readonly body: string;
    readonly sim: OmniSipSimSlot;
  }): Promise<string | null>;

  requestUssd(input: {
    readonly code: string;
    readonly sim: OmniSipSimSlot;
  }): Promise<string>;
}

export interface OmniSipMessagingStatusSource {
  read(): Promise<OmniSipMessagingStatusSnapshot>;
}

function objectPayload(value: CanonicalJson): Readonly<Record<string, CanonicalJson>> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("messaging capability payload must be an object");
  }
  return value as Readonly<Record<string, CanonicalJson>>;
}

function exactKeys(
  value: Readonly<Record<string, CanonicalJson>>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new TypeError(`messaging payload contains unknown field: ${unknown[0]}`);
  }
}

function stringField(
  object: Readonly<Record<string, CanonicalJson>>,
  key: string,
  min: number,
  max: number,
): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${key} is invalid`);
  }
  return normalized;
}

function bodyField(
  object: Readonly<Record<string, CanonicalJson>>,
): string {
  const value = object.body;
  if (typeof value !== "string") {
    throw new TypeError("body must be a string");
  }
  if (value.trim().length < 1 || value.length > 4096) {
    throw new RangeError("body is invalid");
  }
  return value;
}

function simField(
  object: Readonly<Record<string, CanonicalJson>>,
): OmniSipSimSlot {
  const sim = stringField(object, "sim", 4, 4).toUpperCase();
  if (sim !== "SIM1" && sim !== "SIM2") {
    throw new TypeError("sim must be SIM1 or SIM2");
  }
  return sim;
}

function e164(value: string): string {
  const normalized = value.replace(/[\s()-]/gu, "");
  if (!/^\+[1-9]\d{7,14}$/u.test(normalized)) {
    throw new TypeError("SMS destination must be E.164");
  }
  return normalized;
}

function ussdCode(value: string): string {
  const normalized = value.replace(/\s+/gu, "");
  if (
    normalized.length < 2 ||
    normalized.length > 182 ||
    !/^[*#0-9]+#?$/u.test(normalized)
  ) {
    throw new TypeError("USSD code is invalid");
  }
  return normalized;
}

function normalizedSims(
  values: readonly OmniSipSimSlot[],
  name: string,
): readonly OmniSipSimSlot[] {
  if (!Array.isArray(values) || values.length > 2) {
    throw new TypeError(`${name} is invalid`);
  }
  const normalized = values.map((value) => {
    if (value !== "SIM1" && value !== "SIM2") {
      throw new TypeError(`${name} contains invalid SIM`);
    }
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} contains duplicate SIM`);
  }
  return Object.freeze(normalized);
}

function normalizeStatus(
  input: OmniSipMessagingStatusSnapshot,
): OmniSipMessagingStatusSnapshot {
  if (
    typeof input.smsPermissionGranted !== "boolean" ||
    typeof input.ussdPermissionGranted !== "boolean"
  ) {
    throw new TypeError("messaging permissions are invalid");
  }
  return Object.freeze({
    smsPermissionGranted: input.smsPermissionGranted,
    ussdPermissionGranted: input.ussdPermissionGranted,
    smsReadySims: normalizedSims(input.smsReadySims, "smsReadySims"),
    ussdReadySims: normalizedSims(input.ussdReadySims, "ussdReadySims"),
    observedAt: toInstant(input.observedAt),
  });
}

function pendingEvidence(input: {
  readonly operationId: OperationId;
  readonly capability: "sms.send" | "ussd.execute";
  readonly requestId: string;
  readonly observedAt: Instant;
  readonly reasonCode: string;
}): AndroidDeviceExecutionOutcome {
  const requestId = input.requestId.trim();
  if (requestId.length < 1 || requestId.length > 256) {
    throw new TypeError("OmniSIP request id is invalid");
  }
  return Object.freeze({
    status: "unknown" as const,
    reasonCode: input.reasonCode,
    evidenceHash: fingerprintCanonicalJson({
      operationId: input.operationId,
      capability: input.capability,
      requestId,
    }),
    evidenceRef: `omnisip:${input.capability}:${encodeURIComponent(requestId)}`,
    observedAt: input.observedAt,
  });
}

function denied(
  reasonCode: string,
  observedAt: Instant,
): AndroidDeviceExecutionOutcome {
  return Object.freeze({
    status: "failed-before-effect" as const,
    reasonCode,
    evidenceHash: null,
    evidenceRef: null,
    observedAt,
  });
}

export function createOmniSipMessagingExecutor(input: {
  readonly status: OmniSipMessagingStatusSource;
  readonly edge: OmniSipMessagingEdge;
  readonly now?: () => Instant;
}): AndroidDeviceOperationExecutor {
  const now = input.now ?? (() => new Date().toISOString() as Instant);

  return Object.freeze({
    async execute(request) {
      if (request.capability !== "sms.send" && request.capability !== "ussd.execute") {
        return denied(
          "device.messaging-capability-unsupported",
          toInstant(now()),
        );
      }

      let status: OmniSipMessagingStatusSnapshot;
      try {
        status = normalizeStatus(await input.status.read());
      } catch {
        return Object.freeze({
          status: "unknown" as const,
          reasonCode: "omnisip.messaging-status-unavailable",
          evidenceHash: null,
          evidenceRef: null,
          observedAt: toInstant(now()),
        });
      }

      if (request.capability === "sms.send") {
        let destination: string;
        let body: string;
        let sim: OmniSipSimSlot;
        try {
          const payload = objectPayload(request.payload);
          exactKeys(payload, ["destination", "body", "sim"]);
          destination = e164(stringField(payload, "destination", 8, 32));
          body = bodyField(payload);
          sim = simField(payload);
        } catch {
          return denied("device.sms-payload-invalid", toInstant(now()));
        }

        if (!status.smsPermissionGranted) {
          return denied("device.sms-permission-missing", status.observedAt);
        }
        if (!status.smsReadySims.includes(sim)) {
          return denied("device.sms-sim-unavailable", status.observedAt);
        }

        try {
          const requestId = await input.edge.sendSms({
            destination,
            body,
            sim,
          });
          if (requestId === null) {
            return Object.freeze({
              status: "unknown" as const,
              reasonCode: "omnisip.sms-dispatch-outcome-unknown",
              evidenceHash: null,
              evidenceRef: null,
              observedAt: toInstant(now()),
            });
          }
          return pendingEvidence({
            operationId: request.operationId,
            capability: "sms.send",
            requestId,
            observedAt: toInstant(now()),
            reasonCode: "omnisip.sms-status-pending",
          });
        } catch {
          return Object.freeze({
            status: "unknown" as const,
            reasonCode: "omnisip.sms-dispatch-outcome-unknown",
            evidenceHash: null,
            evidenceRef: null,
            observedAt: toInstant(now()),
          });
        }
      }

      let code: string;
      let sim: OmniSipSimSlot;
      try {
        const payload = objectPayload(request.payload);
        exactKeys(payload, ["code", "sim"]);
        code = ussdCode(stringField(payload, "code", 2, 182));
        sim = simField(payload);
      } catch {
        return denied("device.ussd-payload-invalid", toInstant(now()));
      }

      if (!status.ussdPermissionGranted) {
        return denied("device.ussd-permission-missing", status.observedAt);
      }
      if (!status.ussdReadySims.includes(sim)) {
        return denied("device.ussd-sim-unavailable", status.observedAt);
      }

      try {
        const requestId = await input.edge.requestUssd({ code, sim });
        return pendingEvidence({
          operationId: request.operationId,
          capability: "ussd.execute",
          requestId,
          observedAt: toInstant(now()),
          reasonCode: "omnisip.ussd-response-pending",
        });
      } catch {
        return Object.freeze({
          status: "unknown" as const,
          reasonCode: "omnisip.ussd-dispatch-outcome-unknown",
          evidenceHash: null,
          evidenceRef: null,
          observedAt: toInstant(now()),
        });
      }
    },
  });
}
