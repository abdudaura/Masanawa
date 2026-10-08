# Masanawa — Database Redeployment, Backup and Verified Restore Runbook

> **2026-10-08: REVIEWED PROCEDURE ONLY, NOT EXECUTED.** No account, service, production database, volume, provider webhook, domain or credential was changed by this audit. The following is a safe **operator/ChatGPT Work acceptance sequence** and deliberately stops short of issuing a production cutover. Read `BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md` and `DATA-ARCHITECTURE.md` first. Operations must comply with the user's budget, privacy policies, authority and the provider's actual backup capabilities.

## A. Ownership and non-destructive rules

- **One coordinator:** shared CI/operations verification owner #457 (Work), with database schema/migration owner and finance R05–R08/C06 owner signing off each consequential step. Individual feature windows do not independently execute production migrations, rename/delete Railway services, or reset provider accounts.
- **Read-only discovery first.** The current Railway Postgres appears under `@nurain/contracts` with persistent `masanawa-postgres` volume (500 MB provisioned); name does not imply safe deletion. Do not delete, recreate, truncate, rename or modify it for an audit.
- **No production source dumps in GitHub/ChatGPT output:** encrypted trusted backup sink, short-lived least-privilege credentials, restricted access and retention, masked database/tenant identifiers, and audit record containing digests only. Do not use `PGPASSWORD` in committed scripts, paste connection strings, print role secrets or copy raw private conversations.
- **No provider calls from restored data** until jobs, webhooks, money settlement, background audio, notifications, queued sends and automatic retry runners are explicitly disabled and network-fenced in the rehearsal environment. This includes NOWPayments/Flutterwave, WhatsApp/Telegram, push, Gemini and LiveKit effects.
- **Targets need consent and separate controlled account access.** Do not use any real customer's test transfer without owner authorization and provider sandbox qualification.

## B. Read-only inventory and recorded evidence

1. Record current `main` SHA, **actual successful Gateway deployment SHA** (not `NEEDS_APPROVAL`), last served health + readiness response and runtime image digest. Capture only env **variable names**/sealing, no values. List services, volume mounts, DB endpoint visibility, ports, Network/TLS constraints, DNS and deployed workers.
2. Through a secure authorized SQL client with a read-only role, inventory `SELECT version()`, `SHOW server_version_num`, extensions `pg_extension`, schemas `pg_namespace`, table count/size `pg_stat_user_tables`, active schema ledger `public.masanawa_schema_migrations` and its `owner,name,sha256` pairs; extensions may require privileges. Never expose row content/credentials. Capture process DB user via `SELECT current_user` and scrutinize grants/roles with security owner. Save a sanitized hash/size summary as an attached operations report.
3. Compare source manifest from `platformProductMigrationRoots()` to actual applied ledger. **Do not run migrations to see if they work.** Classify memory/world roots as production-required, separate migrations, or not used; confirm whether external schema dependencies would break a truly fresh cluster.
4. Inventory blob stores, S3 buckets/regions/key prefixes/retention/private ACLs, replay/voice attachments, avatars, Gemini encrypted credential dependence, push, exact provider account and fixed-IP relay settings. Record **references and classifications**, not secret values.
5. Obtain provider backup feature/status information. Confirm whether a usable automatically retained volume snapshot, logical backup and WAL/PITR already exists; current inspection has **no proof**. Agree owner-approved RPO/RTO targets. If cost is limited, start with encrypted logical backups to independently controlled storage and frequent restore tests; don't promise PITR without WAL/archive implementation.

## C. Add a production-safe migration interface BEFORE new deployment

Repository today exports `runMigrations(pool,roots)`, but the visible CLI `pnpm alpha:prepare` calls a bootstrap that also creates **Alpha demo identities**. **Never use it against a production clone**.

