# AF14 Activity response/readback recovery — 2026-10-10

Status: **PARTIAL_IMPLEMENTATION / DRAFT / NOT DEPLOYED**. This is a bounded implemented Activity screen slice, **not** the whole AF14 Settings/account/activity workstream.

## Claim and source

- Window: MASANAWA-01 / AF14 Activity recovery
- CAS claim ID: `masanawa01-af14-activity-recovery-20261010-d`
- Registry branch: `factory/claims`; claim commit `201311a979ac7fa6b591cc35f9c91dc88ad24cf7` (verified readback)
- Claim UTC: 2026-10-10T01:34:02.408Z (five-minute lease; release after this handoff)
- Branch: `work/af14-activity-recovery-20261010-masanawa01-d`
- Base main: `f381f077c485c04261459b77a42c215d3ce3a14b`
- Source checkpoint: `c5db944ff4095621c7ca1d324cf8341467769c4b`
- Source + three widget-test checkpoint: `eeed0514d1d5bccd5f1c8f70b1ba2d691e3325be`
- PR: https://github.com/Baatiku/masanawa/pull/604

### Exclusive paths

- `apps/mobile/lib/src/screens/activity/activity_screen.dart`
- `apps/mobile/test/audio_first/af14/activity_recovery_test.dart`
- `docs/workstreams/AF14-activity-recovery-20261010.md`

## Actual implementation

1. Invitation Accept/Decline mutations are independent from the subsequent Activity list refresh. A successful write no longer becomes a false failure merely because readback is offline; the watched list can show its own retryable error.
2. Uncertain/failed submission no longer claims definite refusal or success. It advises checking authoritative state. The decision path refreshes both All and Talks projections, even when the user has switched filters.
3. Read errors offer a labelled Try again button; refresh errors are contained within Riverpod instead of leaking callback Future exceptions and raw provider details. Loading and empty lists already have always-scrollable surfaces.
4. Added three Flutter widget regression cases: failed initial list -> retry; successful mutation + failed readback; uncertain mutation -> neutral feedback and redacted diagnostics. Existing `apps/mobile/test/activity_screen_test.dart` remains unchanged.

## Reconciling prior work

- #497 currently contains this Activity screen, with the same pre-fix mutation/readback mistake; the visible difference in its prior screen is an older background-color assignment. Preserve all non-equivalent Work changes when integrating, do not overwrite Work wholesale.
- AF14 #587 owns Settings clearing only, not these exact paths. #600 owns root navigation; #601 owns media access. No root router, localization, migration, API, platform-finance, storage, native permission, or deployment file changed.
- Authority: `TalkActivityTransport.respondToInvitation` and `talkActivityProvider`, not an alternate invitation API or local accepted-status store. Legacy live-Talk invitations remain legacy event types and must not be renamed into audio posts.
- Current product contract: `CONTINUE-HERE.md`, `docs/AUDIO-FIRST-PRODUCT-20261009.md`, `docs/AUDIO-FIRST-SCREEN-SPECS.md`, `docs/MULTI-WINDOW-WORK.md`; current five tabs (Chats/Rooms/Talks/Gwani/Wallet) and centre/default Talks belong to AF00.

## Verification and outstanding evidence

| Gate | Result | Explanation |
| --- | --- | --- |
| GitHub exact-path claim/readback | PASS (registry) | `factory/claims` readback after claim commit; no active path overlap on claim |
| Source and widget test text readback | PASS (bytes) | Fetched the committed files back from feature branch after both writes |
| GitHub Actions at handoff SHA | **BLOCKED/FAILURE (zero reported steps)** | Foundation CI run `38013883817` job `114099793175` and Mobile Build run `38013883787` job `114099793066` concluded failure but API returned `steps: null`; not executable Dart test results. Vercel status also failed with account build-rate-limit upgrade link; do not treat as source regression without logs. |\n| Flutter widget regressions | **NOT_RUN** | Flutter and Dart executables absent in this runtime. Run `cd apps/mobile && flutter test test/activity_screen_test.dart test/audio_first/af14/activity_recovery_test.dart` |
| Flutter analyzer/build | **NOT_RUN** | Flutter/Dart toolchain unavailable. Run `cd apps/mobile && flutter analyze lib/src/screens/activity/activity_screen.dart test/audio_first/af14/activity_recovery_test.dart` and qualified build |
| Two-account invitation/provider/real readback | **NOT_RUN** | No provisioned live test identities or authenticated Gateway + database |
| Android device/notification/deep-link | **NOT_RUN** | No connected device or local owner's APK; AF00 integration needed |
| Integration merge/production release | **NOT_DONE** | PR draft, safe integration review still required, no implicit deployment |

