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
