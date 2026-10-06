# Proactive trigger model — Task 113 — 2026-10-06

Status: active isolated proactivity domain slice
Owner/window: ChatGPT continuation window
Branch: `work/proactivity-trigger-model-20261006`
Base: current `main` `8648c5f524108d825fa52e3a7f735675dd8b78f7`

## Exact owned paths

- `packages/proactivity/package.json` (new)
- `packages/proactivity/tsconfig.json` (new)
- `packages/proactivity/tsconfig.build.json` (new)
- `packages/proactivity/src/index.ts` (new)
- `packages/proactivity/src/trigger.ts` (new)
- `packages/proactivity/src/trigger.test.ts` (new)
- `docs/PROACTIVE-TRIGGERS.md` (new)
- `docs/workstreams/proactive-trigger-model-20261006.md`

## Boundaries

- no Gateway/worker/scheduler/storage/migrations/mobile/deployment;
- no root lockfile/workspace changes;
- no Task 114 commitments, Task 115 quiet-hours/privacy, Task 116 world integration;
- trigger definitions are authority-free scheduling/event/condition facts only;
- execution still requires existing Agent/Tool/approval/runtime admission.

## Goal

Define a canonical bounded trigger model for:
- one-shot and recurring schedules;
- canonical event matches;
- explicit condition watches.

The model must be tenant/user scoped, replay/version safe, bounded in cadence, timezone
explicit, and unable to directly carry secrets, Tool authority or arbitrary executable code.
