# R13 — expiring authenticated replay playback and account isolation handoff

Updated: 2026-10-08; owner/window: GPT-6 isolated R13 replay playback source.
**Bounded slice: IMPLEMENTED_UNVERIFIED, NO EXECUTED E2E. Whole R13: PARTIAL_IMPLEMENTATION, provider/recording/device blocked.**
Claim/lease: this path, initial claim commit `b7e6101f3b82ea7ec9c485c43b1092511bf3628c`; subsequent visible source/test pushes on this branch renew the five-minute activity lease. No permanent ownership once inactive.
Base **latest main at branch creation**: `226d0c58632b243661ab24904cca75700ed474d4` (main had advanced after first inventory at `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`).
Branch `work/r13-replay-expiring-playback-20261008-gpt6`; last substantive code HEAD before this handoff: `b50d169fb25918eed88864fd4873a0e1cb734cd6`; draft/unmerged PR [#503](https://github.com/Baatiku/masanawa/pull/503), final pushed head discoverable from PR. **R13 adjacent backend recording work**: [#453](https://github.com/Baatiku/masanawa/pull/453) `b624646dece4aeffbb1cf8c539e1e84669954299`—retain separately, do not overwrite.
Trace: R13 / T08 / P01 / J05 / J11; replay recording and publication qualification remain gate-blocking.

## Exact owned paths and source completeness

- `apps/mobile/lib/src/talks/talk_replay_playback.dart`: strict HTTPS/no-userinfo/no-fragment signed-media credential parsing; freshness check with 15-second margin; renew via signed-in transport on expired resumed playback, including resume/seek position; never autoplays a paused seek; silences prior stream before refresh; stale/cancelled/unauthorized loads never replay. Non-blocking `play()` future handling (JustAudio play may resolve only on pause/end), operation sequencing, late audio callback/failure guards; required `canAccess` callback, no permissive production default.
- `apps/mobile/lib/src/state/talk_replay_playback_state.dart`: Riverpod factory binds each controller to signed-in active user ID; provider invalidation closes live media on sign-out or account switch, without resetting on same-account token refresh; current account rechecked before authorization/load/seek/play.
- `services/gateway/src/talk_replay_routes.ts`: `GET /talks/:talkId/replay/playback` response carries `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, `Vary: Authorization`. **Existing service** enforces verified session tenant/user and repository playback media status/publication/safety; no new public URL resolver or storage authority.
- `apps/mobile/test/talk_replay_playback_session_test.dart`: existing 5 + 8 added Flutter unit regressions: expiry/refetch/reseek, auth revoked on resume and during pending network load, stale URL refusal, no autoplay on expired seek, nonblocking pause, HTTPS URL hygiene.
- `services/gateway/src/talk_replay_routes.test.ts`: existing 3 + 1 added negative-auth test; success adds no-cache/no-sharing header checks.
- This `docs/workstreams/r13-expiring-playback-client-20261008.md` claim/handoff.

**Database/migrations:** N/A — existing `talks.replay_sessions`, `talks.replay_media_jobs`, `talks.talks` and `talks.safety_enforcement`/existing Gateway queries already authorize replay publication, host/public visibility and signed media lookup. This slice does not need schema writes or its own ledger. No provider secrets in code, no new object store, no mock/shortcut in production. No root shell edits.

**User-visible path:** authenticated Talk replay → Play → signed HTTPS URL from Gateway → player streams; Pause then later Play after expiry → reauthorize against current account/tenant/visibility → fresh signed object URL → restore position only if newly allowed. Retry after provider/network failure obtains fresh authorization. Silent/tap actions remain existing Talk Play/Pause/Seek/Retry controls. If revoked or on account switch, local media stops/fails; the prior signature is not reused by this controller. A signed link already delivered and downloaded outside the app cannot be globally clawed back by mobile code; server/object storage revocation and TTL policy remain independently necessary.

## Verification truth

**Executed:** GitHub readback of five changed source/test files at branch HEAD; 10 static source-consistency assertions **matched**, including required authority, freshness, nonblocking play, API no-store headers and negative permission cases; 13 Dart tests and 4 Gateway tests now authored across the whole focused files. **This is only static text review, NOT executable Flutter, Node/TypeScript, PostgreSQL, S3, Android or CI verification.**

**Not executed (exact blockers):** container `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed with `Could not resolve host: github.com`; the shell has Node but no Flutter/Dart SDK or `pnpm` binary. GitHub Actions incident [#457](https://github.com/Baatiku/masanawa/issues/457) reports runner/quota failures before execution. No repeated CI attempt. Production S3 Egress, replay recordings, private account B, Android hardware, Apple device and DB test credentials were not used. **No tests actually passed in this window.**

**Work execution commands, after fetching all branch dependencies:**
```sh
pnpm install --frozen-lockfile
pnpm exec vitest run services/gateway/src/talk_replay_routes.test.ts services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts services/gateway/src/talk_replay/postgres_repository.test.ts
pnpm --filter @masanawa/gateway-service typecheck
pnpm --filter @masanawa/gateway-service build
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/talk_replay_playback_session_test.dart
```
Then run a **real database + two-device authentication test**: account A obtains playable authorized recording, leaves the player paused until 15s before signature expiry, resumes/reseeks after refresh and preserves position, unpublishes/blocks Talk and verifies 404/403/failed player (not cached 200), switches A→B mid-play and during HTTP load (audio closed, no A leak), goes offline then retries online with fresh credential; confirm HTTP intermediary no-store and provider TTL, service revocation/restart, no public audio when private. Test physical Android just_audio Pause under an unfinished `play()` Future and permission denial. Test actual LiveKit Egress and private S3 object handling separately against #453.

## Collisions, dependencies, risks and Work actions

- Open #453 edits `services/gateway/src/talk_replay/egress/{coordinator.ts,coordinator.test.ts,postgres_media_repository.ts,postgres_media_repository.test.ts}` and another workstream handoff, **not our six paths**. #497 broad Work integration edits that same backend R13 coordinator but not these six paths at inspection; preserve and semantically reconcile #453 and #497 before R13 merge.
- Shared #457 Actions/runner recovery and final owner Work window are independent; do not merge #503 simply because it has no direct changed-path collision.
- **Known remaining whole-R13 source gaps owned by #453/future integration:** cross-Gateway Egress start admission/duplicate remote object race, crash-durable abort/delete cleanup worker, remote stop-before-DB-error recovery, actual storage/egress qualification and complete account/safety lifecycle. These are **not implemented here**; whole R13 remains PARTIAL.
- Risk: clock skew beyond 15-second margin can result in honest failed replay until device time corrected; signed GET already being streamed may survive subsequent server visibility change until player is closed; gateway no-store mitigates HTTP intermediaries but not third-party captures. Test with actual provider, confirm policy and TTL. No irreversible migration; rollback this branch's six changes together if needed.
- **Next exact actions**: (1) obtain executable checkout and run focused tests/analysis, fix actual compilation; (2) verify Gateway denied/restricted/expired behavior with isolated Postgres and S3; (3) validate replay A/B Android pause/seek/expiry/logout; (4) reconcile + test #453/#497 and unresolved cross-instance recording and cleanup; (5) verify latest main drift/CI, only then review and merge. No deployment performed.

## Release gates

| Gate | Result |
| --- | --- |
| SOURCE_WRITTEN (bounded playback slice) | yes, static GitHub readback |
| LOCAL_TESTED | no — unexecuted |
| CI_EXECUTED | no — #457 |
| DB_INTEGRATED | existing repo source, real DB unverified |
| APP_INTEGRATED | existing Talk screen/provider wiring, Android unverified |
| DEVICE_VERIFIED | no |
| PROVIDER_QUALIFIED | no |
| DEPLOYED | no |
| MERGED | no |
| FULL_R13_DONE | **no** |
