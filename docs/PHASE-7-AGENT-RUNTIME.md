# Phase 7 — Agent runtime

Status: READY  
Current production task: **071 — CharacterSession canonical runtime contract**

Phase 6 Skills is closed. PR #76 merged as
`34aa6f9d19f9b0c92527fabe3a750052009398d2`; exact merged-main Foundation CI
run 451 passed the full gate. `docs/PHASE-6-CLOSURE-AUDIT.md` is PASS.

## First milestone

Recover `CONTINUE-HERE.md`, the master ledger, architecture/Identity contracts,
ADR-0008, and the product/Agent Phone direction before implementing Task 071.
Choose the CharacterSession canonical runtime contract from those owners and the
existing canonical IDs; do not assume a donor session model becomes platform truth.
Task 071 is planned and has no implementation branch or acceptance claim yet.

## Boundaries carried forward

- Identity/World retain Character, CharacterVersion and life/canon authority.
- Skills owns certified exact versions, current readiness, catalog persistence and
  validated restart/pin resolution. Runtime consumers reload current readiness.
- Tools owns atomic execution with current authority, Provider readiness, canonical
  Operations, receipts and reconciliation. Runtime orchestration does not replace it.
- Cloud and future Device Providers remain interchangeable execution edges; real
  Android/OmniSIP qualification belongs to later Device milestones.
- Phase 8 Workflows owns durable multi-step business state. Task 071 does not pull
  its engine or later Agent strategies into the session-contract milestone.

Acceptance, tests and persistence requirements must be recorded with the chosen
Task 071 contract. Completion requires merged acceptance and CI on exact main.
