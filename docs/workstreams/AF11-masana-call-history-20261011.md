# AF11 Masana call history

Owner: Codex coordinating window, with delegated non-overlapping native/group/billing source.
Base: `a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d` (merged #668).
Branch: `feature/masana-call-history-20261011`.
State: IMPLEMENTED_UNVERIFIED for production; backend source and local tests
implemented. No provider/device/deployment activation.

Scope: persisted outgoing Masana live-voice history; account-scoped recents,
detail, connection report and end report. Only server-authorized token issuance
creates records. Client lifecycle reports are informational, never billing proof.
Native reporting, mobile recents and private multiple-Masana group orchestration
are now implemented. Incoming ringing and provider-side token revocation remain
separate milestones. No old human-contact call authority is restored.

Exact paths: `services/gateway/src/call_history/**`,
`packages/agents/migrations/0007_masana_call_history.sql`,
`services/gateway/src/live_voice_token.ts`,
`services/gateway/src/agent_shell_contract.ts`.
Bounded AF00 composition transfer, owner has assigned this window full ownership:
`services/gateway/src/app.ts`, `services/gateway/src/main.ts`.
Original backend milestone did not edit auth, ledger, native audio or deployment.
Owner-directed native/group/billing extensions are recorded below.

Owner-directed continuation (2026-10-11): native reporting and group calls are now
authorized. Bounded native/composition transfer to this coordinating window:
`apps/mobile/lib/src/core/live_voice_session.dart`,
`apps/mobile/lib/src/agents/agent_shell.dart`,
`apps/mobile/lib/src/agents/masanawa_transport.dart`,
`apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`,
`apps/mobile/test/live_voice_session_test.dart`,
`apps/mobile/test/call_lifecycle_reporter_test.dart`.
Group backend allocation: `services/gateway/src/group_calls/**`,
`packages/agents/migrations/0008_masana_group_calls.sql`.
Group mobile allocation: `apps/mobile/lib/src/calls/group_*.dart`,
`apps/mobile/test/group_call*.dart`. Root retains main/app/router composition and
Calls entry point. Other windows retain Status/Rooms/Quality source.
Design contract: `docs/superpowers/specs/2026-10-11-masana-native-and-group-calls-design.md`.

Mobile continuation claim: `apps/mobile/lib/src/calls/**`,
`apps/mobile/lib/src/screens/calls/calls_screen.dart`,
`apps/mobile/test/call_history_transport_test.dart`,
`apps/mobile/test/calls_screen_test.dart`. This uses the existing authenticated
API client, a separate subtree per signed-in account and local cancellable
pagination. No shared provider/router/localization or native audio changes.

Verification: 24 tests passed across call-history, Gateway app and paid-voice
suites; five SQL tests executed on isolated local PostgreSQL, including migration
registration/rerun, tenant/account fencing, pagination and lifecycle races.
Gateway production build passed. Full Gateway typecheck remains failing: 37
normalized diagnostic entries match untouched `a8e1c84ce`, with no new entries.
The billing startup assertion in `main.test.ts` fails identically on that base
(expected error wording differs). No checks were weakened or disabled.

Independent review: no actionable findings; reviewer separately executed all
10 route/token tests successfully. PostgreSQL evidence is the implementation
window's executed local run, not an independent provider qualification.

Mobile recents source is now implemented: authenticated transport, cancellable
pagination, pull-to-refresh/retry, sign-out/session fencing, and existing Masana
directory/chat navigation. Ten Flutter transport/widget/shell tests passed.
Scoped Dart analysis completed on all four owned files with zero diagnostics.
Independent mobile review found no actionable issues and reran seven focused
tests successfully. Runner: limited Flutter 3.44.0 framework with Dart 3.12.2
tools; this is not signed Android/iOS or physical-device qualification.

This earlier recents-only checkpoint is superseded by the native/group delivery
below. Incoming signaling remains separate; token issuance alone still never
marks a call connected.
The mobile feature needs this branch's Gateway endpoint deployed through the
separate qualification/release flow; the existing production endpoint was not
activated here. New UI copy still needs shared localization integration.
API and remaining qualification:
`services/gateway/src/call_history/README.md`.

Commands executed:

```sh
MASANAWA_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/masanawa_test node node_modules/vitest/vitest.mjs run services/gateway/src/call_history services/gateway/src/app.test.ts services/gateway/src/paid_voice.test.ts services/gateway/src/paid_voice_routes.test.ts
pnpm --filter @masanawa/gateway-service build
pnpm --filter @masanawa/gateway-service typecheck
cd apps/mobile
flutter test --no-pub test/call_history_transport_test.dart test/calls_screen_test.dart test/app_shell_route_compatibility_test.dart
```

Cloud tool activation: pnpm under `/workspace/.onboarding-tools/node_modules/.bin`;
Flutter under `/workspace/.onboarding-tools/flutter-oci/sdks/flutter/bin`;
`XDG_CONFIG_HOME=/workspace/.onboarding-tools/flutter-config` and
`PUB_CACHE=/workspace/.onboarding-tools/pub-cache`.
The default analyzer CLI could not write its read-only home cache. Scoped
analysis ran the SDK analysis server with explicit
`--cache=/workspace/.onboarding-tools/dart-analysis-cache`, requested the four
owned files through its protocol, and confirmed completion plus all four reports.
Session logs/helpers in `/tmp` are not repository artifacts or transferable proof.

### Owner-directed group billing integration — 2026-10-12

The requested multiple-Masana feature exposed a canonical voice quote dependency
that still required a personal Twin owner. Extend AF11 to the existing voice
runtime and its persisted quote/admission types, without replacing historical
financial records or adding a ledger. Exact delegated paths:
services/gateway/src/twin_production_runtime.ts and its test,
packages/commerce/src/twin-runtime.ts,
adapters/storage/postgres/src/commerce/twin-economy.ts and its integration test,
and one new additive commerce migration for nullable platform voice beneficiary.
Root retains main composition. Platform eligibility remains server-sourced;
platform voice has no human creator beneficiary. Provider activation and paid
execution are not part of source verification.


### Native/group delivery — 2026-10-12

Integrated current main `a6eb2a429` into the feature branch, preserving the other
windows' profile and development-policy changes. User confirmed deployments are
held/disabled and explicitly authorized main integration.

Implemented native connected/end reporting after real local setup/teardown,
metadata-only persistent history retries, account-switch termination and recents
refresh. Private groups select 2–4 current Masana, share one microphone/audio
focus, serialize bounded model playback, and handle participant removal, consent
decline, interruption, backgrounding and terminal cleanup. Native cleanup occurs
before history or financial network waits.

Canonical voice billing now supports platform Masana without a personal Twin
owner or human creator share. Per-persona quotes, consent, reservations, timers,
settlement and refunds retain the existing ledger authority. Durable start and
completion intents reconcile interrupted calls after restart; no credentials are
persisted. Completion freezes usage before transfers, so partial-failure retries
cannot recalculate a higher charge. Accepted quote recovery and settled replay
reuse original financial identities. Additive migrations: agents 0008 and
commerce 0110; historical owners and financial records are preserved.

Source state: IMPLEMENTED_UNVERIFIED for real provider/device/production use.
Local verification and final source SHA are recorded by the delivery commit.
Relevant Gateway production compiler checks pass. Broader Gateway typecheck has
only diagnostics already reproduced on untouched main; no changed-call/billing
source diagnostics. No tests or checks were disabled. The stale runtime exact-key
fixture was updated for two APIs already present on main, without changing API.

Remaining release work: qualify signed Android/iOS on actual devices and real
providers/networks/audio routes; deploy qualified backend migrations/configuration.
Incoming Masana-initiated signaling/push, shared UI translations and history
retention/account-erasure qualification remain separate product/release work.

Final source commits: backend `9bf273a44`, mobile `98d6371cf` on
`feature/masana-call-history-20261011`; current main integration base `a6eb2a429`.
Independent final review reports no outstanding actionable findings after the
account-change, cleanup-latency, settlement retry, removal and duration fixes.

Final executed results:

- Gateway call/group/runtime/admission/app suites: **75 passed**, 9 files.
- PostgreSQL economy suite: **11 passed**, no skips, isolated local database.
- Flutter history/lifecycle/group/picker/shell suites: **56 passed**, 8 files.
- Gateway, commerce and PostgreSQL production builds: passed.
- Final integrated mobile analysis: 20 files reported, no errors or warnings;
  19 informational style hints. Group-owned 9-file analysis: zero diagnostics.
- Broader Gateway typecheck remains failed with the same 74 diagnostic lines
  reproduced on untouched main, zero new normalized diagnostics. This is not a
  full-repository CI or release-readiness claim.
- `git diff --check`: passed. No production provider calls or migrations executed.

Reproduce the focused checks using Node 24, pnpm 12.8.2 and Flutter/Dart versions
recorded above:

```sh
MASANAWA_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/masanawa_test node node_modules/vitest/vitest.mjs run services/gateway/src/group_calls services/gateway/src/call_history services/gateway/src/twin_production_runtime.test.ts services/gateway/src/paid_voice.test.ts services/gateway/src/paid_voice_routes.test.ts services/gateway/src/app.test.ts
# Use a separate empty local PostgreSQL database for the economy migration suite.
MASANAWA_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/masana_platform_voice_test node node_modules/vitest/vitest.mjs run adapters/storage/postgres/src/commerce/twin-economy.integration.test.ts
pnpm --filter @masanawa/gateway-service build
pnpm --filter @masanawa/commerce build
pnpm --filter @masanawa/postgres-adapter build
cd apps/mobile
flutter test --no-pub test/call_history_transport_test.dart test/calls_screen_test.dart test/live_voice_session_test.dart test/call_lifecycle_reporter_test.dart test/group_call_controller_test.dart test/group_call_outbox_transport_test.dart test/group_call_screen_test.dart test/app_shell_route_compatibility_test.dart
```

Continue from main after this delivery. Preserve other windows' Status/Rooms work.
First qualify the new native binary and provider-backed group calls on actual
phones, including backgrounding, device interruption, offline restart, consent,
removal and refund recovery. Incoming signaling/push remains the next separate
calls feature; do not recreate human contacts or personal Twin onboarding.
