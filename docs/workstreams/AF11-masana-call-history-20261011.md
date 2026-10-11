# AF11 Masana call history

Owner: Codex, sole active implementation window per owner instruction.
Base: `a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d` (merged #668).
Branch: `feature/masana-call-history-20261011`.
State: IMPLEMENTED_UNVERIFIED for production; backend source and local tests
implemented. No provider/device/deployment activation.

Scope: persisted outgoing Masana live-voice history; account-scoped recents,
detail, connection report and end report. Only server-authorized token issuance
creates records. Client lifecycle reports are informational, never billing proof.
Incoming calls, group orchestration, mobile integration and provider revocation
remain separate milestones. No old human-contact call authority is restored.

Exact paths: `services/gateway/src/call_history/**`,
`packages/agents/migrations/0007_masana_call_history.sql`,
`services/gateway/src/live_voice_token.ts`,
`services/gateway/src/agent_shell_contract.ts`.
Bounded AF00 composition transfer, owner has assigned this window full ownership:
`services/gateway/src/app.ts`, `services/gateway/src/main.ts`.
No auth, ledger, native audio, existing migration or deployment edits.

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

Next: mobile native-session connection/end reporting, then incoming signaling
and group orchestration. Until lifecycle hooks land, issued attempts remain
connecting/expired in history rather than being falsely marked completed.
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
