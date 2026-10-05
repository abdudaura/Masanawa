# Crypto payment recovery continuation

Owner: crypto/payment continuation window, explicitly requested by user 2026-10-04.
Base: 78b53596ad6a0bd36d45e258d2c26b23c25f49fa
Branch: work/crypto-payment-recovery-20261004

Scope transferred from financial-ops: services/gateway/src/financial_service.ts only, plus new services/gateway/src/financial_replay.ts, services/gateway/src/financial_replay.test.ts and this claim. No Flutterwave relay, billing, deployment, Commerce storage, mobile, shared composition or provider adapter edits.

Current step: recover missing replay validation before provider dispatch. Existing service returns an old intent even when operation, asset, amount or withdrawal address changed. Both early replay and concurrent dispatch reuse must validate exact terms.

Remaining broader gaps: conversion/account capability qualification; segregated custody reconciliation; deposit status recovery after missing webhook; payout account credentials and verification; confirmed quote/fee flow; end-to-end mobile/channel acceptance. Not represented as complete.

Implementation/tests/deployment: pending. Production deployment remains with the Flutterwave integration window.

## Implementation checkpoint

Replay validation now checks operation, exact asset/network, exact decimal amount, destination, target asset and provider. Applied to initial reads, create/reserve admission results and dispatch custody results, so concurrent reuse cannot silently change terms. Unknown dispatch remains protected by the existing no-redispatch guard.

Verification: Vitest 5.0.3, 1 file / 10 tests passed locally; precision regression distinguishes amounts differing beyond JavaScript floating-point precision. Full Gateway typecheck/integration, PostgreSQL acceptance and hosted deployment are not claimed. PR #124 is the reviewable continuation; production source and credentials untouched. Other listed commercial gaps remain open.

## Continued recovery scope

User explicitly directed continued work. Additional exact owned paths: adapters/crypto/nowpayments/src/client.ts (read-only full payment evidence method), services/gateway/src/financial_payment_evidence.ts and its test. Existing readIntent route will reconcile an authenticated bound deposit from complete provider evidence; status strings alone cannot authorize credits. No billing/shared route/deployment edits.

## Deposit recovery checkpoint

Implemented on 115895160b184b1166b1a30e09c7ef028af53c34: readIntent rechecks a bound non-terminal deposit through authenticated GET /payment/:id, bounded by 15 seconds. The new evidence parser checks exact payment/order/asset/decimal principal and required paid amounts; canonical applyProviderPaymentEvent remains the ledger owner. No status-only crediting or redispatch. Provider outage, malformed data and evidence mismatches fail closed. Terminal reads and unbound unknown dispatches do not query or dispatch.

Verification: 23 tests in 2 files passed locally (Vitest 5.0.3), covering exact retries, precision beyond floating-point, wrong payment/order/currency/principal, invalid/absent paid amounts, unsafe numeric IDs and stable admitted evidence hashes. These are unit checks, not complete service or PostgreSQL acceptance. Production unchanged. Conversion, custody/provider balance reconciliation, payout qualification, fees/confirmation and channel/device acceptance remain outstanding.

## Complete service qualification scope

Additional isolated paths: services/gateway/src/financial_service.test.ts; adapters/crypto/nowpayments/src/payout.ts and payout.test.ts. Financial service will require fresh account and exact-route evidence before withdrawal admission. Test snapshot is isolated from the active billing checkout. Shared runtime composition, applied migrations, Commerce storage and deployment remain unowned and unchanged.

## Service acceptance and external blockers — 2026-10-04

Implementation head: 979931c715051e45a13285e45fbe0d183718bba9. Added actual financial-service tests, fresh custody/customer-management/payout/IP/destination-whitelist and exact-route eligibility, numeric-wire precision guards before principal reservation/authentication, bounded provider dispatch/requery, terminal payout verification guard, exact signed IPN paid amounts and principal/currency validation.

