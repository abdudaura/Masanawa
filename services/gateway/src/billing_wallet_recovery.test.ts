import { describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { createBillingQuote } from "@masanawa/commerce";
import type {
  BillingQuote,
  BillingQuoteRepository,
  NgnFundingIntent,
  NgnWalletRepository,
} from "@masanawa/commerce";
import type { FlutterwaveFundingClient } from "@masanawa/providers";
import type { BillingFinancialService } from "./financial_billing.js";
import { createBillingWalletService } from "./billing_wallet.js";

describe("R05 credit-before-bill crash recovery", () => {
  function setup(initialState: NgnFundingIntent["state"] = "credited") {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const quoteId = createCanonicalId("quote");
    const txRef = "wallet-recovery-123";
    const funding: NgnFundingIntent = {
      tenantId, userId, quoteId, txRef,
      fundingReference: "funding-recovery-123",
      amountKobo: 10000,
      originatingCharacterId: null,
      state: initialState,
      accountNumber: "0000000000",
      bankName: "Test bank",
      providerOrderRef: "order-123",
      providerReference: "fw-123",
      providerTransactionId: initialState === "credited" ? "tx-123" : null,
      expiresAt: "2026-10-09T00:00:00.000Z",
      createdAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z",
    };
    let current = funding;
    const createdAt = "2026-10-08T00:00:00.000Z";
    const seed = createBillingQuote({
      tenantId, userId, quoteId, categoryCode: "AIRTIME", billerCode: "BIL119",
      itemCode: "AIRTIME", itemName: "Airtime", customerId: "07010102053",
      serviceAmountKobo: 10000, feeAmountKobo: 0,
      createdAt, expiresAt: "2026-10-09T00:00:00.000Z",
    });
    let quote: BillingQuote | null = { ...seed, state: "confirmed", confirmedAt: createdAt };
    const findFunding = vi.fn(async (): Promise<NgnFundingIntent | null> => current);
    const creditFunding = vi.fn(async () => {
      current = { ...current, state: "credited", providerTransactionId: "tx-123" };
      return current;
    });
    const verify = vi.fn(async () => ({
      status: "successful",
      amount: "100.00",
      currency: "NGN",
      transactionId: "tx-123",
      providerReference: "fw-123",
    }));
    const purchase = vi.fn(async () => ({ state: "succeeded" }));
    const readQuote = vi.fn(async () => quote);
    const service = createBillingWalletService({
      sessions: { async authorize() { throw new Error("not called by webhooks"); } },
      quotes: { readQuote } as unknown as BillingQuoteRepository,
      wallet: {
        readFundingIntentByTxRef: findFunding,
        creditFunding,
      } as unknown as NgnWalletRepository,
      funding: { verifyByReference: verify } as unknown as FlutterwaveFundingClient,
      billing: { purchaseOwned: purchase } as unknown as BillingFinancialService,
      webhookSecretHash: "valid-test-webhook-secret",
    });
    const webhook = {
      rawBody: Buffer.from(JSON.stringify({ event: "charge.completed", data: { tx_ref: txRef } })),
      verifHash: "valid-test-webhook-secret",
    };
    return {
      tenantId, userId, quoteId, service, webhook, findFunding,
      creditFunding, verify, purchase, readQuote,
      setQuote(next: BillingQuote | null) { quote = next; },
      setFunding(next: NgnFundingIntent) { current = next; },
      funding,
    };
  }

  it("resumes already credited funding without re-verifying or re-crediting", async () => {
    const t = setup();
    await expect(t.service.receiveFundingWebhook(t.webhook)).resolves.toEqual({
      handled: true, duplicate: true, resumed: true,
    });
    expect(t.creditFunding).not.toHaveBeenCalled();
    expect(t.verify).not.toHaveBeenCalled();
    expect(t.readQuote).toHaveBeenCalledWith({
      tenantId: t.tenantId, userId: t.userId, quoteId: t.quoteId,
    });
    expect(t.purchase).toHaveBeenCalledOnce();
    expect(t.purchase).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: t.tenantId, userId: t.userId,
      quoteId: t.quoteId, quoteRevision: 1,
      requestId: `bill-${t.quoteId}-r1`.slice(0, 128),
      customerId: "07010102053", amount: "100",
    }));
  });

  it("resumes freshly credited funding after provider verification", async () => {
    const t = setup("awaiting");
    await expect(t.service.receiveFundingWebhook(t.webhook)).resolves.toEqual({
      handled: true, duplicate: false, resumed: true,
    });
    expect(t.verify).toHaveBeenCalledWith(t.funding.txRef);
    expect(t.creditFunding).toHaveBeenCalledOnce();
    expect(t.purchase).toHaveBeenCalledOnce();
  });

  it("does not re-dispatch a finalized or unconfirmed bill", async () => {
    const t = setup();
    t.setQuote({ ...(await t.readQuote()), state: "succeeded" } as BillingQuote);
    await expect(t.service.receiveFundingWebhook(t.webhook)).resolves.toMatchObject({
      duplicate: true, resumed: false,
    });
    expect(t.purchase).not.toHaveBeenCalled();

    t.setQuote({ ...(await t.readQuote()), state: "confirmed", confirmedAt: null } as BillingQuote);
    await expect(t.service.receiveFundingWebhook(t.webhook)).resolves.toMatchObject({
      duplicate: true, resumed: false,
    });
    expect(t.purchase).not.toHaveBeenCalled();
  });

  it("propagates transient fulfillment failure so a duplicate callback can retry", async () => {
    const t = setup();
    t.purchase.mockRejectedValueOnce(new Error("temporary fulfillment outage"));
    await expect(t.service.receiveFundingWebhook(t.webhook)).rejects.toThrow(
      "temporary fulfillment outage",
    );
    await expect(t.service.receiveFundingWebhook(t.webhook)).resolves.toMatchObject({
      duplicate: true, resumed: true,
    });
    expect(t.purchase).toHaveBeenCalledTimes(2);
    expect(t.creditFunding).not.toHaveBeenCalled();
  });

  it("ignores unknown wallet references and rejects invalid signatures", async () => {
    const t = setup();
    t.findFunding.mockResolvedValueOnce(null);
    await expect(t.service.receiveFundingWebhook(t.webhook)).resolves.toMatchObject({
      handled: false, resumed: false,
    });
    expect(t.purchase).not.toHaveBeenCalled();
    await expect(t.service.receiveFundingWebhook({
      ...t.webhook, verifHash: "wrong",
    })).rejects.toThrow("Flutterwave webhook signature is invalid");
  });
});
