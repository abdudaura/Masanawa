import { describe, expect, it } from "vitest";
import { defaultPaidFeatureTrialPolicy } from "./trial.js";
import { quoteTwinVoice } from "./voice-product.js";

const policy = {
  schemaVersion: 1 as const,
  revision: 3,
  active: true,
  unitSeconds: 60,
  priceCreditsPerUnit: 3,
  ownerShareBasisPoints: 3000,
  trial: defaultPaidFeatureTrialPolicy("twin-voice", "2026-10-05T08:00:00Z"),
};

describe("twin voice pricing", () => {
  it("quotes zero during the active trial", () => {
    const quote = quoteTwinVoice({
      policy,
      usage: { trialStartedAt: null, trialConsumedUnits: 0 },
      expectedSeconds: 300,
      now: "2026-10-05T09:00:00Z",
    });
    expect(quote.chargeMode).toBe("trial");
    expect(quote.estimatedPriceCredits).toBe(0);
    expect(quote.trial.expiresAt).toBe("2026-10-12T09:00:00.000Z");
  });

  it("quotes paid usage after the seven-day trial", () => {
    const quote = quoteTwinVoice({
      policy,
      usage: {
        trialStartedAt: "2026-09-20T09:00:00Z",
        trialConsumedUnits: 20,
      },
      expectedSeconds: 125,
      now: "2026-10-05T09:00:00Z",
    });
    expect(quote.chargeMode).toBe("paid");
    expect(quote.estimatedUnits).toBe(3);
    expect(quote.estimatedPriceCredits).toBe(9);
  });
});
