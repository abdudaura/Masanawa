# WorkflowRun / Task canonical state

Status: Task 085 foundational implementation  
Package: `@masanawa/workflows`

## Boundary

This slice defines persistence-neutral canonical state for `WorkflowRun` and
`Task`. It does not implement database persistence, transactional admission,
outbox delivery, leasing/fencing, retries, checkpoints, human approvals,
schedules, compensation or side-effect reconciliation.

Those remain Tasks 086+.

## WorkflowRun

A WorkflowRun is pinned to:

- Tenant;
- Workflow;
- exact WorkflowVersion;
- exact WorkflowVersion graph signature;
- optional initiating User.

Canonical states:

- `pending`
- `running`
- `waiting`
- `completed`
- `failed`
- `cancelled`

Every snapshot has a positive optimistic `revision`. Transitions require the
expected revision and increment exactly once.

Terminal states are immutable in this value model.

## Task

A Task is pinned to:

- Tenant;
- WorkflowRun;
- exact WorkflowVersion;
- exact graph signature;
- one normalized graph `nodeKey`;
- one bounded root/parent lineage.

Canonical states:

- `pending`
- `ready`
- `running`
- `waiting`
- `completed`
- `failed`
- `cancelled`

A root Task must self-root at depth 0 with no parent. A child Task must have a
parent, a distinct root, and bounded depth. `assertChildTaskLineage` verifies
the child against the actual parent Task rather than trusting self-declared
lineage.

## Transition semantics

WorkflowRun:

- pending → running | failed | cancelled
- running → waiting | completed | failed | cancelled
- waiting → running | completed | failed | cancelled
- terminal → no further transition

Task:

- pending → ready | failed | cancelled
- ready → running | failed | cancelled
- running → waiting | completed | failed | cancelled
- waiting → ready | running | completed | failed | cancelled
- terminal → no further transition

The model deliberately permits cancellation before start without fabricating a
`startedAt`. A Task that has already started may return from `waiting` to
`ready` while retaining its original `startedAt`.

## State-specific metadata

- `waiting` requires a bounded wait reason.
- `failed` requires bounded structured failure code/message.
- `cancelled` requires a bounded cancellation reason.
- terminal states require `terminalAt`.
- pending states cannot carry a start timestamp.
- timestamps must preserve created ≤ started/terminal ≤ updated ordering.

Metadata for one state cannot leak into another state.

## Integrity helpers

`assertWorkflowRunMatchesVersion` verifies exact Tenant/Workflow/
WorkflowVersion/graph-signature pinning against a canonical WorkflowVersion.

`assertTaskBelongsToRun` verifies that a Task is pinned to the same
Tenant/WorkflowRun/WorkflowVersion/graph signature.

`assertChildTaskLineage` verifies parent Task identity, shared run/version
pinning, root identity and depth increment.

These checks do not replace database foreign keys or transactional locks in
later tasks.

## Deliberate exclusions

Task 085 does not define:

- task admission/outbox truth;
- runnable queue semantics;
- leases, fencing tokens or worker ownership;
- retry counters/backoff;
- checkpoint payloads;
- human approval/request state;
- schedules/timers;
- operation receipts;
- compensation/supersession.

Those semantics must not be inferred from these value contracts.

## Completion boundary

This implementation supplies the canonical state/value layer and focused unit
coverage. Task 085 must not be marked complete until repository checks execute
and the canonical production task owner records verification evidence.
