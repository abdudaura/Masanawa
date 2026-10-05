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
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { BillingFinancialService } from "./financial_billing.js";

export interface CustomerSessionAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
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
    case "checkout-created":
      return 2;
    case "funded":
      return 3;
    case "reserved":
      return 4;
    case "succeeded":
      return 5;
    // A later provider reversal can move an already-succeeded bill into refund
    // custody. That must advance the presentation revision rather than replace
    // the successful document at the same revision.
    case "refund-pending":
      return 6;
    case "refund-dispatching":
      return 7;
    case "refund-submitted":
      return 8;
    case "refunded":
      return 9;
    case "expired":
      return 10;
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
    const action = "billing.checkout.start";
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
          text: "You will pay securely on Flutterwave before Masanawa sends this bill.",
        },
        ...(requireEmail ? [{
          type: "input",
          id: "checkoutEmail",
          text: "Email for secure payment",
          subtitle: "Flutterwave requires an email for hosted checkout.",
          inputKind: "email",
          required: true,
        }] : []),
        {
          type: "button",
          id: "confirm-payment",
          text: `Confirm & pay ${money(quote.totalAmountKobo)}`,
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
    quote.state === "refund-dispatching" || quote.state === "refund-submitted"
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
  now?: () => string;
}>): BillingCheckoutService {
  const now = input.now ?? (() => new Date().toISOString());
  const quoteTtlSeconds = input.quoteTtlSeconds ?? 15 * 60;
  const feeBasisPoints = input.feeBasisPoints ?? 0;
  const feeFixedKobo = input.feeFixedKobo ?? 0;
  const redirect = new URL(input.redirectUrl);
  if (redirect.protocol !== "https:") throw new TypeError("billing redirect URL must use HTTPS");
  if (input.actionSecret.length < 32) throw new TypeError("billing action secret too short");

  async function identity(header: string | undefined): Promise<PlatformSessionIdentity> {
    return input.sessions.authorize({ authorizationHeader: header });
  }

  async function ownedQuote(
    header: string | undefined,
    rawQuoteId: string,
  ): Promise<Readonly<{ identity: PlatformSessionIdentity; quote: BillingQuote }>> {
    const owner = await identity(header);
    const quote = await input.quotes.readQuote({
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: rawQuoteId as BillingQuote["quoteId"],
    });
    if (!quote) throw new Error("financial.billing.quote_not_found");
    return Object.freeze({ identity: owner, quote });
  }

  async function refundIfRequired(
    owner: Pick<PlatformSessionIdentity, "tenantId" | "userId">,
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
        if (terminalRefund(existing.status)) {
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
      if (terminalRefund(receipt.status)) {
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
    if (!receipt || !terminalRefund(receipt.status)) return quote;
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
    owner: Pick<PlatformSessionIdentity, "tenantId" | "userId">,
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
    owner?: PlatformSessionIdentity,
  ): BillingCheckoutView {
    return Object.freeze({
      quote,
      phase: quotePhase(quote),
      checkoutUrl: quote.checkoutUrl,
      purchase,
      document: documentFor(
        quote,
        input.actionSecret,
        owner?.profile.email == null,
        purchase,
      ),
    });
  }

  const service: BillingCheckoutService = {
    async createQuote(request) {
      const owner = await identity(request.authorizationHeader);
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
      if (owned.quote.revision !== request.quoteRevision) throw new Error("financial.billing.quote_revision_conflict");
      if (owned.quote.checkoutUrl && owned.quote.checkoutTxRef) return view(owned.quote,null,owned.identity);
      const confirmed = await input.quotes.confirmQuote({
        tenantId: owned.identity.tenantId,
        userId: owned.identity.userId,
        quoteId: owned.quote.quoteId,
        quoteRevision: request.quoteRevision,
        confirmedAt: now(),
      });
      const email = (request.checkoutEmail ?? owned.identity.profile.email ?? "").trim().toLowerCase();
      if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
        throw new Error("financial.billing.email_required_for_checkout");
      }
      const checkout = await input.funding.createCheckout({
        txRef: txRef(confirmed),
        amount: formatNgnKobo(confirmed.totalAmountKobo),
        redirectUrl: redirect.toString(),
        customer: {
          email,
          name: owned.identity.profile.name,
          ...(owned.identity.profile.phone ? { phone: owned.identity.profile.phone } : {}),
        },
        ...(request.signal ? { signal: request.signal } : {}),
      });
      const bound = await input.quotes.bindCheckout({
        tenantId: owned.identity.tenantId,
        userId: owned.identity.userId,
        quoteId: confirmed.quoteId,
        quoteRevision: confirmed.revision,
        txRef: checkout.txRef,
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
        return view(refunded);
      }
      if (quote.state === "refunded" || quote.state === "succeeded") return view(quote);

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
      return view(quote,purchase);
    },

    async read(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.quoteId);
      const reconciled = await reconcileQuote(
        owned.identity,
        owned.quote,
        request.signal,
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
      const reconciled = await reconcileQuote(
        { tenantId: quote.tenantId, userId: quote.userId },
        quote,
        request.signal,
      );
      return reconciled.quote;
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
