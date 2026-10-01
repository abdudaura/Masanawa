# Phase 3 Non-Spatial Closure Audit

Status: CANDIDATE — requires the full CI gate on `phase3-nonspatial-closure`.

Scope: canonical Identity + non-spatial World/life/canon/recovery/evidence integration.

This audit does **not** close optional spatial mechanics. `WorldSpace`, coordinates,
pathing, collision and location-history mechanics remain a separate optional Phase 3
slice and must not be inferred from this closure.

## Canonical ownership

The implementation preserves the selected Phase 0/1 boundaries:

- `packages/identity` owns Tenant/User/Character/CharacterVersion/Relationship;
- `packages/world` owns World, WorldPolicy, generations, simulation inputs,
  CharacterLifeState, routines, story arcs, WorldEvent and WorldInteraction;
- `packages/events` owns platform-event/outbox custody;
- `packages/memory` remains the sole future memory authority;
- `packages/workflows` remains the sole future durable workflow authority;
- private User↔Character Relationship state is not World truth.

No donor runtime or donor database model is a production authority.

## Merged implementation chain

| Slice | PR | Merge |
| --- | --- | --- |
| Canonical identity | #17 | `75549800445842f8ff1db54e06529c075ed34ea4` |
| World generation/input foundation | #18 | `871022d03f4b3fb2a81af5c6253dd38bd5b7a27f` |
| Governed life/canon | #19 | `729ab3e64eb0539ea249ceb6a39cf79afab20cb2` |
| Canon/time hardening | #21 | `ce89ce091e05508dd4d0614a9127a2256bda13e4` |
| Routines/story arcs | #23 | `4bd9a3a8b2504617291d7e18e992d5f56856886d` |
| Authority-bound canon governance | #24 | `9f2574b9d3932079a834c5c2976ee89e2fdcf2cc` |
| WorldInteraction evidence | #25 | `ed186608248659654cdcf23ab8b793dd426fa7ef` |
| Pause/restart/catch-up | #26 | `bcfe597bd8aa7cb6191bb34fb5c626bbe5884ee0` |
| Evidence→events/outbox boundary | #27 | `426a6689f0839aad3077754a9f947f2abe0ba8d6` |

PR #20 was closed as a duplicate of #19. PR #22 was superseded by the
hardening-preserving reconciliation merged through #23.

## ADR-0009 acceptance matrix

### 1. Two workers cannot commit competing generations — PASS

Evidence:
- World row is locked for generation commit;
- caller supplies `expectedGenerationNumber`;
- exactly one competing writer advances a generation;
- stale writer receives `world.generation_conflict`;
- PostgreSQL integration test launches two competing transactions and asserts one
  success/one failure.

### 2. Simulation time never moves backward — PASS

Evidence:
- `assertSimulationTimeDoesNotMoveBackward`;
- ordinary generation commits reject regression;
- CharacterLifeState effective time cannot regress or exceed current simulation time;
- recovery targets cannot precede current simulation time;
- database recovery metadata has a matching time-order constraint.

### 3. Duplicate routine/input processing does not duplicate authoritative evidence — PASS

Evidence:
- SimulationInput has tenant/world/idempotency-key uniqueness and changed-content
  conflict detection;
- routine occurrence identity is deterministic by Character + routine + local date;
- routine replay returns the existing SimulationInput;
- WorldEvent occurrence keys are unique and changed content conflicts;
- WorldInteraction occurrence keys are unique and changed content conflicts;
- bounded restart/catch-up reuses routine occurrence identities across batches;
- World evidence publication has a durable publication receipt, so evidence replay
  creates neither duplicate PlatformEvents nor duplicate memory/workflow outbox fanout.

### 4. Restart/pause policy behaves according to WorldPolicy — PASS

Evidence:
- active→paused uses World revision CAS;
- ordinary simulation commits fail while paused/stopped;
- `skip` appends a recovery generation to the requested target and preserves queued
  external SimulationInputs;
- `bounded` drains timezone-aware missed routine time-steps up to
  `maxCatchUpSteps`, persists one recovery target, remains paused while incomplete,
  and records every batch as a WorldGeneration;