**Remaining:** after executed Flutter checks, compare latest #497/#604 exact heads and preserve unique source. AF00 integrates Activity into authenticated navigation on safe non-deploying target and verifies invitation status from the real Gateway. Relevant UX Activity controls: invite action, filtered listing, loading/error/offline/retry and correct human-visible status. Overall AF14 SA-A01..08 Settings/deletion/account qualification remains open.

**Next action:** run stated Flutter commands in a Flutter-capable checkout at PR head, fix any real failures, then request AF00 integrator to merge this non-overlapping slice after confirming deploy triggers and #497 changes. Do not interpret mutation HTTP success as proof of a live invited-user end-to-end journey.


## Continuation — account-specific Activity journey (2026-10-10)

**Delivery-policy alignment:** `docs/NEXT-WAVE-DELIVERY-20261010.md` supersedes free selection of micro-fixes. This continues **the same PR #604**, tied to the Phone/email and Settings customer milestone (AF08 + AF14); it is not a new helper branch or completion of that milestone. Root integration and linked credentials remain with AF00/AF08.

**New exact-path CAS claim:** `masanawa01-af14-activity-account-fence-20261010`, published and read back on `factory/claims` at `9ac3126439ecd8840f6b0bebf857eb4f61ea984d`, renewed at `17f8c86f5094588f6c905aa85af84c5936dc156b`. Existing #604 source and original widget regressions are preserved. Additional explicitly claimed files: `apps/mobile/lib/src/state/talk_activity_state.dart`, `apps/mobile/test/activity_screen_test.dart`. No root routing, SQL, gateway, migrations, native, CI, financial or auth-authority files edited.

### Connected authority and implementation

- Live source confirms `GET /activity` under `talk_activity_routes.ts` and the original human invitation `POST /talks/:talkId/invitation-response` under `talk_moderation_routes.ts` from already merged PR #389. **No duplicate invitation API is needed.**
- The prior `talkActivityProvider` depended only on `talkActivityTransportProvider`; its shared `ApiClient.accessToken` is mutated in place by `SessionController`. Consequently a filter-keyed Activity provider could retain a prior account's private list across signout/change.
- The provider now watches the canonical `sessionProvider`, returns no private list when signed out, and invalidates its data and in-flight read when the signed-in identity changes. The Activity screen distinguishes signed-out from actual empty Activity.
- The Accept/Decline UI snapshots its authenticated user and action generation. A prior-account completion cannot report success, invalidate another user's projection, or clear the next account's pending action. A session change immediately clears the prior busy indicator.
- Original `test/activity_screen_test.dart` now supplies a deterministic authorized test session rather than relying on a persistent local secure-store login. The dedicated AF14 test adds four account-boundary cases: session switch readback, old-account delayed mutation, signout, and late prior-account GET response. Combined new AF14 widget-test cases: **7 authored, NOT_EXECUTED**. Existing Activity tests remain preserved.

**Source checkpoints after continuation:**
- Session-fenced projection source `efb57c38aceefa03a69a9c637b3e0c8848ea3467`
- Account-fenced invitation screen source `bd577f0a4e5210611c842915f3eaeb14b7913100`
- Existing Activity fixture `86f7a64e31389eac2a71cbfe55d98f9b794d3dfd`
- Delayed GET regression source `39c77b643d653d3787b7e3ef512efa1206a2f4df`
- Main refreshed `c7f7280e640d3098be3e26f05149a0d66085441b`; this branch remains one documentation commit behind main (no runtime conflict shown in compare).

### Execution / integration truth

Local commands actually attempted in the available isolated runtime:

```sh
command -v flutter
command -v dart
GIT_TERMINAL_PROMPT=0 timeout 12 git ls-remote https://github.com/Baatiku/masanawa.git HEAD
```

`flutter` and `dart` not installed or available on PATH; `git ls-remote` failed with `Could not resolve host: github.com`. The GitHub connector read back source blobs; this validates text persistence, **not** Flutter compilation, unit execution, device authorization or backend persistence.

