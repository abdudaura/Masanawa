import { requireDataBundleCategory } from "./billing_data_policy.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingQuote, BillingQuoteRepository } from "@masanawa/commerce";
import {
  calculateBillingFeeKobo,
  createBillingQuote,
  formatNgnKobo,
  parseNgnKobo,
} from "@masanawa/commerce";
import {
  BillingCommerceError,
  FlutterwaveBillProviderError,
  FlutterwaveFundingClient,
  type BillingFulfillmentRecord,
  type FlutterwaveBillsClient,
} from "@masanawa/providers";
import type { BillingFinancialService } from "./financial_billing.js";

export interface BillingCustomerIdentity {
  readonly tenantId: import("@masanawa/contracts").TenantId;
  readonly userId: import("@masanawa/contracts").UserId;
  readonly profile?: Readonly<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
}

export interface CustomerSessionAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<BillingCustomerIdentity>;
}

export interface BillingCheckoutView {
  readonly quote: BillingQuote;
  readonly phase: "quoted" | "checkout" | "paid" | "processing" | "fulfilled" | "failed" | "refunded";
  readonly checkoutUrl: string | null;
  readonly purchase: BillingFulfillmentRecord | null;
  readonly document: unknown;
}

function decimalCompare(left: string, right: string): number {
  const split = (value: string): readonly [bigint, number] => {
    const [whole = "0", fraction = ""] = value.split(".");
    return [BigInt(whole + fraction), fraction.length] as const;
  };
  const [l, ls] = split(left);
  const [r, rs] = split(right);
  const scale = Math.max(ls, rs);
  const lv = l * 10n ** BigInt(scale - ls);
  const rv = r * 10n ** BigInt(scale - rs);
  return lv < rv ? -1 : lv > rv ? 1 : 0;
}

function quotePhase(quote: BillingQuote): BillingCheckoutView["phase"] {
  switch (quote.state) {
    case "quoted":
    case "confirmed":
      return "quoted";
    case "checkout-dispatching":
      return "processing";
    case "checkout-created":
      return "checkout";
    case "funded":
      return "paid";
    case "reserved":
      return "processing";
    case "succeeded":
      return "fulfilled";
    case "refund-pending":
      return "failed";
    case "refund-dispatching":
    case "refund-submitted":
      return "processing";
    case "refunded":
      return "refunded";
    case "expired":
      return "failed";
  }
}

function money(kobo: number): string {
  return `₦${formatNgnKobo(kobo)}`;
}

function shellActionExpiry(quote: BillingQuote, action: string): string {
  if (action === "billing.checkout.start") return quote.expiresAt;
  if (action === "billing.checkout.verify") {
    // Hosted checkout may legitimately outlive the short economic quote TTL.
    // Keep verification actionable for 24h after the checkout was bound; the
    // server still re-verifies exact payment and re-derives live bill terms.
    const grace = new Date(Date.parse(quote.updatedAt) + 24 * 60 * 60 * 1000).toISOString();
    return Date.parse(grace) > Date.parse(quote.expiresAt) ? grace : quote.expiresAt;
  }
  return quote.expiresAt;
}

function presentationRevision(quote: BillingQuote): number {
  // Presentation revisions are monotonic workflow stages. Economic quote
  // revision stays immutable and continues to bind money/action authority.
  switch (quote.state) {
    case "quoted":
    case "confirmed":
      return 1;
    case "checkout-dispatching":
      return 2;
    case "checkout-created":
      return 3;
    case "funded":
      return 4;
    case "reserved":
      return 5;
    case "succeeded":
      return 6;
    // A later provider reversal can move an already-succeeded bill into refund
    // custody. That must advance the presentation revision rather than replace
    // the successful document at the same revision.
    case "refund-pending":
      return 7;
    case "refund-dispatching":
      return 8;
    case "refund-submitted":
      return 9;
    case "refunded":
      return 10;
    case "expired":
      return 11;
  }
}

