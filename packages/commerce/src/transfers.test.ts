import { describe, expect, it } from "vitest";
import {
  admitCreditTransfer,
  creditTransferFingerprint,
  reverseCreditTransfer,
} from "./transfers.js";
import { admitGift } from "./gifts.js";

describe("Credit transfers", () => {
  it("moves existing value without becoming acquisition-commission eligible", () => {
    const admission = admitCreditTransfer({
      schemaVersion: 1,
      requestId: "request-transfer-001",
      senderUserId: "user-a",
      recipientUserId: "user-b",
      amountCredits: 500,
      provenanceClass: "external-funding",
      createdAt: "2026-10-05T09:00:00Z",
    });
    expect(admission.amountCredits).toBe(500);
    expect(admission.sourceProvenanceClass).toBe("external-funding");
    expect(admission.destinationProvenanceClass).toBe("internal-transfer");
    expect(admission.commissionEligible).toBe(false);
  });

  it("rejects self-transfer", () => {
    expect(() =>
      admitCreditTransfer({
        schemaVersion: 1,
        requestId: "request-transfer-002",
        senderUserId: "user-a",
        recipientUserId: "user-a",
        amountCredits: 1,
        provenanceClass: "earned",
        createdAt: "2026-10-05T09:00:00Z",
      }),
    ).toThrow("yourself");
  });

  it("fingerprints the economic intent, not request metadata", () => {
    expect(
      creditTransferFingerprint({
        senderUserId: "user-a",
        recipientUserId: "user-b",
        amountCredits: 10,
        provenanceClass: "earned",
      }),
    ).toBe(
      creditTransferFingerprint({
        senderUserId: "user-a",
        recipientUserId: "user-b",
        amountCredits: 10,
        provenanceClass: "earned",
      }),
    );
  });

  it("reverses with a new append-only receipt and never creates commission", () => {
    const admission = admitCreditTransfer({
      schemaVersion: 1,
      requestId: "request-transfer-003",
      senderUserId: "user-a",
      recipientUserId: "user-b",
      amountCredits: 50,
      provenanceClass: "earned",
      createdAt: "2026-10-05T09:00:00Z",
    });
    const receipt = {
      ...admission,
      transferId: "transfer-001",
      status: "completed" as const,
      completedAt: "2026-10-05T09:00:01Z",
      reversalOfTransferId: null,
    };
    const reversal = reverseCreditTransfer({
      original: receipt,
      reversalRequestId: "request-reversal-001",
      reversedAt: "2026-10-05T09:01:00Z",
    });
    expect(reversal.senderUserId).toBe("user-b");
    expect(reversal.recipientUserId).toBe("user-a");
    expect(reversal.reversalOfTransferId).toBe("transfer-001");
    expect(reversal.commissionEligible).toBe(false);
  });

  it("rejects reversing before settlement or a settlement preceding admission", () => {
    const admission = admitCreditTransfer({
      schemaVersion: 1, requestId: "request-original", senderUserId: "user-a",
      recipientUserId: "user-b", amountCredits: 7, provenanceClass: "earned",
      createdAt: "2026-10-05T09:00:00Z",
    });
    const original = {
      ...admission, transferId: "transfer-chronology", status: "completed" as const,
      completedAt: "2026-10-05T09:00:10Z", reversalOfTransferId: null,
    };
    const reverse = (receipt: typeof original, reversedAt = "2026-10-05T09:00:11Z") =>
      reverseCreditTransfer({ original: receipt, reversalRequestId: "request-reversal", reversedAt });
    expect(() => reverse(original, "2026-10-05T09:00:09Z")).toThrow(/predates original completion/);
    expect(() => reverse({ ...original, completedAt: "2026-10-05T08:59:59Z" })).toThrow(/predates admission/);
    expect(() => reverse({ ...original, completedAt: "invalid" })).toThrow(/completedAt is invalid/);
    expect(reverse(original, "2026-10-05T09:00:10Z").reversalOfTransferId).toBe("transfer-chronology");
  });

  it("rejects altered economic terms and chained or malformed receipts", () => {
    const admission = admitCreditTransfer({
      schemaVersion: 1, requestId: "request-original", senderUserId: "user-a",
      recipientUserId: "user-b", amountCredits: 7, provenanceClass: "earned",
      createdAt: "2026-10-05T09:00:00Z",
    });
    const original = {
      ...admission, transferId: "transfer-valid", status: "completed" as const,
      completedAt: "2026-10-05T09:00:10Z", reversalOfTransferId: null,
    };
    const reverse = (receipt: typeof original) =>
      reverseCreditTransfer({
        original: receipt, reversalRequestId: "request-reversal",
        reversedAt: "2026-10-05T09:00:11Z",
      });
    expect(() => reverse({ ...original, amountCredits: 70 })).toThrow(/Original transfer receipt is invalid/);
    expect(() => reverse({ ...original, senderUserId: "user-c" })).toThrow(/Original transfer receipt is invalid/);
    expect(() => reverse({ ...original, fingerprint: "forged" })).toThrow(/Original transfer receipt is invalid/);
    expect(() => reverse({ ...original, reversalOfTransferId: "earlier-transfer" })).toThrow(/Original transfer receipt is invalid/);
    expect(() => reverse({ ...original, transferId: "   " })).toThrow(/transferId is invalid/);
  });

  it("requires a new idempotency request for the compensating receipt", () => {
    const admission = admitCreditTransfer({
      schemaVersion: 1, requestId: "same-request", senderUserId: "user-a",
      recipientUserId: "user-b", amountCredits: 7, provenanceClass: "earned",
      createdAt: "2026-10-05T09:00:00Z",
    });
    const original = {
      ...admission, transferId: "transfer-001", status: "completed" as const,
      completedAt: "2026-10-05T09:00:10Z", reversalOfTransferId: null,
    };
    expect(() => reverseCreditTransfer({
      original, reversalRequestId: "same-request", reversedAt: "2026-10-05T09:00:11Z",
    })).toThrow(/new request ID/);
  });
});

describe("gifts", () => {
  it("is a voluntary transfer with explicit gift reason and no acquisition commission", () => {
    const gift = admitGift({
      schemaVersion: 1,
      requestId: "request-gift-001",
      senderUserId: "user-a",
      recipientUserId: "user-b",
      recipientCharacterId: "character-b",
      amountCredits: 100,
      createdAt: "2026-10-05T09:00:00Z",
    });
    expect(gift.economicReason).toBe("gift");
    expect(gift.transfer.destinationProvenanceClass).toBe("internal-transfer");
    expect(gift.acquisitionCommissionEligible).toBe(false);
  });

  it("rejects self-gifting through the transfer invariant", () => {
    expect(() =>
      admitGift({
        schemaVersion: 1,
        requestId: "request-gift-002",
        senderUserId: "user-a",
        recipientUserId: "user-a",
        recipientCharacterId: "character-a",
        amountCredits: 100,
        createdAt: "2026-10-05T09:00:00Z",
      }),
    ).toThrow("yourself");
  });
});
