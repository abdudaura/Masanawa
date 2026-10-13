# AF10 — bounded Rooms teacher staff-review runtime (2026-10-13)

Source baseline: `204ed142fc8bb90b02c7c62b49e5c4b9020f7e34`. Feature branch: `lane/af10-rooms-teacher-runtime-20261013-gpt6`.
Exact-path claim: `af10-rooms-teacher-runtime-20261013-gpt6` on `factory/claims`.

## End-to-end source path
Existing Room question admission creates the canonical `rooms.question.queued` event in `events.outbox`. The existing `createPgTeacherQueue` owns PostgreSQL claim/lease/fence, completion and retry; the existing `createRoomTeacherWorker` owns draft/staff handoff. This change exports that same queue and composes a bounded, non-overlapping timer into the actual worker service lifecycle. Under explicit opt-in it claims the existing question and moves it to staff review (never publishes content); stop/drain waits for in-flight claims before closing the pool. No second message queue, new migration, credits, billing, provider secret or Room auth source.

**Default OFF:** Both `MASANAWA_ROOMS_BACKEND_ENABLED=true` AND `MASANAWA_ROOMS_TEACHER_REVIEW_ONLY_ENABLED=true` are required. A review-only flag without Rooms backend or a runtime without the canonical pool is rejected at startup. This fallback does NOT generate an AI answer; real teaching/model qualification, approved staff answer publishing, notification delivery, realtime device/user acceptance and production activation remain OPEN.

## Verified source checkpoint

Feature source commit: `78f255d11baf146bccf8583c4971f3c4bfca78ba` (PR #716). Hosted [Status Video Integration run #38407960243](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38407960243) on that exact SHA executed frozen pnpm install **PASS**, 21 Vitest suites / **91 tests PASS** (including seven new worker timer, concurrency, retry and drain tests and existing real PostgreSQL 18 migration/Routes suites), and dedicated `pnpm --filter @masanawa/worker-service typecheck` **PASS**. The same job then **FAILS** at whole-Gateway strict typecheck with previously observed legacy Talk/fixture errors (also failed on baseline main run #38404725081). Foundation run #38407959937 **FAILS** at pre-existing `packages/agents/src/talk-replay.test.ts` TS2459 (main run #38404724905 matched). These global failures are not green.

Flutter and signed device **NOT_RUN** for this Worker-only change; #715’s earlier Flutter passes cannot be counted as executed on PR #716. The new review-only path’s **real live Room user/worker acceptability** remains unqualified; source tested against synthetic queue, while existing migrations were tested on PG18. No production flag activated.

## Verification
Added focused Vitest tests of disable/retry/fence identity, sequential scheduling, cancellation, and staff-only handoff; existing PostgreSQL 18 schema/worker suites retained. The hosted Status Video Integration workflow checks Worker TypeScript before legacy Gateway global typecheck. The exact-sha results above distinguish passing tests from failing unrelated global typecheck.

MUI-09, MUI-10, AF11 remain OPEN. MSN and Credits rollout flags OFF; staged `0112_msn_wallet.sql` stays outside production migrations. No provider acceptance or signed APK is implied.