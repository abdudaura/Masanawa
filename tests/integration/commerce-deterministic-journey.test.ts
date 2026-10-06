import { describe, expect, it } from "vitest";
import {
  createDeterministicCommerceQuote,
  planDeterministicCommerceAdmission,
  planDeterministicCommerceSettlement,
} from "../../packages/commerce/src/journey.js";
import type {
  CommerceFulfillmentCompletion,
  OfferRevision,
} from "../../packages/commerce/src/model.js";

const tenantId = "tenant_018f6b2e-7c00-7201-8000-000000000001" as never;
const offerId = "offer_018f6b2e-7c00-7202-8000-000000000002" as never;
const skillVersionId =
  "skill-version_018f6b2e-7c00-7203-8000-000000000003" as never;
const customerUserId =
  "user_018f6b2e-7c00-7204-8000-000000000004" as never;
const creatorUserId =
  "user_018f6b2e-7c00-7205-8000-000000000005" as never;
const originCharacterId =
  "character_018f6b2e-7c00-7206-8000-000000000006" as never;
const fallbackCharacterId =
  "character_018f6b2e-7c00-7207-8000-000000000007" as never;
const quoteId = "quote_018f6b2e-7c00-7208-8000-000000000008" as never;
const fulfillmentId =
  "fulfillment_018f6b2e-7c00-7209-8000-000000000009" as never;

function offer(overrides: Partial<OfferRevision> = {}): OfferRevision {
  return {
    schemaVersion: 1,
    tenantId,
    offerId,
    revision: 3,
    key: "research.brief",
    title: "Research brief",
    description: "A bounded paid research brief",
    skillVersionId,
    priceCredits: 1000,
    fulfillmentReserveCredits: 600,
    creatorCommissionCredits: 200,
    fallbackCommissionCredits: 75,
    platformMarginCredits: 200,
    active: true,
    regions: ["NG"],
    createdAt: "2026-10-06T12:00:00.000Z" as never,
    ...overrides,
  };
}

function quote(input?: {
  readonly creatorUserId?: typeof creatorUserId | null;
}) {
  return createDeterministicCommerceQuote({
    offer: offer(),
    quoteId,
    customerUserId,
    originatingCharacterId: originCharacterId,
    creatorUserId:
      input?.creatorUserId === undefined ? creatorUserId : input.creatorUserId,
    createdAt: "2026-10-06T12:05:00.000Z" as never,
    expiresAt: "2026-10-06T12:20:00.000Z" as never,
  });
}

const paymentLedgerId =
  "ledger-entry_018f6b2e-7c00-7210-8000-000000000010" as never;
const reserveLedgerId =
  "ledger-entry_018f6b2e-7c00-7211-8000-000000000011" as never;
const reserveReleaseLedgerId =
  "ledger-entry_018f6b2e-7c00-7212-8000-000000000012" as never;
const creatorEarningLedgerId =
  "ledger-entry_018f6b2e-7c00-7213-8000-000000000013" as never;
const platformMarginLedgerId =
  "ledger-entry_018f6b2e-7c00-7214-8000-000000000014" as never;

function completion(): CommerceFulfillmentCompletion {
  return {
    schemaVersion: 1,
    tenantId,
    fulfillmentId,
    state: "succeeded",
    resultReference: "artifact://research/brief-001",
    resultHash:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    completedAt: "2026-10-06T12:15:00.000Z" as never,
  };
}

