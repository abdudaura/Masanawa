import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { CryptoIntent, CryptoRepository } from "@masanawa/commerce";
import { canonicalizeIpnPayload, NowPaymentsClient, NowPaymentsCustodyClient, NowPaymentsPayoutClient, type NowPaymentsAccountEvidence } from "@masanawa/nowpayments";
import { createFinancialService, createFixedFinancialAuthorizer } from "./financial_service.js";

const tenantId = createCanonicalId("tenant"), userId = createCanonicalId("user");
const requestId = createCanonicalId("request");
const at = toInstant("2026-10-04T21:00:00Z");
const intent: CryptoIntent = {
  schemaVersion: 1, tenantId, userId, requestId, operation: "deposit",
  asset: "USDTTRC20", network: "tron", amount: "10", targetAsset: null,
  destinationAddress: null, provider: "nowpayments", providerPaymentId: "123",
  providerPayoutId: null, payAddress: "address", providerPayAmount: "10",
  providerDispatchStartedAt: at, status: "processing", createdAt: at, updatedAt: at,
};
const withdrawalIntent: CryptoIntent = {
  ...intent,
  operation: "withdraw",
  destinationAddress: "address",
  providerPaymentId: null,
  providerPayoutId: "batch-1",
  payAddress: null,
  providerPayAmount: null,
  status: "processing",
};

