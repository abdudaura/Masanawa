# @masanawa/workflows — canonical boundary

Owns durable versioned workflow definitions and, in later tasks, workflow runs,
checkpoints, pending human requests, restart semantics and side-effect
receipts/reconciliation. Interactive Agent queues are not workflow truth.

The current Task 084 slice implements only the immutable
`Workflow`/`WorkflowVersion` graph contract:

- explicit entry nodes;
- sequential, fan-out, fan-in and conditional graph structure;
- pinned executor references;
- acyclic v1 validation;
- deterministic SHA-256 graph signatures;
- mutation-resistant normalized snapshots.

WorkflowRun/Task state begins in Task 085 and is deliberately not implemented
here.

See ADR-0008 and `docs/WORKFLOW-VERSION-GRAPH.md`.
