import { describe, expect, it } from "vitest";
import {
  createDeterministicCommerceQuote,
  planDeterministicCommerceAdmission,
  planDeterministicCommerceSettlement,
} from "../../packages/commerce/src/journey.js";
import {
  assertCommerceReconciliationReceiptReplay,
  normalizeCommerceReconciliationReceipt,
  planAvailableEarningsWithdrawal,
  planCommerceLedgerReversals,
  planPendingEarningsRelease,
} from "../../packages/commerce/src/reconciliation.js";
import {
  normalizeCommerceLedgerTransfer,
  type CommerceFulfillmentCompletion,
  type OfferRevision,
} from "../../packages/commerce/src/model.js";

const tenantId = "tenant_018f6b2e-7c00-7301-8000-000000000001" as never;
const offerId = "offer_018f6b2e-7c00-7302-8000-000000000002" as never;
const skillVersionId =
  "skill-version_018f6b2e-7c00-7303-8000-000000000003" as never;
const customerUserId =
  "user_018f6b2e-7c00-7304-8000-000000000004" as never;
const creatorUserId =
  "user_018f6b2e-7c00-7305-8000-000000000005" as never;
const originCharacterId =
  "character_018f6b2e-7c00-7306-8000-000000000006" as never;
const fallbackCharacterId =
  "character_018f6b2e-7c00-7307-8000-000000000007" as never;
const quoteId = "quote_018f6b2e-7c00-7308-8000-000000000008" as never;
const fulfillmentId =
  "fulfillment_018f6b2e-7c00-7309-8000-000000000009" as never;

function offer(): OfferRevision {
  return {
    schemaVersion: 1,
    tenantId,
    offerId,
    revision: 1,
    key: "paid.research",
    title: "Paid research",
    description: "Research fulfillment",
    skillVersionId,
    priceCredits: 1000,
    fulfillmentReserveCredits: 600,
    creatorCommissionCredits: 200,
    fallbackCommissionCredits: 75,
    platformMarginCredits: 200,
    active: true,
    regions: ["NG"],
    createdAt: "2026-10-06T12:00:00.000Z" as never,
  };
}

function quote() {
  return createDeterministicCommerceQuote({
    offer: offer(),
    quoteId,
    customerUserId,
    originatingCharacterId: originCharacterId,
    creatorUserId,
    createdAt: "2026-10-06T12:01:00.000Z" as never,
    expiresAt: "2026-10-06T12:30:00.000Z" as never,
  });
}

const paymentLedgerId =
  "ledger-entry_018f6b2e-7c00-7310-8000-000000000010" as never;
const reserveLedgerId =
  "ledger-entry_018f6b2e-7c00-7311-8000-000000000011" as never;
const reserveReleaseLedgerId =
  "ledger-entry_018f6b2e-7c00-7312-8000-000000000012" as never;
const creatorEarningLedgerId =
  "ledger-entry_018f6b2e-7c00-7313-8000-000000000013" as never;
const platformMarginLedgerId =
  "ledger-entry_018f6b2e-7c00-7314-8000-000000000014" as never;

function fundedAdmission() {
  return planDeterministicCommerceAdmission({
    offer: offer(),
    quote: quote(),
    executorCharacterId: originCharacterId,
    availableAgentFloatCredits: 600,
    ids: {
      fulfillmentId,
      customerPaymentLedgerEntryId: paymentLedgerId,
      creatorReserveLedgerEntryId: reserveLedgerId,
    },
    createdAt: "2026-10-06T12:02:00.000Z" as never,
  });
}

function completion(): CommerceFulfillmentCompletion {
  return {
    schemaVersion: 1,
    tenantId,
    fulfillmentId,
    state: "succeeded",
    resultReference: "artifact://result/001",
    resultHash:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    completedAt: "2026-10-06T12:10:00.000Z" as never,
  };
}

