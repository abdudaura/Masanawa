# R16 — disposable PostgreSQL bootstrap freshness (stacked continuation)

Window/owner: GPT-6, independent R16 reclaim, 2026-10-08 UTC.
Status: CLAIMED — implementation in progress, not tested/merged/deployed.
Branch: `work/r16-disposable-bootstrap-freshness-20261008-gpt6`.
Latest reviewed main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Inherited PR #479: `work/r16-schema-portability-20261008` head `65c53ecd9060af701d30ffbe8914a6e6567863e4`; original base main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`. #479 last visible update 2026-10-08T11:15:49Z (over five-minute stale-claim boundary at takeover). Preserve its complete source; **stack changes on it** rather than replicate files in a second migration implementation. PR will target parent branch, not main; integrator must merge parent first or reconcile cherry-pick against fresh main.
Requirements: R16, Q08/Q09/Q10, J10/J11; database portability/disposable-restore qualification.
Exact owned paths for this continuation: `adapters/storage/postgres/src/schema_admin/operations.ts`, `adapters/storage/postgres/src/schema_admin/operations.test.ts`, `adapters/storage/postgres/src/schema_admin/operations.integration.test.ts`, `docs/workstreams/r16-disposable-bootstrap-freshness-20261008.md`. Original #479 owner has been inactive; recheck before each edit. All other Gateway, package registries, financial ledgers, migrations, mobile and Actions paths excluded.
Target feature: fail closed on *any* pre-existing non-system schema and on public user-created callable/type objects in a named disposable database, even if the known Masanawa schemas/tables are absent. Continue with real PG18 negative-then-positive coverage, no seed/data drop, durable handoff, draft PR. No Flutter consumer UI/auth route applies to privileged local operator CLI; DB access uses operator-only env credentials.
Shared dependencies: upstream draft PR #479; actual PG18 sandbox; CI issue #457 Work owner. No live DB access/credentials, no workflow retry loop.
Status and exact executed/unexecuted checks will be appended after source changes. Five-minute lease applies, and this document's first push is repository-visible claim.

## Implementation checkpoint — 2026-10-08 UTC

Status: **IMPLEMENTED_UNVERIFIED for this bounded R16 disposable-database freshness guard only**. The upstream schema-operator draft #479, complete portable restore, global R16, live migration/deployment and all Android/finance/DM release gates remain **OPEN/UNVERIFIED**. This is not a production database migration or verified restoration.

### Source and integration
- **DB/migration behavior:** Changes only `schemaBootstrapTest` before the first DDL in the existing PostgreSQL 18 schema-operator, inheriting the parent transaction/advisory lock, manifest digest, operator-only disposable acknowledgement and database-name restriction. Rejects **any unexpected non-system schema**, plus public standalone user functions/procedures and non-extension enum/domain/range/base types. Automatic array types are not counted as user objects, and extension-owned routines/types are excluded. Additional named user schema/data are preserved, never dropped or silently ignored. Explicit fail-closed error codes are `schema.bootstrap_other_schemas_present`, `schema.bootstrap_public_routines_present`, `schema.bootstrap_public_types_present`.
- **API/auth:** Existing privileged CLI only; no public web endpoint, customer session, live DB credentials or production API change. Operator-provided env and DB-level credentials remain existing authorization boundary. No schema or migration edits, no data seed, no destructive repair.
- **Tests written:** `adapters/storage/postgres/src/schema_admin/operations.test.ts` asserts each refusal and a rollback before DDL. `operations.integration.test.ts` creates and confirms preservation of each forbidden object on an isolated PostgreSQL 18 `masanawa_test_*` DB, cleans only its own test objects, and then runs the inherited successful bootstrap/idempotence/rollback tests. Upstream tests remain present and untouched except bounded additions.
- **Flutter:** N/A for the privileged schema/database administrator operation; exposing this capability through consumer app would violate least privilege. No mock or disconnected consumer screen was added.
- **Files changed:** `adapters/storage/postgres/src/schema_admin/operations.ts`, `adapters/storage/postgres/src/schema_admin/operations.test.ts`, `adapters/storage/postgres/src/schema_admin/operations.integration.test.ts`, this handoff.
- **Last code commit:** `13143480e67a2807595c53b08a4139716d3aa86b`. Parent feature source preserved from `65c53ecd9060af701d30ffbe8914a6e6567863e4`. Read the review PR head for handoff-document commit SHA.

