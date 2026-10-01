# Phase 3 — Identity and world

Status: ACTIVE
Started: 2026-10-01
Active branch: `phase3-world-routines`

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

Merged in PR #19 at `729ab3e64eb0539ea249ceb6a39cf79afab20cb2` after the full PostgreSQL 18 CI gate passed.

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

The governed life/canon slice passed the full CI gate before merge.

## Routines/story-arcs slice — implemented, awaiting CI

Current branch: `phase3-world-routines`.

Implemented:
- durable Routine and StoryArc records in the canonical World package;
- every routine/story arc is bound to a canonical CharacterId plus exact CharacterVersionId;
- IANA timezone validation and exact local HH:MM routine slots;
- deterministic routine occurrence identity from Character + routine key + local date;
- routine occurrences enter through the existing SimulationInput idempotency path;
- duplicate occurrence replay reuses the original input instead of creating parallel life-engine work;
- activating a newer CharacterVersion makes an older routine binding fail closed until explicitly revised/rebound;
- routine updates use expected revision/CAS;
- story arcs use expected revision/CAS and a forward-only lifecycle;
- PostgreSQL tests cover timezone resolution, same-date occurrence replay, wrong-slot rejection, CharacterVersion rebinding, stale revisions, and story-arc backward-transition rejection.

Immediate next:
- run the complete PostgreSQL 18 CI gate and fix all failures;
- merge this slice when green;
- then implement WorldInteraction evidence and executable pause/restart/catch-up policy;
- prove bounded catch-up cannot duplicate routine inputs or canon after restart;
- keep spatial simulation deferred until non-spatial life/recovery semantics are complete.

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
