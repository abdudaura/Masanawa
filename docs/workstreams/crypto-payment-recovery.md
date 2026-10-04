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