describe("Task 134 Commerce reconciliation receipts", () => {
  it("normalizes exact reconciliation evidence and accepts only byte-equivalent receipt replay", () => {
    const receipt = normalizeCommerceReconciliationReceipt({
      schemaVersion: 1,
      tenantId,
      reconciliationCaseId:
        "reconciliation-case_018f6b2e-7c00-7320-8000-000000000020" as never,
      externalReceiptId:
        "external-receipt_018f6b2e-7c00-7321-8000-000000000021" as never,
      quoteId,
      fulfillmentId,
      providerKey: "Flutterwave",
      outcome: "confirmed-posted",
      evidenceReference: "provider://flutterwave/transaction/tx-100",
      evidenceHash:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      observedAt: "2026-10-06T12:11:00.000Z" as never,
    });

    expect(receipt.providerKey).toBe("flutterwave");
    expect(
      assertCommerceReconciliationReceiptReplay({
        existing: receipt,
        incoming: { ...receipt },
      }),
    ).toBe(receipt);

    expect(() =>
      assertCommerceReconciliationReceiptReplay({
        existing: receipt,
        incoming: { ...receipt, outcome: "reversed" },
      }),
    ).toThrow("changed evidence");
  });

  it("allows ambiguous provider evidence to remain evidence-only without creating ledger effects", () => {
    const receipt = normalizeCommerceReconciliationReceipt({
      schemaVersion: 1,
      tenantId,
      reconciliationCaseId:
        "reconciliation-case_018f6b2e-7c00-7322-8000-000000000022" as never,
      externalReceiptId:
        "external-receipt_018f6b2e-7c00-7323-8000-000000000023" as never,
      quoteId,
      fulfillmentId,
      providerKey: "nowpayments",
      outcome: "ambiguous",
      evidenceReference: "provider://nowpayments/payout/batch-1",
      evidenceHash:
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      observedAt: "2026-10-06T12:11:00.000Z" as never,
    });

    expect(receipt.outcome).toBe("ambiguous");
    expect(receipt).not.toHaveProperty("ledgerEntryId");
    expect(receipt).not.toHaveProperty("retry");
  });
});