function documentFor(
  quote: BillingQuote,
  actionSecret: string,
  requireEmail = false,
  purchase: BillingFulfillmentRecord | null = null,
): unknown {
  const phase = quotePhase(quote);
  const documentId = `billing:${quote.quoteId}`;
  const base = [
    { type: "heading", text: quote.itemName },
    { type: "detail", text: "Recipient", value: quote.customerId },
    { type: "detail", text: "Service", value: money(quote.serviceAmountKobo) },
    { type: "detail", text: "Fee", value: money(quote.feeAmountKobo) },
    { type: "metric", text: "Total", value: money(quote.totalAmountKobo), subtitle: "NGN" },
  ];
  if (phase === "quoted") {
    const action = "billing.wallet.confirm";
    const actionExpiry = shellActionExpiry(quote,action);
    return Object.freeze({
      version: 1,
      id: documentId,
      revision: presentationRevision(quote),
      expiresAt: actionExpiry,
      fallback: `Confirm ${quote.itemName} for ${money(quote.totalAmountKobo)}.`,
      nodes: [
        ...base,
        {
          type: "notice",
          tone: "warning",
          text: "This purchase will be paid from your Masanawa wallet. If your balance is short, Masanawa will create a temporary bank account for only the missing amount.",
        },
        {
          type: "button",
          id: "confirm-payment",
          text: `Confirm purchase ${money(quote.totalAmountKobo)}`,
          action,
          token: mintBillingActionToken({
            secret: actionSecret,
            quote,
            action,
            expiresAt: actionExpiry,
          }),
        },
      ],
    });
  }
  const statusText =
    quote.state === "checkout-dispatching"
      ? "Secure checkout creation is being reconciled. Masanawa will not create a second checkout while the first attempt is uncertain."
      : quote.state === "refund-dispatching" || quote.state === "refund-submitted"
        ? "The bill could not be completed. Your refund is being reconciled with Flutterwave."
        : phase === "checkout"
        ? "Secure checkout created. Open the payment link, complete payment, then choose Verify payment."
        : phase === "paid" || phase === "processing"
          ? "Payment verified. Masanawa is completing your bill."
          : phase === "fulfilled"
            ? "Bill completed successfully."
            : phase === "refunded"
              ? "The bill could not be completed. Your verified payment was refunded."
              : "This bill needs attention.";
  const nodes: unknown[] = [
    ...base,
    { type: "notice", tone: phase === "fulfilled" ? "success" : phase === "refunded" ? "warning" : "info", text: statusText },
    ...(phase === "checkout" && quote.checkoutUrl
      ? [{ type: "detail", text: "Secure payment link", value: quote.checkoutUrl }]
      : []),
    ...(purchase?.providerReference
      ? [{ type: "detail", text: "Provider reference", value: purchase.providerReference }]
      : []),
    ...(purchase?.deliveryCode
      ? [{ type: "detail", text: "Token / code", value: purchase.deliveryCode }]
      : []),
    ...(purchase?.state === "manual_review"
      ? [{
          type: "notice",
          tone: "warning",
          text: "Provider evidence needs reconciliation. Masanawa will not send another purchase while this is unresolved.",
        }]
      : []),
  ];
  if (phase === "checkout") {
    const action = "billing.checkout.verify";
    const actionExpiry = shellActionExpiry(quote,action);
    nodes.push({
      type: "button",
      id: "verify-payment",
      text: "Verify payment",
      action,
      token: mintBillingActionToken({
        secret: actionSecret,
        quote,
        action,
        expiresAt: actionExpiry,
      }),
    });
  }
  return Object.freeze({
    version: 1,
    id: documentId,
    revision: presentationRevision(quote),
    ...(phase === "checkout"
      ? { expiresAt: shellActionExpiry(quote,"billing.checkout.verify") }
      : {}),
    fallback: statusText,
    nodes,
  });
}

function tokenPayload(input: Readonly<{
  quote: BillingQuote;
  action: string;
  expiresAt: string;
}>): string {
  return [
    "billing-v1",
    input.quote.tenantId,
    input.quote.userId,
    input.quote.quoteId,
    String(input.quote.revision),
    input.action,
    input.expiresAt,
  ].join("\0");
}

export function mintBillingActionToken(input: Readonly<{
  secret: string;
  quote: BillingQuote;
  action: string;
  expiresAt: string;
}>): string {
  if (input.secret.length < 32) throw new TypeError("billing action secret too short");
  const mac = createHmac("sha256", input.secret)
    .update(tokenPayload(input), "utf8")
    .digest("base64url");
  return `bact1.${mac}`;
}

