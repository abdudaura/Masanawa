# C18 private Masana call history — J04 continuation

This stack reuses J04's existing PostgreSQL `masana.call_sessions` (migration `packages/masana/migrations/0003_voice_calls.sql`) and its expiry/stop retry worker. C18 is READ ONLY; no new migrations, payment writes, agents, room dispatches, workers, provider credentials or admin access.

## Finite integration path (AF00)
1. Integrate J04 #643, then C18. Wire `registerMasanaCallHistoryRoutes` with existing authenticated J04 `resolveFan`, `createPostgresCallHistoryReader(existingPool)`, and an explicit **default-OFF** operational flag. Ensure route is registered once and checked with existing `/v1/calls/:id`.
2. Mount `MasanaCallHistoryScreen` in C18 navigation using account-scoped authenticated Dio, **distinct reader per account**, and existing `MasanaCallScreen` as the `onCall` callback. No human targets/phonebook.
3. J04 PostgreSQL index `masana_call_history` already covers tenant/fan and created_at descending. No schema rewrite or data loss. J04 expiry and durable stop retries continue unchanged; C18 only reads terminal/current state.

## Required tests on exact integrated SHA
- Call J04 under fan A, end, fetch C18 history: fan A sees name, status, duration; no LiveKit token, internal room name or session secrets returned.
- Fan B/other tenant: no fan A history; forged `fanUserId`, `tenantId`, malformed cursor, duplicate query and high limits denied. Session revocation 401.
- Pagination across tied timestamps deterministic; 21st record sets cursor, final page clears cursor. Provider down does not erase history or trigger new calls.
- Kill switch disabled → 410, authenticated; old historical records untouched. On Android offline, empty, error/retry and account switch discard stale in-flight history. Retry CTA invokes **existing** J04 call creation and voice permission policy.
- Source and tests: TS/Vitest, PG18 fresh+upgrade+restore, both Flutter analyzers/widget tests, low-end Android release APK+mic/provider qualified flow. Record PASS/FAIL/NOT_RUN accurately.

**No external provider activation or migration against a shared/prod database.** AF00 controls shared registrar, flags, rollback and Railway-linked main. Feature is source-only until integration and security/device qualification.
