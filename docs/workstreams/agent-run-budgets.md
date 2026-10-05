# AgentRun execution budgets — 2026-10-05

Owner/window: ChatGPT harness budget continuation.
Branch: `work/agent-run-budgets-20261005`
Base: current main `b27554f1f953d96d5e7d44727cd4f8fef170009f`

Purpose: add the provider-neutral AgentRun budget contract explicitly left open by the runtime/harness work, without coupling the mobile shell or finance domains to execution control.

## Exact owned paths

- `docs/workstreams/agent-run-budgets.md`
- `packages/agents/src/execution-budget.ts`
- `packages/agents/src/execution-budget.test.ts`
- append-only export in `packages/agents/src/index.ts`

## Boundaries

- no Gateway/mobile/router/chat edits;
- no billing/crypto/Commerce ledger edits;
- no Tool/provider dispatch implementation;
- no database/migration changes;
- cost here is provider-metering evidence only and never financial settlement authority;
- budget checks are fail-closed and intended to run before inference/tool/child dispatch;
- actual durable meter persistence/composition remains integration-owned.

## Acceptance

- bounded run wall-clock duration;
- bounded input/output/total inference tokens;
- bounded Tool dispatch count;
- bounded child AgentRun count;
- bounded provider-cost microunits under an explicit currency;
- immutable budget envelope;
- monotonic usage updates;
- exact preflight checks before the next inference/tool/child action;
- stale/negative/non-finite/wrong-currency usage rejected;
- deterministic exhausted-budget errors;
- no client/mobile authority over budgets.

Status: active.
