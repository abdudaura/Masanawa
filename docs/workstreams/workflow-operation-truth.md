# Workstream claim — workflow-operation-truth

Status: implementation complete; PostgreSQL verification evidence pending
Owner: this isolated stacked workstream
Started: 2026-10-04 20:28 Africa/Lagos
Base: work/workflow-human-requests-20261004 @ 18016eebbd1631ea699212f9e2d2fcb197ff5e2f
Production task: 093 — Tool Operations/receipts/reconciliation in workflow truth

## Purpose

Bind Workflow Tasks to canonical Masanawa OperationId execution truth and project canonical Operation/receipt/reconciliation status back into workflow custody without duplicating provider or business state.

## Exact owned paths

- `docs/workstreams/workflow-operation-truth.md`
- `docs/WORKFLOW-OPERATION-TRUTH.md`
- `packages/workflows/src/operation-binding-model.ts`
- `packages/workflows/src/operation-binding.ts`
- `packages/workflows/src/operation-binding.test.ts`
- `packages/workflows/migrations/0007_operation_bindings.sql`
- `adapters/storage/postgres/src/workflows/operations.ts`
- `tests/integration/workflow-operation-truth.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only exports.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only export.

## Explicit non-ownership

Do not modify canonical events Operation/receipt/reconciliation implementations or migrations, Task 084-092 implementations, provider adapters, Commerce/social/studio business truth, manifests/lockfiles, or canonical production task docs.

## Acceptance target

- immutable Task↔Operation binding pinned to Tenant/Run/Task/version/graph;
- one durable operation role/key per Task with exact replay and changed-binding conflicts;
- workflow projection reads canonical Operation state rather than copying provider truth;
- succeeded/rejected/failed terminal Operation outcomes map deterministically to workflow-ready completion/failure decisions;
- partial/unknown/reconciling requires reconciliation and never auto-retries;
- active needs-attention reconciliation blocks success projection;
- external receipt evidence is referenced, not duplicated;
- cross-Tenant/Task binding is rejected.

Task 093 remains open until PostgreSQL acceptance executes and canonical task evidence advances.


## Implementation handoff

Implemented in draft PR #117.

Delivered:

- immutable Task↔Operation binding contracts;
- semantic replay fingerprint excluding audit timestamp;
- exact Task/Run/WorkflowVersion/graph persistence binding;
- database cross-Tenant Operation guard;
- one Operation per Task role and one workflow binding per Operation;
- live canonical Operation state projection;
- ExternalReceiptId-only projection;
- active reconciliation projection;
- deterministic pending/succeeded/failed/reconciliation-required/needs-attention mapping;
- focused unit and PostgreSQL acceptance coverage.

Canonical Events/Provider operation, receipt and reconciliation implementations
remain untouched and authoritative.