**Required execution owner:** AF14/AF00 with a Flutter-capable checkout; run at the specific latest #604 HEAD, then again at the unified integration SHA:

```sh
cd apps/mobile
flutter test test/activity_screen_test.dart test/audio_first/af14/activity_recovery_test.dart
flutter analyze lib/src/screens/activity/activity_screen.dart lib/src/state/talk_activity_state.dart test/activity_screen_test.dart test/audio_first/af14/activity_recovery_test.dart
```

Review the #497 Activity screen unique diff (currently same legacy mutation outcome issue; distinct background token), #587/#606 Settings changes and #600 root nav, preserve owner's unreconciled local APK. AF00 must identify one non-deploying baseline after reviewing deploy triggers. The next integration action is a source-tested merge of #604 into that single baseline, **not main or production by assumption**. Status remains `PARTIAL_IMPLEMENTATION`; device/session/real two-account tests, combined Flutter tests and production are **NOT_RUN/BLOCKED**. The broader Phone/email and Settings milestone remains open until AF08 auth/recovery, AF14 profile/preferences/Settings composition and account/device journeys pass.


## Continuation — connected Activity read acknowledgment and truthful HTTP responses (2026-10-10)

**Parent customer milestone:** Phone/email and Settings, AF08 + AF14. Current main at latest source inspection: `6bbb689fd65d977984be2487e6a6bd56aaf83001`. This is further implementation on existing **PR #604** and `work/af14-activity-recovery-20261010-masanawa01-d`, not a helper branch or another integration baseline.

**Live exact-path ownership:** CAS claim `masanawa01-af14-activity-http-truth-20261010` on `factory/claims`, original registry write `b8eb6124e3a6c280c42f5fa94d5e19c8f32d23e2`, expanded to seven canonical backend read-ack paths at registry commit `7184ec96c80e9e922780ae43b6f9dedf9b6b0946`. The claim was read back before source changes. Existing #604 Activity/account-fence commits preserved; no shared `app.ts`, `main.ts`, router, migration registry, identity provider, finance, CI, native or production source changed.

### Implementation and evidence

1. The existing `GET /activity` transport no longer converts a 404 into a fabricated successful empty list, and no longer silently discards malformed entries. Six original/new HTTP transport regressions plus two read-ack regressions now cover route unavailable versus true 200 empty, malformed envelope/entry, authorized invitation shape, canonical Accept/Decline URL and authenticated read acknowledgment/404.
2. New `POST /activity/:activityId/read` uses **the existing registered Talk Activity Gateway service** and its platform customer session authorizer. The repository executes one atomic PostgreSQL `UPDATE talks.activity SET unread = false WHERE tenant_id=$1 AND user_id=$2 AND activity_id=$3 RETURNING activity_id`. No parallel Activity store or migration; the `unread` column already exists.
3. Missing/foreign activity ID is a uniform `ACTIVITY_NOT_FOUND` HTTP 404. Repeat mark-read is idempotent for the same signed-in user. Event upsert uses `unread = talks.activity.unread AND EXCLUDED.unread` to prevent duplicate delivery from reintroducing unread after an acknowledgment.
4. Flutter `TalkActivityTransport.markRead`, `GatewayTalkActivityTransport`, Activity UI and existing fake transports are updated together. An accessible “Mark as read” button appears only for unread entries, disables while saving, keeps unread on errors and re-reads the authoritative four projections after successful POST. Late responses are fenced by signed-in principal/session epoch.
5. Backend route tests include unauthorized, scoped successful read and foreign/missing activity; PostgreSQL tests check exact tenant+user+item predicate, denied update, and read-state preservation on event replay. Flutter tests cover actual transport requests, 404/malformed data and success/failed mark-read UI.

**Source checkpoint (pre-handoff document):** `a5c8f800ee9b41c35525a7a7a8a4889f48253cf4`. The post-document head must be fetched from PR #604 at handoff. Source/readback structural assertions checked **13/13** explicit cross-file conditions; this is TEXT/SOURCE INSPECTION ONLY, not a compiler run or unit test. The original seven account/Activity widget tests remain authored, with two additional read-control widgets. The test code is committed but **NOT_RUN**.

### Finite milestone closure checklist — source distinct from execution

