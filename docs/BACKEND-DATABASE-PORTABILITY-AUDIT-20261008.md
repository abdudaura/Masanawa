# Backend & Database Portability Audit — 2026-10-08

> Historical 2026-10-08 snapshot. Current source correction: gateway package start now runs migrations before main; the presence wrapper delegates to that start. Earlier startup/readiness statements below describe the old snapshot, not current source or deployment proof. Use [2026-10-09 backend/storage closure plan](BACKEND-STORAGE-OPERATIONS-20261009.md) for current requirements. Dated infrastructure metadata does not prove present backup/restore/capacity.

> **Audit status:** source and connected Railway *control-plane metadata* examined, but **no production SQL query, backup inspection, restore, payment, provider call, executable build, device test, or new deployment was performed**. Evidence statements below are deliberately qualified. This audit supplements `DATA-ARCHITECTURE.md`, `CONFIGURATION-DEPLOYMENT.md`, `API-LIFECYCLE.md`, `IMPLEMENTATION-KICKOFF-20261008.md`, and the existing R01–R19/C01–C08 ledger. It does not launch a competing workstream or reserve existing code-owner paths.

## 1. Decision

**Preserve the current architecture:** one authoritative PostgreSQL store with distinct domain-owned schemas/repositories, one public Gateway and specialized background/LiveKit workers, portable object storage, and Flutter/Web clients consuming typed authenticated APIs. **Do not rebuild in a different DB or split into one microservice per feature.** Do not label this platform **"migration-ready"** or **"all app features wired"** until the acceptance exercise and matrix below pass.

### Evidence classification

- **OBSERVED SOURCE:** code or contract present on GitHub `main` at `573c8f4dbf4e04ebdc1d7a996ea285a44290b17d`; *not* proof of successful execution.
- **OBSERVED RAILWAY:** connected Railway control-plane metadata as inspected 2026-10-08, not DB row/schema integrity or current end-user availability.
- **DOCUMENTED DESIGN:** required behavior in canonical docs, with implementation/acceptance still unknown.
- **NOT VERIFIED:** unknown because actual executable/read-only credentialed DB/restore/device/provider evidence is missing. Never replace this with a fabricated PASS or an assumption of failure.

## 2. Real infrastructure inventory (observed Railway)

Project `empowering-education`, production environment, region **Amsterdam (`ams`)**. Do not mistake the legacy service labels for current domain ownership.

| Unit | Current evidence | Caveat |
| --- | --- | --- |
| PostgreSQL | Service labelled `@nurain/contracts`; image `pgvector/pgvector:0.8.6-pg18-bookworm`; private network endpoint; one deployed successful database replica; persistent volume named `masanawa-postgres`, provisioned **500 MB**, mounted at `/var/lib/postgresql` | Service *name* is legacy, but image/volume identify a Postgres instance. No verified backup, WAL archive/PITR, disk utilization, production table count, restored data checksum, role privileges or Postgres failure-recovery test. Do **not** delete/rename before planning. |
| Public Gateway | `masanawa-gateway` tracks `Baatiku/masanawa` `main`; Dockerfile `infra/deployment/gateway/Dockerfile`; Railway hostname and custom `gateway.masanawa.com`, target port 8080 | Recent pushes produce `NEEDS_APPROVAL` deployments; last observed **SUCCESS** deployment from an earlier `main` SHA `f4cd25420ae24be78cddd7c3d17bdc34e0f8a060`. Thus latest repository source is **not verified running**. Multiple failed Gateway deployments also exist. |
| Ancillary | `@nurain/worker`, `@nurain/call-gateway` and sleeping `@nurain/dashboard` coexist in project; current service sources include prior branches/repository paths | Their being online does **not** establish they run the current Masanawa R/C worker contracts or that deleting them is safe. Reconcile credentials/jobs/routing before cleanup. |
| Gateway vars | `MASANAWA_DATABASE_URL` plus provider/LiveKit/Gemini/Resend/Firebase or related env *names* | Values deliberately not read or copied here. Secret presence/validity, actual PG target/roles, provider qualification and connectivity still need in-process checks. |

**Explicit control-plane distinction:** A database container in state `online` can have missing/stale schemas or broken app credentials. `NEEDS_APPROVAL` is not deployment success. Connection/security proofs must come from read-only SQL + `/readyz` and verified run SHA, not Railway labels.

