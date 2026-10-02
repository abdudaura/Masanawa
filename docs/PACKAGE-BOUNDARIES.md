# Package Boundaries and Dependency Rules

Status: Phase 1 canonical draft.

This document turns the one-truth rule into enforceable package dependency constraints for Phase 2.

## Layering

Allowed direction:

`apps -> services -> domain packages -> contracts/utilities`

Provider/channel/device implementations sit at edges and depend inward on contracts. Domain packages do not import adapters.

## Canonical packages

- `packages/contracts` — shared branded IDs, errors, pagination, time, request/event primitives; no domain behavior.
- `packages/events` — event/audit/outbox envelopes and publication contracts.
- `packages/security` — principals, authority, approvals, secret refs, policy checks, network/file execution guards.
- `packages/identity` — Tenant/User/Character/CharacterVersion/Relationship.
- `packages/world` — World/WorldGeneration/WorldEvent/shared life state.
- `packages/memory` — canonical memory records/revisions/scopes and authorized retrieval.
- `packages/decisions` — bounded typed JEV-style decisions; no side-effect authority.
- `packages/tools` — atomic tool contracts/executor/idempotency-facing operation bridge.
- `packages/skills` — Skill/SkillVersion/certification/dependency execution plans.
- `packages/agents` — CharacterSession, AgentRun, strategies, context compiler orchestration.
- `packages/workflows` — Workflow/WorkflowVersion/WorkflowRun/Task/checkpoints/HITL/scheduler.
- `packages/devices` — Device/DeviceCapability/CharacterDeviceAssignment/device lifecycle and device-operation custody contracts; concrete Android/OmniSIP behavior remains adapter-side.
- `packages/providers` — provider-neutral inference/media/search/speech/embedding contracts and configured Provider records.
- `packages/perception` — normalized permission-scoped PerceptionEvent contracts.
- `packages/proactivity` — proactive trigger policy and quiet/frequency/privacy gates.
- `packages/commerce` — quotes/payments/ledger/fulfillment/reconciliation domain truth.
- `packages/telemetry` — privacy-safe trace/evaluation contracts.
- `packages/plugins` — plugin manifests/registration/lifecycle; registration only.
- optional domain packages introduced by ADR: social/studio if they require reusable domain logic rather than service-only orchestration.

## Dependency rules

### contracts

May import: pure third-party schema/utility dependencies only.

Must not import any Masanawa domain package.

### events

May import:
- contracts.

Must not import identity/memory/world/workflows/tools/providers implementations.

Events carry typed references but do not own domain transitions.

### security

May import:
- contracts;
- events for audit contract types only.

May define generic scoped-resource references without importing every domain package.

Domain-specific authorization adapters may live in the owning domain package or a service composition layer.

### identity

May import:
- contracts;
- events;
- security contract types.

Must not import agents, memory, world, workflows, channels, providers.

### world

May import:
- contracts;
- events;
- security contract types;
- identity identifiers/contracts only through explicit narrow public surfaces.

Must not import memory/agents/providers/channel adapters.

World may emit evidence for memory/agents through events, never direct mutation.

### memory

May import:
- contracts;
- events;
- security;
- narrow identity/world/task reference contracts.

Must not import agents/providers/channel implementations.

Retrieval provider/index adapters depend on memory interfaces, not vice versa.

### decisions

May import:
- contracts;
- telemetry contract types.

Must not import tools/workflows/providers directly.

Decision outputs are proposals/evidence, not permission or side effects.

### providers

May import:
- contracts;
- security secret-reference/network-policy contracts;
- telemetry interfaces.

Must not import Character/Relationship/World/Commerce domain implementations.

### tools

May import:
- contracts;
- security;
- events;
- provider contracts.

Must not import skills or agents.

A tool may invoke provider adapters but does not decide business workflow transitions.

### skills

May import:
- contracts;
- security policy types;
- tools public contracts;
- workflows public definition primitives where needed.

Must not import channel/provider concrete implementations.

### workflows

May import:
- contracts;
- events;
- security;
- tools public execution contract;
- decisions public contract.

Must not own Commerce/World/Memory business truth. Domain packages/services supply deterministic transition handlers.

### agents

