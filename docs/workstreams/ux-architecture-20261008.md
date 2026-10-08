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
