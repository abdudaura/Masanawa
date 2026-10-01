# Masanawa

Masanawa is the greenfield canonical platform for persistent AI characters, agents, digital humans, skills, tools, world state, multimodal presence, useful work, social activity, commerce and media production.

The platform is a clean implementation of validated capabilities. Donor projects are reference systems, never runtime boundaries.

## Start here

Every implementation session MUST read:
1. `CONTINUE-HERE.md`
2. `docs/VISION.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TECHNOLOGY.md`
5. `docs/SOURCE-OWNERSHIP.md`
6. `docs/REWRITE-PLAN.md`
7. active files under `docs/migration/`.

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

Current phase: **Phase 3 — Identity and world**.

Phase 0 source selection/forensics, Phase 1 architecture specification and Phase 2 shared foundation are closed. Phase 2 closure evidence is in `docs/PHASE-2-CLOSURE-AUDIT.md`.

Phase 3 now implements canonical Character/Relationship identity plus world/life state on top of the shared contracts, persistence, security, recovery and service foundations.