### Evidence/verification (do not promote to DONE)
- **Executed:** GitHub connector confirmed the upstream PR head, stale lease, new branch creation, and successful source commits. No TypeScript, Vitest, SQL or Android executable test has been run. No CI retry attempted because issue #457 records exhausted/zero-step GitHub Actions.
- **Not executed:** `pnpm install --frozen-lockfile`, `pnpm --filter @masanawa/postgres typecheck`, `pnpm --filter '@masanawa/postgres...' build`, `pnpm exec vitest run adapters/storage/postgres/src/schema_admin/operations.test.ts adapters/storage/postgres/src/schema_admin/manifest.test.ts adapters/storage/postgres/src/schema-admin-cli.test.ts`; blocker: only GitHub connector source editing was available, not authenticated repository checkout/pnpm deps. `MASANAWA_TEST_DATABASE_URL=<private-disposable-PG18-url> pnpm exec vitest run adapters/storage/postgres/src/schema_admin/operations.integration.test.ts`: no genuinely isolated PG18 sandbox credentials/environment. Flutter analyze/widget/APK, voice, provider and real customer E2E are N/A for this operator feature, still required by other R/C owners for platform release.
- **Known risk to verify:** PG18 extension-owned and autogenerated array-type behavior (pgvector/pgcrypto), custom-schema provenance, failed-transaction cleanup, fixture ordering; exact operator-role least privilege, concurrent access and serializable isolation on real PG18. The current heuristic is deliberately conservative; unexpected user objects prevent bootstrap without data loss. A populated test DB must never be used to run the happy-path migration.
- **Missing owned implementable source:** None known for this narrowly scoped guard and its test harness; does **not** assert completeness of the parent schema operator, off-account backup/restore, runtime service migrations or R16 release.
- **Shared dependency:** Parent draft #479 contains the operator manifest, CLI, transaction logic and canonical contract. Integrator must use parent first and then this stacked patch or semantically combine them on latest `main`. Do not merge this child independently against main. No overlap with C01–C08, finance, Gateway or #455 Android changes.

### Exact final Work integration actions
1. In ChatGPT Work, check latest `main` and both draft PRs; compare their real changed paths and recheck all fresh ownership leases. Reconcile source into one canonical R16 implementation without copying duplicate files or missing the security additions. Preserve `#479` changes and this child branch's three source/test changes.
2. With Node 24/pnpm 12 and a checkout with dependencies, run `pnpm install --frozen-lockfile`, `pnpm --filter @masanawa/postgres typecheck`, `pnpm --filter '@masanawa/postgres...' build`, and focused/all unit Vitest suites. Fix any errors at exact tested SHA; do not mark tests passed because source parses visually.
3. Provision a **new** isolated PG18 `masanawa_test_<random>` database with expected extension privileges, absolutely no user data/providers/worker/ingress. Run focused `operations.integration.test.ts`; verify all three fresh guards leave objects untouched and the subsequent full bootstrap + no-op/readiness succeeds. Attempt wrong DB/attestation/checksum and concurrent writers from parent acceptance plan.
4. Independently verify a real off-account encrypted production data + media backup and **restore in a different account** per `docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md`. This feature does not generate backups or prove restorable data. Restore is a separate shared release gate.
5. Fix #457 in authorized Work environment; run complete schema/Gateway/Flutter/Android acceptance on final integration SHA, review production rollout/rollback and operator credentials. Merge only genuinely verified changes. Do not auto-merge this branch or claim R16 DONE from operator tests alone.

