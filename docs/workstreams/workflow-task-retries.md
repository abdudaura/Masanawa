# Workstream claim — workflow-task-retries

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 19:33 Africa/Lagos
Base: work/workflow-checkpoints-20261004 @ 4703606a86993bee852d9d0de49f99d1e1874ed5
Production task: 090 — retries/backoff and dead-letter/needs-attention

## Purpose

Implement deterministic bounded retry policy for failed leased Workflow Tasks, durable retry disposition, due-retry release, and explicit dead-letter / needs-attention outcomes. Ambiguous/uncertain side-effect outcomes must never be blindly retried.

## Exact owned paths

- `docs/workstreams/workflow-task-retries.md`
- `docs/WORKFLOW-TASK-RETRIES.md`
- `packages/workflows/src/retry-model.ts`
- `packages/workflows/src/retry.ts`
- `packages/workflows/src/retry.test.ts`
- `packages/workflows/migrations/0005_task_retries.sql`
- `adapters/storage/postgres/src/workflows/retries.ts`
- `tests/integration/workflow-task-retries.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only retry exports.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only retry adapter export.

## Explicit non-ownership

This workstream does not modify Task 084-089 implementation files, human approvals (Task 091), schedules/occurrences (Task 092), Tool Operation reconciliation (Task 093), cancellation/compensation (Task 094), package manifests/lockfiles or canonical production task docs.

## Acceptance target

- deterministic bounded exponential backoff;
- retry attempt ceiling;
- unsafe/uncertain outcomes route to needs-attention with no auto-retry;
- terminal non-retryable/exhausted outcomes route to dead-letter;
- current lease owner/fence required to record failure disposition;
- retry-scheduled Tasks become waiting with due timestamp;
- due retries atomically become ready exactly once;
- stale workers cannot schedule retries;
- concurrent due-retry release does not duplicate work.

Task 091+ remains separate.
