# Phase 2 — Foundation

Status: **CLOSED — PASS**
Started: 2026-10-01
Closed: 2026-10-01
Closure audit: `docs/PHASE-2-CLOSURE-AUDIT.md`

Phase 2 implemented the shared platform foundation required before canonical product-domain work.

The final closure gate passed on Foundation CI run 213 at validated head `580a36cf958bf7d871e6624b02e7498f51e8f96a` using Node 24, pnpm 12.8.2 and PostgreSQL 18. The complete `pnpm check` gate passed with 22 test files / 80 tests plus production builds.

## Closed foundation scope

Implemented and validated:

- strict pnpm/TypeScript monorepo and frozen dependency graph;
- canonical IDs, time, errors and runtime config;
- architecture dependency/import guards;
- PostgreSQL pool/transactions/migrations/readiness;
- package-owned migration hashing and drift refusal;
- PlatformEvent/AuditEvent/Operation/idempotency/outbox/inbox primitives;
- atomic event + outbox persistence;
- leased/fenced worker claims and replay recovery;
- external receipt/reconciliation persistence;
- Principal/AuthorityContext/current-policy/delegation/approval primitives;
- persistent policy revision/revocation/approval state;
- provider-neutral authentication evidence;
- signed/scoped service workload credentials;
- privacy-safe OpenTelemetry correlation foundation;
- Gateway/Worker/Ops health/readiness and production lifecycle;
- web and ops Next.js foundation shells;
- deterministic crash/restart test support;
- PostgreSQL 18 integration coverage for concurrency, recovery and schema integrity.

## Foundation rules carried forward

All later phases inherit these rules:

- no product package may bypass shared Operation/outbox/current-authority primitives;
- no donor runtime dependency becomes a production kernel;
- no concrete adapter may become canonical domain truth;
- consequential external effects use OperationId/reconciliation semantics;
- async authority-sensitive mutation rechecks current authority at commit/dispatch;
- migrations remain package-owned even when executed by the shared Postgres adapter;
- reference source code remains outside production imports;
- public/provider identifiers are evidence or external refs, never implicit canonical identity.

## Recovery note

Foundation CI run 212 detected an incompatible replacement of the established fault-injection API used by PostgreSQL recovery tests. The implementation was corrected by preserving the existing `InjectedCrash/checkpoint/hits/remaining` contract and extending it with bounded restart orchestration. Run 213 then passed.

## Next phase

Proceed to **Phase 3 — Identity and world**.

Read:

1. `docs/PHASE-2-CLOSURE-AUDIT.md`;
2. `docs/DOMAIN-MODEL.md`;
3. `docs/DATA-ARCHITECTURE.md`;
4. `docs/PRIVACY-SCOPES.md`;
5. ADR-0009 and `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md`;
6. relevant ChatWithStars/AI Town source maps and ledger entries.

Phase 3 must create one canonical identity/world implementation. Do not duplicate provider/channel identity, Character truth, Relationship truth, world state or life-state ownership.
