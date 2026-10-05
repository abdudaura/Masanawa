# @masanawa/workflows — canonical durable Work boundary

Status: lifecycle/repository contract implemented; PostgreSQL persistence and graph executor still pending.

Owns durable Task and WorkflowRun truth, workflow checkpoints, pending human approvals,
restart semantics and later side-effect receipt/reconciliation. Interactive agent queues,
chat messages and AgentRun state are not workflow truth.

Implemented in the 2026-10-05 harness continuation:
- strict canonical Task lifecycle and transition rules;
- strict WorkflowRun lifecycle and transition rules;
- checkpoint contract with graph signature, committed state, executor state, edge state and
  pending approval IDs;
- bounded JSON checkpoint validation;
- present-authority access guards scoped by Relationship + Task/WorkflowRun identity;
- repository ports for create/read/list/transition/checkpoint operations;
- focused lifecycle/checkpoint regression tests.

Still required before claiming restart-safe durable Work:
- PostgreSQL Task/WorkflowRun/checkpoint persistence;
- graph/version compatibility checks during restore;
- present-authority revalidation on resumed mutation;
- pending human request/approval resume semantics;
- deterministic side-effect receipt/reconciliation integration;
- Gateway/harness composition against the persistent repository.

See `docs/AGENT-HARNESS.md` and
`docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md`.
