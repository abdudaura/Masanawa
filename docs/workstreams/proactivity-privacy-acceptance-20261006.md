# Governed offline/online proactivity privacy acceptance — Task 118

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/proactivity-privacy-acceptance-20261006`
Base SHA: `178895a11ac3e09d9eec980f4963d527ba3a5894` (Task 116 proactivity stack / PR #244)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **118** Pass governed offline/online proactivity and privacy acceptance suite.
- Exercises Tasks 113-116 contract stack; production scheduler/delivery remains foreign ownership.

## Owned paths
- `tests/integration/proactivity-privacy-acceptance.test.ts` (new)
- `docs/workstreams/proactivity-privacy-acceptance-20261006.md`

## Excluded/shared paths
- No runtime/scheduler/Gateway/delivery/Memory/World persistence, migrations, package manifests/lockfile or production config.
- This slice does not claim physical/production acceptance until shared runtime composition exists and tests execute.

## Dependencies
- Task 113 trigger model, Task 114 commitments, Task 115 policy, Task 116 World projection.
- Workflow/runtime owner later runs equivalent assertions against durable occurrences and actual delivery.

## Current state
CLAIMED. Add integrated contract-level acceptance for offline delay/reconnect gating, stable trigger identity/dedupe, quiet hours/frequency privacy enforcement, commitment no-double-follow-up semantics, and World privacy isolation.