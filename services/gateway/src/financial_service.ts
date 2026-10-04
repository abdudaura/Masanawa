import { admitPaymentEvidence } from "./financial_payment_evidence.js";
import { assertFinancialReplay, type FinancialReplayTerms } from "./financial_replay.js";
import {
  nowInstant,
  parseCanonicalId,
  type Instant,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  normalizeCryptoAmount,
  normalizeCryptoAsset,
  type CryptoIntent,
  type CryptoProviderPaymentEvent,
  type CryptoRepository,
} from "@masanawa/commerce";
import {
  NowPaymentsClient,
  NowPaymentsPayoutClient,
  assertAboveMinimum,
  parseVerifiedPaymentIpn,
  splitProviderCurrency,
  type NowPaymentsCurrencyEvidence,
  type NowPaymentsAccountEvidence,
  assertFreshAccountEvidence, qualifyAccountCapability, qualifyRoute,
} from "@masanawa/nowpayments";

export interface FinancialAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface FinancialAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<FinancialAuthority>;
}

export interface FinancialDepositView {
  readonly requestId: RequestId;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly status: CryptoIntent["status"];
  readonly providerPaymentId: string | null;
  readonly payAddress: string | null;
  readonly providerPayAmount: string | null;
  readonly outcomeUnknown: boolean;
}

export interface FinancialWithdrawalView {
  readonly requestId: RequestId;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly destinationAddress: string | null;
  readonly status: CryptoIntent["status"];
  readonly providerPayoutId: string | null;
  readonly verificationRequired: boolean;
  readonly outcomeUnknown: boolean;
}

export interface FinancialCapabilities {
  readonly deposits: true;
  readonly withdrawals: boolean;
  readonly conversions: false;
  readonly payoutReason: string | null;
}

export interface FinancialService {
  capabilities(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<FinancialCapabilities>;
  listDepositRoutes(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly NowPaymentsCurrencyEvidence[]>;
  createDeposit(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly providerCode: string;
    readonly amount: string;
  }): Promise<FinancialDepositView>;
  createWithdrawal(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly providerCode: string;
    readonly amount: string;
    readonly destinationAddress: string;
  }): Promise<FinancialWithdrawalView>;
  verifyWithdrawal(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly verificationCode: string;
  }): Promise<FinancialWithdrawalView>;
  refreshWithdrawal(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
  }): Promise<FinancialWithdrawalView>;
  readBalance(input: {
    readonly authorizationHeader: string | undefined;
    readonly providerCode: string;
  }): Promise<{ readonly providerCode: string; readonly amount: string }>;
  listHistory(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly CryptoIntent[]>;
  readIntent(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
  }): Promise<CryptoIntent | null>;
  handleNowPaymentsIpn(input: {
    readonly signature: string;
    readonly payload: unknown;
  }): Promise<{ readonly accepted: true; readonly requestId: RequestId }>;
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function createFixedFinancialAuthorizer(input: {
  readonly token: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
}): FinancialAuthorizer {
  const token = input.token.trim();
  if (!token) throw new TypeError("financial.auth.token.required");
  return Object.freeze({
    async authorize(request: Parameters<FinancialAuthorizer["authorize"]>[0]) {
      const supplied = bearer(request.authorizationHeader);
      if (supplied !== token) throw new Error("financial.auth.unauthorized");
      return Object.freeze({ tenantId: input.tenantId, userId: input.userId });
    },
  });
}

function providerOrderId(tenantId: TenantId, requestId: RequestId): string {
  return `${tenantId}.${requestId}`;
}

function parseProviderOrderId(value: string | null): {
  readonly tenantId: TenantId;
  readonly requestId: RequestId;
} {
  if (value === null) throw new Error("financial.ipn.order_id.required");
  const separator = value.indexOf(".");
  if (separator < 1 || separator !== value.lastIndexOf(".")) {
    throw new Error("financial.ipn.order_id.invalid");
  }
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", value.slice(0, separator)),
    requestId: parseCanonicalId("request", value.slice(separator + 1)),
  });
}

function depositView(intent: CryptoIntent): FinancialDepositView {
  return Object.freeze({
    requestId: intent.requestId,
    asset: intent.asset,
    network: intent.network,
    amount: intent.amount,
    status: intent.status,
    providerPaymentId: intent.providerPaymentId,
    payAddress: intent.payAddress,
    providerPayAmount: intent.providerPayAmount,
    outcomeUnknown:
      intent.providerDispatchStartedAt !== null && intent.providerPaymentId === null,
  });
}

