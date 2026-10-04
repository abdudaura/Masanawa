# Transactional Workflow Task admission

Status: Task 086 foundational implementation

## Boundary

Task 086 persists canonical WorkflowRun/Task identity and atomically publishes
newly runnable Task work through Masanawa's existing `events.outbox`.

It does not create a second queue.

Leasing/fencing, worker ownership, heartbeats, stale-run adoption, checkpoints,
retries/backoff/dead-letter policy, approvals, schedules and compensation begin
in later tasks.

## Durable schema

`workflows.workflow_runs` persists:

- Tenant/WorkflowRun/Workflow/WorkflowVersion identity;
- exact graph signature;
- canonical Task 085 state and revision;
- lifecycle timestamps and state-specific failure/wait/cancellation metadata.

`workflows.tasks` persists:

- Tenant/Task/WorkflowRun identity;
- exact WorkflowVersion + graph signature;
- graph node key;
- parent/root/depth lineage;
- canonical Task state and revision;
- durable admission RequestId + canonical admission fingerprint;
- lifecycle metadata.

PostgreSQL independently enforces canonical ID prefixes, state sets,
state-specific metadata, timestamp ordering, root/child shape and Task→Run
version/signature custody.

A lineage trigger validates non-root Tasks against the actual persisted parent:
same Tenant, WorkflowRun, WorkflowVersion, graph signature, root Task and exactly
parent depth + 1.

## Atomic admission

`admitWorkflowTask` accepts only a fresh runnable Task:

- state `ready`;
- revision 1;
- no start/terminal timestamp;
- no wait/failure/cancellation metadata.

Within one PostgreSQL transaction it:

1. inserts the canonical Task with a durable admission fingerprint;
2. creates one canonical `events.outbox` record;
3. commits both together.

The outbox event is:

- type: `workflow.task.ready.v1`;
- aggregate type: `workflow-task`;
- aggregate ID: canonical TaskId;
- payload pinned to Task/Run/WorkflowVersion/graph/node/admission RequestId.

A workflow-owned unique partial index prevents multiple ready-admission outbox
records for the same Task.

## Replay semantics

The durable `admission_request_id` is unique per Tenant.

Exact replay returns the existing Task and the same outbox event identity.

Reuse of the RequestId for changed Task identity, graph/version, destination,
correlation/causation or other admission payload fails with
`workflows.task_admission_conflict`.

An existing Task admission without its expected outbox row is treated as a
durability conflict (`workflows.task_outbox_missing`) rather than silently
creating a fresh side effect.

WorkflowRun creation is likewise idempotent by Tenant + WorkflowRunId and
rejects changed durable state with `workflows.run_conflict`.

## Rollback guarantee

Task insertion and outbox insertion share the same database transaction.
Acceptance coverage intentionally triggers an outbox constraint failure after
Task insert and verifies that neither Task nor outbox row survives rollback.

Concurrent exact admission from independent PostgreSQL pools is also covered:
both callers reconcile to one Task and one outbox identity.

## Migration dependency

The workflow migration depends on the canonical Events foundation because it
references `events.outbox` and adds a workflow-specific uniqueness index.
Migration orchestration must apply the Events migration root before Workflows.

`workflowMigrationRoots()` exposes only the workflow-owned root; callers remain
responsible for composing required dependency roots.

## Package dependency note

The PostgreSQL adapter intentionally does not yet import
`@masanawa/workflows` because active PR #100 owns
`adapters/storage/postgres/package.json`. Its persistence input shapes use
existing canonical contract IDs and are structurally compatible with Task 085
values. The integration owner should add the package dependency when shared
manifest/lockfile work is reconciled.

## Completion boundary

Task 086 implementation is present, but completion still requires the focused
PostgreSQL acceptance suite to actually execute and pass in PostgreSQL 18 plus
canonical task-progress evidence.
