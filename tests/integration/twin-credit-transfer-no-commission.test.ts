import { describe, expect, it } from "vitest";
import {
  admitCreditTransfer,
  reverseCreditTransfer,
  type CreditTransferReceipt,
} from "../../packages/commerce/src/transfers.js";
import {
  decideTwinCommission,
  defaultCommissionPolicy,
  type TwinAttributionRecord,
} from "../../packages/commerce/src/attribution.js";

const at = "2026-10-06T10:00:00.000Z";

function fundingAttribution(
  overrides: Partial<TwinAttributionRecord> = {},
): TwinAttributionRecord {
  return {
    attributionId: "attr-funding-1",
    ownerUserId: "owner-user",
    characterId: "personal-twin",
    customerUserId: "sender-user",
    eventType: "external-funding",
    operationId: "funding-operation-1",
    policyRevision: 1,
    attributedAt: at,
    expiresAt: null,
    selfAttribution: false,
    ...overrides,
  };
}

describe("TWIN-102 Credit transfer no-commission acceptance", () => {
  it("pays acquisition commission on eligible funding once, never again when Credits move internally", () => {
    const policy = defaultCommissionPolicy({
      eventType: "external-funding",
      effectiveAt: at,
    });

    const fundingDecision = decideTwinCommission({
      attribution: fundingAttribution(),
      policy,
      baseCredits: 10_000,
      now: at,
    });

    expect(fundingDecision.eligible).toBe(true);
    expect(fundingDecision.reason).toBe("eligible");
    expect(fundingDecision.commissionCredits).toBe(100);

    const transfer = admitCreditTransfer({
      schemaVersion: 1,
      requestId: "transfer-request-1",
      senderUserId: "sender-user",
      recipientUserId: "recipient-user",
      amountCredits: 10_000,
      provenanceClass: "external-funding",
      createdAt: at,
    });

    expect(transfer.sourceProvenanceClass).toBe("external-funding");
    expect(transfer.destinationProvenanceClass).toBe("internal-transfer");
    expect(transfer.commissionEligible).toBe(false);

    const transferDecision = decideTwinCommission({
      attribution: fundingAttribution({
        attributionId: "attr-transfer-1",
        customerUserId: "recipient-user",
        eventType: "internal-transfer",
        operationId: transfer.requestId,
      }),
      policy,
      baseCredits: transfer.amountCredits,
      now: at,
    });

    expect(transferDecision.eligible).toBe(false);
    expect(transferDecision.reason).toBe("event-not-eligible");
    expect(transferDecision.commissionCredits).toBe(0);
    expect(
      fundingDecision.commissionCredits + transferDecision.commissionCredits,
    ).toBe(100);
  });

  it("marks every admitted user-to-user Credit movement non-commissionable regardless of source provenance", () => {
    const policy = defaultCommissionPolicy({
      eventType: "external-funding",
      effectiveAt: at,
    });
    const provenances = [
      "external-funding",
      "earned",
      "gift",
      "refund",
      "internal-transfer",
      "admin-adjustment",
    ] as const;

    for (const [index, provenanceClass] of provenances.entries()) {
      const transfer = admitCreditTransfer({
        schemaVersion: 1,
        requestId: `transfer-request-${index + 10}`,
        senderUserId: "sender-user",
        recipientUserId: "recipient-user",
        amountCredits: 500,
        provenanceClass,
        createdAt: at,
      });

      expect(transfer.commissionEligible).toBe(false);
      expect(transfer.destinationProvenanceClass).toBe("internal-transfer");

      const decision = decideTwinCommission({
        attribution: fundingAttribution({
          attributionId: `attr-transfer-${index + 10}`,
          eventType: "internal-transfer",
          operationId: transfer.requestId,
        }),
        policy,
        baseCredits: transfer.amountCredits,
        now: at,
      });

      expect(decision).toMatchObject({
        eligible: false,
        reason: "event-not-eligible",
        commissionCredits: 0,
      });
    }
  });

  it("keeps transfer reversal append-only and commission-ineligible", () => {
    const admission = admitCreditTransfer({
      schemaVersion: 1,
      requestId: "transfer-request-reversal",
      senderUserId: "sender-user",
      recipientUserId: "recipient-user",
      amountCredits: 750,
      provenanceClass: "earned",
      createdAt: at,
    });
    const original: CreditTransferReceipt = {
      ...admission,
      transferId: "transfer-receipt-1",
      status: "completed",
      completedAt: "2026-10-06T10:00:01.000Z",
      reversalOfTransferId: null,
    };

    const reversal = reverseCreditTransfer({
      original,
      reversalRequestId: "transfer-reversal-request-1",
      reversedAt: "2026-10-06T10:05:00.000Z",
    });

    expect(original.status).toBe("completed");
    expect(original.reversalOfTransferId).toBeNull();
    expect(reversal.status).toBe("reversed");
    expect(reversal.reversalOfTransferId).toBe(original.transferId);
    expect(reversal.senderUserId).toBe(original.recipientUserId);
    expect(reversal.recipientUserId).toBe(original.senderUserId);
    expect(reversal.sourceProvenanceClass).toBe("internal-transfer");
    expect(reversal.destinationProvenanceClass).toBe("internal-transfer");
    expect(reversal.commissionEligible).toBe(false);
    expect(reversal.fingerprint).not.toBe(original.fingerprint);

    const policy = defaultCommissionPolicy({
      eventType: "external-funding",
      effectiveAt: at,
    });
    const reversalDecision = decideTwinCommission({
      attribution: fundingAttribution({
        attributionId: "attr-reversal-1",
        eventType: "reversal",
        operationId: reversal.requestId,
      }),
      policy,
      baseCredits: reversal.amountCredits,
      now: "2026-10-06T10:05:00.000Z",
    });

    expect(reversalDecision).toMatchObject({
      eligible: false,
      reason: "event-not-eligible",
      commissionCredits: 0,
    });
  });
});
