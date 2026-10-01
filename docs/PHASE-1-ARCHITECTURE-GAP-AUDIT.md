# Phase 1 Architecture Gap Audit

Date: 2026-10-01

Status: CLOSED — all listed gaps are resolved by the Phase 1 specification set and `docs/PHASE-1-CLOSURE-AUDIT.md`.

Phase 0 is closed by `docs/migration/PHASE-0B-CLOSURE-AUDIT.md`. This audit identifies what the current architecture already settles and what must still become implementation-ready before Phase 2.

## Already canonical

The following do **not** need another donor-selection exercise:

- Masanawa owns one canonical platform kernel/domain model.
- Character is not AgentStrategy.
- PostgreSQL is canonical durable operational storage.
- provider/vector/cache/session/donor stores are projections/adapters unless an ADR explicitly says otherwise.
- `packages/memory` is sole canonical memory authority.
- `packages/world` is sole canonical world/life authority.
- `packages/workflows` owns durable orchestration/checkpoint/HITL mechanics while domain packages own their business truth.
- OpenClaw is the Gateway/channel/device architectural donor but not the public multi-tenant security boundary.
- LiveKit Server transports realtime media; LiveKit Agents TypeScript is the primary live agent-session donor beneath Masanawa presence contracts.
- AIRI is the embodiment/client donor, not domain truth.
- plugins register canonical components rather than creating parallel runtimes.
- all consequential side effects require idempotency/reconciliation/current-authority treatment.

## Phase 1 gaps

### P1-G01 — Canonical identifiers and aggregate identity

Missing:
- exact ID types and canonical/external ID distinction;
- aggregate keys/uniqueness;
- stable identity versus version identity;
- tenant ownership on every durable aggregate.

Required artifact:
- `docs/DOMAIN-MODEL.md`.

Gate:
- every Phase 2 table/API/event can name its canonical ID type without inventing one locally.

### P1-G02 — Session taxonomy

Missing:
- precise distinction among relationship, conversation/character session, transport/channel session, PresenceSession, AgentRun and WorkflowRun;
- reset/reconnect/rebind semantics;
- which identifiers survive channel/provider replacement.

Required artifact:
- `docs/DOMAIN-MODEL.md`.

Gate:
- no provider/channel/runtime session ID can accidentally become Character or relationship identity.

### P1-G03 — Package dependency graph

Missing:
- allowed direct package dependencies;
- forbidden imports;
- cross-domain coordination rule;
- service orchestration boundary.

Required artifact:
- `docs/PACKAGE-BOUNDARIES.md`.

Gate:
- architecture-boundary tests can be implemented mechanically in Phase 2.

### P1-G04 — Event, command, outbox and audit envelopes

Current `ARCHITECTURE.md` names event families but not their wire/persistence contract.

Missing:
- canonical envelope fields;
- event identity/causation/correlation;
- actor/authority/provenance;
- schema versioning;
- privacy/sensitivity;
- durable vs ephemeral semantics;
- outbox acceptance/settlement.

Required artifact:
- `docs/EVENT-CONTRACTS.md`.

Gate:
- services can publish/consume events without inventing incompatible metadata.

### P1-G05 — Transaction and side-effect boundaries

Missing:
- transaction ownership for domain mutation + outbox;
- idempotency record semantics;
- effect attempt/receipt/reconciliation states;
- ambiguous external outcome rules;
- retry ownership;
- current-authority recheck timing.

Required artifact:
- `docs/EVENT-CONTRACTS.md` and `docs/SECURITY-AUTHORITY.md`.

Gate:
- "request sent" cannot be modeled as "effect complete";
- crash/restart cannot duplicate consequential side effects.

### P1-G06 — Authentication, authorization and current authority

Current docs list RBAC/scoped auth but not the canonical authority object or revalidation rules.

Missing:
- principal types;
- tenant/user/relationship/device/operator/service grants;
- policy revision/current-authority assertions;
- delegated child-run authority;
- approval binding;
- revocation behavior.

Required artifact:
- `docs/SECURITY-AUTHORITY.md`.

Gate:
- every consequential mutation has a deterministic authorization input and a pre-commit current-authority check where policy may change asynchronously.

### P1-G07 — Persistence schema boundaries

Missing:
- which aggregates own normalized tables;
- canonical vs projection tables;
- cross-package FK policy;
- optimistic concurrency/version columns;
- append-only ledgers/audit;
- soft delete/retention expectations;
- migration ownership.

Required artifact:
- `docs/DATA-ARCHITECTURE.md`.

Gate:
- Phase 2 migration layout does not recreate donor databases or cross-package table ownership.

### P1-G08 — Service/API boundaries

Missing:
- initial deployable services;
- package-only versus service-owned functionality;
- synchronous API vs async workflow/event calls;
- internal service authentication contract.

Required artifact:
- `docs/SERVICE-CONTRACTS.md`.

Gate:
- Phase 2 can bootstrap services without later moving domain truth between processes.

### P1-G09 — Privacy and scope contracts

High-level memory privacy is settled but exact relationship/world/organization/task crossing rules are not yet encoded.

Required:
- explicit MemoryScope/WorldScope/RelationshipScope rules;
- context compiler input authorization;
- shared-world publication rule;
- consent/perception scope propagation.

Required artifact:
- `docs/PRIVACY-SCOPES.md`.

### P1-G10 — Golden journey acceptance contracts

The rewrite plan names 12 journeys but does not define preconditions, invariants, crash points and evidence.

Required artifact:
- `docs/GOLDEN-JOURNEYS.md`.

Gate:
- every journey has observable success, privacy, idempotency/recovery and authority assertions.

## Execution order

1. Domain model and identifiers.
2. Package boundaries.
3. Event/transaction contracts.
4. Security/current-authority model.
5. Data architecture.
6. Privacy scopes/context compiler.
7. Service contracts.
8. Golden journeys.
9. Cross-document consistency audit.
10. Phase 1 closure audit.

## Non-goals

Phase 1 does not:
- implement production services;
- write provider adapters;
- port donor runtime code;
- choose vendors that remain intentionally abstracted;
- reopen Phase 0 donor selection without contradictory evidence.

## Phase 1 closure gate

Phase 1 passes only when:
- every canonical aggregate and ID has one owner;
- package dependencies are enforceable;
- events/outbox/side effects have exact state semantics;
- authority/revocation/approval rules are implementation-ready;
- canonical persistence/projection boundaries are explicit;
- services expose typed responsibilities without duplicating domain state;
- privacy scopes are deterministic;
- all 12 golden journeys are specified with recovery and security assertions;
- no Phase 0 A/B invariant is silently lost.