Require a dedicated versioned, *non-seeding* and auditable CLI with operations such as:
- `db:migrate:status`: read manifest and `masanawa_schema_migrations`, check missing, extra, drifted checksum, server/extension compatibility, privileges and ordering. Read-only.
- `db:migrate:apply`: an explicit operator-only, deploy-SHA-pinned, backup-acknowledged action; advisory lock, transactional migration, timeout, idempotent no-op when current; abort on unknown/drift. No domain seed or account generation.
- `db:bootstrap:test`: reproducible pristine temporary PostgreSQL with required extensions, apply **all declared mandatory** roots once, verify FK/role grants/constraints, rerun no-op, inject failure and verify rollback. This is a separate disposable DB acceptance, never real production.
- `db:readiness`: fail closed for schema missing/drift, compatible server version, required extensions and active exclusive writer/migration state; surface sanitized readiness reason.

Do not rewrite existing migration files to achieve an easy clean install: release additive fixes with a new owner-approved migration after checking applied hashes.

## D. Non-destructive portable backup/recovery rehearsal

**Require explicit authorization, a temporary destination, and approved privacy-safe data handling.** Two different tests are required:

**Test 1 — schema-only from pristine DB (no production data):**
1. Provision a temporary private PostgreSQL 18 / pgvector-compatible instance in a **separate** project/account or runner. Install required extensions/roles safely.
2. Run the future `db:bootstrap:test` over declared migration roots. Verify `masanawa_schema_migrations`, FK constraints, service DB grants and `/readyz` with a staging-configured Gateway. Bootstrap only **explicit disposable test identities** via a separate fixture script, never `alpha:prepare` for production.
3. Execute actual DB integration tests (real PostgreSQL, not mocks), authentication, Talk create, chat A/B when merged, agent, privacy, idempotency, ledger and outbox invariants. Re-run migrator to prove no modification; inject interrupted transaction and ensure no half-applied migration.

**Test 2 — controlled encrypted backup and restoration of an approved snapshot:**
1. Quiesce/snapshot appropriately with domain owners for financial consistency. Prefer a provider snapshot or MVCC-consistent `pg_dump` **and** object-store manifest; ensure outbox/provider side-effect fence and high-watermark operation list are captured. Never assume a database dump also includes media/secrets.
2. Example **illustrative operator-side commands only** (not executed here; output must be stored in access-controlled encrypted storage and NEVER as repository artifact):
   ```sh
   # Run only on an authorized, isolated host with injected secret connection variables.
   pg_dump --format=custom --no-owner --no-privileges \
     --file="$SECURE_BACKUP_PATH" "$SOURCE_DATABASE_URL"
   # Verify file digest and encrypt before off-account transport.
   # Destination must be pristine, separate, and have compatible roles/extensions.
   pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \
     --dbname="$DISPOSABLE_TEST_DATABASE_URL" "$SECURE_BACKUP_PATH"
   ```
   **Do not run schema migration *before* a full schema+data restore** to the same blank target: that would duplicate tables. A restore of a full dump must be followed by manifest/drift check and **only unapplied additive migrations**, after source/destination version compatibility tests. `pg_dump` does not include server-global roles/tablespaces; provision and validate these separately.
3. Validate encrypted archive decryption/digest/restore status, migration hashes, exact expected schema/table/row counts (aggregated privately), important immutable ledger sums, outbound receipts and idempotency keys, tenant FK/consent privacy, outbox/inbox cursor continuity, deleted-account tombstones, object key/content-hash/ACL references and missing object orphans. **Use no production card/payment or private content in assertion logs.**
4. Start **read-only or external-effects-disabled** staging Gateway/Worker/Insights, never reuse production provider callbacks. Run `/healthz` and **`/readyz`**, scripted HTTP/mobile screen→API→DB→readback journeys and cross-tenant negative tests. Verify source vs restored DB and blob state against recorded proofs.
5. Rehearse simulated restore to a clean account and record measured time from request to Ready/first accepted safe user action (RTO), and time of newest durable record compared to snapshot (actual RPO). Set approval threshold for data-loss and downtime; if unknown, report `UNVERIFIED`. Test one failure and rollback from destination.
6. Destroy **only** the explicitly disposable restored environment after retention window under approval. Preserve the original production database and backup.

## E. Production account migration / cutover (future gated operation)

**Do not execute until Tests 1–2 pass with signed evidence.**

