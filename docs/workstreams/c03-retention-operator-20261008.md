# C03 operator-only retention runner — independent continuation claim

Updated UTC: 2026-10-08T11:36:03.964Z; owner/window GPT-6. Parent: **draft PR #483**, base commit 65c91bb239f9f8e9bf177a1f707f98c7fa391e78; main at first review 1d6a67ea3c182455b55a7d1d07eacdb4311682e3. This is a STACKED branch: work/c03-retention-operator-20261008-gpt6, targeting work/c03-reclaim-realtime-20261008-gpt6, not main until #483 is reviewed.

Scope/lease: newly introduced `services/gateway/src/human_dm_realtime/retention.ts`, `retention_cli.ts`, `retention.test.ts`, `retention_config.ts`, `retention_config.test.ts`, this workstream claim and documentation specific to the operator only. Five-minute visible-activity lease; no exclusive ownership of existing C03/SQL/app.ts/main.ts/mobile/realtime and no edits to #483. C03 M02/M06/M08/M10, N06/N08, Q06/Q08 and J03/J04/J10/J11, plus Q09/Q10 operations.

Collision: Original C03 #473 was reclaimed in newer-main #483 at 11:33 UTC; independent work from 11:29 on unmerged `work/c03-retention-recovery-20261008-gpt6` duplicated the same 0020/sync changes. **Do not merge, cherry-pick or open a competing PR from that earlier branch**. It is historical evidence only. This stacked contribution reuses #483's existing `talks.trim_human_dm_events` function and writes no duplicate migrations or reset code. Canonical C02 #472/#475/#477 and C05 #474/#476 decisions remain unresolved; #457 CI quota remains blocked. No source is currently verified.

Intent: provide deliberately opt-in, admin-only, tenant-scoped, age/batch/time-bounded operator execution of the already-reviewed database retention function; no HTTP route, no automatic cron, no client deletion authority. Tests and final Work handoff will be committed here. Scheduled production retention requires backup/restore rehearsal, database privileges and deploy/monitoring owner.


## Committed operator slice — current handoff

Updated UTC: 2026-10-08T11:42:20.948Z; **classification for this isolated bounded operator: IMPLEMENTED_UNVERIFIED**; **classification for complete C03: PARTIAL_IMPLEMENTATION**. No executed checks or deployed capability. This PR is not ready to merge.

- Stacked draft PR: https://github.com/Baatiku/masanawa/pull/486. **Base PR:** https://github.com/Baatiku/masanawa/pull/483 (also draft/unmerged). Base commit: `65c91bb239f9f8e9bf177a1f707f98c7fa391e78`; last substantive source/test HEAD before this handoff: `3a8809bab15e948d92d11b7da7cf38cc05a8af70`; branch `work/c03-retention-operator-20261008-gpt6`. Compare URL: https://github.com/Baatiku/masanawa/compare/work/c03-reclaim-realtime-20261008-gpt6...work/c03-retention-operator-20261008-gpt6. This handoff commit advances HEAD; **the precise latest pushed HEAD is in PR #486 / its next comment**, not a self-referential hash.
- Actual changed paths (six only): `services/gateway/src/human_dm_realtime/retention.ts` (bounded SQL operator+target preflight), `retention_cli.ts` (explicit env-gated standalone CLI), `retention.test.ts` (unit test source), `retention_config.ts` (pre-connection operator parameter parser), `retention_config.test.ts` (mode/DB/tenant/backup/limits and override negative tests), and this handoff. **No** Flutter/router, Gateway app/main composer, schema migration, provider, finance, R14 push, shared CI, environment or production edits on this branch. The parent #483 owns existing C03 SQL migration 0019+0020, sync API, Flutter client and its original tests. This stack does not claim those features are integrated.
- Already **implemented** within owned operator slice: one-shot manual entrypoint, exact current database/tenant verification, PostgreSQL invoker function privilege check, explicit tenant name confirmation, opt-in flag and backup *reference* attestation. The CLI parses and validates every confirmation BEFORE constructing any SQL pool (no partially confirmed connection). The bulk API validates positive bounded age 7–365 days, batch 1–1000 and maximum 1–100 batches; binds all values, obtains DB server clock, rejects malformed return counts, stops on error/limit and reports deleted/batches/possiblyMore, leaving scheduler decisions to operations. The DB function `talks.trim_human_dm_events` in parent #483 does atomic watermark/deletion under tenant lock. No HTTP endpoint exposes this function; no automatic job runs from an app/migrate process. These are **source properties, not executable results**.
- **Missing from complete C03 feature:** canonical C02 one-of-#472/#475/#477 selection, C01 #468 and C04 #478 migration composition, one-of-C05 #474/#476 protected indexed cursor/cache snapshot binding, shared Gateway app.ts/main.ts route composition alongside R18 #435, R14 #436 FCM/mute/deep link, R17/C08 final five-tab router, live session auth/tenant and real A/B/outsider read/restart/blocked access tests, deployment and retention job. No one should assert fully working human DM or active retention from this PR.
- Security & data: opt-in privilege-controlled **destructive** SQL against potentially private event metadata. The application connection string is not embedded; requires `MASANAWA_DATABASE_URL` and DB + tenant exact confirmation. `MASANAWA_C03_RETENTION_BACKUP_REF` is unverified human attestation, **not** proof that a restore succeeded. C03 operator must only run after backup and approved restore rehearsal; independently inspect GRANT/REVOKE including parent #483's `REVOKE ALL FROM PUBLIC`, direct function owner, role and public schema usage grants. Successful row counts do not establish C02 reconciliation. Actual transaction failure may roll back only one function call; earlier successfully committed batches are not undone on a later failure. Re-running is bounded/idempotent by DB deletion and per-member watermark, but verify in real PostgreSQL before use. Never execute against an unqualified production or copied financial DB.
- Dependency / migration sequence: choose canonical C01 `0016`, canonical C02 `0017`, C04 `0018` where compatible, #483 C03 `0019` and **one** `0020_human_dm_cursor_retention.sql`; this PR introduces NO 0020. Must review schema checksums/manifest and run in disposable PostgreSQL 18 with distinct test-tenant IDs, backing up before operator qualification. **Do not merge or cherry-pick** experimental branch `work/c03-retention-recovery-20261008-gpt6` (duplicate SQL/recovery) or original #473 alongside #483.
- Version, requirements: C03 M02/M06/M08/M10; N06/N08; Q06/Q08/Q09/Q10; J03/J04/J10/J11. No new product behavior, UI/voice or owner scope: this is the isolated operations execution seam. C03 as whole remains partial while genuine app integration is absent.