function verifyBillingActionToken(input: Readonly<{
  secret: string;
  quote: BillingQuote;
  action: string;
  token: string;
  at: string;
}>): void {
  const expiresAt = shellActionExpiry(input.quote,input.action);
  if (Date.parse(expiresAt) <= Date.parse(input.at)) {
    throw new Error("financial.billing.action_expired");
  }
  const expected = mintBillingActionToken({
    secret: input.secret,
    quote: input.quote,
    action: input.action,
    expiresAt,
  });
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(input.token, "utf8");
  if (left.length !== right.length || !timingSafeEqual(left,right)) {
    throw new Error("financial.billing.action_token_invalid");
  }
}

function txRef(quote: BillingQuote): string {
  return `bill-${quote.quoteId}-r${quote.revision}`.slice(0,128);
}

function definitivePreDispatchFailure(error: unknown): boolean {
  if (error instanceof BillingCommerceError) return !error.retryable;
  if (error instanceof FlutterwaveBillProviderError) {
    return !error.retryable && !error.outcomeUnknown;
  }
  const message = error instanceof Error ? error.message : "";
  return (
    message.startsWith("financial.billing.catalog_") ||
    message === "financial.billing.phone_invalid" ||
    message === "financial.billing.recipient_invalid" ||
    message === "financial.billing.amount_below_minimum" ||
    message === "financial.billing.amount_above_maximum" ||
    message === "financial.billing.quote_terms_mismatch"
  );
}

export interface BillingCheckoutService {
  createQuote(request: Readonly<{
    authorizationHeader: string | undefined;
    categoryCode: string;
    billerCode: string;
    itemCode: string;
    customerId: string;
    amount: string;
    originatingCharacterId?: string;
    signal?: AbortSignal;
  }>): Promise<BillingCheckoutView>;
  startCheckout(request: Readonly<{
    authorizationHeader: string | undefined;
    quoteId: string;
    quoteRevision: number;
    checkoutEmail?: string;
    signal?: AbortSignal;
  }>): Promise<BillingCheckoutView>;
  verifyAndPurchase(request: Readonly<{
    authorizationHeader: string | undefined;
    quoteId: string;
    quoteRevision: number;
    signal?: AbortSignal;
  }>): Promise<BillingCheckoutView>;
  read(request: Readonly<{
    authorizationHeader: string | undefined;
    quoteId: string;
    signal?: AbortSignal;
  }>): Promise<BillingCheckoutView>;
  list(request: Readonly<{
    authorizationHeader: string | undefined;
    limit?: number;
  }>): Promise<readonly BillingCheckoutView[]>;
  /** Verified-webhook/internal status reconciliation by globally unique fulfillment reference. */
  reconcileFulfillment(request: Readonly<{
    reference: string;
    signal?: AbortSignal;
  }>): Promise<BillingQuote | null>;
  verifyWalletConfirmAction(request: Readonly<{
    authorizationHeader: string | undefined;
    documentId: string;
    revision: number;
    actionId: string;
    token: string;
  }>): Promise<Readonly<{ quoteId: string; quoteRevision: number }>>;
  executeShellAction(request: Readonly<{
    authorizationHeader: string | undefined;
    documentId: string;
    revision: number;
    actionId: string;
    token: string;
    values?: Readonly<Record<string, string>>;
  }>): Promise<Readonly<{
    accepted: true;
    phase: string;
    document: unknown;
    message?: string;
  }>>;
}

