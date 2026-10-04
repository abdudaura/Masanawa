# Workflow Task heartbeat and crash recovery

Status: Task 088 foundational implementation

## Boundary

Task 088 extends Task 087 lease/fence custody with liveness renewal and
expired-lease adoption.

It does not implement checkpoint payloads/version compatibility, retry/backoff,
dead-letter policy, human approvals, schedules or side-effect reconciliation.

## Liveness metadata

Workflow Tasks gain:

- `heartbeat_at`;
- monotonic `adoption_count`.

`leased_at` is the initial liveness point for a fresh checkout. The first
heartbeat records `heartbeat_at`.

## Heartbeat

`heartbeatWorkflowTaskLease` succeeds only when:

- Tenant + Task match;
- Task is still `running`;
- worker is the current lease owner;
- fence is the current lease generation;
- lease has not expired.

A successful heartbeat:

- records current database time as `heartbeat_at`;
- extends `lease_expires_at`;
- leaves Task state, Task revision and lease fence unchanged.

Wrong owner, wrong fence, wrong state or expiry returns
`workflows.task_stale_lease`.

## Expired-lease adoption

`adoptExpiredWorkflowTasks`:

1. scopes stale running Tasks by Tenant;
2. selects only expired leases;
3. orders by expiry/TaskId;
4. uses `FOR UPDATE SKIP LOCKED`;
5. preserves the original `started_at`;
6. replaces lease owner;
7. increments `lease_fence`;
8. increments `adoption_count`;
9. increments Task revision;
10. establishes a fresh lease/heartbeat/expiry.

The fence increment permanently invalidates the crashed worker's old custody.

## Crash-recovery invariant

After adoption:

- the old worker cannot heartbeat or settle with its old owner/fence;
- the new owner may continue using the new fence;
- Task identity, WorkflowRun, WorkflowVersion, graph signature and original
  execution start remain unchanged.

This is recovery of execution custody, not creation of a new Task.

## Concurrency

Stale adoption uses `SKIP LOCKED`, so independent recovery workers cannot
adopt the same expired Task in the same recovery pass.

The acceptance suite covers:

- successful heartbeat extension;
- wrong owner/fence heartbeat rejection;
- expired heartbeat rejection;
- adoption fence/revision/recovery-count increments;
- original start-time preservation;
- stale crashed-worker settlement rejection after adoption;
- successful settlement by the adopter;
- concurrent recovery workers receiving different stale Tasks.

## Completion boundary

Task 088 remains open until focused PostgreSQL 18 acceptance actually executes
and passes. Task 089 owns durable checkpoint/version compatibility and is not
implemented by this slice.
