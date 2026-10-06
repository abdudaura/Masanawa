import {
  normalizeCapabilityKey,
  parseCanonicalId,
  toInstant,
  type AuthorityContextId,
  type DeviceId,
  type Instant,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";
import {
  canonicalJson,
  fingerprintCanonicalJson,
  type CanonicalJson,
} from "@masanawa/security";

export interface SignedDeviceOperationEnvelope {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly operationId: OperationId;
  readonly authorityContextId: AuthorityContextId;
  readonly deviceId: DeviceId;
  readonly capability: string;
  readonly idempotencyKey: string;
  readonly payload: CanonicalJson;
  readonly payloadHash: string;
  readonly issuedAt: Instant;
  readonly deadlineAt: Instant;
  readonly signatureKeyId: string;
  readonly signature: string;
}

export type LocalDeviceOperationState =
  | "queued"
  | "executing"
  | "succeeded"
  | "failed"
  | "unknown";

export interface LocalDeviceReceipt {
  readonly receiptId: string;
  readonly operationId: OperationId;
  readonly outcome: "succeeded" | "failed" | "unknown";
  readonly evidenceHash: string | null;
  readonly evidenceRef: string | null;
  readonly reasonCode: string | null;
  readonly observedAt: Instant;
}

export interface LocalDeviceOperationRecord {
  readonly envelope: SignedDeviceOperationEnvelope;
  readonly envelopeFingerprint: string;
  readonly state: LocalDeviceOperationState;
  readonly receipt: LocalDeviceReceipt | null;
  readonly receiptUploadState: "none" | "pending" | "acknowledged";
  readonly acceptedAt: Instant;
  readonly updatedAt: Instant;
}

export interface AndroidDeviceOperationSignatureVerifier {
  verify(input: {
    readonly signatureKeyId: string;
    readonly signature: string;
    readonly signingPayload: string;
  }): Promise<boolean>;
}

export interface AndroidDeviceOperationStore {
  claim(input: {
    readonly record: LocalDeviceOperationRecord;
  }): Promise<{
    readonly created: boolean;
    readonly record: LocalDeviceOperationRecord;
  }>;

  claimExecution(input: {
    readonly operationId: OperationId;
    readonly at: Instant;
  }): Promise<
    | { readonly outcome: "claimed"; readonly record: LocalDeviceOperationRecord }
    | {
        readonly outcome: "already-executing";
        readonly record: LocalDeviceOperationRecord;
      }
    | { readonly outcome: "terminal"; readonly record: LocalDeviceOperationRecord }
  >;

  settle(input: {
    readonly operationId: OperationId;
    readonly expectedState: "executing";
    readonly state: "succeeded" | "failed" | "unknown";
    readonly receipt: LocalDeviceReceipt;
    readonly at: Instant;
  }): Promise<LocalDeviceOperationRecord>;

  markUnknown(input: {
    readonly operationId: OperationId;
    readonly expectedState: "executing";
    readonly receipt: LocalDeviceReceipt;
    readonly at: Instant;
  }): Promise<LocalDeviceOperationRecord>;

  read(operationId: OperationId): Promise<LocalDeviceOperationRecord | null>;

  listPendingReceipts(input: {
    readonly limit: number;
  }): Promise<readonly LocalDeviceOperationRecord[]>;

  acknowledgeReceipt(input: {
    readonly operationId: OperationId;
    readonly receiptId: string;
    readonly at: Instant;
  }): Promise<LocalDeviceOperationRecord>;
}

export type AndroidDeviceExecutionOutcome =
  | {
      readonly status: "succeeded";
      readonly evidenceHash: string | null;
      readonly evidenceRef: string | null;
      readonly observedAt: Instant;
    }
  | {
      readonly status: "failed-before-effect";
      readonly reasonCode: string;
      readonly evidenceHash: string | null;
      readonly evidenceRef: string | null;
      readonly observedAt: Instant;
    }
  | {
      readonly status: "unknown";
      readonly reasonCode: string;
      readonly evidenceHash: string | null;
      readonly evidenceRef: string | null;
      readonly observedAt: Instant;
    };

export interface AndroidDeviceOperationExecutor {
  execute(input: {
    readonly operationId: OperationId;
    readonly capability: string;
    readonly payload: CanonicalJson;
    readonly deadlineAt: Instant;
  }): Promise<AndroidDeviceExecutionOutcome>;
}

export interface AndroidDeviceOperationQueue {
  accept(input: SignedDeviceOperationEnvelope): Promise<{
    readonly outcome: "queued" | "replay";
    readonly record: LocalDeviceOperationRecord;
  }>;

  execute(operationId: string): Promise<LocalDeviceOperationRecord>;

  read(operationId: string): Promise<LocalDeviceOperationRecord | null>;

  pendingReceipts(limit?: number): Promise<readonly LocalDeviceOperationRecord[]>;

  acknowledgeReceipt(input: {
    readonly operationId: string;
    readonly receiptId: string;
  }): Promise<LocalDeviceOperationRecord>;
}

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

function canonicalPayload(value: CanonicalJson): CanonicalJson {
  return JSON.parse(canonicalJson(value)) as CanonicalJson;
}

function payloadHash(value: CanonicalJson): string {
  return fingerprintCanonicalJson(value);
}

function normalizeEnvelope(
  input: SignedDeviceOperationEnvelope,
): SignedDeviceOperationEnvelope {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported DeviceOperation envelope schema");
  }
  const payload = canonicalPayload(input.payload);
  const actualPayloadHash = payloadHash(payload);
  if (bounded(input.payloadHash, "payloadHash", 16, 256) !== actualPayloadHash) {
    throw new Error("DeviceOperation payload hash mismatch");
  }

  const issuedAt = toInstant(input.issuedAt);
  const deadlineAt = toInstant(input.deadlineAt);
  if (deadlineAt <= issuedAt) {
    throw new Error("DeviceOperation deadline must follow issuance");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    operationId: parseCanonicalId("operation", input.operationId),
    authorityContextId: parseCanonicalId(
      "authority-context",
      input.authorityContextId,
    ),
    deviceId: parseCanonicalId("device", input.deviceId),
    capability: normalizeCapabilityKey(input.capability),
    idempotencyKey: bounded(input.idempotencyKey, "idempotencyKey", 1, 256),
    payload,
    payloadHash: actualPayloadHash,
    issuedAt,
    deadlineAt,
    signatureKeyId: bounded(input.signatureKeyId, "signatureKeyId", 3, 256),
    signature: bounded(input.signature, "signature", 16, 4096),
  });
}

