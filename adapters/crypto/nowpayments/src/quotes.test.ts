import { describe, expect, it } from "vitest";
import {
  assertAboveMinimum,
  parseEstimate,
  parseMinimumAmount,
} from "./quotes.js";

describe("NOWPayments quote evidence", () => {
  it("parses minimum amount while preserving exact asset/network codes", () => {
    expect(
      parseMinimumAmount(
        { currency_from: "usd", currency_to: "usdttrc20", min_amount: "4.25" },
        { currencyFrom: "USD", currencyTo: "USDTTRC20" },
      ),
    ).toEqual({
      currencyFrom: "USD",
      currencyTo: "USDTTRC20",
      minimumAmount: 4.25,
    });
  });

  it("uses request currencies only when provider omits them", () => {
    expect(
      parseEstimate(
        { amount_from: 10, estimated_amount: "9.97" },
        { amount: 10, currencyFrom: "USD", currencyTo: "USDTTRC20" },
      ),
    ).toEqual({
      currencyFrom: "USD",
      currencyTo: "USDTTRC20",
      requestedAmount: 10,
      estimatedAmount: 9.97,
    });
  });

  it("rejects malformed or non-positive provider amounts", () => {
    expect(() =>
      parseMinimumAmount(
        { min_amount: 0 },
        { currencyFrom: "USD", currencyTo: "BTC" },
      ),
    ).toThrow("nowpayments.minimum.invalid_response");
    expect(() =>
      parseEstimate(
        { estimated_amount: "NaN" },
        { amount: 10, currencyFrom: "USD", currencyTo: "BTC" },
      ),
    ).toThrow("nowpayments.estimate.invalid_response");
  });

  it("rejects payment creation amounts below current provider minimum", () => {
    const minimum = parseMinimumAmount(
      { min_amount: 5 },
      { currencyFrom: "USD", currencyTo: "USDTTRC20" },
    );
    expect(() => assertAboveMinimum(4.99, minimum)).toThrow(
      "nowpayments.amount.below_minimum",
    );
    expect(() => assertAboveMinimum(5, minimum)).not.toThrow();
  });
});