| Required source item and owner | Relevant exact path / PR | Source state | Execution / integration |
| --- | --- | --- | --- |
| Activity invitation response + authenticated source | Merged #389; `services/gateway/src/talk_moderation_routes.ts` | EXISTING | Real two-account/device journey NOT_RUN |
| Activity account-fenced list, pending invite action and retry | #604 `apps/mobile/lib/src/screens/activity/activity_screen.dart`, `apps/mobile/lib/src/state/talk_activity_state.dart` | IMPLEMENTED_UNVERIFIED | Authenticated Flutter widget tests NOT_RUN; integration SHA not elected |
| Activity reliable transport and account-scoped read acknowledgment | #604 `services/gateway/src/talk_activity/{model,service,postgres_repository}.ts`, `services/gateway/src/talk_activity_routes.ts`, `apps/mobile/lib/src/activity/{talk_activity,talk_activity_http_transport}.dart`, tests | IMPLEMENTED_UNVERIFIED | PG, Fastify, Flutter and device checks NOT_RUN; no new migration required |
| Email/phone authentication, owner-requested numeric-password signup and safe recovery | AF08, existing #588/#597 and auth/onboarding canonical source | IN_PROGRESS / REMAINING SOURCE | AF08 must finish password/recovery, no ownership inference from phone; run security/session flows |
| Settings safe AI-cache clearing | AF14 #587 `settings_screen.dart` | IMPLEMENTED_UNVERIFIED (independent) | AF00/AF14 reconcile overlapping #497/#606 Settings, verify Flutter exact combined SHA |
| Settings device notification controls | AF14 #606 `settings_screen.dart` and notification controller | IMPLEMENTED_UNVERIFIED (independent) | AF00/AF14 reconcile with #587/#497, verify OS/app pending/rollback/account state |
| Account profile/avatar, support persona, Settings/security entry and installed app metadata | AF14 + AF08 + AF00; #497, #435, `screens/profile/edit_profile_screen.dart`, `screens/settings/settings_screen.dart` | PARTIAL / REMAINING SOURCE | Adopt existing avatar/security source; complete settings navigation/control bindings and semantic conflict resolution |
| Account/session revoke, deletion/export and unsettled financial obligations | AF08 + AF14 + AF01; existing deletion/profile work | PARTIAL / REMAINING SOURCE | Require authenticated server outcomes, obligations, readback and privacy/security tests |
| One reviewed non-deploying combined source baseline | AF00; #497/#600/#604/#587/#606/#588 + relevant dependencies | NOT_INTEGRATED | AF00 must choose, audit production hooks, reconcile exact paths and publish one pinned SHA |
| Qualified user journey and release | AF13 + AF00 + AF08/AF14 | NOT_RUN | Flutter/Gateway/Postgres authentic users and device, APK/signature/rollback proof; no local pull until remote source is complete and integrated |

### Executable verification and precise blockers

Environment in this window: Node `v22.16.0` (repository requires Node 24); `pnpm`, `flutter`, `dart` and `vitest` unavailable. No actual Masanawa Git checkout in the container. `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` returned `Could not resolve host: github.com`. GitHub connector source readback succeeded; no alternate executable whole-repository runner is available.

**Next AF14/AF00 execution owner**, on the exact current #604 head and again on the elected unified safe SHA:

```sh
corepack pnpm@12.8.2 exec vitest run services/gateway/src/talk_activity_routes.test.ts services/gateway/src/talk_activity/postgres_repository.test.ts
corepack pnpm@12.8.2 --filter @masanawa/gateway-service typecheck
cd apps/mobile
flutter test test/activity_screen_test.dart test/audio_first/af14/activity_recovery_test.dart test/audio_first/af14/activity_http_transport_test.dart
flutter analyze lib/src/activity/talk_activity.dart lib/src/activity/talk_activity_http_transport.dart lib/src/screens/activity/activity_screen.dart lib/src/state/talk_activity_state.dart test/activity_screen_test.dart test/audio_first/af14/activity_recovery_test.dart test/audio_first/af14/activity_http_transport_test.dart
```

**Integration warning:** #497 contains overlapping older Activity source, #587/#606 both change Settings. Resolve semantic conflicts before merge; don't replace working profile/security/avatar features, don't create competing integration branches, and don't activate financial/provider features or request a local pull. AF00 owns reviewed non-deploying baseline election and any shared-file transfers. Status: **PARTIAL_IMPLEMENTATION / AUTHORED TESTS NOT EXECUTED / UNMERGED / NOT DEPLOYED**.
