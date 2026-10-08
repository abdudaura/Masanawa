# Unified navigation / interaction architecture review (2026-10-08)

- Owner/window: current product/UX architecture documentation window (not an implementation code lane).
- Branch: `docs/final-navigation-ux-architecture-20261008`; base: `main` at `caa8d0e0a58f3863ccc87e162914849660c056d6`.
- Scope: documentation-only review and target UX design across R01–R19 and C01–C08. Owned new files: `docs/workstreams/ux-architecture-20261008.md` and `docs/END-TO-END-UX-ARCHITECTURE.md`; narrow cross-references to canonical docs only after fresh SHA/overlap checks.
- Product decision requested: remove downstream redesign/rework risk by deciding final consumer information architecture and interaction/action placements before coding C01–C08.
- Existing shipping shell is Home · Agents · Wallet · Talk; candidate proposed replacement requires explicit integrated R17/C08 navigation decision, not a unilateral application change.
- Overlap boundaries: do not edit Flutter root shell/router, common UI, Gateway, financial ledger, migrations, provider, agent runtime, CI, or any active R or C code lane. No source changes or approval of real-value transfers.
- Source review: current main canonical product/shell/mobile/services/communication/voice documents, #462/#463, router, root shell, profiles, wallet, AI chat, legacy chat list and workstream protocol; review PR conflict status before any shared-doc edit.
- Evidence: documentation inspection only. No tests, deployments, device checks or performance measurements claimed.
- Current step: publish target-screen flow contract, explicit migration and route compatibility plan, user-journey matrix, risks, gates and file ownership handoffs in a reviewable docs PR. Shared CI recovery remains #457 / owner Work.
- Lease: five-minute repository-visible activity rule; this claim reserves only bounded documentation while active, no downstream C/R implementation paths.

## Completed documentation integration checkpoint

- Prepared `docs/END-TO-END-UX-ARCHITECTURE.md` with the proposed permanent four-tab structure, screen-by-screen controls, recipient/DM/agent/persona/finance type separation, back-stack and deep-link migration, performance/privacy/audio boundaries, twelve concrete conflict resolutions and a release journey matrix.
- Linked the proposal from `CONTINUE-HERE.md`, `docs/MULTI-WINDOW-WORK.md`, `docs/APP-SHELL-CONTRACT.md`, `docs/MOBILE-SCREEN-ARCHITECTURE.md`, and `docs/COMMUNICATIONS-EXTENSION-PLAN.md` without deleting previous approved requirements.
- GitHub comparison at review: 7 Markdown-only paths, branch ahead of `main`, 0 behind; reviewed document presence/cross-links and key C01–C08/R01–R19/navigation contracts. No executable Flutter/TypeScript tests or user/device/production flows run.
- **One explicit product decision remains:** whether to replace the previously approved bottom `Talk` destination label with recommended `Assistant`, as part of the complete four-tab target `Home · Chats · Wallet · Assistant`. The proposal does **not** override existing approval automatically.
- Handoff: UX/documentation review PR only; core R/C owners must continue to respect their distinct code lanes, integrate frozen routes/typed IDs once the owner approves the final target, and not build knowingly disposable intermediate navigation.
