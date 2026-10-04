# Workflow human-in-loop requests

Status: Task 091 foundational implementation

## Boundary

Task 091 adds durable human-in-loop request custody for Workflow Tasks.

It does not replace Masanawa Security approvals. Consequential approval
authorization remains owned by the canonical `security.approvals` system.

## Request kinds

Workflow human requests are one of:

- `information` — collect bounded textual input;
- `confirmation` — collect a yes/no continuation decision;
- `approval` — wait on an existing canonical Security ApprovalId.

The value contract is immutable and pinned to Tenant, WorkflowRun, Task,
WorkflowVersion and graph signature.

## Opening a request

A new request may only be opened by the current leased Task generation.

The transaction:

1. checks for exact durable replay by HumanRequestId;
2. validates an approval reference when kind=`approval`;
3. requires the current Task worker + lease fence + unexpired lease;
4. moves the Task `running → waiting`;
5. sets `wait_reason=human_request:<RequestId>`;
6. clears lease/heartbeat custody;
7. inserts the pending human request.

Exact replay is checked before the lease guard. If the process lost the response
after commit, replay returns the existing request even though the original
worker no longer owns a lease.

A changed payload under the same HumanRequestId is a conflict.

Only one pending human request may exist per Task.

## Responses

Information requests accept one bounded string and resume the Task to `ready`.

Confirmation requests:

- `true` → answered and Task resumes to `ready`;
- `false` → rejected and Task becomes terminal `cancelled` with
  `human_request_rejected`.

Terminal response replay is idempotent only when the response matches exactly.
A conflicting second response is rejected.

## Approval-backed requests

Approval requests carry a canonical ApprovalId but do not copy authorization
state into the workflow table.

Opening requires the referenced approval to exist in the same Tenant and be
pending/approved and unexpired at request time.

Resolution reads the canonical Security approval in the same transaction while
the workflow request row is locked:

- pending + current → remain pending;
- approved + current → workflow request answered=true and Task resumes;
- denied, expired, revoked or otherwise unusable → workflow request rejected
  and Task is cancelled.

This preserves the rule that workflow state cannot manufacture approval.

## Durable schema

`workflows.human_requests` stores:

- exact workflow/task/version/graph binding;
- request kind/state/prompt;
- optional ApprovalId;
- request fingerprint;
- bounded response payload + response fingerprint;
- request/resolution timestamps.

A composite foreign key pins every request to the exact persisted Task identity,
WorkflowRun, WorkflowVersion and graph signature.

## Acceptance coverage

Focused PostgreSQL acceptance covers:

- fenced open;
- lost-response exact replay;
- changed-payload conflict;
- information answer and Task resume;
- exact terminal answer replay;
- conflicting second answer rejection;
- confirmation rejection → Task cancellation;
- real pending Security approval blocking resume;
- approved Security approval → Task ready;
- denied Security approval → request rejected + Task cancelled.

## Completion boundary

Task 091 remains open until PostgreSQL 18 acceptance executes and the canonical
production task evidence advances.
