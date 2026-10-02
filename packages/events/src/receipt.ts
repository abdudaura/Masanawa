import {
  isCanonicalId,
  toInstant,
  type ExternalReceiptId,
  type Instant,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";

export interface ExternalReceiptEvidence {
  readonly provider: string;
  readonly observationKey: string;
  readonly providerReference: string | null;
  readonly normalizedStatus: string;
  readonly payloadHash: string | null;
  readonly payloadRef: string | null;
  readonly observedAt: Instant;
  readonly verificationMethod: string;
  readonly providerVersion: string | null;
}

export interface ExternalReceiptRecord extends ExternalReceiptEvidence {
  readonly externalReceiptId: ExternalReceiptId;
  readonly tenantId: TenantId;
  readonly operationId: OperationId;
  readonly createdAt: Instant;
}

function bounded(
  value: string,
  name: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function optionalBounded(
  value: string | null,
  name: string,
  maxLength: number,
): string | null {
  return value === null ? null : bounded(value, name, maxLength);
}

export function normalizeExternalReceiptEvidence(
  input: ExternalReceiptEvidence,
): ExternalReceiptEvidence {
  return Object.freeze({
    provider: bounded(input.provider, "externalReceipt.provider", 200),
    observationKey: bounded(
      input.observationKey,
      "externalReceipt.observationKey",
      500,
    ),
    providerReference: optionalBounded(
      input.providerReference,
      "externalReceipt.providerReference",
      1000,
    ),
    normalizedStatus: bounded(
      input.normalizedStatus,
      "externalReceipt.normalizedStatus",
      200,
    ),
    payloadHash: optionalBounded(
      input.payloadHash,
      "externalReceipt.payloadHash",
      500,
    ),
    payloadRef: optionalBounded(
      input.payloadRef,
      "externalReceipt.payloadRef",
      2000,
    ),
    observedAt: toInstant(input.observedAt),
    verificationMethod: bounded(
      input.verificationMethod,
      "externalReceipt.verificationMethod",
      200,
    ),
    providerVersion: optionalBounded(
      input.providerVersion,
      "externalReceipt.providerVersion",
      200,
    ),
  });
}

export function normalizeExternalReceiptRecord(
  input: ExternalReceiptRecord,
): ExternalReceiptRecord {
  if (!isCanonicalId("external-receipt", input.externalReceiptId)) {
    throw new TypeError("externalReceiptId is invalid");
  }
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("externalReceipt tenantId is invalid");
  }
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("externalReceipt operationId is invalid");
  }
  return Object.freeze({
    externalReceiptId: input.externalReceiptId,
    tenantId: input.tenantId,
    operationId: input.operationId,
    ...normalizeExternalReceiptEvidence(input),
    createdAt: toInstant(input.createdAt),
  });
}
