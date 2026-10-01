# World Simulation Adoption Boundary

Status: Phase 0A selected architecture.

Pinned comparison:
- AI Town `8e05997f2409275669c8344b84a51692e83f3f33`
- ChatWithStars `3ab02704118ce3d8f38a423c9a52e9d44a705aeb`

## Decision

Masanawa owns one canonical world/life system in `packages/world`.

AI Town is selected as the primary donor for simulation-engine mechanics. ChatWithStars is selected as the primary donor for governed Character life state, fictional canon and privacy/governance semantics. Neither donor database/object model is canonical.

## Ownership

`packages/world` owns:
- worlds and world policy;
- shared/evolving Character life state;
- world actors and optional spatial state;
- routines, story arcs and governed life-state transitions;
- authoritative world events/interactions;
- simulation inputs, generations/steps and worker claims;
- world-event provenance, visibility, validity and canon lifecycle;
- projections needed for current world context.

It does not own:
- immutable/versioned Character identity: `packages/identity`;
- private relationship memory or durable memories: `packages/memory`;
- task/workflow checkpoints: `packages/workflows`;
- realtime media/presence sessions: presence services;
- financial/provider truth: domain packages such as commerce.

## AI Town behaviors adopted

Preserve or redesign behind Masanawa contracts:
1. ordered per-world simulation inputs;
2. explicit monotonic simulation time;
3. bounded tick/step processing;
4. generation/CAS rejection of overlapping stale simulation workers;
5. transactional commit of a simulation transition and processed-input outcomes;
6. autonomous actor/interaction state machines;
7. optional spatial movement/pathfinding/collision and location history;
8. hot-state versus archived-history separation;
9. pause/inactivity/dead-engine recovery policy.

Do not preserve AI Town's Convex/world-document/Player/Agent object model as platform truth.

## ChatWithStars behaviors adopted

Preserve:
1. Constitution-gated automatic life generation;
2. immutable identity / evolving canon / conversation-local separation;
3. timezone-aware routines;
4. goals, story arcs, narrative state, availability and coarse location;
5. authored/imported/engine provenance;
6. public/internal/private visibility;
7. draft/approved/retired canon lifecycle and immutability after approval;
8. deterministic occurrence keys/idempotency;
9. tenant isolation;
10. private fan relationship state cannot rewrite shared Character/world canon.

Replace its process-local life-engine lock with durable multi-worker claims/generation checks.

## Canonical write model

Every authoritative world mutation enters through a typed `SimulationInput` or governed authoring command. A world transition:
1. resolves current world generation and policy;
2. authorizes tenant/actor/purpose;
3. evaluates due deterministic routines and admitted external inputs;
4. computes bounded state transitions;
5. emits append-only `WorldEvent` / `WorldInteraction` evidence;
6. updates current projections/life state in the same transaction where practical;
7. advances the generation;
8. records input outcomes/idempotency receipts.

Stale generation writers fail and retry from current state; they do not overwrite newer world truth.

## Time model

Keep distinct:
- wall-clock receipt time;
- simulation/effective time;
- event validity interval;
- recorded/committed time.

World policy decides whether a paused world:
- skips elapsed realtime;
- catches up bounded scheduled occurrences;
- replays explicit queued inputs;
- or requires operator reconciliation.

No universal game-style catch-up rule applies to every world.

## Spatial model

Spatial state is optional. `WorldSpace` may provide map/scene/coordinates/pathing, while non-spatial worlds can use semantic/coarse locations only. A Character's canonical identity is never its avatar/player coordinate.

## Canon and stochastic simulation

Random or model-proposed outcomes are proposals until admitted by world policy. Any stochastic choice that becomes authoritative must record enough provenance/seed/decision evidence for audit or deterministic replay where required.

High-impact authored canon uses approval/version rules; routine low-risk simulation may auto-admit under versioned policy.

## Memory boundary

World state and memory are related but not interchangeable.

World events can submit scoped memory candidates. `packages/memory` performs scope authorization, extraction/promotion and persistence. AI Town player memories never bypass that boundary.

Private relationship memories can influence a user's private interaction with a Character but cannot silently mutate shared world canon.

## Workflow and presence boundary

World simulation may emit triggers consumed by `packages/workflows`; workflows own durable business/task execution and side effects.

Presence clients may project world actor/location/activity state, but rooms, participants and avatar sessions are not world truth.

## Initial canonical concepts

- `World`
- `WorldPolicy`
- `CharacterLifeState`
- `WorldActorState`
- `WorldEvent`
- `WorldInteraction`
- `Routine`
- `StoryArc`
- `SimulationInput`
- `SimulationStep`
- `WorldGeneration`
- optional `WorldSpace` / `LocationProjection`

Exact schemas remain Phase 0 implementation work; donor schemas must not be copied wholesale.

## Reuse policy

AI Town is MIT-licensed at the pinned source, but direct code reuse should still be limited to small, well-attributed utilities only where it beats a Masanawa-native implementation. The engine architecture is primarily adapted because Masanawa uses PostgreSQL, different domain entities, multi-tenant authorization and broader non-game semantics.

ChatWithStars code is an internal/domain donor; preserve its tested invariants while normalizing names and boundaries to Masanawa.

## Acceptance targets

Before the world engine is production-ready, tests must prove:
- two workers cannot commit competing generations;
- simulation time never moves backward;
- duplicate routine/input processing does not duplicate canon events;
- restart/pause policy behaves according to world policy;
- private relationship data never leaks into shared world events;
- unapproved/invalid Character identity cannot drive automatic canon;
- approved canon cannot be silently rewritten;
- optional spatial simulation can be disabled without losing life-state semantics;
- world event -> memory/workflow integrations cross explicit typed boundaries.