### Executed evidence vs deferred commands

**Actually executed:** connected GitHub branch creation, immutable comparison and source file read/write, and draft PR #486 creation. Post-PR commits extended coverage to pre-connection configuration parsing and its own negative tests. The compare showed exactly four isolated paths; PR #483's base/head read back. A container tool checked Node v22.16.0, globally installed `tsc` and `git` but **no pnpm, PostgreSQL CLI/instance, Flutter SDK**; one `git ls-remote` failed `Could not resolve host: github.com`. Therefore **NO TypeScript compile, Vitest, Postgres, Flutter, end-to-end, manual database-prune, CI or Android test has executed**. Do not call those checks PASS. Shared repository Actions blocker is issue #457 (quota exhaustion and failed zero-step jobs); don't waste more attempts.

**Exact future Work commands** (after reconciling approved C03 parent + C01/C02 schema in an isolated checkout, never using production for initial tests):

```sh
git fetch origin
git checkout work/c03-retention-operator-20261008-gpt6
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/human_dm_realtime/retention.test.ts services/gateway/src/human_dm_realtime/retention_config.test.ts
pnpm exec vitest run services/gateway/src/human_dm_realtime/realtime.test.ts
# apply canonical 0016/0017/0018/0019/0020 to disposable loopback *_test PG18 DB first
MASANAWA_C03_ENABLE_DB_TESTS=yes MASANAWA_C03_TEST_DATABASE_URL='postgresql://tester:LOCAL_ONLY@127.0.0.1:5432/masanawa_c03_test' pnpm exec vitest run services/gateway/src/human_dm_realtime/postgres_integration.test.ts
pnpm --filter @masanawa/gateway-service build
# Run only in isolated PG18 test instance WITH verified backup reference, correct grants/role.
# The following is an example sequence, not an executed operation:
MASANAWA_C03_RETENTION_OPERATOR_CONFIRM=I_UNDERSTAND_PRUNING \
MASANAWA_C03_RETENTION_TENANT='c03_disposable_test_tenant' \
MASANAWA_C03_RETENTION_CONFIRM_TENANT='c03_disposable_test_tenant' \
MASANAWA_C03_RETENTION_EXPECT_DATABASE='masanawa_c03_test' \
MASANAWA_C03_RETENTION_BACKUP_REF='verified-rehearsal-id' \
MASANAWA_DATABASE_URL='postgresql://tester:LOCAL_ONLY@127.0.0.1:5432/masanawa_c03_test' \
node --conditions=production services/gateway/dist/human_dm_realtime/retention_cli.js
```