### Release flags
| Gate | Status |
| --- | --- |
| SOURCE_WRITTEN (this bounded guard) | YES |
| UNIT_TESTS_WRITTEN / PG_INTEGRATION_TESTS_WRITTEN | YES / YES |
| LOCAL_TESTED / CI_EXECUTED / DB_INTEGRATED | NO / NO / NO |
| OFF_ACCOUNT_RESTORE_VERIFIED / DEVICE_VERIFIED / PROVIDER_QUALIFIED | NO / N/A for CLI / N/A for CLI |
| DEPLOYED / MERGED / GLOBAL_R16_DONE | NO / NO / NO |

**Rollback/risk:** No migration changed or ran, so reverting this guard's new code is source-only; use conservative runtime refusals rather than force/skip flags when unexpected objects exist. Do not point `bootstrap:test` at a database merely named like a disposable DB that has any meaningful data.

## Final repository-visible review identity
- Draft stacked PR: https://github.com/Baatiku/masanawa/pull/485 (base `work/r16-schema-portability-20261008`; parent draft https://github.com/Baatiku/masanawa/pull/479).
- Commit containing initial Work handoff: `24927599f0d5900f3ed92770353e6babfa3daf50`; last application/test-source code commit `13143480e67a2807595c53b08a4139716d3aa86b`.
- GitHub verified four changed paths in PR #485 (three implementation/test files and this handoff), all within the ownership claim. PR remains draft. No merge, test, device, provider or deployment evidence.

## Additional security checkpoint — 2026-10-08

After the initial review, expanded the fail-closed bootstrap preflight to detect:
- **Public composite types**, which PostgreSQL represents as `pg_class.relkind='c'` and otherwise escape a simple standalone `pg_type.typrelid=0` check.
- **PostgreSQL binary large objects**, whose content resides in `pg_largeobject` system catalogs and is not revealed by scans for user tables or custom schemas.

The same transaction now rejects those before executing any rehearsal DDL with `schema.bootstrap_public_not_empty` or `schema.bootstrap_large_objects_present`. Regression assertions in both fake-Pool Vitest and real-PG18 integration tests create, verify retention and safely remove only test-owned composite objects/large objects.

Final application-and-test-source checkpoint SHA: `fef0791256ccf8ec25c3c2235ab94f1397f38a9d`. Draft PR #485 remains based on parent #479. This extra checkpoint **does not add any executed tests**; all unit, TypeScript, sandbox Postgres, CI, actual backup→restore, device and deployment evidence are still pending as recorded above. No real database was accessed or altered.

## Reclaimed lease — 2026-10-08 ~12:35 UTC

Current owner/window: GPT-6 PostgreSQL disposable preflight hardening. Reclaimed existing stacked draft PR #485 after last activity `2026-10-08T11:40:15Z` (> five-minute lease), preserving all existing code, tests and handoff. `main` reviewed at `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; parent #479 still distinct. Exclusive paths: `adapters/storage/postgres/src/schema_admin/operations.ts`, `operations.test.ts`, `operations.integration.test.ts`, this handoff. No migration, shared Gateway, Flutter router or finance edits. Planned bounded end-to-end CLI safety feature: refuse additional pre-existing advanced user database objects (collations, text-search config, publications etc.) before applying any DDL; add unit + real isolated PG18 negative and preservation tests. No test/DB execution presumed. Branch work stays draft/unmerged.

## 2026-10-08 advanced-definition preflight continuation — final source checkpoint

**Lease/source:** Reclaimed this existing draft PR #485 only after its >5-minute stale window. Last original head `5d0e548cd0e9a38689e44d58e4c6d7190fa00cc6`, claim commit `720c57967cafef692c793de0f2ac451b7b0de165`. Base/main read `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Parent #479 must still be integrated first. Existing four owned paths preserved; no overlapping Flutter/Gateway schema migrations, R17/C08 root, provider or financial ledger edits.

**Implemented:** Before savepoint and first DDL, `schemaBootstrapTest` rejects existing non-extension-owned objects from PostgreSQL's `public` collations, conversions, operators, text-search configurations/dictionaries/parsers/templates; also detects independent event triggers, publications, foreign servers/wrappers. The result is fail-closed `schema.bootstrap_public_definitions_present`, with no object names, secrets or connection URLs returned to the operator. Static PostgreSQL system-catalog references only, `pg_depend` extension-membership exemptions, still inside the existing serializable transaction/advisory lock and explicit disposable-name/ack gate. No user data is read or mutated by these refusals and no SQL migration was rewritten.

