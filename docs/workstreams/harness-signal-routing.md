# Harness signal routing — 2026-10-05

Owner/window: ChatGPT Harness signal-routing continuation.
Branch: `work/harness-signal-routing-20261005`
Base: PR #186 head `740dc8edfaeab3e3bbd45b5307f3922d8cfe188c`
PR: #187

Purpose: separate presentation/channel cancellation from durable execution cancellation
so mobile/WhatsApp/Telegram disconnects do not kill server-owned Work.

## Exact owned paths

- `docs/workstreams/harness-signal-routing.md`
- `packages/agents/src/harness-signals.ts`
- `packages/agents/src/harness-signals.test.ts`
- `packages/agents/src/controlled-harness.ts`
- `packages/agents/src/controlled-harness.test.ts`
- append-only exports in `packages/agents/src/index.ts`

No Gateway/mobile/channel implementation, provider adapter, persistence/migration,
finance or Commerce files are owned.

## Implemented signal routing

- durable execution is any AgentHarness request carrying a TaskId or WorkflowRunId;
- durable execution uses only the server-owned AgentExecutionControl signal;
- request/presentation disconnect signals are ignored for durable execution;
- ephemeral chat combines request abort and execution-control abort;
- combined signal aborts once on the first source;
- listeners are removed when combined signal aborts or is explicitly disposed;
- already-aborted source creates an immediately aborted combined signal;
- null request signal is supported.

## AgentHarness wrapper

`createExecutionControlledAgentHarness()` applies the routing at the actual Harness
boundary rather than leaving it as a helper:

1. server execution control must be live before the inner Harness is called;
2. Task/Workflow-backed requests receive only the execution-control signal;
3. ephemeral requests receive the combined request + execution signal;
4. after the inner Harness returns, execution control is rechecked before accepting a
   durable result;
5. if an inner provider ignores abort and returns after server execution stopped, the
   stale result is rejected with `agents.execution_stopped`;
6. if an ephemeral request aborts and an inner provider still returns, the wrapper rejects
   the result with `agents.request_aborted`;
7. combined listeners are disposed in `finally`.

This directly enforces the thin-shell architecture: losing Android/WebSocket/WhatsApp/
Telegram presentation connectivity does not terminate durable server Work.

## Verification

- branch is 8 commits ahead and 0 behind PR #186 head;
- exact changed paths are the six claimed paths above;
- implementation head before this handoff update:
  `fe65984e72499da411a54cb42a569e80e57b544a`;
- Foundation CI run `37305497760` failed before executing any step; job
  `111748060646` exposes `steps: null`. This is hosted runner non-execution, not a
  TypeScript/test verdict;
- focused tests cover durable disconnect survival, WorkflowRun disconnect survival,
  ephemeral request abort, server stop abort, already-aborted sources, listener disposal,
  no-request-signal execution, stale durable result rejection and pre-stopped execution.

## Metering dependency discovered

The current provider-neutral `AgentInferenceResult` exposes text only. It does not
carry provider-verified input tokens, output tokens or provider cost evidence.

Therefore this branch deliberately does **not** synthesize budget usage from estimates.
PR #184 budget preflight remains valid, but actual post-inference usage accounting needs
an additive provider-neutral metered-inference evidence seam before production budget
persistence can be authoritative.

## Integration handoff

- wrap canonical AgentHarness execution through `createExecutionControlledAgentHarness()`;
- root Harness creates the AgentExecutionControl from #186;
- Task/Workflow lease loss, authority revocation, budget exhaustion and explicit user
  cancellation stop that server control;
- channel/request disconnect is presentation-only for durable Work;
- pass the routed execution signal into inference/Tool operations that already accept
  AbortSignal;
- mobile/WhatsApp/Telegram reconnect to server Work state instead of restarting it;
- do not treat socket/request cancellation as durable Work cancellation.

Implementation: complete within this isolated signal-routing slice.
Verification: source/diff audit complete; executable hosted CI unavailable.
Deployment: not claimed.
