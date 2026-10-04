import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { CommerceFulfillmentAdmission, CommerceQuote, OfferId } from "./model.js";
import { assertFulfillmentAdmissionTransfers, planFulfillmentSettlement } from "./settlement.js";

function fixture() {
  const createdAt = toInstant("2026-10-04T15:00:00Z");
  const tenantId = createCanonicalId("tenant");
  const quote: CommerceQuote = {
    schemaVersion: 1, tenantId, quoteId: createCanonicalId("quote"),
    offerId: "offer_0194c2d2-6c00-7abc-8abc-1234567890ab" as OfferId, offerRevision: 1,
    customerUserId: createCanonicalId("user"), originatingCharacterId: createCanonicalId("character"),
    creatorUserId: createCanonicalId("user"), priceCredits: 100,
    fulfillmentReserveCredits: 50, creatorCommissionCredits: 30, platformMarginCredits: 20,
    createdAt, expiresAt: toInstant("2026-10-04T15:15:00Z"),
  };
  const admission: CommerceFulfillmentAdmission = {
    schemaVersion: 1, tenantId, fulfillmentId: createCanonicalId("fulfillment"),
    quoteId: quote.quoteId, offerId: quote.offerId, offerRevision: 1,
    skillVersionId: createCanonicalId("skill-version"), originatingCharacterId: quote.originatingCharacterId,
    executorCharacterId: quote.originatingCharacterId, creatorUserId: quote.creatorUserId,
    fundingSource: "agent-float", reserveCredits: 50, creatorCommissionCredits: 30,
    platformRevenueCredits: 20, state: "admitted", createdAt,
  };
  const completion = {
    schemaVersion: 1 as const, tenantId, fulfillmentId: admission.fulfillmentId,
    state: "succeeded" as const, resultReference: "artifact:business-plan",
    resultHash: `sha256:${"a".repeat(64)}`, completedAt: toInstant("2026-10-04T15:20:00Z"),
  };
  const transfers = [
    {
      schemaVersion: 1 as const, tenantId, ledgerEntryId: createCanonicalId("ledger-entry"),
      debit: { tenantId, kind: "customer-credit" as const, userId: quote.customerUserId, characterId: null },
      credit: { tenantId, kind: "platform-float" as const, userId: null, characterId: null },
      amountCredits: 100, reason: "customer-payment" as const, quoteId: quote.quoteId,
      fulfillmentId: admission.fulfillmentId, createdAt,
    },
    {
      schemaVersion: 1 as const, tenantId, ledgerEntryId: createCanonicalId("ledger-entry"),
      debit: { tenantId, kind: "agent-float" as const, userId: quote.creatorUserId, characterId: quote.originatingCharacterId },
      credit: { tenantId, kind: "platform-float" as const, userId: null, characterId: null },
      amountCredits: 50, reason: "fulfillment-reserve" as const, quoteId: quote.quoteId,
      fulfillmentId: admission.fulfillmentId, createdAt,
    },
  ];
  return { quote, admission, completion, transfers };
}

