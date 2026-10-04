# Workflow checkpoints and compatibility

Status: Task 089 foundational implementation

## Boundary

Task 089 adds immutable, versioned WorkflowRun checkpoints and exact restore
compatibility validation.

It does not implement retry/backoff/dead-letter policy, human approvals,
schedules, compensation or side-effect reconciliation.

## Checkpoint identity

A checkpoint is identified by:

- Tenant;
- WorkflowRun;
- exact WorkflowVersion;
- exact graph signature;
- schema version;
- positive sequence;
- parent checkpoint sequence;
- exact committed WorkflowRun revision.

Sequence 1 has no parent. Later checkpoints must reference a prior sequence.

## Payload contract

The checkpoint payload captures bounded committed workflow state in explicit
sections:

- run state;
- Task states;
- executor states;
- edge/fan-in delivery state;
- pending request state;
- iteration/superstep metadata;
- opaque evidence references.

All payload data is normalized into immutable JSON-like values with hard limits
on depth, strings, arrays, objects and section cardinality.

Non-finite numbers and non-plain objects are rejected.

Keys that attempt to restore executable authorization/credential state are
rejected. In particular, checkpoints cannot restore AuthorityContext,
permissions/capabilities, credentials, secrets or tokens as current authority.

A resumed workflow must reacquire/revalidate current authority separately.

## Fingerprint

Normalized payloads are deterministically serialized and SHA-256 fingerprinted.
The fingerprint is part of durable checkpoint identity.

Supplying a fingerprint that does not match the normalized payload is rejected.

## Durable storage

`workflows.checkpoints` is append-only.

The table is pinned by composite foreign key to the exact durable:

- Tenant;
- WorkflowRun;
- WorkflowVersion;
- graph signature.

Parent checkpoint lineage is also enforced by foreign key.

Database triggers reject UPDATE and DELETE, so checkpoint history cannot be
rewritten after commit.

## Append semantics

`appendWorkflowCheckpoint`:

1. verifies payload fingerprint;
2. locks/reads the current WorkflowRun;
3. verifies exact WorkflowVersion and graph signature;
4. requires the checkpoint's WorkflowRun revision to equal current committed
   Run revision;
5. appends the checkpoint transactionally;
6. reconciles exact replay at the same sequence;
7. rejects changed replay with `workflows.checkpoint_conflict`.

Stale Run revision fails with `workflows.checkpoint_stale_revision`.
Version/graph mismatch fails with `workflows.checkpoint_incompatible`.

## Restore lookup

`loadLatestCompatibleWorkflowCheckpoint` returns only the latest checkpoint
matching the exact:

- Tenant;
- WorkflowRun;
- WorkflowVersion;
- graph signature;
- checkpoint schema version.

An incompatible target returns no checkpoint rather than silently restoring
state created for another graph/version.

## Acceptance coverage

Focused tests cover:

- deterministic immutable payload normalization;
- fingerprint stability independent of object key order;
- checkpoint sequence/parent rules;
- forbidden restored-authority state;
- depth/cardinality/non-finite rejection;
- exact replay;
- changed replay conflict;
- stale Run revision;
- incompatible version/graph;
- missing parent rollback;
- latest compatible lookup;
- direct database UPDATE/DELETE rejection.

## Completion boundary

Task 089 remains open until unit + PostgreSQL 18 acceptance actually execute and
pass in the repository verification environment.

Task 090 owns retry/backoff/dead-letter semantics and is not implemented here.
