# Billing customer journey completion

User assignment: finish billing services before APK compilation, continuing the verified fixed-IP relay work. Base: production branch 78b53596ad6a0bd36d45e258d2c26b23c25f49fa.

Exact implementation paths already owned:
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

Ownership extension explicitly assigned by the user on 2026-10-04 to close the remaining
customer-billing blockers. New billing/auth-specific owned paths:
- `packages/commerce/src/billing-money.ts`
- `packages/commerce/src/billing-money.test.ts`
- `packages/commerce/migrations/0100_billing_ngn.sql`
- `adapters/storage/postgres/src/commerce/billing-funding.ts`
- `adapters/storage/postgres/src/commerce/billing-funding.integration.test.ts`
- `packages/providers/src/flutterwave-bills/funding-client.ts`
- `packages/providers/src/flutterwave-bills/funding-client.test.ts`
- `packages/security/src/platform-session.ts`
- `packages/security/src/platform-session.test.ts`
- `packages/security/migrations/0100_platform_sessions.sql`
- `adapters/storage/postgres/src/security/platform-session.ts`
- `adapters/storage/postgres/src/security/platform-session.integration.test.ts`
- `services/gateway/src/customer_auth.ts`
- `services/gateway/src/customer_auth.test.ts`
- `services/gateway/src/billing_checkout.ts`
- `services/gateway/src/billing_checkout.test.ts`
- `docs/BILLING-CUSTOMER-READINESS.md`
- this claim file.

Coordinated append-only/shared seams permitted for this continuation:
- `adapters/storage/postgres/src/commerce/index.ts` if present, otherwise the existing
  root `adapters/storage/postgres/src/index.ts` export seam;
- `adapters/storage/postgres/src/security/index.ts`;
- `packages/security/src/index.ts`;
- `packages/providers/src/index.ts`;
- existing billing-only Gateway route/composition files already listed above.
Any collision discovered on these shared seams must be reconciled from the newest source
before writing; no unrelated changes may be reverted.

Explicit non-ownership:
- no `apps/mobile/**` edits. PRs #104/#125 own the universal mobile shell.
- no PR #104 Agent shell files are edited on this branch. Billing exposes a generic
  action-executor/checkout seam that #104 can compose without product-specific widgets.
- no crypto/NOWPayments files, creator-clone files, channel ingress internals, existing
  AI-Credits/Float ledger files, or another workstream's migrations are modified.

Customer-billing completion contract:
1. Dedicated NGN custody is separate from AI Credits, creator Float and crypto balances.
   Immutable quotes bind tenant/user/category/biller/item/customer/service amount/fee/
   total/currency/expiry and exact revision.
2. Flutterwave checkout is server-created. Redirect/callback status is never funding
   authority. Server-side provider verification binds unique transaction evidence,
   exact tx_ref, successful status, NGN and the exact expected amount before reserve.
3. Reserve/settlement is atomic and idempotent. Success consumes the bound reserve;
   failed/reversed evidence releases it into refund custody; unknown/manual outcomes
   remain reserved. Changed retries conflict.
4. Public financial authority must resolve a current per-customer platform session;
   the shared Alpha token remains development-only and cannot authorize public billing.
   Opaque access/refresh tokens are stored only as hashes; refresh rotation and logout
   revoke prior credentials.
5. The billing Gateway emits generic ShellDocument-compatible checkout/receipt/progress
   projections and an action-executor seam. The active mobile-shell owner composes that
   seam; this billing branch does not overwrite mobile-owned files.
6. Catalog publication is fail-closed: only currently returned NG/NGN categories,
   billers and items are selectable, with recipient validation before quote where the
   provider requires it. Tests must exercise airtime, mobile data, cable/internet and
   electricity policy paths without pretending a single Airtel purchase qualifies every
   live customer account.

Relay modes: bearer remains the default for a relay with its own provider key. Explicit
dual-header mode matches the deployed DigitalOcean relay:
`x-masanawa-relay-token` authenticates the client while the provider bearer is sent
separately over TLS for upstream use. Redirect following is disabled.

Implemented before this extension: fail-closed confirmed quote/funding authority boundary;
no dispatch without a canonical Commerce reserve; terminal settlement boundary;
provider-derived recipient/category checks; exact decimal bounds; conservative
dispatch/requery handling; delayed electricity-token recovery.

Prior qualification: 151 Vitest tests and 11 webhook-proxy Node tests passed; Providers,
Commerce and Gateway typechecks passed. No further live financial purchase. Status:
active draft, NOT public billing/APK ready until the extended implementation and
environment/device acceptance are complete. Customer billing remains disabled during
implementation and must not be enabled merely because mocks pass.

Last update: 2026-10-04.
