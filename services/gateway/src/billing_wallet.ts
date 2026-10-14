import { requireDataBundleCategory, isDataBundleCategory } from "./billing_data_policy.js";
import { createHash, randomUUID } from "node:crypto";
import { parseCanonicalId } from "@masanawa/contracts";
import type {
  BillingQuote,
  BillingQuoteRepository,
  NgnFundingIntent,
  NgnWalletRepository,
} from "@masanawa/commerce";
import { formatNgnKobo, parseNgnKobo } from "@masanawa/commerce";
import {
  FlutterwaveFundingClient,
  verifyFlutterwaveV3Webhook,
  type BillingFulfillmentRecord,
} from "@masanawa/providers";
import type { BillingFinancialService } from "./financial_billing.js";
import type {
  BillingCustomerIdentity,
  CustomerSessionAuthorizer,
} from "./billing_checkout.js";

export type BillingWalletView = Readonly<{
  balanceKobo: number;
  balance: string;
  phase: "ready" | "awaiting-funds" | "processing" | "fulfilled" | "failed";
  quoteId: string | null;
  funding: NgnFundingIntent | null;
  purchase: BillingFulfillmentRecord | null;
  document: unknown;
}>;

export interface BillingWalletService {
  balance(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<Readonly<{ balanceKobo: number; balance: string }>>;

  createFunding(input: Readonly<{
    authorizationHeader: string | undefined;
    amount: string;
    originatingCharacterId?: string;
    signal?: AbortSignal;
  }>): Promise<BillingWalletView>;

  confirmAndPurchase(input: Readonly<{
    authorizationHeader: string | undefined;
    quoteId: string;
    quoteRevision: number;
    signal?: AbortSignal;
  }>): Promise<BillingWalletView>;

  receiveFundingWebhook(input: Readonly<{
    rawBody: Uint8Array;
    verifHash: string | null | undefined;
  }>): Promise<Readonly<{ handled: boolean; duplicate: boolean; resumed: boolean }>>;
}

function syntheticEmail(userId: string): string {
  const key = createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 20);
  return `wallet+${key}@masanawa.com`;
}

function splitName(name: string | null | undefined): Readonly<{
  firstName?: string;
  lastName?: string;
}> {
  const parts = (name ?? "").trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return Object.freeze({});
  if (parts.length === 1) return Object.freeze({ firstName: parts[0]! });
  return Object.freeze({
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  });
}

function walletDocument(
  balanceKobo: number,
  phase: BillingWalletView["phase"],
  funding: NgnFundingIntent | null,
  quote: BillingQuote | null,
  purchase: BillingFulfillmentRecord | null,
): unknown {
  const nodes: unknown[] = [
    {
      type: "metric",
      text: "Wallet balance",
      value: `₦${formatNgnKobo(balanceKobo)}`,
      subtitle: "Available now",
    },
  ];
  if (funding) {
    nodes.push(
      {
        type: "notice",
        tone: "info",
        text: quote
          ? "Transfer the exact amount below. Masanawa will continue your confirmed bill automatically after the transfer is verified."
          : "Transfer the exact amount below. Your Masanawa wallet will update automatically after verification.",
      },
      { type: "detail", text: "Bank", value: funding.bankName ?? "" },
      { type: "detail", text: "Account number", value: funding.accountNumber ?? "" },
      { type: "detail", text: "Amount", value: `₦${formatNgnKobo(funding.amountKobo)}` },
      { type: "detail", text: "Expires", value: funding.expiresAt },
    );
  }
  if (purchase) {
    nodes.push({
      type: "notice",
      tone: purchase.state === "succeeded" ? "success" : "info",
      text:
        purchase.state === "succeeded"
          ? "Bill completed successfully."
          : "Your bill is being reconciled. Masanawa will not send a duplicate purchase.",
    });
    if (purchase.deliveryCode) {
      nodes.push({ type: "detail", text: "Token / code", value: purchase.deliveryCode });
    }
  }
  return Object.freeze({
    version: 1,
    id: quote ? `billing-wallet:${quote.quoteId}` : `wallet-funding:${funding?.fundingReference ?? "balance"}`,
    revision: 1,
    fallback:
      funding
        ? `Transfer ₦${formatNgnKobo(funding.amountKobo)} to ${funding.bankName ?? "the bank account"} ${funding.accountNumber ?? ""}.`
        : `Wallet balance ₦${formatNgnKobo(balanceKobo)}.`,
    nodes,
  });
}

