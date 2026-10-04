# Workflow Task retry policy

Status: Task 090 foundational implementation

## Boundary

Task 090 adds deterministic retry policy, durable retry scheduling, dead-letter
disposition and needs-attention escalation for Workflow Tasks.

It does not own human approval/request semantics (Task 091), durable timers and
schedules (Task 092), Tool receipts/reconciliation (Task 093), or workflow
compensation/supersession (Task 094).

## Deterministic policy

`WorkflowRetryPolicy` defines:

- stable key + positive version;
- total `maxAttempts` (1-20);
- fixed, linear or exponential backoff;
- bounded base and maximum delay;
- bounded multiplier;
- exhaustion disposition: `dead-letter` or `needs-attention`.

There is intentionally no random jitter in the canonical calculation.
Equivalent inputs therefore produce the same delay.

## Failure classification

The domain decision maps:

- `retryable` → retry-scheduled while attempts remain;
- `terminal` → dead-letter;
- `ambiguous` → needs-attention;
- `unsafe-retry` → needs-attention.

Once `maxAttempts` is reached, the policy's exhaustion disposition applies.

## Durable retry state

`workflows.task_retry_state` persists per Task:

- policy key/version/max attempts;
- contiguous completed-attempt count;
- disposition;
- exact next-attempt timestamp when scheduled;
- last safe failure code/message;
- retry-state revision;
- creation/update timestamps.

Durable dispositions are:

- `retry-scheduled`
- `retry-ready`
- `dead-letter`
- `needs-attention`

## Fenced failure recording

`recordWorkflowTaskFailure` requires the current running Task lease:

- Tenant + Task;
- worker owner;
- current lease fence;
- unexpired lease;
- admitted failure timestamp.

It rejects stale workers/fences and policy changes mid-sequence.

For `retry-scheduled`, the Task moves to `waiting` with
`wait_reason='retry_scheduled'`, lease custody is cleared, and
`next_attempt_at` is persisted.

For `needs-attention`, the Task remains non-terminal in `waiting` with
`wait_reason='needs_attention'`, preserving a future Task 091 operator/human
resolution path.

For `dead-letter`, the Task moves to terminal `failed` with bounded failure
metadata.

## Due retry promotion

`promoteDueWorkflowTaskRetries` atomically:

1. selects due retry-scheduled rows for one Tenant;
2. locks retry + Task rows with `FOR UPDATE ... SKIP LOCKED`;
3. changes Task `waiting → ready`;
4. clears retry wait reason;
5. changes retry disposition to `retry-ready`;
6. clears `next_attempt_at`.

Concurrent schedulers therefore cannot promote the same retry twice.

The next normal Task checkout allocates a new lease fence, making the prior
worker generation stale.

## Acceptance coverage

Focused PostgreSQL acceptance covers:

- scheduled retry persistence;
- no early checkout before due time;
- exact due promotion;
- higher fence on the next checkout;
- stale prior-worker rejection;
- dead-letter terminal state;
- needs-attention non-terminal waiting state;
- contiguous attempt enforcement;
- policy-version pinning;
- concurrent due-promotion single-winner behavior.

## Completion boundary

Task 090 remains open until PostgreSQL 18 acceptance actually executes and the
canonical production task record advances with verification evidence.
