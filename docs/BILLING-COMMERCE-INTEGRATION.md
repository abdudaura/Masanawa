# Billing Commerce Integration

Status: implementation contract for the stacked Flutterwave billing integration.

## What this slice completes

The Flutterwave adapter in PR #95 discovers the live Nigerian bill catalog, validates
recipients, dispatches a bill payment and requeries the provider reference. This
integration adds the safety and lifecycle boundary required to use that adapter from
canonical Masanawa Commerce without allowing a channel, model or provider response to
become financial truth.

The orchestration is deliberately injected through ports. The active Commerce window
still owns durable ledger/reserve/settlement storage and the active Gateway/channel/chat
windows own authenticated transport and UI binding.

## Required paid flow

1. Canonical Commerce selects an active Offer revision and creates an unexpired quote.
2. The user sees the exact product, recipient/account and final price and explicitly
   confirms that quote.
3. Commerce admits one fulfillment and persists one immutable fulfillment reference.
4. Billing validates the recipient against the exact provider item and biller for bill types that require validation. Flutterwave documents airtime and mobile-data bills as not requiring this validation step; those flows still bind the exact catalog item, phone recipient and provider amount.
5. The integration persists the validated provider terms under that same fulfillment
   reference. The NGN dispatch amount is compared exactly, as a decimal value, with the
   selected live catalog item's provider amount before the record can become ready.
6. Dispatch first moves the record to `dispatching`; only then may the provider POST run.
7. A successful provider result is accepted only when reference, NGN amount and recipient
   match the confirmed record.
8. A timeout, transport loss or provider 5xx becomes `checking`. Every subsequent retry
   requeries the original reference. It never issues another payment POST.
9. A provider 404 while checking is not permission to redispatch.
10. Mismatched or incomplete success evidence becomes `manual_review`; it does not settle.
11. Only canonical Commerce may release reserves, settle creator earnings/platform margin,
    or issue refunds/reversals after consuming verified evidence.
12. App, WhatsApp and Telegram render the same transport-neutral receipt projection.

## Creator economics

The provider amount is fulfillment cost, not retail authority. Masanawa Offer/quote data
owns customer price, creator commission, fallback commission and platform margin.
Provider catalog discovery must therefore never overwrite Offer economics. A creator or
digital twin may acquire the customer relationship but cannot alter provider cost,
settlement evidence or ledger transfers.

## Receipt and recovery behavior

Receipt projections expose product, recipient, amount, Masanawa fulfillment reference,
provider reference when present, and a bounded status. `checking` is refreshable but
not retryable. `ready` may be dispatched once after valid confirmation. Success
evidence mismatches are review-only.

This contract is designed for process restarts: a persisted `dispatching` or
`checking` record always resumes with provider status requery. That protects against
the classic timeout-after-success duplicate-bill failure.

## Remaining composition owned by other active workstreams

No conflicting shared path is edited here. Integration still requires the current owners
to bind these contracts to:

- canonical Commerce Offer/quote/admission/reserve/settlement/refund persistence;
- the durable billing fulfillment store implementation;
- authenticated Gateway action confirmation and idempotency identity;
- app chat-action rendering and restart journal;
- WhatsApp and Telegram outbound replies/receipts;
- webhook evidence deduplication when provider callbacks are enabled;
- production environment registration, Flutterwave account qualification and any
  provider IP allow-list requirement.

The provider-side implementation in this branch also includes a production HTTPS transport,
Security CredentialRef-resolved client construction, and deterministic catalog-to-Offer-draft
projection. The raw secret is resolved at the adapter edge for each operation rather than
stored in a configuration object.

Flutterwave currently documents Nigerian bill payments as requiring completed profile/KYC,
a funded source balance and server-IP whitelisting. Those are provider-account launch
requirements, not code-side defaults.

Those remaining steps are composition/deployment work, not permission to duplicate the
commerce, wallet, action or channel state machines.