export function deviceOperationSigningPayload(
  input: SignedDeviceOperationEnvelope,
): string {
  const envelope = normalizeEnvelope(input);
  return canonicalJson({
    schemaVersion: envelope.schemaVersion,
    tenantId: envelope.tenantId,
    operationId: envelope.operationId,
    authorityContextId: envelope.authorityContextId,
    deviceId: envelope.deviceId,
    capability: envelope.capability,
    idempotencyKey: envelope.idempotencyKey,
    payloadHash: envelope.payloadHash,
    issuedAt: envelope.issuedAt,
    deadlineAt: envelope.deadlineAt,
    signatureKeyId: envelope.signatureKeyId,
  });
}

function envelopeFingerprint(
  input: SignedDeviceOperationEnvelope,
): string {
  return fingerprintCanonicalJson({
    signingPayload: deviceOperationSigningPayload(input),
  });
}

function normalizeReceipt(
  input: LocalDeviceReceipt,
): LocalDeviceReceipt {
  const operationId = parseCanonicalId("operation", input.operationId);
  if (
    input.outcome !== "succeeded" &&
    input.outcome !== "failed" &&
    input.outcome !== "unknown"
  ) {
    throw new TypeError("Device receipt outcome is invalid");
  }
  const reasonCode =
    input.reasonCode === null
      ? null
      : bounded(input.reasonCode, "receipt.reasonCode", 1, 160);
  if (input.outcome === "succeeded" && reasonCode !== null) {
    throw new Error("successful receipt cannot carry a failure reason");
  }
  if (input.outcome !== "succeeded" && reasonCode === null) {
    throw new Error("non-success receipt requires a reason code");
  }
  return Object.freeze({
    receiptId: bounded(input.receiptId, "receiptId", 8, 256),
    operationId,
    outcome: input.outcome,
    evidenceHash:
      input.evidenceHash === null
        ? null
        : bounded(input.evidenceHash, "receipt.evidenceHash", 8, 256),
    evidenceRef:
      input.evidenceRef === null
        ? null
        : bounded(input.evidenceRef, "receipt.evidenceRef", 1, 2048),
    reasonCode,
    observedAt: toInstant(input.observedAt),
  });
}

function receiptForOutcome(input: {
  readonly operationId: OperationId;
  readonly outcome: AndroidDeviceExecutionOutcome;
}): LocalDeviceReceipt {
  const outcome =
    input.outcome.status === "succeeded"
      ? "succeeded"
      : input.outcome.status === "failed-before-effect"
        ? "failed"
        : "unknown";
  const reasonCode =
    input.outcome.status === "succeeded"
      ? null
      : input.outcome.reasonCode;
  const evidenceIdentity = fingerprintCanonicalJson({
    operationId: input.operationId,
    outcome,
    evidenceHash: input.outcome.evidenceHash,
    evidenceRef: input.outcome.evidenceRef,
    reasonCode,
    observedAt: input.outcome.observedAt,
  });

  return normalizeReceipt({
    receiptId: `device-receipt:${evidenceIdentity}`,
    operationId: input.operationId,
    outcome,
    evidenceHash: input.outcome.evidenceHash,
    evidenceRef: input.outcome.evidenceRef,
    reasonCode,
    observedAt: input.outcome.observedAt,
  });
}

