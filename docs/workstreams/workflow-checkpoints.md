# Workstream claim — workflow-checkpoints

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 19:27 Africa/Lagos
Base: work/workflow-task-recovery-20261004 @ 2e4cb62ff052098f8aa919b68603896a7784f1d3
Production task: 089 — versioned checkpoints and compatibility validation

## Purpose

Implement canonical versioned WorkflowRun checkpoints with deterministic bounded payloads, lineage, fingerprints and exact compatibility validation against WorkflowVersion/graph identity. Checkpoints must not restore stale authorization and must not own retry/dead-letter policy.

## Exact owned paths

- `docs/workstreams/workflow-checkpoints.md`
- `docs/WORKFLOW-CHECKPOINTS.md`
- `packages/workflows/src/checkpoint-model.ts`
- `packages/workflows/src/checkpoint.ts`
- `packages/workflows/src/checkpoint.test.ts`
- `packages/workflows/migrations/0004_checkpoints.sql`
- `adapters/storage/postgres/src/workflows/checkpoints.ts`
- `tests/integration/workflow-checkpoints.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only checkpoint exports.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only checkpoint adapter export.

## Explicit non-ownership

This workstream does not modify Task 084-088 implementation files, retry/backoff/dead-letter policy (Task 090), approvals, schedules, operation reconciliation, package manifests/lockfiles or canonical production task docs.

## Acceptance target

- bounded immutable checkpoint payload contract;
- positive monotonic sequence and parent lineage;
- deterministic payload fingerprint;
- exact Tenant/WorkflowRun/WorkflowVersion/graph compatibility;
- durable PostgreSQL checkpoint append;
- exact replay idempotency;
- changed replay conflict;
- restore lookup that rejects incompatible WorkflowVersion/graph/schema;
- latest compatible checkpoint retrieval;
- no authorization/approval context stored as executable authority.

Task 090 remains separate.
