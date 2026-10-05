# Twin shared production integration — 2026-10-05

Status: active
Owner/window: ChatGPT, explicitly transferred by user on 2026-10-05
Branch: `work/production-apk-integration-20261005`
Base/head at claim: `852864d3c17d04dd5df46ae7b9206849357f9d66`
Tasks: TWIN-022/023/024/031-045/050-058/071-084/090-109 production wiring

## Ownership transfer

The user explicitly instructed this window to implement all ten remaining shared Twin
integration items. PR #133 is fully contained by this branch and has been closed as
superseded. PR #134 was already closed/superseded. This branch is now the single owner
for the shared integration/deployment paths below.

## Exact owned paths

- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `services/gateway/src/agent_conversation_contract.ts`
- `services/gateway/src/agent_conversation.ts`
- `services/gateway/src/customer_auth.ts`
- `services/gateway/src/live_voice_token.ts`
- `services/gateway/src/agent_shell_contract.ts`
- `services/gateway/src/agent_shell_routes.ts`
- `services/gateway/src/financial_billing.ts`
- `services/gateway/src/financial_service.ts`
- `services/gateway/src/billing_routes.ts`
- `services/gateway/src/twin_profile.ts`
- `services/gateway/src/twin_profile_routes.ts`
- `services/gateway/src/twin_directory.ts`
- `services/gateway/src/twin_directory_routes.ts`
- `services/gateway/src/my_twin_projection.ts`
- `services/gateway/src/my_twin_projection_routes.ts`
- `services/gateway/src/my_twin_projection_sources.ts`
- `services/gateway/src/twin_activity.ts`
- `services/gateway/src/twin_activity_routes.ts`
- `services/gateway/src/twin_activity_source.ts`
- `services/gateway/src/wallet_projection.ts`
- `services/gateway/src/wallet_projection_routes.ts`
- `services/gateway/src/wallet_projection_sources.ts`
- `services/gateway/src/wallet_projection_twin_events.ts`
- `services/gateway/src/credit_transfer.ts`
- `services/gateway/src/credit_transfer_routes.ts`
- `services/gateway/src/gifts.ts`
- `services/gateway/src/twin_attribution.ts`
- `services/gateway/src/twin_attribution_routes.ts`
- `services/gateway/src/paid_voice.ts`
- `services/gateway/src/paid_voice_routes.ts`
- `services/gateway/src/paid_feature_trial_admin.ts`
- `services/gateway/src/owner_access.ts`
- `services/gateway/src/owner_access_routes.ts`
- `services/gateway/src/owner_access_offering.ts`
- `services/gateway/src/owner_access_offering_routes.ts`
- `services/gateway/src/twin_chat_admission.ts`
- `services/gateway/src/twin_economy_guard.ts`
- `services/gateway/src/twin_safety.ts`
- `services/gateway/src/twin_safety_routes.ts`
- `services/gateway/src/twin_production_runtime.ts` (new)
- `services/gateway/src/twin_production_runtime.test.ts` (new)
- `packages/events/src/index.ts`
- `packages/commerce/src/index.ts`
- `packages/commerce/src/twin-runtime.ts` (new)
- `packages/identity/migrations/0004_twin_profiles.sql` (new only)
- `adapters/storage/postgres/src/identity/twin-profile.ts` (new)
- `adapters/storage/postgres/src/identity/index.ts`
- `adapters/storage/postgres/src/index.ts`
- `adapters/storage/postgres/src/events/twin-economy.ts` (new)
- `adapters/storage/postgres/src/events/index.ts`
- `adapters/storage/postgres/src/commerce/twin-economy.ts` (new)
- `adapters/storage/postgres/src/commerce/twin-economy.integration.test.ts` (new)
- `packages/commerce/migrations/0102_twin_economy.sql` (new only; existing migrations immutable)
- `apps/mobile/lib/src/core/shell_deep_link.dart`
- `apps/mobile/lib/src/agents/twin_activity.dart`
- `apps/mobile/lib/src/state/twin_activity_state.dart`
- `apps/mobile/lib/src/owner_access/owner_access_state.dart`
- `apps/mobile/lib/src/screens/activity/activity_screen.dart`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `apps/mobile/android/app/src/main/kotlin/ng/unigeria/unigeria/MainActivity.kt`
- `apps/mobile/test/shell_deep_link_test.dart`
- `apps/mobile/test/owner_access_offering_transport_test.dart` (new)
- `apps/mobile/test/owner_access_transport_test.dart` (new)
- `apps/mobile/test/paid_voice_transport_test.dart` (new)
- `apps/mobile/lib/src/core/live_voice_session.dart`
- `apps/mobile/lib/src/screens/twin/my_twin_screen.dart`
- `packages/commerce/src/voice-settlement.ts`
- `packages/commerce/src/voice-settlement.test.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- `apps/mobile/lib/src/voice/paid_voice_http_transport.dart`
- `apps/mobile/lib/src/owner_access/owner_access_http_transport.dart`
- `apps/mobile/lib/src/commerce/wallet_http_transport.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
- `apps/mobile/lib/src/screens/settings/settings_screen.dart`
- `apps/mobile/test/twin_production_integration_test.dart` (new)
- `docs/workstreams/twin-shared-production-integration-20261005.md`
- `docs/TWIN-INTEGRATION-MATRIX.md`
- `docs/TWIN-TRANSFORMATION-TASKS.md`

