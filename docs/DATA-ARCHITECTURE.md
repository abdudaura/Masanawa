# Data Architecture and Persistence Boundaries

Status: Phase 1 canonical draft.

## Canonical store

PostgreSQL is the canonical durable operational store.

Canonical domain tables, append-only ledgers, workflow checkpoints, outbox/inbox state, and audit evidence live in PostgreSQL unless an ADR explicitly assigns a different canonical store.

Vector, search, graph, cache, object-storage indexes, provider stores, local SQLite files, browser state, and donor databases are derived or adapter state unless explicitly stated otherwise.

## Schema ownership

Each canonical package owns:
- its normalized tables;
- migrations;
- repository interfaces;
- concurrency/version rules;
- retention/lifecycle rules.

Other packages do not execute SQL directly against those tables.

Initial logical schema namespaces may be implemented through PostgreSQL schemas or disciplined table prefixes; the physical choice is Phase 2 implementation detail. Logical ownership is fixed.

## Cross-package foreign keys

Use cross-package FKs only for stable canonical identities and only when lifecycle coupling is intentional.

Prefer:
- branded IDs at API boundaries;
- referential validation through owning ports;
- events/projections for loose coupling.

Do not create giant cross-domain relational graphs simply because all packages use one Postgres cluster.

## Canonical aggregate tables

### identity-owned

- tenants
- users
- external_identity_links
- characters
- character_versions
- user_character_relationships
- relationship_revisions/history where needed

### world-owned

- worlds
- world_generations
- world_actors
- world_inputs
- world_steps
- world_events
- world_projection rows as derived/current state

### memory-owned

- memory_records
- memory_revisions
- memory_evidence/provenance
- memory_links/supersession
- memory_dead_letter/repair state
- projection checkpoints for vector/lexical/entity/temporal indexes

### agents-owned

- character_sessions
- agent_runs
- run_lineage/delegation
- bounded session metadata

Conversation transcript storage may be physically colocated or separately partitioned, but canonical session/transcript ownership remains explicit and does not become memory truth.

### skills-owned

- skills
- skill_versions
- skill_dependencies
- certification/rehearsal evidence
- skill capability/risk metadata

### tools-owned

- tools
- tool_versions
- tool capability/risk metadata
- runtime health projections where persistent

### workflows-owned

- workflows
- workflow_versions
- workflow_runs
- workflow_checkpoints
- workflow_pending_requests/HITL
- tasks
- scheduled_occurrences
- leases/attempts
- reconciliation cases

### providers/security-owned

- provider configurations
- credential_refs only, never raw secrets
- principal/role assignments
- policy revisions
- approval records
- device registrations
- device credential generations
- pairing state

### events-owned

- domain_event_log where retained canonically
- audit_events
- outbox
- inbox/dedupe/tombstones
- idempotency records
- operation records
- external receipts

### commerce-owned

- quotes
- payments
- ledger_entries
- fulfillments
- refunds/adjustments
- provider reconciliation state

### social/studio-owned

- social content/publication/outbox records
- media projects/artifacts/render jobs/provenance

These may live in package-specific schemas later; ownership is the important invariant.

## Mutable row contract

Every mutable aggregate row includes:
- canonical ID;
- tenantId;
- revision or generation;
- lifecycle status;
- createdAt;
- updatedAt.

Updates that can race use:
`UPDATE ... WHERE id = ? AND revision = ?`
or equivalent transactional compare-and-set.

A zero-row update is a conflict, not a silent overwrite.

## Immutable records

Append-only by default:
- AuditEvent;
- LedgerEntry;
- published DomainEvent;
- MemoryRevision;
- CharacterVersion;
- SkillVersion;
- WorkflowVersion;
- accepted ExternalReceipt observations.

Corrections append new evidence/revisions and explicit supersession instead of rewriting history.

## Transaction boundary

One package/domain owner performs one canonical transaction.

The same transaction may write:
- aggregate mutation;
- DomainEvent;
- AuditEvent;
- outbox row;
- idempotency/Operation state required for that mutation.

External network calls do not occur while holding a long-lived database transaction unless an explicitly justified adapter contract guarantees bounded local behavior. Persist intent, commit, dispatch, then settle/reconcile.

## Idempotency table

Durable idempotency records store:
- tenant;
- operation kind;
- key;
- canonical request fingerprint;
- OperationId;
- state;
- terminal/reconciliation locator;
- retention expiry.

