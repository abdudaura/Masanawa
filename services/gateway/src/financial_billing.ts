import {
  BillingCommerceOrchestrator,
  FlutterwaveBillsClient,
  FlutterwaveHttpTransport,
  verifyFlutterwaveV3Webhook,
  type BillingFulfillmentRecord,
} from "@masanawa/providers";
import type {
  BillingFundingRepository,
  ProviderWebhookRepository,
} from "@masanawa/postgres";
import type { BillingFulfillmentStore } from "@masanawa/providers";
import type { FinancialAuthorizer } from "./financial_service.js";


export interface BillingCreditPricingPolicy {
  readonly version: string;
  quote(input: Readonly<{
    providerAmountNgn: string;
    billerCode: string;
    itemCode: string;
  }>): Readonly<{
    customerPriceCredits: number;
    providerReserveCredits: number;
    platformMarginCredits: number;
  }>;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function ceilRatio(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

export function createBillingCreditPricingPolicy(input: Readonly<{
  creditsPerNgn: number;
  platformMarginBps: number;
  version: string;
}>): BillingCreditPricingPolicy {
  const creditsPerNgn = positiveInteger(input.creditsPerNgn, "creditsPerNgn");
  const platformMarginBps = nonNegativeInteger(
    input.platformMarginBps,
    "platformMarginBps",
  );
  if (platformMarginBps > 10_000) {
    throw new TypeError("platformMarginBps is invalid");
  }
  const version = input.version.trim();
  if (!version || version.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(version)) {
    throw new TypeError("billing pricing version is invalid");
  }

  return Object.freeze({
    version,
    quote(request) {
      const normalized = request.providerAmountNgn.trim();
      if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(normalized) ||
          /^0(?:\.0+)?$/u.test(normalized)) {
        throw new TypeError("providerAmountNgn is invalid");
      }
      const [whole = "0", fraction = ""] = normalized.split(".");
      const denominator = 10n ** BigInt(fraction.length);
      const raw = BigInt(whole + fraction) * BigInt(creditsPerNgn);
      const reserveBig = ceilRatio(raw, denominator);
      const marginBig = ceilRatio(
        reserveBig * BigInt(platformMarginBps),
        10_000n,
      );
      const priceBig = reserveBig + marginBig;
      if (
        reserveBig > BigInt(Number.MAX_SAFE_INTEGER) ||
        marginBig > BigInt(Number.MAX_SAFE_INTEGER) ||
        priceBig > BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        throw new RangeError("billing pricing exceeds safe integer range");
      }
      return Object.freeze({
        providerReserveCredits: Number(reserveBig),
        platformMarginCredits: Number(marginBig),
        customerPriceCredits: Number(priceBig),
      });
    },
  });
}

export interface BillingFinancialService {
  listCategories(input: Readonly<{ authorizationHeader: string | undefined; signal?: AbortSignal }>): Promise<unknown>;
  listBillers(input: Readonly<{ authorizationHeader: string | undefined; categoryCode: string; signal?: AbortSignal }>): Promise<unknown>;
  listItems(input: Readonly<{ authorizationHeader: string | undefined; billerCode: string; signal?: AbortSignal }>): Promise<unknown>;
  purchase(input: Readonly<{
    authorizationHeader: string | undefined;
    requestId: string;
    billerCode: string;
    itemCode: string;
    itemName: string;
    customerId: string;
    amount: string;
    catalogAmount: string;
    recipientValidation?: "required" | "not-required";
    signal?: AbortSignal;
  }>): Promise<BillingFulfillmentRecord>;
  readPurchase(input: Readonly<{
    authorizationHeader: string | undefined;
    reference: string;
    refresh?: boolean;
    signal?: AbortSignal;
  }>): Promise<BillingFulfillmentRecord>;
  receiveWebhook(input: Readonly<{
    rawBody: Uint8Array;
    verifHash: string | null | undefined;
  }>): Promise<Readonly<{ duplicate: boolean; reference: string | null }>>;
}

function referenceFromWebhook(payload: Readonly<Record<string, unknown>>): string | null {
  const candidates = [
    payload.reference,
    payload.customer_reference,
    payload.tx_ref,
    typeof payload.data === "object" && payload.data !== null && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>).reference
      : undefined,
    typeof payload.data === "object" && payload.data !== null && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>).customer_reference
      : undefined,
  ];
  for (const value of candidates) {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0 && normalized.length <= 128) return normalized;
    }
  }
  return null;
}

