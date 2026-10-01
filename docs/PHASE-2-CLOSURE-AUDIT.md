# Phase 2 Definition-of-Done Audit

Date: 2026-10-01

Status: **PASS — Phase 2 shared foundation is closed.**

This audit closes the shared implementation foundation defined by Phase 1. It does **not** claim that Masanawa as a whole is production-ready; Phases 3–14 still implement and verify the canonical product domains and cutover.

## Closure evidence

Final validation before this audit:

- branch: `phase2-closure`;
- validated head: `580a36cf958bf7d871e6624b02e7498f51e8f96a`;
- Foundation CI run: **213**;
- environment: Node 24, pnpm 12.8.2, PostgreSQL 18;
- install: `pnpm install --frozen-lockfile`;
- gate: `pnpm check`;
- result: **PASS**;
- tests: **22 test files / 80 tests passed**;
- production builds: canonical packages/adapters/services plus both Next.js applications passed.

The gate includes strict TypeScript, unit/integration tests, PostgreSQL-backed recovery/concurrency tests, architecture guards, and production builds.

## Phase 1 required-slice audit

| Phase 2 requirement | Repository evidence | Result |
| --- | --- | --- |
| pnpm/TypeScript monorepo foundation | root workspace, frozen lockfile, Node/pnpm pins, strict TypeScript, recursive checks | PASS |
| canonical contracts/IDs/errors/time/config | `packages/contracts` | PASS |
| architecture-boundary tests | `test/architecture/*` including donor-import and package-boundary guards | PASS |
| PostgreSQL migration/repository foundation | `adapters/storage/postgres`, package-owned migrations, PostgreSQL 18 CI | PASS |
| event/outbox/idempotency primitives | `packages/events` + PostgreSQL repositories/migrations | PASS |
| security Principal/AuthorityContext/approval primitives | `packages/security` + security migrations/repositories | PASS |
| Gateway/Worker/Ops bootstrap | Fastify services with health/readiness and production entrypoints | PASS |
| OpenTelemetry correlation foundation | `packages/telemetry` + service ingress correlation | PASS |
| deterministic fault/restart harness | `test/support/fault-injection.ts` plus PostgreSQL crash/restart probes | PASS |
| web/ops foundation shells | `apps/web`, `apps/ops` production Next.js builds | PASS |

## Contracts and configuration

PASS.

`packages/contracts` provides runtime-distinct canonical IDs, time normalization, typed platform errors and runtime configuration primitives. Cross-kind ID confusion is rejected rather than coerced.

Configuration is explicit and validated. Service runtime configuration does not expose raw database connection strings as public runtime state.

## Security and authentication

PASS for the shared foundation.

Implemented evidence includes:

- canonical Principal types;
- immutable AuthorityContext with current-policy checks;
- capability intersection for delegation;
- revocation/expiry enforcement;
- exact ApprovalBinding fingerprints;
- PostgreSQL-persisted policy revision, revocation and approval state;
- serialized allow-once consumption;
- EdDSA workload/service credentials with issuer, audience, tenant, capability, generation, lifetime and key-rotation checks;
- provider-neutral AuthenticationEvidence kept distinct from canonical User identity.

The authentication evidence contract explicitly prevents mutable display aliases or transport subjects from silently becoming canonical identity.

## Durable effects and recovery

PASS.

The foundation establishes one durable side-effect path:

- Operation admission and state machine;
- request fingerprint/idempotency conflict detection;
- transactionally atomic PlatformEvent + outbox persistence;
- leased/fenced outbox claims;
- durable inbox admission and replay tombstones;
- external receipt observations;
- one active reconciliation case per ambiguous Operation;
- append-only/reconcilable evidence.

PostgreSQL integration tests prove stale fences cannot settle newer claims, duplicate/replayed input does not duplicate work, ambiguous operations retain reconciliation custody, and operation identity survives a simulated crash after commit but before response.

## Database and migration readiness

