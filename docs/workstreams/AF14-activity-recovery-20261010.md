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
