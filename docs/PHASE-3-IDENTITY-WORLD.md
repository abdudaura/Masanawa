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

## World foundation — implemented, awaiting CI

Current branch: `phase3-world-foundation`.

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

Next after green CI:
- governed CharacterLifeState mutation;
- append-only WorldEvent/WorldInteraction evidence;
- Constitution-gated canon admission with provenance/visibility;
- routines/story arcs;
- optional spatial mechanics only after non-spatial life semantics are complete.

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