const account: NowPaymentsAccountEvidence = {
  custodyEnabled: true, customerManagementEnabled: true, conversionEnabled: true,
  payoutEnabled: true, ipWhitelistSatisfied: true,
  payoutDestinationWhitelistSatisfied: true, observedAt: at,
};
function setup(
  existing: CryptoIntent | null = intent,
  evidence?: NowPaymentsAccountEvidence,
  pooledCustodyLiabilityCoverageSatisfied?: boolean,
  feeReserve?: (input: {
    readonly intent: CryptoIntent;
    readonly networkFee: string;
    readonly quotedAt: ReturnType<typeof toInstant>;
  }) => Promise<CryptoIntent>,
) {
  const payload = { payment_id: "123", order_id: tenantId+"."+requestId, price_amount: "10",
    price_currency: "usdttrc20", pay_currency: "usdttrc20", pay_amount: "10",
    actually_paid: "10", payment_status: "finished" };
  const fetch = vi.fn(async (request: Parameters<typeof globalThis.fetch>[0]) => {
    const url = String(request);
    if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
    if (url.includes("/payout/validate-address")) return new Response(JSON.stringify({ valid: true }));
    if (url.includes("/payout/fee?")) {
      return new Response(JSON.stringify({ currency: "usdttrc20", fee: "0.1" }));
    }
    if (url.includes("/payout-withdrawal/min-amount/")) {
      return new Response(JSON.stringify({ success: true, result: "1" }));
    }
    if (url.endsWith("/balance")) {
      return new Response(JSON.stringify({ usdttrc20: { amount: "100", pendingAmount: "0" } }));
    }
    return new Response(JSON.stringify(payload));
  });
  let currentIntent = existing ?? intent;
  const crypto = {
    readIntent: vi.fn(async () => existing),
    readIntentByRequestId: vi.fn(async () => existing),
    applyProviderPaymentEvent: vi.fn(async () => ({ ...intent, status: "succeeded" as const })),
    reserveWithdrawal: vi.fn(async (value: CryptoIntent) => {
      currentIntent = value;
      return value;
    }),
    settleWithdrawal: vi.fn(async (value: { readonly succeeded: boolean }) => ({
      ...withdrawalIntent,
      status: value.succeeded ? "succeeded" as const : "failed" as const,
    })),
    bindProviderPayout: vi.fn(async () => withdrawalIntent),
    createIntent: vi.fn(async (value: CryptoIntent) => {
      currentIntent = value;
      return value;
    }),
    beginProviderDispatch: vi.fn(async () => ({ intent: currentIntent, shouldDispatch: false })),
  } as unknown as CryptoRepository;
  const service = createFinancialService({
    authorizer: createFixedFinancialAuthorizer({ token: "fixture-token", tenantId, userId }),
    crypto, nowPayments: new NowPaymentsClient({ apiKey: "fixture-key", fetch }),
    nowPaymentsCustody: new NowPaymentsCustodyClient({ apiKey: "fixture-key", email: "test@example.com", password: "fixture-password", fetch }),
    nowPaymentsPayout: new NowPaymentsPayoutClient({ apiKey: "fixture-key", email: "test@example.com", password: "fixture-password", fetch }),
    nowPaymentsIpnSecret: "fixture-ipn", publicBaseUrl: "https://example.com", now: () => at,
    ...(evidence === undefined ? {} : { withdrawalEvidence: async () => ({
      account: evidence,
      routes: [{ providerCode: "USDTTRC20", asset: "USDT", network: "tron",
        operations: { deposit: true, convert: null, withdraw: true }, estimatedNetworkFeeUsd: null }],
      ...(pooledCustodyLiabilityCoverageSatisfied === undefined
        ? {}
        : { pooledCustodyLiabilityCoverageSatisfied }),
    }) }),
    ...(feeReserve === undefined ? {} : {
      reserveWithdrawalWithFee: async (value) => {
        const reserved = await feeReserve(value);
        currentIntent = reserved;
        return reserved;
      },
    }),
  });
  return { service, crypto, fetch, payload };
}
const authorizationHeader = "Bearer fixture-token";
describe("financial service recovery and admission", () => {
  it("rejects signed callbacks with changed principal before posting a credit", async () => {
    const { service, crypto, payload } = setup();
    const changed = { ...payload, price_amount: "11" };
    const signature = createHmac("sha512", "fixture-ipn").update(canonicalizeIpnPayload(changed)).digest("hex");
    await expect(service.handleNowPaymentsIpn({ payload: changed, signature })).rejects.toThrow("financial.crypto.evidence_mismatch");
    expect(crypto.applyProviderPaymentEvent).not.toHaveBeenCalled();
  });
  it("preserves exact paid amounts from signed callback strings", async () => {
    const { service, crypto, payload } = setup();
    const changed = { ...payload, actually_paid: "10.000000000000000001" };
    const signature = createHmac("sha512", "fixture-ipn").update(canonicalizeIpnPayload(changed)).digest("hex");
    await service.handleNowPaymentsIpn({ payload: changed, signature });
    expect(crypto.applyProviderPaymentEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ actuallyPaid: "10.000000000000000001" }),
    }));
  });
  it("keeps missing transactions scoped without querying the provider", async () => {
    const { service, fetch } = setup(null);
    expect(await service.readIntent({ authorizationHeader, requestId })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects payout precision loss before reserving customer principal", async () => {
    const { service, crypto, fetch } = setup(null, account);
    await expect(service.createWithdrawal({ authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "10.000000000000000001", destinationAddress: "address" })).rejects.toThrow("financial.crypto.amount_unavailable");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a representable seven-decimal payout before provider access or reserve", async () => {
    const { service, crypto, fetch } = setup(null, account);
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "1.1234567", destinationAddress: "address",
    })).rejects.toThrow("financial.crypto.amount_unavailable");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not infer withdrawal routes from deposit support", async () => {
    const { service, crypto } = setup(null, account);
    await expect(service.createWithdrawal({ authorizationHeader, requestId, providerCode: "BTC",
      amount: "10", destinationAddress: "address" })).rejects.toThrow("financial.crypto.withdrawal_unavailable");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
  });
  it("quotes validated withdrawal minimum and current network fee before reservation", async () => {
    const { service, crypto, fetch } = setup(null, account);
    await expect(service.quoteWithdrawal({
      authorizationHeader, providerCode: "USDTTRC20", amount: "10", destinationAddress: "address",
    })).resolves.toEqual({
      providerCode: "USDTTRC20", amount: "10", destinationAddress: "address",
      minimumAmount: "1", networkFee: "0.1", addressValidated: true, quotedAt: at,
    });
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("requires canonical fee accounting before reserving a non-zero-fee withdrawal", async () => {
    const { service, crypto } = setup(null, account);
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "10", destinationAddress: "address",
    })).rejects.toThrow("financial.crypto.withdrawal_fee_settlement_unavailable");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
  });
  it("uses the canonical fee-aware reserve hook when a network fee is quoted", async () => {
    const reserveWithFee = vi.fn(async (value: {
      readonly intent: CryptoIntent;
      readonly networkFee: string;
      readonly quotedAt: ReturnType<typeof toInstant>;
    }) => value.intent);
    const { service, crypto } = setup(null, account, undefined, reserveWithFee);
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "10", destinationAddress: "address",
    })).resolves.toMatchObject({ status: "processing", amount: "10" });
    expect(reserveWithFee).toHaveBeenCalledWith(expect.objectContaining({
      networkFee: "0.1",
      quotedAt: at,
      intent: expect.objectContaining({ operation: "withdraw", amount: "10" }),
    }));
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
  });
  it("rejects provider custody insufficiency before reserving customer principal", async () => {
    const { service, crypto, fetch } = setup(null, account);
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.includes("/payout/validate-address")) return new Response("{}");
      if (url.includes("/payout/fee?")) return new Response(JSON.stringify({ fee: "0.5" }));
      if (url.includes("/payout-withdrawal/min-amount/")) return new Response(JSON.stringify({ success: true, result: "1" }));
      if (url.endsWith("/balance")) return new Response(JSON.stringify({ usdttrc20: { amount: "10.4", pendingAmount: "0" } }));
      return new Response("{}");
    });
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20", amount: "10", destinationAddress: "address",
    })).rejects.toThrow("financial.crypto.provider_balance_unavailable");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
  });
  it("rejects a provider-invalid destination before reserving customer principal", async () => {
    const { service, crypto, fetch } = setup(null, account);
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.includes("/payout/validate-address")) return new Response("invalid", { status: 400 });
      if (url.includes("/payout/fee?")) return new Response(JSON.stringify({ fee: "0.1" }));
      if (url.includes("/payout-withdrawal/min-amount/")) return new Response(JSON.stringify({ success: true, result: "1" }));
      if (url.endsWith("/balance")) return new Response(JSON.stringify({ usdttrc20: { amount: "100", pendingAmount: "0" } }));
      return new Response("{}");
    });
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20", amount: "10", destinationAddress: "bad-address",
    })).rejects.toThrow("nowpayments.payout.address.invalid");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
  });
  it("rejects a withdrawal below the live provider minimum before reservation", async () => {
    const { service, crypto, fetch } = setup(null, account);
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.includes("/payout/validate-address")) return new Response("{}");
      if (url.includes("/payout/fee?")) return new Response(JSON.stringify({ fee: "0.1" }));
      if (url.includes("/payout-withdrawal/min-amount/")) return new Response(JSON.stringify({ success: true, result: "20" }));
      if (url.endsWith("/balance")) return new Response(JSON.stringify({ usdttrc20: { amount: "100", pendingAmount: "0" } }));
      return new Response("{}");
    });
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20", amount: "10", destinationAddress: "address",
    })).rejects.toThrow("financial.crypto.withdrawal_below_minimum");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
  });
  it("settles an exact signed terminal payout callback once", async () => {
    const { service, crypto } = setup(withdrawalIntent, account);
    const payout = {
      id: "withdrawal-1",
      batch_withdrawal_id: "batch-1",
      payout_status: "FINISHED",
      currency: "usdttrc20",
      amount: "10.000000",
      address: "address",
      unique_external_id: tenantId+"."+requestId,
    };
    const signature = createHmac("sha512", "fixture-ipn")
      .update(canonicalizeIpnPayload(payout)).digest("hex");
    await expect(service.handleNowPaymentsPayoutIpn({ payload: payout, signature }))
      .resolves.toEqual({ accepted: true, requestId });
    expect(crypto.settleWithdrawal).toHaveBeenCalledWith(expect.objectContaining({
      tenantId, userId, requestId, succeeded: true, providerReference: "withdrawal-1",
    }));
  });
  it("rejects changed signed payout terms before ledger settlement", async () => {
    const { service, crypto } = setup(withdrawalIntent, account);
    const payout = {
      id: "withdrawal-1",
      batch_withdrawal_id: "batch-1",
      payout_status: "FINISHED",
      currency: "usdttrc20",
      amount: "9",
      address: "address",
      unique_external_id: tenantId+"."+requestId,
    };
    const signature = createHmac("sha512", "fixture-ipn")
      .update(canonicalizeIpnPayload(payout)).digest("hex");
    await expect(service.handleNowPaymentsPayoutIpn({ payload: payout, signature }))
      .rejects.toThrow("financial.crypto.payout_evidence_mismatch");
    expect(crypto.settleWithdrawal).not.toHaveBeenCalled();
  });
  it("rejects forged payout callbacks before reading or settling the ledger", async () => {
    const { service, crypto } = setup(withdrawalIntent, account);
    const payout = {
      id: "withdrawal-1",
      batch_withdrawal_id: "batch-1",
      payout_status: "FINISHED",
      currency: "usdttrc20",
      amount: "10",
      address: "address",
      unique_external_id: tenantId+"."+requestId,
    };
    await expect(service.handleNowPaymentsPayoutIpn({
      payload: payout, signature: "0".repeat(128),
    })).rejects.toThrow("nowpayments.ipn.signature.invalid");
    expect(crypto.readIntentByRequestId).not.toHaveBeenCalled();
    expect(crypto.settleWithdrawal).not.toHaveBeenCalled();
  });
  it("accepts an idempotent duplicate terminal payout and rejects a contradictory terminal callback", async () => {
    const succeeded = { ...withdrawalIntent, status: "succeeded" as const };
    const { service, crypto } = setup(succeeded, account);
    const finished = {
      id: "withdrawal-1", batch_withdrawal_id: "batch-1", payout_status: "FINISHED",
      currency: "usdttrc20", amount: "10", address: "address",
      unique_external_id: tenantId+"."+requestId,
    };
    await service.handleNowPaymentsPayoutIpn({
      payload: finished,
      signature: createHmac("sha512", "fixture-ipn").update(canonicalizeIpnPayload(finished)).digest("hex"),
    });
    expect(crypto.settleWithdrawal).not.toHaveBeenCalled();

    const failed = { ...finished, payout_status: "FAILED" };
    await expect(service.handleNowPaymentsPayoutIpn({
      payload: failed,
      signature: createHmac("sha512", "fixture-ipn").update(canonicalizeIpnPayload(failed)).digest("hex"),
    })).rejects.toThrow("financial.crypto.payout_terminal_conflict");
  });
  it("refreshes a payout only from exact provider evidence", async () => {
    const { service, crypto, fetch } = setup(withdrawalIntent, account);
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.includes("/payout?")) return new Response(JSON.stringify({
        payouts: [{
          id: "withdrawal-1", batch_withdrawal_id: "batch-1", payout_status: "FINISHED",
          currency: "usdttrc20", amount: "10", address: "address",
          unique_external_id: tenantId+"."+requestId,
        }],
      }));
      return new Response("{}");
    });
    await expect(service.refreshWithdrawal({ authorizationHeader, requestId }))
      .resolves.toMatchObject({ status: "succeeded", providerPayoutId: "batch-1" });
    expect(crypto.settleWithdrawal).toHaveBeenCalledWith(expect.objectContaining({
      providerReference: "withdrawal-1", succeeded: true,
    }));
  });
  it("does not settle refreshed payout evidence with changed destination", async () => {
    const { service, crypto, fetch } = setup(withdrawalIntent, account);
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.includes("/payout?")) return new Response(JSON.stringify({
        payouts: [{
          id: "withdrawal-1", batch_withdrawal_id: "batch-1", payout_status: "FINISHED",
          currency: "usdttrc20", amount: "10", address: "different",
          unique_external_id: tenantId+"."+requestId,
        }],
      }));
      return new Response("{}");
    });
    await expect(service.refreshWithdrawal({ authorizationHeader, requestId }))
      .rejects.toThrow("financial.crypto.payout_evidence_mismatch");
    expect(crypto.settleWithdrawal).not.toHaveBeenCalled();
  });
  it("requeries a bound pending deposit and passes full evidence to its ledger owner", async () => {
    const { service, crypto, fetch } = setup();
    expect((await service.readIntent({ authorizationHeader, requestId }))?.status).toBe("succeeded");
    expect(fetch).toHaveBeenCalledOnce();
    expect(crypto.applyProviderPaymentEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId, userId, event: expect.objectContaining({ orderId: requestId, actuallyPaid: "10", status: "finished" }),
    }));
  });
  it.each(["succeeded", "failed", "refunded", "expired"] as const)("does not requery terminal %s deposits", async status => {
    const { service, fetch } = setup({ ...intent, status });
    await service.readIntent({ authorizationHeader, requestId });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not dispatch or query an unbound unknown result", async () => {
    const { service, fetch } = setup({ ...intent, providerPaymentId: null });
    await service.readIntent({ authorizationHeader, requestId });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects unauthorized reads before storage or provider access", async () => {
    const { service, crypto, fetch } = setup();
    await expect(service.readIntent({ authorizationHeader: undefined, requestId })).rejects.toThrow("financial.auth.unauthorized");
    expect(crypto.readIntent).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects mismatched provider identity without posting ledger evidence", async () => {
    const { service, crypto, fetch, payload } = setup();
    fetch.mockResolvedValue(new Response(JSON.stringify({ ...payload, payment_id: "other" })));
    await expect(service.readIntent({ authorizationHeader, requestId })).rejects.toThrow("financial.crypto.evidence_mismatch");
    expect(crypto.applyProviderPaymentEvent).not.toHaveBeenCalled();
  });
  it("does not post ledger evidence during provider outage", async () => {
    const { service, crypto, fetch } = setup();
    fetch.mockRejectedValue(new Error("private-provider-error"));
    await expect(service.readIntent({ authorizationHeader, requestId })).rejects.toThrow("nowpayments.transport.unavailable");
    expect(crypto.applyProviderPaymentEvent).not.toHaveBeenCalled();
  });
  it("credentials alone do not advertise qualified withdrawals", async () => {
    expect((await setup().service.capabilities({ authorizationHeader })).withdrawals).toBe(false);
  });
  it("fresh account and exact-route evidence qualify withdrawals", async () => {
    expect((await setup(intent, account).service.capabilities({ authorizationHeader })).withdrawals).toBe(true);
  });
  it("allows pooled custody only when the canonical ledger proves aggregate liability coverage", async () => {
    const pooled = { ...account, customerManagementEnabled: false };
    expect((await setup(intent, pooled).service.capabilities({ authorizationHeader })).withdrawals).toBe(false);
    expect((await setup(intent, pooled, true).service.capabilities({ authorizationHeader })).withdrawals).toBe(true);
  });
  it.each([
    { custodyEnabled: false }, { payoutEnabled: null }, { customerManagementEnabled: false },
    { ipWhitelistSatisfied: false }, { payoutDestinationWhitelistSatisfied: null },
    { observedAt: "2026-10-04T20:00:00Z" },
  ])("fails closed on absent or stale qualification %j", change => {
    return expect(setup(intent, { ...account, ...change }).service.capabilities({ authorizationHeader }))
      .resolves.toMatchObject({ withdrawals: false });
  });
  it("rejects changed deposit replay before any provider request", async () => {
    const { service, fetch } = setup();
    await expect(service.createDeposit({ authorizationHeader, requestId, providerCode: "USDTTRC20", amount: "11" }))
      .rejects.toThrow("financial.crypto.request_conflict");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("denies withdrawal before locking principal when account is unqualified", async () => {
    const { service, crypto } = setup(null);
    await expect(service.createWithdrawal({ authorizationHeader, requestId, providerCode: "USDTTRC20", amount: "10", destinationAddress: "address" }))
      .rejects.toThrow("financial.crypto.withdrawal_unavailable");
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
  });
});
