# Production Project Structure Audit

## Twin transformation structure overlay — 2026-10-05

The simplified consumer twin economy does not change the repository topology.
It explicitly reinforces the existing rule: no separate clone runtime, wallet service,
marketplace service, social-feed package or monetization microservice.

Use existing Identity/Memory/Agents/Commerce ownership. New public twin profile,
Credit transfer/gift, attribution, paid voice and owner-access logic belongs inside the
existing canonical packages/services described in
`docs/TWIN-TRANSFORMATION-MASTER-PLAN.md` and
`docs/TWIN-ECONOMY-CONTRACTS.md`.

Status: canonical structure guidance for the production build.

## Decision

The current Masanawa repository does not need a wholesale refactor. Its core shape is correct: one monorepo, domain truth in `packages/*`, coarse deployable processes in `services/*`, product surfaces in `apps/*`, concrete technology in `adapters/*`, and donor code isolated under `references/*`.

The right move is targeted structural hardening, not architectural churn.

## Required adjustments

### 1. Make Devices a canonical domain boundary

The Agent Phone direction introduces durable platform concepts that are not Android adapter details: Device registration, DeviceCapability publication, CharacterDeviceAssignment, lifecycle/revocation, device operation custody references, and health/readiness facts.

`packages/devices` owns those canonical contracts. `packages/security` owns device credentials, pairing authorization and policy. `adapters/devices/android` owns Android/root/Magisk implementation, capability probes, app automation, local queue and hardware integration. OmniSIP stays behind the Android telephony adapter and never owns Character, Workflow or Operation truth.

### 2. Keep only canonical deployable services

The canonical deployable service set is `services/gateway`, `services/worker`, `services/presence`, and `services/ops`, plus specialist GPU/media workers only when justified. Empty ambiguous placeholders such as `services/runtime` and `services/workers` should not survive because they invite duplicate execution ownership.

Agent runtime is a package capability composed by services, not a fifth service merely because `packages/agents` exists.

### 3. Standardize package internals

Production domain packages should converge on a recognizable shape when applicable: public `src/index.ts`, domain model, public contracts/ports, invariants, repository port, internal implementation folder, colocated unit tests, and package-owned migrations. Not every package needs every file; consistency of ownership matters more than ceremonial folders.

`docs/IMPLEMENTATION-TEMPLATES.md` defines the executable package/service baseline, and the architecture suite enforces its non-optional parts.

### 4. Standardize adapter topology

Target adapter families are `adapters/storage`, `adapters/providers`, `adapters/channels`, `adapters/devices`, `adapters/media`, and `adapters/inference`. Adapters implement canonical ports. Adapter-to-adapter hidden orchestration is forbidden. `docs/ADAPTER-TOPOLOGY.md` defines the executable registration/dependency contract. Shared Node process hosting lives under `infra/runtime/node`, not in the adapter tree.

### 5. Preserve coarse services

Gateway owns ingress/admission/routing/device connection control. Worker owns durable workflows, background AgentRuns, schedules, dispatch and reconciliation. Presence owns realtime media/session transport. Ops owns approvals, audit, reconciliation, fleet/device health and operator controls.

Do not turn each domain package into a network microservice. Empty noncanonical service placeholders are not reserved for future domains; a new deployable service requires an ADR and corresponding architecture-gate update.

### 6. Expand test topology before product complexity grows

Target suites: `tests/contracts`, `tests/integration`, `tests/e2e`, `tests/parity`, `tests/security`, `tests/recovery`, `tests/load`, and `tests/chaos`. Package-local unit tests remain beside source. `docs/TEST-TOPOLOGY.md` defines the ownership and CI-gate convention, enforced by `test/architecture/test-topology.test.ts`.

Production gates must eventually cover dependency architecture, schema compatibility, tenant isolation, restart/recovery, idempotency/reconciliation, provider/device ambiguity, security abuse cases, load/backpressure, realtime latency and all golden journeys.

### 7. Keep public compatibility explicit

Workspace root APIs, HTTP major versions, durable/event schema versions and Tool/Provider
domain versions are separate compatibility domains. `docs/API-LIFECYCLE.md` defines
their lifecycle. Architecture tests prevent deep imports; the Contracts suite validates
repository-wide version/deprecation policy.

### 8. Keep infrastructure vendor-neutral

`infra/*` contains deployment composition, environment schemas and runbooks, never business behavior. Vendor-specific manifests may have explicit subfolders, but domain packages never import them.

### 9. Treat runbooks as production artifacts

