# Proactivity routine/world-event integration workstream

Owner/window: current ChatGPT continuation window — Task 116
Branch: `work/proactivity-world-integration-20261006`
Base SHA: `26cec448c0a6fe5d725787319832b1b6d4eb1dbd` (PR #242 exact head)
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 116.
Dependencies: Task 113 trigger model (#239), Task 114 commitments (#240), Task 115 policy (#242), canonical World Routine/WorldEvent contracts.

## Exact owned paths

- `packages/proactivity/src/world-integration.ts` (new)
- `tests/contracts/proactivity-world-integration.test.ts` (new)
- `docs/workstreams/proactivity-world-integration-20261006.md`

## Excluded/shared paths

- existing Task 113–115 implementation files;
- `packages/proactivity/src/index.ts` unless ownership is explicitly extended;
- all `packages/world/**` implementation/persistence;
- Workflow timers/schedulers/execution;
- Gateway, workers, notifications/channels;
- migrations, lockfile and production environment;
- PR #136 shared production/mobile ownership.

## Implementation boundary

- project an enabled canonical World Routine into an existing `schedule` ProactiveTrigger;
- project an approved, user-visible canonical WorldEvent into an existing `event` ProactiveTrigger;
- require exact Tenant/Character scope binding;
- never copy arbitrary World payload into trigger state;
- fail closed for disabled routines, non-approved canon, internal/private World events, or scope mismatch;
- preserve source identity/dedupe through deterministic trigger metadata;
- policy evaluation and durable execution remain Task 115/Workflow owners.

## Current state

CLAIMED. Implement Task 116 as an additive adapter from canonical World truth into the existing Proactivity trigger contracts.