Fresh verification in isolated recovered runtime snapshot: 186 passed, 29 database-dependent skipped, 25 passed files/2 skipped files; Gateway, NOWPayments and PostgreSQL adapter strict typechecks passed. This snapshot contains newer billing tests from the active billing window, preserved and not published by this workstream. No real PostgreSQL, physical app or hosted acceptance claimed.

Confirmed Railway variable inventory contains NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET, but neither NOWPAYMENTS_PAYOUT_EMAIL nor NOWPAYMENTS_PAYOUT_PASSWORD. Values were redacted. No fresh provider custody/customer-management/conversion/withdrawal-route evidence is available. API key/catalog evidence does not qualify those operations. Runtime composition must supply withdrawalEvidence from a provider-qualified owner port; default remains unavailable. Provider-authenticated account setup and custody evidence block production conversion/withdrawal/reconciliation qualification.

Shared dependency requests: #100 owns deployment/runtime integration; #104 owns mobile and shared shell surfaces; Commerce storage remains actively owned. These paths are unchanged. Integrators must preserve billing relay code, wire fresh evidence, run real PostgreSQL financial acceptance and app/channel journey tests before commercial availability. Conversion ledger settlement, provider segregated customer custody reconciliation and confirmed fee quotes remain required, not completed. No merged-main/production completion claim.

## Custody/conversion continuation — 2026-10-04

The user has now confirmed that NOWPayments Custody and Conversions are enabled on the merchant account, and the production Railway worker contains payout email/password variable names alongside the existing API key/IPN secret. Treat this as operator confirmation only: do not hard-code permanent eligibility. Consequential admission still requires fresh runtime/provider evidence for custody, conversion, payout, IP whitelist and exact asset/network operation support.

Expanded non-overlapping provider/service ownership for this continuation:
- new `adapters/crypto/nowpayments/src/custody.ts` and `custody.test.ts`;
- `adapters/crypto/nowpayments/src/index.ts`;
- existing owned `adapters/crypto/nowpayments/src/payout.ts` and `payout.test.ts`;
- existing transferred `services/gateway/src/financial_service.ts` and `financial_service.test.ts`;
- new `services/gateway/src/financial_payout_evidence.ts` and `financial_payout_evidence.test.ts` for signed payout callback admission;
- this claim file.

The continuation may add authenticated custody balance/conversion API operations, conversion reconciliation evidence, payout address/minimum/network-fee preflight and service-level qualification. It must not edit `packages/commerce/**`, `adapters/storage/postgres/src/commerce/**`, mobile, shared runtime composition or deployment because those remain separately owned.

Canonical atomic conversion settlement is a shared dependency: Commerce/PostgreSQL must reserve/debit the exact source balance and post the evidenced target credit exactly once before user-facing conversion execution can be advertised. This branch may define/provider-test the required evidence, but it must not create a second ledger owner or execute a conversion before that atomic boundary exists.


## Payout callback continuation

The crypto window additionally owns signed NOWPayments payout callback admission and exact binding to the stored withdrawal. The payout callback must be HMAC verified, identify the canonical tenant/request through a provider external id, match the stored batch id, exact asset, exact principal and exact destination, and only then may terminal provider status settle or release the canonical withdrawal reserve. Runtime route composition remains owned by the integration/deployment window.


## Canonical ledger ownership transfer — 2026-10-04

PR #102 (`work/integration-financial-ops-20261004`) is merged into this PR's base branch. Its integration claim is therefore no longer an active competing window. The crypto continuation now takes exact ownership of the following remaining crypto-only canonical paths:
- `packages/commerce/src/crypto.ts`;
- `adapters/storage/postgres/src/commerce/crypto-repository.ts`;
- new `packages/commerce/migrations/0007_crypto_conversion_fees.sql`;
- new crypto repository integration tests required for these changes.

