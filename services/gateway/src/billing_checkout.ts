import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingQuote, BillingQuoteRepository } from "@masanawa/commerce";
import {
  calculateBillingFeeKobo,
  createBillingQuote,
  formatNgnKobo,
  parseNgnKobo,
} from "@masanawa/commerce";
import {
  FlutterwaveBillProviderError,
  FlutterwaveFundingClient,
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
  readonly purchase: unknown | null;
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

function documentFor(quote: BillingQuote, actionSecret: string): unknown {
  const phase = quotePhase(quote);
  const documentId = `billing:${quote.quoteId}`;
  const expiry = quote.expiresAt;
  const base = [
    { type: "heading", text: quote.itemName },
    { type: "detail", text: "Recipient", value: quote.customerId },
    { type: "detail", text: "Service", value: money(quote.serviceAmountKobo) },
    { type: "detail", text: "Fee", value: money(quote.feeAmountKobo) },
    { type: "metric", text: "Total", value: money(quote.totalAmountKobo), subtitle: "NGN" },
  ];
  if (phase === "quoted") {
    const action = "billing.checkout.start";
    return Object.freeze({
      version: 1,
      id: documentId,
      revision: quote.revision,
      expiresAt: expiry,
      fallback: `Confirm ${quote.itemName} for ${money(quote.totalAmountKobo)}.`,
      nodes: [
        ...base,
        {
          type: "notice",
          tone: "warning",
          text: "You will pay securely on Flutterwave before Masanawa sends this bill.",
        },
        {
          type: "button",
          id: "confirm-payment",
          text: `Confirm & pay ${money(quote.totalAmountKobo)}`,
          action,
          token: mintBillingActionToken({
            secret: actionSecret,
            quote,
            action,
            expiresAt: expiry,
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
  ];
  if (phase === "checkout") {
    const action = "billing.checkout.verify";
    nodes.push({
      type: "button",
      id: "verify-payment",
      text: "Verify payment",
      action,
      token: mintBillingActionToken({
        secret: actionSecret,
        quote,
        action,
        expiresAt: expiry,
      }),
    });
  }
  return Object.freeze({
    version: 1,
    id: documentId,
    revision: quote.revision + (phase === "quoted" ? 0 : 1),
    ...(phase === "checkout" ? { expiresAt: expiry } : {}),
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
  if (Date.parse(input.quote.expiresAt) <= Date.parse(input.at)) {
    throw new Error("financial.billing.quote_expired");
  }
  const expected = mintBillingActionToken({
    secret: input.secret,
    quote: input.quote,
    action: input.action,
    expiresAt: input.quote.expiresAt,
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
}>): Readonly<{
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
  }>): Promise<BillingCheckoutView>;
  executeShellAction(request: Readonly<{
    authorizationHeader: string | undefined;
    documentId: string;
    revision: number;
    actionId: string;
    token: string;
  }>): Promise<Readonly<{ accepted: true; phase: string; document: unknown; message?: string }>>;
}> {
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
    owner: PlatformSessionIdentity,
    quote: BillingQuote,
    signal?: AbortSignal,
  ): Promise<BillingQuote> {
    if (!["refund-pending","refund-dispatching","refund-submitted"].includes(quote.state)) {
      return quote;
    }
    if (!quote.providerTransactionId) {
      throw new Error("financial.billing.refund_evidence_missing");
    }

    const terminalRefund = (status: string) =>
      ["successful","completed-bank-transfer","completed-momo","completed-mpgs",
       "completed-offline","completed-preauth"].includes(status);

    if (quote.state === "refund-pending") {
      quote = await input.quotes.claimRefundDispatch({
        tenantId: owner.tenantId,
        userId: owner.userId,
        quoteId: quote.quoteId,
        providerTransactionId: quote.providerTransactionId,
        claimedAt: now(),
      });
    }

    if (quote.state === "refund-dispatching") {
      // Persist-before-send prevents an automatic duplicate refund if the POST
      // outcome is unknown. First reconcile any provider-side refund by the
      // original transaction ID.
      const existing = await input.funding.findRefund({
        transactionId: quote.providerTransactionId,
        ...(signal ? { signal } : {}),
      });
      if (existing) {
        quote = await input.quotes.recordRefundInitiated({
          tenantId: owner.tenantId,
          userId: owner.userId,
          quoteId: quote.quoteId,
          providerTransactionId: quote.providerTransactionId,
          refundReference: existing.refundReference,
          initiatedAt: now(),
        });
        if (terminalRefund(existing.status)) {
          return input.quotes.markRefunded({
            tenantId: owner.tenantId,
            userId: owner.userId,
            quoteId: quote.quoteId,
            providerTransactionId: quote.providerTransactionId,
            refundReference: existing.refundReference,
            refundedAt: now(),
          });
        }
        return quote;
      }

      const receipt = await input.funding.refund({
        transactionId: quote.providerTransactionId,
        amount: formatNgnKobo(quote.totalAmountKobo),
        ...(signal ? { signal } : {}),
      });
      quote = await input.quotes.recordRefundInitiated({
        tenantId: owner.tenantId,
        userId: owner.userId,
        quoteId: quote.quoteId,
        providerTransactionId: quote.providerTransactionId,
        refundReference: receipt.refundReference,
        initiatedAt: now(),
      });
      if (terminalRefund(receipt.status)) {
        return input.quotes.markRefunded({
          tenantId: owner.tenantId,
          userId: owner.userId,
          quoteId: quote.quoteId,
          providerTransactionId: quote.providerTransactionId,
          refundReference: receipt.refundReference,
          refundedAt: now(),
        });
      }
      return quote;
    }

    const receipt = await input.funding.findRefund({
      transactionId: quote.providerTransactionId,
      ...(quote.refundReference ? { refundReference: quote.refundReference } : {}),
      ...(signal ? { signal } : {}),
    });
    if (!receipt || !terminalRefund(receipt.status)) return quote;
    return input.quotes.markRefunded({
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: quote.quoteId,
      providerTransactionId: quote.providerTransactionId,
      refundReference: quote.refundReference ?? receipt.refundReference,
      refundedAt: now(),
    });
  }

  function view(quote: BillingQuote, purchase: unknown | null = null): BillingCheckoutView {
    return Object.freeze({
      quote,
      phase: quotePhase(quote),
      checkoutUrl: quote.checkoutUrl,
      purchase,
      document: documentFor(quote,input.actionSecret),
    });
  }

  return Object.freeze({
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
      return view(await input.quotes.createQuote(quote));
    },

    async startCheckout(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.quoteId);
      if (owned.quote.revision !== request.quoteRevision) throw new Error("financial.billing.quote_revision_conflict");
      if (owned.quote.checkoutUrl && owned.quote.checkoutTxRef) return view(owned.quote);
      const confirmed = await input.quotes.confirmQuote({
        tenantId: owned.identity.tenantId,
        userId: owned.identity.userId,
        quoteId: owned.quote.quoteId,
        quoteRevision: request.quoteRevision,
        confirmedAt: now(),
      });
      const email = owned.identity.profile.email;
      if (!email) throw new Error("financial.billing.email_required_for_checkout");
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
      return view(bound);
    },

    async verifyAndPurchase(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.quoteId);
      if (owned.quote.revision !== request.quoteRevision) throw new Error("financial.billing.quote_revision_conflict");
      if (!owned.quote.checkoutTxRef) throw new Error("financial.billing.checkout_not_created");

      let quote = owned.quote;
      if (!quote.paymentVerifiedAt) {
        const payment = await input.funding.verifyByReference(quote.checkoutTxRef,request.signal);
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
          txRef: quote.checkoutTxRef,
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
      let purchase: unknown;
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
          return view(quote);
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
      const quote = await refundIfRequired(owned.identity,owned.quote);
      return view(quote);
    },

    async executeShellAction(request) {
      const owned = await ownedQuote(request.authorizationHeader,request.documentId.replace(/^billing:/u,""));
      if (request.revision !== owned.quote.revision &&
          request.revision !== owned.quote.revision + 1) {
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
        ? await this.startCheckout({
            authorizationHeader: request.authorizationHeader,
            quoteId: owned.quote.quoteId,
            quoteRevision: owned.quote.revision,
          })
        : request.actionId === "billing.checkout.verify"
          ? await this.verifyAndPurchase({
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
  });
}
