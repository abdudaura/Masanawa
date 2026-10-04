# Workstream claim — workflow-task-leasing

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 19:26 Africa/Lagos
Base: work/workflow-task-admission-20261004 @ 5ffbe40e20542426bc51cd702c644571d3f72af9
Production task: 087 — atomic task checkout/lease/fencing

## Purpose

Implement atomic checkout of ready Workflow Tasks with lease ownership and monotonic fencing, plus fenced settlement of a currently leased Task. This work must not implement heartbeat/reclaim/adoption (Task 088), checkpoints (Task 089), retry/backoff/dead-letter policy (Task 090), approvals, schedules or side-effect reconciliation.

## Exact owned paths

- `docs/workstreams/workflow-task-leasing.md`
- `docs/WORKFLOW-TASK-LEASING.md`
- `packages/workflows/migrations/0002_task_leases.sql`
- `adapters/storage/postgres/src/workflows/leases.ts`
- `tests/integration/workflow-task-leasing.test.ts`

## Coordinated shared seam

- `adapters/storage/postgres/src/workflows/index.ts` — append-only export of the new leasing module.

## Explicit non-ownership

This workstream does not modify Task 084-086 implementation files, canonical events/outbox code, package manifests/lockfiles, Agent runtime, Gateway/mobile/channels, Commerce/providers, or canonical production task docs.

## Acceptance target

- atomically claim distinct ready Tasks with `FOR UPDATE SKIP LOCKED`;
- transition claimed Tasks to running exactly once;
- allocate a monotonic fence token per checkout;
- bind lease owner and expiry;
- require current owner + fence + unexpired lease for settlement;
- reject stale/wrong owners and fences;
- clear lease custody on settlement;
- prevent duplicate checkout of the same ready Task under concurrency.

Task 088 remains the owner of heartbeat, expired-lease reclaim and stale-run adoption.
