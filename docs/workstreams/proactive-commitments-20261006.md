# Promises, commitments and follow-up triggers — Task 114

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/proactive-commitments-20261006`
Base SHA: `8bec8e75973759901cd7479c46a2a730b5672363` (Task 113 exact head / PR #239)
Implementation head: `5db3bfa5ec259ddd13f87e293b04f9d3ff6a3d9a`
PR: #240

## Completed implementation
- Added scoped, revisioned commitment records with explicit promise text, due time and follow-up trigger identity.
- Open commitments cannot carry terminal timestamps.
- Completion/cancellation/expiry are terminal and advance revision immutably.
- Expiry cannot occur before due time; terminal transitions cannot predate creation.
- Follow-up due evaluation is deterministic and never treats model text alone as commitment state.
- Added root contract tests for lifecycle, timing and trigger-link invariants.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/proactive-commitments-20261006.md`
2. `packages/proactivity/src/commitments.ts`
3. `tests/contracts/proactive-commitments.test.ts`

No Workflow timers/state, Memory, Gateway, notifications, migrations, package manifests/lockfile or production config changed.

## Verification
Foundation CI run `37454688086`, job `112239290926` ended `failure` with `steps = null`; checkout/install/tests never executed. Not a pass and not application-failure evidence.

## Remaining dependencies
- PR #239 Task 113 integrates first.
- Persistence/Workflow owners store commitments and execute/schedule admitted follow-up work.
- Task 115 policy must gate whether/when follow-up can actually fire.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
