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
