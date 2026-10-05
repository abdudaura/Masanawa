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
  it("keeps NGN parsing and percentage fees exact at the safe-integer boundary", () => {
    expect(parseNgnKobo("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => parseNgnKobo("90071992547409.92")).toThrow(
      "NGN amount exceeds safe range",
    );
    expect(
      calculateBillingFeeKobo(Number.MAX_SAFE_INTEGER, {
        basisPoints: 1,
        fixedKobo: 0,
      }),
    ).toBe(900719925475);
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
