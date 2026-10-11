# J08 — paid professional Room, verified Google Play

State: **IMPLEMENTED_UNVERIFIED source only**. Do not enable live sales or interpret source tests as external payment qualification. The J07 free-Room tables and all legacy financial records remain unchanged.

## Canonical customer/admin journey

1. Pricing manager (never a fan or Rooms editor) opens Room plans, creates a monthly/yearly plan, enters exact integer minor units and a Play Console product ID. The server appends a numbered immutable price version; older versions stay valid for purchase restoration.
2. A published Room may switch to paid only when the platform payments gate is enabled and a versioned plan exists. No free-member charge is triggered by a price change.
3. Authenticated fan opens paid Room: fetches approved offers and a keyed obfuscated buyer binding. Google Play lists localized products, fan explicitly accepts subscription terms, store checkout uses that binding. Offline/pending/cancelled/failed states never grant access.
4. The app sends its purchase token to the authenticated Gateway. Gateway verifies it using **Google Play Developer API v2** and checks package, SKU, provider account binding, current/historical immutable price version and expiration before inserting an entitlement. Only a hashed token is stored; a token cannot be reassigned across fans.
5. PostgreSQL checks tenant, user, room, membership and active/grace unexpired entitlements on **every** restricted join, question and lesson request, including an existing member after expiration or refund. The client never trusts local receipt data.
6. Google Pub/Sub sends signed RTDN pushes. Verify signature, issuer, intended audience and service-account email against Google public keys; re-fetch current state from Play; update a pre-existing linked entitlement idempotently. Canonical events.outbox emits a notification when state changes; no separate queue, wallet, ledger or synthetic receipts.
7. Restore/retry must use server-issued plan/price records; repeated purchase-token verification is safe and historical price versions remain verifiable.

## Production blocker ownership (AF00)

- **Shared source composition**: register `packages/rooms/migrations/0001_rooms_free.sql` then `0002_room_subscriptions.sql` after identity/events and include Rooms and Play subscriptions routes exactly once in the canonical Fastify app. Supply existing verified auth, actor, Play service-account credentials, keyed account-binding secret, Google Pub/Sub OIDC validator and feature flag. Attach the existing outbox dispatcher and notifications sender; route Android Admin pricing page and consumer Rooms through the same authenticated Dio. Do not introduce new ledger/service.
- **Dependency lockfile**: regenerate `pnpm-lock.yaml` for the existing missing `packages/feed`, `packages/rooms` workspace importers and compose source package dependencies. Run `flutter pub get` and commit Android `apps/mobile/pubspec.lock` after adding official `in_app_purchase` (currently `^3.3.1`). Reconcile concurrently added video WebView dependency.
- **Provider qualification**: provision approved Play Console subscriptions and Android Publisher permissions, test-service-account OAuth, Google authenticated Pub/Sub push audience and email, Android Play-signed internal test installation and the correct app package (`ng.unigeria.unigeria` on the existing Android config). Run cancellation, renewal, grace, hold, refund, replay and restore. Verify no cross-tenant or cross-fan access; retain receipt-state evidence without raw tokens.
- **Environment**: on disposable PostgreSQL18 run fresh and upgrade migrations, signed-in fan journeys, rollback via restoring backup (do not issue DOWN for financial/Rooms ledgers), worker retry/dedup and Flutter/admin tests. Only AF00 can qualify production and flip the sales flag.

## Executable checks (not yet passing)

- `pnpm install --frozen-lockfile && pnpm --filter @masanawa/rooms typecheck && pnpm exec vitest run packages/rooms/src/subscriptions.test.ts services/gateway/src/modules/rooms/*.test.ts services/worker/src/jobs/rooms/*.test.ts`.
- PostgreSQL18 fresh + upgrade: apply canonical migrations on disposable DB and run `adapters/storage/postgres/src/rooms/paid_access.test.ts`; verify Play receipt replay, price ownership, active expiration and finance row counts unchanged.
- Consumer: `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/features/rooms && flutter build apk --debug`.
- Admin: `cd apps/admin_mobile && flutter pub get && flutter analyze && flutter test test/features/rooms && flutter build apk --debug`.
- Live: signed Android Play test purchase -> verified API -> PostgreSQL readback -> restricted Room join -> RTDN grace/cancel -> Room denied when expired -> notification and restore.

Known Foundation CI evidence: `integration/rebuild@ec8acd39` run `38108533924` and PR #625 run `38109614775` failed at frozen pnpm installation, specifically missing `importers["packages/feed"]`. TypeScript/Vitest/PG build checks were **not reached**. Earlier Android/Flutter `38109614774` jobs were cancelled before installation/analyze/build. These are **not passes**. Keep source on a non-deploying branch until verified; do not merge into Railway-linked main.

## Handoff

Source PR: #625 (`lane/l-rooms-free-questions-20261010-gpt6`) to `integration/rebuild`. Merge in dependency order after AF00 reconciles frozen lockfiles, canonical composition and conflict tests. Keep unverified paid sales OFF. No source or credential from this PR should mutate an existing financial account.
