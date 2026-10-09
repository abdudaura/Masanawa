# F09 / R13 — cached private replay seek authorization recovery

Updated UTC: 2026-10-09T03:09:09.606Z
Window owner: independent F09 recovery continuation, 2026-10-09
Status: IN_PROGRESS / PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED
Existing PR: https://github.com/Baatiku/masanawa/pull/503 (reuse; no duplicate PR)
Branch: `work/r13-replay-expiring-playback-20261008-gpt6`
Observed current main: `5e758673ae91082520b21b3153da53791ae2cbf3`
Inspected existing PR HEAD before claim: `33cf9adb2309f8f242594a188fc84cecd3c70238`
Five-minute ownership activity: THIS commit, from which five-minute activity lease runs.

## Exact-path claim (no shared composition)
- `apps/mobile/lib/src/talks/talk_replay_playback.dart`
- `apps/mobile/test/talk_replay_playback_session_test.dart`
- `docs/workstreams/f09-cached-seek-authorization-20261009.md`

Stale claim determination: latest inspected PR activity 2026-10-08T20:08:44Z, older than five minutes. Preserve all existing source, tests and previous F09 claim/handoffs. No production systems, provider credentials, shared app/root router, Firebase, migrations, ledger, Talk publication or S3 settings.

## Reproduced source-level issue, not yet executable proof
The existing controller correctly rechecks access and signed URL freshness after *refreshed* `player.seek`. But the ordinary cached/valid-URL `seekTo` path awaits `player.seek(position)` without rechecking either condition. Native player position callbacks also update snapshots without checking account access or URL expiry. Thus mid-seek logout/account switch/signature expiry can leave a stale playing/paused snapshot and buffered private media until another explicit action.

## Implementation and tests to add
1. Fail closed after an awaited cached native seek if `canAccess` became false or the URL expired, and pause/clear playback credentials.
2. Guard position/duration events against revoked sessions and stale credentials; prevent further visible private replay progress.
3. Add deterministic delayed cached-seek tests for account switch, expiry, and revoked session on native callbacks; preserve prior refreshed-seek tests.
4. Run every locally available check; record Flutter SDK/CI/device/provider blockers separately. No E2E readiness claim.

## Integration dependencies
R13 egress/recording #453, existing R13 playback #503, Work integrator #497, F12 five-tab router, Firebase #461, Actions quota #457 and real Android+S3+Postgres playback authorization. Final integrator should reuse this PR at its exact HEAD, not substitute a second replay player.

## Verification/evidence to be completed
Await source commit, static review and best available test execution. Required native tests: `cd apps/mobile && flutter test test/talk_replay_playback_session_test.dart && flutter analyze`; real-device signed URL expiry/logout/seek and replay revocation remain gated. Release status remains PARTIAL_IMPLEMENTATION.
