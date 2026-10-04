import { describe, expect, it } from "vitest";
import {
  deriveBillingFundingIdentity,
  normalizeBillingFundingTerms,
} from "./financial-operations.js";

const requestId = "request_0194c2d2-6c00-7abc-8abc-1234567890ab";

describe("billing funding identity and economics", () => {
  it("derives stable distinct canonical ledger identities from one request", () => {
    const first = deriveBillingFundingIdentity(requestId);
    const second = deriveBillingFundingIdentity(requestId);
    expect(first).toEqual(second);
    expect(first.quoteId).toBe("quote_0194c2d2-6c00-7abc-8abc-1234567890ab");
    const ids = [
      first.reserveLedgerEntryId,
      first.providerLedgerEntryId,
      first.marginLedgerEntryId,
      first.refundLedgerEntryId,
    ];
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => /^ledger-entry_[0-9a-f-]+$/u.test(id))).toBe(true);
  });

  it("requires exact positive provider cost and balanced customer economics", () => {
    expect(
      normalizeBillingFundingTerms({
        reference: requestId,
        providerAmountNgn: "100",
        customerPriceCredits: 110,
        providerReserveCredits: 100,
        platformMarginCredits: 10,
        pricingPolicyVersion: "billing-ngn-v1",
        observedAt: "2026-10-04T19:30:00.000Z",
      }),
    ).toMatchObject({
      reference: requestId,
      customerPriceCredits: 110,
      providerReserveCredits: 100,
      platformMarginCredits: 10,
      pricingPolicyVersion: "billing-ngn-v1",
    });

    expect(() =>
      normalizeBillingFundingTerms({
        reference: requestId,
        providerAmountNgn: "100",
        customerPriceCredits: 109,
        providerReserveCredits: 100,
        platformMarginCredits: 10,
        pricingPolicyVersion: "billing-ngn-v1",
        observedAt: "2026-10-04T19:30:00.000Z",
      }),
    ).toThrow("economics do not sum");

    expect(() =>
      normalizeBillingFundingTerms({
        reference: "not-a-request",
        providerAmountNgn: "100",
        customerPriceCredits: 110,
        providerReserveCredits: 100,
        platformMarginCredits: 10,
        pricingPolicyVersion: "billing-ngn-v1",
        observedAt: "2026-10-04T19:30:00.000Z",
      }),
    ).toThrow();
  });
});
