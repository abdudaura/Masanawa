# U25 isolated operator scheduling runtime (PARTIAL_IMPLEMENTATION)

Consent-gated reminders for an existing Talk, lesson, or artifact **only**. No automated payments, human messages, or AI-driven cross-account actions. The source includes RFC3339 once, daily/weekly IANA local-time scheduling, DST handling, quiet-hour denial, a persistent per-account 20-schedule cap, idempotent create, CAS pause/resume/cancel, owner deletion revocation, locked due claiming, unstarted work reclamation, and at-most-once provider handoff. If a push may have reached FCM, mark uncertain, **never blind retry**.

## Integration contract (not activated)

F11 migration owner registers `migrations/0001_operator_schedules.sql` in the **one** canonical migration registry, rehearses against isolated Postgres and verifies rollback/recovery. Do not run production migration from this branch.

F18 Gateway composer injects `createScheduleService({repository,customers,references})` into `registerOperatorSchedulingRoutes`; `customers` must be the real platform-session authorizer (not alpha/dev tokens), and `references.canSchedule` MUST authenticate current Talk/lesson/artifact ownership/visibility and return false by default. The API is only registered after the migration. Add `@masanawa/operator-scheduling` to Gateway dependencies and regenerate pnpm lockfile in that sole composer integration.

F11 worker owner starts a durable cron/interval using `createScheduleWorker`, bounded tick size, readiness, observability, and R14 FCM `MobilePushSender` bound to the same tenant/user. NEVER run the sender without real FCM credentials/repository and mobile permission qualification. The `dedupeKey` is persisted occurrence UUID; R14's delivery policy must not repurpose it for payment.

F12 registers `RemindersScreen` as a **nested Assistant route** (not sixth tab), supplying a REAL typed `ReminderTarget` from a Talk/lesson/artifact entry. Do not infer IDs from free text. One-off API schedule is available; Flutter editor currently offers daily/weekly in selected IANA zones, with explicit quiet hours and consent. No fake local reminder firing.

R12 account-deletion composer invokes `createScheduleDeletionRevoker(repository).cancelAllForAccount` within its deletion workflow; pending attempts are fenced, but an already-started remote push is an **uncertain** in-flight side effect. Never promise to retract a sent notification.

## Checks

Run `pnpm --filter @masanawa/operator-scheduling typecheck`; `pnpm exec vitest run packages/operator-scheduling/src/*.test.ts services/gateway/src/operator_scheduling/routes.test.ts`; `cd apps/mobile && flutter test test/operator_scheduling && flutter analyze`. Real PostgreSQL concurrency with 2 workers, worker crash before/after handoff, FCM delivery, account deletion, timezone and two-device qualification remain mandatory. This branch has not executed those checks.