Before running the opt-in CLI: independently verify backup/export and restore (redacted evidence), caller permission/schema migrations, cutoff and count dry-run `SELECT count(*) FROM talks.human_dm_events WHERE tenant_id=$1 AND created_at<clock_timestamp()-interval '30 days'`, a test tenant's baseline/protected C02 inbox; record returned count and changed DB rows by actual SQL. After trim, test the old reader cursor triggers `resetRequired`, re-read entire authenticated C02 history, acknowledge the correct checkpoint, then send fresh message and confirm recipient catches up exactly once. Negative: wrong tenant/database/role, malformed count, invalid window, partial failures and retry, read/revoke while pruning, weak network/multi-device. Run full TS/Flutter/Android/device suites and inspect app Gateway authorization after #483 integration; required package/toolchain is Node 24/pnpm 12 per root `package.json`, not this container's Node 22.

### Next steps for designated single Work integrator

1. Keep #486 stacked and DRAFT. Review C03 #483 as one canonical candidate vs historical #473; never merge both. Decide C02/C05 duplicates and validate cross-branch schema. If parent is superseded, recreate this isolated operator patch on the chosen C03 branch only after diff review; never apply a conflicting `0020`.
2. Fix any TypeScript/SQL/test compile failures revealed by actual executable tooling; first qualification is isolated repository tests at exact pulled SHAs. Inspect **parent's** 0020 PostgreSQL parse/privilege correctness (an `INSERT ... SELECT ... FROM highs ON CONFLICT` may require `WHERE true` for parser ambiguity); test grants and revoke.
3. Apply migrations and operator to a disposable, loopback/test database only. Rehearse recovery/restore and verify concurrency/idempotent trim + journal high-water in a real PostgreSQL 18 instance. Approval to schedule retention requires separate policy, monitoring, alerting, backup owner and rollback proof.
4. Only after parent #483 is integrated with canonical C01/C02/C04/C05/R14/R17, run full Flutter↔Gateway↔PostgreSQL→readback and A/B/outsider tests including forced resnapshot and app restart. Record actual commands, exit codes, logs, device/provider evidence and exact SHAs in one final Work consolidation matrix.
5. Keep PR **DRAFT/UNMERGED** and retain status `PARTIAL_IMPLEMENTATION` for full C03 until required production integrations exist. Even if isolated operator tests pass, do not mark entire C03 DONE.

### Release gate snapshot

| Gate | Exact state |
|---|---|
| SOURCE_WRITTEN (isolated retention operator + tests) | YES (code committed to stacked branch, **unverified**) |
| SOURCE_WRITTEN (complete C03) | NO, integration dependencies outstanding |
| LOCAL_TESTED | NO |
| CI_EXECUTED | NO (#457) |
| DB_INTEGRATED | NO |
| APP_INTEGRATED / Flutter / actual voice/taps | NO, parent/other owners |
| DEVICE_VERIFIED | NO |
| PROVIDER_QUALIFIED | NO |
| DEPLOYED | NO |
| MERGED | NO |

**Mandatory merge stop:** verification blockers do NOT excuse missing implementable code, nor do they authorize deleting or exposing private content. The parent C03 and this stacked operator are not DONE.


### Additive post-PR source checkpoint — 2026-10-08T11:45:09.099Z

- `services/gateway/src/human_dm_realtime/retention_config.ts`: fail-closed, side-effect-free env parsing (confirmation, same-tenant replay, exact expected DB, backup reference, connection secret present, integer bounds and safe defaults). Must reject invalid configuration **before pool creation**. The backup reference is checked syntactically only; it is not accepted as restore proof.
- `services/gateway/src/human_dm_realtime/retention_config.test.ts`: deterministic code-level tests authored for missing and malformed required names, wrong confirmations and tenant, wrong numeric limits/overrides and secret omission from the config object. **Tests not executed** in this environment.
- `retention_cli.ts`: now calls the parser before `createPostgresPool`, then does read-only real DB/role/tenant preflight, then destructive function only on explicit operator invocation. No new cron/trigger/web/API path.
- Latest substantive source/test commit immediately before this handoff: `2a1fb2aed8c12285c1b219066b8d59c0b8ed1b18`. The final handoff HEAD is its subsequent commit and is linked in PR #486.
- Exact focused run commands: `pnpm exec vitest run services/gateway/src/human_dm_realtime/retention.test.ts services/gateway/src/human_dm_realtime/retention_config.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`. **Not run.**
