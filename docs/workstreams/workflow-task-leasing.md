# Workstream claim — workflow-task-leasing

Status: implementation complete; PostgreSQL verification evidence pending
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


## Implementation handoff

Implemented on branch `work/workflow-task-leasing-20261004` in draft PR #109.

The slice now provides:

- Task lease owner/fence/lease timestamps;
- running-state lease custody constraint;
- Tenant-scoped deterministic checkout;
- `FOR UPDATE SKIP LOCKED` concurrency;
- monotonic fence increment on checkout;
- optimistic Task revision increment on checkout/settlement;
- fenced completed/failed/waiting/cancelled settlement;
- current owner/fence/state/expiry/chronology checks;
- lease clearing with persisted fence generation;
- PostgreSQL acceptance for distinct concurrent workers, stale owner/fence,
  expiry and state-specific settlements.

Task 088 heartbeat, lease renewal, expired-lease reclaim and stale-run adoption
remain explicitly unimplemented here.
