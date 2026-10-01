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

## Identity slice — implemented, awaiting CI

Implemented through commit `414132b29db8d7262b9237c3729f5e801af30220`:

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

## Identity acceptance gate

Before this slice is considered closed:
- frozen install must remain reproducible;
- strict TypeScript must pass;
- architecture guards must accept the new canonical package and no forbidden dependency;
- unit tests must pass;
- PostgreSQL 18 migration/integration tests must pass;
- production build must include `@masanawa/identity`.

## World slice — next

After identity CI is green:

1. create `@masanawa/world` with public contracts depending only on permitted foundation/identity surfaces;
2. add World/WorldPolicy and monotonic WorldGeneration first;
3. implement durable compare-and-set generation commits;
4. preserve simulation time separately from wall-clock/recorded time;
5. add CharacterLifeState as a world projection keyed by CharacterId, never identity duplication;
6. introduce typed SimulationInput and terminal input outcomes before autonomous routines;
7. prove two workers cannot commit the same expected generation;
8. prove simulation time never moves backward;
9. prove duplicate input/idempotency does not duplicate canonical events;
10. only then add routines/story arcs/canon admission and optional spatial mechanics.

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
