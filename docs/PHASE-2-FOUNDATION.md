# Phase 2 — Foundation

Status: ACTIVE
Started: 2026-10-01

Phase 0 donor selection/forensics and Phase 1 architecture specification are closed. This phase implements only shared platform foundations; product-domain migration waits until the foundation gate is satisfied.

## Canonical inputs

Read before changing foundation semantics:
- `docs/PHASE-1-CLOSURE-AUDIT.md`
- `docs/DOMAIN-MODEL.md`
- `docs/PACKAGE-BOUNDARIES.md`
- `docs/EVENT-CONTRACTS.md`
- `docs/SECURITY-AUTHORITY.md`
- `docs/DATA-ARCHITECTURE.md`
- `docs/PRIVACY-SCOPES.md`
- `docs/SERVICE-CONTRACTS.md`
- ADR-0011
- ADR-0012

## Completed foundation slices

### Workspace/tooling

- root pnpm workspace created;
- strict TypeScript/NodeNext baseline created;
- TypeScript 7.0.2 / pnpm 12.8.2 / Vitest 5.0.3 pinned;
- root Vitest configuration;
- npm/engine strictness;
- base ignore rules;
- Foundation CI workflow;
- architecture tests prevent unknown canonical packages, forbidden cross-package imports, deep package imports and production imports from `references/sources`.

### contracts

`packages/contracts` now owns:
- runtime-distinct prefixed UUIDv7 canonical IDs;
- canonical ID aliases from the Phase 1 domain model;
- Instant helpers;
- typed PlatformError/ErrorCategory;
- ExternalSubjectRef/ChannelConversationRef;
- ActorRef;
- runtime environment helpers.

Tests already cover:
- UUIDv7 ID creation;
- cross-kind identity rejection;
- malformed/wrong-version rejection;
- Instant normalization/order.

### events

`packages/events` now owns:
- PlatformEvent/AuditEvent envelopes;
- event sensitivity/provenance;
- canonical Operation lifecycle;
- idempotency fingerprint conflict rule;
- Outbox contract.

Tests already cover:
- unknown operation outcome cannot redispatch or become success directly;
- accepted operation cannot re-enter dispatch;
- idempotency key/request fingerprint mismatch is a conflict.

### security

`packages/security` now owns:
- Principal union;
- AuthorityContext/current policy revision checks;
- expiry/revocation checks;
- capability intersection for delegation;
- canonical JSON fingerprinting;
- exact ApprovalBinding;
- pending/approved approval lifecycle primitives.

Tests already cover:
- stale policy rejection;
- expired authority rejection;
- child/delegated capability cannot expand;
- canonical argument hashing ignores object-key order;
- argument changes invalidate approval.

### PostgreSQL adapter

`adapters/storage/postgres` now owns:
- pool creation;
- explicit transaction helper;
- serializable migration runner;
- migration content hashing/change refusal;
- Operation/idempotency persistence;
- canonical transition enforcement;
- outbox enqueue;
- SKIP LOCKED claim;
- worker lease/fence settlement.

### event persistence migration

`packages/events/migrations/0001_event_foundation.sql` creates canonical foundation tables for:
- platform events;
- audit events;
- operations;
- idempotency records;
- external receipts;
- reconciliation cases;
- outbox;
- inbox/replay tombstones.

No product-domain tables have been introduced yet.

### Service bootstrap

Fastify workspaces now exist for:
- `services/gateway`;
- `services/worker`;
- `services/ops`.

Each has typed TypeBox health/readiness endpoints. Readiness fails closed and sanitizes thrown dependency errors.

### Workspace validation

Foundation CI now boots pnpm before Node package-manager integration, defers pnpm caching until a lockfile exists, and runs the actual root `pnpm check` under Node 24.

Validated on 2026-10-01 by Foundation CI run 49 at commit `68ebe1bf8c0c18f2a2deb52904f31d75a96261d0`: install, strict TypeScript checks and Vitest all passed.

Validation also fixed:
- `PlatformError` optional metadata under `exactOptionalPropertyTypes` without weakening compiler strictness;
- PostgreSQL `transitionOperation` now enforces the canonical Operation state graph before issuing SQL;
- direct tests cover the persisted transition guard and PlatformError serialization contract.

## Active foundation gaps

1. add deterministic lockfile/reproducible install now that install execution is available;
2. add PostgreSQL integration tests using PostgreSQL 18;
3. add transactionally atomic event + outbox persistence API;
4. add inbox admission/replay repository;
5. add reconciliation/external-receipt repository;
6. add security/approval PostgreSQL persistence and concurrency tests;
7. add OpenTelemetry correlation foundation;
8. add service main/config/shutdown lifecycle;
9. add DB/schema readiness probes;
10. add fault-injection/restart test utilities;
11. close Phase 2 shared-foundation gate before identity/memory/world/product migrations.

## Foundation rules

- no product package may bypass the shared Operation/outbox/current-authority primitives;
- no product feature migration before shared foundation is proven;
- no donor runtime dependency becomes a production kernel;
- no concrete adapter may become canonical domain truth;
- all consequential external effects use OperationId/reconciliation semantics from first implementation;
- every async authority-sensitive mutation rechecks current authority at commit/dispatch;
- migrations remain package-owned even when executed by the shared Postgres adapter.

## Next work

Continue from the first unresolved item above. Do not recreate completed workspace/packages or switch into product-domain features.
