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
  parseVerifiedPaymentIpn,
  splitProviderCurrency,
  type NowPaymentsCurrencyEvidence,
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

export interface FinancialService {
  listDepositRoutes(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly NowPaymentsCurrencyEvidence[]>;
  createDeposit(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly providerCode: string;
    readonly amount: string;
  }): Promise<FinancialDepositView>;
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
    async authorize(request) {
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

export function createFinancialService(input: {
  readonly authorizer: FinancialAuthorizer;
  readonly crypto: CryptoRepository;
  readonly nowPayments: NowPaymentsClient;
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

  return Object.freeze<FinancialService>({
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
      if (existing) return depositView(existing);

      const routes = await input.nowPayments.listEligiblePaymentRoutes({
        operation: "deposit",
      });
      const route = routes.find((candidate) => candidate.route.providerCode === providerCode)?.route;
      if (!route) throw new Error("financial.crypto.route_unavailable");

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("financial.crypto.amount_unavailable");
      }

      await input.nowPayments.quotePayment({
        amount: numericAmount,
        currencyFrom: providerCode,
        currencyTo: providerCode,
      });

      const createdAt = now();
      await input.crypto.createIntent({
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

      const dispatch = await input.crypto.beginProviderDispatch({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        updatedAt: now(),
      });
      if (!dispatch.shouldDispatch) return depositView(dispatch.intent);

      const payment = await input.nowPayments.submitPayment({
        priceAmount: numericAmount,
        priceCurrency: providerCode,
        payCurrency: providerCode,
        ipnCallbackUrl,
        orderId: providerOrderId(auth.tenantId, requestId),
        orderDescription: "Masanawa crypto deposit",
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
      return input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId: parseCanonicalId("request", request.requestId),
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
