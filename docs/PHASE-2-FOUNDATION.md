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

Foundation CI now boots pnpm before Node package-manager integration and runs the actual root `pnpm check` under Node 24.

Validated on 2026-10-01 by Foundation CI run 49 at commit `68ebe1bf8c0c18f2a2deb52904f31d75a96261d0`: install, strict TypeScript checks and Vitest all passed.

Validation also fixed:
- `PlatformError` optional metadata under `exactOptionalPropertyTypes` without weakening compiler strictness;
- PostgreSQL `transitionOperation` now enforces the canonical Operation state graph before issuing SQL;
- direct tests cover the persisted transition guard and PlatformError serialization contract;
- root Vitest discovery includes package, adapter, service, application and architecture suites instead of silently omitting edge-layer tests.

### Reproducible installs

The pnpm 12.8.2 dependency graph is committed in `pnpm-lock.yaml`. Foundation CI enables pnpm caching from that lockfile and installs with `pnpm install --frozen-lockfile`.

Validated on 2026-10-01 by Foundation CI run 54 at commit `b407ca04c38d801d1f7cba3fe024f87477d6f3d3`.

### PostgreSQL 18 integration

Foundation CI now boots an actual PostgreSQL 18 service and exposes it only to the test process through `MASANAWA_TEST_DATABASE_URL`.

The adapter integration suite proves:
- the expected PostgreSQL major version is in use;
- package-owned migrations apply and replay idempotently;
- idempotent Operation admission survives independent transactions;
- changed request fingerprints conflict durably;
- stale persisted Operation transitions are rejected;
- stale outbox worker fences cannot settle a newer claim.

Validated on 2026-10-01 by Foundation CI run 59 at commit `cef46a666606f21e78ea1d478e901262b70d25ed`.

### Atomic platform event + outbox persistence

`adapters/storage/postgres` now provides:
- `appendPlatformEvent` for callers already inside a canonical domain transaction;
- `appendPlatformEventWithOutbox` for composing event + publication custody into that same transaction;
- `persistPlatformEventWithOutbox` as a transaction-owning convenience boundary.

Outbox metadata is derived from the canonical PlatformEvent envelope rather than accepted as a second independent identity source.

PostgreSQL 18 integration proves both successful joint commit and rollback of an already-inserted event when the outbox portion fails.

Validated on 2026-10-01 by Foundation CI run 63 at commit `7d36285b55120776fe659e71457a323c158e8cf6`.

### Inbox admission/replay recovery

`packages/events/migrations/0002_inbox_leases.sql` and the Postgres inbox repository now provide:
- tenant-scoped durable replay identity;
- same-identity payload-hash conflict detection;
- durable processing lease owner/expiry;
- attempt/fence increments on claim and reclaim;
- expired-lease rejection at settlement;
- SKIP LOCKED batch claims;
- completed tombstones that remain deduplicated after restart.

Integration coverage proves the same provider event ID can exist independently in two tenants, duplicate evidence is reused, changed evidence conflicts, an expired worker loses settlement authority, another worker can reclaim with a new fence, and completed work is not reclaimed.

Validated on 2026-10-01 by Foundation CI run 73 at commit `807a5853f352864f7daab8ef7ae701c619df5090`.

### External receipts and reconciliation

The event contract now defines the reconciliation lifecycle. `packages/events/migrations/0003_receipt_reconciliation_integrity.sql` and the Postgres repositories add:
- stable observation-key idempotency for immutable external receipt observations;
- multiple observations for one provider transaction/reference;
- database-enforced tenant/OperationId integrity for idempotency, receipts and reconciliation;
- receipt evidence conflict detection;
- one active reconciliation case per Operation;
- atomic `unknown|partial -> reconciling` admission under an Operation row lock;
- canonical reconciliation state transitions and stale-transition rejection.

Integration coverage proves observation reuse/conflict, append-only status observations, cross-tenant rejection, active-case reuse, Operation reconciliation custody and resolved timestamps.

Validated on 2026-10-01 by Foundation CI run 81 at commit `354aaed14f24884138f0eee45ce421907e2c7757`.

### Security/approval persistence

`packages/security/migrations/0001_security_foundation.sql` and `0002_approval_operation_integrity.sql` now persist:
- current tenant policy revision;
- durable AuthorityContext revocations;
- exact Approval bindings and lifecycle state;
- tenant-scoped Approval → Operation integrity.

