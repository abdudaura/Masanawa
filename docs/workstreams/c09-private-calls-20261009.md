# C09 — Private human voice/video calls: isolated full-stack draft handoff

**Owner approval:** 2026-10-09 explicitly adds direct one-to-one human voice and video calls to the Chats product, superseding the older future-only deferral. **Classification: PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT INTEGRATED / NOT DEPLOYED.** This is real application source but **not an operational end-to-end feature**.

## Ownership, provenance and traceability
- Latest `main` inspected before claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Branch `work/c09-private-calls-20261009-gpt6`. **Source/tests checkpoint before handoff** `8847a61e29d4c80868f301e5d60031ad566e3fce` (32 commits ahead of base, no behind).
- Claim ID `gpt6-c09-human-private-calling-20261009`, published **before first source edit** on `factory/claims` commit `f09dcc6b36b2f6d70b341d32514fb8402fe2b064`; renewed as needed. Three exact-path roots: `services/gateway/src/human_calls/**`, `apps/mobile/lib/src/human_calls/**`, `apps/mobile/test/human_calls/**`; docs `PRIVATE-HUMAN-CALLS-END-TO-END-20261009.md` and this handoff. This commits no existing shared file.
- Original C01 #468, C02 #472 vs #475, C03 #483/#486, C04 #478, C05 #474 vs #476, R14/FCM #461/#497, F12 #493/#497, public LiveKit R02 and F02 #549 all reviewed as **unmerged** dependency owners. No competing private call PR found in live PR sample when claim was created. Do not replace/merge their paths.
- UX/screen specification, current competitor research, provider costs and K21–K27 acceptance: [docs/PRIVATE-HUMAN-CALLS-END-TO-END-20261009.md](../PRIVATE-HUMAN-CALLS-END-TO-END-20261009.md). Preserve five bottom tabs: **Talks · Chats · Assistant · Wallet · Agents**.

## Implemented source — 19 implementation paths + this handoff (not merged)
**Gateway/service** `services/gateway/src/human_calls/`:
- `service.ts`: per-bearer tenant/principal C01/C02/R15 admission, no media while ringing, only invited callee may accept via repository, fresh permission recheck on every read/media issuance and after provider issuance, safe end even after block, explicit 404/409/429 error states.
- `postgres_repository.ts`: durable call state, ordered user row locks to serialize overlapping calls, stable dial idempotency, max 3 attempts/min & 15/hour, tenant/member/active accepted C01 relationship and reciprocal safety checks inside start/accept transactions, atomically emitted receiver/sender signals, deadline expiry (45s ring; up to 2h active), server readback.
- `schema.sql`: **proposed-only** additive tables and index for private calls and leased no-PII signal outbox. **No auto-registration or migration executed.** Canonical migration owner must assign next safe sequence after elected C01/C02/C03 migrations.
- `livekit_media.ts`: server-only HS256 narrow participant tokens (microphone or microphone+camera, no record/screen/data/moderator), opaque room and identity, short-lived expiry, backend room revoker interface. `signal_worker.ts`: bounded skip-locked/outbox lease retry, terminal media revocation and generic idempotent private hint (no profile/chat text).
- `composition.ts`: existing `PlatformCustomerSessionAuthorizer` and Postgres/C01/C02/R15 policy seam without Gateway root changes. `routes.ts`: real typed Fastify route handlers for start, recent, one call, accept/decline/end and media token.

**Flutter** `apps/mobile/lib/src/human_calls/`:
- `human_call_models.dart` rejects unknown server state/media token/invalid URL/expiry. `human_call_transport.dart` uses existing authenticated `ApiClient` and the real C09 routes.
- `human_call_controller.dart` session-bound lifecycle, stable repeated dial request ID after uncertain response, no token/camera before accepted call and explicit permissions, ring/active/ended polling, fail-closed media recovery, camera/mute/speaker controls and account-switch cleanup.
- `human_call_room.dart` actual `livekit_client` v2 audio/video room, local mic/camera on accepted call, 15fps low-end camera option, flip camera and cleanup. `human_call_screens.dart` incoming/outgoing/active audio+video states, remote and self video tracks, large controls, permission gating, call history, back/end teardown. `human_call_entries.dart` accepted human DM header icons and authenticated foreground Chats ring-watcher/banner.

**Authored tests**:
- Gateway `service.test.ts` (6), `livekit_media.test.ts` (5), `signal_worker.test.ts` (4).
- Flutter `human_call_controller_test.dart` (6), `incoming_call_watcher_test.dart` (2).
- **Total 23 new automated test cases authored, zero executed**. They test faked service/media boundaries where applicable and cannot stand in for real Postgres/WebRTC/Android.

