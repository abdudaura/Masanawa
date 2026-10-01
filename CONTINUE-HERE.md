# Continue Here

This is the mandatory handoff entry point for every new Masanawa implementation session.

## Mission

Build Masanawa as one clean canonical platform from the strongest validated capabilities found across the pinned reference source vault.

Do not recreate donor project boundaries. Do not begin application feature implementation while Phase 0 remains open.

## Mandatory read order

1. `README.md`
2. `docs/VISION.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TECHNOLOGY.md`
5. `docs/SOURCE-OWNERSHIP.md`
6. `docs/REWRITE-PLAN.md`
7. `docs/migration/LANDSCAPE-EXPANSION.md`
8. `docs/migration/SOURCE-LOCK.md`
9. `references/README.md`
10. `references/SOURCES.md`
11. `docs/migration/FORENSICS-METHOD.md`
12. `docs/migration/FEATURE-LEDGER.md`
13. `docs/migration/BEHAVIOUR-LEDGER.md`
14. `docs/migration/DATA-LEDGER.md`
15. `docs/migration/INTEGRATION-LEDGER.md`
16. relevant files under `docs/migration/sources/`.

`docs/migration/LICENSE-LEDGER.md` is compliance/provenance metadata and is **not** part of architectural feature selection.

## Current phase

**Phase 3 — Identity and world.**

Phase 0A/0B, Phase 1 and Phase 2 are closed. Phase 2 closure evidence is in `docs/PHASE-2-CLOSURE-AUDIT.md`; Foundation CI run 213 passed the complete `pnpm check` gate on PostgreSQL 18 with 22 test files / 80 tests and production builds.

The active implementation line remains `phase2-closure` until PR #16 is merged. Do not recreate foundation lifecycle/readiness/authentication/recovery work.

## Immediate next work

Phase 3 is active.

Merged Phase 3 slices:
- canonical identity: PR #17, merge `75549800445842f8ff1db54e06529c075ed34ea4`;
- world generation/input foundation: PR #18, merge `871022d03f4b3fb2a81af5c6253dd38bd5b7a27f`;
- governed CharacterLifeState + canon events: PR #19, merge `729ab3e64eb0539ea249ceb6a39cf79afab20cb2`;
- canon policy/time hardening: PR #21, merge `ce89ce091e05508dd4d0614a9127a2256bda13e4`;
- reconciled routines/story arcs: PR #23, merge `4bd9a3a8b2504617291d7e18e992d5f56856886d`;
- authority-bound WorldEvent canon governance: PR #24, merge `9f2574b9d3932079a834c5c2976ee89e2fdcf2cc`;
- canonical WorldInteraction evidence: PR #25, merge `ed186608248659654cdcf23ab8b793dd426fa7ef`;
- executable pause/restart/catch-up recovery: PR #26, merge `bcfe597bd8aa7cb6191bb34fb5c626bbe5884ee0`.

Current implementation branch: `phase3-world-evidence-integrations`.

Current branch closes the non-spatial World evidence integration boundary:
- `packages/memory` and `packages/workflows` remain canonical placeholder boundaries and are not imported/mutated by World;
- World owns a typed `world.evidence.recorded` payload for WorldEvent and WorldInteraction evidence;
- evidence carries canonical IDs, content, provenance, visibility, canon state, occurrence identity and effective/recorded time;
- one durable publication receipt exists per tenant/evidence/publication kind;
- WorldEvent/WorldInteraction admission automatically attempts publication in the same PostgreSQL transaction;
- replay of the same deterministic evidence occurrence reuses the receipt and does not create duplicate downstream events;
- one canonical PlatformEvent is appended through the existing events adapter;
- the event fans out through the existing transactional outbox to `memory.world-evidence` and `workflows.world-evidence`;
- visibility maps to PlatformEvent sensitivity (public→public, private→private, shared/internal→internal);
- World never writes memory/workflow tables and no alternate event bus is introduced;
- PostgreSQL acceptance proves two evidence records + their replays produce exactly two PlatformEvents and four destination outbox rows.

Immediate work:
1. run the complete PostgreSQL 18 CI gate for `phase3-world-evidence-integrations` and fix every real failure;
2. merge only when frozen install, strict typecheck, tests and production builds are green;
3. audit Phase 3 non-spatial acceptance targets against the repository and close any remaining concrete gap;
4. if non-spatial acceptance is complete, record the Phase 3 non-spatial closure boundary before optional spatial work;
5. only then begin optional WorldSpace/location/pathing mechanics if still selected by current repository guidance.

Do not create direct World→Memory or World→Workflow persistence. Those domains consume typed events/outbox deliveries and retain their own canonical authority.

## World simulation comparison — completed

ADR-0009 and `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md` decide:
- `packages/world` is the sole canonical world/life authority;
- AI Town supplies simulation-engine mechanics, not canonical domain objects;
- ChatWithStars supplies life-state/canon/governance semantics;
- durable world generations/claims replace process-local overlap locking;
- simulation time, wall-clock time, validity time and recorded time remain distinct;
- spatial simulation is optional;
- private relationship memory cannot mutate shared canon;
- memory, workflows, identity and presence consume world contracts without becoming world authority.

## Memory comparison — completed

ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md` decide:
- canonical memory record and scope model;
- relationship/private/shared/world separation;
- write/extraction lifecycle;
- provenance/evidence/confidence;
- working-context blocks versus durable memory;
- retrieval, entity/temporal indexing and reranking;
- reflection/consolidation/compaction;
- deletion/retention/tombstones;
- rebuildable vector/graph indexes;
- proactive memory recall versus explicit retrieval;
- evaluation/quality measurement;
- which donor components are safe to reuse directly versus adapt behind `packages/memory`.

Decision: `packages/memory` owns canonical scoped PostgreSQL records, provenance, lifecycle and context compilation. N.E.K.O/Letta Code/Mem0/OpenClaw are bounded donors only. Masanawa's type+scope privacy model remains non-negotiable.

## Non-negotiable rules

- One identity system.
- One memory system.
- One skill system.
- One tool registry.
- One agent execution framework.
- One provider registry.
- One event model.
- One task/workflow engine.
- One world model.
- Channels/device nodes are adapters, not alternate brains.
- Characters are domain entities, not prompts or agent classes.
- Providers/models/UIs never own business truth.
- Consequential side effects require deterministic validation, authorization, idempotency, reconciliation and audit.
- Private relationship memory never silently becomes shared character/world truth.
- Reference submodules are never production imports.
- No donor repository becomes a hidden runtime boundary.
- Licensing/provenance never decides feature survival. Useful donor capabilities remain A/B and are independently rewritten when direct reuse is unsuitable.
- Nothing is migrated without ledger evidence.

## Definition of done for Phase 0A — achieved 2026-10-01

Closure evidence: `docs/migration/PHASE-0A-CLOSURE-AUDIT.md`.

Phase 0A finished because:
- every expanded donor has a source map;
- its major relevant capabilities are represented in the ledgers;
- licenses/provenance are verified;
- the required cross-donor comparisons are complete;
- `docs/SOURCE-OWNERSHIP.md` no longer contains unresolved primary-candidate conflicts for foundation subsystems;
- donor decisions are recorded in ADRs where necessary.

## Definition of done for full Phase 0

Every meaningful capability in the pinned reference vault is classified:
- **A — preserve behaviour**
- **B — preserve capability, redesign implementation**
- **C — reference/retire explicitly**

Every retained capability has one canonical Masanawa destination and an acceptance/parity strategy.

## If context is missing

Do not ask the user to repeat previous discussions. The repository, source lock and reference vault are the source of truth.