describe("Task 134 deterministic refund and reversal planning", () => {
  it("refunds customer payment to Customer Credit and releases unused creator reserve only to Agent Float", () => {
    const admission = fundedAdmission();
    const [payment, reserve] = admission.transfers;
    expect(payment).toBeDefined();
    expect(reserve).toBeDefined();

    const reversals = planCommerceLedgerReversals({
      requests: [
        {
          original: payment!,
          reversalLedgerEntryId:
            "ledger-entry_018f6b2e-7c00-7330-8000-000000000030" as never,
        },
        {
          original: reserve!,
          reversalLedgerEntryId:
            "ledger-entry_018f6b2e-7c00-7331-8000-000000000031" as never,
        },
      ],
      createdAt: "2026-10-06T12:05:00.000Z" as never,
    });

    expect(reversals).toHaveLength(2);
    expect(reversals[0]).toMatchObject({
      reason: "refund",
      amountCredits: 1000,
      debit: { kind: "platform-float" },
      credit: {
        kind: "customer-credit",
        userId: customerUserId,
        characterId: null,
      },
    });
    expect(reversals[1]).toMatchObject({
      reason: "fulfillment-release",
      amountCredits: 600,
      debit: { kind: "platform-float" },
      credit: {
        kind: "agent-float",
        userId: creatorUserId,
        characterId: originCharacterId,
      },
    });
    expect(
      reversals.some((item) => item.credit.kind === "available-earnings"),
    ).toBe(false);
  });

  it("reverses pending creator earnings and platform margin before refund without touching Agent Float principal", () => {
    const admission = fundedAdmission();
    const settlement = planDeterministicCommerceSettlement({
      quote: admission.quote,
      admission: admission.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId,
        creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId,
      },
    });
    const creatorEarning = settlement.transfers.find(
      (item) => item.reason === "creator-earning",
    )!;
    const platformMargin = settlement.transfers.find(
      (item) => item.reason === "platform-margin",
    )!;
    const payment = admission.transfers.find(
      (item) => item.reason === "customer-payment",
    )!;

    const reversals = planCommerceLedgerReversals({
      requests: [
        {
          original: creatorEarning,
          reversalLedgerEntryId:
            "ledger-entry_018f6b2e-7c00-7332-8000-000000000032" as never,
        },
        {
          original: platformMargin,
          reversalLedgerEntryId:
            "ledger-entry_018f6b2e-7c00-7333-8000-000000000033" as never,
        },
        {
          original: payment,
          reversalLedgerEntryId:
            "ledger-entry_018f6b2e-7c00-7334-8000-000000000034" as never,
        },
      ],
      createdAt: "2026-10-06T12:12:00.000Z" as never,
    });

    expect(reversals.map((item) => item.reason)).toEqual([
      "adjustment",
      "adjustment",
      "refund",
    ]);
    expect(reversals[0]).toMatchObject({
      debit: {
        kind: "pending-earnings",
        userId: creatorUserId,
      },
      credit: { kind: "platform-float" },
      amountCredits: 200,
    });
    expect(reversals[1]).toMatchObject({
      debit: { kind: "platform-revenue" },
      credit: { kind: "platform-float" },
      amountCredits: 200,
    });
    expect(
      reversals.some((item) => item.debit.kind === "agent-float"),
    ).toBe(false);
  });

  it("rejects duplicate ledger identities and cross-fulfillment reversal batches", () => {
    const admission = fundedAdmission();
    const payment = admission.transfers[0]!;
    const reserve = admission.transfers[1]!;

    expect(() =>
      planCommerceLedgerReversals({
        requests: [
          {
            original: payment,
            reversalLedgerEntryId:
              "ledger-entry_018f6b2e-7c00-7335-8000-000000000035" as never,
          },
          {
            original: payment,
            reversalLedgerEntryId:
              "ledger-entry_018f6b2e-7c00-7336-8000-000000000036" as never,
          },
        ],
        createdAt: "2026-10-06T12:12:00.000Z" as never,
      }),
    ).toThrow("duplicate original");

    const otherFulfillmentReserve = normalizeCommerceLedgerTransfer({
      ...reserve,
      ledgerEntryId:
        "ledger-entry_018f6b2e-7c00-7337-8000-000000000037" as never,
      fulfillmentId:
        "fulfillment_018f6b2e-7c00-7399-8000-000000000099" as never,
    });

    expect(() =>
      planCommerceLedgerReversals({
        requests: [
          {
            original: payment,
            reversalLedgerEntryId:
              "ledger-entry_018f6b2e-7c00-7338-8000-000000000038" as never,
          },
          {
            original: otherFulfillmentReserve,
            reversalLedgerEntryId:
              "ledger-entry_018f6b2e-7c00-7339-8000-000000000039" as never,
          },
        ],
        createdAt: "2026-10-06T12:12:00.000Z" as never,
      }),
    ).toThrow("one exact Commerce scope");
  });
});