describe("deterministic fulfillment economics", () => {
  it("returns Float to its owner and posts only the quoted commission to pending earnings", () => {
    const f = fixture();
    const result = planFulfillmentSettlement(f);
    expect(result.map(t => [t.reason, t.credit.kind, t.amountCredits])).toEqual([
      ["fulfillment-release", "agent-float", 50],
      ["creator-earning", "pending-earnings", 30],
      ["platform-margin", "platform-revenue", 20],
    ]);
    expect(result[0]!.credit.characterId).toBe(f.quote.originatingCharacterId);
    expect(result[1]!.credit.userId).toBe(f.quote.creatorUserId);
    expect(result.every(t => t.createdAt === f.completion.completedAt)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("preserves the originating creator's lower fallback commission without reimbursing unreserved Float", () => {
    const f = fixture();
    const admission = { ...f.admission, fundingSource: "platform" as const,
      executorCharacterId: createCanonicalId("character"), creatorCommissionCredits: 10, platformRevenueCredits: 40 };
    expect(planFulfillmentSettlement({ ...f, admission }).map(t => [t.reason, t.amountCredits])).toEqual([
      ["creator-earning", 10], ["platform-margin", 40],
    ]);
  });

  it("settles platform sales without inventing a creator or releasing Float", () => {
    const f = fixture();
    const quote = { ...f.quote, creatorUserId: null, creatorCommissionCredits: 0, platformMarginCredits: 50 };
    const admission = { ...f.admission, creatorUserId: null, creatorCommissionCredits: 0,
      fundingSource: "platform" as const, platformRevenueCredits: 50 };
    expect(planFulfillmentSettlement({ ...f, quote, admission }).map(t => [t.reason, t.amountCredits])).toEqual([
      ["platform-margin", 50],
    ]);
  });

  it("rejects altered quote scope, economics, creator and executor", () => {
    const f = fixture();
    const changes: Partial<CommerceFulfillmentAdmission>[] = [
      { tenantId: createCanonicalId("tenant") }, { quoteId: createCanonicalId("quote") },
      { offerRevision: 2 }, { originatingCharacterId: createCanonicalId("character") },
      { creatorUserId: createCanonicalId("user") }, { reserveCredits: 49 },
      { creatorCommissionCredits: 31 }, { platformRevenueCredits: 21 },
      { executorCharacterId: createCanonicalId("character") },
      { createdAt: f.quote.expiresAt },
    ];
    for (const change of changes) {
      expect(() => planFulfillmentSettlement({ ...f, admission: { ...f.admission, ...change } })).toThrow();
    }
  });

  it("rejects self-generated withdrawable earnings", () => {
    const f = fixture();
    expect(() => planFulfillmentSettlement({ ...f,
      quote: { ...f.quote, customerUserId: f.quote.creatorUserId! } })).toThrow(/Self-purchases|Creator-funded/);
  });

  it("rejects an unrelated, early or malformed success receipt", () => {
    const f = fixture();
    for (const change of [
      { fulfillmentId: createCanonicalId("fulfillment") },
      { completedAt: toInstant("2026-10-04T14:59:59Z") }, { resultHash: "not-a-hash" },
    ]) {
      expect(() => planFulfillmentSettlement({ ...f, completion: { ...f.completion, ...change } })).toThrow();
    }
  });

  it("requires the complete payment and reserve batch, with no duplicate or redirected entry", () => {
    const f = fixture();
    expect(() => assertFulfillmentAdmissionTransfers(f)).not.toThrow();
    for (const transfers of [
      [], [f.transfers[0]!], [f.transfers[1]!, f.transfers[1]!],
      [{ ...f.transfers[0]!, amountCredits: 99 }, f.transfers[1]!],
      [{ ...f.transfers[0]!, credit: { ...f.transfers[0]!.credit, kind: "available-earnings" as const,
        userId: f.quote.creatorUserId } }, f.transfers[1]!],
      [f.transfers[0]!, { ...f.transfers[1]!, debit: { ...f.transfers[1]!.debit,
        characterId: createCanonicalId("character") } }],
    ]) {
      expect(() => assertFulfillmentAdmissionTransfers({ ...f, transfers })).toThrow();
    }
  });

  it("omits zero-value reserve and commission transfers", () => {
    const f = fixture();
    const quote = { ...f.quote, fulfillmentReserveCredits: 0, creatorCommissionCredits: 0, platformMarginCredits: 100 };
    const admission = { ...f.admission, reserveCredits: 0, creatorCommissionCredits: 0, platformRevenueCredits: 100 };
    expect(() => assertFulfillmentAdmissionTransfers({ quote, admission, transfers: [f.transfers[0]!] })).not.toThrow();
    expect(planFulfillmentSettlement({ ...f, quote, admission }).map(t => t.amountCredits)).toEqual([100]);
  });
});
