# F09 / R13 — S3 replay object-store request boundary

**2026-10-09 claim: IN_PROGRESS; existing draft PR #453, branch `work/r13-replay-finalize-recovery-20261008`.** Five-minute ownership lease starts with this repository-visible claim commit; refresh on code writes. No other R13 change, deployment, merger, or production action is authorized.

## Fresh-repository provenance and no-overwrite check

- Inspected current `main` SHA `5e758673ae91082520b21b3153da53791ae2cbf3`, latest #453 head before claim `857565dfea9134b477f52eaf11a4b01a27cd157a`, #503 signed-URL client work, #543 U16 host consent, Work #497, F09 existing post-sign check, latest 48-lane reconciliation and F09/R13 contract.
- Last #453 commit 2026-10-09T01:07:50Z, older than the five-minute lease when inspected. #453 source and older handoffs stay intact. No competing edits observed on the two S3 paths below; preserve all other PR work.
- **Exact exclusive file lease:** `services/gateway/src/talk_replay/playback/s3_object_store.ts`, `services/gateway/src/talk_replay/playback/s3_object_store.test.ts`, `services/gateway/src/talk_replay/playback/verify_s3_boundary.mjs` (a new standalone executable Node 22 verification script), and `docs/workstreams/f09-s3-boundary-hardening-20261009.md`. No `main.ts`, `app.ts`, database/migrations, mobile roots, secrets, Firebase, provider settings or signing native files.
- Prior #453 F09 claim covered the coordinator and its tests, not the S3 object-store files. This is continuation of one existing R13 draft, NOT a second competing implementation.

## Security fault and proposed recovery

All authenticated private S3 GET (checksum/finalization) and DELETE (aborted media cleanup) calls currently use fetch's implicit redirect policy. Prevent redirects from causing a request to leave the signed S3 authority or invalidating the signature: set `redirect: "manual"` on both requests and reject 3xx statuses as errors instead of following them. Reject S3 endpoint URLs carrying userinfo, query or fragment; require a clean HTTPS origin so SigV4 signs exactly the intended origin and path. Add regression tests for both hostile redirects, strict origin config, successful original-origin requests and bounded failures.

Status is **PARTIAL_IMPLEMENTATION / UNVERIFIED** until code, focused regression tests and handoff are committed. Reconcile with #503, Work #497, and U16 before eventual verified merge. Existing S3/LiveKit/PG/Android credentials and Actions #457 are not validated here.

## Implemented source checkpoint (2026-10-09)

**Classification:** F09/R13 remains **PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT DEPLOYED / NOT VERIFIED_E2E**. The bounded S3 redirect/origin recovery is implemented and independently runtime-tested, but not integrated with real media/provider/device/PG evidence.

**Existing branch/PR preserved:** PR #453 (`work/r13-replay-finalize-recovery-20261008`); initial checked head `857565dfea9134b477f52eaf11a4b01a27cd157a` (main `5e758673ae91082520b21b3153da53791ae2cbf3`). Exact commit sequence:
- Claim before code: `645a4d46767217464392c6a6f466e1f99cc56572`.
- Production fix: `e79d0ad450be656585a82d83a534bd15013d21fb`.
- Authored Vitest negative tests: `41cb4127e9f403a7dea46a65cdcaf4828c3a4864`.
- Extended file claim: `0d2566ebf3f828f185e9348be52de9bf34819cf5`.
- Standalone executable Node verification: `2d98a69fc9c534937d07fa1b19c8f501e5a79963` (the source/test implementation checkpoint). This final handoff and latest branch head SHA are linked from the PR body. No force push.

