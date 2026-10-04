# Workflow control semantics

Status: Task 094 foundational implementation

## Boundary

Task 094 adds durable workflow cancellation, supersession and compensation control.

Cancellation stops future/unstarted work but never rewrites a currently leased
Task or erases already-admitted external side effects. Compensation is modeled
as new canonical Operation work linked to the original Operation.

## Cancellation

A control command is idempotent by a durable RequestId/fingerprint.

On admission:

- pending/ready/waiting Tasks are cancelled immediately;
- currently running leased Tasks are left untouched;
- the run enters `cancel-requested` while any running Task remains;
- a database trigger rejects any later Task activation to `ready` or
  `running` for the controlled run.

Finalization occurs only after no Task remains running. The WorkflowRun then
becomes terminal `cancelled`.

A running Task may still settle under its current valid lease after cancellation
was requested. Its already-admitted work remains part of history.

## Supersession

Supersession is cancellation plus an explicit successor WorkflowRun identity.

The successor must:

- exist in the same Tenant;
- belong to the same Workflow identity;
- differ from the original run;
- still be pending/running/waiting.

The original WorkflowRun is terminally cancelled while workflow control records
the durable state `superseded` and the exact successor run.

## Compensation

Control state tracks compensation independently:

- `none`
- `required`
- `compensating`
- `compensated`
- `failed`

A compensation step links:

- one original canonical Operation already bound to this WorkflowRun as
  `primary` or `verification`;
- one distinct canonical Operation already bound as `compensation`.

The database rejects compensation unless the original Operation is in a state
where a side effect may have occurred (`accepted|partial|unknown|reconciling|
succeeded`) and the compensation Operation is still pre-dispatch.

Compensation step history is forward-only:

- planned → running | failed
- running → succeeded | failed

A step cannot become `succeeded` unless its canonical compensation Operation
is actually `succeeded`. Workflow control never fabricates provider success.

Original Operation state, receipts and reconciliation records are never
overwritten by compensation.

## Activation guard

A PostgreSQL trigger blocks Task insertion/update into `ready` or `running`
once the run has control state:

- cancel-requested
- cancelled
- superseded

This protects existing admission/checkout code without requiring those older
workstreams to be modified.

## Acceptance coverage

Focused PostgreSQL acceptance covers:

- immediate cancellation of unstarted work;
- blocking late Task admission;
- cancellation requested while a leased Task continues untouched;
- finalization only after running work settles;
- same-Workflow successor validation;
- durable supersession identity;
- compensation binding to original + new canonical Operations;
- rejection of compensation success before Operation success;
- final compensation success while preserving original Operation history.

## Completion boundary

Task 094 remains open until PostgreSQL 18 acceptance executes and canonical
production task evidence advances.