**Source checkpoints:**
- `adapters/storage/postgres/src/schema_admin/operations.ts`: `7b849bebe827194870a58676ed655e6e00cea0f7`
- `adapters/storage/postgres/src/schema_admin/operations.test.ts`: `de0dcf8ceb0612b94b57bc45c372f5e869c62746`
- `adapters/storage/postgres/src/schema_admin/operations.integration.test.ts`: `f362e5b554e082a3d77e736bcd13a26174d72a76`

**Tests authored:** fake-Pool unit asserts rejection before `CREATE TABLE` or `SAVEPOINT` and transaction rollback for an unrelated catalog definition. Disposable PostgreSQL 18 integration checks independently `CREATE COLLATION` and `CREATE TEXT SEARCH CONFIGURATION`, verifies bootstrap rejection, verifies the original named object persists, drops *only the test-created object*, and then executes inherited clean-bootstrap/idempotent/readiness tests. Existing test covers nonpublic schemas, routines, types, composite objects and large objects; these remain intact.

**Executable verification:** NONE. Only authenticated GitHub connector source/readback commits were executed; no shell checkout or PostgreSQL 18 sandbox from this editing session, and GitHub Actions #457 records zero-step quota/budget failures. Do not assert successful TypeScript, Vitest, SQL, auth, device or CI tests. Exact deferred checks: `pnpm install --frozen-lockfile`; `pnpm --filter @masanawa/postgres typecheck`; `pnpm --filter '@masanawa/postgres...' build`; `pnpm exec vitest run adapters/storage/postgres/src/schema_admin/operations.test.ts adapters/storage/postgres/src/schema_admin/manifest.test.ts adapters/storage/postgres/src/schema-admin-cli.test.ts`; `MASANAWA_TEST_DATABASE_URL=<fresh isolated PG18 masanawa_test_... URL> pnpm exec vitest run adapters/storage/postgres/src/schema_admin/operations.integration.test.ts`. Do not point this at production or a populated DB; no real provider or consumer Flutter UI is applicable to this privileged CLI.

**Risks/validation:** Verify PG18 catalogs and installed pgvector/other extension memberships really bypass only extension-owned objects; exercise publication/event-trigger/foreign-server catalog guards in an appropriate privileged test DB; check operator role catalog visibility and missing permission behavior fail closed; check pristine PG18 manifest applies and repeated apply is no-op, plus interrupted migration rollback. No claim that this covers *all* possible PostgreSQL preexisting state (e.g., database-level configuration or privileges). Off-account encrypted backup/media recovery, production tenant/auth ledger integration, real /readyz and full R16 Android release all remain separate UNVERIFIED gates under shared Work coordination. No production migrations, restore, secrets, deployed service or data were changed.

**Final ChatGPT Work actions:** Inspect draft #479 and stacked #485 (this last SHA and main), reconcile without merging twice; run the exact Node + PG18 tests above and fix any catalog false-positive or runtime/typecheck errors; perform secured off-account restore according to `docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md`, qualify database/app readiness, then run independent full R/C integration and Android checks after #457. Maintain reviewable DRAFT and do not merge on static source.

**Release gates (bounded feature):** SOURCE_WRITTEN=yes; TESTS_WRITTEN=yes; LOCAL_TESTED=no; CI_EXECUTED=no; DB_INTEGRATED=unverified; APP_INTEGRATED=operator CLI source-only/unverified; DEVICE_VERIFIED=N/A for operator CLI; PROVIDER_QUALIFIED=N/A; OFF_ACCOUNT_RESTORE_VERIFIED=no; DEPLOYED=no; MERGED=no. Overall R16 remains OPEN / UNVERIFIED. Roll back by reverting these source/test commits; never force a destructive DB cleanup to bypass refusal.
