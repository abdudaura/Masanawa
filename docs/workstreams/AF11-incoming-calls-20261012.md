# AF11 incoming Masana calls — 2026-10-12

Delivery: [PR #675](https://github.com/weavewellindustrieslimited/masanawa/pull/675).
Branch: `feature/masana-incoming-calls-20261012`.
Base: `708a2ba11` (fresh main, previous native/group/billing delivery preserved).
Source: `efd1597872e15eaf9623c1346167ad1053c8bea4`.
State: source implemented and locally verified; **IMPLEMENTED_UNVERIFIED** for
signed device, real provider and production use. Main is the safe integration
target; the PR records its exact integration SHA. No receiving window confirmed.

## Delivered behavior

Durable tenant/account/persona-scoped incoming invitations; server-authorized
current visible platform Masana initiation; idempotent request replay; atomic
ringing/accept/decline/cancel/timeout; missed/declined/cancelled incoming history.
Server-clock timeout works without a client. History remains informational.

Existing account push registrations carry generic metadata-only notifications.
A durable leased outbox retries failed/partial/zero-recipient delivery and never
sends a terminal invitation. Gateway recovery runs on startup and once a second,
nonoverlapping and drained before database close. FCM OAuth/delivery share a
10-second network deadline. Duplicate/late hints trigger authoritative readback;
foreground hints refresh a passive banner instead of replacing an active call.

Flutter uses an authenticated incoming destination, initial/poll/resume readback,
explicit acceptance and separate existing per-Masana paid/trial consent. The
existing native voice session, history reporter and durable financial recovery
handle connection/end, duration, interruption, background/account changes and
late reservation cleanup. Recents render incoming/missed outcomes. Existing
native/group/outgoing behavior and canonical ledger remain in place.

Media issuance requires acceptance and configured canonical paid/trial admission.
Incoming grants retain the same history identity. Unknown provider outcomes,
post-mint persistence failures and crashed issuing leases cannot remint tokens;
recovery ends informational history. Known pre-issuance/explicit provider denial
can retry. No credentials/audio are persisted. Unknown issuance requires a new
explicit call, not silent credential or spending retries.

## Paths and contracts

- `services/gateway/src/incoming_calls/**`: service, SQL repository, routes, server authority, tests, API README.
- `packages/agents/migrations/0009_masana_incoming_calls.sql`: additive invitation/outbox and history columns; historical records preserved.
- Gateway `app.ts`/`main.ts`: narrow composition, recovery and shutdown; `mobile_push.ts`: bounded provider transport.
- Gateway `call_history/{service,postgres_repository}.ts`, `live_voice_token.ts`, `agent_shell_contract.ts`: same-identity incoming history and fail-closed credential minting.
- Mobile `calls/incoming_*.dart`, `calls/call_history.dart`, `core/{mobile_push,shell_deep_link}.dart`: account-fenced incoming UI/transport/push hints.
- Mobile `main.dart`, `router/app_router.dart`: narrow authenticated routing and active-call hint guard.
- Mobile `screens/calls/calls_screen.dart`: recents icon/outcome labels only; native/group controls preserved.
- Corresponding incoming tests and existing Calls screen regression.

Dedicated server initiation/cancel credential:
`MASANAWA_INCOMING_CALLS_SERVER_TOKEN`. Keep it server-only. Missing configuration
fails closed. Existing Firebase and voice configuration/contracts remain required.
API details: `services/gateway/src/incoming_calls/README.md`.
Claims published on `factory/claims`; old alternate #643/#660 source and Status
#674 branch were inspected and retained. Status's historic 44-line Calls scaffold
must not replace the merged full native/group/recents Calls screen.

## Executed local verification

Node 24.19.0, pnpm 12.8.2; isolated PostgreSQL 18 Docker on localhost; official
Flutter 3.47.7 / Dart 3.13.5. Earlier Flutter 3.44.0 could not satisfy current
`^3.12.2` and was not used for passing evidence. No dependency or analysis-policy
changes were committed from SDK bootstrap.

- **98 Gateway tests passed**, 15 files, including 7 incoming real PostgreSQL tests, existing history/group SQL tests, native history, admission/runtime and app regressions.
- **87 Flutter tests passed**, 14 files, including actual coordinator navigation/account/restoration, acceptance/late cleanup, transport, recents, native/group/outbox and shell regressions.
- Gateway production build passed.
- Incoming-owned Dart source/test analysis: **no issues** (12 files).
- Wider changed-mobile analysis: no errors; two existing router unnecessary-cast warnings and informational style diagnostics with the newer SDK. Main's introduced brace hint was corrected. No checks disabled.
- Broader Gateway typecheck fails with **54 normalized diagnostics identical to untouched `708a2ba11`**, zero introduced diagnostics. It is not reported as passing.
- GitHub Foundation CI on delivery head `4c87e54b5` failed at `packages/agents/src/talk-replay.test.ts:6` (unexported `TalkId`); reproduced on untouched main with `pnpm --filter @masanawa/agents typecheck`.
- GitHub Mobile Build on that head stopped at full analysis, not APK/device tests. Full local analysis reproduced **six error/warning diagnostics identical to untouched main** (all warnings, zero errors), with 329 total issues on head versus 330 on baseline. No introduced warning/error and no checks weakened. Foundation run `38250021988`; Mobile run `38250022014`. Remote CI is not green.
- Independent final review: no outstanding actionable findings. Fixed post-mint persistence ambiguity and partial/alpha paid-gate configuration; tests caught both before fixes.
- `git diff --check` passed. Following final recovery update, incoming SQL suite rerun: 7 passed.

Reproduce:

```sh
pnpm install --frozen-lockfile
# A local PostgreSQL server only. Tests create/drop their own disposable databases.
MASANAWA_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres node node_modules/vitest/vitest.mjs run services/gateway/src/incoming_calls services/gateway/src/call_history services/gateway/src/group_calls services/gateway/src/twin_production_runtime.test.ts services/gateway/src/paid_voice.test.ts services/gateway/src/paid_voice_routes.test.ts services/gateway/src/app.test.ts
pnpm --filter @masanawa/gateway-service build
pnpm --filter @masanawa/gateway-service typecheck
cd apps/mobile
flutter pub get
flutter test --no-pub test/incoming_call_test.dart test/incoming_call_transport_test.dart test/incoming_call_screen_test.dart test/incoming_call_coordinator_test.dart test/incoming_deep_link_test.dart test/call_history_transport_test.dart test/calls_screen_test.dart test/live_voice_session_test.dart test/call_lifecycle_reporter_test.dart test/group_call_controller_test.dart test/group_call_outbox_transport_test.dart test/group_call_screen_test.dart test/app_shell_route_compatibility_test.dart test/shell_deep_link_test.dart
```

## Qualification still unrun

No signed Android/iOS binary, physical device, real FCM/APNs/Gemini call, provider
spending, production migration/configuration or deployed behavior was qualified.
No adb/Xcode runner was present. Local mocks and PostgreSQL tests do not establish
provider delivery or audio behavior on phones.

Next: qualify signed-device foreground/background/terminated notification paths,
permission denied, duplicate/late pushes, account switches, accept/decline/cancel
races, missed history, audio interruption, offline restart and refund recovery.
Include existing one-to-one/group duration/consent/removal scenarios. Configure
the server initiation authority and additive migration through the qualified
backend deployment path. Real provider spending/financial activation remain
separate from routine authorized source integration. Shared UI localization and
history retention/account-erasure qualification remain future work.
