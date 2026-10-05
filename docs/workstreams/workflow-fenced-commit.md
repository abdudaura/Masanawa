# Workflow fenced commit boundary — 2026-10-05

Owner/window: ChatGPT harness fenced-commit continuation.
Branch: `work/workflow-fenced-commit-20261005`
Base: PR #173 head `ba621a087db55fd9118460d60037010ff41ed9f4`
PR: #175

Purpose: make WorkflowRun checkpoint/state commits fail closed when an executor has been
fenced or expired.

## Exact owned paths

- `docs/workstreams/workflow-fenced-commit.md`
- `packages/workflows/src/executor-commit.ts`
- `packages/workflows/src/executor-commit.test.ts`
- append-only export in `packages/workflows/src/index.ts`
- `adapters/storage/postgres/src/workflows/executor-commit.ts`
- `adapters/storage/postgres/src/workflows/executor-commit.integration.test.ts`
- append-only export in `adapters/storage/postgres/src/index.ts`

No existing WorkflowRun repository, migration, Gateway/mobile/channel, finance or
provider files are owned.

## Implemented

- explicit `WorkflowExecutorCommitRepository` contract for fenced WorkflowRun
  transitions and checkpoint commits;
- bounded normalized holder/fence input;
- Postgres implementation locks the canonical WorkflowRun row first and executor-lease
  row second in a fixed order;
- present AuthorityContext is revalidated against current Security policy inside the
  same transaction;
- normal WorkflowRun access rules and transition rules still apply;
- exact live holder/fence is checked from the locked persisted lease row;
- expired/released/stale leases fail before mutation;
- checkpoint append uses the existing canonical checkpoint invariants:
  expected run revision, monotonic checkpoint revision, non-terminal run, exact
  pending-approval custody and exact replay semantics;
- state transition uses the existing canonical transition graph, optimistic run revision,
  failure-code rules, pending-approval rules and terminal timestamps;
- because the lease row remains locked until transaction commit, takeover cannot occur
  between fence verification and WorkflowRun/checkpoint mutation;
- exact checkpoint replay still requires current Security authority and the current live
  executor fence; a historical stale worker cannot use replay as a write/recovery bypass.

## Verification

- Compare against PR #173 head: 7 commits ahead, 0 behind.
- Exact changed paths are the seven claimed paths above.
- Final implementation head before this handoff update:
  `f49b397c3be12d110e89bbdae6cf002dd1139f4f`.
- Foundation CI runs `37297397698` and `37297397579` both failed before executing
  any job step; jobs `111721763080` and `111721762409` expose `steps: null`.
  This is hosted runner non-execution, not a TypeScript/PostgreSQL verdict.
- Focused PostgreSQL coverage is checked in for successful fenced checkpoint commit,
  exact checkpoint replay, stale-worker refusal after release/takeover, current-worker
  transition and current-Security-policy revalidation.

## Integration handoff

1. Runtime must obtain executable Work through the canonical resume service (#162).
2. It must acquire/renew the durable executor lease (#169/#173).
3. **All executor-owned WorkflowRun state/checkpoint commits must use this fenced commit
   repository**, not the unfenced general repository path.
4. Lease loss/renew failure means stop execution immediately. Any uncertain external
   outcome goes to canonical reconciliation, never blind redispatch.
5. Human/user/admin cancellation may continue through separately authorized canonical
   control paths; an executor lease must not block legitimate higher-level control.
6. Mobile/WhatsApp/Telegram consume truthful Work projections only and never submit
   holder/fence tokens.

Implementation: complete within this isolated fence-aware commit slice.
Verification: source/diff audit complete; executable hosted CI unavailable.
Deployment: not claimed.
