# Canonical Workflows runtime foundation — 2026-10-05

Owner/window: ChatGPT harness/workflows continuation after durable Work projection checkpoint.
Branch: `work/workflows-canonical-runtime-20261005`
Base: `1784a844240153f0d6ca5ffb63f67a898c337ebc`

Purpose:
1. Replace the empty `packages/workflows` placeholder with the canonical Task and WorkflowRun lifecycle boundary.
2. Define durable checkpoint/restart contracts without inventing a second agent/chat queue.
3. Preserve present-authority revalidation and immutable canonical IDs.

Owned paths:
- `packages/workflows/**`
- `docs/AGENT-HARNESS.md`
- this claim file
- top-level checkpoint docs only after the slice is complete

Boundaries:
- no PostgreSQL migration/storage implementation in this slice;
- no Gateway composition changes until the domain contract is stable;
- no direct billing/crypto/provider writes;
- Task/WorkflowRun state is durable business/work truth; AgentRun remains one execution attempt;
- checkpoints capture committed workflow state but never freeze authorization.

Acceptance:
- strict Task and WorkflowRun models with canonical IDs and bounded lifecycle transitions;
- repository ports for create/read/list/transition and workflow checkpoint append/read;
- checkpoint contract includes graph signature, committed/executor/edge state and pending approvals;
- terminal states cannot restart;
- present authority must scope Task/Workflow access;
- focused Vitest coverage for normalization, legal/illegal transitions and checkpoint validation;
- docs updated at checkpoint.

Status: active.
