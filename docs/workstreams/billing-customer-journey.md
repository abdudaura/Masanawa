# Billing customer journey completion

User assignment: finish billing services before APK compilation, continuing the verified fixed-IP relay work. Base: production branch 78b53596ad6a0bd36d45e258d2c26b23c25f49fa.

Exact implementation paths:
- `packages/providers/src/flutterwave-bills/client.ts`
- `packages/providers/src/flutterwave-bills/client.test.ts`
- `packages/providers/src/flutterwave-bills/commerce-orchestrator.ts`
- `packages/providers/src/flutterwave-bills/commerce-orchestrator.test.ts`
- `packages/providers/src/flutterwave-bills/http-transport.ts`
- `packages/providers/src/flutterwave-bills/http-transport.test.ts`
- `packages/providers/src/flutterwave-bills/receipt-projection.ts`
- `packages/providers/src/flutterwave-bills/receipt-projection.test.ts`
- `services/gateway/src/financial_billing.ts`
- `services/gateway/src/financial_billing.test.ts`
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `packages/commerce/src/index.ts`
- `packages/commerce/src/billing-funding.ts`

Additional owned documentation: this claim and docs/BILLING-CUSTOMER-READINESS.md. No apps/mobile, crypto, clone onboarding, messaging, existing float-owned Commerce files or migrations are edited. Gateway composition changes are billing-only on the production base; the mobile-shell owner must integrate these seams without replacing other Gateway changes.

Relay modes: bearer remains the default for a relay with its own provider key. Explicit dual-header mode matches the deployed DigitalOcean relay: x-masanawa-relay-token authenticates the client, while the provider bearer is sent separately over TLS for upstream use. The provider key is never substituted for the relay client credential or written into Git. Redirect following is disabled.

Implemented: fail-closed confirmed quote/funding authority boundary; no dispatch without a canonical Commerce reserve; terminal settlement boundary; provider-derived recipient/category checks; exact decimal bounds; conservative dispatch/requery handling; delayed electricity token recovery.

Qualification: 151 Vitest tests and 11 webhook-proxy Node tests pass; Providers, Commerce and Gateway typechecks pass. No further live financial purchase. Status: active draft, NOT public billing/APK ready. Concrete missing dependencies are recorded in the readiness document. The funding authority interface has no production implementation/wiring yet, so customer purchases remain disabled; do not enable the feature or mistake mocked funding tests for funded checkout qualification.
