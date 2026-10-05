# Harness execution cancellation control — 2026-10-05

Owner/window: ChatGPT Harness execution-control continuation.
Branch: `work/harness-execution-control-20261005`
Base: PR #184 head `317bdb4d5f030e90648bda6d20ebb275c45cd9ee`

Purpose: make loss of execution authority terminate in-flight Agent work immediately and propagate cancellation to child AgentRuns.

## Exact owned paths

- `docs/workstreams/harness-execution-control.md`
- `packages/agents/src/execution-control.ts`
- `packages/agents/src/execution-control.test.ts`
- append-only export in `packages/agents/src/index.ts`

## Boundaries

- no Gateway/mobile/channel composition;
- no provider adapter changes;
- no database/migration changes;
- no finance/Commerce logic;
- this is cancellation propagation only, not a permission source;
- actual authority/budget/lease systems decide when to stop; this control transports that stop immediately.

## Acceptance

- first terminal stop reason wins deterministically;
- stop reasons include user cancellation, budget exhaustion, lease loss, authority revocation, deadline and shutdown;
- stop aborts a shared AbortSignal exactly once;
- child controls inherit parent aborts;
- child cancellation does not abort parent/siblings;
- already-aborted parent creates immediately stopped child;
- bounded optional detail;
- throwIfStopped surfaces stable typed failure;
- listeners are cleaned up when child stops.

Status: active.