export function createBillingCheckoutService(input: Readonly<{
  sessions: CustomerSessionAuthorizer;
  quotes: BillingQuoteRepository;
  catalog: FlutterwaveBillsClient;
  funding: FlutterwaveFundingClient;
  billing: BillingFinancialService;
  actionSecret: string;
  redirectUrl: string;
  feeBasisPoints?: number;
  feeFixedKobo?: number;
  quoteTtlSeconds?: number;
  twinMonetization?: {
    attribute(input: {
      readonly tenantId: import("@masanawa/contracts").TenantId;
      readonly customerUserId: import("@masanawa/contracts").UserId;
      readonly characterId: import("@masanawa/contracts").CharacterId | null;
      readonly eventType: "commerce-purchase";
      readonly operationId: string;
    }): Promise<void>;
    settleProviderValue(input: {
      readonly tenantId: import("@masanawa/contracts").TenantId;
      readonly valuationKey: string;
      readonly eventType: "commerce-purchase";
      readonly operationId: string;
      readonly sourceUnits: number;
    }): Promise<unknown>;
    reverseFull(input: {
      readonly tenantId: import("@masanawa/contracts").TenantId;
      readonly operationId: string;
      readonly reversalId: string;
    }): Promise<void>;
  };
  now?: () => string;
}>): BillingCheckoutService {
  const now = input.now ?? (() => new Date().toISOString());
  const quoteTtlSeconds = input.quoteTtlSeconds ?? 15 * 60;
  const feeBasisPoints = input.feeBasisPoints ?? 0;
  const feeFixedKobo = input.feeFixedKobo ?? 0;
  const redirect = new URL(input.redirectUrl);
  if (redirect.protocol !== "https:") throw new TypeError("billing redirect URL must use HTTPS");
  if (input.actionSecret.length < 32) throw new TypeError("billing action secret too short");

  async function identity(header: string | undefined): Promise<BillingCustomerIdentity> {
    return input.sessions.authorize({ authorizationHeader: header });
  }

  async function ownedQuote(
    header: string | undefined,
    rawQuoteId: string,
  ): Promise<Readonly<{ identity: BillingCustomerIdentity; quote: BillingQuote }>> {
    const owner = await identity(header);
    const quote = await input.quotes.readQuote({
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: rawQuoteId as BillingQuote["quoteId"],
    });
    if (!quote) throw new Error("financial.billing.quote_not_found");
    return Object.freeze({ identity: owner, quote });
  }

  async function syncTwinMonetization(
    owner: Pick<BillingCustomerIdentity, "tenantId" | "userId">,
    quote: BillingQuote,
  ): Promise<void> {
    const origin = quote.originatingCharacterId?.trim() ?? "";
    const monetization = input.twinMonetization;
    if (!monetization || !origin) return;
    const operationId = `billing:${quote.quoteId}`;

    if (quote.state === "succeeded") {
      await monetization.attribute({
        tenantId: owner.tenantId,
        customerUserId: owner.userId,
        characterId: origin as import("@masanawa/contracts").CharacterId,
        eventType: "commerce-purchase",
        operationId,
      });
      await monetization.settleProviderValue({
        tenantId: owner.tenantId,
        valuationKey: "flutterwave:NGN:kobo",
        eventType: "commerce-purchase",
        operationId,
        sourceUnits: quote.serviceAmountKobo,
      });
      return;
    }

    if (quote.state === "refunded") {
      await monetization.reverseFull({
        tenantId: owner.tenantId,
        operationId,
        reversalId: `billing-refund:${quote.quoteId}`,
      });
    }
  }

  async function refundIfRequired(
    owner: Pick<BillingCustomerIdentity, "tenantId" | "userId">,
    quote: BillingQuote,
    signal?: AbortSignal,
  ): Promise<BillingQuote> {
    if (!["refund-pending","refund-dispatching","refund-submitted"].includes(quote.state)) {
      return quote;
    }
    const providerTransactionId = quote.providerTransactionId;
    if (!providerTransactionId) {
      throw new Error("financial.billing.refund_evidence_missing");
    }

    const terminalRefund = (status: string) =>
      ["successful","completed-bank-transfer","completed-momo","completed-mpgs",
       "completed-offline","completed-preauth"].includes(status);
    const fullyRefunded = (receipt: Readonly<{ status: string; amount: string | null }>) => {
      if (!terminalRefund(receipt.status) || receipt.amount === null) return false;
      try {
        return parseNgnKobo(receipt.amount) === quote.totalAmountKobo;
      } catch {
        return false;
      }
    };

    let newlyClaimed = false;
    if (quote.state === "refund-pending") {
      const claim = await input.quotes.claimRefundDispatch({
        tenantId: owner.tenantId,
        userId: owner.userId,
        quoteId: quote.quoteId,
        providerTransactionId,
        claimedAt: now(),
      });
      quote = claim.quote;
      newlyClaimed = claim.claimed;
    }

    if (quote.state === "refund-dispatching") {
      // A pre-existing dispatching state means an earlier POST may already have
      // reached Flutterwave. Such calls are reconciliation-only forever; an
      // empty/lagging refund list is not proof that another POST is safe.
      if (!newlyClaimed) {
        const existing = await input.funding.findRefund({
          transactionId: providerTransactionId,
          ...(signal ? { signal } : {}),
        });
        if (!existing) return quote;
        quote = await input.quotes.recordRefundInitiated({
          tenantId: owner.tenantId,
          userId: owner.userId,
          quoteId: quote.quoteId,
          providerTransactionId,
          refundReference: existing.refundReference,
          initiatedAt: now(),
        });
        if (fullyRefunded(existing)) {
          return input.quotes.markRefunded({
            tenantId: owner.tenantId,
            userId: owner.userId,
            quoteId: quote.quoteId,
            providerTransactionId,
            refundReference: existing.refundReference,
            refundedAt: now(),
          });
        }
        return quote;
      }

      // Only the caller that atomically claimed refund-pending may issue the
      // external refund request.
      const receipt = await input.funding.refund({
        transactionId: providerTransactionId,
        amount: formatNgnKobo(quote.totalAmountKobo),
        ...(signal ? { signal } : {}),
      });
      quote = await input.quotes.recordRefundInitiated({
        tenantId: owner.tenantId,
        userId: owner.userId,
        quoteId: quote.quoteId,
        providerTransactionId,
        refundReference: receipt.refundReference,
        initiatedAt: now(),
      });
      if (fullyRefunded(receipt)) {
        return input.quotes.markRefunded({
          tenantId: owner.tenantId,
          userId: owner.userId,
          quoteId: quote.quoteId,
          providerTransactionId,
          refundReference: receipt.refundReference,
          refundedAt: now(),
        });
      }
      return quote;
    }

    const receipt = await input.funding.findRefund({
      transactionId: providerTransactionId,
      ...(quote.refundReference ? { refundReference: quote.refundReference } : {}),
      ...(signal ? { signal } : {}),
    });
    if (!receipt || !fullyRefunded(receipt)) return quote;
    const refundReference = quote.refundReference ?? receipt.refundReference;
    if (!refundReference) {
      throw new Error("financial.billing.refund_evidence_missing");
    }
    return input.quotes.markRefunded({
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: quote.quoteId,
      providerTransactionId,
      refundReference,
      refundedAt: now(),
    });
  }

  async function reconcileQuote(
    owner: Pick<BillingCustomerIdentity, "tenantId" | "userId">,
    quote: BillingQuote,
    signal?: AbortSignal,
  ): Promise<Readonly<{
    quote: BillingQuote;
    purchase: BillingFulfillmentRecord | null;
  }>> {
    let current = quote;
    let purchase: BillingFulfillmentRecord | null = null;
    if (
      current.fulfillmentReference &&
      (current.state === "reserved" || current.state === "succeeded")
    ) {
      purchase = await input.billing.reconcileOwnedPurchase({
        tenantId: owner.tenantId,
        userId: owner.userId,
        reference: current.fulfillmentReference,
        ...(signal ? { signal } : {}),
      });
      const refreshed = await input.quotes.readQuote({
        tenantId: owner.tenantId,
        userId: owner.userId,
        quoteId: current.quoteId,
      });
      if (!refreshed) throw new Error("financial.billing.quote_not_found");
      current = refreshed;
    }
    current = await refundIfRequired(owner,current,signal);
    return Object.freeze({ quote: current, purchase });
  }

  function view(
    quote: BillingQuote,
    purchase: BillingFulfillmentRecord | null = null,
    owner?: BillingCustomerIdentity,
  ): BillingCheckoutView {
    return Object.freeze({
      quote,
      phase: quotePhase(quote),
      checkoutUrl: quote.checkoutUrl,
      purchase,
      document: documentFor(
        quote,
        input.actionSecret,
        !owner?.profile?.email,
        purchase,
      ),
    });
  }

  const service: BillingCheckoutService = {
    async createQuote(request) {
      const owner = await identity(request.authorizationHeader);
      requireDataBundleCategory(request.categoryCode);
      const categories = await input.catalog.listCategories(request.signal);
      const category = categories.find((entry) => entry.code === request.categoryCode);
      if (!category) throw new Error("financial.billing.catalog_category_unavailable");
      const billers = await input.catalog.listBillers(category.code,request.signal);
      if (!billers.some((entry) => entry.billerCode === request.billerCode)) {
        throw new Error("financial.billing.catalog_biller_unavailable");
      }
      const items = await input.catalog.listItems(request.billerCode,request.signal);
      const item = items.find((entry) => entry.itemCode === request.itemCode);
      if (!item || item.billerCode !== request.billerCode || item.currency !== "NGN") {
        throw new Error("financial.billing.catalog_item_unavailable");
      }
      const requestedAmountKobo = parseNgnKobo(request.amount);
      const catalogAmountKobo = parseNgnKobo(item.amount);
      const variable = catalogAmountKobo === 0;
      if (!variable && requestedAmountKobo !== catalogAmountKobo) {
        throw new Error("financial.billing.catalog_amount_mismatch");
      }

      if (category.code === "AIRTIME" || category.code === "MOBILEDATA") {
        if (!/^(?:0[789]\d{9}|\+?234[789]\d{9})$/u.test(request.customerId.trim())) {
          throw new Error("financial.billing.phone_invalid");
        }
      } else {
        const validation = await input.catalog.validateCustomer(item.itemCode,request.customerId,request.signal);
        if (!validation.valid || validation.customer !== request.customerId ||
            validation.billerCode !== request.billerCode) {
          throw new Error("financial.billing.recipient_invalid");
        }
        if (validation.minimum !== null && decimalCompare(request.amount,validation.minimum) < 0) {
          throw new Error("financial.billing.amount_below_minimum");
        }
        if (validation.maximum !== null && parseNgnKobo(validation.maximum) > 0 &&
            decimalCompare(request.amount,validation.maximum) > 0) {
          throw new Error("financial.billing.amount_above_maximum");
        }
      }

      const createdAt = now();
      const quote = createBillingQuote({
        tenantId: owner.tenantId,
        userId: owner.userId,
        categoryCode: category.code,
        ...(request.originatingCharacterId
          ? { originatingCharacterId: request.originatingCharacterId }
          : {}),
        billerCode: item.billerCode,
        itemCode: item.itemCode,
        itemName: item.name,
        customerId: request.customerId,
        serviceAmountKobo: requestedAmountKobo,
        feeAmountKobo: calculateBillingFeeKobo(requestedAmountKobo,{
          basisPoints: feeBasisPoints,
          fixedKobo: feeFixedKobo,
        }),
        createdAt,
        expiresAt: new Date(Date.parse(createdAt) + quoteTtlSeconds * 1000).toISOString(),
      });
      return view(await input.quotes.createQuote(quote),null,owner);
    },

    async startCheckout(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.quoteId);
      // Existing paid legacy purchases can still be reconciled via verify/read,
      // but an unstarted non-data quote must not open a NEW checkout.
      requireDataBundleCategory(owned.quote.categoryCode);
      if (owned.quote.revision !== request.quoteRevision) {
        throw new Error("financial.billing.quote_revision_conflict");
      }
      if (owned.quote.checkoutUrl && owned.quote.checkoutTxRef) {
        return view(owned.quote,null,owned.identity);
      }
      if (owned.quote.state === "checkout-dispatching") {
        throw new Error("financial.billing.checkout_creation_in_progress");
      }

      const confirmedAt = now();
      const confirmed = await input.quotes.confirmQuote({
        tenantId: owned.identity.tenantId,
        userId: owned.identity.userId,
        quoteId: owned.quote.quoteId,
        quoteRevision: request.quoteRevision,
        confirmedAt,
      });
      const email = (request.checkoutEmail ?? owned.identity.profile?.email ?? "")
        .trim()
        .toLowerCase();
      if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
        throw new Error("financial.billing.email_required_for_checkout");
      }

      const checkoutTxRef = txRef(confirmed);
      const claim = await input.quotes.claimCheckoutDispatch({
        tenantId: owned.identity.tenantId,
        userId: owned.identity.userId,
        quoteId: confirmed.quoteId,
        quoteRevision: confirmed.revision,
        txRef: checkoutTxRef,
        claimedAt: now(),
      });
      if (!claim.claimed) {
        if (claim.quote.checkoutUrl) {
          return view(claim.quote,null,owned.identity);
        }
        throw new Error("financial.billing.checkout_creation_in_progress");
      }

      const checkout = await input.funding.createCheckout({
        txRef: checkoutTxRef,
        amount: formatNgnKobo(confirmed.totalAmountKobo),
        redirectUrl: redirect.toString(),
        customer: {
          email,
          name: owned.identity.profile?.name?.trim() || "Masanawa customer",
          ...(owned.identity.profile?.phone
            ? { phone: owned.identity.profile.phone }
            : {}),
        },
        ...(request.signal ? { signal: request.signal } : {}),
      });
      const bound = await input.quotes.bindCheckout({
        tenantId: owned.identity.tenantId,
        userId: owned.identity.userId,
        quoteId: confirmed.quoteId,
        quoteRevision: confirmed.revision,
        txRef: checkoutTxRef,
        checkoutUrl: checkout.checkoutUrl,
        boundAt: now(),
      });
      return view(bound,null,owned.identity);
    },

    async verifyAndPurchase(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.quoteId);
      if (owned.quote.revision !== request.quoteRevision) throw new Error("financial.billing.quote_revision_conflict");
      const checkoutTxRef = owned.quote.checkoutTxRef;
      if (!checkoutTxRef) throw new Error("financial.billing.checkout_not_created");

      let quote = owned.quote;
      if (!quote.paymentVerifiedAt) {
        const payment = await input.funding.verifyByReference(checkoutTxRef,request.signal);
        if (!["successful","success","completed"].includes(payment.status)) {
          throw new Error("financial.billing.payment_not_successful");
        }
        if (payment.currency !== "NGN" || parseNgnKobo(payment.amount) !== quote.totalAmountKobo) {
          throw new Error("financial.billing.payment_amount_mismatch");
        }
        quote = await input.quotes.recordVerifiedPayment({
          tenantId: owned.identity.tenantId,
          userId: owned.identity.userId,
          quoteId: quote.quoteId,
          quoteRevision: quote.revision,
          txRef: checkoutTxRef,
          providerTransactionId: payment.transactionId,
          providerReference: payment.providerReference,
          amountKobo: quote.totalAmountKobo,
          currency: "NGN",
          verifiedAt: now(),
        });
      }

      if (["refund-pending","refund-dispatching","refund-submitted"].includes(quote.state)) {
        const refunded = await refundIfRequired(owned.identity,quote,request.signal);
        await syncTwinMonetization(owned.identity, refunded).catch(
          () => undefined,
        );
        return view(refunded);
      }
      if (quote.state === "refunded" || quote.state === "succeeded") {
        await syncTwinMonetization(owned.identity, quote).catch(() => undefined);
        return view(quote);
      }

      const fulfillmentReference = `bill-${quote.quoteId}`.slice(0,128);
      let purchase: BillingFulfillmentRecord;
      try {
        purchase = await input.billing.purchase({
          authorizationHeader: request.authorizationHeader,
          requestId: fulfillmentReference,
          quoteId: quote.quoteId,
          quoteRevision: quote.revision,
          ...(quote.categoryCode ? { categoryCode: quote.categoryCode } : {}),
          billerCode: quote.billerCode,
          itemCode: quote.itemCode,
          itemName: quote.itemName,
          customerId: quote.customerId,
          amount: formatNgnKobo(quote.serviceAmountKobo),
          catalogAmount: formatNgnKobo(quote.serviceAmountKobo),
          ...(request.signal ? { signal: request.signal } : {}),
        });
      } catch (error) {
        if (error instanceof FlutterwaveBillProviderError &&
            error.code === "dispatch_rejected" && !error.outcomeUnknown) {
          await input.quotes.settleBill({
            tenantId: owned.identity.tenantId,
            userId: owned.identity.userId,
            fulfillmentReference,
            state: "failed",
            providerReference: null,
          });
          quote = (await input.quotes.readQuote({
            tenantId: owned.identity.tenantId,userId: owned.identity.userId,quoteId: quote.quoteId,
          }))!;
          quote = await refundIfRequired(owned.identity,quote,request.signal);
          await syncTwinMonetization(owned.identity, quote).catch(
            () => undefined,
          );
          return view(quote,null,owned.identity);
        }

        // Once customer payment is verified, a known non-retryable failure
        // before reserve/dispatch must release those exact funds into refund
        // custody. Transient catalog/provider failures remain funded so a safe
        // retry can continue without charging the customer again.
        const latest = await input.quotes.readQuote({
          tenantId: owned.identity.tenantId,
          userId: owned.identity.userId,
          quoteId: quote.quoteId,
        });
        if (latest?.state === "funded" && definitivePreDispatchFailure(error)) {
          quote = await input.quotes.requestFundedRefund({
            tenantId: owned.identity.tenantId,
            userId: owned.identity.userId,
            quoteId: latest.quoteId,
            quoteRevision: latest.revision,
            requestedAt: now(),
          });
          quote = await refundIfRequired(owned.identity,quote,request.signal);
          await syncTwinMonetization(owned.identity, quote).catch(
            () => undefined,
          );
          return view(quote,null,owned.identity);
        }
        throw error;
      }

      quote = (await input.quotes.readQuote({
        tenantId: owned.identity.tenantId,
        userId: owned.identity.userId,
        quoteId: quote.quoteId,
      }))!;
      quote = await refundIfRequired(owned.identity,quote,request.signal);
      await syncTwinMonetization(owned.identity, quote).catch(() => undefined);
      return view(quote,purchase);
    },

    async read(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.quoteId);
      const reconciled = await reconcileQuote(
        owned.identity,
        owned.quote,
        request.signal,
      );
      await syncTwinMonetization(owned.identity, reconciled.quote).catch(
        () => undefined,
      );
      return view(
        reconciled.quote,
        reconciled.purchase,
        owned.identity,
      );
    },

    async list(request) {
      const owner = await identity(request.authorizationHeader);
      const limit = request.limit ?? 50;
      const quotes = await input.quotes.listQuotes({
        tenantId: owner.tenantId,
        userId: owner.userId,
        limit,
      });
      return Object.freeze(
        quotes.map((quote) => view(quote,null,owner)),
      );
    },

    async reconcileFulfillment(request) {
      const quote = await input.quotes.readByFulfillmentReference({
        fulfillmentReference: request.reference,
      });
      if (!quote) return null;
      const identity = { tenantId: quote.tenantId, userId: quote.userId };
      const reconciled = await reconcileQuote(
        identity,
        quote,
        request.signal,
      );
      await syncTwinMonetization(identity, reconciled.quote).catch(
        () => undefined,
      );
      return reconciled.quote;
    },

    async verifyWalletConfirmAction(request) {
      if (request.actionId !== "billing.wallet.confirm") {
        throw new Error("financial.billing.shell_action_unavailable");
      }
      const owned = await ownedQuote(
        request.authorizationHeader,
        request.documentId.replace(/^billing:/u,""),
      );
      if (request.revision !== presentationRevision(owned.quote)) {
        throw new Error("financial.billing.shell_revision_conflict");
      }
      verifyBillingActionToken({
        secret: input.actionSecret,
        quote: owned.quote,
        action: request.actionId,
        token: request.token,
        at: now(),
      });
      return Object.freeze({
        quoteId: owned.quote.quoteId,
        quoteRevision: owned.quote.revision,
      });
    },

    async executeShellAction(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.documentId.replace(/^billing:/u,""));
      if (request.revision !== presentationRevision(owned.quote)) {
        throw new Error("financial.billing.shell_revision_conflict");
      }
      verifyBillingActionToken({
        secret: input.actionSecret,
        quote: owned.quote,
        action: request.actionId,
        token: request.token,
        at: now(),
      });
      const result = request.actionId === "billing.checkout.start"
        ? await service.startCheckout({
            authorizationHeader: request.authorizationHeader,
            quoteId: owned.quote.quoteId,
            quoteRevision: owned.quote.revision,
            ...(request.values?.checkoutEmail
              ? { checkoutEmail: request.values.checkoutEmail }
              : {}),
          })
        : request.actionId === "billing.checkout.verify"
          ? await service.verifyAndPurchase({
              authorizationHeader: request.authorizationHeader,
              quoteId: owned.quote.quoteId,
              quoteRevision: owned.quote.revision,
            })
          : (() => { throw new Error("financial.billing.shell_action_unavailable"); })();
      return Object.freeze({
        accepted: true as const,
        phase: result.phase === "fulfilled" ? "fulfilled" :
          result.phase === "refunded" ? "failed" :
          result.phase === "checkout" ? "submitted" : "processing",
        document: result.document,
        ...(result.checkoutUrl ? {
          message: `Secure checkout: ${result.checkoutUrl}`,
        } : {}),
      });
    },
  };
  return Object.freeze(service);
}
