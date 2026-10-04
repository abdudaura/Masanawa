# Workstream claim — workflow-operator-visibility

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 19:51 Africa/Lagos
Base: work/workflow-control-20261004 @ 1c36d2bfbf7125a23e66140f327be8588b1474dc
Production task: 095 — workflow/run cost and operator visibility

## Purpose

Implement workflow-owned immutable usage/cost evidence and privacy-safe operator summaries without taking ownership of AgentRun telemetry, provider billing truth, Task 094 control semantics, or production observability/SLO infrastructure.

## Exact owned paths

- `docs/workstreams/workflow-operator-visibility.md`
- `docs/WORKFLOW-OPERATOR-VISIBILITY.md`
- `packages/workflows/src/usage-model.ts`
- `packages/workflows/src/usage.ts`
- `packages/workflows/src/usage.test.ts`
- `packages/workflows/migrations/0009_usage_visibility.sql`
- `adapters/storage/postgres/src/workflows/usage.ts`
- `tests/integration/workflow-usage-visibility.test.ts`

## Coordinated shared seams

- `packages/workflows/src/index.ts` — append-only usage exports.
- `adapters/storage/postgres/src/workflows/index.ts` — append-only usage adapter export.

## Explicit non-ownership

This workstream does not modify:

- Task 094 control files owned by PR #118;
- AgentRun telemetry/evidence work owned by #89;
- `packages/telemetry/**`;
- provider billing/reconciliation truth;
- production dashboards/alerting/SLOs (Task 147);
- package manifests/lockfiles or canonical production task docs.

## Acceptance target

- immutable bounded workflow usage evidence records;
- exact Tenant/WorkflowRun with optional Task/Operation/Provider correlation;
- non-negative input/output units, latency and cost micros;
- deterministic idempotency fingerprint per usage record;
- append-only PostgreSQL persistence and exact replay;
- changed replay conflict;
- aggregate WorkflowRun operator summary: task state counts, retry/attention signals where available, total usage/cost/latency;
- summaries expose IDs/status/counts/costs only and never payload/message/secret content;
- tenant isolation and deterministic ordering.

Task 096 golden restart/no-duplicate-side-effect acceptance remains separate.
