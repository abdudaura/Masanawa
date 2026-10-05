# Workflow execution session coordinator — 2026-10-05

Owner/window: ChatGPT harness execution-session continuation.
Branch: `work/workflow-execution-session-20261005`
Base: PR #175 head `e82bf047aabd7a2522f5607e49151f5a8542ee83`
PR: #176

Purpose: provide one server-side lifecycle that turns a canonical resume decision into a
fenced execution session.

## Exact owned paths

- `docs/workstreams/workflow-execution-session.md`
- `packages/workflows/src/executor-session.ts`
- `packages/workflows/src/executor-session.test.ts`
- append-only export in `packages/workflows/src/index.ts`

No Gateway/mobile/channel, persistence/migration, finance or provider files are owned.

## Implemented

- canonical resume inspection always happens before lease acquisition;
- only `execute` dispositions may acquire a WorkflowRun executor lease;
- `waiting-approval`, `reconcile-external`, `blocked` and `terminal`
  dispositions are returned unchanged and never acquire execution ownership;
- executable result preserves exact WorkflowRun, checkpoint and `resumeFrom` data from
  the resume service;
- bounded lease duration is configured once for the coordinator;
- renew always targets the exact tenant/WorkflowRun/holder/fence from the session lease;
- close releases that exact fence;
- lease acquire/renew/release failures propagate to the Harness instead of being hidden;
- coordinator is provider-neutral and channel-neutral;
- source imports underlying Workflow modules directly, avoiding package self-import cycles.

## Verification

- Compare against PR #175 head: 5 commits ahead, 0 behind.
- Exact changed paths are the four claimed paths above.
- Final implementation head before this handoff update:
  `80027f7f66a9f18155484486e1d0c17eea8a608b`.
- GitHub exposes no workflow run for that final head, so no executable hosted CI pass is
  claimed.
- Focused tests are checked in for executable lease acquisition, non-executable
  no-lease behavior, exact renew/release, unsafe duration rejection and surfaced lease loss.

## Integration handoff

Canonical runtime sequence is now:

1. resume/revalidate current Work via #162;
2. open execution session through #176;
3. #176 acquires the durable fenced lease from #169/#173 only for executable Work;
4. executor performs bounded work;
5. executor-owned state/checkpoint commits go through #175;
6. renew through #176 while active;
7. close/release through #176 on clean stop;
8. any lease loss/fence failure stops execution and returns to resume/reconciliation.

The mobile app, WhatsApp and Telegram only render Work/progress and never receive lease
holder/fence values.

Implementation: complete within this isolated coordinator slice.
Verification: source/diff audit complete; executable hosted CI unavailable.
Deployment: not claimed.
