# Workflow resume executor — 2026-10-05

Owner/window: ChatGPT harness/workflows continuation after PostgreSQL Work persistence.
Branch: `work/workflows-resume-executor-20261005`
Base: `865a9b1ddb2aff276a1ad0f81a8ec4e5492c27df`

Purpose:
1. Resume running WorkflowRuns safely from persisted checkpoints after process restart.
2. Reject graph/version drift before resumed execution.
3. Revalidate current authority before every resumed node.
4. Keep approval/external waits paused until their owning domain explicitly clears them.

Owned paths:
- `packages/workflows/src/executor.ts` and focused tests
- `packages/workflows/src/workflow-run.ts` and tests only for atomic checkpoint/state commit
- `packages/workflows/src/index.ts`
- `adapters/storage/postgres/src/workflows/repository.ts` and focused persistence tests
- `docs/AGENT-HARNESS.md`
- this claim file
- mandatory checkpoint docs after merge

Boundaries:
- no provider/domain side effects in the workflow package;
- no automatic approval or automatic external-wait clearing;
- graph/checkpoint incompatibility fails closed;
- injected node execution runs only after the current-authority gate;
- execution is step-bounded.

Acceptance:
- canonical graph definition/validation;
- resume at checkpoint current node, or graph entry when no checkpoint exists;
- graph signature and WorkflowVersionId must match;
- only declared graph edges may advance;
- current-authority gate runs immediately before each node;
- atomic checkpoint plus WorkflowRun state transition repository contract;
- waiting and terminal runs do not execute nodes;
- tests cover restart resume, mismatch, illegal edge, authority rejection and step bound.

Status: active.