function withdrawalView(intent: CryptoIntent): FinancialWithdrawalView {
  return Object.freeze({
    requestId: intent.requestId,
    asset: intent.asset,
    network: intent.network,
    amount: intent.amount,
    destinationAddress: intent.destinationAddress,
    status: intent.status,
    providerPayoutId: intent.providerPayoutId,
    verificationRequired:
      intent.providerPayoutId !== null &&
      intent.status === "processing",
    outcomeUnknown:
      intent.providerDispatchStartedAt !== null && intent.providerPayoutId === null,
  });
}

function payoutSucceeded(status: string | null): boolean {
  return status !== null && ["finished", "success", "successful", "sent"].includes(status);
}

function payoutFailed(status: string | null): boolean {
  return status !== null && ["failed", "rejected", "cancelled", "canceled", "expired"].includes(status);
}

export function createFinancialService(input: {
  readonly authorizer: FinancialAuthorizer;
  readonly crypto: CryptoRepository;
  readonly nowPayments: NowPaymentsClient;
  readonly nowPaymentsPayout?: NowPaymentsPayoutClient;
  readonly withdrawalEvidence?: () => Promise<{
    readonly account: NowPaymentsAccountEvidence;
    readonly routes: readonly NowPaymentsCurrencyEvidence[];
  }>;
  readonly nowPaymentsIpnSecret: string;
  readonly publicBaseUrl: string;
  readonly now?: () => Instant;
}): FinancialService {
  const now = input.now ?? nowInstant;
  const ipnSecret = input.nowPaymentsIpnSecret.trim();
  if (!ipnSecret) throw new TypeError("financial.ipn.secret.required");
  const base = new URL(input.publicBaseUrl);
  if (base.protocol !== "https:") throw new TypeError("financial.public_base_url.insecure");
  const ipnCallbackUrl = new URL("/v1/financial/nowpayments/ipn", base).toString();

  async function authority(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }

  async function currentDepositRoute(providerCode: string) {
    const routes = await input.nowPayments.listEligiblePaymentRoutes({ operation: "deposit" });
    return routes.find((candidate) => candidate.route.providerCode === providerCode)?.route ?? null;
  }

  async function qualifiedWithdrawalRoutes() {
    if (!input.nowPaymentsPayout || !input.withdrawalEvidence) return null;
    const evidence = await input.withdrawalEvidence();
    assertFreshAccountEvidence(evidence.account, { now: new Date(now()) });
    for (const capability of ["custody", "customer_management", "payout"] as const) {
      if (!qualifyAccountCapability(evidence.account, capability).eligible) return null;
    }
    return evidence.routes.filter(route => qualifyRoute(route, "withdraw").eligible);
  }

  return Object.freeze<FinancialService>({
    async capabilities(request) {
      await authority(request.authorizationHeader);
      let withdrawals = false;
      try { const routes = await qualifiedWithdrawalRoutes(); withdrawals = routes !== null && routes.length > 0; } catch { /* Unknown/stale evidence denies admission. */ }
      return Object.freeze({
        deposits: true as const,
        withdrawals,
        conversions: false as const,
        payoutReason:
          !withdrawals
            ? "nowpayments_payout_credentials_or_account_capability_unavailable"
            : null,
      });
    },

    async listDepositRoutes(request) {
      await authority(request.authorizationHeader);
      const qualified = await input.nowPayments.listEligiblePaymentRoutes({
        operation: "deposit",
      });
      return Object.freeze(qualified.map((entry) => entry.route));
    },

    async createDeposit(request) {
      const auth = await authority(request.authorizationHeader);
      const requestId = parseCanonicalId("request", request.requestId);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      const amount = normalizeCryptoAmount(request.amount);

      const existing = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      const terms: FinancialReplayTerms = {
        operation: "deposit", asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount, destinationAddress: null,
      };
      if (existing) {
        assertFinancialReplay(existing, terms);
        return depositView(existing);
      }

      const route = await currentDepositRoute(providerCode);
      if (!route) throw new Error("financial.crypto.route_unavailable");

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0 || normalizeCryptoAmount(String(numericAmount)) !== amount) {
        throw new Error("financial.crypto.amount_unavailable");
      }

      const minimum = await input.nowPayments.getMinimumAmount({
        currencyFrom: providerCode,
        currencyTo: providerCode,
      });
      assertAboveMinimum(numericAmount, minimum);

      const createdAt = now();
      const admitted = await input.crypto.createIntent({
        schemaVersion: 1,
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        operation: "deposit",
        asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount,
        targetAsset: null,
        destinationAddress: null,
        provider: "nowpayments",
        providerPaymentId: null,
        providerPayoutId: null,
        payAddress: null,
        providerPayAmount: null,
        providerDispatchStartedAt: null,
        status: "quoted",
        createdAt,
        updatedAt: createdAt,
      });

      assertFinancialReplay(admitted, terms);
      const dispatch = await input.crypto.beginProviderDispatch({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        updatedAt: now(),
      });
      assertFinancialReplay(dispatch.intent, terms);
      if (!dispatch.shouldDispatch) return depositView(dispatch.intent);

      const payment = await input.nowPayments.submitPayment({
        priceAmount: numericAmount,
        priceCurrency: providerCode,
        payCurrency: providerCode,
        ipnCallbackUrl,
        orderId: providerOrderId(auth.tenantId, requestId),
        orderDescription: "Masanawa crypto deposit",
        signal: AbortSignal.timeout(15_000),
      });

      const bound = await input.crypto.bindProviderPayment({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        providerPaymentId: payment.paymentId,
        payAddress: payment.payAddress,
        providerPayAmount: String(payment.payAmount),
        updatedAt: now(),
      });
      return depositView(bound);
    },

    async createWithdrawal(request) {
      const auth = await authority(request.authorizationHeader);
      if (!input.nowPaymentsPayout) throw new Error("financial.crypto.withdrawal_unavailable");

      const requestId = parseCanonicalId("request", request.requestId);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      const amount = normalizeCryptoAmount(request.amount);
      const address = request.destinationAddress.trim();
      if (!address || address.length > 512) throw new Error("financial.crypto.destination_invalid");

      const existing = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      const terms: FinancialReplayTerms = {
        operation: "withdraw", asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount, destinationAddress: address,
      };
      if (existing) {
        assertFinancialReplay(existing, terms);
        return withdrawalView(existing);
      }

      const routes = await qualifiedWithdrawalRoutes();
      const route = routes?.find(candidate => candidate.providerCode === providerCode);
      if (!route) throw new Error("financial.crypto.withdrawal_unavailable");

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0 || normalizeCryptoAmount(String(numericAmount)) !== amount) {
        throw new Error("financial.crypto.amount_unavailable");
      }
      const createdAt = now();
      const admitted = await input.crypto.reserveWithdrawal({
        schemaVersion: 1,
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        operation: "withdraw",
        asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount,
        targetAsset: null,
        destinationAddress: address,
        provider: "nowpayments",
        providerPaymentId: null,
        providerPayoutId: null,
        payAddress: null,
        providerPayAmount: null,
        providerDispatchStartedAt: null,
        status: "processing",
        createdAt,
        updatedAt: createdAt,
      });

      assertFinancialReplay(admitted, terms);
      const dispatch = await input.crypto.beginProviderDispatch({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        updatedAt: now(),
      });
      assertFinancialReplay(dispatch.intent, terms);
      if (!dispatch.shouldDispatch) return withdrawalView(dispatch.intent);

      const payout = await input.nowPaymentsPayout.createPayout({
        amount,
        currency: providerCode,
        address,
        signal: AbortSignal.timeout(15_000),
      });
      const bound = await input.crypto.bindProviderPayout({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        providerPayoutId: payout.payoutId,
        updatedAt: now(),
      });

      if (payoutSucceeded(payout.status)) {
        return withdrawalView(await input.crypto.settleWithdrawal({
          tenantId: auth.tenantId,
          userId: auth.userId,
          requestId,
          succeeded: true,
          providerReference: payout.payoutId,
          updatedAt: now(),
        }));
      }
      if (payoutFailed(payout.status)) {
        return withdrawalView(await input.crypto.settleWithdrawal({
          tenantId: auth.tenantId,
          userId: auth.userId,
          requestId,
          succeeded: false,
          providerReference: payout.payoutId,
          updatedAt: now(),
        }));
      }
      return withdrawalView(bound);
    },

    async verifyWithdrawal(request) {
      const auth = await authority(request.authorizationHeader);
      if (!input.nowPaymentsPayout) throw new Error("financial.crypto.withdrawal_unavailable");
      const requestId = parseCanonicalId("request", request.requestId);
      const intent = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      if (!intent || intent.operation !== "withdraw" || intent.providerPayoutId === null) {
        throw new Error("financial.crypto.withdrawal_unavailable");
      }
      if (intent.status === "succeeded" || intent.status === "failed") return withdrawalView(intent);
      const result = await input.nowPaymentsPayout.verifyPayout({
        payoutId: intent.providerPayoutId,
        verificationCode: request.verificationCode,
        signal: AbortSignal.timeout(15_000),
      });
      if (payoutSucceeded(result.status)) {
        return withdrawalView(await input.crypto.settleWithdrawal({
          tenantId: auth.tenantId,
          userId: auth.userId,
          requestId,
          succeeded: true,
          providerReference: intent.providerPayoutId,
          updatedAt: now(),
        }));
      }
      if (payoutFailed(result.status)) {
        return withdrawalView(await input.crypto.settleWithdrawal({
          tenantId: auth.tenantId,
          userId: auth.userId,
          requestId,
          succeeded: false,
          providerReference: intent.providerPayoutId,
          updatedAt: now(),
        }));
      }
      return withdrawalView(intent);
    },

    async refreshWithdrawal(request) {
      const auth = await authority(request.authorizationHeader);
      if (!input.nowPaymentsPayout) throw new Error("financial.crypto.withdrawal_unavailable");
      const requestId = parseCanonicalId("request", request.requestId);
      const intent = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      if (!intent || intent.operation !== "withdraw" || intent.providerPayoutId === null) {
        throw new Error("financial.crypto.withdrawal_unavailable");
      }
      if (intent.status === "succeeded" || intent.status === "failed") return withdrawalView(intent);
      const status = await input.nowPaymentsPayout.getPayoutStatus({
        payoutId: intent.providerPayoutId,
        signal: AbortSignal.timeout(15_000),
      });
      if (payoutSucceeded(status) || payoutFailed(status)) {
        return withdrawalView(await input.crypto.settleWithdrawal({
          tenantId: auth.tenantId,
          userId: auth.userId,
          requestId,
          succeeded: payoutSucceeded(status),
          providerReference: intent.providerPayoutId,
          updatedAt: now(),
        }));
      }
      return withdrawalView(intent);
    },

    async readBalance(request) {
      const auth = await authority(request.authorizationHeader);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      return Object.freeze({
        providerCode,
        amount: await input.crypto.readBalance({
          tenantId: auth.tenantId,
          userId: auth.userId,
          asset: providerCode,
          network: splitProviderCurrency(providerCode).network,
        }),
      });
    },

    async listHistory(request) {
      const auth = await authority(request.authorizationHeader);
      return input.crypto.listIntents({
        tenantId: auth.tenantId,
        userId: auth.userId,
        ...(request.limit === undefined ? {} : { limit: request.limit }),
      });
    },

    async readIntent(request) {
      const auth = await authority(request.authorizationHeader);
      const intent = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId: parseCanonicalId("request", request.requestId),
      });
      if (!intent || intent.operation !== "deposit" || intent.providerPaymentId === null ||
          ["succeeded", "failed", "refunded", "expired"].includes(intent.status)) return intent;
      const payload = await input.nowPayments.getPaymentEvidence({
        paymentId: intent.providerPaymentId,
        signal: AbortSignal.timeout(15_000),
      });
      const evidence = admitPaymentEvidence(payload, {
        paymentId: intent.providerPaymentId,
        orderId: providerOrderId(auth.tenantId, intent.requestId),
        asset: intent.asset, amount: intent.amount,
      });
      return input.crypto.applyProviderPaymentEvent({
        tenantId: auth.tenantId, userId: auth.userId,
        event: { ...evidence, orderId: intent.requestId, observedAt: now() },
      });
    },

    async handleNowPaymentsIpn(request) {
      const evidence = parseVerifiedPaymentIpn({
        payload: request.payload,
        signature: request.signature,
        secret: ipnSecret,
      });
      const identity = parseProviderOrderId(evidence.orderId);
      const intent = await input.crypto.readIntentByRequestId(identity);
      if (!intent) throw new Error("financial.ipn.intent_unavailable");

      const event: CryptoProviderPaymentEvent = {
        paymentId: evidence.paymentId,
        parentPaymentId: evidence.parentPaymentId,
        orderId: identity.requestId,
        status: evidence.status,
        priceAmount: String(evidence.priceAmount),
        priceCurrency: evidence.priceCurrency,
        payAmount: String(evidence.payAmount),
        payCurrency: evidence.payCurrency,
        actuallyPaid: String(evidence.actuallyPaid),
        payloadHash: evidence.payloadHash,
        observedAt: now(),
      };
      await input.crypto.applyProviderPaymentEvent({
        tenantId: intent.tenantId,
        userId: intent.userId,
        event,
      });
      return Object.freeze({ accepted: true as const, requestId: intent.requestId });
    },
  });
}