PASS.

Service readiness verifies:

- connectivity;
- PostgreSQL 18;
- migration ledger presence;
- expected package-owned migrations;
- migration content hashes;
- schema currency.

Missing migration state, missing ledger state and hash drift fail readiness closed.

Migrations remain package-owned; the shared PostgreSQL adapter executes them without becoming canonical domain ownership.

## Service lifecycle

PASS.

Gateway, Worker and Ops production entrypoints:

- parse bounded configuration;
- bind/listen through a directly testable runtime boundary;
- handle SIGTERM/SIGINT idempotently;
- enter draining state before close;
- bound graceful shutdown;
- force lingering connections only after the deadline;
- sanitize startup/shutdown errors;
- close database resources after service close.

Health remains process liveness; readiness remains permission to accept work.

## Telemetry and privacy

PASS for the foundation contract.

`packages/telemetry` owns W3C trace continuation and canonical RequestId/CorrelationId normalization. Public callers cannot choose Masanawa's canonical request/correlation IDs. The default telemetry attribute allowlist excludes raw prompts, messages, memory, tool outputs, credentials/tokens and arbitrary caller metadata.

## Architecture integrity

PASS.

Architecture tests prevent:

- production imports from `references/sources`;
- unknown canonical package creation;
- forbidden package dependency direction;
- deep imports that bypass package contracts.

No donor repository is a hidden production runtime boundary. PostgreSQL adapters and service processes do not own domain truth.

## Fault injection and restart support

PASS.

The existing count-based `InjectedCrash` / `checkpoint` contract is preserved because PostgreSQL integration tests already use it as recovery evidence. The harness now also supports bounded runtime recreation through `runRestartScenario`.

The restart helper:

- restarts injected crashes by default, not arbitrary permanent failures;
- bounds retry generations;
- disposes each failed runtime;
- preserves caller-owned durable state across ephemeral runtime recreation;
- preserves both primary and cleanup failures when cleanup also fails.

Fault controls remain test-only and cannot become production orchestration.

## CI/reproducibility

PASS.

Foundation CI uses a frozen lockfile and real PostgreSQL 18. Run 213 passed the complete `pnpm check` gate at validated head `580a36c...`.

The earlier run 212 failed because a new fault-harness implementation accidentally replaced an already-used test contract. That regression was not ignored: the established interface was restored and extended rather than duplicated, and run 213 passed. This is useful closure evidence that the gate catches repository-wide compatibility regressions.

## Deferred work

The following are intentionally **not** Phase 2 blockers because they belong to later canonical domain phases:

- Character/Relationship/World persistence and behavior;
- memory records/projections/retrieval;
- workflow-version/checkpoint domain implementation;
- provider/tool registries and concrete provider adapters;
- channel routing;
- realtime presence;
- financial ledger/domain balance invariants;
- social/studio domains;
- production pilot/cutover.

Their shared prerequisites are now present; they must use these foundation contracts rather than creating parallel primitives.

## Supplemental donors

The post-freeze MemPalace/Paperclip assessment in `docs/migration/POST-FREEZE-SUPPLEMENTAL-DONORS.md` does not reopen Phase 2 or create new runtime dependencies.

- MemPalace is a bounded future donor for memory evidence, retrieval evaluation, temporal/index safety and backend conformance behind `packages/memory`.
- Paperclip is a bounded future donor for agent/workflow/Ops governance, recovery, budgets, secrets, governed MCP/actions, artifacts and sandbox operations behind Masanawa's existing canonical owners.

Neither changes the one-system ownership decisions already frozen.

## Closure decision

Phase 2's shared-foundation gate is satisfied.

Proceed to **Phase 3 — Identity and world**. The first work must implement canonical identity/domain ownership from `docs/DOMAIN-MODEL.md` and the Phase 3 donor/acceptance boundaries without bypassing the foundation event, PostgreSQL, authority, telemetry or recovery contracts.
