# Workflow resume and present-authority revalidation — 2026-10-05

Owner/window: ChatGPT harness/workflows resume continuation.
Branch: `work/workflows-resume-revalidation-20261005`
Base: PR #154 head `f17b410e7936d8ea2ed59c457585f9197dfb70d4`
Purpose: complete the next harness durability slice after PostgreSQL Work persistence.

## Exact owned paths

- `docs/workstreams/workflows-resume-revalidation.md`
- `packages/workflows/src/resume.ts`
- `packages/workflows/src/resume.test.ts`
- append-only export in `packages/workflows/src/index.ts`
- `services/gateway/src/agent_harness_resume.ts`
- `services/gateway/src/agent_harness_resume.test.ts`

## Boundaries

- stacked on PR #154; do not edit its persistence/migration files;
- no mobile files;
- no billing/crypto/Commerce/provider state;
- no shared Gateway app/main composition;
- no WorkflowRun direct SQL;
- no frozen authority in checkpoints;
- no blind redispatch from `waiting_external`;
- no automatic bypass of pending approvals;
- terminal Work never restarts.

## Acceptance

- resume uses a fresh current AuthorityContext on every attempt;
- persisted run/checkpoint identity and revisions must agree;
- current WorkflowVersion graph signature must match the persisted checkpoint before execution;
- queued/running Work may resume only with exact compatible state;
- waiting_approval remains paused unless all referenced approvals are currently satisfied;
- waiting_external returns reconciliation-required and never calls the executor directly;
- completed/failed/cancelled are terminal;
- restart/retry returns deterministic dispositions;
- Gateway harness seam consumes the canonical resume plan without creating another work store.

Status: active.
