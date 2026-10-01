# ADR-0009: Canonical World and Life-State Architecture

Status: Accepted — Phase 0A
Date: 2026-10-01

## Context

Masanawa needs one world model that can support persistent fictional lives, shared events, Character-to-Character interaction, routines/story arcs, optional realtime/spatial simulation and many private user relationships with the same Character.

The pinned donors overlap:
- AI Town provides a mature small shared-world simulation loop with ordered inputs, fixed ticks, generation conflict rejection, transactional state commits, autonomous interactions, spatial movement and engine liveness.
- ChatWithStars provides the stronger Masanawa-domain semantics: versioned Character Constitutions, evolving canon, timezone routines, provenance/visibility, immutable approved life events, tenant isolation and strict private-relationship versus shared-world separation.

Adopting either donor wholesale would violate Masanawa's one-world-model rule.

## Decision

`packages/world` is the sole canonical authority for world and Character life state.

AI Town is the primary **simulation mechanics** donor.

ChatWithStars is the primary **life-state, canon and governance** donor.

Masanawa owns the PostgreSQL persistence model, authorization, event contracts, generation/worker concurrency, projections and integration boundaries.

## Consequences

### Positive

- continuous simulation can use proven ordered-input/tick/generation patterns without making the platform a game;
- fictional canon remains governed and tenant-safe;
- private fan memory cannot become global Character truth by accident;
- spatial simulation is optional rather than structurally mandatory;
- world, memory, workflow, identity and presence each keep one authority;
- horizontal workers can use durable generation/claim semantics rather than process-local locks.

### Costs

- AI Town's Convex engine cannot be imported as the canonical runtime;
- ChatWithStars' current life engine requires concurrency redesign;
- PostgreSQL schemas and workers must implement the combined invariants;
- stochastic/model-generated simulation outcomes require explicit provenance/admission policy.

## Rejected alternatives

### AI Town as the complete world kernel

Rejected because Player/Agent/game-map/Convex assumptions do not represent Masanawa Character identity, privacy scopes, governed canon, multi-tenant product semantics or durable business integrations.

### ChatWithStars life engine unchanged

Rejected because the process-local overlap guard is insufficient for horizontal workers and it lacks AI Town's explicit simulation clock/input/generation mechanics.

### World state inside memory

Rejected. Shared authoritative world truth and private/scoped recollection have different authorization and lifecycle semantics. World events may generate memory candidates, but `packages/memory` remains the memory authority.

### World state inside agent runtime

Rejected. Agents propose/execute behavior; they do not own Character or world truth.

## Follow-up

Implement according to `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md`, then complete the remaining Phase 0A donor/source-map/license/conflict definition-of-done audit before Phase 0B.
