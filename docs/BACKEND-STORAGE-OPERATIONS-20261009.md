# Backend, database and storage closure plan — 2026-10-09

Status: design requirements and source findings; production SQL/storage/provider checks NOT_RUN. Baseline `44d75253cd9196db395662187a10aaaf39cc31c1`. Read [source audit](WHOLE-APP-SOURCE-AUDIT-20261009.md), [money contract](MSN-WALLET-P2P-CONTRACT.md), [data architecture](DATA-ARCHITECTURE.md) and relevant existing recovery/restore runbooks. Keep current architecture and real adapters; do not migrate providers or add another database because the product is changing.

## What exists and what remains unqualified

- Gateway has a dedicated migration CLI; package start is `pnpm migrate && node --conditions=production dist/main.js`. The Docker presence wrapper calls that package start. Correct the historical 2026-10-08 audit: “startup never migrates” is no longer true in current source. Deployed artifact/command/database state is still unverified.
- Migration runner hashes SQL, refuses changed applied migrations, records owner/name, and applies batches within an advisory-locked transaction. Fresh cluster, existing-data upgrade, cross-domain FK ordering, concurrent starters and lock duration require actual PostgreSQL evidence.
- Readiness checks expected schema/checksums and narrowly requires PostgreSQL 18. Gateway platform roots and worker default foundation roots differ. Inventory each service's actual queried schemas, including memory/world and pending modules, before deciding omissions are intentional or bugs.
- Gateway deployment config probes /healthz. Readiness is a separate capability, not proof supplied by a process-only health check.
- Pool defaults are 10 clients, 30s idle and 5s connect; TLS is passed only when configured. Inspect actual gateway/worker/ops overrides, verified transport and aggregate connection budget. Do not claim runtime uses insecure TLS from this factory alone.
- Avatar/replay object adapters and real account-deletion routes/lifecycle exist. Drafts hold more avatar, messaging, deletion-worker and schema-admin work. Recover them before implementing replacements.
- The historical 2026-10-08 infrastructure report is dated evidence. Its volume size/status/variables do not establish current capacity, working backups, object access or restore. No destructive production probe is authorized by this plan.

## Domain persistence map

Each feature owner extends the canonical repository through versioned migrations assigned by AF00. Table names below describe required concepts, not permission to create duplicate tables.

| Domain | Durable facts / constraints | Objects and jobs | Owner |
| --- | --- | --- | --- |
| Identity/preferences | Stable user/tenant, credential state, sessions, linked verified vs unverified contact, versioned account preferences and blocks | Private export/deletion requests; credential/session revocation and cleanup | AF08/AF14/AF15 |
| Chat | Conversation/membership, ordered messages, client dedup key, delivery cursor, media metadata, immutable transfer reference | Private note objects; outbox/reconnect, failed-upload and orphan cleanup | AF06/AF05/AF15 |
| Rooms | Room/members/roles/invites, durable note/history, removal revision and notification settings | Private/group objects, live-session authority and expiry | AF10/AF15 |
| Audio posts | Draft/upload/processing/published/removed state, author, unique publish attempt, follows/saves/comments/reactions/report and play-count aggregation | Bounded audio, waveform/derived assets; processing/moderation/deletion jobs | AF09/AF15 |
| Masana creators | Existing persona ID, editorial profile/version, schedule occurrence/timezone, script sources, generation state/cost | Generated audio, publish-once occurrence/lease/budget; operator pause/retry | AF12/AF15 |
| Wallet | One ledger with integer/decimal exact asset units, accounts, balanced postings, confirmed provider event uniqueness, quotes/consent/receipts | Funding/withdraw/conversion reconciliation, reorg/chargeback obligations | AF01 |
| P2P | Terms snapshot, participants, reserved MSN, order version/state/deadline, evidence and dispute/audit | Private evidence; paid/disputed freeze, safe timeout, release/refund atomicity | AF02/AF01/AF15 |
| Gwani billing | One durable draft/task and validated catalog/recipient, quote/consent/fulfilment reference | Provider uncertainty lookup/reconciliation; same receipt in menu/chat/Wallet | AF04/AF01 |
| Activity/support | Typed resource/event identity, recipient/read/dedup, support case/report/status | Privacy-safe notifications and evidence retention | AF14/AF00; feature event producers |

Use foreign keys/uniqueness/check constraints and explicit ownership queries where appropriate; test real DB races, not only in-memory doubles. Money fields never float. Set bounded cursor pagination and indexes from actual access patterns; define tie-breakers, deleted-resource behavior and authorization before counts/joins. Multi-tenant/user isolation applies in APIs, jobs and repositories. Do not invent E2EE claims.

## Media lifecycle and storage authority

One reusable media authority, adapted from existing stores: intent → bounded upload → server validation/processing → ready → linked/published → removed → retention-qualified purge. Metadata lives in PostgreSQL; binary audio/photos/evidence live in configured object storage, not base64 message/database rows. An uploaded object is not yet a published message/post.