Unique index:
`(tenant_id, operation_kind, idempotency_key, authority_scope_hash)`.

Same key/different fingerprint returns conflict.

## Inbox/deduplication

Inbound external events have:
- provider/account namespace;
- provider event ID or canonical derived stable key;
- receive timestamp;
- payload digest/reference;
- admission status;
- completion tombstone;
- retention expiry.

Where provider retry exists, acknowledgement occurs after durable admission.

## Outbox

Outbox rows use durable claim/lease state and are never deleted immediately on completion when replay/recovery evidence is needed.

Terminal state may be archived/pruned only after retention policy.

## Workflow checkpoints

Checkpoint payload is explicit versioned schema/JSON/relational state, never executable-language object serialization.

Checkpoint identity includes:
- WorkflowRunId;
- WorkflowVersionId/signature;
- lineage/predecessor;
- revision;
- createdAt;
- state payload;
- pending external request refs;
- active OperationIds.

Restore refuses incompatible workflow version/signature without explicit migration.

## Memory projections

Canonical MemoryRecord is stored before vector/lexical/entity/temporal projection.

Projection rows include:
- source MemoryRecordId/RevisionId;
- projection kind/version;
- embedding/model/provider metadata where applicable;
- builtAt;
- source hash/revision.

Projection can always be dropped/rebuilt.

Authorization happens from canonical scope metadata before projection candidates are returned to a caller.

## Search/read models

UI/search/report projections may denormalize canonical data.

Every projection has:
- owner;
- source event/version;
- rebuild strategy;
- staleness semantics.

A projection cannot be the only place a business fact exists.

## Object storage

Large binary artifacts live in object storage with canonical metadata in Postgres.

Canonical metadata includes:
- MediaArtifactId/file ref;
- tenant/owner;
- content hash;
- media type/size;
- storage key;
- encryption/access classification;
- provenance;
- lifecycle/retention state.

Public URLs are temporary projections, not canonical identifiers.

## Secret storage

Postgres stores only CredentialRef plus non-secret metadata.

Secret values remain in approved secret vault/storage and are fetched by purpose-scoped runtime capability.

No raw token/API key/password is written to:
- event payload;
- audit payload;
- workflow checkpoint;
- memory;
- ordinary configuration table;
- telemetry.

## Multi-tenancy

All tenant-owned canonical rows include tenantId or are reachable only through a parent with enforced tenant ownership.

Repository APIs require tenant scope explicitly.

RLS may provide defense-in-depth but does not replace application authorization.

Global tables are limited to true platform definitions such as schema metadata or built-in capability catalogs and must be reviewed explicitly.

## Soft delete and tombstones

Use lifecycle state rather than destructive deletion when data participates in:
- idempotency;
- event causality;
- audit;
- financial records;
- security evidence;
- replay protection.

Deletion workflow may anonymize/private payloads while preserving required structural evidence.

## Retention

Retention is data-class specific:
- audit/security;
- message/session;
- memory;
- provider raw evidence;
- financial;
- diagnostics;
- media.

Phase 2 must centralize retention configuration rather than hard-code per adapter.

## Migrations

Migrations are owned by the package/schema whose canonical data they change.

Rules:
- forward-only production migrations;
- deterministic/repeatable local bootstrap;
- no donor migration copied without canonical-schema review;
- data backfills are explicit jobs with resumable checkpoints;
- destructive migration has preflight/backup/recovery plan;
- migration version is observable in readiness/health.

## Backup/restore

Canonical backups cover PostgreSQL plus referenced object metadata and required vault/config metadata through provider-specific procedures.

Restore acceptance requires:
- integrity verification;
- schema compatibility;
- tenant ownership integrity;
- ledger/event continuity;
- object reference validity;
- no stale worker/lease resurrection.

## Database readiness

Service readiness for a write-owning process requires:
- connectivity;
- expected schema/migration version;
- integrity constraints available;
- required extensions;
- writer ownership/fence state valid.

Readiness does not imply authorization.

## Phase 2 acceptance tests

Must prove:
- optimistic conflict rejects stale writer;
- state + outbox commit atomically;
- idempotency survives process restart;
- checkpoint restore refuses incompatible version;
- vector/search projections rebuild from canonical memory;
- cross-tenant repository query cannot escape scope;
- secret values never enter canonical/event tables in integration fixtures;
- restore does not resurrect expired leases;
- financial ledger remains append-only and balanced under retry/concurrency.