## 3. Repository database anatomy (observed source)

| Owner | Schema / role | Observed canonical examples |
| --- | --- | --- |
| Identity + security | `identity.*`, `security.*` | Tenants, users, characters, relationships, external identity links, OTP challenges, customer profiles and hashed sessions |
| Talks | `talks.*` | Public Talks/comments, public profiles/follows/personas, live sessions, replay/search/library, moderation/notifications; human DM consent schema is **not on main** (draft PR #468). |
| Agents | `agents.*` | Character sessions, agent configurations/runs, mobile shell |
| Commerce | `commerce.*` | Quotes, immutable Credits ledger, NGN wallet entries, crypto intents/ledger/provider events, creator/Twin commission + trial/seat/owner access |
| Events | `events.*` | Operations, idempotency, inbox/outbox, external receipts, audit/reconciliation |
| Skills | `skills.*` | Catalog, versions, guides, teaching |
| Memory/world | `memory.*`, `world.*` migrations exist | Core Gateway `platformProductMigrationRoots()` selects **events/security/skills/identity/agents/commerce/talks**, not memory/world. Confirm whether a separate deployment/migration lifecycle owns those roots; do not silently assume they are applied on prod. |
| Large media | S3-compatible object-store adapters in `services/gateway/src/profile_avatar/` (on draft R18 #435), and `services/gateway/src/talk_replay/playback/`; some Gemini credential interoperability uses Supabase config | No verified all-media backup, cross-account bucket copy, private attachment ACL, expiry/key migration or object/reference restore. |

Postgres adapter under `adapters/storage/postgres/src/` creates a bounded `pg` Pool. Gateway `services/gateway/src/main.ts` uses `MASANAWA_DATABASE_URL` or compatibility `DATABASE_URL`; `services/worker/src/main.ts` and `services/ops/src/main.ts` follow the same adapter pattern. `platformProductMigrationRoots()` is in `readiness.ts`; **startup checks readiness but does not run the schema migrations**. `scripts/alpha-bootstrap.mjs` invokes `runMigrations()` **and creates development tenant/user/skill/agent state**; `pnpm alpha:prepare` is **not** a production migration-only runbook.

`migrations.ts` enumerates domain-owned `*.sql`, orders by `owner/name`, runs a **single serializable transaction under advisory lock**, records `sha256` in `public.masanawa_schema_migrations`, rejects edited previously applied migrations. Good starting point, but adding cross-package FKs needs checked ordering, Postgres major compatibility and fresh-cluster tests. Multiple filenames can share a numeric prefix, e.g. `commerce/0102_ngn_wallet.sql` and `commerce/0102_twin_economy.sql` or `talks/0007_talk_library.sql` and `0007_talk_replay_media.sql`; the runner keys by **full filename + owner** so this is not itself a collision/failure, but migration naming policy should prohibit ambiguous new sequence allocations. **Do not rename/rewrite already-applied migrations**.

### Portable parts already present

1. PostgreSQL and SQL rather than a provider-owned exclusive DB query interface; TypeScript repositories shield app clients from SQL.
2. Explicit versioned SQL migration table, checksum comparison, transaction boundary and advisory lock.
3. Canonical tenant scope, immutable finance/event evidence, idempotency and outbox concepts represented in real schemas.
4. Gateway and Worker have liveness/readiness endpoints and dependency-injected runtime seams; build/container manifests are in Git.
5. `config/production-env.json` names environment/secret classes; backend consumption primarily goes through deployment composition roots. Never give DB credentials to mobile apps.

These are **design and source advantages**, not an accepted disaster recovery test.

## 4. Findings, prioritized

| ID | Severity | Evidence-based gap | Required owner-level remediation & gate |
| --- | --- | --- | --- |
| **DB-P01** | **BLOCKER** | No executable encrypted off-platform logical/WAL backup, restore rehearsal, independent backup inventory, backup freshness alert, or owner-approved RPO/RTO was demonstrated through repository + connected Railway inspection. **This is absence of verification, not proof Railway has no backups.** | Operations/Work first inventory any existing provider backups. Add off-account encrypted scheduled backups with retention, periodic integrity/restore checks, controlled keys, and alert on last-success. Set agreed RPO/RTO; prove actual restore to disposable separate account before copying real user data. |
| **DB-P02** | **BLOCKER** | Source has checksum migrations, but no isolated **production schema-only** deploy/migrate command demonstrated. Alpha bootstrap additionally creates dev identities. `/readyz` reports out-of-date or drift, cannot automatically repair. | Dedicated migration-runner/ops owner: deterministic from empty PG18 cluster, minimum privileges, explicit `migrate:status/apply` command, sequential immutable changes, release preflight/backup and lock, fixture/downgrade prohibition, tested failure rollback. Never run Alpha bootstrap against production. |
| **DB-P03** | **HIGH** | Railway Gateway deploy health check is `/healthz` (returns 200 regardless of DB); `/readyz` actually tests DB/schema and returns 503 if invalid. A process may be live but unusable. Runtime Railway config has 30-second health-check timeout; repo `railway.toml` says 120 — **configuration drift**. | Platform integration owner: establish `/readyz` as separate deployment admission/traffic gate when dependency startup is complete, and reserve `/healthz` as liveness. Ensure no repeated restart storm on transient provider outage. Test fresh/missing/outdated/drifted DB and external dependency paths. |
| **DB-P04** | **BLOCKER** | Gateway deployments since previous success are `NEEDS_APPROVAL`; repository `main` and last actual success SHA diverge. Current app/backend functionality cannot be inferred from source commits. | CI/deployment owner #457/#460: record deployed SHA, actual readiness URL and env name, approve release through authorized controls, execute smoke transaction and native Android test; no deployment without passed checks. No automatic account/billing changes. |
| **DB-P05** | **HIGH** | `checkPostgresReadiness()` explicitly accepts Postgres **18 only** (`180000..189999`). Railway DB uses PG18 + pgvector. Many hosts/managed plans may use another major. | Platform DB owner: define supported **tested** majors/extensions from SQL feature usage, not indiscriminately relax guard; pin image or provision equivalent target, compare extensions/collations/roles/timezone and test dump/restore plus auth/finance on fresh target. |
| **DB-P06** | **HIGH** | PostgreSQL data backup alone cannot reconstitute voice, avatars, replay/media, encryption envelope material, Firebase, webhooks, provider accounts, LiveKit or DNS. NOWPayments relay URL has an IP/sslip.io default in `services/gateway/src/main.ts`; Flutter client defaults to a Railway-specific domain and separate `API_BASE_URL`/`AGENT_BASE_URL`. | Deployment/portability owner: vendor-neutral config manifest, secret *names* & per-environment external-resource inventory, stable canonical API host, full object key/ETag/private ACL restore and relay re-whitelist checklist; rotated secrets and new-provider callback endpoints validated. Never commit secrets or embed private keys in APK. |
| **DB-P07** | **HIGH** | `platformProductMigrationRoots()` excludes `memory` and `world` even though those schema families exist; separate runtime DB readiness defaults to `foundationMigrationRoots()`. Production applied schema ledger was not queried. | Schema owners: classify each root as **core release-required**, **separately deployed** or **legacy/unused** with exact service dependency, migration owner, role and readiness. Test shared clean bootstrap; never run optional schemas blindly or treat source file as live table. |
| **DB-P08** | **BLOCKER** | UI/backend trace is incomplete by design: current Flutter router still documents **four root destinations**, while approved design is five; human DM schema/routes are draft #468 (not `main`), C02–C05 real messaging not proven. Mobile `ApiClient` still exposes older community and `/ai/chat` methods that need active-call/route parity classification. | **Every R/C owner** must satisfy `BACKEND-FEATURE-TRACEABILITY-20261008.md` with native UI → typed client → exact API → session/auth → repository → SQL/media/events → readback/restart/negative tests, not source existence. Single R17/C08 shell owner handles UI integration. |
| **DB-P09** | **HIGH** | Production DB role grants, network/TLS, credential rotation, audit log redaction, RLS defense in depth and separation of migration vs runtime privileges weren't verified with read-only inspection. | Security/ops: inspect roles/grants securely, least-privilege per service/migrator, TLS and secret rotation/expiry, no exposed Postgres TCP, tested denial of cross-tenant messages/profile/media/financial mutations and off-account restore credentials. |
| **DB-P10** | **HIGH** | The deployed project contains legacy Nurain-labelled operational services and a PG cluster with only one observed running replica; no separate standby, automated restore or rollback of in-flight events was demonstrated. | Ops/Work: map real dependent consumers, connections, scheduled jobs, retention/volume thresholds, resources and exact secret usage before renaming/removing anything. Test restore without re-sending pending provider effects or resurrecting expired leases. |
| **DB-P11** | **HIGH** | CI #457 reported 0-step Actions failures; many draft backend/frontend PRs are unexecuted, so compatibility across `main`, migrations and Flutter cannot be signed off. | Keep all relevant implementation PRs **draft/unmerged** on verification blockage; write test specs/scripts and record exact commands, SHA, blockers. ChatGPT Work later executes DB/Flutter/provider/device and merges only actual passes. No repeated CI quota retries. |

**Do not make irreversible production changes solely on this audit.** The first production task is to **verify whether recoverable backups already exist** and make an independently verifiable snapshot, before running migrations/restarts/role changes.

## 5. Move to any other hosting/account — measurable portability target

A successful fresh-account migration must demonstrate all of:

1. **Infrastructure recreated from non-secret declarations**: PG18/validated equivalent with exact extensions, roles, private network, schema-only migration runner, Gateway, durable Worker, Ops and presence/LiveKit endpoints. App image built from a tagged SHA; no dependency on owner's previous Railway project ID.
2. **Data continuity**: cryptographically verified encrypted backup/archive and restore; counts/hashes per domain, referential constraints, tenant IDs/identity mappings, Sessions/agent relationships, Talks, creator balance, NGN & Crypto immutable ledgers, external provider receipts, outbox/inbox, replay metadata, object storage references, consent/block/deletion tombstones verified. Do not export or print sensitive record samples into logs.
3. **Operational continuity**: LiveKit audio and push callbacks updated; Flutterwave/NOWPayments fixed IP relay and webhooks re-qualified; Gemini, Firebase, S3, Resend, domain and key references rotated or preserved correctly; secrets never shared through GitHub issues; no unexpected financial/provider redelivery.
4. **Mobile continuity**: built APK/AAB picks environment's **canonical stable API URL** and can authenticate/reconnect; existing valid user data/cursors survive, or a documented safe session re-login is intentionally required. QR/deep-link/media URLs are portable and HTTPS.
5. **Safe cutover**: backups are fresh and independently restorable, old financial writes fenced, pending effects reconciled, staged destination validates checksums and J journeys; DNS/traffic switches only after readiness+end-to-end smoke, with written freeze/rollback including duplicate webhook safety.
6. **Evidence**: source & deployed image SHA, migration manifests/checksums, object copy digest manifest, last restore time, permission/access tests, observed measured RPO/RTO and logs, signed operator approval.

See `DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md` for non-destructive rehearsal sequence and owner/Work deferred executable commands.

## 6. Interaction with current R/C feature work — **do not stop implementation**

- All 77 requirements and 11 journeys remain attached to R01–R19/C01–C08; no extra backend product lane is invented. A *cross-cutting* DB/portability ops integrator coordinates migration/backup/CI, while **feature teams continue their complete owned slices**.
- Feature windows **must code full backend+DB+API+Flutter+integration and negative tests** even if CI, third-party credentials or device testing are blocked. A blocked external test is documented once with command, environment, risk, PR SHA, exact deferred Work action; don't spin on infrastructure.
- **No partial feature labelled DONE:** acceptable status `IMPLEMENTED_UNVERIFIED` for a full code slice; `PARTIAL_IMPLEMENTATION` for missing owned code; `VERIFIED` only for real end-to-end evidence; `RELEASED` only for deployed/device/provider gates.
- **PR #468** human contacts and **#435** profile both touch Gateway app/main and need semantic integration; **#467** UX reference is unmerged; **#460/#457** own shared Actions recovery. This dated snapshot must be checked against new main/PRs every time.

## 7. Explicitly not verified

Actual applied migration hashes/row counts in live Postgres; backup freshness or point-in-time restore capability; physical storage size consumed vs 500 MB provisioned; SSL/role grants; seeded catalog/user correctness; service-to-service read/write paths in live deployment; Android E2E; authorized consent/payment provider outcomes; existing backup contents; cross-cloud full provider export; credentials. A code test that *would* test these is not proof until it runs.

**Audit outcome: keep PostgreSQL modular architecture; treat portable redeployment and full UI-to-DB coverage as OPEN release gates, with actionable procedures and test matrix—not merely aspirational requirements.**
