# Workstream — billing current-main integration

Owner/window: ChatGPT billing continuation, explicitly continued by the user on 2026-10-05.
Branch: `work/billing-main-integration-20261005`
Base: current `main`.
Dependency: draft billing implementation PR #126 / branch
`work/billing-customer-journey-20261004`.

## Purpose

Reconstruct the completed customer-billing/auth slice on current `main` without
merging the heavily diverged historical #126 tree or reverting work already merged by
other windows. Preserve all current-main product, mobile-shell, channel, crypto,
teaching, creator-economy and admin work.

## Owned integration paths

This workstream may create/carry the billing-specific files already owned by #126:
- `packages/commerce/src/billing-money.ts`
- `packages/commerce/src/billing-money.test.ts`
- `packages/commerce/src/billing-funding.ts`
- `packages/commerce/migrations/0100_billing_ngn.sql`
- `packages/providers/src/flutterwave-bills/**` billing-only files changed by #126
- `adapters/storage/postgres/src/commerce/billing-funding.ts`
- `adapters/storage/postgres/src/commerce/billing-funding.integration.test.ts`
- `services/gateway/src/billing_checkout.ts`
- `services/gateway/src/billing_checkout.test.ts`
- `scripts/flutterwave-billing-catalog-qualification.mjs`
- `docs/BILLING-CUSTOMER-READINESS.md`

Narrow shared seams may be edited only after fresh reads and semantic reconciliation:
- package/adaptor index exports needed for the files above;
- `services/gateway/src/financial_billing.ts` and its tests;
- `services/gateway/src/app.ts` and its tests;
- `services/gateway/src/main.ts` and its tests;
- the current mobile shell only for generic result-message/HTTPS presentation and
  auth-capability consumption, never for financial authority or billing-specific state;
- current agent/directory authorizer composition only to admit the same authenticated
  platform customer identity already used by billing.

## Explicit non-ownership

Do not copy unrelated files/commits from #126. Do not change crypto/NOWPayments,
WhatsApp/Telegram internals, teaching, creator economy, admin/device work, mobile visual
design, or other active workstreams. Do not deploy into `@nurain/worker` merely because
Masanawa-named variables exist there.

## Acceptance

- exactly-once persist-before-send boundaries for hosted checkout, bill dispatch and refund;
- exact NGN/payment/refund/category/recipient evidence and durable recovery;
- per-customer OTP/session authority;
- merged current-main shell surfaces the trusted checkout result only on explicit user
  interaction and treats presentation revisions as opaque monotonic values;
- agent/shell actions use the same current customer session identity as the billing quote,
  with canonical relationship/presentation/skill lookup;
- relevant TypeScript/Dart/Postgres tests and builds run when an actual runner is available;
- billing stays disabled until live catalog/recipient/device/deployment acceptance is evidenced.

Status: active. No release/deployment claim.


## Canonical-auth reconciliation completed — 2026-10-05

Current `main` advanced during this work and merged PR #132
(`canonical-customer-auth-reconcile`). This branch was semantically rebased onto that head rather
than preserving the temporary Supabase-production-auth direction.

The integration now reuses:
- `createPlatformCustomerSessionAuthorizer` for full customer identity/profile;
- `createPlatformSessionFinancialAuthorizer` for tenant/user financial authority;
- the same rotating PlatformSession access token already used by Agents, creator and commerce;
- the existing server-advertised OTP capability flow in the Flutter app.

A narrow compile defect discovered in the merged canonical auth seam was fixed:
`createPlatformSessionFinancialAuthorizer` now correctly returns
`PlatformFinancialAuthorizer` rather than the removed `FinancialAuthorizer` type.

Mobile billing is implemented as a protected `/billing` destination with live catalog, quotes,
trusted external Flutterwave checkout, independent server verification, history/status recovery,
refund state and prepaid token/code display. Generic server-authored HTTPS ShellDocument detail
values are also explicit-tap external links.

The billing runtime additionally supplies missing durable PostgreSQL fulfillment and webhook
repositories that historical #126 composition referenced but never implemented.

Status: implementation integrated on top of current canonical auth. Billing remains disabled and
undeployed pending executable CI, live catalog/recipient qualification, dedicated Gateway
deployment and device acceptance.
