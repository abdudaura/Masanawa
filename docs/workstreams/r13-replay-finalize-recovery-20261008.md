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

## 2026-10-08 renewed 5-minute lease: privacy-first replay abort recovery

Reclaimed existing draft #453 after last update 2026-10-08T06:18:08Z (>5-minute activity lease), previous pushed HEAD `ad3b6fb0113e0b9bcc422aa19ba9c8fb87ed0c9f`, current main `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. No competing owner of scoped R13 paths found. **Exact exclusive paths:** `services/gateway/src/talk_replay/egress/coordinator.ts`, `coordinator.test.ts`, `postgres_media_repository.ts`, `postgres_media_repository.test.ts`, this handoff. No migration, shared Gateway composition, LiveKit/S3 adapter, R15 safety state, Flutter app shell or finance edit.

Target continuation: on abort, persist server-authoritative `aborted` state **before** possibly failing object deletion so playbackObject immediately refuses; retry deletion safely after failure, without rewriting prior aborted stop timestamp or re-stopping Egress. Add focused unit/SQL tests. Does not claim to resolve separately documented cross-Gateway Egress start race. Keep draft/unmerged with exact blocked checks.

## 2026-10-08 finalized replay-abort security/recovery continuation — Work handoff

**Claim & original provenance:** Existing draft PR #453 resumed, no duplicate PR. Last original head `ad3b6fb0113e0b9bcc422aa19ba9c8fb87ed0c9f` (last update 06:18:08Z, well beyond five-minute claim); main reviewed `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Repository-visible reclaim `2a52ac6d0ead9d44f94f7abfd365e78721bc5ab0`. Shared R17/C08, C02/C03, R15 safety, financial ledgers, S3/Egress providers, Gateway composition and migrations excluded. Requirement scope R13, T08/Q06/Q10, J05/J11. Original replay recording consent/auth and Flutter playback continue in existing code unchanged.

**Implemented in the scoped existing backend+Postgres repository, not an independent UI or mock production path:**
- In `services/gateway/src/talk_replay/egress/coordinator.ts`, stop active Egress when required, then commit the authoritative `aborted` media-job state **before** calling the fallible S3 object deletion. This revokes signed playback authorization (which already requires `m.status='ready'`) even if S3 is down. A second abort loads `aborted` state, skips re-stopping Egress, and retries object cleanup without declaring false success after the first failure.
- In `postgres_media_repository.ts`, `markAborted` retains the first completed timestamp by `CASE WHEN status='aborted' THEN completed_at ELSE $4::timestamptz END`; exact tenant/talk/recording scoped update, missing row still fails. CAS ready transition stays `status='stopped'` so discarded media cannot be resurrected.
- Added 2 replay coordinator tests for first deletion failing then successful cleanup/readback denial (with original stop timestamp), and DB abort failing (must not delete); added 2 SQL contract tests for conditional abort state update and missing-row error. Retained all prior source/tests.

**Code/test commits:** `58382aa743fc423bab0bf94e5592ab94e2646791` (coordinator), `69567896082150b43466da6cb7ac604d8685c4a6` (SQL), `3ca98d1144b9261a2d169130a743ff26be27e56c` (recovery tests), `1a41d3eb2298aebe4ab0631a8cc392928589d645` (repository tests).

**Executed:** GitHub connector readback of four exact files and six standalone V8 source-content assertions (source order, skip stop when already aborted, SQL timestamp CASE, two coordinator test declarations and SQL tests) all passed. These are **static** checks, NOT typecheck, Vitest, SQL execution, LiveKit/S3, Android or public playback evidence. CI issue #457 reports zero-step Action quota failures; no repeated retry. No real user, DB, object, token, production credential or deployed service was accessed.

**Not executed (final Work commands/evidence):** `pnpm install --frozen-lockfile`; `pnpm exec vitest run services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`; `pnpm typecheck` and replay/security regression suites. Run isolated real PostgreSQL transaction tests for 2 aborts with distinct times, absent tenant/recording, abort vs markReady race and multi-account playback; inject real transient S3 delete failure and verify signed URL never issued after DB abort and cleanup retry works. Qualify LiveKit Egress stop/idempotency, replay publication, S3 object lifecycle, Android playback, privacy/restricted replays and end-to-end Talk host discarding. Cross-process Egress start race remains **missing implementable source**, explicitly acknowledged in previous section; resolve by coordinated DB admission/lease and LiveKit concurrency tests on separate R13 shared migration owner, not an in-process-only illusion.

**Partial failure concern:** If Egress stop succeeded but DB abort write failed, a later stop retry might find an already stopped Egress; behavior depends on actual LiveKit adapter. This residual recovery path is **NOT proven** and needs real adapter idempotence or a durable `aborting` claim to close. The current continuation repairs storage-deletion ordering and confirmed DB revocation, **NOT** the full R13 recording lifecycle. Replay status and global R13 remain PARTIAL_IMPLEMENTATION. Never call the entire replay feature implemented/verified based on this scoped code.

**Rollback and final merge:** Review parent source and current main, reconcile conflicts in these five files, run real checks with traceable logs at commit SHA, ensure cleanup/tombstone job can reconcile persistent S3 failures (currently manual re-invocation is required), preserve DB tenant isolation and recording policy. Revert these commits only with privacy review; returning to delete-before-revoke risks signed replay availability while storage is unavailable. PR remains **DRAFT/UNMERGED**; no deploy/merge signoff.

**Gates:** SOURCE_WRITTEN=yes for bounded abort-delete ordering; UNIT+SQL_TEST_SOURCE_WRITTEN=yes; LOCAL_TESTED=no; CI_EXECUTED=no; DB_INTEGRATED=source-only/unverified; APP_INTEGRATED=reuses server playback, not device-tested; DEVICE_VERIFIED=no; PROVIDER_QUALIFIED=no; DEPLOYED=no; MERGED=no; FULL_R13_DONE=no. No migration required for conditional `markAborted` update; required global R13 cross-process admission migration separately pending.
