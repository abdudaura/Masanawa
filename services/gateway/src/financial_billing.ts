import type { BillingFundingAuthority } from "@masanawa/commerce";
import {
  BillingCommerceOrchestrator,
  FlutterwaveBillsClient,
  FlutterwaveHttpTransport,
  verifyFlutterwaveV3Webhook,
  type BillingFulfillmentRecord,
} from "@masanawa/providers";
import type { ProviderWebhookRepository } from "@masanawa/postgres";
import type { BillingFulfillmentStore } from "@masanawa/providers";
import type { FinancialAuthorizer } from "./financial_service.js";

export interface BillingFinancialService {
  listCategories(input: Readonly<{ authorizationHeader: string | undefined; signal?: AbortSignal }>): Promise<unknown>;
  listBillers(input: Readonly<{ authorizationHeader: string | undefined; categoryCode: string; signal?: AbortSignal }>): Promise<unknown>;
  listItems(input: Readonly<{ authorizationHeader: string | undefined; billerCode: string; signal?: AbortSignal }>): Promise<unknown>;
  purchase(input: Readonly<{
    authorizationHeader: string | undefined;
    requestId: string;
    quoteId?: string;
    quoteRevision?: number;
    categoryCode?: string;
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
  webhookRepository: ProviderWebhookRepository;
  authorizer: FinancialAuthorizer;
  flutterwaveSecretKey: string;
  flutterwaveWebhookHash: string;
  flutterwaveWebhookUrl: string;
  flutterwaveRelayUrl?: string;
  flutterwaveRelayToken?: string;
  flutterwaveRelayProtocol?: "bearer" | "dual-header";
  providerClient?: FlutterwaveBillsClient;
  billingFunding?: BillingFundingAuthority;
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
              ...(input.flutterwaveRelayProtocol === undefined ? {} : { relayProtocol: input.flutterwaveRelayProtocol }),
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

  async function settle(identity: Readonly<{ tenantId: string; userId: string }>, record: BillingFulfillmentRecord) {
    if (record.state === "succeeded" || record.state === "failed" || record.state === "reversed") {
      if (!input.billingFunding) throw new Error("financial.billing.funding_unavailable");
      await input.billingFunding.settleBill({ ...identity, fulfillmentReference: record.fulfillmentReference,
        state: record.state, providerReference: record.providerReference });
    }
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
      if (!input.billingFunding) throw new Error("financial.billing.funding_unavailable");
      if (!request.quoteId?.trim() || !Number.isSafeInteger(request.quoteRevision) ||
          (request.quoteRevision ?? 0) < 1) throw new Error("financial.billing.confirmed_quote_required");
      const items = await provider.listItems(request.billerCode, request.signal);
      const selected = items.find((item) => item.itemCode === request.itemCode);
      if (!selected || selected.billerCode !== request.billerCode) {
        throw new Error("financial.billing.catalog_item_unavailable");
      }
      let recipientValidation: "required" | "not-required" = "required";
      if (request.categoryCode) {
        const categories = await provider.listCategories(request.signal);
        const category = categories.find((entry) => entry.code === request.categoryCode);
        if (!category) throw new Error("financial.billing.catalog_category_unavailable");
        const billers = await provider.listBillers(category.code, request.signal);
        if (!billers.some((entry) => entry.billerCode === selected.billerCode)) throw new Error("financial.billing.catalog_biller_mismatch");
        if (category.code === "AIRTIME" || category.code === "MOBILEDATA") {
          if (!/^(?:0[789]\d{9}|\+?234[789]\d{9})$/u.test(request.customerId)) throw new Error("financial.billing.phone_invalid");
          recipientValidation = "not-required";
        }
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
        // Recipient validation policy must be supplied by trusted catalog policy,
        // never overridden by a customer request.
        recipientValidation,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
      await input.billingFunding.reserveConfirmedBill({
        tenantId: identity.tenantId, userId: identity.userId,
        quoteId: request.quoteId, quoteRevision: request.quoteRevision!,
        fulfillmentReference: prepared.fulfillmentReference,
        billerCode: prepared.billerCode, itemCode: prepared.itemCode,
        customerId: prepared.customerId, amount: prepared.amount, currency: "NGN",
      });
      if (
        prepared.state === "succeeded" ||
        prepared.state === "failed" ||
        prepared.state === "reversed" ||
        prepared.state === "manual_review"
      ) {
        await settle(identity, prepared);
        return prepared;
      }
      const dispatched = await service.dispatch(prepared.fulfillmentReference, {
        callbackUrl,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
      await settle(identity, dispatched);
      return dispatched;
    },

    async readPurchase(request) {
      const identity = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      const service = orchestrator(identity);
      const current = await input.billingStore(identity).read(request.reference);
      if (!current) throw new Error("financial.billing_not_found");
      if (!request.refresh ||
          ["failed","reversed","manual_review"].includes(current.state)) {
        await settle(identity, current);
        return current;
      }
      const reconciled = await service.reconcile(request.reference, request.signal);
      await settle(identity, reconciled);
      return reconciled;
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

