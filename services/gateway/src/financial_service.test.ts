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

const conversionIntent: CryptoIntent = {
  ...intent,
  operation: "convert",
  targetAsset: "BTC",
  targetNetwork: null,
  providerPaymentId: null,
  providerPayoutId: null,
  providerConversionId: "conversion-1",
  providerTargetAmount: null,
  payAddress: null,
  providerPayAmount: null,
  status: "processing",
};

const buyIntent: CryptoIntent = {
  ...intent,
  operation: "buy",
  asset: "NGN",
  network: null,
  amount: "1500",
  targetAsset: "USDTTRC20",
  targetNetwork: "tron",
  destinationAddress: null,
  providerPaymentId: null,
  providerPayoutId: null,
  providerInvoiceId: "invoice-1",
  checkoutUrl: "https://nowpayments.io/payment/?iid=invoice-1",
  providerConversionId: null,
  providerTargetAmount: null,
  payAddress: null,
  providerPayAmount: null,
  status: "awaiting_payment",
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
  payoutVerificationCodeProvider?: (input: {
    readonly batchId: string;
    readonly tenantId: typeof tenantId;
    readonly userId: typeof userId;
    readonly requestId: typeof requestId;
  }) => Promise<string | null>,
  shouldDispatch = false,
  enableConversions = false,
  destinationApproved = true,
  withdrawalNetworkFeeMode: "sender" | "receiver" | null = "receiver",
  enableFiatOnRamp = false,
) {
  const payload = { payment_id: "123", order_id: tenantId+"."+requestId, price_amount: "10",
    price_currency: "usdttrc20", pay_currency: "usdttrc20", pay_amount: "10",
    actually_paid: "10", payment_status: "finished" };
  const fetch = vi.fn(async (
    request: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1],
  ) => {
    const url = String(request);
    if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
    if (url.includes("/payout/validate-address")) return new Response(JSON.stringify({ valid: true }));
    if (url.includes("/payout/fee?")) {
      return new Response(JSON.stringify({ currency: "usdttrc20", fee: "0.1" }));
    }
    if (url.includes("/payout-withdrawal/min-amount/")) {
      return new Response(JSON.stringify({ success: true, result: "1" }));
    }
    if (url.endsWith("/currencies")) {
      return new Response(JSON.stringify({
        currencies: ["usdttrc20", "btc", "trx"],
      }));
    }
    if (url.endsWith("/invoice") && init?.method === "POST") {
      return new Response(JSON.stringify({
        id: "invoice-1",
        order_id: tenantId+"."+requestId,
        price_amount: 1500,
        price_currency: "ngn",
        pay_currency: "ngn",
        invoice_url: "https://nowpayments.io/payment/?iid=invoice-1",
      }), { status: 201 });
    }
    if (url.endsWith("/balance")) {
      return new Response(JSON.stringify({
        usdttrc20: { amount: "100", pendingAmount: "0" },
        btc: { amount: "1", pendingAmount: "0" },
      }));
    }
    if (url.includes("/min-amount?")) {
      const parsed = new URL(url);
      return new Response(JSON.stringify({
        currency_from: parsed.searchParams.get("currency_from"),
        currency_to: parsed.searchParams.get("currency_to"),
        min_amount: "1",
      }));
    }
    if (url.includes("/estimate?")) {
      const parsed = new URL(url);
      return new Response(JSON.stringify({
        currency_from: parsed.searchParams.get("currency_from"),
        currency_to: parsed.searchParams.get("currency_to"),
        amount_from: parsed.searchParams.get("amount"),
        estimated_amount: "0.00016",
      }));
    }
    if (url.endsWith("/conversion/conversion-1")) {
      return new Response(JSON.stringify({
        conversion_id: "conversion-1",
        status: "completed",
        from_currency: "usdttrc20",
        to_currency: "btc",
        from_amount: "10",
        to_amount: "0.00016",
      }));
    }
    if (url.endsWith("/conversion") && init?.method === "POST") {
      return new Response(JSON.stringify({
        conversion_id: "conversion-1",
        status: "processing",
        from_currency: "usdttrc20",
        to_currency: "btc",
        from_amount: "10",
        to_amount: "0.00016",
      }));
    }
    if (url.endsWith("/payout")) {
      return new Response(JSON.stringify({
        id: "batch-1",
        withdrawals: [{ id: "withdrawal-1", status: "WAITING" }],
      }));
    }
    if (url.endsWith("/payout/batch-1/verify")) {
      return new Response(JSON.stringify({ status: "PROCESSING" }));
    }
    if (url.includes("/payout?")) {
      return new Response(JSON.stringify({
        payouts: [{
          id: "withdrawal-1", batch_withdrawal_id: "batch-1", payout_status: "PROCESSING",
          currency: "usdttrc20", amount: "10", address: "address",
          unique_external_id: tenantId+"."+requestId,
        }],
      }));
    }
    return new Response(JSON.stringify(payload));
  });
  let currentIntent = existing ?? intent;
  const crypto = {
    readIntent: vi.fn(async () => existing),
    readIntentByRequestId: vi.fn(async () => existing),
    readIntentByProviderPayoutId: vi.fn(async () => existing),
    applyProviderPaymentEvent: vi.fn(async (value: {
      readonly event: CryptoProviderPaymentEvent;
    }) => {
      if (currentIntent.operation === "buy") {
        currentIntent = {
          ...currentIntent,
          providerPaymentId: currentIntent.providerPaymentId ?? value.event.paymentId,
          providerTargetAmount:
            value.event.status === "finished"
              ? value.event.outcomeAmount ?? null
              : null,
          status:
            value.event.status === "finished"
              ? "succeeded" as const
              : value.event.status === "refunded"
                ? "refunded" as const
                : "processing" as const,
        };
        return currentIntent;
      }
      return { ...intent, status: "succeeded" as const };
    }),
    bindProviderInvoice: vi.fn(async (value: {
      readonly providerInvoiceId: string;
      readonly checkoutUrl: string;
    }) => {
      currentIntent = {
        ...currentIntent,
        providerInvoiceId: value.providerInvoiceId,
        checkoutUrl: value.checkoutUrl,
        status: "awaiting_payment",
      };
      return currentIntent;
    }),
    bindProviderPayment: vi.fn(async (value: {
      readonly providerPaymentId: string;
      readonly payAddress: string;
      readonly providerPayAmount: string;
    }) => {
      currentIntent = {
        ...currentIntent,
        providerPaymentId: value.providerPaymentId,
        payAddress: value.payAddress,
        providerPayAmount: value.providerPayAmount,
        status: "awaiting_payment",
      };
      return currentIntent;
    }),
    reserveWithdrawal: vi.fn(async (value: CryptoIntent) => {
      currentIntent = value;
      return value;
    }),
    reserveWithdrawalWithFee: vi.fn(async (value: {
      readonly intent: CryptoIntent;
      readonly networkFee: string;
      readonly feePayer: "user" | "platform";
    }) => {
      const reserved = feeReserve
        ? await feeReserve({
            intent: value.intent,
            networkFee: value.networkFee,
            quotedAt: at,
          })
        : value.intent;
      currentIntent = reserved;
      return reserved;
    }),
    reserveConversion: vi.fn(async (value: CryptoIntent) => {
      currentIntent = value;
      return value;
    }),
    bindProviderConversion: vi.fn(async () => {
      currentIntent = { ...currentIntent, providerConversionId: "conversion-1" };
      return currentIntent;
    }),
    settleConversion: vi.fn(async (value: {
      readonly succeeded: boolean;
      readonly targetAmount: string | null;
    }) => {
      currentIntent = {
        ...currentIntent,
        providerTargetAmount: value.succeeded ? value.targetAmount : null,
        status: value.succeeded ? "succeeded" as const : "failed" as const,
      };
      return currentIntent;
    }),
    settleWithdrawal: vi.fn(async (value: { readonly succeeded: boolean }) => {
      currentIntent = {
        ...currentIntent,
        status: value.succeeded ? "succeeded" as const : "failed" as const,
      };
      return currentIntent;
    }),
    bindProviderPayout: vi.fn(async () => {
      currentIntent = { ...currentIntent, providerPayoutId: "batch-1" };
      return currentIntent;
    }),
    createIntent: vi.fn(async (value: CryptoIntent) => {
      currentIntent = value;
      return value;
    }),
    beginProviderDispatch: vi.fn(async () => ({ intent: currentIntent, shouldDispatch })),
    failProviderDispatch: vi.fn(async () => {
      currentIntent = { ...currentIntent, status: "failed" as const };
      return currentIntent;
    }),
    readAggregateLiability: vi.fn(async () =>
      pooledCustodyLiabilityCoverageSatisfied === false ? "101" : "0"),
  } as unknown as CryptoRepository;
  const service = createFinancialService({
    authorizer: createFixedFinancialAuthorizer({ token: "fixture-token", tenantId, userId }),
    crypto, nowPayments: new NowPaymentsClient({ apiKey: "fixture-key", fetch }),
    nowPaymentsCustody: new NowPaymentsCustodyClient({ apiKey: "fixture-key", email: "test@example.com", password: "fixture-password", fetch }),
    nowPaymentsPayout: new NowPaymentsPayoutClient({ apiKey: "fixture-key", email: "test@example.com", password: "fixture-password", fetch }),
    nowPaymentsIpnSecret: "fixture-ipn", publicBaseUrl: "https://example.com", now: () => at,
    withdrawalDestinationApproved: vi.fn(async () => destinationApproved),
    ...(withdrawalNetworkFeeMode === null
      ? {}
      : { withdrawalNetworkFeeMode }),
    ...(enableFiatOnRamp ? {
      fiatOnRamp: {
        enabled: true as const,
        fiatCurrencies: ["NGN", "USD"],
        settlementProviderCode: "USDTTRC20",
      },
    } : {}),
    ...(evidence === undefined ? {} : { withdrawalEvidence: async () => ({
      account: evidence,
      routes: [{ providerCode: "USDTTRC20", asset: "USDT", network: "tron",
        operations: { deposit: true, convert: null, withdraw: true }, estimatedNetworkFeeUsd: null }],
    }) }),
    ...(enableConversions ? {
      conversionEvidence: async () => ({
        account: evidence ?? account,
        routes: [
          { providerCode: "USDTTRC20", asset: "USDT", network: "tron",
            operations: { deposit: true, convert: true, withdraw: true }, estimatedNetworkFeeUsd: null },
          { providerCode: "BTC", asset: "BTC", network: null,
            operations: { deposit: true, convert: true, withdraw: true }, estimatedNetworkFeeUsd: null },
        ],
      }),
    } : {}),
    ...(payoutVerificationCodeProvider === undefined
      ? {}
      : { payoutVerificationCodeProvider }),
  });
  return { service, crypto, fetch, payload };
}
const authorizationHeader = "Bearer fixture-token";
describe("financial service recovery and admission", () => {
  it("keeps fiat Buy disabled until the account is explicitly activated and custody-backed", async () => {
    await expect(setup(null).service.capabilities({ authorizationHeader }))
      .resolves.toMatchObject({
        fiatOnRamp: false,
        fiatCurrencies: [],
        fiatSettlementProviderCode: null,
      });
    await expect(setup(
      null, undefined, undefined, undefined, undefined,
      false, false, true, "receiver", true,
    ).service.capabilities({ authorizationHeader })).resolves.toMatchObject({
      fiatOnRamp: true,
      fiatCurrencies: ["NGN", "USD"],
      fiatSettlementProviderCode: "USDTTRC20",
      fiatOnRampReason: null,
    });
  });

  it("creates one hosted fiat checkout bound to the canonical request", async () => {
    const { service, crypto, fetch } = setup(
      null, undefined, undefined, undefined, undefined,
      true, false, true, "receiver", true,
    );
    await expect(service.createFiatPurchase({
      authorizationHeader,
      requestId,
      fiatAmount: "1500",
      fiatCurrency: "NGN",
    })).resolves.toMatchObject({
      requestId,
      fiatAmount: "1500",
      fiatCurrency: "NGN",
      settlementAsset: "USDTTRC20",
      settlementNetwork: "tron",
      status: "awaiting_payment",
      providerInvoiceId: "invoice-1",
      checkoutUrl: "https://nowpayments.io/payment/?iid=invoice-1",
    });
    expect(crypto.bindProviderInvoice).toHaveBeenCalledWith(expect.objectContaining({
      requestId,
      providerInvoiceId: "invoice-1",
      checkoutUrl: "https://nowpayments.io/payment/?iid=invoice-1",
    }));
    const invoiceCalls = fetch.mock.calls.filter((call) =>
      String(call[0]).endsWith("/invoice"));
    expect(invoiceCalls).toHaveLength(1);
    expect(JSON.parse(String(invoiceCalls[0]?.[1]?.body))).toMatchObject({
      price_amount: 1500,
      price_currency: "ngn",
      pay_currency: "ngn",
      order_id: tenantId+"."+requestId,
    });
  });

  it("marks a deterministic hosted-invoice rejection failed without retrying dispatch", async () => {
    const { service, crypto, fetch } = setup(
      null, undefined, undefined, undefined, undefined,
      true, false, true, "receiver", true,
    );
    fetch.mockImplementation(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({ currencies: ["usdttrc20"] }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          usdttrc20: { amount: "100", pendingAmount: "0" },
        }));
      }
      if (url.endsWith("/invoice") && init?.method === "POST") {
        return new Response("invalid invoice", { status: 422 });
      }
      return new Response("{}");
    });
    await expect(service.createFiatPurchase({
      authorizationHeader,
      requestId,
      fiatAmount: "1500",
      fiatCurrency: "NGN",
    })).resolves.toMatchObject({ status: "failed" });
    expect(crypto.failProviderDispatch).toHaveBeenCalledWith(expect.objectContaining({
      requestId,
      operation: "buy",
    }));
    expect(crypto.bindProviderInvoice).not.toHaveBeenCalled();
  });

  it("keeps ambiguous hosted-invoice dispatch unresolved instead of creating a second invoice", async () => {
    const { service, crypto, fetch } = setup(
      null, undefined, undefined, undefined, undefined,
      true, false, true, "receiver", true,
    );
    fetch.mockImplementation(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({ currencies: ["usdttrc20"] }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          usdttrc20: { amount: "100", pendingAmount: "0" },
        }));
      }
      if (url.endsWith("/invoice") && init?.method === "POST") {
        throw new Error("socket reset");
      }
      return new Response("{}");
    });
    await expect(service.createFiatPurchase({
      authorizationHeader,
      requestId,
      fiatAmount: "1500",
      fiatCurrency: "NGN",
    })).rejects.toThrow("nowpayments.transport.unavailable");
    expect(crypto.failProviderDispatch).not.toHaveBeenCalled();
    expect(crypto.bindProviderInvoice).not.toHaveBeenCalled();
  });

  it("credits only the exact signed fiat on-ramp crypto outcome", async () => {
    const { service, crypto } = setup(
      buyIntent, undefined, undefined, undefined, undefined,
      false, false, true, "receiver", true,
    );
    const payload = {
      payment_id: "fiat-payment-1",
      invoice_id: "invoice-1",
      order_id: tenantId+"."+requestId,
      payment_status: "finished",
      price_amount: "1500",
      price_currency: "ngn",
      pay_amount: "1500",
      pay_currency: "ngn",
      actually_paid: "1500",
      outcome_amount: "1.234567",
      outcome_currency: "usdttrc20",
    };
    const signature = createHmac("sha512", "fixture-ipn")
      .update(canonicalizeIpnPayload(payload)).digest("hex");
    await expect(service.handleNowPaymentsIpn({ payload, signature }))
      .resolves.toEqual({ accepted: true, requestId });
    expect(crypto.applyProviderPaymentEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      userId,
      event: expect.objectContaining({
        paymentId: "fiat-payment-1",
        invoiceId: "invoice-1",
        priceAmount: "1500",
        priceCurrency: "NGN",
        outcomeAmount: "1.234567",
        outcomeCurrency: "USDTTRC20",
      }),
    }));
  });

  it("rejects a signed fiat outcome in the wrong custody asset before ledger settlement", async () => {
    const { service, crypto } = setup(
      buyIntent, undefined, undefined, undefined, undefined,
      false, false, true, "receiver", true,
    );
    const payload = {
      payment_id: "fiat-payment-1",
      invoice_id: "invoice-1",
      order_id: tenantId+"."+requestId,
      payment_status: "finished",
      price_amount: "1500",
      price_currency: "ngn",
      pay_amount: "1500",
      pay_currency: "ngn",
      actually_paid: "1500",
      outcome_amount: "0.00002",
      outcome_currency: "btc",
    };
    const signature = createHmac("sha512", "fixture-ipn")
      .update(canonicalizeIpnPayload(payload)).digest("hex");
    await expect(service.handleNowPaymentsIpn({ payload, signature }))
      .rejects.toThrow("financial.crypto.onramp_evidence_mismatch");
    expect(crypto.applyProviderPaymentEvent).not.toHaveBeenCalled();
  });

  it("binds a small created deposit using a plain exact provider amount", async () => {
    const { service, crypto, fetch } = setup(
      null, undefined, undefined, undefined, undefined, true,
    );
    fetch.mockImplementation(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({ currencies: ["btc"] }));
      }
      if (url.includes("/min-amount?")) {
        return new Response(JSON.stringify({
          currency_from: "btc", currency_to: "btc", min_amount: "0.00000001",
        }));
      }
      if (url.endsWith("/payment") && init?.method === "POST") {
        return new Response(JSON.stringify({
          payment_id: "small-payment",
          payment_status: "waiting",
          pay_address: "bc1fixture",
          price_amount: 0.00000001,
          price_currency: "btc",
          pay_amount: 0.00000001,
          pay_currency: "btc",
          order_id: tenantId+"."+requestId,
        }));
      }
      return new Response("{}");
    });

    await expect(service.createDeposit({
      authorizationHeader,
      requestId,
      providerCode: "BTC",
      amount: "0.00000001",
    })).resolves.toMatchObject({
      providerPaymentId: "small-payment",
      providerPayAmount: "0.00000001",
      amount: "0.00000001",
    });
    expect(crypto.bindProviderPayment).toHaveBeenCalledWith(expect.objectContaining({
      providerPaymentId: "small-payment",
      providerPayAmount: "0.00000001",
    }));
  });

  it("rejects signed callbacks with changed principal before posting a credit", async () => {
    const { service, crypto, payload } = setup();
    const changed = { ...payload, price_amount: "11" };
    const signature = createHmac("sha512", "fixture-ipn").update(canonicalizeIpnPayload(changed)).digest("hex");
    await expect(service.handleNowPaymentsIpn({ payload: changed, signature })).rejects.toThrow("financial.crypto.evidence_mismatch");
    expect(crypto.applyProviderPaymentEvent).not.toHaveBeenCalled();
  });
  it("rejects a signed child payment even when it names the stored payment as parent", async () => {
    const { service, crypto, payload } = setup();
    const child = {
      ...payload,
      payment_id: "child-payment",
      parent_payment_id: "123",
    };
    const signature = createHmac("sha512", "fixture-ipn")
      .update(canonicalizeIpnPayload(child)).digest("hex");
    await expect(service.handleNowPaymentsIpn({ payload: child, signature }))
      .rejects.toThrow("financial.crypto.evidence_mismatch");
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
  it("advertises and lists only deposit currencies backed by live custody balances", async () => {
    const { service } = setup(null);
    await expect(service.capabilities({ authorizationHeader }))
      .resolves.toMatchObject({ deposits: true });
    await expect(service.listDepositRoutes({ authorizationHeader }))
      .resolves.toEqual([
        expect.objectContaining({ providerCode: "BTC" }),
        expect.objectContaining({ providerCode: "USDTTRC20" }),
      ]);
  });

  it("rejects a deposit route that the provider would auto-convert outside custody", async () => {
    const { service, crypto, fetch } = setup(null);
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({ currencies: ["usdttrc20", "btc"] }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          btc: { amount: "1", pendingAmount: "0" },
        }));
      }
      return new Response("{}");
    });
    await expect(service.createDeposit({
      authorizationHeader,
      requestId,
      providerCode: "USDTTRC20",
      amount: "10",
    })).rejects.toThrow("financial.crypto.route_unavailable");
    expect(crypto.createIntent).not.toHaveBeenCalled();
    expect(fetch.mock.calls.some((call) => String(call[0]).includes("/payment"))).toBe(false);
  });

  it("fails deposit capability closed when custody evidence is unavailable", async () => {
    const { service, fetch } = setup(null);
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({ currencies: ["usdttrc20"] }));
      }
      if (url.endsWith("/balance")) {
        return new Response("unavailable", { status: 503 });
      }
      return new Response("{}");
    });
    await expect(service.capabilities({ authorizationHeader }))
      .resolves.toMatchObject({ deposits: false });
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
  it("rejects an unapproved payout destination before provider preflight or reserve", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, false, false, false,
    );
    await expect(service.createWithdrawal({
      authorizationHeader,
      requestId,
      providerCode: "USDTTRC20",
      amount: "10",
      destinationAddress: "not-whitelisted",
    })).rejects.toThrow("financial.crypto.withdrawal_destination_unapproved");
    expect(fetch).not.toHaveBeenCalled();
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
    expect(crypto.reserveWithdrawalWithFee).not.toHaveBeenCalled();
  });

  it("quotes validated withdrawal minimum and current network fee before reservation", async () => {
    const { service, crypto, fetch } = setup(null, account);
    await expect(service.quoteWithdrawal({
      authorizationHeader, providerCode: "USDTTRC20", amount: "10", destinationAddress: "address",
    })).resolves.toEqual({
      providerCode: "USDTTRC20", amount: "10", destinationAddress: "address",
      minimumAmount: "1", networkFee: "0.1",
      networkFeeMode: "receiver", feePayer: "user",
      estimatedReceiveAmount: "9.9",
      addressValidated: true, quotedAt: at,
    });
    expect(crypto.reserveWithdrawal).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it("receiver fee mode debits only principal and reports the reduced receive estimate", async () => {
    const { service, crypto } = setup(null, account);
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "10", destinationAddress: "address",
    })).resolves.toMatchObject({ status: "processing", amount: "10" });
    expect(crypto.reserveWithdrawal).toHaveBeenCalledWith(expect.objectContaining({
      operation: "withdraw", amount: "10",
    }));
    expect(crypto.reserveWithdrawalWithFee).not.toHaveBeenCalled();
  });
  it("sender fee mode records a platform-paid fee without debiting the user for the estimate", async () => {
    const reserveWithFee = vi.fn(async (value: {
      readonly intent: CryptoIntent;
      readonly networkFee: string;
      readonly quotedAt: ReturnType<typeof toInstant>;
    }) => value.intent);
    const { service, crypto } = setup(
      null, account, undefined, reserveWithFee,
      undefined, false, false, true, "sender",
    );
    await expect(service.quoteWithdrawal({
      authorizationHeader, providerCode: "USDTTRC20",
      amount: "10", destinationAddress: "address",
    })).resolves.toMatchObject({
      networkFeeMode: "sender",
      feePayer: "platform",
      estimatedReceiveAmount: "10",
    });
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
    expect(crypto.reserveWithdrawalWithFee).toHaveBeenCalledWith(expect.objectContaining({
      feePayer: "platform",
      networkFee: "0.1",
    }));
  });
  it("releases a payout reserve on deterministic provider rejection", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, true,
    );
    fetch.mockImplementation(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.includes("/payout/validate-address")) return new Response("{}");
      if (url.includes("/payout/fee?")) return new Response(JSON.stringify({ fee: "0.1" }));
      if (url.includes("/payout-withdrawal/min-amount/")) {
        return new Response(JSON.stringify({ success: true, result: "1" }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({ usdttrc20: { amount: "100", pendingAmount: "0" } }));
      }
      if (url.endsWith("/payout") && init?.method === "POST") {
        return new Response("invalid payout", { status: 422 });
      }
      return new Response("{}");
    });
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "10", destinationAddress: "address",
    })).resolves.toMatchObject({ status: "failed", providerPayoutId: null });
    expect(crypto.settleWithdrawal).toHaveBeenCalledWith(expect.objectContaining({
      succeeded: false, providerReference: null,
    }));
    expect(crypto.bindProviderPayout).not.toHaveBeenCalled();
  });

  it("keeps a payout reserve locked when dispatch transport outcome is unknown", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, true,
    );
    fetch.mockImplementation(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.includes("/payout/validate-address")) return new Response("{}");
      if (url.includes("/payout/fee?")) return new Response(JSON.stringify({ fee: "0.1" }));
      if (url.includes("/payout-withdrawal/min-amount/")) {
        return new Response(JSON.stringify({ success: true, result: "1" }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({ usdttrc20: { amount: "100", pendingAmount: "0" } }));
      }
      if (url.endsWith("/payout") && init?.method === "POST") {
        throw new Error("socket reset");
      }
      return new Response("{}");
    });
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "10", destinationAddress: "address",
    })).rejects.toThrow("nowpayments.payout.transport.unavailable");
    expect(crypto.reserveWithdrawalWithFee).toHaveBeenCalledOnce();
    expect(crypto.settleWithdrawal).not.toHaveBeenCalled();
    expect(crypto.bindProviderPayout).not.toHaveBeenCalled();
  });

  it("never accepts an end-user payout verification code", async () => {
    const { service, fetch } = setup(withdrawalIntent, account);
    await expect(service.verifyWithdrawal({
      authorizationHeader,
      requestId,
      verificationCode: "123456",
    })).rejects.toThrow("financial.crypto.withdrawal_verification_server_only");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("automatically verifies a dispatched payout using only the server-side merchant code provider", async () => {
    const reserveWithFee = vi.fn(async (value: {
      readonly intent: CryptoIntent;
      readonly networkFee: string;
      readonly quotedAt: ReturnType<typeof toInstant>;
    }) => value.intent);
    const codeProvider = vi.fn(async () => "123456");
    const { service, fetch } = setup(
      null, account, undefined, reserveWithFee, codeProvider, true,
    );
    await expect(service.createWithdrawal({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      amount: "10", destinationAddress: "address",
    })).resolves.toMatchObject({
      status: "processing",
      providerPayoutId: "batch-1",
    });
    expect(codeProvider).toHaveBeenCalledWith({
      batchId: "batch-1", tenantId, userId, requestId,
    });
    const calledUrls = fetch.mock.calls.map((call) => String(call[0]));
    expect(calledUrls).toContain("https://api.nowpayments.io/v1/payout/batch-1/verify");
  });
  it("sender fee mode requires custody to cover principal plus estimated fee", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined,
      undefined, false, false, true, "sender",
    );
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
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
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
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
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
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
  it("advertises conversions only with fresh custody, conversion and two-route evidence", async () => {
    expect((await setup(intent, account).service.capabilities({ authorizationHeader })).conversions)
      .toBe(false);
    const enabled = setup(
      intent, account, undefined, undefined, undefined, false, true,
    ).service;
    await expect(enabled.capabilities({ authorizationHeader }))
      .resolves.toMatchObject({ conversions: true, conversionReason: null });
    const stale = { ...account, observedAt: "2026-10-04T20:00:00Z" };
    const staleService = setup(
      intent, stale, undefined, undefined, undefined, false, true,
    ).service;
    await expect(staleService.capabilities({ authorizationHeader }))
      .resolves.toMatchObject({ conversions: false });
  });

  it("quotes a qualified custody conversion without reserving user balance", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, false, true,
    );
    await expect(service.quoteConversion({
      authorizationHeader,
      providerCode: "USDTTRC20",
      targetProviderCode: "BTC",
      amount: "10",
    })).resolves.toEqual({
      providerCode: "USDTTRC20",
      targetProviderCode: "BTC",
      amount: "10",
      minimumAmount: "1",
      estimatedTargetAmount: "0.00016",
      quotedAt: at,
    });
    expect(crypto.reserveConversion).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("reserves, dispatches and binds a custody conversion exactly once", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, true, true,
    );
    await expect(service.createConversion({
      authorizationHeader,
      requestId,
      providerCode: "USDTTRC20",
      targetProviderCode: "BTC",
      amount: "10",
    })).resolves.toMatchObject({
      requestId,
      asset: "USDTTRC20",
      targetAsset: "BTC",
      amount: "10",
      targetAmount: null,
      status: "processing",
      providerConversionId: "conversion-1",
    });
    expect(crypto.reserveConversion).toHaveBeenCalledOnce();
    expect(crypto.bindProviderConversion).toHaveBeenCalledWith(expect.objectContaining({
      tenantId, userId, requestId, providerConversionId: "conversion-1",
    }));
    const urls = fetch.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain("https://api.nowpayments.io/v1/conversion");
  });

  it("releases a conversion reserve on deterministic provider rejection", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, true, true,
    );
    fetch.mockImplementation(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.includes("/min-amount?")) {
        return new Response(JSON.stringify({
          currency_from: "usdttrc20", currency_to: "btc", min_amount: "1",
        }));
      }
      if (url.includes("/estimate?")) {
        return new Response(JSON.stringify({
          currency_from: "usdttrc20", currency_to: "btc",
          amount_from: "10", estimated_amount: "0.00016",
        }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          usdttrc20: { amount: "100", pendingAmount: "0" },
          btc: { amount: "1", pendingAmount: "0" },
        }));
      }
      if (url.endsWith("/conversion") && init?.method === "POST") {
        return new Response("invalid conversion", { status: 422 });
      }
      return new Response("{}");
    });
    await expect(service.createConversion({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      targetProviderCode: "BTC", amount: "10",
    })).resolves.toMatchObject({ status: "failed", targetAmount: null });
    expect(crypto.settleConversion).toHaveBeenCalledWith(expect.objectContaining({
      succeeded: false, targetAmount: null, providerReference: null,
    }));
    expect(crypto.bindProviderConversion).not.toHaveBeenCalled();
  });

  it("keeps a conversion reserve locked when dispatch transport outcome is unknown", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, true, true,
    );
    fetch.mockImplementation(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.includes("/min-amount?")) {
        return new Response(JSON.stringify({
          currency_from: "usdttrc20", currency_to: "btc", min_amount: "1",
        }));
      }
      if (url.includes("/estimate?")) {
        return new Response(JSON.stringify({
          currency_from: "usdttrc20", currency_to: "btc",
          amount_from: "10", estimated_amount: "0.00016",
        }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          usdttrc20: { amount: "100", pendingAmount: "0" },
          btc: { amount: "1", pendingAmount: "0" },
        }));
      }
      if (url.endsWith("/conversion") && init?.method === "POST") {
        throw new Error("socket reset");
      }
      return new Response("{}");
    });
    await expect(service.createConversion({
      authorizationHeader, requestId, providerCode: "USDTTRC20",
      targetProviderCode: "BTC", amount: "10",
    })).rejects.toThrow("nowpayments.custody.transport.unavailable");
    expect(crypto.reserveConversion).toHaveBeenCalledOnce();
    expect(crypto.settleConversion).not.toHaveBeenCalled();
    expect(crypto.bindProviderConversion).not.toHaveBeenCalled();
  });

  it("reconciles a completed conversion to the exact target amount", async () => {
    const { service, crypto } = setup(
      conversionIntent, account, undefined, undefined, undefined, false, true,
    );
    await expect(service.refreshConversion({ authorizationHeader, requestId }))
      .resolves.toMatchObject({
        status: "succeeded",
        providerConversionId: "conversion-1",
        targetAmount: "0.00016",
      });
    expect(crypto.settleConversion).toHaveBeenCalledWith(expect.objectContaining({
      tenantId, userId, requestId, succeeded: true,
      targetAmount: "0.00016", providerReference: "conversion-1",
    }));
  });

  it("rejects changed provider conversion evidence before settlement", async () => {
    const { service, crypto, fetch } = setup(
      conversionIntent, account, undefined, undefined, undefined, false, true,
    );
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.endsWith("/conversion/conversion-1")) return new Response(JSON.stringify({
        conversion_id: "conversion-1",
          status: "completed",
          from_currency: "usdttrc20",
          to_currency: "eth",
          from_amount: "10",
          to_amount: "0.004",
      }));
      return new Response("{}");
    });
    await expect(service.refreshConversion({ authorizationHeader, requestId }))
      .rejects.toThrow("nowpayments.conversion.evidence_mismatch");
    expect(crypto.settleConversion).not.toHaveBeenCalled();
  });

  it("rejects changed conversion replay before provider or balance access", async () => {
    const { service, crypto, fetch } = setup(conversionIntent);
    await expect(service.createConversion({
      authorizationHeader,
      requestId,
      providerCode: "USDTTRC20",
      targetProviderCode: "ETH",
      amount: "10",
    })).rejects.toThrow("financial.crypto.request_conflict");
    expect(crypto.reserveConversion).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects insufficient merchant custody before reserving a conversion", async () => {
    const { service, crypto, fetch } = setup(
      null, account, undefined, undefined, undefined, false, true,
    );
    fetch.mockImplementation(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/auth")) return new Response(JSON.stringify({ token: "fixture-jwt" }));
      if (url.includes("/min-amount?")) {
        return new Response(JSON.stringify({
          currency_from: "usdttrc20", currency_to: "btc", min_amount: "1",
        }));
      }
      if (url.includes("/estimate?")) {
        return new Response(JSON.stringify({
          currency_from: "usdttrc20", currency_to: "btc",
          amount_from: "10", estimated_amount: "0.00016",
        }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          usdttrc20: { amount: "9.999999", pendingAmount: "0" },
          btc: { amount: "1", pendingAmount: "0" },
        }));
      }
      return new Response("{}");
    });
    await expect(service.createConversion({
      authorizationHeader,
      requestId,
      providerCode: "USDTTRC20",
      targetProviderCode: "BTC",
      amount: "10",
    })).rejects.toThrow("financial.crypto.provider_balance_unavailable");
    expect(crypto.reserveConversion).not.toHaveBeenCalled();
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
  it("accepts exact signed payout evidence when the provider omits unique_external_id", async () => {
    const { service, crypto } = setup(withdrawalIntent, account);
    const payout = {
      id: "withdrawal-1",
      batch_withdrawal_id: "batch-1",
      payout_status: "FINISHED",
      currency: "usdttrc20",
      amount: "10",
      address: "address",
    };
    const signature = createHmac("sha512", "fixture-ipn")
      .update(canonicalizeIpnPayload(payout)).digest("hex");
    await expect(service.handleNowPaymentsPayoutIpn({ payload: payout, signature }))
      .resolves.toEqual({ accepted: true, requestId });
    expect(crypto.readIntentByProviderPayoutId).toHaveBeenCalledWith({
      providerPayoutId: "batch-1",
    });
    expect(crypto.settleWithdrawal).toHaveBeenCalledWith(expect.objectContaining({
      succeeded: true,
      providerReference: "withdrawal-1",
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
    expect(crypto.readIntentByProviderPayoutId).not.toHaveBeenCalled();
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
  it("fresh account, exact-route evidence and live custody coverage qualify withdrawals", async () => {
    const { service, crypto } = setup(intent, account);
    expect((await service.capabilities({ authorizationHeader })).withdrawals).toBe(true);
    expect(crypto.readAggregateLiability).toHaveBeenCalled();
  });
  it("does not treat Customer Management capability as a substitute for user-to-provider binding", async () => {
    const customerManaged = { ...account, customerManagementEnabled: true };
    expect((await setup(intent, customerManaged, false).service.capabilities({ authorizationHeader })).withdrawals)
      .toBe(false);
    expect((await setup(intent, customerManaged, true).service.capabilities({ authorizationHeader })).withdrawals)
      .toBe(true);
  });
  it("allows pooled custody only when live custody covers canonical aggregate liabilities", async () => {
    const pooled = { ...account, customerManagementEnabled: false };
    expect((await setup(intent, pooled, false).service.capabilities({ authorizationHeader })).withdrawals)
      .toBe(false);
    expect((await setup(intent, pooled, true).service.capabilities({ authorizationHeader })).withdrawals)
      .toBe(true);
  });
  it.each([
    { custodyEnabled: false }, { payoutEnabled: null },
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
