import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { calculateBillingFeeKobo, createBillingQuote, formatNgnKobo, parseNgnKobo } from "./billing-money.js";
describe("billing NGN money", () => {
  it("uses exact kobo", () => {
    expect(parseNgnKobo("100")).toBe(10000);
    expect(parseNgnKobo("100.05")).toBe(10005);
    expect(formatNgnKobo(10005)).toBe("100.05");
    expect(() => parseNgnKobo("1.001")).toThrow();
  });
  it("builds fee-inclusive immutable terms", () => {
    const serviceAmountKobo = parseNgnKobo("100");
    const feeAmountKobo = calculateBillingFeeKobo(serviceAmountKobo, { basisPoints: 250, fixedKobo: 50 });
    expect(createBillingQuote({
      tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
      billerCode: "BIL119", itemCode: "AIRTIME", itemName: "Airtime",
      customerId: "07010102053", serviceAmountKobo, feeAmountKobo,
      createdAt: "2026-10-04T20:00:00Z", expiresAt: "2026-10-04T20:10:00Z",
    })).toMatchObject({ serviceAmountKobo: 10000, feeAmountKobo: 300, totalAmountKobo: 10300, state: "quoted" });
  });
});
