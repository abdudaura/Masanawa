# Harness budgeted subworkers — 2026-10-05

Owner/window: ChatGPT Harness consolidation continuation.
Branch: `work/harness-budgeted-subworkers-20261005`
Base: PR #163 head `ff3ed30852ba4b3ebf8c2302333d19a986af92b5`

Purpose: consolidate AgentRun execution budgets (#165) onto the bounded-subworker Harness line (#163) so delegated child AgentRuns cannot mint independent execution capacity.

## Exact owned paths

- `docs/workstreams/harness-budgeted-subworkers.md`
- `packages/agents/src/execution-budget.ts`
- `packages/agents/src/execution-budget.test.ts`
- `packages/agents/src/execution-budget-partition.ts`
- `packages/agents/src/execution-budget-partition.test.ts`
- `packages/agents/src/subworker-budget.ts`
- `packages/agents/src/subworker-budget.test.ts`
- append-only exports in `packages/agents/src/index.ts`

## Boundaries

- no database/migration changes;
- no Gateway/mobile/channel composition;
- no billing/crypto/Commerce/provider dispatch;
- budget values are server-owned execution limits, not financial settlement;
- a child local budget is only a ceiling; all actual child usage must still charge the shared parent/root meter;
- subworker authority attenuation from #163 remains mandatory.

## Acceptance

- parent budget/usage must be current and bound to the parent AgentRun;
- child AgentRun count preflight occurs before admission;
- child local ceilings cannot exceed parent remaining time/tokens/tools/child slots/provider cost;
- one direct-child slot is accounted for before nested-child allocation;
- child authority + Skill subset + lineage checks from #163 still run;
- child result carries both attenuated authority and bounded child budget;
- no fresh unlimited child budget path exists.

Status: active.
