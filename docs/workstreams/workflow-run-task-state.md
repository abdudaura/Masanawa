# Workstream claim — workflow-run-task-state

Status: implementation complete; verification evidence pending
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


## Implementation handoff

Implemented on branch `work/workflow-run-task-state-20261004` in draft PR #106.

The package now provides:

- immutable WorkflowRun and Task snapshots;
- optimistic revision guards;
- explicit legal WorkflowRun and Task transition tables;
- exact WorkflowVersion/graph pinning;
- Task-to-run binding checks;
- actual parent/child lineage verification;
- bounded root/child depth semantics;
- wait/failure/cancellation metadata invariants;
- terminal-state rewrite rejection;
- pre-start cancellation without fabricated start timestamps;
- preservation of original Task start time across wait → ready → running;
- timestamp chronology validation;
- runtime rejection of unsupported states and malformed graph signatures;
- focused unit coverage for legal and illegal transitions.

Task 086+ persistence/admission/outbox/lease/retry/checkpoint/approval/schedule
semantics remain explicitly out of scope.

The shared package manifest/lockfile dependency is inherited from stacked PR #105;
this workstream does not add another manifest or lockfile edit.
