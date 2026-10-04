# Workflow Task retry, backoff and attention handling

Status: Task 090 foundational implementation

## Boundary

Task 090 defines deterministic retry policy and durable retry disposition for
leased Workflow Tasks.

It does not implement human approvals, schedules, Tool Operation reconciliation,
compensation/supersession, or operator dashboards.

## Deterministic policy

A retry policy contains:

- max attempts;
- base delay;
- max delay;
- integer multiplier.

Backoff is deterministic capped exponential backoff. No random jitter is part of
the canonical policy layer.

A failure signal includes:

- current failure count;
- whether the failure is retryable;
- whether the external outcome is uncertain;
- whether operator attention is required;
- stable reason code.

Disposition rules are ordered:

1. uncertain outcome or explicit operator-attention requirement →
   `needs-attention`;
2. non-retryable or attempt ceiling reached → `dead-letter`;
3. otherwise → `retry-scheduled` with bounded deterministic delay.

An uncertain external outcome is therefore never blindly retried.

## Durable retry state

`workflows.task_retry_state` stores the current Task retry disposition:

- failure count;
- disposition;
- reason code;
- safe error code/message;
- due timestamp for retry;
- last failure timestamp.

Supported dispositions:

- `retry-scheduled`;
- `ready`;
- `dead-letter`;
- `needs-attention`.

Only retry-scheduled rows may carry `next_attempt_at`.

## Fenced failure recording

`recordWorkflowTaskFailure` requires:

- exact Tenant + Task;
- current lease owner;
- exact lease fence;
- unexpired lease;
- settlement timestamp not before Task start;
- failure count exactly one greater than the durable prior count.

This prevents stale/duplicated workers from manufacturing additional retry
attempts.

For retry-scheduled failures, the Task becomes `waiting` with
`retry_backoff`, the lease is cleared, and a due timestamp is persisted.

For dead-letter or needs-attention, the Task becomes terminal `failed` with
safe failure metadata and no automatic retry time.

## Due retry release

`releaseDueWorkflowTaskRetries`:

1. selects due retry-scheduled rows with `FOR UPDATE SKIP LOCKED`;
2. verifies the Task is still waiting for retry backoff;
3. atomically transitions the Task to `ready`;
4. increments Task revision;
5. marks retry state `ready`;
6. atomically publishes a canonical `workflow.task.retry-ready.v1` outbox event.

The retry-ready outbox uses the original Task admission correlation/destination
and causally references the original Task-ready event.

This preserves Masanawa's transactional publication custody; retries do not
depend on hidden polling-only work.

## Fence progression

When a released retry is checked out again, the Task's persisted lease fence
increments. The prior worker's fence therefore remains permanently stale.

## Acceptance coverage

Focused coverage includes:

- deterministic capped exponential backoff;
- retry ceiling;
- uncertain → needs-attention;
- non-retryable/exhausted → dead-letter;
- retry scheduling;
- stale owner/fence rejection;
- failure-count continuity;
- due release;
- retry-ready outbox publication;
- fence increment on re-checkout;
- no automatic release for needs-attention;
- concurrent due-release workers selecting distinct Tasks exactly once.

## Completion boundary

Task 090 remains open until unit and PostgreSQL 18 acceptance actually execute
and pass in the repository verification environment.

Task 091 owns human-in-loop pending requests and approvals.
