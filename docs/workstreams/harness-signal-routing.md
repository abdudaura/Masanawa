# Harness signal routing — 2026-10-05

Owner/window: ChatGPT Harness signal-routing continuation.
Branch: `work/harness-signal-routing-20261005`
Base: PR #186 head `740dc8edfaeab3e3bbd45b5307f3922d8cfe188c`

Purpose: separate presentation/channel cancellation from durable execution cancellation so mobile/WhatsApp/Telegram disconnects do not kill server-owned Work.

## Exact owned paths

- `docs/workstreams/harness-signal-routing.md`
- `packages/agents/src/harness-signals.ts`
- `packages/agents/src/harness-signals.test.ts`
- append-only export in `packages/agents/src/index.ts`

## Boundaries

- no Gateway/mobile/channel composition;
- no provider adapter changes;
- no persistence/migration changes;
- no finance/Commerce logic;
- does not create authority; it only selects which AbortSignal controls execution.

## Acceptance

- durable Task/Workflow-backed execution uses only server execution-control signal;
- presentation/request abort does not cancel durable execution;
- ephemeral chat may combine request abort with execution-control abort;
- first abort propagates once;
- no listener leak after combined signal aborts;
- already-aborted signals produce immediately aborted combined signal;
- null request signal is supported.

Status: active.