## Checks executed vs not run (honest gate)
- **Executed GitHub readback:** 15/15 static source/contract assertions against committed service, SQL, API, Flutter and tests. Branch compare after source checkpoint: 20 files including this handoff, 32 commits ahead, zero behind, none in protected shared trees; this verifies source presence/layout **only**.
- Container check: Node `v22.16.0` / TypeScript `5.8.3` available; **Flutter and Dart not installed**. Local GitHub hostname DNS resolution returned no address; connected private repo contents available via GitHub plugin only, not a local runnable checkout. No actual Vitest, tsc, Flutter analyze, widget/device test, Postgres integration, real LiveKit, FCM, Android signed build, end-to-end call or provider deployment was run. Actions #457 runner/quota was previously failing before test steps; do not call that an app failure or success.
- **No production writes, migrations, FCM sends, charged LiveKit provisioning, secrets changes, branches merged/deleted or native config changes.**

## Explicit remaining implementation (release blockers)
1. **F15 integration owner** chooses C02 #472's one canonical 0017 migration and C01 0016; inspect evolving schema for collision before assigning **one** C09 migration name after C03. Compose `composeHumanCallService` + `registerHumanCallRoutes` into existing shared Gateway app/main only after auth policy compatibility, without overwriting #497/#468. Verify SQL transaction behavior and exact status/permission/error semantics in disposable PG18.
2. **F12/C08** mounts `HumanCallChatActions` on authorized C02 header and `HumanIncomingCallBanner` on active human Chats, typed nested Call/Calls History routes with accurate peer identity, deep link `/messages/calls/:callId`, durable navigation/back/foreground and account logout. Do not add sixth tab or enable call icons before backend is live. Integrate strings into R11 Hausa/English accessibility/localization catalog.
3. **R14/F10** compose/schedule `processHumanCallSignals` with real authenticated FCM token/preferences and OS notification action handling; incoming generic call hint must fetch real call from Gateway. Configure Android 12+ foreground notifications/full-screen policies, mic/camera/telecom permissions and iOS entitlement/CallKit separately under native owner; test background/terminated/ring timeout, do not claim killed-app calls from polling fallback. Worker must enforce quota, lease recovery and alert on max attempts.
4. **Provider/media owner** supply credential secret via secret store and actual `RoomServiceClient.deleteRoom` implementation to `HumanCallRoomRevoker`, ensure room disconnect on end, timeout, block, account deletion, retry/worker crash. Must coordinate audio focus with public Talk, Gemini and voice-note recorder. Tune TURN/WebRTC video resolution, route/Bluetooth and bandwidth for cheap Androids; qualify unadvertised E2EE claim.
5. **Scope gap:** A permission-denied video call currently offers Retry/Decline rather than negotiated voice downgrade; there is no OS-level incoming ringing/call waiting or media connection health provider callback. Persist unresolved outgoing request ID through app process death via elected C05 encrypted store; current controller preserves only within current session. Build call-specific safety/audit and abuse observability; do not promise call quality or success without actual two-device proof.

## Executable Work acceptance after integration (NOT RUN now)
```bash
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/human_calls/service.test.ts services/gateway/src/human_calls/livekit_media.test.ts services/gateway/src/human_calls/signal_worker.test.ts
# With explicitly approved disposable PostgreSQL 18 schema, never customer DB:
MASANAWA_TEST_DATABASE_URL=<disposable_test_only> pnpm exec vitest run services/gateway/src/human_calls/
cd apps/mobile
flutter pub get
flutter analyze lib/src/human_calls
flutter test test/human_calls
flutter build apk --debug
```
Then run acceptance **K21–K27** A/B authenticated real Android devices: denied/accepted/blocked, concurrent calls, auth revocation in flight, incoming background and killed-app, slow/reconnect and correct server history, camera/mic/Bluetooth and public Talk/Gemini recorder audio-focus, LiveKit forced room delete on hangup and 2h expiry. Review battery/CPU, privacy-safe lockscreen, crash/cleanup/rollback. Sign final SHA and rerun all tests after merge. Status stays **PARTIAL_IMPLEMENTATION** until real wiring+proof exists.

**Source/test checkpoint: `8847a61e29d4c80868f301e5d60031ad566e3fce`. Handoff commit and PR final SHA are referenced from the PR body because a Git commit cannot contain its own final SHA.**

## Post-handoff safety additions (2026-10-09 source checkpoint 8847a61e29d4c80868f301e5d60031ad566e3fce)
- A bounded worker expiration sweep now turns expired unanswered/active calls into durable MISSED/ENDED outbox events without waiting for a client poll; the terminal signal worker must revoke the provider room when scheduled. Added a partial index on expiration for this sweep; no migration executed.
- C09 start/accept transaction now locks the accepted C01 request row `FOR SHARE OF cr` to reduce admission/revocation races. Existing C01 block/revoke callback still MUST trigger immediate active-room revocation through the integrated worker.
- Foreground incoming-call banner now hides a stale invite when `isCurrentSession()` becomes false, even before an explicit watcher teardown callback. Back/navigation closes media rather than keeping hidden microphone/camera capture.
- Revalidated live main diff: **32 commits ahead, 20 exact claimed files, no protected shared paths** at source checkpoint. Readbacks are structure evidence only, not executable tests.

## 2026-10-09 09:02 UTC — C09 contact-revocation media safety continuation

