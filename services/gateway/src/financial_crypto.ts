import { timingSafeEqual } from "node:crypto";
import {
  NowPaymentsClient,
  parseVerifiedPaymentIpn,
  paymentDisposition,
  type NowPaymentsPaymentStatus,
} from "@masanawa/nowpayments";
import {
  type CryptoPaymentIntent,
  type CryptoPaymentState,
  type FinancialOperationsRepository,
} from "@masanawa/postgres";

export interface FinancialIdentity {
  readonly tenantId: string;
  readonly userId: string;
}

export interface FinancialAuthorizer {
  authorize(authorizationHeader: string | undefined): FinancialIdentity;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createStaticFinancialAuthorizer(input: Readonly<{
  token: string;
  tenantId: string;
  userId: string;
}>): FinancialAuthorizer {
  const token = input.token.trim();
  if (!token) throw new Error("financial.auth.token_required");
  const identity = Object.freeze({
    tenantId: input.tenantId.trim(),
    userId: input.userId.trim(),
  });
  if (!identity.tenantId || !identity.userId) throw new Error("financial.auth.identity_required");
  return Object.freeze({
    authorize(authorizationHeader) {
      const prefix = "Bearer ";
      const provided =
        typeof authorizationHeader === "string" && authorizationHeader.startsWith(prefix)
          ? authorizationHeader.slice(prefix.length).trim()
          : "";
      if (!provided || !safeEqual(provided, token)) throw new Error("financial.auth.unauthorized");
      return identity;
    },
  });
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function sameAmount(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-9;
}

function state(status: NowPaymentsPaymentStatus): CryptoPaymentState {
  return status;
}

function nextRecord(
  current: CryptoPaymentIntent,
  patch: Partial<Omit<CryptoPaymentIntent, "tenantId" | "userId" | "requestId" | "orderId" | "revision" | "createdAt">>,
  at: string,
): CryptoPaymentIntent {
  return Object.freeze({
    ...current,
    ...patch,
    revision: current.revision + 1,
    updatedAt: at,
  });
}

export interface CryptoFinancialService {
  listRoutes(input: Readonly<{ authorizationHeader?: string }>): Promise<unknown>;
  quote(input: Readonly<{
    authorizationHeader?: string;
    amount: number;
    priceCurrency: string;
    payCurrency: string;
    signal?: AbortSignal;
  }>): Promise<unknown>;
  createPayment(input: Readonly<{
    authorizationHeader?: string;
    requestId: string;
    amount: number;
    priceCurrency: string;
    payCurrency: string;
    description?: string;
    signal?: AbortSignal;
  }>): Promise<CryptoPaymentIntent>;
  readPayment(input: Readonly<{
    authorizationHeader?: string;
    requestId: string;
    refresh?: boolean;
    signal?: AbortSignal;
  }>): Promise<CryptoPaymentIntent>;
  receiveIpn(input: Readonly<{
    payload: unknown;
    signature: string;
  }>): Promise<Readonly<{ duplicate: boolean; payment: CryptoPaymentIntent | null }>>;
  capabilities(input: Readonly<{ authorizationHeader?: string }>): Readonly<{
    deposits: true;
    conversion: false;
    withdrawals: false;
    reason: string;
  }>;
}

export function createCryptoFinancialService(input: Readonly<{
  client: NowPaymentsClient;
  repository: FinancialOperationsRepository;
  authorizer: FinancialAuthorizer;
  ipnSecret: string;
  publicBaseUrl: string;
  now?: () => Date;
}>): CryptoFinancialService {
  const ipnSecret = input.ipnSecret.trim();
  if (!ipnSecret) throw new Error("nowpayments.ipn.secret.required");
  const base = new URL(input.publicBaseUrl);
  if (base.protocol !== "https:") throw new Error("financial.public_url.https_required");
  const callbackUrl = new URL("/v1/webhooks/nowpayments", base).toString();
  const now = input.now ?? (() => new Date());

  return Object.freeze({
    async listRoutes(request) {
      input.authorizer.authorize(request.authorizationHeader);
      return input.client.listEligiblePaymentRoutes({
        operation: "deposit",
        excludedNetworks: ["ethereum"],
        requireKnownNetwork: true,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
    },

    async quote(request) {
      input.authorizer.authorize(request.authorizationHeader);
      return input.client.quotePayment({
        amount: request.amount,
        currencyFrom: request.priceCurrency,
        currencyTo: request.payCurrency,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
    },

    async createPayment(request) {
      const identity = input.authorizer.authorize(request.authorizationHeader);
      const existing = await input.repository.readCryptoPaymentIntent({
        tenantId: identity.tenantId,
        userId: identity.userId,
        requestId: request.requestId,
      });
      if (existing) return existing;

      const preflight = await input.client.quotePayment({
        amount: request.amount,
        currencyFrom: request.priceCurrency,
        currencyTo: request.payCurrency,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
      const at = nowIso(now);
      const orderId = request.requestId;
      const initial: CryptoPaymentIntent = Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
        requestId: request.requestId,
        orderId,
        revision: 1,
        state: "dispatching",
        priceAmount: request.amount,
        priceCurrency: preflight.estimate.currencyFrom,
        payCurrency: preflight.estimate.currencyTo,
        minimumAmount: preflight.minimum.minimumAmount,
        estimatedAmount: preflight.estimate.estimatedAmount,
        providerPaymentId: null,
        purchaseId: null,
        parentPaymentId: null,
        payAddress: null,
        payAmount: null,
        actuallyPaid: 0,
        lastEvidenceHash: null,
        createdAt: at,
        updatedAt: at,
      });
      const created = await input.repository.createCryptoPaymentIntent(initial);
      if (!created.created) return created.record;

      try {
        const result = await input.client.createPayment({
          priceAmount: request.amount,
          priceCurrency: request.priceCurrency,
          payCurrency: request.payCurrency,
          ipnCallbackUrl: callbackUrl,
          orderId,
          ...(request.description === undefined ? {} : { orderDescription: request.description }),
          ...(request.signal === undefined ? {} : { signal: request.signal }),
        });
        const payment = result.payment;
        const evidenceMatches =
          payment.orderId === orderId &&
          payment.priceCurrency === initial.priceCurrency &&
          payment.payCurrency === initial.payCurrency &&
          sameAmount(payment.priceAmount, initial.priceAmount);
        return input.repository.compareAndSetCryptoPayment(
          initial.revision,
          nextRecord(initial, {
            state: evidenceMatches ? state(payment.status) : "manual_review",
            providerPaymentId: payment.paymentId,
            purchaseId: payment.purchaseId,
            payAddress: payment.payAddress,
            payAmount: payment.payAmount,
          }, nowIso(now)),
        );
      } catch {
        return input.repository.compareAndSetCryptoPayment(
          initial.revision,
          nextRecord(initial, { state: "manual_review" }, nowIso(now)),
        );
      }
    },

    async readPayment(request) {
      const identity = input.authorizer.authorize(request.authorizationHeader);
      const current = await input.repository.readCryptoPaymentIntent({
        tenantId: identity.tenantId,
        userId: identity.userId,
        requestId: request.requestId,
      });
      if (!current) throw new Error("financial.crypto_payment_not_found");
      if (!request.refresh || current.providerPaymentId === null ||
          ["finished","failed","refunded","expired","manual_review"].includes(current.state)) {
        return current;
      }
      const providerStatus = await input.client.getPaymentStatus({
        paymentId: current.providerPaymentId,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
      if (providerStatus === current.state) return current;
      return input.repository.compareAndSetCryptoPayment(
        current.revision,
        nextRecord(current, { state: state(providerStatus) }, nowIso(now)),
      );
    },

    async receiveIpn(request) {
      const evidence = parseVerifiedPaymentIpn({
        payload: request.payload,
        signature: request.signature,
        secret: ipnSecret,
      });
      const current =
        (await input.repository.readCryptoPaymentByProviderId(evidence.paymentId)) ??
        (evidence.orderId
          ? await input.repository.readCryptoPaymentByOrderId({
              tenantId:
                (await input.repository.readCryptoPaymentByProviderId(evidence.paymentId))?.tenantId ?? "",
              orderId: evidence.orderId,
            }).catch(() => null)
          : null);
      if (!current) {
        await input.repository.admitProviderWebhook({
          provider: "nowpayments",
          fingerprint: evidence.payloadHash,
          eventKey: `payment:${evidence.paymentId}:${evidence.status}`,
          receivedAt: nowIso(now),
          payload: request.payload as Readonly<Record<string, unknown>>,
        });
        return Object.freeze({ duplicate: false, payment: null });
      }

      const matches =
        evidence.paymentId === current.providerPaymentId &&
        evidence.priceCurrency === current.priceCurrency &&
        evidence.payCurrency === current.payCurrency &&
        sameAmount(evidence.priceAmount, current.priceAmount) &&
        (current.payAmount === null || sameAmount(evidence.payAmount, current.payAmount));

      const next = nextRecord(current, {
        state: matches ? state(evidence.status) : "manual_review",
        purchaseId: evidence.purchaseId ?? current.purchaseId,
        parentPaymentId: evidence.parentPaymentId,
        payAmount: evidence.payAmount,
        actuallyPaid: evidence.actuallyPaid,
        lastEvidenceHash: evidence.payloadHash,
      }, nowIso(now));

      return input.repository.applyCryptoWebhook({
        provider: "nowpayments",
        fingerprint: evidence.payloadHash,
        eventKey: `payment:${evidence.paymentId}:${evidence.status}`,
        receivedAt: nowIso(now),
        payload: request.payload as Readonly<Record<string, unknown>>,
        expectedRevision: current.revision,
        next,
      }).then((result) => Object.freeze({
        duplicate: result.duplicate,
        payment: result.record,
      }));
    },

    capabilities(request) {
      input.authorizer.authorize(request.authorizationHeader);
      return Object.freeze({
        deposits: true as const,
        conversion: false as const,
        withdrawals: false as const,
        reason: "custody_and_payout_account_qualification_required",
      });
    },
  });
}
