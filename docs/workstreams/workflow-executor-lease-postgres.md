# Workflow executor lease PostgreSQL persistence — 2026-10-05

Owner/window: ChatGPT harness executor-lease persistence continuation.
Branch: `work/workflow-executor-lease-postgres-20261005`
Base: PR #169 head `5076dc1aba94dc9d3415d033debc75812de158a9`

Purpose: persist the fenced WorkflowRun executor lease atomically in the canonical Workflows PostgreSQL owner.

## Exact owned paths

- `docs/workstreams/workflow-executor-lease-postgres.md`
- `packages/workflows/migrations/0002_executor_leases.sql`
- `adapters/storage/postgres/src/workflows/executor-lease.ts`
- `adapters/storage/postgres/src/workflows/executor-lease.integration.test.ts`
- append-only export in `adapters/storage/postgres/src/index.ts`

## Boundaries

- do not rewrite `0001_work_runtime.sql`;
- do not edit existing Task/Workflow repository implementation;
- no Gateway/mobile/channel files;
- no billing/crypto/Commerce/provider dispatch;
- storage lease never grants Security/Workflow authority;
- release preserves fence history;
- all acquire/renew/release mutations are transactionally fenced.

## Acceptance

- one durable row per tenant + WorkflowRun;
- lease row FK-binds the canonical WorkflowRun;
- first acquisition fence 1;
- competing unexpired holder loses;
- expiry/release takeover increments fence exactly once;
- same-holder active acquire is idempotent and does not extend expiry;
- renew requires exact current holder/fence and unexpired lease;
- release requires exact holder/fence and preserves row/fence history;
- stale holder cannot renew/release;
- concurrent contenders yield one current holder/fence;
- terminal WorkflowRun cannot acquire;
- tests exercise restart, release history and independent repository instances.

Status: active.
