import { describe, expect, it } from "vitest";
import { assertFinancialReplay, type FinancialReplayTerms } from "./financial_replay.js";

const terms: FinancialReplayTerms = {
  operation: "withdraw", asset: "USDTTRC20", network: "trc20",
  amount: "10.000000000000000001", destinationAddress: "fixture-address",
};
const intent = { ...terms, targetAsset: null, provider: "nowpayments" };
describe("financial request replay custody", () => {
  it("accepts identical terms without changing evidence", () => {
    expect(() => assertFinancialReplay(Object.freeze(intent), Object.freeze(terms))).not.toThrow();
  });
  it.each([
    { operation: "deposit" as const }, { asset: "BTC" }, { network: "erc20" },
    { amount: "10.000000000000000002" }, { destinationAddress: "other-address" },
    { destinationAddress: null }, { targetAsset: "BTC" }, { provider: "other-provider" },
  ])("rejects changed terms including sub-float precision: %j", change => {
    expect(() => assertFinancialReplay({ ...intent, ...change }, terms))
      .toThrow("financial.crypto.request_conflict");
  });
  it("accepts a deposit replay only with deposit terms", () => {
    const deposit = { ...terms, operation: "deposit" as const, destinationAddress: null };
    expect(() => assertFinancialReplay({ ...deposit, targetAsset: null, provider: "nowpayments" }, deposit)).not.toThrow();
    expect(() => assertFinancialReplay(intent, deposit)).toThrow("financial.crypto.request_conflict");
  });
  it("binds conversion replay to the exact target asset and network", () => {
    const conversion: FinancialReplayTerms = {
      operation: "convert", asset: "USDTTRC20", network: "tron",
      amount: "10", destinationAddress: null, targetAsset: "BTC", targetNetwork: null,
    };
    const admitted = {
      ...conversion, targetAsset: "BTC", targetNetwork: null, provider: "nowpayments",
    };
    expect(() => assertFinancialReplay(admitted, conversion)).not.toThrow();
    for (const change of [
      { targetAsset: "ETH" },
      { targetNetwork: "ethereum" },
      { amount: "11" },
      { operation: "withdraw" as const },
    ]) {
      expect(() => assertFinancialReplay({ ...admitted, ...change }, conversion))
        .toThrow("financial.crypto.request_conflict");
    }
  });
});
