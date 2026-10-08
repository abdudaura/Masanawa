# F09 / R13 replay recovery — seek authority fence

**2026-10-08. Claim only:** this is a narrow recovery of existing draft [R13 #503](https://github.com/Baatiku/masanawa/pull/503), not a replacement replay implementation. Existing head at inspection: `2f13e7b0ea37506d7e62a3587828d785169ddf01`; live main: `5e758673ae91082520b21b3153da53791ae2cbf3`. The last #503 activity was older than the five-minute repository ownership lease. Work integration #497 holds an earlier copy of this PR; later integration must salvage this additive correction.

## Explicit exact-path lease
- `apps/mobile/lib/src/talks/talk_replay_playback.dart`
- `apps/mobile/test/talk_replay_playback_session_test.dart`
- This claim/handoff file only.

**Bug to address:** `_loadFresh` checks current authorization/freshness before awaiting `player.seek` but, after that await, can publish cached private credentials and the new paused state despite sign-out, account switch, or expiry while the seek is pending. If `autoPlay` is true it invokes the authorization check in `_beginPlaying`, but the prior saved credentials can still enter state without rechecking. Enforce both conditions after seek and add deterministic delayed-seek regression tests for authorization changes and expiry. No changes to Gateway composer, provider secrets, DB migrations, core auth, financial handlers, five-tab router, Firebase, S3, or media/replay policy.

## Verification and handoff
Source and tests will be committed on the existing #503 draft. Static source inspection alone is **not** an executed Flutter regression. CI #457 still reports zero-step hosted failures; the final integrator needs `cd apps/mobile && flutter test test/talk_replay_playback_session_test.dart`, `flutter analyze`, and device tests (logout while seeking/playing, stale signed URL, replay unpublish/blocked contact). Preserve Work #497's other R13 changes. **Status: IN_PROGRESS / UNVERIFIED / DRAFT / UNMERGED.**