export function createBillingFinancialService(input: Readonly<{
  billingStore: (identity: Readonly<{ tenantId: string; userId: string }>) => BillingFulfillmentStore;
  billingFunding: (identity: Readonly<{ tenantId: string; userId: string }>) => BillingFundingRepository;
  pricingPolicy: BillingCreditPricingPolicy;
  webhookRepository: ProviderWebhookRepository;
  authorizer: FinancialAuthorizer;
  flutterwaveSecretKey: string;
  flutterwaveWebhookHash: string;
  flutterwaveWebhookUrl: string;
  flutterwaveRelayUrl?: string;
  flutterwaveRelayToken?: string;
  providerClient?: FlutterwaveBillsClient;
}>): BillingFinancialService {
  const secretKey = input.flutterwaveSecretKey.trim();
  const webhookHash = input.flutterwaveWebhookHash.trim();
  if (!secretKey) throw new Error("flutterwave.secret_key.required");
  if (!webhookHash) throw new Error("flutterwave.webhook_hash.required");

  const relayUrl = input.flutterwaveRelayUrl?.trim() ?? "";
  const relayToken = input.flutterwaveRelayToken?.trim() ?? "";
  if (Boolean(relayUrl) !== Boolean(relayToken)) {
    throw new Error("flutterwave.relay.configuration_incomplete");
  }

  const provider =
    input.providerClient ??
    new FlutterwaveBillsClient({
      secretKey,
      transport:
        relayUrl && relayToken
          ? new FlutterwaveHttpTransport({
              baseUrl: relayUrl,
              relayToken,
            })
          : new FlutterwaveHttpTransport(),
      country: "NG",
    });
  const callbackUrl = (() => {
    const url = new URL(input.flutterwaveWebhookUrl);
    if (url.protocol !== "https:") throw new Error("flutterwave.webhook_url.https_required");
    return url.toString();
  })();

  function orchestrator(identity: Readonly<{ tenantId: string; userId: string }>) {
    return new BillingCommerceOrchestrator({
      provider,
      store: input.billingStore(identity),
    });
  }

  return Object.freeze<BillingFinancialService>({
    async listCategories(request) {
      await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      return provider.listCategories(request.signal);
    },

    async listBillers(request) {
      await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      return provider.listBillers(request.categoryCode, request.signal);
    },

    async listItems(request) {
      await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      return provider.listItems(request.billerCode, request.signal);
    },

    async purchase(request) {
      const identity = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      const items = await provider.listItems(request.billerCode, request.signal);
      const selected = items.find((item) => item.itemCode === request.itemCode);
      if (!selected || selected.billerCode !== request.billerCode) {
        throw new Error("financial.billing.catalog_item_unavailable");
      }
      const service = orchestrator(identity);
      const prepared = await service.prepare({
        fulfillmentReference: request.requestId,
        billerCode: selected.billerCode,
        itemCode: selected.itemCode,
        itemName: selected.name,
        customerId: request.customerId,
        amount: request.amount,
        catalogAmount: selected.amount,
        ...(request.recipientValidation === undefined
          ? {}
          : { recipientValidation: request.recipientValidation }),
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });

      const economics = input.pricingPolicy.quote({
        providerAmountNgn: prepared.amount,
        billerCode: prepared.billerCode,
        itemCode: prepared.itemCode,
      });
      const funding = input.billingFunding(identity);
      await funding.reserve({
        reference: prepared.fulfillmentReference,
        providerAmountNgn: prepared.amount,
        ...economics,
        pricingPolicyVersion: input.pricingPolicy.version,
        observedAt: new Date().toISOString(),
      });

      const settleTerminal = async (record: BillingFulfillmentRecord) => {
        if (record.state === "succeeded") {
          await funding.settle({
            reference: record.fulfillmentReference,
            outcome: "succeeded",
            observedAt: new Date().toISOString(),
          });
        } else if (record.state === "failed" || record.state === "reversed") {
          await funding.settle({
            reference: record.fulfillmentReference,
            outcome: "refunded",
            observedAt: new Date().toISOString(),
          });
        }
        return record;
      };

      if (
        prepared.state === "succeeded" ||
        prepared.state === "failed" ||
        prepared.state === "reversed" ||
        prepared.state === "manual_review"
      ) {
        return settleTerminal(prepared);
      }

      try {
        const dispatched = await service.dispatch(prepared.fulfillmentReference, {
          callbackUrl,
          ...(request.signal === undefined ? {} : { signal: request.signal }),
        });
        return await settleTerminal(dispatched);
      } catch (error) {
        await funding.settle({
          reference: prepared.fulfillmentReference,
          outcome: "refunded",
          observedAt: new Date().toISOString(),
        });
        throw error;
      }
    },

    async readPurchase(request) {
      const identity = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      const service = orchestrator(identity);
      const funding = input.billingFunding(identity);
      const current = await input.billingStore(identity).read(request.reference);
      if (!current) throw new Error("financial.billing_not_found");
      const record =
        !request.refresh ||
        ["succeeded","failed","reversed","manual_review"].includes(current.state)
          ? current
          : await service.reconcile(request.reference, request.signal);
      if (record.state === "succeeded") {
        await funding.settle({
          reference: record.fulfillmentReference,
          outcome: "succeeded",
          observedAt: new Date().toISOString(),
        });
      } else if (record.state === "failed" || record.state === "reversed") {
        await funding.settle({
          reference: record.fulfillmentReference,
          outcome: "refunded",
          observedAt: new Date().toISOString(),
        });
      }
      return record;
    },

    async receiveWebhook(request) {
      const evidence = verifyFlutterwaveV3Webhook({
        rawBody: request.rawBody,
        verifHash: request.verifHash,
        expectedSecretHash: webhookHash,
      });
      const reference = referenceFromWebhook(evidence.payload);
      const admission = await input.webhookRepository.admitProviderWebhook({
        provider: "flutterwave",
        fingerprint: evidence.fingerprint,
        eventKey: reference === null ? `event:${evidence.event}` : `bill:${reference}:${evidence.event}`,
        receivedAt: new Date().toISOString(),
        payload: evidence.payload,
      });
      return Object.freeze({ duplicate: admission.duplicate, reference });
    },
  });
}
