# Workflow Task checkout, lease and fencing

Status: Task 087 foundational implementation

## Boundary

Task 087 adds atomic checkout and fenced settlement for canonical Workflow Tasks.

It does **not** implement:

- heartbeat/lease renewal;
- expired-lease reclaim;
- stale-run adoption;
- checkpoints;
- retry/backoff/dead-letter policy;
- human approvals;
- schedules/timers;
- side-effect reconciliation.

Those remain Tasks 088+.

## Lease schema

Workflow Tasks now carry:

- `lease_owner`;
- monotonic `lease_fence`;
- `leased_at`;
- `lease_expires_at`.

A Task in `running` state must have complete lease custody. A non-running Task
must not retain lease owner/timestamps. The fence is never cleared on settlement;
it records lease generation and increments on each checkout.

## Atomic checkout

`checkoutWorkflowTasks`:

1. scopes by Tenant;
2. selects only `ready` Tasks;
3. orders deterministically by creation time/TaskId;
4. locks candidates with `FOR UPDATE SKIP LOCKED`;
5. transitions them to `running`;
6. increments Task revision;
7. preserves or establishes `started_at`;
8. increments `lease_fence`;
9. binds worker owner and expiry;
10. returns the leased Tasks after commit.

Independent workers can therefore checkout concurrently without receiving the
same ready Task.

## Fenced settlement

`settleWorkflowTaskLease` requires:

- exact Tenant + Task;
- current `lease_owner`;
- exact current `lease_fence`;
- current state `running`;
- an unexpired lease;
- settlement timestamp not earlier than Task start.

Supported settlement states in this slice:

- `completed`;
- `failed` with bounded failure metadata;
- `waiting` with bounded wait reason;
- `cancelled` with bounded cancellation reason.

Successful settlement increments Task revision and clears lease owner/timestamps.
The monotonic fence remains persisted.

Wrong owner, wrong/stale fence, expired lease, wrong state or stale chronology
all fail with `workflows.task_stale_lease`.

## PostgreSQL acceptance

The focused acceptance suite covers:

- multi-Task atomic checkout;
- concurrent `SKIP LOCKED` workers receiving distinct Tasks;
- initial fence allocation;
- stale owner rejection;
- stale fence rejection;
- successful fenced completion;
- expired lease rejection;
- failure/waiting metadata persistence;
- lease clearing on settlement.

Task 088 will own heartbeat, renewal, expired-lease reclaim and stale-run
adoption; none of those semantics are silently implemented here.

## Completion boundary

Task 087 remains open until the PostgreSQL acceptance suite actually executes
and passes under the repository's required PostgreSQL 18 verification path.
