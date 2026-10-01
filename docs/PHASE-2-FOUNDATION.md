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

### service bootstrap

Fastify workspaces now exist for:
- `services/gateway`;
- `services/worker`;
- `services/ops`.

Each has typed TypeBox health/readiness endpoints. Readiness fails closed and sanitizes thrown dependency errors.

## Active foundation gaps

1. validate the new workspace through CI/typecheck/test and repair any compiler/runtime incompatibilities;
2. add deterministic lockfile/reproducible install once install execution is available;
3. add PostgreSQL integration tests using PostgreSQL 18;
4. add transactionally atomic event + outbox persistence API;
5. add inbox admission/replay repository;
6. add reconciliation/external-receipt repository;
7. add security/approval PostgreSQL persistence and concurrency tests;
8. add OpenTelemetry correlation foundation;
9. add service main/config/shutdown lifecycle;
10. add DB/schema readiness probes;
11. add fault-injection/restart test utilities;
12. close Phase 2 shared-foundation gate before identity/memory/world/product migrations.

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
