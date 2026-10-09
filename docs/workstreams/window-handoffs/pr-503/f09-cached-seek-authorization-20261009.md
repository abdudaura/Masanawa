# F09 / R13 — cached private replay seek authorization recovery

Updated (UTC): 2026-10-09T03:12:13.627Z; owner/window label: F09 isolated R13 recovery, 2026-10-09
**Status: PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT DEPLOYED / NOT VERIFIED_E2E.**
**Selected task:** complete an unclaimed stale security/recovery hole in existing replay playback PR, rather than open a duplicate workstream.

## Exact ownership and immutable evidence

- Latest main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing draft PR (continued, not duplicated): https://github.com/Baatiku/masanawa/pull/503
- Existing branch: `work/r13-replay-expiring-playback-20261008-gpt6`; prior inspected branch HEAD: `33cf9adb2309f8f242594a188fc84cecd3c70238`.
- Last prior PR activity: `2026-10-08T20:08:44Z` (> 5 minutes before claim).
- Repository-visible **claim commit before source edits**: `f495e455c70593391dee7d447d60ead1a053e0a8`.
- Implementation commits: `60b60385479e1087e21087af1a5a2d3c36fc96ad`, `156c4403a077258e73b0f485893904f347d1623e`.
- Test commits: `219ec304917556cb1da257894c0411296334e0ae`, `ad26c5af37bcaa2d7345bf5da4fa440b4d0b0689` (source/test checkpoint HEAD before this handoff).
- Verified GitHub blob SHAs: source `34ef5d7f63de585c30f69977a1675d91a7d7cf25`; tests `11dbe724dcdc3c3095c3e559eb273b567c194ca9`.
- Latest HEAD **including this handoff**: inspect PR #503 HEAD after the handoff commit; an identical self-referential SHA cannot be placed inside its own Git commit. Pin the final PR comment to that exact SHA.
- Branch diverges from latest main by **3 upstream commits** (as inspected); final integrator must reconcile it without dropping other #503 work or #497.
- Exact owned paths only:
  - `apps/mobile/lib/src/talks/talk_replay_playback.dart`
  - `apps/mobile/test/talk_replay_playback_session_test.dart`
  - `docs/workstreams/f09-cached-seek-authorization-20261009.md`
- Checked compare since previous HEAD `33cf9adb`: only these three paths; no migration, Gateway composer, global router, Firebase, finance or production configuration.

## User-security bug and implemented behavior

**Before:** the controller guarded authenticated signed-link *refresh* after an awaited native seek, but ordinary `seekTo()` using a cached still-valid link awaited `player.seek()` without a subsequent authorization/expiration check. Late native `position`, `duration` or `state` callbacks could update private playback state even after the signed link became stale or `canAccess` became false.

**Now:**
1. Every non-loading private playback position/duration/state event checks current access and cached URL freshness before publishing state. Invalid events fail closed, clear credentials and request native pause.
2. Ordinary cached seek revalidates both account access and signature freshness **after the awaited native seek**; revocation or expiry fails closed without returning a successful playback operation.
3. Revocation clears private credentials before attempting pause, so synchronous state callbacks cannot reactivate playback. A synchronous native `pause()` throw on a destroyed audio player is contained after credentials are cleared.
4. Preserved existing renewed-link, account-switch, player lifecycle and prior F09 source/tests. No new endpoint, signed URL scheme or storage provider; Gateway/S3/Postgres policy remains the existing authoritative boundary.

**Scope limitation:** this patch operates on Flutter R13 playback session source only. A physical Android buffered audio stop, signout delivery order and media read cancellation are **not yet verified**, and the wider F09/R13 replay recording/egress lifecycle remains partial. This is not entire F09 completion.

## Regression cases authored, NOT executed in Dart

Five deterministic widget-independent Flutter test cases were added to the existing test suite:
1. Access revoked while **cached** native seek is pending → failed state, native pause, no extra signed-link fetch.
2. Signature expires while **cached** native seek is pending → failed state and pause.
3. Position event after account revocation → private progress rejected; late state/duration cannot revive session.
4. Native duration/state event after signature expiry → credentials revoked, playback fails.
5. Native state event after logout when pause throws synchronously → no uncaught callback failure; failed state retained.

