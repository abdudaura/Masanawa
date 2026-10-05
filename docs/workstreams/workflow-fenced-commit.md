# Workflow fenced commit boundary — 2026-10-05

Owner/window: ChatGPT harness fenced-commit continuation.
Branch: `work/workflow-fenced-commit-20261005`
Base: PR #173 head `ba621a087db55fd9118460d60037010ff41ed9f4`

Purpose: make WorkflowRun checkpoint/state commits fail closed when an executor has been fenced or expired.

## Exact owned paths

- `docs/workstreams/workflow-fenced-commit.md`
- `packages/workflows/src/executor-commit.ts`
- `packages/workflows/src/executor-commit.test.ts`
- append-only export in `packages/workflows/src/index.ts`
- `adapters/storage/postgres/src/workflows/executor-commit.ts`
- `adapters/storage/postgres/src/workflows/executor-commit.integration.test.ts`
- append-only export in `adapters/storage/postgres/src/index.ts`

## Boundaries

- do not modify the existing WorkflowRun repository;
- no new migration;
- no Gateway/mobile/channel files;
- no billing/crypto/Commerce/provider dispatch;
- lease ownership is necessary but never sufficient: current Security authority is still required;
- all fenced commits are one PostgreSQL transaction.

## Acceptance

- exact holder/fence must be current and unexpired at commit time;
- present AuthorityContext is revalidated transaction-locally;
- checkpoint append is atomic with fence verification;
- WorkflowRun transition is atomic with fence verification;
- stale/expired/released executor cannot checkpoint or transition;
- terminal Work still follows canonical transition rules;
- checkpoint replay remains exact/idempotent;
- approval-custody checks remain canonical;
- no stale worker can commit after another holder takes over.

Status: active.
