# Flutterwave Bills Adapter

Status: isolated `bills-flutterwave` implementation slice. This adapter is not wired to production composition and is not provider/account certification.

## Boundary

`packages/providers/src/flutterwave-bills/client.ts` implements the transport-neutral Flutterwave Bills edge required by the digital-commerce launch overlay. It owns no Offer, quote, wallet, ledger, fulfillment, approval, chat or channel truth.

The canonical caller must supply the exact server-owned biller/item, recipient, quoted amount and persistent fulfillment reference. The adapter preserves those identifiers and returns provider evidence; Commerce decides whether that evidence satisfies a fulfillment transition.

## Supported flow

1. Discover current Nigerian bill categories.
2. Discover current billers for a category.
3. Discover current items/packages for a biller.
4. Validate customer identifiers where the product requires it.
5. Dispatch a single bill payment with the caller's persistent reference.
6. Requery that exact reference until a terminal provider result is evidenced.

Airtime/data validation policy belongs above this adapter: Flutterwave currently documents that airtime and data do not require the separate validation call, while meter/smart-card/internet identifiers should be validated.

## Safety and recovery

- Catalog is provider-derived; no MTN/data/package inventory is hard-coded.
- Current launch qualification is Nigeria/NGN only.
- Provider response bodies are not copied into typed error messages.
- A failed GET may be retried according to caller policy.
- A POST transport failure or 5xx is **outcome unknown**, not failed. The caller must call `getStatus(reference)` before considering any redispatch.
- HTTP 404 from status means the provider did not find that reference at query time; it is not by itself permission to duplicate a purchase.
- Provider success is evidence only. Canonical Commerce still verifies the expected recipient, amount, quote/fulfillment binding and settlement rules.
- Secret-key custody is intentionally not implemented here. Production composition must resolve a scoped Security `CredentialRef` at the adapter edge.

## Current Flutterwave contract used

The implementation follows the documented v3 Bills flow: `/v3/top-bill-categories`, `/v3/bills/{category}/billers`, `/v3/billers/{biller}/items`, `/v3/bill-items/{item}/validate`, `/v3/billers/{biller}/items/{item}/payment`, and `/v3/bills/{reference}`.

Provider documentation also requires a funded source balance, completed KYC and whitelisted server IPs for bill payments. Those are deployment/account readiness gates, not assumptions made by this code.

## Integration still required

- coordinated package export/composition wiring;
- scoped CredentialRef resolution;
- Commerce Offer/catalog projection and quote binding;
- durable fulfillment dispatch/reconciliation;
- webhook evidence ingestion and deduplication;
- chat-actions rendering and app/WhatsApp/Telegram journey;
- authenticated live account catalog/validation/dispatch/requery qualification;
- production environment and IP-whitelist readiness.

Do not claim live bill purchases or production readiness from this slice.
