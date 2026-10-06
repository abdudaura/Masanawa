# Routine/world-event proactivity projection — Task 116

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/world-proactivity-integration-20261006`
Base SHA: `26cec448c0a6fe5d725787319832b1b6d4eb1dbd` (Task 115 exact head / PR #242)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **116** Implement routine/world-event proactive integration.
- Canonical World `Routine` and `WorldEvent` remain owned by `packages/world`.

## Owned paths
- `packages/proactivity/src/world-integration.ts` (new)
- `tests/contracts/world-proactivity-integration.test.ts` (new)
- `docs/workstreams/world-proactivity-integration-20261006.md`

## Excluded/shared paths
- No edits to `packages/world`, World persistence/simulation, Workflow scheduler, Gateway, migrations, package manifests/lockfile or production config.
- No duplicate Routine/WorldEvent state.

## Dependencies
- Task 113 trigger model is the target representation.
- World owner supplies canonical approved WorldEvent and enabled Routine snapshots.
- Task 115 policy still gates actual proactive firing/delivery.

## Current state
CLAIMED. Project enabled canonical routines into schedule-trigger candidates and approved visible World events into event-trigger candidates, rejecting internal/private/draft/retired or mismatched-Character inputs.