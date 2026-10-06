# Promises, commitments and follow-up triggers — Task 114

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/proactive-commitments-20261006`
Base SHA: `8bec8e75973759901cd7479c46a2a730b5672363` (Task 113 exact head / PR #239)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **114** Implement promises, commitments and follow-up triggers.
- Depends on Task 113 trigger model; durable execution remains Workflow-owned.

## Owned paths
- `packages/proactivity/src/commitments.ts` (new)
- `tests/contracts/proactive-commitments.test.ts` (new)
- `docs/workstreams/proactive-commitments-20261006.md`

## Excluded/shared paths
- No Workflow state/timers, Memory persistence, Gateway, notifications, migrations, package manifests/lockfile, or production config.
- No model-only implicit commitment state.

## Dependencies
- Task 113 supplies the referenced follow-up trigger identity.
- Workflow/persistence owners later store commitments and schedule admitted follow-up work.

## Current state
CLAIMED. Implement bounded commitment identity/scope, explicit due/follow-up trigger linkage, lifecycle transitions, cancellation/completion semantics and validation that prevents silent completion or unbound follow-up promises.