# Phase 3 — Identity and world

Status: ACTIVE
Started: 2026-10-01
Active branch: `phase3-identity-world`

Phase 2 shared foundation is closed. This phase implements canonical identity first, then canonical world/life state on those identities.

## Canonical ownership

`packages/identity` owns:
- Tenant;
- User;
- external identity mappings into User;
- Character;
- immutable CharacterVersion / Constitution;
- User↔Character Relationship.

`packages/world` owns:
- World and WorldPolicy;
- CharacterLifeState and WorldActorState projections;
- WorldGeneration;
- SimulationInput/SimulationStep;
- WorldEvent/WorldInteraction;
- routines/story arcs/canon admission;
- optional spatial state.

Forbidden collapses remain:
- provider/channel subject ≠ UserId;
- Agent ≠ Character;
- WorldActor ≠ Character;
- CharacterSession ≠ Relationship;
- relationship-private state ≠ shared Character/world canon.

## Identity slice — merged and validated

Implemented, validated by the full CI gate, and merged in PR #17 at `75549800445842f8ff1db54e06529c075ed34ea4`:

- real `@masanawa/identity` package and production build;
- Tenant/User/Character/CharacterVersion/Relationship domain contracts;
- normalized Constitution containing authored persona, disclosure, language, voice/appearance references and expertise metadata;
- explicit linked/strong external-user evidence requirement;
- repository port owned by the domain package;
- package-owned `0001_identity_foundation.sql`;
- PostgreSQL repository adapter;
- stable tenant-scoped external identity resolution;
- explicit CharacterVersion draft→published→active flow;
- Character revision compare-and-set;
- immutable version content enforced by a database trigger;
- at-most-one stable relationship for one tenant/user/character tuple;
- PostgreSQL integration tests for all of the above.

## Identity acceptance gate — PASS

The identity slice passed frozen install, strict TypeScript, architecture guards, unit/integration tests, PostgreSQL 18 migration tests and production builds before merge.

## World foundation — merged and validated

World foundation merged in PR #18 at `871022d03f4b3fb2a81af5c6253dd38bd5b7a27f`.

Implemented:
1. real `@masanawa/world` package and production build wiring;
2. World/WorldPolicy plus explicit catch-up mode;
3. append-only WorldGeneration history and current generation projection;
4. simulation time kept distinct and prevented from moving backward;
5. CharacterLifeState modeled as a CharacterId-keyed world projection, not Character identity;
6. typed ordered SimulationInput with per-world idempotency key;
7. PostgreSQL generation commit serialized under World row lock;
8. expected-generation conflict rejects overlapping stale workers;
9. input settlement occurs in the same transaction as generation append/current projection advance;
10. PostgreSQL integration test launches two competing transactions and requires exactly one winner;
11. tenant-scoped reads and duplicate-input content conflicts are tested.

The world foundation passed the full CI gate before merge.

## Governed life/canon slice — merged and validated

Merged in PR #19 at `729ab3e64eb0539ea249ceb6a39cf79afab20cb2`, then hardened by PR #21 at `ce89ce091e05508dd4d0614a9127a2256bda13e4`.

Implemented:
- CharacterLifeState writes require the referenced CharacterVersion to remain the Character's active published version;
- life-state writes use explicit expected revision/CAS;
- WorldEvent records carry provenance, visibility, effective time, optional deterministic occurrence key and canon lifecycle;
- automatic-approved Character events fail closed when identity version authority is stale;
- authored events enter draft and require explicit approval;
- deterministic occurrence replay reuses the original event only when canon content matches;
- same occurrence identity with different content conflicts;
- approved/retired canon content is protected by a database trigger from silent rewrite;
- world write contracts accept no Relationship/private-memory input.

Next after green CI:
- merge PR #19;
- add routines/story arcs as governed simulation inputs that produce life-state/event transitions through the existing generation boundary;
- add WorldInteraction evidence;
- define pause/restart/catch-up acceptance tests;
- add optional spatial mechanics only after non-spatial life semantics and recovery are complete.

## Donor boundary

ChatWithStars contributes:
- Constitution-gated life generation;
- authored/evolving/conversation-local separation;
- timezone routines, goals/story arcs, availability/coarse location;
- provenance/visibility and governed canon;
- private relationship/shared-world separation.

AI Town contributes:
- ordered inputs;
- monotonic simulation time;
- bounded steps;
- generation/CAS stale-writer rejection;
- atomic transition + input outcome;
- optional spatial/autonomous mechanics;
- liveness/recovery policy.

Neither donor object model is canonical.


## Routines/story-arcs slice — merged and validated

Merged through PR #23 at `4bd9a3a8b2504617291d7e18e992d5f56856886d` after the reconciled branch passed the complete PostgreSQL 18 CI gate.

