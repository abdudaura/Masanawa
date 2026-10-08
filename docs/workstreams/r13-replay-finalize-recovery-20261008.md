# R13 — Persisted recording stop time and crash-resumable replay publication

Owner: ChatGPT independent R13 media recovery lane. Branch: `work/r13-replay-finalize-recovery-20261008`; draft PR #453. Base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`; last repository-visible work 2026-10-08T06:18:04.202Z.

Owned paths: `services/gateway/src/talk_replay/egress/coordinator.ts`, `services/gateway/src/talk_replay/egress/coordinator.test.ts`, `services/gateway/src/talk_replay/egress/postgres_media_repository.ts`, new `services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts`, and this claim only. No shared gateway composition, migrations, replay domain, LiveKit service, mobile UI, or other claim files edited. No current open PR overlapped these exact files at claim time.

## Implemented recovery fixes

1. Read durable `media.completedAt` from stopped Egress, **not a later `finalize(now)` retry timestamp**, for the replay segment's `endedAt` and media ready timestamp. Validate strictly greater than recording start; reject missing/invalid custody instead of creating fake durations.
2. Sequence `appendSegment -> media.markReady -> replay.finalizeFromLive` so public replay cannot transition to published while the media job is still stopped/unready.
3. A crash after `markReady` but before replay finalization resumes only the canonical replay transaction; it does **not** stop, hash, or append media again. Existing ready-state retry logic is retained.
4. An aborted media job now stops before attempting replay publication, even with stale remaining session metadata.
5. PostgreSQL readiness mutation uses CAS `status='stopped' AND completed_at=$5::timestamptz`, only writes status/checksum and cannot overwrite stop time or resurrect an aborted media job.
6. The original LiveKit Egress + signed private S3, human Host recording consent, policy, ownership and replay publication contracts are reused unchanged.

## Verification and release state

Commits:
- `169e249e87fceffb9ac54f437154e0d18b078bca` — deterministic replay finalization order + original stop time.
- `e9146b3c31edbea520618d5e962b3b8e8e1b5fcd` — media ready CAS SQL.
- `a0fedd1144d446c5c01f567ed8d90780fc0bbc90` — four added coordinator crash/replay tests, retaining existing two.
- `bbfba91a692b6cf15e7a67178eec85b198d36d59` — two SQL repository contract tests.
- Source readback and test case count only: six coordinator + two SQL tests **authored; NOT EXECUTED**. No PostgreSQL test DB, S3 bucket, LiveKit Egress credentials, replay object, signed playback URL or Android runtime exercised.
- GitHub Foundation CI #37736791285 reports completed failure with **zero executed job steps**. This provides no evidence of code/test failure or success. Do not merge solely because the PR is mergeable.
- No production variables, object-store configuration, user recordings, deployment or mobile app affected. R13 remains **PARTIAL / externally BLOCKED**.

## Remaining risks and dependencies

- `start` currently starts Egress before persisting the media job; concurrent Gateways can race before createStarted and trigger duplicate remote Egress operations. Requires a durable unique pre-start claim/admission state, compensation and a PostgreSQL contention test; not included in this isolated path-only fix.
- Stopped/retry and abort may overlap at the Egress/provider boundary; CAS now blocks aborted-to-ready, but coordinated failure handling and final rollback must be acceptance-tested against real LiveKit/S3. Media-ready is not user-visible until canonical replay finalize succeeds.
- Replay recording stays unqualified while `MASANAWA_TALK_REPLAY_S3_*` production values and actual Egress service are missing or unverified. Do not expose media or imply a replay exists without provider confirmation.

## Required checks before merge

1. `pnpm exec vitest run services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts`
2. `pnpm --filter @masanawa/gateway-service typecheck`, root `pnpm check`, applicable replay/LiveKit/S3 integration suites.
3. Integration test real PostgreSQL status race and crash before/after markReady, verify immutable stop time in segment duration and no publicly visible unplayable replay.
4. Confirm S3 consistency, object checksum, signed URL authorization/TTL, Host/private publication, mobile playback and deletion under credentials/device acceptance.
5. Rebase only after fresh main/ownership check; never mark R13 DONE until evidence across backend, deploy, media and handset.

**Status:** CODE COMMITTED / TESTS AUTHORED / CI ZERO-STEP BLOCKED / NO LIVE STORAGE/DEVICE TESTS / UNMERGED. Lease released for next nonconflicting window.