function txRef(): string {
  return `wallet-${randomUUID()}`;
}

function fundingRef(): string {
  return `funding-${randomUUID()}`;
}

function webhookTxRef(payload: Readonly<Record<string, unknown>>): string | null {
  const data =
    typeof payload.data === "object" && payload.data !== null && !Array.isArray(payload.data)
      ? payload.data as Record<string, unknown>
      : null;
  const candidates = [payload.tx_ref, payload.reference, data?.tx_ref, data?.reference];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().startsWith("wallet-")) {
      return value.trim();
    }
  }
  return null;
}

export function createBillingWalletService(input: Readonly<{
  sessions: CustomerSessionAuthorizer;
  quotes: BillingQuoteRepository;
  wallet: NgnWalletRepository;
  funding: FlutterwaveFundingClient;
  billing: BillingFinancialService;
  webhookSecretHash: string;
  fundingExpirySeconds?: number;
  twinMonetization?: {
    attribute(input: {
      readonly tenantId: import("@masanawa/contracts").TenantId;
      readonly customerUserId: import("@masanawa/contracts").UserId;
      readonly characterId: import("@masanawa/contracts").CharacterId | null;
      readonly eventType: "external-funding";
      readonly operationId: string;
    }): Promise<void>;
    settleProviderValue(input: {
      readonly tenantId: import("@masanawa/contracts").TenantId;
      readonly valuationKey: string;
      readonly eventType: "external-funding";
      readonly operationId: string;
      readonly sourceUnits: number;
    }): Promise<unknown>;
  };
}>): BillingWalletService {
  const webhookSecretHash = input.webhookSecretHash.trim();
  if (!webhookSecretHash) throw new Error("financial.wallet.webhook_secret_required");
  const fundingExpirySeconds = input.fundingExpirySeconds ?? 30 * 60;

  async function owner(header: string | undefined): Promise<BillingCustomerIdentity> {
    return input.sessions.authorize({ authorizationHeader: header });
  }

  async function currentBalance(identity: Pick<BillingCustomerIdentity, "tenantId" | "userId">) {
    return input.wallet.readBalance(identity);
  }

  async function createAccount(
    identity: BillingCustomerIdentity,
    amountKobo: number,
    quoteId: string | null,
    originatingCharacterId: string | null,
    signal?: AbortSignal,
  ): Promise<NgnFundingIntent> {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.parse(createdAt) + fundingExpirySeconds * 1000).toISOString();
    const reference = fundingRef();
    const referenceTx = txRef();
    const created = await input.wallet.createFundingIntent({
      tenantId: identity.tenantId,
      userId: identity.userId,
      fundingReference: reference,
      txRef: referenceTx,
      amountKobo,
      ...(quoteId ? { quoteId } : {}),
      ...(!quoteId && originatingCharacterId
        ? { originatingCharacterId }
        : {}),
      expiresAt,
      createdAt,
    });
    if (created.state !== "creating") return created;

    const names = splitName(identity.profile?.name);
    const account = await input.funding.createDynamicVirtualAccount({
      txRef: created.txRef,
      amount: formatNgnKobo(created.amountKobo),
      email: identity.profile?.email?.trim().toLowerCase() || syntheticEmail(identity.userId),
      ...(identity.profile?.phone ? { phone: identity.profile.phone } : {}),
      ...names,
      expiresSeconds: fundingExpirySeconds,
      ...(signal ? { signal } : {}),
    });
    if (parseNgnKobo(account.amount) !== created.amountKobo) {
      throw new Error("financial.wallet.virtual_account_amount_mismatch");
    }
    return input.wallet.bindFundingAccount({
      tenantId: identity.tenantId,
      userId: identity.userId,
      fundingReference: created.fundingReference,
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      providerOrderRef: account.orderRef,
      providerReference: account.providerReference,
      providerExpiry: account.expiryDate,
      boundAt: new Date().toISOString(),
    });
  }

  async function syncTwinFundingMonetization(
    funding: NgnFundingIntent,
  ): Promise<void> {
    const origin = funding.originatingCharacterId?.trim() ?? "";
    const monetization = input.twinMonetization;
    if (
      !monetization ||
      !origin ||
      funding.quoteId !== null ||
      funding.state !== "credited"
    ) {
      return;
    }
    const tenantId = parseCanonicalId("tenant", funding.tenantId);
    const userId = parseCanonicalId("user", funding.userId);
    const operationId = `funding:${funding.fundingReference}`;
    await monetization.attribute({
      tenantId,
      customerUserId: userId,
      characterId: parseCanonicalId("character", origin),
      eventType: "external-funding",
      operationId,
    });
    await monetization.settleProviderValue({
      tenantId,
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "external-funding",
      operationId,
      sourceUnits: funding.amountKobo,
    });
  }

  async function purchaseQuote(
    identity: Pick<BillingCustomerIdentity, "tenantId" | "userId">,
    quote: BillingQuote,
    signal?: AbortSignal,
  ): Promise<BillingFulfillmentRecord> {
    return input.billing.purchaseOwned({
      tenantId: identity.tenantId,
      userId: identity.userId,
      requestId: `bill-${quote.quoteId}-r${quote.revision}`.slice(0, 128),
      quoteId: quote.quoteId,
      quoteRevision: quote.revision,
      ...(quote.categoryCode ? { categoryCode: quote.categoryCode } : {}),
      billerCode: quote.billerCode,
      itemCode: quote.itemCode,
      itemName: quote.itemName,
      customerId: quote.customerId,
      amount: formatNgnKobo(quote.serviceAmountKobo),
      ...(signal ? { signal } : {}),
    });
  }

  async function confirmedQuote(
    identity: BillingCustomerIdentity,
    rawQuoteId: string,
    revision: number,
  ): Promise<BillingQuote> {
    let quote = await input.quotes.readQuote({
      tenantId: identity.tenantId,
      userId: identity.userId,
      quoteId: rawQuoteId as BillingQuote["quoteId"],
    });
    if (!quote) throw new Error("financial.billing.quote_not_found");
    requireDataBundleCategory(quote.categoryCode ?? "");
    if (quote.revision !== revision) throw new Error("financial.billing.quote_revision_conflict");
    if (!quote.confirmedAt) {
      quote = await input.quotes.confirmQuote({
        tenantId: identity.tenantId,
        userId: identity.userId,
        quoteId: quote.quoteId,
        quoteRevision: revision,
        confirmedAt: new Date().toISOString(),
      });
    }
    return quote;
  }

  async function resumeCreditedBill(funding: NgnFundingIntent): Promise<boolean> {
    if (funding.state !== "credited" || !funding.quoteId) return false;
    const identity = {
      tenantId: parseCanonicalId("tenant", funding.tenantId),
      userId: parseCanonicalId("user", funding.userId),
    };
    const quote = await input.quotes.readQuote({
      ...identity,
      quoteId: funding.quoteId as BillingQuote["quoteId"],
    });
    // A duplicate provider callback is also a recovery opportunity: the
    // process may have crashed after durable credit but before bill dispatch.
    // Only resume owner-bound, explicitly confirmed quotes. The canonical
    // purchase authority retains the immutable fulfillment reference and
    // handles provider uncertainty/idempotency; do not dispatch separately.
    if (!quote || !quote.confirmedAt ||
        !["confirmed", "reserved"].includes(quote.state)) {
      return false;
    }
    // A late bank transfer is still credited to the native wallet, but must
    // never silently purchase using expired economic terms. An already
    // reserved operation can reconcile against its original authorization.
    // Recover previously reserved legacy purchases, never dispatch a newly
    // confirmed non-data service after the data-only launch cutover.
    if (quote.state === "confirmed" && !isDataBundleCategory(quote.categoryCode ?? "")) {
      return false;
    }
    if (quote.state === "confirmed" &&
        (!Number.isFinite(Date.parse(quote.expiresAt)) ||
          Date.parse(quote.expiresAt) <= Date.now())) {
      return false;
    }
    await purchaseQuote(identity, quote);
    return true;
  }

  return Object.freeze<BillingWalletService>({
    async balance(request) {
      const identity = await owner(request.authorizationHeader);
      const balanceKobo = await currentBalance(identity);
      return Object.freeze({ balanceKobo, balance: formatNgnKobo(balanceKobo) });
    },

    async createFunding(request) {
      const identity = await owner(request.authorizationHeader);
      const amountKobo = parseNgnKobo(request.amount);
      const funding = await createAccount(
        identity,
        amountKobo,
        null,
        request.originatingCharacterId ?? null,
        request.signal,
      );
      const balanceKobo = await currentBalance(identity);
      return Object.freeze({
        balanceKobo,
        balance: formatNgnKobo(balanceKobo),
        phase: "awaiting-funds" as const,
        quoteId: null,
        funding,
        purchase: null,
        document: walletDocument(balanceKobo, "awaiting-funds", funding, null, null),
      });
    },

    async confirmAndPurchase(request) {
      const identity = await owner(request.authorizationHeader);
      const quote = await confirmedQuote(identity, request.quoteId, request.quoteRevision);
      const balanceKobo = await currentBalance(identity);
      if (balanceKobo < quote.totalAmountKobo) {
        const shortfall = quote.totalAmountKobo - balanceKobo;
        const funding = await createAccount(
          identity,
          shortfall,
          quote.quoteId,
          null,
          request.signal,
        );
        return Object.freeze({
          balanceKobo,
          balance: formatNgnKobo(balanceKobo),
          phase: "awaiting-funds" as const,
          quoteId: quote.quoteId,
          funding,
          purchase: null,
          document: walletDocument(balanceKobo, "awaiting-funds", funding, quote, null),
        });
      }

      const purchase = await purchaseQuote(identity, quote, request.signal);
      const nextBalance = await currentBalance(identity);
      const phase =
        purchase.state === "succeeded"
          ? "fulfilled"
          : purchase.state === "failed" || purchase.state === "reversed"
            ? "failed"
            : "processing";
      return Object.freeze({
        balanceKobo: nextBalance,
        balance: formatNgnKobo(nextBalance),
        phase,
        quoteId: quote.quoteId,
        funding: null,
        purchase,
        document: walletDocument(nextBalance, phase, null, quote, purchase),
      });
    },

    async receiveFundingWebhook(request) {
      const evidence = verifyFlutterwaveV3Webhook({
        rawBody: request.rawBody,
        verifHash: request.verifHash,
        expectedSecretHash: webhookSecretHash,
      });
      const referenceTx = webhookTxRef(evidence.payload);
      if (!referenceTx) {
        return Object.freeze({ handled: false, duplicate: false, resumed: false });
      }
      const funding = await input.wallet.readFundingIntentByTxRef({ txRef: referenceTx });
      if (!funding) {
        return Object.freeze({ handled: false, duplicate: false, resumed: false });
      }
      if (funding.state === "credited") {
        await syncTwinFundingMonetization(funding).catch(() => undefined);
        const resumed = await resumeCreditedBill(funding);
        return Object.freeze({ handled: true, duplicate: true, resumed });
      }
      const payment = await input.funding.verifyByReference(referenceTx);
      if (!["successful","success","completed"].includes(payment.status) ||
          payment.currency !== "NGN" ||
          parseNgnKobo(payment.amount) !== funding.amountKobo) {
        throw new Error("financial.wallet.funding_payment_not_verified");
      }
      const credited = await input.wallet.creditFunding({
        fundingReference: funding.fundingReference,
        txRef: funding.txRef,
        providerTransactionId: payment.transactionId,
        providerReference: payment.providerReference,
        amountKobo: funding.amountKobo,
        creditedAt: new Date().toISOString(),
      });

      await syncTwinFundingMonetization(credited).catch(() => undefined);

      const resumed = await resumeCreditedBill(credited);
      return Object.freeze({ handled: true, duplicate: false, resumed });
    },
  });
}
