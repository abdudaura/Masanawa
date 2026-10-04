# Workflow usage evidence and operator visibility

Status: Task 095 foundational implementation

## Boundary

Task 095 adds workflow-owned usage/cost evidence and a privacy-safe operator
projection.

It does not replace:

- AgentRun telemetry/evidence;
- provider billing truth;
- canonical Operation/receipt/reconciliation truth;
- Task 094 cancellation/compensation semantics;
- production SLO/alerting infrastructure.

Those remain owned by their existing domains/tasks.

## Immutable usage evidence

A usage record binds measured workflow resource usage to:

- Tenant;
- WorkflowRun;
- optional Task;
- optional canonical Operation;
- optional Provider;
- category;
- provider/model keys where relevant;
- integer input/output units;
- integer cost micros;
- integer latency milliseconds;
- opaque evidence key;
- occurrence instant.

The record contains no prompt, model response body, human-request text,
credential, secret, approval body or provider payload.

All numeric values are non-negative safe integers.

The evidence fingerprint deterministically covers the exact record identity and
measured values.

## Durable custody

`workflows.usage_evidence` is append-only.

PostgreSQL enforces:

- exact WorkflowRun foreign-key custody;
- optional Task existence;
- Task → WorkflowRun scope matching;
- optional Operation existence;
- Operation → Tenant scope matching;
- supported usage categories;
- non-negative measured values;
- unique Tenant + usage event identity;
- unique Tenant + evidence key;
- immutable UPDATE/DELETE behavior.

Exact replay returns the existing row. Reuse of an evidence/event identity with
changed measurements fails with `workflows.usage_conflict`.

## Operator summary

`readWorkflowOperatorSummary` returns only privacy-safe operational state:

- WorkflowRun identity/version/graph/state/revision;
- Task state counts;
- retry dispositions;
- pending human-request count;
- canonical Operation state counts;
- usage record count;
- total input/output units;
- total cost micros;
- total measured latency.

The summary intentionally excludes:

- Task payloads;
- prompts or messages;
- human-request prompts/responses;
- retry failure messages;
- Operation request fingerprints;
- authority scope hashes;
- provider payloads/receipts;
- credentials or secrets.

Operator visibility therefore exposes state and measured resource truth without
becoming a content inspection surface.

## Cross-domain projection

Retry/attention counts are read from canonical Task retry state owned by Task
090.

Pending human-request count is read from Task 091 truth.

Operation counts are projected from Task 093 bindings plus canonical
`events.operations`.

Task 095 does not copy or mutate any of those domain records.

## Acceptance coverage

Focused unit/PostgreSQL coverage includes:

- usage value bounds and deterministic fingerprinting;
- safe integer aggregate overflow rejection;
- exact append replay;
- changed replay conflict;
- database UPDATE/DELETE immutability;
- Task → WorkflowRun scope mismatch rejection;
- Operation → Tenant mismatch rejection;
- populated operator summary across Task/retry/human/Operation state;
- measured usage/cost aggregation;
- proof that summary serialization does not contain hidden prompts/failure
  details/request fingerprints;
- Tenant/WorkflowRun isolation.

## Completion boundary

Task 095 remains open until unit and PostgreSQL 18 acceptance actually execute
and pass in the repository verification environment.

Task 096 owns the full restart/no-duplicate-side-effect workflow golden journey.
