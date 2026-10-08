# Masanawa

## Owner-approved implementation kickoff (2026-10-08)

**Planning handoff complete, implementation can begin in parallel.** Read [Definitive implementation kickoff](docs/IMPLEMENTATION-KICKOFF-20261008.md), [full requirements-release crosscheck](docs/REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md), the [77 traced requirements](docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md) and [11 integrated journeys](docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md). These take precedence over older phase/reference reading lists for current consumer UX. A new window must claim one **available** R/C lane and preserve existing PRs/leases. Five bottom tabs: **Talks · Chats · Assistant · Wallet · Agents** (one switchable Gwani/Gwana Assistant chat in center).

**Docs ≠ shipped feature:** source drafts #468 (C01) and #435 (profile) require test/integration and share Gateway file surfaces; #467 is unmerged messaging reference docs; CI #457/#460 is a verified Actions quota blockade. All implementation and release evidence remains distinct from this design handoff.


Masanawa is the greenfield canonical platform for persistent AI characters, agents, digital humans, skills, tools, world state, multimodal presence, useful work, social activity, commerce and media production.

The platform is a clean implementation of validated capabilities. Donor projects are reference systems, never runtime boundaries.

## Latest mobile product/navigation direction — 2026-10-08

Owner-approved final five-tab shell: **Talks · Chats · Assistant · Wallet · Agents**, with **Assistant centered** and an in-chat Gwani/Gwana switch. There is **no separate Home root**: previous Explore/Live public audio discovery belongs to Talks. Chats is private human messaging; Wallet is finance; Agents retains full Expert/Twin discovery. The target mobile implementation and Android acceptance remain **open/unverified**. Start at `CONTINUE-HERE.md`, then `docs/APP-SHELL-CONTRACT.md`, `docs/END-TO-END-UX-ARCHITECTURE.md`, and `docs/README.md` **before** historic vision/phase/workstream documents. Old phase status and previous bottom-nav guides are historical unless explicitly reconfirmed by current canonical contracts.

## Start here — **operative order**, not the historical phase checklist

Every independent R/C implementation window **MUST** read:
1. `CONTINUE-HERE.md`
2. `docs/APP-SHELL-CONTRACT.md` and `docs/END-TO-END-UX-ARCHITECTURE.md`
3. `docs/IMPLEMENTATION-KICKOFF-20261008.md` and `docs/REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md`
4. `docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md` and `docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md`
5. `docs/MOBILE-READINESS-PLAN.md` and `docs/COMMUNICATIONS-EXTENSION-PLAN.md`
6. `docs/MULTI-WINDOW-WORK.md` and relevant domain-specific contracts.

Older architectural/internal references (`docs/VISION.md`, `docs/PRODUCT-PROJECT-STRUCTURE.md`, `docs/PRODUCTION-MASTER-TASKS.md`, `docs/ARCHITECTURE.md`, `docs/AGENT-PHONE-EMBODIMENT.md`, `docs/TECHNOLOGY.md`, `docs/SOURCE-OWNERSHIP.md`, `docs/REWRITE-PLAN.md`, and `docs/migration/`) remain valuable **as historical evidence or domain references**, but **do not overrule** today's five-tab consumer contracts, R01–R19/C01–C08 ownership, or verified live branch status. Read only those relevant to the claimed work.

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

## Current product and delivery status — 2026-10-08

The **approved final customer Android navigation** is **Talks · Chats · Assistant · Wallet · Agents**, with Assistant at the center, and one Gwani/Gwana private chat with an in-chat switch. Existing Flutter code and Android releases **have not yet been verified against this target**. The active consumer readiness work is **R01–R19** plus **C01–C08**; `docs/MOBILE-READINESS-PLAN.md` and `docs/COMMUNICATIONS-EXTENSION-PLAN.md` own acceptance, while `CONTINUE-HERE.md` and `docs/MULTI-WINDOW-WORK.md` own handoff and active nonoverlapping workstream claims. Shared Actions incident #457 still requires independent executable CI qualification.

The original **Phase 7 agent runtime / 150-task ledger** reflects internal foundation history and may remain relevant to specialized subsystems, but **must not restart or supersede the owner-approved mobile product and R/C readiness ledger**. Internal implementation evidence and financial/provider/device evidence must be confirmed separately before release.
