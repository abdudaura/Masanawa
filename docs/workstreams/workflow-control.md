# Workstream claim — workflow-control

Status: implementation complete; PostgreSQL verification evidence pending
Owner: this isolated stacked workstream
Started: 2026-10-04 20:28 Africa/Lagos
Base: work/workflow-operation-truth-20261004 @ 7c56d5e32968584fb69ae388cde4249ff6d239b1
Production task: 094 — workflow cancellation/compensation/supersession semantics

## Purpose

Implement durable workflow control semantics that stop unstarted work safely, preserve already-admitted/running side-effect custody, record supersession explicitly, and model compensation as new canonical work rather than erasing prior Operation/Task history.

## Exact owned paths

- `docs/workstreams/workflow-control.md`
- `docs/WORKFLOW-CONTROL-SEMANTICS.md`
- `packages/workflows/src/control-model.ts`
- `packages/workflows/src/control.ts`
- `packages/workflows/src/control.test.ts`
- `packages/workflows/migrations/0008_workflow_control.sql`
- `adapters/storage/postgres/src/workflows/control.ts`
- `tests/integration/workflow-control.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only exports.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only export.

## Explicit non-ownership

Do not modify Task 084-093 implementations, canonical Operation/provider state, manifests/lockfiles, Gateway/channels/mobile, Commerce/social/studio truth or canonical production task docs.

## Acceptance target

- durable cancel-requested/cancelled/superseded/compensating/compensated/compensation-failed control state;
- cancellation immediately cancels pending/ready/waiting Tasks but never mutates currently running leased Tasks;
- final cancellation only after no running Tasks remain;
- supersession requires a real successor WorkflowRun in the same Tenant/Workflow lineage and records that identity durably;
- compensation references original canonical Operation bindings and uses new compensation Operation bindings; original receipts/history remain immutable;
- idempotent replay and conflicting control-command rejection;
- no new Task checkout after cancellation/supersession admission.

Task 094 remains open until PostgreSQL acceptance executes and canonical task evidence advances.


## Implementation handoff

Implemented in draft PR #118.

Delivered:

- durable cancel/supersede control identity and replay fingerprint;
- immediate cancellation of non-running Tasks;
- preservation of active leased Tasks;
- activation trigger blocking future ready/running work;
- finalization only after running Tasks drain;
- same-Workflow successor validation;
- independent compensation state;
- original↔compensation canonical Operation linkage;
- database validation of Operation tenant/binding/state;
- forward-only compensation transitions;
- canonical compensation Operation success required before workflow compensation success;
- focused unit and PostgreSQL acceptance coverage.
