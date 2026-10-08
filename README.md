# Masanawa

Masanawa is the greenfield canonical platform for persistent AI characters, agents, digital humans, skills, tools, world state, multimodal presence, useful work, social activity, commerce and media production.

The platform is a clean implementation of validated capabilities. Donor projects are reference systems, never runtime boundaries.

## Latest mobile product/navigation direction — 2026-10-08

Owner-approved final five-tab shell: **Talks · Chats · Assistant · Wallet · Agents**, with **Assistant centered** and an in-chat Gwani/Gwana switch. There is **no separate Home root**: previous Explore/Live public audio discovery belongs to Talks. Chats is private human messaging; Wallet is finance; Agents retains full Expert/Twin discovery. The target mobile implementation and Android acceptance remain **open/unverified**. Start at `CONTINUE-HERE.md`, then `docs/APP-SHELL-CONTRACT.md`, `docs/END-TO-END-UX-ARCHITECTURE.md`, and `docs/README.md` **before** historic vision/phase/workstream documents. Old phase status and previous bottom-nav guides are historical unless explicitly reconfirmed by current canonical contracts.

## Start here

Every implementation session MUST read:
1. `CONTINUE-HERE.md`
2. `docs/APP-SHELL-CONTRACT.md` and `docs/END-TO-END-UX-ARCHITECTURE.md`
3. `docs/MOBILE-READINESS-PLAN.md` and `docs/COMMUNICATIONS-EXTENSION-PLAN.md`
4. `docs/VISION.md`
5. `docs/PRODUCT-NORTH-STAR.md`
6. `docs/PRODUCT-PROJECT-STRUCTURE.md`
7. `docs/PRODUCTION-MASTER-TASKS.md`
8. `docs/ARCHITECTURE.md`
9. `docs/AGENT-PHONE-EMBODIMENT.md`
10. `docs/TECHNOLOGY.md`
11. `docs/SOURCE-OWNERSHIP.md`
12. `docs/REWRITE-PLAN.md`
13. active files under `docs/migration/` (historic/technical unless scoped by current contract).

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

