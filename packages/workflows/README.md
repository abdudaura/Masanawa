# @masanawa/workflows — canonical durable Work boundary

Status: lifecycle contracts and PostgreSQL persistence implemented; graph executor/resume orchestration still pending.

Owns durable Task and WorkflowRun truth, workflow checkpoints, pending human approvals,
restart semantics and later side-effect receipt/reconciliation. Interactive agent queues,
chat messages and AgentRun state are not workflow truth.

Implemented:
- strict canonical Task lifecycle and transition rules;
- strict WorkflowRun lifecycle and transition rules;
- checkpoint contract with graph signature, committed state, executor state, edge state and pending approval IDs;
- bounded JSON checkpoint validation;
- present-authority access guards scoped by Relationship, optionally narrowed by Task/WorkflowRun IDs;
- repository ports for create/read/list/transition/checkpoint operations;
- PostgreSQL `workflows` schema with immutable history guards and DB-level legal transition enforcement;
- optimistic revision checks for Task/WorkflowRun mutation;
- atomic monotonic Workflow checkpoint append + run checkpoint revision update;
- exact checkpoint replay and conflicting-revision rejection;
- transaction-local current policy/revocation revalidation on repository operations;
- migration owner registered in platform product readiness;
- integration coverage for repository-instance restart recovery, stale revisions, terminal protection,
  checkpoint replay/conflict and stale policy rejection.

Still required before claiming complete autonomous long-running Work:
- graph/version compatibility enforcement during resume;
- a concrete workflow executor with bounded graph progression;
- present-authority revalidation immediately before each resumed consequential mutation;
- pending human approval pause/resume orchestration;
- deterministic side-effect receipt/reconciliation integration;
- Gateway/harness composition that creates/resumes persisted Work automatically.

See `docs/AGENT-HARNESS.md` and
`docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md`.