The PostgreSQL security adapter:
- exposes a transaction-bound `CurrentAuthoritySource`;
- locks current policy state while authority-sensitive decisions settle;
- stores only pending approvals initially;
- settles pending approvals only while unexpired and still bound to the current policy;
- row-locks approvals before allow-once consumption;
- rechecks both the exact binding and current policy before consumption.

PostgreSQL 18 integration proves concurrent allow-once consumption has exactly one winner, revocation blocks subsequent current-authority checks, stale policy revisions fail closed, and approval persistence remains bound to the exact tenant Operation.

Validated on 2026-10-01 by Foundation CI run 85-equivalent latest green run at commit `7fd3ac3971073f28aaad56bb6c4af22c0975db82` (15 test files / 44 tests).

### OpenTelemetry correlation foundation

`packages/telemetry` now owns the privacy-safe correlation contract used at service boundaries:
- W3C `traceparent` parsing, validation, continuation and injection;
- fresh canonical RequestId/CorrelationId admission by default;
- explicit opt-in before trusted internal boundaries may reuse caller-supplied canonical IDs;
- optional OperationId/TaskId/WorkflowRunId/CharacterSessionId linkage;
- OpenTelemetry-compatible `trace_id`, `span_id` and `trace_flags` log fields;
- a strict default attribute allowlist that excludes raw prompts, messages, memory, tool output, credentials/tokens and arbitrary caller metadata.

Gateway, Worker and Ops ingress now normalize and return correlation headers. Gateway integration coverage proves public callers cannot spoof canonical request/correlation IDs while a valid remote W3C trace is continued with a new span.

Implementation through commit `9be50cbdb25c426b3cfaaa33e288b6fab41ad34e`; latest Foundation CI validation for this slice was not observable through the current GitHub connector at handoff time.

### Provider-neutral authentication evidence

`packages/security` now defines authentication evidence separately from canonical identity:
- stable issuer/subject evidence with explicit authentication method and strength;
- bounded, normalized metadata that never becomes a canonical UserId by implication;
- expiry/currentness validation that fails closed;
- explicit linkage strength before evidence may resolve canonical identity.

This keeps OAuth, channel transports, operator sessions, device keys and service credentials behind one security contract while preserving the rule that provider aliases are evidence, not identity truth.

### Production service lifecycle and schema readiness

The Node runtime adapter and all three foundation services now provide production entrypoints with:
- explicit environment/config parsing and validated listen configuration;
- idempotent SIGTERM/SIGINT handling;
- draining before close and bounded graceful shutdown;
- sanitized startup/shutdown failures;
- direct testability without binding production ports.

PostgreSQL service readiness now verifies connectivity, PostgreSQL 18, the package-owned migration ledger, expected migration hashes and schema currency. Missing ledgers, missing migrations and hash drift fail readiness closed.

### Deterministic fault/restart test support

`test/support/fault-injection.ts` now provides a test-only deterministic fault injector and bounded restart scenario harness. It can crash at exact named occurrences, recreate ephemeral runtime generations without resetting caller-owned durable state, refuse non-restartable failures by default, cap restart loops and preserve cleanup failures alongside the original runtime failure.

This support stays outside production packages so fault controls cannot become a runtime dependency or alternate orchestration system.

## Active foundation gaps

1. validate the authentication + lifecycle/readiness + deterministic restart support together in Foundation CI;
2. perform the Phase 2 shared-foundation closure audit and close any concrete gate failures before identity/memory/world/product migrations.

## Foundation rules

- no product package may bypass the shared Operation/outbox/current-authority primitives;
- no product feature migration before shared foundation is proven;
- no donor runtime dependency becomes a production kernel;
- no concrete adapter may become canonical domain truth;
- all consequential external effects use OperationId/reconciliation semantics from first implementation;
- every async authority-sensitive mutation rechecks current authority at commit/dispatch;
- migrations remain package-owned even when executed by the shared Postgres adapter.

## Next work

Run the current `phase2-closure` branch through the full Foundation CI gate. Fix any typecheck, unit, PostgreSQL 18 integration or build failure rather than weakening the gate. When green, write the Phase 2 closure audit against the implemented repository and move forward only if no shared-foundation blocker remains.
