# Billing customer readiness

The existing live NGN100 Airtel test succeeded through the DigitalOcean relay at 209.38.107.173. It proves provider access, not customer checkout or all-category qualification.

This branch fixes duplicate-purchase hazards and adds a required canonical Commerce funding boundary. It is intentionally a draft until the remaining implementation is finished. Customer billing remains disabled in production.

Implemented and checked:
- Exact missing-reference HTTP400 handling, malformed/duplicate-reference dispatch reconciliation, database-failure dispatch protection, exact decimal recipient limits and receipt binding.
- Deployed dual-header relay compatibility (opt-in FLUTTERWAVE_RELAY_PROTOCOL=dual-header); legacy bearer mode retained; redirects blocked.
- Verified prepaid token persistence/projection and delayed-token status refresh without redispatch.
- Server catalog and category membership determine validation policy; client recipientValidation cannot bypass validation.
- Purchase API requires quoteId/quoteRevision and an injected BillingFundingAuthority that atomically validates confirmation, quote owner/terms/expiry and verified NGN funds. Dispatch waits for the reserve; successful/failed/reversed evidence calls idempotent settlement.

Incomplete release requirements:
1. Implement the production NGN funding/quote authority in canonical Commerce/Postgres. The current new interface is only a guard, not a wallet/payment implementation. Verify deposits server-side; bind unique payment evidence and exact quote terms; add durable settlement, cancellation/refund and reconciliation custody. Keep NGN separate from AI Credits and creator/agent assets.
2. Replace shared alpha-token identity with authenticated per-customer financial authority before general release. Current hosted billing composition uses alpha scope and is not a public customer authentication system.
3. Integrate the finished Gateway billing/finance runtime with mobile-shell #104/#125 and its generic Shell actions: dynamic catalog, recipient/package selection, fee-inclusive immutable quote, explicit confirmation, funding/checkout, progress, electricity token and receipt/history. The APK branch currently lacks the production billing integration.
4. Qualify every account-enabled category using read-only catalog/recipient checks and funded mock/DB end-to-end acceptance. A completed airtime test does not qualify cable, internet or electricity. Publish only available account-enabled offerings; do not claim universal biller availability.
5. Verify real Flutter analysis/tests, APK build and physical-device customer journeys on the final integrated source. No APK/device verification has been performed here.

Evidence: 151 Vitest tests across Providers billing, Commerce and Gateway; 11 Node webhook proxy tests; strict Providers, Commerce and Gateway typechecks. No additional live purchase and no new production deployment in this batch.

Provider references: https://developer.flutterwave.com/docs/bill-payment (tokens in extra), https://developer.flutterwave.com/docs/transaction-verification (server-side payment verification). Quotes and browser callback statuses alone never authorize customer funds.