Purpose of the transfer: implement atomic conversion reserve/bind/settle, durable provider conversion identity, durable withdrawal network-fee reserve/release accounting, and reconciliation/liability helpers required by the already-owned financial service. Do not edit unrelated billing, channel, workflow, mobile, deployment, or shared Commerce repository paths.

Applied migrations are immutable. `0005_crypto_assets.sql` will not be modified; all schema evolution is additive in `0007_crypto_conversion_fees.sql`.


## NOWPayments adapter successor ownership — 2026-10-05

PR #98 (`work/integration-nowpayments-live-20261004`) is retained as a frozen live/read-only verification checkpoint. Its adapter snapshot was already imported into the financial-integration lineage consumed by this continuation and it has not advanced since that handoff. The user explicitly continued the crypto implementation in PR #124.

PR #124 is therefore the successor writer for crypto-specific NOWPayments adapter evolution required by this workstream, including:
- `adapters/crypto/nowpayments/src/client.ts`;
- `adapters/crypto/nowpayments/src/payment.ts` and `payment.test.ts`;
- `adapters/crypto/nowpayments/src/custody.ts` and `custody.test.ts`;
- `adapters/crypto/nowpayments/src/payout.ts` and `payout.test.ts`;
- `adapters/crypto/nowpayments/src/index.ts`;
- associated crypto-only adapter tests needed by those files.

PR #98 has been notified not to add further adapter commits without re-coordination. Runtime/deployment composition is still excluded from this ownership.


## Fixed-egress relay continuation — 2026-10-05

NOWPayments payout/custody operations require IP-whitelisted egress. Railway does not provide the fixed source IP required for that guarantee. This workstream therefore additionally owns:
- new `scripts/nowpayments-fixed-egress-relay.mjs` and focused relay tests;
- relay-base/token support inside the already-owned NOWPayments clients.

The relay must use a fixed NOWPayments upstream, a strict method/path allowlist, HTTPS at the public edge, a dedicated `x-masanawa-relay-token` credential, bounded bodies/timeouts, no request-body logging, and must preserve NOWPayments `x-api-key` plus provider JWT `Authorization` headers upstream. It is intended to run on the existing `masanawa-relay-bridge` DigitalOcean droplet (public IP 209.38.107.173), not on a second server.

Deployment/Caddy/systemd changes remain runtime-owned because the connected DigitalOcean capability does not expose SSH command execution. Production must remain fail-closed until the relay is deployed and 209.38.107.173 is whitelisted in NOWPayments.

## Fiat Buy reconciliation checkpoint — 2026-10-05

Hosted fiat Buy is now durable across a missed first callback. `NowPaymentsCustodyClient.findPaymentEvidence` authenticates server-side and reads at
most 100 recent provider payments through the existing NOWPayments base/relay,
requiring one exact `order_id` + `invoice_id` match. No match leaves the
canonical Buy pending; more than one match fails closed as ambiguous. The fixed-egress
relay allowlist now admits only the authenticated GET `/v1/payment/` list path
in addition to the previously allowed exact payment identity endpoint, and preserves
query parameters. This continues to target the existing 209.38.107.173 relay only.

`refreshFiatPurchase` uses that lookup only when an admitted hosted invoice has
no known provider payment id (the missed-IPN case). Any recovered row is passed through
the same exact fiat invoice/order/amount/currency and final `outcome_amount` /
`outcome_currency` admission before the repository can credit customer crypto.
Once a payment id is known, reconciliation remains payment-id-bound and rejects a
changed provider identity.

Focused tests were added for exact recovery, absent evidence and ambiguous evidence.
GitHub Foundation CI run 1867 on commit
`e61ed2c60f7ac006547f2b7a5f6256197cc1f382` failed before executing any
steps (the job reports an empty step list and exposes no log blob), so it is not
application verification. Runtime/Gateway route composition remains owned by PR #100;
production session authority remains owned by PR #128. Those owners must wire the
published Buy routes/capability and normal production-session FinancialAuthorizer.

