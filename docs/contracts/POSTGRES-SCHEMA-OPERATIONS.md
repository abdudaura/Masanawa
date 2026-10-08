# R16 — Portable, safe database schema operations contract

**Status:** source implementation in draft. Do not treat this as production migration/backup, restored-data certification, or feature release evidence.

## Purpose and authority
A *privileged, operator-only* PostgreSQL 18 CLI. It reads existing package-owned `platformProductMigrationRoots()` and the real `public.masanawa_schema_migrations` ledger; it never seeds demo accounts, edits production data outside the approved migration SQL, deploys apps, grants public API access, or moves object storage. Flutter has **no operator database screen**. Current service startup `services/gateway/src/migrate.ts` and existing `alpha:prepare` have **not** been changed; release operations owner must choose a safe integration only after tests. This tool does not claim that a backup exists.

## Run from an installed & built repository

```bash
pnpm install --frozen-lockfile
pnpm --filter '@masanawa/postgres...' build
# credentials supplied securely in the environment; never include DB URL in arguments or logs
MASANAWA_DATABASE_URL="<secure-connection-string>" node --conditions=production adapters/storage/postgres/dist/schema-admin-cli.js manifest
MASANAWA_DATABASE_URL="<secure-connection-string>" node --conditions=production adapters/storage/postgres/dist/schema-admin-cli.js status
MASANAWA_DATABASE_URL="<secure-connection-string>" node --conditions=production adapters/storage/postgres/dist/schema-admin-cli.js readiness
```

`manifest` does not connect to a database and emits the deterministic SHA-256 manifest digest and each migration file's checksum. `status` uses an **explicit read-only snapshot transaction** and reports only DB/role metadata, applied count, pending IDs, SHA drift, unknown migrations, global ordering violations, compatible PG version and readiness. It does **not** write a ledger to an empty DB. `readiness` returns exit 2 when schema is incomplete/incompatible; 0 only for exact match. Unknown migrations, modified applied SHA, missing predecessors, PostgreSQL not version 18 all block apply. Redacted errors have exit 3.

## Guarded apply — NOT a backup or permission grant
Before `apply` the human operator must independently verify a genuine, tested, externally held restorable backup per `docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md`, verify the target account/database, secure least-privilege DB credentials, approve downtime/rollback and pin a reviewed deployment and source manifest SHA. Use the exact values below via protected operator environment (example placeholders are NOT real evidence):

```bash
export MASANAWA_DB_EXPECTED_NAME="<verified-db-name>"
export MASANAWA_DB_EXPECTED_MANIFEST_SHA256="<64-char-manifest-digest>"
export MASANAWA_DB_DEPLOYMENT_SHA="<40-char-reviewed-git-commit>"
export MASANAWA_DB_BACKUP_EVIDENCE_ID="<operator-verified-backup-reference>"
export MASANAWA_DB_BACKUP_VERIFIED_AT="<recent-UTC-ISO8601>"
export MASANAWA_DB_APPLY_APPROVAL="I_APPROVE_SCHEMA_ONLY_MIGRATION"
node --conditions=production adapters/storage/postgres/dist/schema-admin-cli.js apply
```

`MASANAWA_DATABASE_URL` remains securely set. Backup ID and timestamp are **attestations supplied by an accountable operator**, not technical proof the referenced backup can restore. The tool rejects missing/stale (>24h)/future dated attestation, target mismatch, source SHA mismatch and missing explicit approval. The full apply runs under one SERIALIZABLE transaction plus the **existing** migration advisory lock, checks current DB/ledger before writes, applies only missing forward SQL and records corresponding immutable SHA-256; then re-reads exact schema readiness before committing. No destructive baseline, blind checksum overwrite, automatic repair or force mode. PostgreSQL transaction failure rolls back the entire attempt.

## Disposable fresh-database acceptance, NOT production
Provision **a truly new isolated database** on an ephemeral PG18 instance (no money/webhooks/providers/workers configured) with name `masanawa_test_...`. Do not point at Railway production, a clone running jobs or an existing user database.

```bash
export MASANAWA_DB_EXPECTED_NAME="masanawa_test_<unique-id>"
export MASANAWA_DB_TEST_DISPOSABLE_ACK="I_CONFIRM_EMPTY_DISPOSABLE_TEST_DATABASE"
node --conditions=production adapters/storage/postgres/dist/schema-admin-cli.js bootstrap:test
```

`bootstrap:test` requires the actual DB name to match its target and prefix; refuses existing migration ledger or domain schemas; runs a DDL savepoint rollback probe; applies all canonical migrations; rechecks exact manifest and a second no-op. It does **not** create/drop the database, truncate tables, import production data or claim off-account restore. Credentials must be restricted to this sandbox. Run separate **real backup→restore→checksums/producers fenced** rehearsal under the documented Work recovery runbook.

## Required test evidence before promoting the draft
- `pnpm --filter @masanawa/postgres typecheck` and `pnpm --filter @masanawa/postgres build`.
- `pnpm exec vitest run adapters/storage/postgres/src/schema_admin/*.test.ts` plus the gated real PG18 acceptance suite using `MASANAWA_TEST_DATABASE_URL` on disposable database.
- Verify never touching prod, read-only status on empty DB, manifest mismatch, unknown hash/extra row, missing ordering predecessor, disallowed PG version, wrong DB name, missing backup proof, stale proof, duplicate invocation, statement failure rollback and release-sha rollback/redeploy plan.
- Actual S3/media/vault restore, ingress secrets, provider requalification and deployed Gateway SHA remain **separate mandatory gates**. Issue #457 CI quotas are still a blocker until actual jobs execute. Never label this database migration interface a completed **platform restore**.

**Trace:** R16, Q08/Q09/Q10; J10/J11. Read source and Work handoff under `docs/workstreams/r16-schema-ops-20261008.md`.