describe("Task 133 deterministic Commerce journey", () => {
  it("derives quote economics from the exact active Offer revision", () => {
    const result = quote();

    expect(result).toEqual({
      schemaVersion: 1,
      tenantId,
      quoteId,
      offerId,
      offerRevision: 3,
      customerUserId,
      originatingCharacterId: originCharacterId,
      creatorUserId,
      priceCredits: 1000,
      creatorCommissionCredits: 200,
      fulfillmentReserveCredits: 600,
      platformMarginCredits: 200,
      expiresAt: "2026-10-06T12:20:00.000Z",
      createdAt: "2026-10-06T12:05:00.000Z",
    });

    expect(() =>
      createDeterministicCommerceQuote({
        offer: offer({ active: false }),
        quoteId,
        customerUserId,
        originatingCharacterId: originCharacterId,
        creatorUserId,
        createdAt: "2026-10-06T12:05:00.000Z" as never,
        expiresAt: "2026-10-06T12:20:00.000Z" as never,
      }),
    ).toThrow("inactive Offer");
  });

  it("suppresses creator economics when there is no creator attribution", () => {
    const result = quote({ creatorUserId: null });

    expect(result.creatorUserId).toBeNull();
    expect(result.creatorCommissionCredits).toBe(0);
    expect(result.platformMarginCredits).toBe(400);
    expect(
      result.fulfillmentReserveCredits +
        result.creatorCommissionCredits +
        result.platformMarginCredits,
    ).toBe(result.priceCredits);
  });

  it("fails closed if caller tries to create self-purchase creator earnings", () => {
    expect(() =>
      createDeterministicCommerceQuote({
        offer: offer(),
        quoteId,
        customerUserId,
        originatingCharacterId: originCharacterId,
        creatorUserId: customerUserId,
        createdAt: "2026-10-06T12:05:00.000Z" as never,
        expiresAt: "2026-10-06T12:20:00.000Z" as never,
      }),
    ).toThrow("Self-purchase");
  });

  it("uses creator Float only when the originating creator is also the selected executor and sufficiently funded", () => {
    const result = planDeterministicCommerceAdmission({
      offer: offer(),
      quote: quote(),
      executorCharacterId: originCharacterId,
      availableAgentFloatCredits: 600,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: reserveLedgerId,
      },
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    });

    expect(result.admission).toMatchObject({
      fulfillmentId,
      quoteId,
      originatingCharacterId: originCharacterId,
      executorCharacterId: originCharacterId,
      creatorUserId,
      fundingSource: "agent-float",
      reserveCredits: 600,
      creatorCommissionCredits: 200,
      platformRevenueCredits: 200,
    });
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.map((item) => item.ledgerEntryId)).toEqual([
      paymentLedgerId,
      reserveLedgerId,
    ]);
    expect(result.transfers[0]).toMatchObject({
      reason: "customer-payment",
      amountCredits: 1000,
      debit: {
        kind: "customer-credit",
        userId: customerUserId,
      },
      credit: {
        kind: "platform-float",
      },
    });
    expect(result.transfers[1]).toMatchObject({
      reason: "fulfillment-reserve",
      amountCredits: 600,
      debit: {
        kind: "agent-float",
        userId: creatorUserId,
        characterId: originCharacterId,
      },
    });
  });

  it("falls back to platform financing when creator Float is insufficient while preserving origin attribution and fallback commission", () => {
    const result = planDeterministicCommerceAdmission({
      offer: offer(),
      quote: quote(),
      executorCharacterId: fallbackCharacterId,
      availableAgentFloatCredits: 10_000,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: null,
      },
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    });

    expect(result.admission).toMatchObject({
      originatingCharacterId: originCharacterId,
      executorCharacterId: fallbackCharacterId,
      creatorUserId,
      fundingSource: "platform",
      reserveCredits: 600,
      creatorCommissionCredits: 75,
      platformRevenueCredits: 325,
    });
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]?.reason).toBe("customer-payment");
  });

  it("uses platform fallback when the creator remains executor but Float is below reserve", () => {
    const result = planDeterministicCommerceAdmission({
      offer: offer(),
      quote: quote(),
      executorCharacterId: originCharacterId,
      availableAgentFloatCredits: 599,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: null,
      },
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    });

    expect(result.admission).toMatchObject({
      originatingCharacterId: originCharacterId,
      executorCharacterId: originCharacterId,
      fundingSource: "platform",
      creatorCommissionCredits: 75,
      platformRevenueCredits: 325,
    });
  });

  it("does not require creator reserve or earnings ledger IDs for non-creator purchases", () => {
    const result = planDeterministicCommerceAdmission({
      offer: offer(),
      quote: quote({ creatorUserId: null }),
      executorCharacterId: fallbackCharacterId,
      availableAgentFloatCredits: 999_999,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: null,
      },
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    });

    expect(result.admission).toMatchObject({
      creatorUserId: null,
      fundingSource: "platform",
      creatorCommissionCredits: 0,
      platformRevenueCredits: 400,
    });

    const settlement = planDeterministicCommerceSettlement({
      quote: result.quote,
      admission: result.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId: null,
        creatorEarningLedgerEntryId: null,
        platformMarginLedgerEntryId,
      },
    });
    expect(settlement.transfers).toHaveLength(1);
    expect(settlement.transfers[0]).toMatchObject({
      ledgerEntryId: platformMarginLedgerId,
      reason: "platform-margin",
      amountCredits: 400,
    });
  });

  it("settles creator-funded fulfillment into Float release, pending earnings and platform revenue with caller-owned stable ledger IDs", () => {
    const admission = planDeterministicCommerceAdmission({
      offer: offer(),
      quote: quote(),
      executorCharacterId: originCharacterId,
      availableAgentFloatCredits: 600,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: reserveLedgerId,
      },
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    });

    const result = planDeterministicCommerceSettlement({
      quote: admission.quote,
      admission: admission.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId: reserveReleaseLedgerId,
        creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId,
      },
    });

    expect(result.transfers).toHaveLength(3);
    expect(result.transfers.map((item) => [item.ledgerEntryId, item.reason, item.amountCredits])).toEqual([
      [reserveReleaseLedgerId, "fulfillment-release", 600],
      [creatorEarningLedgerId, "creator-earning", 200],
      [platformMarginLedgerId, "platform-margin", 200],
    ]);
    expect(result.transfers[0]?.credit).toMatchObject({
      kind: "agent-float",
      userId: creatorUserId,
      characterId: originCharacterId,
    });
    expect(result.transfers[1]?.credit).toMatchObject({
      kind: "pending-earnings",
      userId: creatorUserId,
    });
    expect(result.transfers[2]?.credit.kind).toBe("platform-revenue");
  });

  it("settles platform fallback with smaller creator commission and no Float release", () => {
    const admission = planDeterministicCommerceAdmission({
      offer: offer(),
      quote: quote(),
      executorCharacterId: fallbackCharacterId,
      availableAgentFloatCredits: 0,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: null,
      },
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    });

    const result = planDeterministicCommerceSettlement({
      quote: admission.quote,
      admission: admission.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId: null,
        creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId,
      },
    });

    expect(result.transfers.map((item) => [item.reason, item.amountCredits])).toEqual([
      ["creator-earning", 75],
      ["platform-margin", 325],
    ]);
    expect(result.transfers.every((item) => item.reason !== "fulfillment-release")).toBe(true);
  });

  it("reconstructs byte-equivalent admission and settlement plans from the same immutable inputs", () => {
    const admissionInput = {
      offer: offer(),
      quote: quote(),
      executorCharacterId: originCharacterId,
      availableAgentFloatCredits: 600,
      ids: {
        fulfillmentId,
        customerPaymentLedgerEntryId: paymentLedgerId,
        creatorReserveLedgerEntryId: reserveLedgerId,
      },
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    };

    const firstAdmission = planDeterministicCommerceAdmission(admissionInput);
    const secondAdmission = planDeterministicCommerceAdmission(admissionInput);
    expect(JSON.stringify(secondAdmission)).toBe(JSON.stringify(firstAdmission));

    const settlementInput = {
      quote: firstAdmission.quote,
      admission: firstAdmission.admission,
      completion: completion(),
      ids: {
        reserveReleaseLedgerEntryId: reserveReleaseLedgerId,
        creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId,
      },
    };
    const firstSettlement = planDeterministicCommerceSettlement(settlementInput);
    const secondSettlement = planDeterministicCommerceSettlement(settlementInput);
    expect(JSON.stringify(secondSettlement)).toBe(JSON.stringify(firstSettlement));
  });

  it("requires ledger IDs exactly when the corresponding economic leg exists", () => {
    expect(() =>
      planDeterministicCommerceAdmission({
        offer: offer(),
        quote: quote(),
        executorCharacterId: originCharacterId,
        availableAgentFloatCredits: 600,
        ids: {
          fulfillmentId,
          customerPaymentLedgerEntryId: paymentLedgerId,
          creatorReserveLedgerEntryId: null,
        },
        createdAt: "2026-10-06T12:06:00.000Z" as never,
      }),
    ).toThrow("creatorReserveLedgerEntryId is required");

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
      createdAt: "2026-10-06T12:06:00.000Z" as never,
    });

    expect(() =>
      planDeterministicCommerceSettlement({
        quote: fallback.quote,
        admission: fallback.admission,
        completion: completion(),
        ids: {
          reserveReleaseLedgerEntryId: reserveReleaseLedgerId,
          creatorEarningLedgerEntryId,
          platformMarginLedgerEntryId,
        },
      }),
    ).toThrow("reserveReleaseLedgerEntryId must be null");
  });
});
