# J05 / C54 — canonical tenant-private billing receipt

This consumer feature reads the already existing, authorized
GET /v1/commerce/bills/purchases/:reference. Backend:
services/gateway/src/billing_routes.ts, financial_billing.ts.
Data: existing createPostgresBillingFulfillmentStore over
commerce.billing_fulfillments (tenant+user+reference), with existing webhook,
outbox reconciliation and projectBillingReceipt. There is no new financial
authority, ledger, SQL migration, queue, provider call on page entry, or P2P.

AF00 composition required (protected root paths):
1. Pass the existing signed-in Dio, canonical feature-enabled flag and account
   generation to DioBillReceiptReader and BillReceiptScreen.
2. Open C54 from Bills status and Wallet activity only for genuine bill
   fulfillment references; do not reinterpret legacy Twin/gift entries.
3. Bind onAskGwani to existing case/report flow with this reference prefilled.
   No automatic chat switch or money execution.

Required pinned-SHA verification:
- cd apps/mobile && flutter pub get && flutter analyze &&
  flutter test test/features/wallet/billing_receipt_screen_test.dart
- pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:ci
- PG18 disposable tenant/fan negative lookup, fresh/upgrade/restore migrations,
  worker restart and provider webhook deduplication.
- Flutter release APK and low-end Android account-switch/offline/retry test.
- Confirm pending never displays as settled, a successful electricity token
  appears only on provider evidence, no retry dispatches a second purchase,
  reversible status displays properly and support receives the same reference.

No existing financial data changed. Not a live financial qualification; tests
added are source until executed against the exact unified integration SHA.