Required rules:
1. Server allocates unpredictable owner/resource-scoped object keys. Validate declared and actual size, codec/type/duration; prevent arbitrary URL imports/path traversal. Quotas cover abandoned and generated uploads as well as published data.
2. Authenticate and authorize resource access before issuing short-lived private URLs. Public-post assets and private DM/room/evidence have explicit, separate visibility. S3 adapter presence is not an ACL qualification result.
3. Revocation must account for already-issued URL expiry, cache policy and member removal/block/account change; no permanent private URLs in push payloads or logs.
4. Commit linkage/publish idempotently. Record uncertain upload states; retries reconcile existing intent/object before creating duplicates. Failed transcoding is visible/retryable without false publication.
5. Define retention for drafts, removed posts/messages, legal/financial evidence, avatars and derived files. Delete current and replaced variants through durable cleanup; do not destroy escrow evidence while a dispute is open.
6. Orphan sweeps require grace periods and authoritative reference checks; record deletion result/retries and refuse unsafe mass cleanup. Account deletion cannot complete while processor/object obligations are unproven.
7. Backup/restore includes DB metadata AND matching object keys/versions where supported, encryption-key/provider configuration recovery and integrity sampling. A DB restore with lost audio is a failed product restore.

## Jobs, automation and operations

Inventory the actual scheduler, financial/deletion workers, presence process and pending #497 work. The inspected worker main establishes HTTP/database lifecycle; it does not establish all future jobs. Avoid a second cron/scheduler authority.

Every job needs stable occurrence/idempotency key, persisted state, atomic lease with expiry, retry/backoff ceiling, heartbeat/metrics, poison-job inspection and audited manual recovery. A process restart resumes from durable work, not an in-memory timer. Preserve explicit purchase authorization: jobs/models cannot manufacture spending consent.

Qualify posting generation, media cleanup, P2P pre-payment expiry, disputed/paid freeze, provider reconciliation, notification delivery, export/deletion and cache cleanup individually. Operators can pause new generation/orders while still resolving existing obligations. Financial incidents distinguish delayed from failed; lookup/reconcile before retrying uncertain writes.

Observability: request/job/provider/order IDs, structured redacted errors, readiness, job lag/age, leased/stuck work, uploads/processing failures, storage growth, rejected access, outbox/reconnect failures, unmatched provider/ledger events and treasury availability. No audio contents, credentials or payment evidence in ordinary logs. Alerts need named responders and actionable runbooks; metrics alone do not close incidents.

## Database deployment and recovery gates

AF15 proposes, AF00 composes/assigns migrations; AF01 approves financial schema/retention. Preserve applied SQL and schema checksum authority. Use separate migration authority and least-privileged runtime roles where the actual deployment supports them; prove grants for gateway, jobs and operators.

Gate DB-A01: complete migration inventory across main and relevant drafts; unique IDs/owner filenames, immutable checksums, published service-root coverage and existing-data preservation.
Gate DB-A02: fresh PostgreSQL 18 plus populated upgrade rehearsal, concurrent migration startup and interrupted deploy; document lock/timeout, compatibility and rollback/forward recovery. Never “rollback” settled ledger events by deleting history.
Gate DB-A03: actual deployed schema/readiness/artifact identity and transport/pool/connection limits, without printing secret values.
Gate DB-A04: database backup schedule/retention/ownership and restore to isolated target with representative messages, balances, escrow and tasks; record recovery time/data-loss objectives and actual result.
Gate DB-A05: coupled private/public object restore with authorized readback, removal denial and representative playable audio; test unavailable object provider.
Gate DB-A06: measured current DB/volume/object growth and alerts, retention/index/query plan review, saturation and connection recovery. Historical 500MB metadata is not current utilization evidence.
Gate DB-A07: kill/restart/job duplicate and lease-race tests for each enabled job; escrow/ledger reconcile before opening money features.
Gate DB-A08: account delete/export/privacy retention and processors including push/media/generated assets; open escrow blocks cleanup safely; stale users cannot read cached/private URLs beyond defined revocation window.

For each gate capture immutable source/artifact/schema identity, command, redacted evidence, PASS_REAL / PASS_SIMULATED / FAIL / BLOCKED / NOT_RUN. No new paid resource, provider swap or production mutation is implied.

## Ownership and sequence

AF14 owns Settings/account preferences/supporting account surfaces. AF15 owns reusable storage/operational lifecycle modules and DB/storage qualification proposals. Feature owners retain domain repositories/ledger/jobs; AF15 integrates their operational requirements without taking their financial or auth authority. AF13 owns independent cross-feature evidence. AF00 retains root startup, migration registries, provider composition, deploy/CI files and locale integration.

First recover sources and inventory; next publish persistence/media/preference contracts; then implement vertical slices with module-level real DB tests; finally qualify device/provider/restore and authorize release. Screens must not launch with fabricated balances, empty success responses or inert controls.
