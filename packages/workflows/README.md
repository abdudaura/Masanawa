# @masanawa/workflows

Canonical durable Work domain for Masanawa.

This package owns Task/WorkflowRun lifecycle contracts and repository ports. It does
not own Agent identity, Skills, Tools, provider calls, wallets, billing or channel UI.

Current checkpoint establishes:
- relationship-scoped Task identity/state;
- WorkflowRun identity linked to an immutable WorkflowVersion reference;
- compare-and-swap repository contracts;
- terminal lifecycle invariants and checkpoint revision references.

PostgreSQL persistence, workflow graph definitions, leasing/fencing, resumable checkpoint
payloads, approvals/timers and compensation remain later checkpoints. Do not claim
service-restart-safe durable execution until those are implemented and qualified.
