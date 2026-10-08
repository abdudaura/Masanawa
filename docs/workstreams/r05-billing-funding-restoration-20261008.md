# R05 billing funding restoration — 2026-10-08

Owner/window: ChatGPT independent R05 quote funding restoration.
Branch: `work/r05-quote-funding-restoration-20261008`.
Base main: `f91519fb05ae6b244ba9a721479aada03e7e08ba`.
Task: P0 R05 — recover owner-scoped persisted quote funding instructions/status on mobile after crash, navigation or process recreation, using canonical NGN funding intent and bill quote; no duplicate or new financial execution.
Exact code paths: `packages/commerce/src/billing-wallet.ts`, `adapters/storage/postgres/src/commerce/ngn-wallet.ts`, `services/gateway/src/billing_wallet.ts`, `services/gateway/src/billing_routes.ts`, `services/gateway/src/billing_funding_restoration.test.ts`, `adapters/storage/postgres/src/commerce/ngn-wallet-restore.integration.test.ts`, `apps/mobile/lib/src/core/network/api_client.dart`, `apps/mobile/lib/src/core/api/billing_models.dart`, `apps/mobile/lib/src/screens/billing/billing_screen.dart`, `apps/mobile/test/billing_funding_restoration_test.dart`, this file.
Dependencies: existing R05 idempotent funding/webhooks (#413), owned quote and wallet authentication. Shared billing route/service/commerce contracts touched only within this claim; no gateway app composition, migrations, avatar, user profile, activity, agent runtime, or other open PR files.
Activity and timestamp: 2026-10-08T05:51:17.006Z; claim publication before code work.
Step: implement owner-scoped read-only status endpoint and client restoration, then contract/authorization/regression checks. Verify latest main and PR diff before edits. All tests/build/deployment/device verification initially UNVERIFIED; never claim R05 overall DONE.

## Checkpoint

- Server read-only endpoint, owner scope and typed mobile recovery are committed. Bank account display requires confirmed unexpired quote and active provider-bound funding. Current wallet quote GET and history do not execute or create funding.
- Expand claim to DB integration coverage of quote ownership/latest ordering and persisted binding; no migration or index modified. Existing owner/history index remains. Tests not yet executed; deployment/device unverified.
- Latest repository update: 2026-10-08T05:55:20.358Z

## Implementation handoff — 2026-10-08T05:58:08.465Z

- **Code committed/pushed**, not production qualified. The owner-scoped read-only `GET /v1/commerce/bills/quotes/:quoteId/wallet-status` never confirms a quote, creates virtual accounts, charges a wallet or dispatches provider work. 401/404/503 distinguish authentication, ownership and temporary server failure.
- Postgres retrieval uses tenant/user/quote identifiers, newest persisted intent, read-only repeatable-read transaction. Existing quote-scoped funding reuse and provider webhook authority remain canonical.
- Recovery only exposes provider-bound account instructions for a still-confirmed/unexpired quote and unexpired awaiting funding intent; credited, failed, expired, already-reserved and refunded cases don't show stale bank details.
- Mobile restores exact pending funding from bill history and refresh; clears bank coordinates before a network read, uses selection epochs against stale responses, re-checks on pull, cancels and locally expires instructions when earlier of quote/provider expiry passes. No client-side ability to create a funding intent via GET.
- Focused server Fastify + Vitest tests: authentication/owner/404/503/read-only, invalid quote states and expired instructions. PostgreSQL integration test: persisted account, cross-owner/cross-quote isolation, later intent ordering. Flutter/Dio/widget tests: bearer GET, history recovery, credited/processing refresh, failed read clearing bank details.
- **Verification status**: source-level readback and committed tests only. No project checkout, Dart/Flutter/pnpm workspace in this runtime (git clone host DNS blocked). Tests/typechecks/build are NOT RUN; no production Flutterwave callback, deployment, Android session, or signed APK qualification. Do not merge unless a runnable CI/checkout independently verifies, and do not mark R05 DONE.
- **Outstanding broader R05**: durable unattended sweep/reconciliation and provider `creating`-state provisioning timeout/collision recovery, crash/provider ledger checks and live Flutterwave funding/purchase/refund observations. R07 live billing and voice-first financial interaction are separate release gates; existing manual billing composer is not voice-first.
- Code paths intentionally omit all other active workstreams, shared Gateway composition, migration registry and existing historical migrations.
