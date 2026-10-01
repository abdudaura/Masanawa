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

Merged foundation:
- canonical identity: PR #17, merge `75549800445842f8ff1db54e06529c075ed34ea4`;
- world generation/input foundation: PR #18, merge `871022d03f4b3fb2a81af5c6253dd38bd5b7a27f`;
- governed life/canon layer: PR #19, merge `729ab3e64eb0539ea249ceb6a39cf79afab20cb2`, validated by Foundation CI run 225.

Current branch: `phase3-world-canon-hardening`.

Current branch fixes concrete gaps found after PR #19:
- CharacterLifeState effective time may not move backward;
- CharacterLifeState may not become effective after the World's current simulation time;
- automatic-approved canon now requires WorldPolicy.automaticCanonEnabled;
- only engine provenance may use automatic-approved canon; model/authored/imported evidence remains draft/governed;
- PostgreSQL 18 tests cover policy-disabled auto-canon, model-provenance rejection, future life-state rejection and life-state time regression.

Immediate work:
1. run the full CI gate for `phase3-world-canon-hardening` and fix every real failure;
2. merge when green;
3. add authority-bearing world canon governance by composing `AuthorityContext`, current-policy checks and persistent allow-once ApprovalBinding consumption with draft approval/retirement;
4. then implement routines/story arcs as typed, idempotent SimulationInputs producing life-state/event transitions;
5. add pause/restart/catch-up acceptance tests before optional spatial mechanics.

PR #20 was closed as a duplicate after PR #19 merged; do not revive its parallel implementation.

The post-freeze MemPalace/Paperclip assessment remains in `docs/migration/POST-FREEZE-SUPPLEMENTAL-DONORS.md`. Neither is a Phase 3 runtime dependency.

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
