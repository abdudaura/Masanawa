# Workstream claim — workflow-schedules

Status: implementation complete; unit/PostgreSQL verification evidence pending
Owner: this isolated workstream
Started: 2026-10-04 19:42 Africa/Lagos
Base: work/workflow-checkpoints-20261004 @ 4703606a86993bee852d9d0de49f99d1e1874ed5
Production task: 092 — schedules/occurrences and durable timers

## Purpose

Implement deterministic workflow schedules, durable occurrence identity and due-timer release without depending on the concurrently owned Task 090/091 branches. The model must support one-shot and bounded interval schedules, exact WorkflowRun/version/graph pinning, replay-safe occurrence creation and concurrent due-timer claiming.

## Exact owned paths

- `docs/workstreams/workflow-schedules.md`
- `docs/WORKFLOW-SCHEDULES.md`
- `packages/workflows/src/schedule-model.ts`
- `packages/workflows/src/schedule.ts`
- `packages/workflows/src/schedule.test.ts`
- `packages/workflows/migrations/0007_schedules.sql`
- `adapters/storage/postgres/src/workflows/schedules.ts`
- `tests/integration/workflow-schedules.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only schedule exports. Integration must reconcile with foreign #113/#115 exports.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only schedule export. Integration must reconcile with foreign workflow adapter exports.

## Explicit non-ownership

This workstream does not modify Task 090 retry files, Task 091 human-request/approval files, Tool Operation reconciliation (Task 093), compensation (Task 094), package manifests/lockfiles or canonical production task docs.

## Acceptance target

- immutable bounded one-shot and interval schedule contracts;
- deterministic next-occurrence calculation;
- exact Run/WorkflowVersion/graph pinning;
- durable schedule + occurrence tables;
- occurrence sequence/idempotency uniqueness;
- atomically materialize due occurrences with `SKIP LOCKED`;
- no duplicate occurrence under concurrent timer workers;
- one-shot schedules complete after firing;
- bounded interval schedules stop at max occurrence/end boundary;
- exact replay returns existing occurrence rather than duplicating work.

Task 093+ remains separate.


## Implementation handoff

Implemented on branch `work/workflow-schedules-20261004` in draft PR #116.

The slice now provides:

- bounded immutable one-shot and interval schedule contracts;
- deterministic occurrence timing and fingerprints;
- exact WorkflowRun/WorkflowVersion/graph pinning;
- durable schedule and occurrence tables;
- immutable schedule definition and occurrence history;
- exact replay / changed-definition conflict behavior;
- atomic due occurrence + canonical outbox publication;
- one-shot completion;
- bounded interval max/end stopping;
- one-occurrence-per-schedule-per-pass backlog fairness;
- concurrent `FOR UPDATE SKIP LOCKED` timer materialization;
- focused unit + PostgreSQL acceptance coverage.

Task 090/091 remain owned by foreign PRs #113/#115 and were not modified.
Task 093 remains out of scope.
