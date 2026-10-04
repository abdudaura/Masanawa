# Workflow / WorkflowVersion graph contracts

Status: Task 084 foundational implementation  
Package: `@masanawa/workflows`

## Boundary

This package defines Masanawa's immutable workflow-definition graph. It does not
own WorkflowRun/Task execution state, leases, retries, checkpoints, approvals,
schedules, side-effect receipts or persistence. Those belong to Tasks 085+.

The v1 graph is intentionally deterministic and acyclic. Bounded repetition is
expected to be modeled later through explicit workflow/runtime constructs rather
than implicit structural cycles in a WorkflowVersion.

## Canonical model

A `Workflow` is tenant-scoped identity and descriptive metadata.

A `WorkflowVersion` binds:

- one canonical Workflow;
- one immutable version number;
- one normalized graph;
- one deterministic SHA-256 graph signature;
- one creation instant.

A graph contains:

- one or more explicit entry nodes;
- bounded immutable nodes;
- bounded immutable directed edges;
- typed executor references;
- explicit terminal sinks.

## Node kinds

- `executor` — executes a pinned Skill, Tool, subworkflow, agent strategy or
  system executor reference.
- `decision` — routes over labeled outgoing edges using a pinned executor
  reference; the executor may classify, but runtime authorization remains
  external.
- `wait` — a graph-level wait point; durable timer/request state belongs to
  later workflow-run tasks.
- `join` — explicit fan-in node requiring at least two incoming edges.
- `terminal` — explicit sink and the only node kind allowed to have no
  outgoing edge.

Fan-out is represented by multiple unconditional outgoing edges from an
eligible non-decision node. Conditional routing uses uniquely labeled outgoing
edges from a `decision` node.

## Structural invariants

Normalization rejects:

- duplicate node keys or duplicate edges;
- dangling edge endpoints;
- undeclared roots;
- entry nodes with incoming edges;
- unreachable nodes;
- cycles;
- implicit non-terminal sinks;
- terminal nodes with outgoing edges;
- joins with fewer than two incoming edges;
- decisions with fewer than two labeled outcomes;
- duplicate decision labels;
- labeled edges emitted by non-decision nodes;
- unsupported runtime-cast node kinds;
- missing or forbidden executor references;
- oversized graphs;
- malformed executor keys/versions;
- direct WorkflowVersion self-reference through a subworkflow node;
- supplied signatures that differ from the normalized graph signature.

## Deterministic signature

Nodes and edges are copied and sorted with host-independent lexical ordering
before signature calculation. The normalized graph is serialized into a
canonical payload and hashed as:

`sha256:<64 lowercase hex characters>`

Input array order therefore does not change WorkflowVersion identity.

The signature protects graph compatibility and checkpoint/version matching in
later tasks. It is not an authorization token.

## Executor references

Executor nodes never embed mutable implementation objects. They pin stable
references:

- exact `SkillVersionId`;
- exact `ToolVersionId`;
- exact `WorkflowVersionId` for subworkflows;
- named/versioned agent-strategy or system executors.

Current authorization, existence, tenant ownership, readiness and eligibility
must still be validated when a run is admitted. A graph reference does not
grant authority.

## Task 084 completion boundary

This implementation supplies the persistence-neutral immutable graph model and
its focused unit acceptance coverage. Task 084 must not be marked complete
until repository checks execute and the canonical task owner records evidence.

The new workspace package also requires a shared `pnpm-lock.yaml` importer.
That file is intentionally not edited in this workstream because another active
PR already owns lockfile changes.
