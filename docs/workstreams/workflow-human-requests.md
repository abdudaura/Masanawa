# Workstream claim — workflow-human-requests

Status: implementation complete; PostgreSQL verification evidence pending
Owner: this isolated stacked workstream
Started: 2026-10-04 20:28 Africa/Lagos
Base: work/workflow-retries-20261004 @ 3291ea8163af97f26951930d5a30be0fa47d3ec0
Production task: 091 — human-in-loop pending requests and approvals

## Purpose

Implement canonical pending human request state for Workflow Tasks, including durable request/response custody and optional binding to the existing Masanawa Security Approval system. Do not create a second authorization/approval engine.

## Exact owned paths

- `docs/workstreams/workflow-human-requests.md`
- `docs/WORKFLOW-HUMAN-REQUESTS.md`
- `packages/workflows/src/human-request-model.ts`
- `packages/workflows/src/human-request.ts`
- `packages/workflows/src/human-request.test.ts`
- `packages/workflows/migrations/0006_human_requests.sql`
- `adapters/storage/postgres/src/workflows/human-requests.ts`
- `tests/integration/workflow-human-requests.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only exports.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only export.

## Explicit non-ownership

This workstream does not modify Task 084-090 implementations, Security approval core, leasing/recovery/checkpoint/retry code, manifests/lockfiles, Agent runtime, Gateway/channels/mobile, Commerce/providers or canonical production task docs.

Task 092 timers/schedules, Task 093 Tool receipt integration and Task 094 cancellation/compensation/supersession remain out of scope.

## Acceptance target

- bounded immutable human request definitions;
- durable pending request records bound to Tenant/WorkflowRun/Task/version/graph;
- request kinds for information, confirmation and approval;
- optional canonical ApprovalId reference for consequential approval requests;
- one terminal response/decision with immutable history;
- Task waiting custody while request is pending;
- stale/duplicate/conflicting response rejection;
- exact replay idempotency;
- response resumes the Task to ready only when request semantics permit;
- approval-backed requests require the referenced canonical approval to be approved/current before resume.

Task 091 remains open until focused PostgreSQL acceptance executes and canonical task evidence advances.


## Implementation handoff

Implemented in draft PR #115.

Delivered:

- immutable information/confirmation/approval request contracts;
- exact Task/Run/WorkflowVersion/graph persistence binding;
- one pending request per Task;
- fenced running → waiting request open;
- exact lost-response replay before lease validation;
- durable request/response fingerprints;
- information response resume;
- confirmation rejection/cancellation;
- canonical Security approval lookup and decision gating;
- single-transaction request lock + approval read + Task transition + request settlement;
- exact terminal replay and conflicting response rejection;
- focused unit and PostgreSQL acceptance coverage.

Task 092+ remains explicitly excluded.
