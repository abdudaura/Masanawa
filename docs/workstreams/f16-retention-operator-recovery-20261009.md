# F16 recovery — make C03 retention operator require one-use, bounded tenant preflight

**2026-10-09 · F16 C03 operator recovery; existing [draft PR #486](https://github.com/Baatiku/masanawa/pull/486) continued (not a new messaging implementation).**

## Ownership and scope

- Window/owner: GPT-6 F16 isolated retention recovery.
- Original claim pushed at `cf8216e8cc24bef715ca7f55c52a81e7f2ee4b4f`, 2026-10-09T01:48:44Z UTC; subsequent code/test commits constitute heartbeats. The original exact-path claim predates all modifications and is preserved in commit history.
- Current `main` baseline: `5e758673ae91082520b21b3153da53791ae2cbf3`. Existing PR base: `work/c03-reclaim-realtime-20261008-gpt6` at `65c91bb239f9f8e9bf177a1f707f98c7fa391e78` (draft #483); pre-recovery PR #486 head: `f3d606e2ae042a69b7a87c673d6314cae714c3be`.
- Recovered HEAD **before this handoff commit**: `e30cab0fdc5219acfdf156fc35e948efe498a861`.
- Owned source: `services/gateway/src/human_dm_realtime/retention.ts`, `retention.test.ts`, related `retention_config.ts` and `retention_config.test.ts`, `retention_cli.ts`, and **this handoff only**. Only the first two source/test files and this handoff changed. Existing configuration/CLI behavior is preserved.
- Explicitly **not owned or touched**: `services/gateway/src/app.ts`, `main.ts`, `packages/talks/migrations/**`, realtime repository/router/sync code, human DM/Contacts, Flutter global router, native Firebase, finances, `.github/workflows` and live DB/production deployments.

## Implemented source, functional invariant and negative cases

The existing operator CLI called a database/tenant/privilege preflight, but exported `pruneHumanDmJournal` could be called directly or twice by any future operator job without completing a matching check. The recovery now:

1. On preflight, revokes any prior authorization **before** validating even a malformed target, then checks actual `current_database()`, selected tenant existence, invoker EXECUTE permission, one-row SQL result metadata, and a valid current clock.
2. Stores a private `WeakMap` authorization **bound to the precise pool object and tenant**, valid at most five minutes. It is transient; no approvals persist between processes.
3. Before any destructive SQL, checks the run's trusted parameters and consumes the authorization synchronously. Replays, mismatched tenants, missing/failed/expired preflight, invalid clock or concurrent second uses fail closed without a mutation query.
4. Preserves SQL parameter binding, the existing independent PostgreSQL minimum-age checks, total batch bounds, database-clock cutoff, per-batch result validation, exception propagation and CLI's fail-before-pool environment parser. This change introduces **no new HTTP capability, SQL function, migration, scheduler or automatic pruning**.
5. Adds repository Vitest regression cases for no-preflight, wrong tenant, one-use replay, recheck failure, invalid recheck input, expired approval and inconsistent preflight row counts. Original bounded-batch/error/tenant binding tests now explicitly preflight their test pools.

**Security limitation:** This in-process guard prevents accidental unsafe call paths; it does not authenticate operators or enforce row isolation independently of PostgreSQL role grants, selected tenant-scoped credentials, migration #483 or independently restored backups. PostgreSQL and operational verification remain mandatory. A multi-connection pool or failover between preflight and mutation requires real database review.

## Test evidence and execution limits

| Gate | Result | Exact evidence / remaining command |
| --- | --- | --- |
| GitHub source integrity | **PASS** | Copied exact `retention.ts` blob into an isolated local folder; `git hash-object` matched repository blob `2859932d77411db11d9ea0252c766f48c1b2a5c9` |
| Strict standalone TypeScript compile | **PASS, isolated** | `tsc --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext retention.ts`, TypeScript 5.8.3, Node 22.16.0, exit 0 |
| Isolated runtime smoke | **PASS_SIMULATED 12/12** | Compiled exact source blob, executed Node assertions on valid preflight, denied DB/tenant/role/privilege, first and repeated runs, mismatched tenant, failed or malformed recheck, 5-minute expiry, parameterized SQL, invalid returns, bounded batches, SQL failure, invalid bounds. Uses in-memory fake SQL pool; **not a real database/Vitest pass** |
| Repository Vitest source | **NOT_RUN** | `pnpm exec vitest run services/gateway/src/human_dm_realtime/retention.test.ts services/gateway/src/human_dm_realtime/retention_config.test.ts` (no pnpm/root checkout or node_modules here) |
| Gateway typecheck | **NOT_RUN** | `pnpm --filter @masanawa/gateway-service typecheck` (project dependencies unavailable). Isolated `retention.ts` compile does **not** typecheck imports or entire Gateway |
| PostgreSQL 18 migration/preflight/retention/restart | **NOT_RUN** | Disposable PG18 with C01/C02/#483 migrations required, including role/revoke tests, retention-concurrent-insert/high-water cursor reset/restore drill |
| Flutter/Auth/DM/device/provider/CI | **NOT_RUN / integration BLOCKED** | No Flutter SDK, Android device, complete checked-out app, actual C01/C02/C03/C05 composition or live CI evidence. #457 Actions capacity incident must be independently checked, not called a pass |

These results apply **only to the exact retention source blob and listed isolated harness**, not to all unmerged parent changes or the complete repository. The independent Node smoke harness ran locally and was not committed; the repeatable checked-in tests are the Vitest cases above and require the repo test runner.

## Dependencies, collisions and integration handoff

- Keep PR **#486 DRAFT** and **stacked onto #483**. Review canonical #483 vs #473 (do not introduce a second `0019`/`0020` migration). The parent `0020` includes a PostgreSQL `INSERT ... SELECT ... ON CONFLICT` parser/review risk that needs real migration execution; this window intentionally did not claim migration ownership.
- First resolve canonical C02 #472 vs #475, C05 #474 vs #476 and C01 #468. Coordinate C04 #478, R14/FCM, F12 five-tab shell and F18 Assistant without introducing an AI substitute for human messaging.
- Integrator should run repository Vitest/typecheck, then use a disposable PostgreSQL 18 clone with migrations and least-privilege role; validate a preflighted one-shot trim, same-tenant-only journal checkpoints, cross-tenant denial, active message insertion race, old-cursor reset → C02 full snapshot → new message readback, and crash/restart. Prove backup off-account restoration before any retention authorization.
- Run A/B/C real-account Flutter↔Gateway↔DB readback, offline/outbox sync and low-memory restart on representative Android devices after branch composition. Collect CI logs on an exact integrated SHA. No rollout, scheduled deletion, secret change or merge in this window.

## Completion and release classification

- **F16 as a whole: PARTIAL_IMPLEMENTATION** — C03/C05 source branches remain divergent/uncomposed and critical integration/source ownership is outside this claim.
- **C03 isolated retention operator guard:** SOURCE_WRITTEN=yes and ISOLATED_COMPILE/SMOKE_PASS_SIMULATED=yes; **repository Vitest, real DB auth/backup/rollback, CI, Flutter, Android, full E2E and deployment remain unverified**.
- DB_INTEGRATED=no; APP_INTEGRATED=no; PROVIDER_QUALIFIED=no; DEVICE_VERIFIED=no; MERGED=no; DEPLOYED=no.
- No production systems touched. Preserve both existing PR and this SHA-specific handoff for final Work reconciliation.

## Claim release and final snapshot

- Work branch was updated with code/tests and this handoff; isolated exact-path F16 ownership is **RELEASED** after the SHA-specific checkpoint `b03b252507cc59a94258aeab3e626e19831831d7`. No exclusive C03/F16 claim persists from this window. Future integrators must still recheck live paths and PR heads before working.
- The final handoff commit is the commit that adds this release line; use the updated PR body for its immutable SHA. All unverified merge/deployment gates remain STOP.