**Still PARTIAL_IMPLEMENTATION / DRAFT / NOT INTEGRATED / NOT DEPLOYED.** Same PR #575 and exact-path ownership registry claim `gpt6-c09-revocation-remote-privacy-20261009` (recorded on `factory/claims` at `35d1157c90276b3a5d76abe1023cb1f573f9eae1`; renewed before continuing). No changes outside C09 source and this handoff. Source/test checkpoint before this doc commit: `fa17843a944121e22224787f3412d4dd8e08879c`.

### Fixed code paths
- `services/gateway/src/human_calls/signal_worker.ts`: bounded tenant-scoped sweep atomically ends ringing/active calls when an accepted C01 contact is declined/revoked, either account becomes inactive, or reciprocal R15 privacy/platform restriction appears. Emits **durable terminal notification/outbox rows in the same SQL statement**; terminal row processing closes the actual room. No new platform-wide listener or unauthorized global route. SQL uses `FOR UPDATE OF c SKIP LOCKED` and bounded batches.
- **Critical retry repair:** removed `attempt_count < 10` permanent abandonment of failed media-room disconnect. Retains persistent retry with clamped attempt counter (255) and bounded exponential backoff (5 sec to 5 min). Real provider unavailability remains observable via `last_error_code='delivery_unavailable'`; operator monitoring/alerting and scheduled worker registration are still required before any feature activation.
- `services/gateway/src/human_calls/livekit_room_revoker.ts`: actual server-only HTTPS LiveKit Twirp `POST /twirp/livekit.RoomService/DeleteRoom` implementation with short-lived signed HS256 `roomCreate` grant constrained to opaque human-call room; clean WSS host validation, 5s default AbortSignal timeout, strict room identifier, idempotent handling of genuine Twirp `not_found`, and fail-closed/redacted errors. **No LiveKit SDK package increase.** Official protocol: https://docs.livekit.io/reference/other/roomservice-api/ and https://docs.livekit.io/reference/server-sdk-js/classes/RoomServiceClient.html
- `services/gateway/src/human_calls/composition.ts`: new `composeLiveKitHumanCalls` factory supplies a single concrete room revoker both to `HumanCallService` and the existing terminal outbox runner. Shared `app.ts`, `main.ts`, package manifests, migration registry, Firebase and existing C01/C02/R15 modules remain untouched.
- Authored two new `signal_worker.test.ts` tests for block/revoke/inactive predicates and retry-after-provider outage, plus five `livekit_room_revoker.test.ts` cases covering JWT scope, endpoint, strict URL/room, Twirp 404 versus unknown 404/500 and response redaction.

### Executed evidence, accurately scoped
- **EXACT committed source verified:** private tool-side runtime copies of `livekit_room_revoker.ts` and `signal_worker.ts` matched their repository Git blob SHAs `994c133a84cefe29e14f0edfd5228729cefbcc7c` and `73ac3a5ebf9d3335da377dae3c3b3efeeaf87cf2` respectively using `git hash-object`.
- **PASS_SIMULATED**: Node 22.16.0 with TypeScript 5.8.3 `transpileModule` produced runnable CommonJS from the exact source; the built-in `node --test` exercised **4/4 LiveKit Twirp fake-fetch tests**, including JWT, TLS endpoint, real 404 JSON classifier, bad host and redacted provider failure; and **5/5 signal worker fake-SQL/provider tests**, including order, durable failure and replay, SQL revocation predicates, bounded batches. No network or real provider was contacted. This is stronger than prior static source assertions, **not a full typecheck, actual repository Vitest run, a real PostgreSQL SQL execution or real LiveKit disconnect**.
- Existing 23 original automated cases + new seven Vitest cases are authored, **NOT EXECUTED as actual repository tests**. Flutter/Dart SDK, complete runnable checkout, Android device and actual LiveKit credentials absent in this environment; no full Gateway TypeScript compile, Postgres, 2-device, incoming FCM or signed APK test. Actions #457 remains an independent CI restriction, not a source result.

### Remaining mandatory code and release gates
1. F15/DB owner must assign **one** C09 migration after canonical C01/C02/C03 reconciliation and run real disposable PostgreSQL 18 migrations, transaction/concurrent-user/block race and outbox tests. The worker revocation predicates must be validated against actual merged schema.
2. R14/F10 must register the bounded worker on an approved cadence with an actual authorized push sender; protect privacy in OS notifications, integrate sign-out/device-token deletion, monitor repeat revoker failures; incoming background/terminated behavior still not qualified.
3. F12 must mount C09 buttons, incoming banner and call history in human Chats only, with permission/reconnect/back cleanup and R11 localization. Backend Gateway composer must register routes only after provider and auth integration. No sixth tab, public Talk media or finances touched.
4. Real backend LiveKit credentials and two phones: confirm `DeleteRoom` ejects **already-joined** participants on hangup, timeout, decline, contact revoke, reciprocal block and account deletion, including provider outages and recovery. Verify notification idempotency, audio focus and media costs. Use explicit owner approval before production deployment.

**Latest source/test checkpoint prior to documentation commit: `fa17843a944121e22224787f3412d4dd8e08879c`. PR metadata points at final handoff commit.**
