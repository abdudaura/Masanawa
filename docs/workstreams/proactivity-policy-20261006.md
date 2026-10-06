# Proactivity quiet-hours/frequency/privacy policy — Task 115

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/proactivity-policy-20261006`
Base SHA: `9b3a81ac74a2afd3eb22d6550d8603415358c517` (Task 114 exact head / PR #240)
Implementation head: `09ce6e5d30753e0770d9063b9f2adddeb760c922`
PR: #242

## Completed implementation
- Added fail-closed Relationship opt-in gate.
- Added explicit allowed privacy scopes.
- Added timezone-aware quiet hours including cross-midnight windows.
- Equal quiet-hour start/end is treated as quiet all day, not silently disabled.
- Added per-hour/per-day frequency ceilings with deterministic denial reasons.
- Added runtime validation for policy booleans, scopes, limits, times and IANA time zone.
- Added root contract tests for all deny/allow paths.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/proactivity-policy-20261006.md`
2. `packages/proactivity/src/policy.ts`
3. `tests/contracts/proactivity-policy.test.ts`

No Workflow/Gateway/notification/Memory/migration/package-manifest/lockfile/production paths changed.

## Verification
Foundation CI run `37454863718`, job `112239871952` ended `failure` with `steps = null`; checkout/install/tests never executed. Not a pass and not application-failure evidence.

## Remaining dependencies
- PR #240/#239 proactivity model stack integrates first.
- Relationship/settings owner supplies persisted policy revision.
- Workflow/delivery owners must invoke this gate before scheduling/delivery.
- Workspace owner activates `packages/proactivity` when shared lockfile ownership clears.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
