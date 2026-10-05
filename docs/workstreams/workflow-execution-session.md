# Workflow execution session coordinator — 2026-10-05

Owner/window: ChatGPT harness execution-session continuation.
Branch: `work/workflow-execution-session-20261005`
Base: PR #175 head `e82bf047aabd7a2522f5607e49151f5a8542ee83`

Purpose: provide one server-side lifecycle that turns a resume decision into a fenced execution session.

## Exact owned paths

- `docs/workstreams/workflow-execution-session.md`
- `packages/workflows/src/executor-session.ts`
- `packages/workflows/src/executor-session.test.ts`
- append-only export in `packages/workflows/src/index.ts`

## Boundaries

- no Gateway/mobile/channel composition;
- no persistence/migration changes;
- no finance/provider dispatch;
- session coordinator grants no new Security authority;
- it only leases dispositions already returned executable by canonical resume logic;
- waiting approval, external reconciliation, blocked and terminal dispositions never obtain execution leases.

## Acceptance

- executable resume disposition acquires the durable lease;
- non-executable dispositions never acquire;
- lease duration is bounded;
- renewal uses exact holder/fence;
- close releases exact holder/fence;
- lease loss/renew failure is surfaced, never hidden;
- session result preserves run/checkpoint/resumeFrom exactly;
- coordinator stays provider/channel neutral.

Status: active.
