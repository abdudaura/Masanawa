import { describe, expect, it } from "vitest";
import {
  normalizeProviderValuationPolicy,
  valueProviderAmount,
} from "./provider-valuation.js";

const policy = normalizeProviderValuationPolicy({
  schemaVersion: 1,
  revision: 3,
  enabled: true,
  valuationKey: "flutterwave:NGN:kobo",
  eventType: "external-funding",
  sourceUnit: "NGN_KOBO",
  sourceUnitsPerStep: 1000,
  creditUnitsPerStep: 1,
  minimumSourceUnits: 1000,
  maximumBaseCredits: 500,
  effectiveAt: "2026-10-06T00:00:00.000Z",
});

describe("provider valuation policy", () => {
  it("requires an explicitly configured rational mapping", () => {
    expect(valueProviderAmount({
      policy,
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "external-funding",
      sourceUnits: 2500,
    })).toMatchObject({
      eligible: true,
      policyRevision: 3,
      baseCredits: 2,
      sourceUnit: "NGN_KOBO",
    });
  });

  it("never crosses valuation keys or event types", () => {
    expect(valueProviderAmount({
      policy,
      valuationKey: "nowpayments:BTC:satoshi",
      eventType: "external-funding",
      sourceUnits: 100000,
    })).toMatchObject({ eligible: false, reason: "valuation-key-mismatch", baseCredits: 0 });
    expect(valueProviderAmount({
      policy,
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "commerce-purchase",
      sourceUnits: 100000,
    })).toMatchObject({ eligible: false, reason: "event-mismatch", baseCredits: 0 });
  });

  it("honors minimums, caps and disabled revisions", () => {
    expect(valueProviderAmount({
      policy,
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "external-funding",
      sourceUnits: 999,
    })).toMatchObject({ eligible: false, reason: "below-minimum", baseCredits: 0 });
    expect(valueProviderAmount({
      policy,
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "external-funding",
      sourceUnits: 999999999,
    })).toMatchObject({ eligible: true, baseCredits: 500 });

    const disabled = normalizeProviderValuationPolicy({ ...policy, revision: 4, enabled: false });
    expect(valueProviderAmount({
      policy: disabled,
      valuationKey: disabled.valuationKey,
      eventType: disabled.eventType,
      sourceUnits: 5000,
    })).toMatchObject({ eligible: false, reason: "disabled", baseCredits: 0 });
  });
});
