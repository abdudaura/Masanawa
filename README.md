# Masanawa

Masanawa is the greenfield canonical platform for persistent AI characters, agents, digital humans, skills, tools, world state, multimodal presence, useful work, social activity, commerce and media production.

The platform is a clean implementation of validated capabilities. Donor projects are reference systems, never runtime boundaries.

## Start here

Every implementation session MUST read:
1. `CONTINUE-HERE.md`
2. `docs/VISION.md`
3. `docs/PRODUCT-NORTH-STAR.md`
4. `docs/PRODUCT-PROJECT-STRUCTURE.md`
5. `docs/PRODUCTION-MASTER-TASKS.md`
6. `docs/ARCHITECTURE.md`
7. `docs/AGENT-PHONE-EMBODIMENT.md`
8. `docs/TECHNOLOGY.md`
9. `docs/SOURCE-OWNERSHIP.md`
10. `docs/REWRITE-PLAN.md`
11. active files under `docs/migration/`.

## Reference source vault

All admitted donor/reference repositories are pinned as Git submodules under `references/sources/`.

Clone with:

```bash
git clone --recurse-submodules --shallow-submodules <repo-url>
```

See `references/README.md` and `docs/migration/SOURCE-LOCK.md`.

The reference vault is deliberately outside `apps/`, `services/` and `packages/`; production Masanawa code must not import it.

Post-freeze candidate assessments may exist without being admitted to the vault. They do not become runtime dependencies merely because they are useful donors.

## Governing rule

> Masanawa is not a merger of repositories. It is one clean implementation of the union of validated capabilities. Source repositories are specifications and donors, not architecture boundaries.

## Status

Current phase: **Phase 7 — Agent runtime**.

Phase 0 source selection/forensics, Phase 1 architecture, Phase 2 foundation, the non-spatial Phase 3 Identity/World core, Phase 4 Memory, Phase 5 Tools/Providers and Phase 6 Skills are closed. Tasks 001-071 are merged complete. Current: Task 072 of 150 — Implement AgentRun identity, lineage and durable trace references. The canonical current status and remaining acceptance criteria are in `docs/PRODUCTION-MASTER-TASKS.md`; recover from `CONTINUE-HERE.md` before changing code.

