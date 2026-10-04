# Workstream claim — integration / Billing Commerce

- Owner/window: ChatGPT billing completion window, 2026-10-04.
- Branch: `work/integration-billing-commerce-20261004`.
- Base: Flutterwave bills PR #95 head `5b304dad76714525fa3bf59c7b2a61b7f6f9a702`.
- Purpose: complete provider-neutral billing orchestration around the Flutterwave bills adapter without editing active Commerce, Gateway, channel, chat-renderer, runtime, migration, package-export or deployment owners.
- Owned paths:
  - `docs/workstreams/integration-billing-commerce.md`
  - `docs/BILLING-COMMERCE-INTEGRATION.md`
  - `packages/providers/src/flutterwave-bills/commerce-orchestrator.ts`
  - `packages/providers/src/flutterwave-bills/commerce-orchestrator.test.ts`
  - `packages/providers/src/flutterwave-bills/receipt-projection.ts`
  - `packages/providers/src/flutterwave-bills/receipt-projection.test.ts`
  - `packages/providers/src/flutterwave-bills/http-transport.ts`
  - `packages/providers/src/flutterwave-bills/http-transport.test.ts`
  - `packages/providers/src/flutterwave-bills/credential-client.ts`
  - `packages/providers/src/flutterwave-bills/credential-client.test.ts`
  - `packages/providers/src/flutterwave-bills/catalog-projection.ts`
  - `packages/providers/src/flutterwave-bills/catalog-projection.test.ts`
  - `packages/providers/src/flutterwave-bills/webhook.ts`
  - `packages/providers/src/flutterwave-bills/webhook.test.ts`
- Dependencies:
  - consumes Flutterwave adapter contracts from stacked PR #95;
  - consumes canonical Commerce Offer/quote/fulfillment/ledger through injected ports only;
  - uses existing Security CredentialRef contracts through the public `@masanawa/security` API without modifying Security-owned files;
  - persistent repository implementation, Gateway routes, chat-action projection, app/WhatsApp/Telegram transport binding and production deployment remain owned by their current workstreams.
- Safety invariants: server-owned quote terms and fulfillment reference only; validated recipient binding where Flutterwave requires it; no blind redispatch after ambiguous provider outcome; exact requery before retry; provider evidence must match expected amount/recipient/reference before success; duplicate confirmation/retry reuses one fulfillment identity; provider response/webhook never becomes ledger authority by itself; raw Flutterwave credentials exist only inside `CredentialSecret.use(...)`.
- Current step: provider/integration implementation complete within this claim; awaiting shared-owner composition and live account qualification.
- Last update: 2026-10-04 18:32 +01.
- Implementation status: implemented on branch, 14 exact claimed files.
- Verification status: source/diff and changed-file scope reviewed. Foundation CI run 967 on head `656eed9be8067b6e974399a5f53a0394e828ce5a` failed before exposing executable job steps/logs, so no application test pass or failure is claimed from CI.
- Deployment status: not deployed.
- Collision rule: no edits outside the exact owned paths above.

## Implemented

- production Flutterwave HTTPS transport with bounded timeout;
- scoped Security CredentialRef resolution at the provider edge;
- dynamic live catalog -> deterministic Masanawa Offer-draft projection with provider cost separated from retail economics;
- validated-recipient preparation for bill types that require validation, with airtime/data no-validation support;
- exact provider catalog amount binding before dispatch;
- immutable fulfillment-reference binding and compare-and-set lifecycle;
- dispatch-before-POST persistence and restart-safe reconciliation;
- timeout/transport/5xx ambiguity -> checking, never blind redispatch;
- provider 404 while checking does not authorize a second purchase;
- success accepted only on matching reference/NGN amount/recipient evidence; mismatch -> manual review;
- transport-neutral receipt projection for app/WhatsApp/Telegram integration;
- Flutterwave v3 `verif-hash` webhook verification with raw-body fingerprinting; webhook payload is evidence only and cannot settle;
- regression tests for orchestration, receipt projection, HTTP transport, CredentialRef use, catalog economics and webhook verification.

## Coordination completed

- PR #90 Commerce owner was given the durable fulfillment-store/custody/settlement dependency.
- PR #91 chat-shell owner was given the canonical billing receipt/retry-refresh contract.
- PR #92 channel owner was given the WhatsApp/Telegram opaque-action and no-redispatch contract.
- No Commerce/Gateway/mobile/channel/storage/migration/package-export/deployment files were edited here.

## Remaining shared/external handoff

- Commerce owner: persist the billing fulfillment store against canonical admission/custody and consume verified evidence for settlement/refund/reversal.
- Gateway owner: authenticated quote confirmation, stable action/request identity, webhook route and evidence dedupe/reconciliation.
- Chat/channel owners: bind receipt projection and refresh semantics to app, WhatsApp and Telegram.
- Integration owner: package export/composition and production environment registration after active ownership permits.
- Provider account: supply Flutterwave secret key through CredentialRef/deployment secret storage, configure a separate webhook secret hash, complete account/KYC requirements, fund the bill-payment source balance and whitelist the production server IP where required.
- Live qualification: authenticated catalog discovery, representative validation/no-validation flows, controlled bill purchase, status requery and webhook/restart/ambiguous-outcome verification.

No live purchase, settlement, deployment or production certification is claimed until those shared/external steps are evidenced.
