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
});
