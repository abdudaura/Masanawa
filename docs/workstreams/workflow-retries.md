# Workstream claim — workflow-retries

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 20:28 Africa/Lagos
Base: work/workflow-checkpoints-20261004 @ f997b6720f31a31a9ac437761bf8c8174043ad3a
Production task: 090 — retries/backoff and dead-letter/needs-attention

## Purpose

Implement deterministic workflow Task retry policy, durable retry scheduling and terminal retry disposition without changing Task 085's canonical state set. Retriable failures move the Task to waiting with durable retry metadata; exhausted/unsafe failures settle terminally and record dead-letter or needs-attention disposition.

## Exact owned paths

- `docs/workstreams/workflow-retries.md`
- `docs/WORKFLOW-RETRY-POLICY.md`
- `packages/workflows/src/retry-model.ts`
- `packages/workflows/src/retry.ts`
- `packages/workflows/src/retry.test.ts`
- `packages/workflows/migrations/0005_task_retry_policy.sql`
- `adapters/storage/postgres/src/workflows/retries.ts`
- `tests/integration/workflow-task-retries.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only exports for retry modules.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only export for retry adapter.

## Explicit non-ownership

This workstream does not modify Task 084-089 implementation files, leasing/recovery/checkpoint logic, canonical events/outbox code, manifests/lockfiles, Agent runtime, Gateway/channels/mobile, Commerce/providers or canonical production task docs.

Task 091 approvals, Task 092 timers/schedules, Task 093 Tool receipt integration and Task 094 compensation/supersession remain out of scope.

## Acceptance target

- deterministic bounded retry policy and backoff calculation;
- durable retry attempt/disposition state per Task;
- fenced retry scheduling from the current running lease;
- due retry promotion from waiting back to ready exactly once;
- max-attempt exhaustion to dead-letter;
- explicit needs-attention escalation for ambiguous/unsafe retry outcomes;
- stale owner/fence rejection;
- concurrent due-retry promotion without duplicate readiness;
- restart-safe persisted next-attempt timing and safe error metadata.

Task 090 remains open until focused PostgreSQL acceptance executes and canonical task evidence advances.