**Exact owned changes and behavior:**
1. `services/gateway/src/talk_replay/playback/s3_object_store.ts`: `fetchImpl` for private signed S3 checksum GET and object DELETE now uses `redirect:"manual"`. A 307/308/301 response is an error and is **never** treated as object readiness, successful removal, or followed to a different origin/path. Existing bounded 404 retry, signed auth, streaming SHA256/size guard, SigV4 short-lived presigned URL and Delete-404 idempotency are preserved. Clean HTTPS origin is mandatory: reject any userinfo, query, fragment or configured non-root path.
2. `services/gateway/src/talk_replay/playback/s3_object_store.test.ts`: maintain existing Vitest cases and add negative redirect GET/DELETE, origin validation and successful request manual-policy assertions.
3. `services/gateway/src/talk_replay/playback/verify_s3_boundary.mjs`: eight dependency-free `node:test` regressions; run independently via `node --experimental-strip-types --test services/gateway/src/talk_replay/playback/verify_s3_boundary.mjs` on Node 22+.
4. This F09 claim/handoff file. No new backend endpoints, auth authority, SQL/migration, providers, Flutter route/UI, finance or Firebase code. Replay sign/authorization remains under existing coordinator's Postgres checks and R13 #503 client's no-store recovery.

**Actually EXECUTED evidence:**
- Local Node 22.16.0, `node --experimental-strip-types --test /mnt/data/f09_verification/verify_s3_boundary.mjs`: **8 tests passed, 0 failed**. Cases cover signed GET integrity, 307 GET redirect refusal, 308 DELETE redirect refusal, HTTPS origin userinfo/query/fragment/path rejection, successful 204 DELETE, transient 404 bounded retries, SigV4 TTL, object size rejection.
- Verified local production `s3_object_store.ts` Git blob SHA **`98e268e077ff6d19f2b84ecdde9b81d10b90e1bf`** equals branch's fetched GitHub blob; verified local runner blob SHA **`f955682bdde74bc01a29e7e1d4366783a08f1aee`** equals GitHub file. Thus the eight runtime cases were run on the exact committed source and runner, not an independently rewritten mock.
- Fresh post-commit GitHub readback: **12/12** source/test structural invariants passed. This is additional static evidence, not a replacement for real tests.
- New associated Foundation CI run [37870786815](https://github.com/Baatiku/masanawa/actions/runs/37870786815): **failure before any job steps**; job `check` had `runner_id=0`, `steps=0` at 2026-10-09T01:38:55Z. It provides **no code failure/pass evidence**, consistent with shared [#457](https://github.com/Baatiku/masanawa/issues/457). Do not modify Actions settings in this lane.

**Still UNEXECUTED / handoff to designated integration and release owner:**
- Workspace dependency install/Vitest: `pnpm install --frozen-lockfile`, `pnpm exec vitest run services/gateway/src/talk_replay/playback/s3_object_store.test.ts services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts services/gateway/src/talk_replay_routes.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`. Not run: private repository clone DNS fails here and pnpm/workspace node_modules unavailable, despite a local Node/TypeScript executable.
- Actual S3/Spaces region redirects and signature acceptance: same-origin virtual-host vs path-style behavior, GET/DELETE with configured credentials, 404 visibility window, 307/308 response without following, checksum availability under streaming size and cleanup failure. Any legitimate provider regional redirect now fails closed; configure the final correct HTTPS S3 origin (not redirect-follow) and verify provider semantics first.
- PostgreSQL CAS/media publication and permission revocation during presigning; LiveKit egress start/stop concurrency, object cleanup after permanent error, actual Gateway route authorization/tenant isolation, blocked accounts, expired signatures, account switching/Flutter playback, two-device Android and audio, Firebase unaffected, production backup/recovery and full signed release checks. Do not claim these verified from Node tests.
- Compare #453 against **current** main before rebasing; at checkpoint it diverged (20 commits ahead, 11 behind), and existing #503 signed URL Flutter/caching, #543 U16 consent, #450 safety and Work #497/Firebase/shared router composition must be semantically preserved. Coordinate one Gateway integration owner and one Flutter root owner; no automatic merging, force-pushing or production changes.

**Residual risks:** already issued presigned URLs cannot be revoked by this boundary; requiring HTTPS origin does not make incorrect or malicious *configuration* trustworthy; redirects refused may surface legitimate S3 endpoint misconfiguration; media may stay orphaned after DELETE failure until durable cleanup is integrated. Full F09/R13 remains open.
