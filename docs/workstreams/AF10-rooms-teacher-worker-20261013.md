# AF10 — bounded Rooms teacher staff-review runtime (2026-10-13)

Source baseline: `204ed142fc8bb90b02c7c62b49e5c4b9020f7e34`. Feature branch: `lane/af10-rooms-teacher-runtime-20261013-gpt6`.
Exact-path claim: `af10-rooms-teacher-runtime-20261013-gpt6` on `factory/claims`.

## End-to-end source path
Existing Room question admission creates the canonical `rooms.question.queued` event in `events.outbox`. The existing `createPgTeacherQueue` owns PostgreSQL claim/lease/fence, completion and retry; the existing `createRoomTeacherWorker` owns draft/staff handoff. This change exports that same queue and composes a bounded, non-overlapping timer into the actual worker service lifecycle. Under explicit opt-in it claims the existing question and moves it to staff review (never publishes content); stop/drain waits for in-flight claims before closing the pool. No second message queue, new migration, credits, billing, provider secret or Room auth source.

**Default OFF:** Both `MASANAWA_ROOMS_BACKEND_ENABLED=true` AND `MASANAWA_ROOMS_TEACHER_REVIEW_ONLY_ENABLED=true` are required. A review-only flag without Rooms backend or a runtime without the canonical pool is rejected at startup. This fallback does NOT generate an AI answer; real teaching/model qualification, approved staff answer publishing, notification delivery, realtime device/user acceptance and production activation remain OPEN.

## Verification
Added focused Vitest tests of disable/retry/fence identity, sequential scheduling, cancellation, and staff-only handoff; existing PostgreSQL 18 schema/worker suites retained. The hosted Status Video Integration workflow now checks Worker TypeScript before legacy Gateway global typecheck. Record actual workflow/job run IDs and exact source/main SHAs after execution; **NOT_RUN** until observed. Existing whole-Gateway TS failures must remain visible, not treated as a pass.

MUI-09, MUI-10, AF11 remain OPEN. MSN and Credits rollout flags OFF; staged `0112_msn_wallet.sql` stays outside production migrations. No provider acceptance or signed APK is implied.