# J07 — Room staff → lone fan → teacher answer → notification

The source path is assembled across:
- `services/gateway/src/modules/rooms/routes.ts` (staff/fan authorization)
- `adapters/storage/postgres/src/rooms/repository.ts` (transactional membership, idempotent ask, staff approval and audit)
- `services/worker/src/jobs/rooms` (outbox lease/recovery and answer notifications)
- Flutter consumer and Android Admin `src/features/rooms`

**Execution gate (not yet passed):** Run a disposable PostgreSQL 18 fresh and upgrade migration, create approved fictional Masana + staff and one fan, publish a free Room, join, ask exactly once with retry/restart and confirm only one queued event. Run teacher once with unavailable model (must stay in staff review queue), approve a response, run canonical notification dispatcher, and assert the lone fan sees the answer and precisely one notification on replays. Check 401/403/409/410/429 and tenant isolation. Repeat using built consumer and Admin APKs. These are not mocked successes.

**AF00-owned required wiring:** migration root, workspace lock importers, authorized gateway/bootstrap dependency injection, outbox dispatch, real notification sender and two Flutter router/transport bindings. Never mark J07 PASS before the real pinned SHA run. Paid J08 is out of scope and must stay 403.