describe("Task 134 earnings release and withdrawal safety", () => {
  it("moves only canonical pending creator earnings into Available Earnings", () => {
    const admission = fundedAdmission();
    const settlement = planDeterministicCommerceSettlement({
      quote: admission.quote,
      admission: admission.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId,
        creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId,
      },
    });
    const creatorEarning = settlement.transfers.find(
      (item) => item.reason === "creator-earning",
    )!;

    const release = planPendingEarningsRelease({
      creatorEarningTransfer: creatorEarning,
      settlementLedgerEntryId:
        "ledger-entry_018f6b2e-7c00-7340-8000-000000000040" as never,
      createdAt: "2026-10-06T12:20:00.000Z" as never,
    });

    expect(release).toMatchObject({
      reason: "earning-settlement",
      amountCredits: 200,
      debit: {
        kind: "pending-earnings",
        userId: creatorUserId,
      },
      credit: {
        kind: "available-earnings",
        userId: creatorUserId,
      },
    });

    expect(() =>
      planPendingEarningsRelease({
        creatorEarningTransfer: admission.transfers[0]!,
        settlementLedgerEntryId:
          "ledger-entry_018f6b2e-7c00-7341-8000-000000000041" as never,
        createdAt: "2026-10-06T12:20:00.000Z" as never,
      }),
    ).toThrow("Only canonical pending creator earnings");
  });

  it("refuses automatic reversal after earnings have reached Available Earnings", () => {
    const admission = fundedAdmission();
    const settlement = planDeterministicCommerceSettlement({
      quote: admission.quote,
      admission: admission.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId,
        creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId,
      },
    });
    const creatorEarning = settlement.transfers.find(
      (item) => item.reason === "creator-earning",
    )!;
    const release = planPendingEarningsRelease({
      creatorEarningTransfer: creatorEarning,
      settlementLedgerEntryId:
        "ledger-entry_018f6b2e-7c00-7342-8000-000000000042" as never,
      createdAt: "2026-10-06T12:20:00.000Z" as never,
    });

    expect(() =>
      planCommerceLedgerReversals({
        requests: [
          {
            original: release,
            reversalLedgerEntryId:
              "ledger-entry_018f6b2e-7c00-7343-8000-000000000043" as never,
          },
        ],
        createdAt: "2026-10-06T12:21:00.000Z" as never,
      }),
    ).toThrow("negative-balance policy");
  });

  it("admits withdrawal only from the requesting User's Available Earnings", () => {
    const requestId =
      "request_018f6b2e-7c00-7350-8000-000000000050" as never;
    const plan = planAvailableEarningsWithdrawal({
      tenantId,
      requestId,
      userId: creatorUserId,
      source: {
        tenantId,
        kind: "available-earnings",
        userId: creatorUserId,
        characterId: null,
      },
      amountCredits: 150,
      createdAt: "2026-10-06T12:22:00.000Z" as never,
    });

    expect(plan).toMatchObject({
      requestId,
      userId: creatorUserId,
      amountCredits: 150,
      source: {
        kind: "available-earnings",
      },
      destination: {
        kind: "external-clearing",
        userId: null,
        characterId: null,
      },
    });
  });

  it.each([
    ["customer-credit", customerUserId, null],
    ["agent-float", creatorUserId, originCharacterId],
    ["fulfillment-reserve", null, null],
    ["pending-earnings", creatorUserId, null],
  ] as const)(
    "never treats %s principal/state as withdrawable earnings",
    (kind, userId, characterId) => {
      expect(() =>
        planAvailableEarningsWithdrawal({
          tenantId,
          requestId:
            "request_018f6b2e-7c00-7351-8000-000000000051" as never,
          userId: creatorUserId,
          source: {
            tenantId,
            kind,
            userId,
            characterId,
          },
          amountCredits: 1,
          createdAt: "2026-10-06T12:22:00.000Z" as never,
        }),
      ).toThrow("available earnings");
    },
  );

  it("rejects another User's Available Earnings as a withdrawal source", () => {
    expect(() =>
      planAvailableEarningsWithdrawal({
        tenantId,
        requestId:
          "request_018f6b2e-7c00-7352-8000-000000000052" as never,
        userId: creatorUserId,
        source: {
          tenantId,
          kind: "available-earnings",
          userId: customerUserId,
          characterId: null,
        },
        amountCredits: 1,
        createdAt: "2026-10-06T12:22:00.000Z" as never,
      }),
    ).toThrow("requesting User");
  });

  it("preserves platform fallback commission reversal without manufacturing Float withdrawal", () => {
    const fallback = planDeterministicCommerceAdmission({
      offer: offer(),
      quote: quote(),
      executorCharacterId: fallbackCharacterId,
      availableAgentFloatCredits: 0,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: null,
      },
      createdAt: "2026-10-06T12:02:00.000Z" as never,
    });
    const settlement = planDeterministicCommerceSettlement({
      quote: fallback.quote,
      admission: fallback.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId: null,
        creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId,
      },
    });
    const creatorEarning = settlement.transfers.find(
      (item) => item.reason === "creator-earning",
    )!;
    expect(creatorEarning.amountCredits).toBe(75);

    const reversal = planCommerceLedgerReversals({
      requests: [{
        original: creatorEarning,
        reversalLedgerEntryId:
          "ledger-entry_018f6b2e-7c00-7353-8000-000000000053" as never,
      }],
      createdAt: "2026-10-06T12:12:00.000Z" as never,
    })[0]!;

    expect(reversal).toMatchObject({
      debit: { kind: "pending-earnings", userId: creatorUserId },
      credit: { kind: "platform-float" },
      amountCredits: 75,
    });
    expect(reversal.debit.kind).not.toBe("agent-float");
    expect(reversal.credit.kind).not.toBe("available-earnings");
  });
});