The original PR #22 was green on its own pre-hardening base but conflicted after PR #21 merged. This branch reconstructs the routines/story-arcs slice on hardened main rather than overwriting the newer canon/time semantics.

Implemented:
- durable Routine and StoryArc records in the canonical World package;
- Character + exact CharacterVersion binding;
- IANA timezone and HH:MM local-slot validation;
- deterministic per-Character/per-routine/per-local-date occurrence keys;
- routine occurrence admission through canonical SimulationInput idempotency;
- stale CharacterVersion bindings fail closed until explicit routine rebind;
- Routine revision CAS;
- StoryArc revision CAS and forward-only lifecycle;
- one package-owned story-arc transition rule used by adapters;
- PostgreSQL 18 tests for routine replay, timezone slots, version rebinding and story-arc transition/revision behavior;
- PR #21's automatic-canon policy/provenance and life-state time hardening preserved.

Next after green CI:
- merge reconciled routines slice;
- authority-bound approval/retirement for draft canon;
- WorldInteraction evidence;
- executable pause/restart/catch-up with bounded routine recovery;
- optional spatial mechanics only after non-spatial recovery is proven.


## Authority-bound canon governance — merged and validated

Merged through PR #24 at `9f2574b9d3932079a834c5c2976ee89e2fdcf2cc` after the complete PostgreSQL 18 CI gate passed.

Implemented:
- explicit approve/retire world-canon capabilities;
- exact ApprovalBinding over OperationId, principal, action version, WorldEvent resource, arguments fingerprint and risk class;
- current AuthorityContext checks against persistent policy revision/revocation;
- World scope and ApprovalId admission checks;
- allow-once approval consumption in the same transaction as the canon transition;
- operation lifecycle moves to succeeded atomically with the decision;
- safe idempotent replay only when the succeeded operation's exact request/scope binding and resulting canon state still match;
- approved canon can retire but immutable evidence cannot be rewritten or reactivated;
- raw timestamp-only canon decision functions are no longer exported through the PostgreSQL package root or repository facade;
- PostgreSQL tests exercise approve, succeeded replay, retirement and stale-policy failure.

Next:
- full CI and merge;
- WorldInteraction evidence;
- executable pause/restart/catch-up with bounded routine recovery;
- restart/catch-up duplicate-prevention tests;
- optional spatial mechanics only after recovery semantics pass.


## WorldInteraction evidence — merged and validated

Merged through PR #25 at `ed186608248659654cdcf23ab8b793dd426fa7ef` after the complete PostgreSQL 18 CI gate passed.

Implemented:
- canonical WorldInteraction identity and typed structured evidence;
- participant records bind canonical CharacterId to exact CharacterVersionId and require at least two unique Characters;
- deterministic participant normalization;
- provenance, visibility, effective validity, occurrence idempotency and canon lifecycle aligned with WorldEvent;
- automatic interaction canon is engine-only, WorldPolicy-gated and requires every participant's active published CharacterVersion;
- authored/model/imported evidence stays draft rather than bypassing governance;
- occurrence replay is content-exact; changed content under one occurrence key conflicts;
- approved/retired interaction content and participant membership are database-immutable;
- participant rows are normalized relational evidence rather than private Relationship state;
- PostgreSQL tests cover stale CharacterVersion failure, policy/provenance gates, replay, changed-content conflict, draft state, tenant isolation and immutability.

Next after green CI:
- merge WorldInteraction evidence;
- implement executable pause/restart/catch-up policy;
- prove bounded recovery cannot duplicate routine inputs/events/interactions;
- only then add optional spatial mechanics.


## World pause/restart/catch-up — implemented, awaiting CI

Current branch: `phase3-world-recovery-policy`.

Implemented:
- durable pause and in-progress recovery metadata on canonical World;
- revision-CAS pause transition;
- paused/stopped Worlds cannot commit ordinary simulation generations;
- recovery advances are first-class WorldGenerations;
- skip recovery advances the simulation clock without replaying missed routines while preserving admitted external inputs;
- bounded recovery queries timezone-aware routine slots between current simulation time and one persisted recovery target;
- maxCatchUpSteps bounds distinct scheduled time-steps, not routine count, preserving simultaneous occurrences;
- bounded recovery stays paused across incomplete batches and becomes active only on the final batch;
- routine catch-up reuses deterministic occurrence keys, so repeated/restarted recovery cannot duplicate SimulationInputs;
- stale CharacterVersion-bound routines still fail closed through existing routine admission checks;
- manual recovery remains paused and requires explicit operator reconciliation;
- PostgreSQL tests cover paused worker rejection, multi-batch bounded catch-up, no duplicate routine inputs, skip queued-input preservation and manual refusal.

Next after green CI:
- merge recovery policy;
- add any missing explicit memory/workflow integration ports for World evidence;
- close remaining non-spatial Phase 3 acceptance gaps;
- optional spatial mechanics only after those gates pass.
