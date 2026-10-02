# Production Project Structure Audit

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

Target adapter families are `adapters/storage`, `adapters/providers`, `adapters/channels`, `adapters/devices`, `adapters/media`, and `adapters/inference`. Adapters implement canonical ports. Adapter-to-adapter hidden orchestration is forbidden.

### 5. Preserve coarse services

Gateway owns ingress/admission/routing/device connection control. Worker owns durable workflows, background AgentRuns, schedules, dispatch and reconciliation. Presence owns realtime media/session transport. Ops owns approvals, audit, reconciliation, fleet/device health and operator controls.

Do not turn each domain package into a network microservice. Empty noncanonical service placeholders are not reserved for future domains; a new deployable service requires an ADR and corresponding architecture-gate update.

### 6. Expand test topology before product complexity grows

Target suites: `tests/contracts`, `tests/integration`, `tests/e2e`, `tests/parity`, `tests/security`, `tests/recovery`, `tests/load`, and `tests/chaos`. Package-local unit tests remain beside source.

Production gates must eventually cover dependency architecture, schema compatibility, tenant isolation, restart/recovery, idempotency/reconciliation, provider/device ambiguity, security abuse cases, load/backpressure, realtime latency and all golden journeys.

### 7. Keep infrastructure vendor-neutral

`infra/*` contains deployment composition, environment schemas and runbooks, never business behavior. Vendor-specific manifests may have explicit subfolders, but domain packages never import them.

### 8. Treat runbooks as production artifacts

Before cutover the repository must contain deployment/rollback, backup/restore, credential rotation, provider outage, device loss/revocation, stuck workflow/reconciliation, incident response, data export/deletion and SLO/alert runbooks.

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