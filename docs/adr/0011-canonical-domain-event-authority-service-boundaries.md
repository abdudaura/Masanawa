# ADR-0011 — Canonical Domain, Event, Authority and Service Boundaries

Status: accepted
Date: 2026-10-01
Phase: 1

## Context

Phase 0 closed donor selection and exhaustive source forensics. The remaining risk before implementation is no longer choosing the wrong donor; it is allowing separate Phase 2 packages/services to invent incompatible meanings for identity, sessions, authority, events, side effects, persistence and service ownership.

The high-level architecture already requires one canonical Masanawa truth, but implementation needs exact stable boundaries.

## Decision

The following Phase 1 specifications are canonical together:

- `docs/DOMAIN-MODEL.md`
- `docs/PACKAGE-BOUNDARIES.md`
- `docs/EVENT-CONTRACTS.md`
- `docs/SECURITY-AUTHORITY.md`
- `docs/DATA-ARCHITECTURE.md`
- `docs/PRIVACY-SCOPES.md`
- `docs/SERVICE-CONTRACTS.md`
- `docs/GOLDEN-JOURNEYS.md`

They refine `docs/ARCHITECTURE.md`; they do not replace its one-truth/domain-owner rules.

## Identity decision

Canonical identities are opaque Masanawa IDs.

External/donor/provider/channel/native IDs remain typed external references.

The following distinctions are mandatory:
- Character != AgentRun/AgentStrategy;
- Relationship != CharacterSession;
- CharacterSession != ChannelSession;
- CharacterSession != PresenceSession;
- WorkflowRun != conversation history;
- Device != User;
- provider receipt/thread/job != canonical domain identity.

## Persistence decision

PostgreSQL owns canonical durable operational state.

Each canonical package owns its tables/migrations/repositories.

Derived indexes/caches/vector stores/provider state/local SQLite/object URLs are projections/adapters unless another ADR explicitly canonicalizes them.

State mutation, required event/audit rows and outbox custody are committed transactionally where they belong to the same domain transition.

## Event/side-effect decision

Commands request work; DomainEvents report committed facts.

Consequential external effects receive one canonical OperationId and durable state.

A timeout/disconnect after dispatch does not authorize a fresh non-idempotent attempt. Unknown/partial outcomes reconcile the same OperationId.

Provider acceptance is evidence, not automatically business completion.

## Authority decision

Routing, model intent, session visibility, provider acceptance and client/device capability claims are not authorization.

Consequential mutations use:
1. admitted AuthorityContext;
2. exact approval where required;
3. current-authority reassertion immediately before mutation/dispatch when authority could have changed during asynchronous work.

Child/handed-off AgentRuns receive an intersected delegation ceiling and cannot widen authority.

## Privacy decision

Authorization/scope filtering runs before retrieval/ranking/context compilation.

Relationship-private state never becomes Character-shared/World/public state by model inference alone.

Perception, memory promotion, handoff and proactivity preserve explicit scope/purpose/permission.

## Service decision

Masanawa begins with coarse services:
- Gateway/API;
- Worker;
- Presence;
- Ops;
- web/Ops clients;
- optional specialized Python/GPU workers.

Package/domain ownership is independent of process placement.

No service or UI may bypass package repositories/authorization and mutate another domain's tables directly.

## Golden-journey decision

The 12 journeys in `GOLDEN-JOURNEYS.md` are architecture acceptance contracts.

They must be tested with:
- privacy/tenant assertions;
- duplicate/retry behavior;
- crash points;
- ambiguous external outcomes;
- stale-worker/current-authority conditions.

A happy-path-only implementation does not satisfy parity.

## Consequences

Phase 2 can create branded IDs, schemas, repositories, services and architecture tests from stable contracts instead of rediscovering semantics.

Provider/channel/device integrations can vary without changing canonical domain identity.

Workflow and outbox recovery can be implemented before product features, reducing later duplicate-side-effect migrations.

## Rejected alternatives

- Let each service define its own IDs/sessions: creates identity drift and channel/provider lock-in.
- Treat provider/channel IDs as canonical: prevents cross-channel/provider continuity.
- Use request timeout as retry signal: unsafe for consequential effects.
- Let RLS/private network placement substitute for application authorization: insufficient current-authority semantics.
- Use model/JEV output as policy or transaction truth: violates deterministic authority/business boundaries.
- Begin Phase 2 without golden recovery contracts: would defer the hardest correctness issues until after feature implementation.
