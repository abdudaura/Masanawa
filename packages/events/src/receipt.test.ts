import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  normalizeExternalReceiptEvidence,
  normalizeExternalReceiptRecord,
} from "./receipt.js";

describe("external receipt evidence", () => {
  it("normalizes bounded sanitized evidence without raw payload content", () => {
    const evidence = normalizeExternalReceiptEvidence({
      provider: "  payment-provider  ",
      observationKey: " provider-response:1 ",
      providerReference: " txn-1 ",
      normalizedStatus: " succeeded ",
      payloadHash: " sha256:abc ",
      payloadRef: " object://receipts/1 ",
      observedAt: toInstant("2026-10-02T10:00:00Z"),
      verificationMethod: " signed-response ",
      providerVersion: " v1 ",
    });

    expect(evidence).toEqual({
      provider: "payment-provider",
      observationKey: "provider-response:1",
      providerReference: "txn-1",
      normalizedStatus: "succeeded",
      payloadHash: "sha256:abc",
      payloadRef: "object://receipts/1",
      observedAt: "2026-10-02T10:00:00.000Z",
      verificationMethod: "signed-response",
      providerVersion: "v1",
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect("payload" in evidence).toBe(false);
  });

  it("requires canonical receipt, tenant and operation identities", () => {
    const record = normalizeExternalReceiptRecord({
      externalReceiptId: createCanonicalId("external-receipt"),
      tenantId: createCanonicalId("tenant"),
      operationId: createCanonicalId("operation"),
      provider: "provider",
      observationKey: "response:1",
      providerReference: null,
      normalizedStatus: "accepted",
      payloadHash: null,
      payloadRef: null,
      observedAt: toInstant("2026-10-02T10:00:00Z"),
      verificationMethod: "provider-response",
      providerVersion: "v1",
      createdAt: toInstant("2026-10-02T10:00:01Z"),
    });
    expect(record.normalizedStatus).toBe("accepted");

    expect(() =>
      normalizeExternalReceiptRecord({
        ...record,
        operationId: "operation_not-a-uuidv7" as never,
      }),
    ).toThrow(/operationId is invalid/u);
  });
});