1. Approve budget, exact target hosting/security region, extension/PG major, DNS/network/private endpoint, object storage class, SSL, standby/backup retention, operational alerts. Build Gateway/worker/ops images from a **single reviewed immutable SHA**.
2. Export/re-encrypt/import env secrets through an approved vault workflow, inspect sealed variable refs, rotate scoped credentials where needed, preserve encrypted credentials' decryption lineage or explicitly re-enroll users, and configure **new provider callback endpoints** and fixed-IP relay allowlisting. Never copy secrets to a PR.
3. Freeze live side-effect writers and domain outbox claims at agreed event/ledger high-watermarks; verify no unknown/dispatched payment in flight; make final consistent snapshot + media delta, restore and validate. Unsafe in-flight outcomes go to reconciliation, **never blind replay**.
4. Start destination with external outbound effects still fenced; pass `/readyz`, real auth and distinct user A/B, Talk rejoin, profile/avatar/media, Assistant, latest balances and receipts, qualified providers, and no cross-tenant leakage. Confirm Android client uses the **stable custom API domain** and TLS.
5. Carefully transfer external webhook/FCM/LiveKit routes once, update controlled DNS/canonical endpoints, monitor duplicated/late webhook delivery, prevent split brain by fencing the old writer and unique receipt/idempotency claims. Rollout requires human authorized go/no-go.
6. On failure, preserve ledgers and provider state; rollback traffic only when old writer is safe and no new destination effects are unreconciled. Document exact lineage from old to new SHA and artifact/archive digest. Never automatically replay a money action.
7. Keep restored copy for agreed rollback period and monitor database quota/volume, backup freshness, RPO/RTO, object missing references, jobs stuck, provider uncertain operations, API 5xx and p95 with privacy-safe telemetry.

## F. ChatGPT Work / CI executor checklist — report format

| Gate | What must appear in Work results | Until then |
| --- | --- | --- |
| Backup inventory | Provider feature/status, last verified recoverable backup timestamp, separate encrypted off-account copy and alert | **NOT VERIFIED** |
| Clean bootstrap | Exact Postgres build/pgvector, migration SHA list, fresh install test and second no-op, FK/security/extension evidence | **NOT VERIFIED** |
| Restore | Archive digest/expiry/key policy, independent DB/bucket restored, object + ledger counts/hashes, measured RPO/RTO | **NOT VERIFIED** |
| Feature E2E | Each row in `BACKEND-FEATURE-TRACEABILITY-20261008.md` with CI/local executed server+DB+Flutter/Android commands and A/B negative tests | **NOT VERIFIED** |
| Deployment | Actual successful Gateway/worker SHA, executed `/readyz`, backup-safe migration admission, monitoring and rollback rehearsal | **NOT VERIFIED** |
| Provider/voice | Valid credentials/legal market/supported asset, LiveKit/FCM/Flutterwave/NOWPayments sandbox/live separately certified | **NOT VERIFIED** |

**Blocker procedure:** Feature windows continue complete implementation even if GitHub Actions #457 (quota), hardware, external authorization, or credentials fail. **Record once** the command/expected test, observed error/status, ref SHA, owner, impact and deferred Work step. No repeated no-op Actions retries. Keep unverified PR **draft/unmerged** and do not claim success.

## G. Ownership and review sign-off

- **DB/migration:** one ops/database integration owner, working with security and schema owners, reviews grants, PG major/extension and backfill sequencing.
- **Financial authority:** R05–R08/C06 review all balances, ledgers, cancellation/repair and retry fences.
- **Privacy/media:** R12/R15/C04 own deletion, access, encrypted files/voice/replay and private cached data across restore.
- **CI/deployment:** issue #457 owner / ChatGPT Work handles blocked runner verification, screenshots, deployed SHA, fresh target and merge reviews. No privileged production mutation without explicit account approval.
- **Per-feature:** existing R/C owner attaches database evidence before `VERIFIED`; implementation source remains independent of the ops audit.
- **Product owner:** approves data region, third-party terms, RPO/RTO, costs and any actual account/domain/provider cutover.

**Documented runbook ≠ a backup or restore. No destructive operations, live funds, or production database queries were performed.**
