import { describe, expect, it } from "vitest";
import {
  assertFreshAccountEvidence,
  qualifyAccountCapability,
  type NowPaymentsAccountEvidence,
} from "./account.js";

const base: NowPaymentsAccountEvidence = {
  custodyEnabled: true,
  customerManagementEnabled: true,
  conversionEnabled: true,
  payoutEnabled: true,
  ipWhitelistSatisfied: true,
  payoutDestinationWhitelistSatisfied: true,
  observedAt: "2026-10-04T16:00:00.000Z",
};

describe("NOWPayments account capability qualification", () => {
  it("requires explicit capability evidence", () => {
    expect(
      qualifyAccountCapability({ ...base, conversionEnabled: null }, "conversion"),
    ).toMatchObject({
      eligible: false,
      reasons: ["capability.unverified"],
    });
  });

  it("requires IP whitelist evidence for custody operations", () => {
    expect(
      qualifyAccountCapability({ ...base, ipWhitelistSatisfied: null }, "custody"),
    ).toMatchObject({
      eligible: false,
      reasons: ["security.ip_whitelist.unverified"],
    });
  });

  it("requires destination whitelist evidence for payouts", () => {
    expect(
      qualifyAccountCapability(
        { ...base, payoutDestinationWhitelistSatisfied: false },
        "payout",
      ),
    ).toMatchObject({
      eligible: false,
      reasons: ["security.destination_whitelist.unsatisfied"],
    });
  });

  it("admits a fully evidenced payout capability", () => {
    expect(qualifyAccountCapability(base, "payout")).toEqual({
      capability: "payout",
      eligible: true,
      reasons: [],
    });
  });

  it("rejects stale account evidence", () => {
    expect(() =>
      assertFreshAccountEvidence(base, {
        now: new Date("2026-10-04T16:10:01.000Z"),
        maxAgeMs: 10 * 60_000,
      }),
    ).toThrow("nowpayments.account_evidence.stale");
  });
});