Existing refreshed-link seek revocation and expiry regression tests are preserved.

## Checks actually executed and environment

- GitHub exact-file readback and compare of branch vs pre-claim HEAD: **PASS for three claimed paths only**; no other path changed.
- Source-text static invariants against the just-written source and tests: **8/8 matched** (cached seek, all three native callbacks, fail-before-pause, caught sync native error, five new test declarations, preserved old refreshed-seek tests, isolated diff, no base rewrite). **These are structural checks, NOT Dart compilation or executed Flutter tests.**
- Local environment probe: Node `v22.16.0` (repository requires Node `>=24 <25`); `flutter` and `dart` not installed. Direct `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed because DNS resolution for `github.com` is unavailable in the local terminal. Authenticated GitHub connector enabled source read/write, but not executable Flutter checkout.
- **NOT RUN:** `cd apps/mobile && flutter test test/talk_replay_playback_session_test.dart`; `flutter analyze`; full mobile/widget/integration suite; Android APK/device, two-account signed-media acceptance, S3/LiveKit, database, provider, CI. No green test claim.
- Shared Actions runner/quota blocker: issue https://github.com/Baatiku/masanawa/issues/457 (documented external obstacle; no workflow retrigger).

## Dependencies, collisions, data and release safety

- R13 finalization/egress #453, existing R13 playback #503, Work integration #497, F12 one five-tab router #493, Firebase #461, security policy R12/R15 and CI #457 all preserved.
- No DB/schema change, auth policy or financial mutation. Signed private media credentials must remain account-bound and server-authorized; controller-side checks supplement, **never replace**, server-side read authorization.
- Existing five-root-tab architecture untouched: Talks · Chats · Assistant · Wallet · Agents. No new UX controls/screens, no public DMs, no unreviewed caching.
- Missing integration: source/test branch must be semantically applied to Work #497 replay controller, with merged authoritative changes compared by exact SHAs; branch is 3 commits behind main.
- Risk: native player can temporarily have buffered bytes while OS reports delayed events; require actual account-switch/seek replay device testing and signed URL revocation. No offline private playback promise.
- Rollback: revert the bounded controller/test commits on the PR branch if Android verification exposes callback regressions. No production rollout performed.

## Next integrator actions (in order)

1. Review the exact source/test checkpoint `ad26c5af37bcaa2d7345bf5da4fa440b4d0b0689` on #503 and reconcile upstream main+Work #497 before any merge.
2. With matching Node/pnpm where needed and Flutter/Dart SDK installed, execute `cd apps/mobile && dart format --output=none --set-exit-if-changed lib/src/talks/talk_replay_playback.dart test/talk_replay_playback_session_test.dart`, `flutter analyze`, and `flutter test test/talk_replay_playback_session_test.dart`. Fix *actual* failures without losing previous tests.
3. Test on real Android: play, seek while signed link expires, logout/account swap mid-native seek, pause failure while app killed, denied/stale/revoked server playback, background/restart; verify no private audio continuation or unauthorized bytes. Confirm legacy playback flows.
4. Integrate with #453 server replay media and auth, S3 signed GET/cache rules and F12 shell, then run real readback, storage, tenant-isolation and publication/removal acceptance.
5. Keep PR draft; after CI #457 and end-to-end gates are genuinely executed at final merged SHA, reconsider release qualification.

## Explicit release gates

| Gate | Status |
| --- | --- |
| Isolated source + authored tests | YES (pushed) |
| GitHub source readback/diff | YES (text/static only) |
| Dart compilation/test / Flutter analyzer | NOT RUN — SDK absent |
| Integrated backend + DB | UNVERIFIED — out of isolated change scope |
| Five-tab app composed | NOT MODIFIED — F12/Work owner |
| Android physical-device audio/permissions | NOT RUN |
| Actual S3/LiveKit signed-media playback | NOT RUN |
| CI #457 | BLOCKED (known runner/quota) |
| Production deployment / merge | NO / NO |

**Final disposition:** bounded F09 security code and five tests are present and pushed to existing draft PR. Full F09/R13 remains `PARTIAL_IMPLEMENTATION` and `NOT VERIFIED_E2E`.