Before cutover the repository must contain deployment/rollback, backup/restore, credential rotation, provider outage, device loss/revocation, stuck workflow/reconciliation, incident response, data export/deletion and SLO/alert runbooks.

### 10. Keep the mobile app a thin dynamic Character shell

`apps/mobile` is a product surface, not a domain owner. It consumes an authorized
server projection of admin-configured Characters and never compiles a fixed production
agent roster. Character identity/configured role presentation is separate from exact
Skill assignment and authority.

The mobile conversation is the primary work surface: voice, text, durable file/artifact
references, long-work progress, approvals, calls and receipts render in one timeline.
Canonical AgentRun, Workflow, Operation, Skill, Device and file truth remains in their
owning packages/services.

See `docs/MOBILE-AGENT-EXPERIENCE.md` and `docs/AGENT-GATEWAY-CONTRACT.md`.

### 11. Keep creator/reseller economics in canonical owners

The digital-twin/reseller product does not justify a separate marketplace service,
wallet service or clone runtime.

- `packages/identity` owns canonical User/Character identity and the durable basis for
  platform/personal-clone/business ownership classification.
- `packages/agents` owns Character runtime/configuration projections such as presentation,
  Skill assignment and future default platform-agent preferences where appropriate; it
  does not own money or Skill definitions.
- `packages/skills` continues to own Skill/SkillVersion truth, certification, readiness
  and execution composition. Retail price is not Skill truth.
- `packages/commerce` owns Offer/pricing revisions, Customer Credits, Agent Float,
  fulfillment reservations, reseller attribution, commissions, settlement, refunds and
  receipts once those contracts are implemented.
- `packages/workflows` owns durable multi-step fulfillment state.
- Gateway/Worker compose selection and execution but do not invent another ledger or
  catalog.

The originating Character and fulfillment executor are separate facts. A personal clone
may keep the customer relationship while another eligible executor fulfills the work.
Insufficient Agent Float may trigger deterministic fallback without changing the visible
conversation.

Gwani and Gwana are normal platform Characters composed from these same canonical
systems. Both have the same platform/support product role. Gwani is the default
platform/support Character for new users; Gwana is selectable in Settings. Their Bodi
and Sulafat Gemini voice preferences are presentation/provider configuration, not
special identity/runtime branches.

See `docs/CREATOR-CLONE-ECONOMY.md`.

## Target top-level structure

- `apps/`: web, ops.
- `services/`: gateway, worker, presence, ops.
- `packages/`: contracts, events, security, identity, world, memory, decisions, providers, tools, skills, agents, workflows, devices, perception, proactivity, commerce, telemetry, plugins; social/studio packages only if durable reusable domain logic warrants them.
- `adapters/`: storage, providers, channels, devices, media, inference.
- `tests/`: contracts, integration, e2e, parity, security, recovery, load, chaos.
- `infra/`, `docs/`, `references/`.

## Rules that should never be relaxed

- Character is not an AgentStrategy.
- Device is not Character identity.
- A channel account is not Character identity.
- Agent Phone is not a parallel runtime brain.
- Workflow state is not conversation state.
- Memory is not transcript storage.
- Provider is not Tool.
- Skill is not Provider-specific implementation.
- Skill is not a retail price or creator commission.
- Customer Credit, Agent Float and withdrawable earnings are distinct ledger concepts.
- Originating/reseller Character is not necessarily the fulfillment executor.
- Gwani/Gwana product defaults do not create privileged runtime classes.
- Apps do not query domain repositories directly.
- Services compose domain packages; they do not redefine domain truth.
- Adapters depend inward; domain packages never depend on concrete adapters.
- Cross-domain SQL mutation is forbidden.
- Every durable owner has one canonical package.
- No package gains a second scheduler, event bus, memory store or authorization system for convenience.

## Refactor threshold

Refactor only when evidence shows duplicate ownership, cycles, repeated boundary bypasses, materially different scaling/release/SLO requirements, required security isolation, or one package doing two independent domain jobs. Do not refactor merely because a directory becomes large.

## Conclusion

Masanawa's current structure is a strong base. The production-quality path is to preserve it and add disciplined ownership, Devices as a first-class domain, consistent implementation conventions, stronger test gates and explicit operations/runbooks.

This document is governed together with `PACKAGE-BOUNDARIES.md`, `SERVICE-CONTRACTS.md`, `ARCHITECTURE.md`, `PRODUCT-NORTH-STAR.md`, `AGENT-PHONE-EMBODIMENT.md` and `PRODUCTION-MASTER-TASKS.md`.