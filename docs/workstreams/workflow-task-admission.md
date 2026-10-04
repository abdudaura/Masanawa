# Workstream claim — workflow-task-admission

Status: implementation complete; PostgreSQL verification evidence pending
Owner: this isolated stacked workstream
Started: 2026-10-04 19:26 Africa/Lagos
Base: work/workflow-run-task-state-20261004 @ 5d939aca6f053f72f409579b8acb4612249a7816
Production task: 086 — transactional task admission/outbox

## Purpose

Persist canonical WorkflowRun/Task records and atomically admit runnable Task work with an existing Masanawa events.outbox record in the same PostgreSQL transaction. Reuse the canonical outbox; do not create a parallel queue.

## Exact owned paths

- `docs/workstreams/workflow-task-admission.md`
- `docs/WORKFLOW-TASK-ADMISSION.md`
- `packages/workflows/migrations/**`
- `adapters/storage/postgres/src/workflows/**`
- `tests/integration/workflow-task-admission.test.ts`

## Coordinated shared seam

- `adapters/storage/postgres/src/index.ts` — append-only export of the new workflows adapter namespace. No edits to existing exports.

## Explicit non-ownership

This workstream does not modify Task 084/085 implementation files, the canonical events.outbox implementation/migrations, Agent runtime, Gateway/mobile/channels, Commerce/providers, root configs, lockfiles, or canonical production task docs.

Task 087 leasing/fencing, Task 088 crash adoption, Task 089 checkpoints, Task 090 retries/dead-letter policy and later workflow execution semantics are out of scope.

## Acceptance target

Provide PostgreSQL schema and repository APIs that:
- persist WorkflowRun and Task identity/version/graph/state truth;
- atomically insert a newly admitted Task and its canonical outbox event;
- make exact replay idempotent;
- reject reused admission/request identity with changed payload;
- preserve tenant/run/version/graph pinning;
- never expose a committed runnable Task without the corresponding committed outbox record;
- prove rollback leaves neither Task nor outbox record on failure.

Task 086 remains open until PostgreSQL acceptance executes and canonical task evidence advances.


## Implementation handoff

Implemented on branch `work/workflow-task-admission-20261004` in draft PR #107.

The slice now provides:

- WorkflowRun/Task PostgreSQL schema;
- exact Run/WorkflowVersion/graph custody;
- root/child lineage shape and persisted-parent validation;
- idempotent WorkflowRun creation;
- fresh-ready Task admission only;
- durable per-Tenant admission RequestId/fingerprint;
- atomic Task + canonical events.outbox insertion;
- exact replay to the same Task/outbox identity;
- changed-request conflict rejection;
- concurrent exact replay convergence;
- workflow-specific unique ready-outbox protection;
- rollback proof path after Task insert / outbox failure;
- focused PostgreSQL 18 acceptance coverage.

The PostgreSQL package manifest remains untouched because active PR #100 owns it.
The new workflow adapter is structurally typed until shared manifest integration
adds `@masanawa/workflows`.

Task 087+ worker leasing/fencing/recovery semantics remain out of scope.
