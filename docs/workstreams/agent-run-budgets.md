# AgentRun execution budgets — 2026-10-05

Owner/window: ChatGPT harness budget continuation.
Branch: `work/agent-run-budgets-20261005`
Base: current main `b27554f1f953d96d5e7d44727cd4f8fef170009f`
PR: #165

Purpose: add the provider-neutral AgentRun budget contract explicitly left open by
the runtime/harness work, without coupling the mobile shell or finance domains to
execution control.

## Exact owned paths

- `docs/workstreams/agent-run-budgets.md`
- `packages/agents/src/execution-budget.ts`
- `packages/agents/src/execution-budget.test.ts`
- `packages/agents/src/execution-budget-partition.ts`
- `packages/agents/src/execution-budget-partition.test.ts`
- append-only exports in `packages/agents/src/index.ts`

No Gateway/mobile/router/chat, billing/crypto/Commerce, provider adapter, storage,
migration or deployment files are owned.

## Implemented

- immutable budget envelope bound to one canonical AgentRun;
- wall-clock ceiling;
- input-token, output-token and combined-token ceilings;
- Tool-dispatch count ceiling;
- child-AgentRun count ceiling;
- provider-cost microunit ceiling bound to an explicit three-letter currency;
- initial zero-usage constructor;
- normalized monotonic usage snapshots;
- inference preflight checks using next-input, maximum-output and estimated provider cost
  before a provider request is admitted;
- actual inference usage recording that rejects stale observation time, wrong currency,
  negative usage and post-response exhaustion;
- Tool preflight + recording before another Tool dispatch;
- child-run preflight + recording before another child AgentRun;
- AgentRun/currency binding checks prevent a usage snapshot or provider estimate from
  being replayed against a different run/budget;
- exact-limit behavior is allowed, while the next unit/action fails deterministically.

Provider cost in this package is metering evidence only. It does not reserve, debit,
settle or otherwise authorize customer/creator/platform money.

## Verification

- Compare against base: branch is 11 commits ahead, 0 behind.
- Exact changed paths are the six claimed files above.
- Foundation CI run `37293638731` completed as failure before executing any job step;
  job `111709670456` has `steps: null`. This is hosted runner non-execution, not a
  TypeScript/test result.
- Focused tests are checked in for inference preflight/recording, wall-clock exhaustion,
  AgentRun/currency binding, Tool limits, child-run limits and malformed usage/budgets.
- Child-budget partitioning is also covered: requested local ceilings cannot exceed the
  parent's remaining time/tokens/tools/child slots/provider-cost allowance; one parent
  child slot is accounted for before nested-child ceilings are granted.
- Child grants identify the immediate `parentAgentRunId` only; they do not pretend the
  budget layer knows canonical root lineage. AgentRun lineage remains the authority for root identity.
- The final partitioning head `563b9fe75983ef548b0f4e09aacd1ae3ffc62d6a`
  currently has no GitHub workflow run attached. The earlier Foundation CI run
  `37293638731` on the budget-contract head again failed before steps (`steps: null`).
- No executable local checkout is available in this connector session, so no fabricated
  local pass is claimed.

## Integration handoff

1. AgentHarness/root-run admission should create or load the server-owned budget; the
   client must never supply trusted ceilings.
2. Inference integration calls `assertCanAdmitInference()` before provider dispatch and
   `recordInferenceUsage()` from provider-verified usage/cost evidence afterward.
3. Tool execution calls `assertCanDispatchTool()` before dispatch and records exactly
   one call only when that dispatch is admitted.
4. PR #163 subworkers must use `deriveChildExecutionBudget()` for a bounded local ceiling
   and still debit every actual child action against the shared parent/root meter. A local
   child grant is never an independent pool. Durable integration must serialize root-meter
   updates so concurrent children cannot oversubscribe the same remaining allowance.
5. Durable persistence should store budget + monotonic usage under canonical AgentRun
   custody when the integration/storage owner takes that slice. Do not create a second
   wallet/Commerce ledger for cost metering.
6. Android/WhatsApp/Telegram may render budget exhaustion as truthful Work failure or
   attention state, but they are not execution-budget authorities.

Implementation: complete within the isolated Agents slice, including child budget partitioning.
Verification: source/diff audit complete; executable CI unavailable.
Deployment: not claimed.
