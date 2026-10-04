# Workflow schedules, occurrences and durable timers

Status: Task 092 foundational implementation

## Boundary

Task 092 defines deterministic Workflow schedules, durable occurrence identity
and timer materialization.

It does not implement Tool Operation reconciliation, compensation,
supersession, operator visibility or later workflow concerns.

## Schedule identity

A durable schedule is pinned to:

- Tenant;
- WorkflowRun;
- exact WorkflowVersion;
- exact graph signature;
- stable schedule key;
- target graph node;
- canonical correlation ID;
- outbox destination.

The schedule definition is fingerprinted and immutable after creation.

Only timer-progress fields may change:

- active/completed state;
- next sequence;
- next due time;
- updated timestamp.

## Supported schedule forms

### One-shot

A one-shot schedule has one exact due instant.

After sequence 1 is materialized, the schedule becomes completed and has no next
due time.

### Bounded interval

An interval schedule has:

- first due instant;
- positive interval milliseconds;
- optional maximum occurrence count;
- optional inclusive end boundary.

Occurrence timing is deterministic from first instant + sequence offset.

The canonical contract deliberately avoids implicit wall-clock calendar rules in
this task. More complex cron/calendar semantics can be layered later without
changing occurrence identity.

## Occurrence identity

Every materialized occurrence is uniquely identified by:

- Tenant;
- WorkflowRun;
- schedule key;
- positive sequence.

The durable occurrence stores:

- due time;
- target node;
- materialization time;
- canonical outbox event identity.

Occurrences are immutable. PostgreSQL rejects UPDATE and DELETE.

The outbox event ID is unique so a materialized occurrence cannot be rebound to
multiple publication identities.

## Atomic timer materialization

`materializeDueWorkflowOccurrences`:

1. selects due active schedules by Tenant;
2. orders by due time / WorkflowRun / schedule key;
3. locks with `FOR UPDATE SKIP LOCKED`;
4. creates one canonical `workflow.schedule.occurrence.v1` outbox event;
5. inserts the immutable occurrence;
6. advances or completes the schedule;
7. commits all changes in one transaction.

A failure at any point rolls back the occurrence, outbox publication and
schedule advancement together.

Concurrent timer workers therefore cannot materialize the same due schedule in
the same pass.

## Backlog behavior

A timer worker materializes at most one occurrence per selected schedule per
call.

An overdue interval schedule may therefore be processed repeatedly until its
next due time is in the future or its max/end boundary is reached. This avoids
one heavily overdue schedule monopolizing a timer batch.

## Replay semantics

`createWorkflowScheduleRecord` is idempotent by:

Tenant + WorkflowRun + schedule key.

Exact replay returns the current durable schedule even after progress.

Reuse of the same key with changed definition, version/graph, correlation or
destination fails with `workflows.schedule_conflict`.

## Database integrity

PostgreSQL enforces:

- exact WorkflowRun/WorkflowVersion/graph foreign-key custody;
- one-shot vs interval shape;
- active/completed next-due shape;
- immutable definition fields;
- immutable occurrence history;
- unique occurrence sequence;
- unique occurrence outbox event identity.

## Acceptance coverage

Focused unit and PostgreSQL coverage includes:

- exactly one occurrence for one-shot schedules;
- deterministic interval timing;
- max-occurrence and end-boundary stopping;
- definition fingerprint determinism;
- exact schedule replay;
- changed-definition conflict;
- one-shot atomic completion/outbox publication;
- bounded overdue interval catch-up;
- concurrent SKIP LOCKED timer workers;
- Run/version/graph drift rejection;
- direct definition and occurrence mutation rejection.

## Completion boundary

Task 092 remains open until its unit and PostgreSQL 18 acceptance suites actually
execute and pass in the repository verification environment.

Task 093 owns Tool Operation / receipt / reconciliation integration.