export function createAndroidDeviceOperationQueue(input: {
  readonly deviceId: DeviceId;
  readonly verifier: AndroidDeviceOperationSignatureVerifier;
  readonly store: AndroidDeviceOperationStore;
  readonly executor: AndroidDeviceOperationExecutor;
  readonly now?: () => Instant;
}): AndroidDeviceOperationQueue {
  const deviceId = parseCanonicalId("device", input.deviceId);
  const now = input.now ?? (() => new Date().toISOString() as Instant);

  async function read(operationId: string): Promise<LocalDeviceOperationRecord | null> {
    return input.store.read(parseCanonicalId("operation", operationId));
  }

  return Object.freeze({
    async accept(rawEnvelope) {
      const envelope = normalizeEnvelope(rawEnvelope);
      if (envelope.deviceId !== deviceId) {
        throw new Error("DeviceOperation targets another Device");
      }

      const observedNow = toInstant(now());
      if (envelope.issuedAt > observedNow) {
        throw new Error("DeviceOperation is not active yet");
      }
      if (envelope.deadlineAt <= observedNow) {
        throw new Error("DeviceOperation deadline expired");
      }

      const signingPayload = deviceOperationSigningPayload(envelope);
      const valid = await input.verifier.verify({
        signatureKeyId: envelope.signatureKeyId,
        signature: envelope.signature,
        signingPayload,
      });
      if (!valid) {
        throw new Error("DeviceOperation signature verification failed");
      }

      const acceptedAt = observedNow;
      const record: LocalDeviceOperationRecord = Object.freeze({
        envelope,
        envelopeFingerprint: envelopeFingerprint(envelope),
        state: "queued" as const,
        receipt: null,
        receiptUploadState: "none" as const,
        acceptedAt,
        updatedAt: acceptedAt,
      });
      const claimed = await input.store.claim({ record });
      if (claimed.record.envelopeFingerprint !== record.envelopeFingerprint) {
        throw new Error("DeviceOperation replay changed signed payload");
      }
      return Object.freeze({
        outcome: claimed.created ? ("queued" as const) : ("replay" as const),
        record: claimed.record,
      });
    },

    async execute(rawOperationId) {
      const operationId = parseCanonicalId("operation", rawOperationId);
      const claimed = await input.store.claimExecution({
        operationId,
        at: toInstant(now()),
      });

      if (claimed.outcome === "terminal") {
        return claimed.record;
      }

      if (claimed.outcome === "already-executing") {
        const observedAt = toInstant(now());
        const receipt = normalizeReceipt({
          receiptId: `device-receipt:restart:${operationId}`,
          operationId,
          outcome: "unknown",
          evidenceHash: null,
          evidenceRef: null,
          reasonCode: "device.restart-inflight",
          observedAt,
        });
        return input.store.markUnknown({
          operationId,
          expectedState: "executing",
          receipt,
          at: observedAt,
        });
      }

      const record = claimed.record;
      const observedNow = toInstant(now());
      if (record.envelope.deadlineAt <= observedNow) {
        const receipt = normalizeReceipt({
          receiptId: `device-receipt:expired:${operationId}`,
          operationId,
          outcome: "failed",
          evidenceHash: null,
          evidenceRef: null,
          reasonCode: "device.operation-deadline-expired-before-execution",
          observedAt: observedNow,
        });
        return input.store.settle({
          operationId,
          expectedState: "executing",
          state: "failed",
          receipt,
          at: observedNow,
        });
      }

      let outcome: AndroidDeviceExecutionOutcome;
      try {
        outcome = await input.executor.execute({
          operationId,
          capability: record.envelope.capability,
          payload: record.envelope.payload,
          deadlineAt: record.envelope.deadlineAt,
        });
      } catch {
        outcome = {
          status: "unknown",
          reasonCode: "device.executor-threw",
          evidenceHash: null,
          evidenceRef: null,
          observedAt: toInstant(now()),
        };
      }

      const receipt = receiptForOutcome({ operationId, outcome });
      const state =
        outcome.status === "succeeded"
          ? "succeeded"
          : outcome.status === "failed-before-effect"
            ? "failed"
            : "unknown";

      return input.store.settle({
        operationId,
        expectedState: "executing",
        state,
        receipt,
        at: toInstant(now()),
      });
    },

    read,

    async pendingReceipts(limit = 100) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
        throw new RangeError("pending receipt limit is invalid");
      }
      return input.store.listPendingReceipts({ limit });
    },

    async acknowledgeReceipt(request) {
      return input.store.acknowledgeReceipt({
        operationId: parseCanonicalId("operation", request.operationId),
        receiptId: bounded(request.receiptId, "receiptId", 8, 256),
        at: toInstant(now()),
      });
    },
  });
}
