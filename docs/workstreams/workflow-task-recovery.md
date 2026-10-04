# Workstream claim — workflow-task-recovery

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 19:26 Africa/Lagos
Base: work/workflow-task-leasing-20261004 @ b35e22489acc16b3cea19a898669cf234502ef59
Production task: 088 — heartbeats, stale-run adoption and crash recovery

## Purpose

Add liveness renewal and expired-lease recovery for running Workflow Tasks on top of Task 087 lease/fence custody. Preserve the original Task execution start, increment custody fencing on adoption, and ensure a stale worker cannot mutate after another worker adopts the Task.

## Exact owned paths

- `docs/workstreams/workflow-task-recovery.md`
- `docs/WORKFLOW-TASK-RECOVERY.md`
- `packages/workflows/migrations/0003_task_recovery.sql`
- `adapters/storage/postgres/src/workflows/recovery.ts`
- `tests/integration/workflow-task-recovery.test.ts`

## Coordinated shared seam

- `adapters/storage/postgres/src/workflows/index.ts` — append-only export of the recovery module.

## Explicit non-ownership

This workstream does not modify Task 084-087 implementation files, checkpoint/version-compatibility semantics (Task 089), retries/backoff/dead-letter policy (Task 090), approvals, schedules, Tool Operation reconciliation, package manifests/lockfiles, or canonical production task docs.

## Acceptance target

- current owner/fence may heartbeat only while lease is unexpired;
- heartbeat extends expiry without changing fence or canonical Task state;
- expired running Tasks can be atomically adopted with `SKIP LOCKED`;
- adoption changes owner, increments fence and recovery counter, and preserves original `started_at`;
- stale pre-adoption owner/fence cannot settle after adoption;
- current adopted owner can settle;
- concurrent recovery workers cannot adopt the same stale Task twice.

Task 089 checkpoint/version compatibility remains separate.
