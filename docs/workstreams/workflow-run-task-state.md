# Workstream claim — workflow-run-task-state

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 19:26 Africa/Lagos
Base: work/workflow-version-graph-20261004 @ 3a688761b29be43778b19101f2575a712d90da88
Production task: 085 — WorkflowRun and Task canonical state

## Purpose

Implement the persistence-neutral canonical WorkflowRun and Task state model on top of Task 084 graph contracts, without taking ownership of PostgreSQL persistence, transactional admission/outbox, leasing/fencing, retries, checkpoints, human approvals, schedules, compensation or side-effect reconciliation.

## Exact owned paths

- `docs/workstreams/workflow-run-task-state.md`
- `docs/WORKFLOW-RUN-TASK-STATE.md`
- `packages/workflows/src/run-model.ts`
- `packages/workflows/src/run-state.ts`
- `packages/workflows/src/run-state.test.ts`

## Coordinated shared seam

- `packages/workflows/src/index.ts` — append-only export of Task 085 modules after Task 084 exports. No modification to Task 084 graph exports or behavior.

## Explicit non-ownership

This workstream does not modify:

- Task 084 graph/model implementation files
- `packages/agents/**`
- `packages/decisions/**`
- `packages/contracts/**`
- PostgreSQL adapters or migrations
- Gateway/mobile/channel paths
- Commerce/billing/crypto/provider paths
- root configuration, workspace configuration or lockfiles
- canonical production task/progress documents
- any file owned by active PRs #44, #89-#104 except the explicitly coordinated stacked export seam above

## Acceptance target

Define immutable WorkflowRun and Task snapshots, legal state machines, deterministic transition guards, version/graph pinning, parent/root task lineage, bounded failure/attention metadata and terminal-state invariants. Unit tests must reject illegal transitions, identity mutation, stale revision application, invalid lineage and terminal rewrites.

This claim does not own Task 086 transactional admission/outbox or any persistence implementation, and does not mark Task 085 complete without repository verification evidence.
