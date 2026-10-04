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
}>): BillingFinancialService {
  const secretKey = input.flutterwaveSecretKey.trim();
  const webhookHash = input.flutterwaveWebhookHash.trim();
  if (!secretKey) throw new Error("flutterwave.secret_key.required");
  if (!webhookHash) throw new Error("flutterwave.webhook_hash.required");

  const provider = new FlutterwaveBillsClient({
    secretKey,
    transport: new FlutterwaveHttpTransport(),
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
      const service = orchestrator(identity);
      const prepared = await service.prepare({
        fulfillmentReference: request.requestId,
        billerCode: request.billerCode,
        itemCode: request.itemCode,
        itemName: request.itemName,
        customerId: request.customerId,
        amount: request.amount,
        catalogAmount: request.catalogAmount,
        ...(request.recipientValidation === undefined
          ? {}
          : { recipientValidation: request.recipientValidation }),
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
      if (
        prepared.state === "succeeded" ||
        prepared.state === "failed" ||
        prepared.state === "reversed" ||
        prepared.state === "manual_review"
      ) {
        return prepared;
      }
      return service.dispatch(prepared.fulfillmentReference, {
        callbackUrl,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });
    },

    async readPurchase(request) {
      const identity = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      const service = orchestrator(identity);
      const current = await input.billingStore(identity).read(request.reference);
      if (!current) throw new Error("financial.billing_not_found");
      if (!request.refresh ||
          ["succeeded","failed","reversed","manual_review"].includes(current.state)) {
        return current;
      }
      return service.reconcile(request.reference, request.signal);
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
