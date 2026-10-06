# Proactivity quiet-hours/frequency/privacy policy — Task 115

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/proactivity-policy-20261006`
Base SHA: `9b3a81ac74a2afd3eb22d6550d8603415358c517` (Task 114 exact head / PR #240)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **115** Implement quiet hours, frequency, privacy and relationship policy.
- `docs/SOURCE-OWNERSHIP.md` — `packages/proactivity` owns permission/frequency/privacy/quiet-hours policy.

## Owned paths
- `packages/proactivity/src/policy.ts` (new)
- `tests/contracts/proactivity-policy.test.ts` (new)
- `docs/workstreams/proactivity-policy-20261006.md`

## Excluded/shared paths
- No Workflow execution/schedulers, Gateway, notification delivery, Memory, migrations, package manifests/lockfile or production config.
- No implicit proactive opt-in.

## Dependencies
- Task 113 supplies normalized triggers.
- Relationship/settings owner supplies current policy revision and opt-in/quiet-hours state.
- Execution owner must call this gate before scheduling/delivering proactive work.

## Current state
CLAIMED. Implement fail-closed relationship opt-in, allowed privacy scopes, timezone-aware quiet hours, per-hour/per-day frequency ceilings and deterministic allow/deny reasons.