May import:
- contracts;
- identity public read contracts;
- memory authorized query contracts;
- world authorized read contracts;
- decisions;
- skills;
- workflows task references;
- providers public inference contracts;
- security.

Agents must not mutate financial/world/memory truth through hidden direct database access.

### devices

May import:
- contracts;
- events;
- security contract types;
- narrow identity identifiers;
- Tool/Provider capability identifiers through public contracts where required.

Must not import Android/OmniSIP/channel implementations, Agent runtime internals, Memory repositories or Workflow repositories.

Device is a canonical execution-node identity and assignment boundary; it is never Character identity or a second agent brain.

### perception

May import:
- contracts;
- security;
- events.

Device/channel adapters depend on perception; perception does not import them.

### proactivity

May import:
- contracts;
- security;
- events;
- workflow trigger contracts;
- narrow relationship/world/task read interfaces.

It does not send messages or execute business side effects directly.

### commerce

May import:
- contracts;
- events;
- security;
- workflow/tool/provider interfaces as ports.

Commerce owns its own transaction state and ledger.

### plugins

May import:
- contracts;
- registration interfaces for tools/skills/providers/events/security.

Plugin lifecycle must not import domain repositories or become a second service locator.

## Services

Services compose packages and adapters.

Initial service responsibilities should remain coarse:

- Gateway/API service: auth, channel/web ingress, routing, public/internal APIs.
- Worker service: workflows/tasks/background agent execution/outbox reconciliation.
- Presence service: realtime/WebRTC/media/live agent bridge.
- Ops service/API: operator actions, diagnostics, readiness, approvals.
- optional specialized GPU/media workers through versioned job contracts.

A service process may host several packages. Package ownership is logical/domain ownership, not a requirement for one microservice per package.

## Cross-domain coordination

Direct cross-package database mutation is forbidden.

Use one of:
1. synchronous typed domain port when the operation belongs in one transaction and ownership is clear;
2. workflow transition coordinating several domain owners;
3. transactional outbox/event for asynchronous propagation;
4. read projection for derived UI/search needs.

Examples:
- Memory does not update World directly; it may emit evidence.
- World does not copy private Relationship state.
- Agents request Commerce workflow action; they do not write payment rows.
- Channel ingress resolves identity then invokes agent/workflow APIs; it never writes memories directly.

## Repository access

Each canonical package owns its repository interfaces and migrations.

Other packages may not import its database repository implementation or execute SQL against its tables.

Shared query/read models belong in explicit projection packages/services, not ad-hoc cross-domain joins embedded everywhere.

## Adapter rule

Concrete adapters live outside canonical domain packages when they bind external technology, for example:

- `adapters/providers/*`
- `adapters/channels/*`
- `adapters/devices/*`
- `adapters/storage/*`
- `adapters/media/*`

Exact folder naming may be finalized in Phase 2, but dependency direction is fixed: adapters depend on canonical ports.

## Plugin rule

Plugins package registrations.

They may register:
- tool implementations;
- skills;
- provider adapters;
- event handlers;
- Ops UI extensions.

They may not:
- define an alternate User/Character identity store;
- define a parallel memory authority;
- create a private workflow scheduler outside `packages/workflows`;
- bypass security/current-authority checks;
- reach domain tables directly unless an explicitly owned extension schema is approved.

## Forbidden dependency patterns

- identity -> agents
- identity -> channels
- memory -> provider concrete SDK
- world -> memory repository implementation
- workflows -> commerce repository implementation
- agents -> channel implementation
- agents -> provider SDK directly
- devices -> Android/OmniSIP concrete implementation
- plugins -> domain database repositories
- apps -> database repositories
- adapters -> other adapters as hidden routing authority
- circular dependencies between domain packages

## Enforcement in Phase 2

Architecture tests must:
- parse TS import graph;
- maintain an allow/deny matrix matching this document;
- reject circular package dependencies;
- reject imports from another package's `internal` or repository/migration paths;
- reject domain imports of concrete adapters;
- reject apps importing database repositories;
- require public package entrypoints for cross-package use.

Exceptions require an ADR and an updated matrix before merge.


## Production structure companion

`docs/PRODUCT-PROJECT-STRUCTURE.md` records the production repository topology and refactor thresholds. `docs/PRODUCTION-MASTER-TASKS.md` is the canonical numbered completion ledger.
