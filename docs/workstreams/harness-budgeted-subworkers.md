# Harness budgeted subworkers — 2026-10-05

Owner/window: ChatGPT Harness consolidation continuation.
Branch: `work/harness-budgeted-subworkers-20261005`
Base: PR #163 head `ff3ed30852ba4b3ebf8c2302333d19a986af92b5`
PR: #184

Purpose: consolidate AgentRun execution budgets onto the bounded-subworker Harness line
so delegated child AgentRuns cannot mint independent execution capacity.

## Exact owned paths

- `docs/workstreams/harness-budgeted-subworkers.md`
- `packages/agents/src/execution-budget.ts`
- `packages/agents/src/execution-budget.test.ts`
- `packages/agents/src/execution-budget-partition.ts`
- `packages/agents/src/execution-budget-partition.test.ts`
- `packages/agents/src/subworker-budget.ts`
- `packages/agents/src/subworker-budget.test.ts`
- append-only exports in `packages/agents/src/index.ts`

No database/migration, Gateway/mobile/channel, finance or provider-dispatch files are owned.

## Consolidated execution budgets

- immutable per-AgentRun budget envelope;
- wall-clock ceiling;
- input, output and combined inference-token ceilings;
- Tool-dispatch ceiling;
- child-AgentRun ceiling;
- provider-cost microunit ceiling bound to one explicit currency;
- inference preflight before dispatch plus monotonic verified-usage recording;
- Tool preflight/recording;
- child-run preflight/recording;
- stale time, wrong AgentRun, wrong currency, negative/malformed usage and budget
  exhaustion fail closed;
- child local ceilings are derived only from the parent's currently remaining envelope.

Provider cost remains runtime metering evidence only. It is not a wallet, ledger,
reservation, billing or settlement authority.

## Budgeted subworker admission

- parent budget and parent usage must both bind the exact parent AgentRun;
- requested child ceiling is derived before any child admission attempt;
- one parent child-run slot is reflected in the next usage snapshot;
- a durable reservation port must compare-and-set that parent usage advance **before**
  the child AgentRun is created;
- if reservation fails, child creation is never attempted;
- if child creation fails after reservation, the capacity may remain conservatively
  consumed rather than risking an unbudgeted child;
- reservation response must match the complete expected parent usage identity/counters,
  not just child count;
- #163 authority attenuation, Skill subset, lineage, fan-out/depth and safety-policy
  checks still apply to the child;
- returned child AgentRun identity and parent lineage must match the child budget;
- the child budget is only a local ceiling. Every actual child inference/Tool/child
  action must also be charged to the shared parent/root meter by durable integration.

## Persistence boundary

No Agent migration number was consumed. Current repository access proved existing Agent
migrations 0003 and 0006 but did not safely expose the complete 0004/0005 ownership, so
this branch intentionally does not guess a migration slot.

The durable integration owner must implement
`AgentExecutionBudgetReservationPort.reserveChildAdmission()` with optimistic
compare-and-set semantics against canonical AgentRun custody before enabling child
execution in production.

## Verification

- branch is 12 commits ahead and 0 behind PR #163 head;
- exact diff is confined to the eight claimed paths above;
- Foundation CI run `37304649284` failed before executing any step; job
  `111745293329` exposes `steps: null`. This is hosted runner non-execution, not a
  TypeScript/test verdict;
- focused tests cover inference limits, Tool limits, child limits, wall clock,
  binding/currency, child partitioning, reservation-before-create, reservation failure,
  over-capacity rejection and mismatched child custody.

## Integration handoff

1. #163 remains the canonical bounded/attenuated child-AgentRun admission base.
2. #184 is the consolidation path for execution budgets; standalone #165 is superseded.
3. Root AgentRun admission creates/loads a server-owned budget; clients never choose
   trusted ceilings.
4. Durable budget reservation must succeed before a child AgentRun is created.
5. Provider-verified inference usage and Tool/child admissions update the same shared
   root/parent meter.
6. Concurrent children require CAS/serialization so they cannot spend the same remaining
   capacity.
7. Mobile/WhatsApp/Telegram may display truthful failure/attention state but never own or
   mutate execution budgets.

Implementation: complete within this isolated consolidation slice.
Verification: source/diff audit complete; executable hosted CI unavailable.
Deployment: not claimed.