## Invariants

- preserve every existing migration/checksum; only append new migration files;
- no second wallet, ledger, event bus, Twin runtime or provider abstraction;
- internal Credit transfer/gift never generates acquisition commission;
- external provider-confirmed funding/eligible commerce may generate configured Twin commission;
- AI Twin vs real human owner identity is always explicit;
- Agent Float/provider reserve concepts remain hidden from ordinary Wallet/mobile UI;
- production auth uses canonical platform sessions, never developer tokens;
- existing billing/crypto recovery/reconciliation remains authoritative.

## Current checkpoint

Shared Twin production integration is substantially implemented on this branch. The
current production line now includes canonical Twin profile/directory/My Twin/Activity/
Wallet composition, Credit transfer/gift persistence, attribution/commission hooks,
paid-voice admission and settlement, owner-access flows, safety/block enforcement,
four-tab mobile wiring, chat actions, and native public Twin deep-link delivery.

Qualification coverage added after the implementation audit:

- `services/gateway/src/twin_production_runtime.test.ts` verifies the composed production
  runtime exposes one canonical Twin surface and drives authenticated Explore, My Twin
  and Wallet projections without surfacing Agent Float.
- `adapters/storage/postgres/src/commerce/twin-economy.integration.test.ts` verifies
  durable Credit-operation replay, tenant isolation, immutable financial history and
  concurrent exact-replay convergence.
- `apps/mobile/test/twin_production_integration_test.dart` verifies the production
  Riverpod providers use the authenticated Gateway transports for My Twin, Explore,
  Activity and Wallet.

The public Twin deep-link slice also landed on this branch after the qualification tests:
HTTPS share links are recognized, resolved through the Twin directory, routed into chat,
registered as Android app links and delivered from the Android activity into Flutter.

Subsequent production hardening on the same owned branch now also includes:

- ledger-first, durable-plan reservation for paid voice and owner access;
- crash-safe commission settlement/reversal ordering and stable replay timestamps;
- actionable owner requests in Activity with durable reference/status deduplication;
- requester latest-request recovery/cancellation after app restart;
- owner request expiry/no-show/refund logic plus best-effort FCM lifecycle notifications;
- Human Access enable/price/duration controls moved into My Twin, with legacy Creator
  economy/Agent Float/Skill controls removed from ordinary Settings;
- paid voice media-start evidence moved from token issuance to Gemini setup-complete +
  microphone readiness, with server timing and quote-duration caps;
- full paid reservation refund when voice media never starts.

A remaining Phase-3 commercial-contract blocker is now explicit: NGN billing and crypto
asset quantities are canonically separate from AI Credits. The repository has no approved
valuation rule that converts provider value into commission Credits. Do not wire real
Flutterwave/NOWPayments success amounts into `monetization.settle(baseCredits)` until a
versioned commercial valuation policy exists.

## Verification status

Repository implementation is ahead of the last physically verified release APK. The old
release-build evidence therefore does not qualify this current Twin-integrated head.

GitHub Actions checks on the latest production branch are still terminating before useful
build/test execution, consistent with the existing runner-infrastructure failure already
recorded in the Twin integration matrix. Treat those red checks as no verification
evidence, not as an application test failure.

Still required before marking TWIN production tasks complete or merging this vehicle:

1. add a proactive owner-request expiry/no-show sweeper using an existing bounded runtime
   scheduling primitive, so refunds/notifications do not depend on a participant read;
2. define an approved versioned fiat/crypto -> commission-Credit valuation policy before
   wiring real billing/crypto provider-success commission settlement;
3. run Gateway/package TypeScript typecheck + focused Twin tests on a working runner;
4. run PostgreSQL acceptance with `MASANAWA_TEST_DATABASE_URL`, including Twin replay,
   latest-owner-request and immutability cases;
5. run Flutter analyze/tests, including owner-access, paid-voice, production transport and
   deep-link tests;
6. build `assembleRelease` from the exact qualified head and record APK checksum/artifact;
7. install on a real Android device and exercise create/share/free-text, paid voice,
   transfer/gift, owner access, Wallet/Activity, notifications and restart/retry;
8. qualify production deployment/readiness/rollback evidence before merge.

Do not rewrite applied migrations or mark TWIN-100..109 complete from code presence alone.
