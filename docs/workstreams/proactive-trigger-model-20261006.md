# Proactive trigger model — Task 113

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/proactive-trigger-model-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **113** Implement proactive trigger model for schedules/events/conditions.
- `docs/SOURCE-OWNERSHIP.md` — `packages/proactivity` owns proactive permission/frequency/privacy policy.

## Owned paths
- `packages/proactivity/src/trigger-model.ts` (new)
- `packages/proactivity/src/index.ts` (new)
- `tests/contracts/proactive-trigger-model.test.ts` (new)
- `docs/workstreams/proactive-trigger-model-20261006.md`

## Excluded/shared paths
- No Workflow scheduler/timer state, Gateway, background workers, Memory/World, migrations, package manifests/lockfile, production config or PR #136-owned paths.
- No arbitrary executable condition expressions.

## Dependencies
- Existing Workflow/schedule owners remain canonical for durable timers/execution.
- Security/relationship policy later decides whether an enabled trigger may fire.
- Event/perception owners supply normalized event/signal input.

## Current state
CLAIMED. Implement immutable normalized trigger definitions for schedule, event and bounded declarative condition triggers, with canonical scope, revisioning, purpose, dedupe identity and safe validation.