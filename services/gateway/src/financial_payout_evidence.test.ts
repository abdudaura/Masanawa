import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalizeIpnPayload } from "@masanawa/nowpayments";
import { assertPayoutEvidence, parseVerifiedPayoutIpn } from "./financial_payout_evidence.js";

const secret = "fixture-secret";
const payload = {
  id: "withdrawal-1",
  batch_withdrawal_id: "batch-1",
  payout_status: "FINISHED",
  currency: "usdttrc20",
  amount: "10.000000",
  address: "wallet-address",
  unique_external_id: "tenant.request",
};
function signature(value: unknown): string {
  return createHmac("sha512", secret).update(canonicalizeIpnPayload(value)).digest("hex");
}

describe("signed payout evidence", () => {
  it("preserves exact bound payout identity", () => {
    const evidence = parseVerifiedPayoutIpn({
      payload,
      signature: signature(payload),
      secret,
    });
    expect(evidence).toMatchObject({
      batchId: "batch-1",
      withdrawalId: "withdrawal-1",
      status: "finished",
      currency: "USDTTRC20",
      amount: "10",
      address: "wallet-address",
      uniqueExternalId: "tenant.request",
    });
    expect(evidence.payloadHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(() => assertPayoutEvidence(evidence, {
      batchId: "batch-1",
      currency: "USDTTRC20",
      amount: "10.0",
      address: "wallet-address",
      uniqueExternalId: "tenant.request",
    })).not.toThrow();
  });

  it.each([
    { batch_withdrawal_id: "other" },
    { currency: "btc" },
    { amount: "10.000001" },
    { address: "other-wallet" },
    { unique_external_id: "tenant.other" },
  ])("rejects changed bound terms %j", (change) => {
    const changed = { ...payload, ...change };
    const evidence = parseVerifiedPayoutIpn({
      payload: changed,
      signature: signature(changed),
      secret,
    });
    expect(() => assertPayoutEvidence(evidence, {
      batchId: "batch-1",
      currency: "USDTTRC20",
      amount: "10",
      address: "wallet-address",
      uniqueExternalId: "tenant.request",
    })).toThrow("financial.crypto.payout_evidence_mismatch");
  });

  it("rejects a forged callback before parsing status", () => {
    expect(() => parseVerifiedPayoutIpn({
      payload,
      signature: "0".repeat(128),
      secret,
    })).toThrow("nowpayments.ipn.signature.invalid");
  });

  it.each([
    { payout_status: "invented" },
    { amount: "1.0000001" },
    { amount: 0 },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { unique_external_id: "" },
    { address: "" },
  ])("rejects invalid signed provider evidence %j", (change) => {
    const changed = { ...payload, ...change };
    expect(() => parseVerifiedPayoutIpn({
      payload: changed,
      signature: signature(changed),
      secret,
    })).toThrow("financial.crypto.payout_evidence_invalid");
  });
});