- `manual` fails closed for operator reconciliation;
- PostgreSQL tests cover all three modes and multi-batch bounded recovery.

### 5. Private Relationship data never leaks into shared World state/evidence — CANDIDATE

Current closure branch adds a package-owned recursive privacy invariant that rejects:
- canonical User IDs;
- Relationship IDs;
- MemoryRecord/MemoryRevision IDs;
- private session/account/credential/device references;
- reserved private-reference JSON field names;
- private canonical IDs embedded inside longer text.

The invariant is applied to:
- external SimulationInput payloads;
- Routine input payloads;
- CharacterLifeState textual projections;
- StoryArc title/summary;
- WorldEvent payloads;
- WorldInteraction payloads and participant roles.

Unit tests prove recursive/embedded detection. PostgreSQL integration tests prove
rejected private references leave no simulation-input/event/routine/life-state/story-arc
rows behind.

This target becomes PASS only after the current branch passes the full CI gate.

### 6. Invalid/unapproved Character identity cannot drive automatic canon — PASS

Evidence:
- automatic WorldEvent canon requires the exact active published CharacterVersion;
- automatic WorldInteraction canon requires the exact active published version for
  every participant;
- automatic canon is additionally WorldPolicy-gated and engine-provenance-only;
- stale CharacterVersion-bound routines fail closed until explicit revision/rebind.

### 7. Approved canon cannot be silently rewritten — PASS

Evidence:
- approved/retired WorldEvent content is immutable by database trigger;
- approved/retired WorldInteraction content is immutable;
- approved WorldInteraction participant membership is immutable;
- authored high-impact WorldEvent approval/retirement uses current AuthorityContext,
  exact ApprovalBinding, allow-once consumption and Operation idempotency;
- direct raw approval/retirement is not exposed from the public PostgreSQL facade.

### 8. Spatial simulation can remain disabled without losing life-state semantics — PASS (non-spatial scope)

Evidence:
- WorldPolicy explicitly carries `spatialEnabled`;
- identity, life state, routines, story arcs, event/interaction canon, governance,
  recovery and evidence fanout all operate with `spatialEnabled: false`;
- no non-spatial lifecycle depends on a coordinate/player/avatar model.

This proves spatial mechanics are optional. It does not claim spatial mechanics have
been implemented.

### 9. World evidence crosses explicit memory/workflow boundaries — PASS

Evidence:
- `packages/world` defines typed `world.evidence.recorded` payloads;
- World does not import or mutate memory/workflow repositories;
- PostgreSQL composition appends one canonical PlatformEvent through the existing
  events adapter;
- the existing transactional outbox fans the event to
  `memory.world-evidence` and `workflows.world-evidence`;
- evidence visibility maps to event sensitivity;
- a publication receipt makes replay idempotent;
- PostgreSQL integration tests prove two evidence records plus replays yield exactly
  two PlatformEvents and four destination outbox rows.

Memory/workflow consumers remain future work inside their own canonical packages.

## Additional production gates already satisfied

Beyond ADR-0009's explicit list:
- canonical CharacterVersion content is immutable after publication;
- Relationship creation is stable/idempotent per tenant/user/character;
- tenant-scoped reads are tested;
- high-impact canon decisions are current-authority and approval bound;
- authored/model/imported evidence does not silently auto-enter canon;
- recovery advances are generation-recorded rather than hidden clock mutation;
- package-boundary tests prevent World from importing memory/workflow implementations;
- migrations are readiness/hash tracked;
- Foundation CI exercises PostgreSQL 18, strict TypeScript, tests and production builds.

## Closure condition

Non-spatial Phase 3 closes only when this branch passes the complete Foundation CI
gate with the new privacy invariant and PostgreSQL leakage fixture.

After closure:
1. do not reopen the non-spatial ownership model without contradictory evidence and
   an ADR;
2. optional spatial mechanics may be implemented behind `WorldPolicy.spatialEnabled`;
3. memory/workflow consumer implementations subscribe to the typed evidence boundary;
4. private Relationship state remains outside World regardless of future features.
