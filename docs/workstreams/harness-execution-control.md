# Harness execution cancellation control — 2026-10-05

Owner/window: ChatGPT Harness execution-control continuation.
Branch: `work/harness-execution-control-20261005`
Base: PR #184 head `317bdb4d5f030e90648bda6d20ebb275c45cd9ee`
PR: #186

Purpose: make loss of execution authority terminate in-flight Agent work immediately and
propagate cancellation to child AgentRuns.

## Exact owned paths

- `docs/workstreams/harness-execution-control.md`
- `packages/agents/src/execution-control.ts`
- `packages/agents/src/execution-control.test.ts`
- `packages/agents/src/subworker-budget.ts`
- `packages/agents/src/subworker-budget.test.ts`
- append-only export in `packages/agents/src/index.ts`

No Gateway/mobile/channel, provider adapter, database/migration, finance or Commerce files
are owned.

## Implemented execution control

- stable stop reasons:
  - `user-cancelled`
  - `budget-exhausted`
  - `lease-lost`
  - `authority-revoked`
  - `deadline`
  - `shutdown`;
- first stop reason wins deterministically;
- stop aborts one shared `AbortSignal` exactly once;
- `throwIfStopped()` emits typed `agents.execution_stopped` with bounded safe detail;
- child controls inherit the exact parent reason/detail;
- child-local cancellation never aborts the parent or siblings;
- already-stopped parent produces an immediately stopped child;
- child stop removes its parent listener to avoid stale propagation/listener buildup.

## Budgeted subworker integration

The #184 budgeted-subworker admission path is hardened further here:

1. parent execution control is checked before any budget calculation/reservation;
2. child budget must fit the parent remaining envelope;
3. parent child-run usage advance is calculated;
4. parent control is checked again immediately before durable reservation;
5. durable reservation must succeed and match the complete expected usage snapshot;
6. parent control is checked again after reservation but before child AgentRun creation;
7. child execution control is created as a child of the parent control;
8. #163 bounded/attenuated subworker admission creates the child;
9. if parent stops during child creation, child control is aborted and the result is not
   admitted to execution;
10. custody mismatch/admission failure stops the child control before returning failure.

Safety preference is fail-closed: a parent budget slot may be conservatively consumed if
execution authority disappears after reservation, but a child may never execute without
both budget reservation and live parent control.

## Verification

- final branch audit is performed against PR #184 head;
- focused tests cover first-stop-wins, typed stop failure, exact parent→child propagation,
  child isolation, already-stopped parent, listener cleanup, bounded detail, successful
  budgeted child control inheritance, stop-before-reservation, stop-during-reservation,
  reservation failure and custody failure;
- Foundation CI on the initial execution-control head again failed before checkout with
  `steps: null`; final-head CI is audited separately and no hosted pass is fabricated.

## Integration handoff

- root Harness creates one execution control per admitted AgentRun;
- pass `control.signal` into provider inference/Tool execution through the existing
  AbortSignal seams;
- canonical Workflow Task lease loss should stop root control with `lease-lost`;
- budget exhaustion should stop with `budget-exhausted`;
- present-authority revocation should stop with `authority-revoked`;
- user cancellation/control-plane cancellation should stop with `user-cancelled`;
- deadline/shutdown use their corresponding reasons;
- all child AgentRuns admitted through #184/#186 inherit the parent control;
- mobile/WhatsApp/Telegram may request cancellation through authorized server commands
  but never own or synthesize execution-control state.

Implementation: complete within this isolated Harness slice.
Deployment: not claimed.
