import { describe, expect, it } from "vitest";
import {
  admitCreditTransfer,
  reverseCreditTransfer,
  type CreditTransferAdmission,
  type CreditTransferReceipt,
} from "../../packages/commerce/src/transfers.js";

interface AccountBalances {
  readonly [userId: string]: number;
}

class ReplaySafeTransferPort {
  readonly #receipts = new Map<string, CreditTransferReceipt>();
  readonly balances: Record<string, number>;

  constructor(initialBalances: AccountBalances) {
    this.balances = { ...initialBalances };
  }

  apply(admission: CreditTransferAdmission): {
    readonly duplicate: boolean;
    readonly receipt: CreditTransferReceipt;
  } {
    const existing = this.#receipts.get(admission.requestId);
    if (existing) {
      if (existing.fingerprint !== admission.fingerprint) {
        throw new Error("Credit transfer replay fingerprint conflict");
      }
      return { duplicate: true, receipt: existing };
    }

    const senderBalance = this.balances[admission.senderUserId] ?? 0;
    if (senderBalance < admission.amountCredits) {
      throw new Error("insufficient balance");
    }

    this.balances[admission.senderUserId] =
      senderBalance - admission.amountCredits;
    this.balances[admission.recipientUserId] =
      (this.balances[admission.recipientUserId] ?? 0) +
      admission.amountCredits;

    const receipt: CreditTransferReceipt = Object.freeze({
      ...admission,
      transferId: `transfer:${admission.requestId}`,
      status: "completed",
      completedAt: "2026-10-06T12:00:01.000Z",
      reversalOfTransferId: null,
    });
    this.#receipts.set(admission.requestId, receipt);
    return { duplicate: false, receipt };
  }

  applyReversal(reversal: CreditTransferReceipt): {
    readonly duplicate: boolean;
    readonly receipt: CreditTransferReceipt;
  } {
    const existing = this.#receipts.get(reversal.requestId);
    if (existing) {
      if (
        existing.fingerprint !== reversal.fingerprint ||
        existing.reversalOfTransferId !== reversal.reversalOfTransferId
      ) {
        throw new Error("Credit transfer reversal replay conflict");
      }
      return { duplicate: true, receipt: existing };
    }

    const senderBalance = this.balances[reversal.senderUserId] ?? 0;
    if (senderBalance < reversal.amountCredits) {
      throw new Error("insufficient reversal balance");
    }

    this.balances[reversal.senderUserId] =
      senderBalance - reversal.amountCredits;
    this.balances[reversal.recipientUserId] =
      (this.balances[reversal.recipientUserId] ?? 0) +
      reversal.amountCredits;

    this.#receipts.set(reversal.requestId, reversal);
    return { duplicate: false, receipt: reversal };
  }
}

function transfer(
  overrides: Partial<Parameters<typeof admitCreditTransfer>[0]> = {},
) {
  return admitCreditTransfer({
    schemaVersion: 1,
    requestId: "transfer-request-0001",
    senderUserId: "sender-user",
    recipientUserId: "recipient-user",
    amountCredits: 250,
    provenanceClass: "external-funding",
    createdAt: "2026-10-06T12:00:00.000Z",
    ...overrides,
  });
}

describe("TWIN-106 Credit-transfer retry recovery acceptance", () => {
  it("applies one balance movement across a post-effect crash and exact retry", () => {
    const port = new ReplaySafeTransferPort({
      "sender-user": 1_000,
      "recipient-user": 100,
    });
    const admission = transfer();

    const first = port.apply(admission);
    expect(first.duplicate).toBe(false);
    expect(port.balances).toEqual({
      "sender-user": 750,
      "recipient-user": 350,
    });

    // Simulate process crash after durable economic effect but before caller
    // records completion. Recovery repeats the exact canonical request.
    const retryAdmission = transfer();
    const retry = port.apply(retryAdmission);

    expect(retry.duplicate).toBe(true);
    expect(retry.receipt).toEqual(first.receipt);
    expect(port.balances).toEqual({
      "sender-user": 750,
      "recipient-user": 350,
    });
  });

  it("rejects changed transfer payload under the same request identity", () => {
    const port = new ReplaySafeTransferPort({
      "sender-user": 1_000,
      "recipient-user": 0,
    });
    port.apply(transfer());

    expect(() =>
      port.apply(
        transfer({
          amountCredits: 251,
        }),
      ),
    ).toThrow("fingerprint conflict");

    expect(port.balances).toEqual({
      "sender-user": 750,
      "recipient-user": 250,
    });
  });

  it("preserves internal-transfer provenance and no-commission semantics on replay", () => {
    const port = new ReplaySafeTransferPort({
      "sender-user": 500,
      "recipient-user": 0,
    });
    const admission = transfer({
      requestId: "transfer-request-provenance",
      amountCredits: 100,
      provenanceClass: "earned",
    });

    const first = port.apply(admission);
    const retry = port.apply(
      transfer({
        requestId: "transfer-request-provenance",
        amountCredits: 100,
        provenanceClass: "earned",
      }),
    );

    expect(first.receipt).toMatchObject({
      sourceProvenanceClass: "earned",
      destinationProvenanceClass: "internal-transfer",
      commissionEligible: false,
    });
    expect(retry.receipt).toEqual(first.receipt);
  });

  it("applies append-only reversal once and keeps the original receipt immutable", () => {
    const port = new ReplaySafeTransferPort({
      "sender-user": 1_000,
      "recipient-user": 0,
    });
    const original = port.apply(
      transfer({
        requestId: "transfer-request-reverse",
        amountCredits: 300,
      }),
    ).receipt;

    const reversal = reverseCreditTransfer({
      original,
      reversalRequestId: "transfer-reversal-request-0001",
      reversedAt: "2026-10-06T12:10:00.000Z",
    });

    const firstReversal = port.applyReversal(reversal);
    expect(firstReversal.duplicate).toBe(false);
    expect(port.balances).toEqual({
      "sender-user": 1_000,
      "recipient-user": 0,
    });

    const retryReversal = port.applyReversal(
      reverseCreditTransfer({
        original,
        reversalRequestId: "transfer-reversal-request-0001",
        reversedAt: "2026-10-06T12:10:00.000Z",
      }),
    );
    expect(retryReversal.duplicate).toBe(true);
    expect(port.balances).toEqual({
      "sender-user": 1_000,
      "recipient-user": 0,
    });

    expect(original).toMatchObject({
      status: "completed",
      reversalOfTransferId: null,
      senderUserId: "sender-user",
      recipientUserId: "recipient-user",
    });
  });

  it("requires a distinct reversal request identity and never mutates original transfer identity", () => {
    const original: CreditTransferReceipt = {
      ...transfer({
        requestId: "transfer-request-original",
        amountCredits: 50,
      }),
      transferId: "transfer-original",
      status: "completed",
      completedAt: "2026-10-06T12:00:01.000Z",
      reversalOfTransferId: null,
    };

    const reversal = reverseCreditTransfer({
      original,
      reversalRequestId: "transfer-reversal-distinct",
      reversedAt: "2026-10-06T12:05:00.000Z",
    });

    expect(reversal.requestId).not.toBe(original.requestId);
    expect(reversal.transferId).not.toBe(original.transferId);
    expect(reversal.reversalOfTransferId).toBe(original.transferId);
    expect(original.reversalOfTransferId).toBeNull();
  });
});
