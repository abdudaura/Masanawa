# Canonical Workflow Harness execution admission — 2026-10-05

Owner/window: ChatGPT Harness reconciliation continuation.
Branch: `work/harness-canonical-workflow-admission-20261005`
Base: PR #119 head `2f931a5dfa14417e02956da5c5f7b33df1c3959f`

Purpose: bridge the Agent Harness into the existing canonical Task-based Workflow engine without introducing a second lease/checkpoint runtime.

## Exact owned paths

- `docs/workstreams/harness-canonical-workflow-admission.md`
- `packages/workflows/src/execution-admission.ts`
- `packages/workflows/src/execution-admission.test.ts`
- append-only export in `packages/workflows/src/index.ts`
- `adapters/storage/postgres/src/workflows/harness-execution.ts`
- `adapters/storage/postgres/src/workflows/harness-execution.integration.test.ts`
- append-only export in `adapters/storage/postgres/src/workflows/index.ts`

## Canonical dependencies reused

- Task leasing/fencing from PR #109;
- heartbeat/recovery from PR #111;
- checkpoint compatibility from PR #112;
- retry/attention semantics from PR #113/#114;
- human requests from PR #115;
- canonical Operation truth from PR #117;
- control/cancellation from PR #118;
- usage/operator visibility from PR #119.

## Boundaries

- no new migrations/tables;
- PostgreSQL adapter only composes existing checkpoint + Operation truth readers;
- no second WorkflowRun lease;
- no second checkpoint store;
- no Gateway/mobile/channel composition;
- no provider or finance dispatch;
- current authority/evidence is injected and must be revalidated before execution;
- uncertain external outcomes must reconcile, never blind-redispatch.

## Acceptance

- only a currently leased canonical Task may be admitted;
- lease owner/fence/expiry are preserved exactly;
- current authority guard runs before execution;
- latest checkpoint must match exact Run/Version/graph;
- external ambiguity can force reconciliation instead of execution;
- terminal/expired/stale candidates fail closed;
- result is provider/channel neutral.

Status: active.
