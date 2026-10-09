import type { BillingFundingAuthority } from "@masanawa/commerce";
import {
  BillingCommerceOrchestrator,
  FlutterwaveBillsClient,
  FlutterwaveBillProviderError,
  FlutterwaveHttpTransport,
  verifyFlutterwaveV3Webhook,
  FlutterwaveWebhookError,
  type BillingFulfillmentRecord,
} from "@masanawa/providers";
import type { BillingFulfillmentStore } from "@masanawa/providers";

export interface BillingFinancialAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<Readonly<{ tenantId: string; userId: string }>>;
}

export interface BillingWebhookAdmissionRepository {
  admitProviderWebhook(input: Readonly<{
    provider: string;
    fingerprint: string;
    eventKey: string;
    receivedAt: string;
    payload: Readonly<Record<string, unknown>>;
  }>): Promise<Readonly<{ duplicate: boolean }>>;
}

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
  purchaseOwned(input: Readonly<{
    tenantId: string;
    userId: string;
    requestId: string;
    quoteId: string;
    quoteRevision: number;
    categoryCode?: string;
    billerCode: string;
    itemCode: string;
    itemName: string;
    customerId: string;
    amount: string;
    signal?: AbortSignal;
  }>): Promise<BillingFulfillmentRecord>;
  readPurchase(input: Readonly<{
    authorizationHeader: string | undefined;
    reference: string;
    refresh?: boolean;
    signal?: AbortSignal;
  }>): Promise<BillingFulfillmentRecord>;
  /** Server-internal owner-scoped reconciliation after trusted webhook/status evidence. */
  reconcileOwnedPurchase(input: Readonly<{
    tenantId: string;
    userId: string;
    reference: string;
    signal?: AbortSignal;
  }>): Promise<BillingFulfillmentRecord>;
  receiveWebhook(input: Readonly<{
    rawBody: Uint8Array;
    verifHash: string | null | undefined;
  }>): Promise<Readonly<{ duplicate: boolean; reference: string | null }>>;
}

function referenceFromWebhook(payload: Readonly<Record<string, unknown>>): string | null {
  const data = typeof payload.data === "object" && payload.data !== null &&
    !Array.isArray(payload.data) ? payload.data as Record<string, unknown> : null;

  // Flutterwave's customer reference is the internal fulfillment identifier.
  // A generic provider reference can be different; never let it override an
  // explicit customer reference or silently pick between contradictory aliases.
  function resolve(candidates: readonly unknown[]): string | null {
    const values: string[] = [];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const value = candidate.trim();
      if (!value) continue;
      if (value.length > 128 || /[\\u0000-\\u001f\\u007f]/u.test(value)) {
        throw new FlutterwaveWebhookError(
          "invalid_webhook",
          "Flutterwave webhook reference is invalid",
        );
      }
      values.push(value);
    }
    if (new Set(values).size > 1) {
      throw new FlutterwaveWebhookError(
        "invalid_webhook",
        "Flutterwave webhook has conflicting fulfillment references",
      );
    }
    return values[0] ?? null;
  }

  return resolve([
    payload.customer_reference, payload.tx_ref,
    data?.customer_reference, data?.tx_ref,
  ]) ?? resolve([payload.reference, data?.reference]);
}

export function createBillingFinancialService(input: Readonly<{
  billingStore: (identity: Readonly<{ tenantId: string; userId: string }>) => BillingFulfillmentStore;
  webhookRepository: BillingWebhookAdmissionRepository;
  authorizer: BillingFinancialAuthorizer;
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

  async function readForIdentity(
    identity: Readonly<{ tenantId: string; userId: string }>,
    reference: string,
    refresh: boolean,
    signal?: AbortSignal,
  ): Promise<BillingFulfillmentRecord> {
    const service = orchestrator(identity);
    const current = await input.billingStore(identity).read(reference);
    if (!current) throw new Error("financial.billing_not_found");
    if (!refresh || ["failed","reversed"].includes(current.state)) {
      await settle(identity,current);
      return current;
    }
    let reconciled: BillingFulfillmentRecord;
    try {
      reconciled = await service.reconcile(reference, signal);
    } catch (error) {
      // A previously persisted success must not become a false failure when
      // the provider is temporarily unreachable. A later available refresh
      // can still observe a reversal. Never mask an unsettled/unknown result.
      // A database concurrency/settlement failure is never a provider outage.
      if (current.state !== "succeeded" ||
          !(error instanceof FlutterwaveBillProviderError) || !error.retryable) throw error;
      await settle(identity, current);
      return current;
    }
    await settle(identity, reconciled);
    return reconciled;
  }

  async function purchaseForIdentity(
    identity: Readonly<{ tenantId: string; userId: string }>,
    request: Readonly<{
      requestId: string;
      quoteId: string;
      quoteRevision: number;
      categoryCode?: string;
      billerCode: string;
      itemCode: string;
      itemName: string;
      customerId: string;
      amount: string;
      signal?: AbortSignal;
    }>,
  ): Promise<BillingFulfillmentRecord> {
    if (!input.billingFunding) throw new Error("financial.billing.funding_unavailable");
    if (!request.quoteId.trim() || !Number.isSafeInteger(request.quoteRevision) ||
        request.quoteRevision < 1) throw new Error("financial.billing.confirmed_quote_required");
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
      if (!billers.some((entry) => entry.billerCode === selected.billerCode)) {
        throw new Error("financial.billing.catalog_biller_mismatch");
      }
      if (category.code === "AIRTIME" || category.code === "MOBILEDATA") {
        if (!/^(?:0[789]\d{9}|\+?234[789]\d{9})$/u.test(request.customerId)) {
          throw new Error("financial.billing.phone_invalid");
        }
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
      recipientValidation,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    await input.billingFunding.reserveConfirmedBill({
      tenantId: identity.tenantId,
      userId: identity.userId,
      quoteId: request.quoteId,
      quoteRevision: request.quoteRevision,
      fulfillmentReference: prepared.fulfillmentReference,
      categoryCode: request.categoryCode ?? null,
      billerCode: prepared.billerCode,
      itemCode: prepared.itemCode,
      customerId: prepared.customerId,
      amount: prepared.amount,
      currency: "NGN",
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
      const identity = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      if (!request.quoteId?.trim() || !Number.isSafeInteger(request.quoteRevision)) {
        throw new Error("financial.billing.confirmed_quote_required");
      }
      return purchaseForIdentity(identity, {
        requestId: request.requestId,
        quoteId: request.quoteId,
        quoteRevision: request.quoteRevision!,
        ...(request.categoryCode ? { categoryCode: request.categoryCode } : {}),
        billerCode: request.billerCode,
        itemCode: request.itemCode,
        itemName: request.itemName,
        customerId: request.customerId,
        amount: request.amount,
        ...(request.signal ? { signal: request.signal } : {}),
      });
    },

    async purchaseOwned(request) {
      return purchaseForIdentity(
        { tenantId: request.tenantId, userId: request.userId },
        request,
      );
    },

    async readPurchase(request) {
      const identity = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      return readForIdentity(
        identity,
        request.reference,
        request.refresh === true,
        request.signal,
      );
    },

    async reconcileOwnedPurchase(request) {
      return readForIdentity(
        { tenantId: request.tenantId, userId: request.userId },
        request.reference,
        true,
        request.signal,
      );
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

