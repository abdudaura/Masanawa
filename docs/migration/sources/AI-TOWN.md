# Source Map — AI Town

Pinned revision: `8e05997f2409275669c8344b84a51692e83f3f33`.

Status: Phase 0A world-simulation comparison complete.

AI Town is the strongest pinned donor for continuous shared-world simulation mechanics, but it is not Masanawa's canonical world/domain model. Its Convex/game-shaped state is adapted behind `packages/world`; ChatWithStars remains the stronger donor for governed fictional canon and life-state semantics.

## Deep-pass evidence

Primary paths inspected:
- `convex/engine/abstractGame.ts`
- `convex/engine/schema.ts`
- `convex/aiTown/main.ts`
- `convex/aiTown/game.ts`
- `convex/aiTown/world.ts`
- `convex/aiTown/player.ts`
- `convex/aiTown/agent.ts`
- `convex/aiTown/conversation.ts`
- `convex/aiTown/movement.ts`
- `convex/aiTown/schema.ts`
- `convex/agent/memory.ts`
- `convex/crons.ts`

## Strong mechanics to preserve/adapt

### Ordered simulation time and input processing

`AbstractGame.runStep` advances a monotonic simulation clock in fixed ticks, consumes an ordered per-engine input queue, bounds ticks/inputs per step, and commits processed input results together with the world update.

Masanawa should preserve:
- explicit simulation time distinct from wall-clock receipt time;
- monotonically ordered external inputs;
- bounded catch-up work;
- deterministic tick/step boundaries;
- durable input outcome/evidence.

### Overlap rejection and optimistic generation

Each engine has a monotonically increasing `generationNumber`. A step loads an expected generation and the commit rejects stale/overlapping work. Time is also prevented from moving backwards.

This is materially stronger than ChatWithStars' process-local `running` boolean. Masanawa needs a durable world-generation/lease or compare-and-swap boundary so multiple workers cannot author competing world transitions.

### Transactional world commit

AI Town simulates a step in memory, then commits the resulting world diff and completed input outcomes through one authoritative mutation boundary. Deleted active objects are archived during commit.

Masanawa should preserve the transaction concept while normalizing it to PostgreSQL records/events rather than one large Convex world document.

### Autonomous interaction state machines

Agents and players expose explicit state for:
- movement/pathfinding;
- activities;
- invitation/accept/reject;
- walking to another participant;
- conversation participation/typing;
- cooldowns/timeouts;
- one in-progress agent operation;
- remembering a completed conversation.

These are valuable simulation behaviors, but Masanawa must express them as world actors/presence/interactions rather than making `Player` or `Agent` canonical Character identity.

### Spatial simulation

AI Town contributes map/world separation, route finding, collision checks, historical positions and movement interpolation. These should be optional world-space capabilities: Masanawa worlds may be physical/spatial, coarse-location only, or non-spatial.

### Archival interaction graph

Completed conversations/players/agents are archived and `participatedTogether` records prior co-participation. This supports cooldown and future behavior without keeping all history in the hot simulation object.

Masanawa should generalize this into append-only WorldInteraction/WorldEvent evidence and rebuildable relationship projections. It must not become private user-character relationship memory.

### Engine liveness

Worlds can be running, developer-stopped or inactive; cron logic stops inactive worlds and restarts dead worlds. Restart advances simulation time to the present rather than replaying an arbitrarily long stopped interval.

Preserve explicit pause/resume/recovery policy, but make catch-up behavior configurable by world policy because some Masanawa life worlds may require scheduled catch-up events while realtime spatial worlds should skip stale ticks.

## Boundaries / weaknesses

Do not adopt as canonical:
- Convex as the required persistence/runtime;
- one serialized world document as the platform data model;
- `Player` or `Agent` as Character identity;
- game-map coordinates as mandatory world semantics;
- probabilistic invite acceptance via `Math.random()` as deterministic canonical truth;
- memory tables/scopes as Masanawa memory authority;
- two-person conversation assumptions;
- game-specific human-player limits;
- vacuum/replay policy as universal event retention.

AI Town's memory is player-centric and lacks Masanawa's tenant/character/relationship/shared/world authorization model. Its agent cognition therefore remains outside canonical memory ownership.

## Comparison with ChatWithStars

AI Town wins the structural simulation-mechanics lane:
- ordered inputs;
- monotonic simulation clock;
- tick/step engine;
- durable generation conflict rejection;
- transactional step commit;
- spatial movement/collision;
- autonomous interaction state machines;
- simulation liveness/restart.

ChatWithStars wins the governed life/canon lane:
- versioned Character Constitution;
- immutable identity versus evolving canon versus conversation-local state;
- timezone-aware routines;
- active goals/story arcs/narrative state/availability/coarse location;
- authored versus engine-generated provenance;
- public/internal/private visibility;
- draft/approved/retired lifecycle;
- immutable approved canon;
- tenant isolation;
- deterministic routine occurrence keys;
- strict separation of shared character/world truth from private fan relationship memory.

## Selected Masanawa boundary

`packages/world` is the sole canonical owner of world/life state.

Selected composition:
- AI Town — primary simulation-engine mechanics donor;
- ChatWithStars — primary life-state/canon/governance donor;
- Masanawa — canonical PostgreSQL world model, event model, privacy/authorization, worker claims, projections and cross-domain contracts.

The canonical model separates at least:
- `World` / `WorldPolicy`;
- `CharacterLifeState`;
- `WorldActorState`;
- `WorldEvent`;
- `WorldInteraction`;
- `Routine` / `StoryArc`;
- `SimulationInput`;
- `SimulationStep` / generation;
- optional `WorldSpace` / location projection.

World events may produce memory candidates, but `packages/memory` remains the only memory authority. Workflows/tasks may react to world events, but `packages/workflows` remains workflow authority. Identity versions constrain world evolution, but `packages/identity` remains Character identity authority.

See ADR-0009 and `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md`.
