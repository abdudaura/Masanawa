# Workstream claim — workflow-version-graph

Status: implementation complete; shared integration/check evidence pending
Owner: this isolated workstream
Started: 2026-10-04 19:26 Africa/Lagos
Base: main @ 3906419669203844018b6687ad06ab2af48654eb
Production task: 084 — Workflow and immutable WorkflowVersion graph model

## Purpose

Implement the persistence-neutral canonical Workflow/WorkflowVersion graph value model without taking ownership of WorkflowRun/Task state, PostgreSQL persistence, Agent runtime, Gateway, channels, Commerce, providers, devices or deployments.

## Exact owned paths

- `docs/workstreams/workflow-version-graph.md`
- `docs/WORKFLOW-VERSION-GRAPH.md`
- `packages/workflows/README.md`
- `packages/workflows/package.json`
- `packages/workflows/tsconfig.json`
- `packages/workflows/tsconfig.build.json`
- `packages/workflows/src/index.ts`
- `packages/workflows/src/model.ts`
- `packages/workflows/src/graph.ts`
- `packages/workflows/src/graph.test.ts`

New WorkflowRun/Task implementation files are explicitly released for a stacked Task 085 claim. Shared package export/manifest files above remain owned here and must be coordinated rather than edited by the stacked workstream.

## Explicit non-ownership

This workstream does not modify:

- `packages/agents/**`
- `packages/decisions/**`
- `packages/contracts/**`
- PostgreSQL adapters or migrations
- Gateway/mobile/channel paths
- Commerce/billing/crypto/provider paths
- root configuration, workspace configuration or lockfiles
- canonical production task/progress documents
- any file owned by active PRs #44, #89-#103

## Acceptance target

Define immutable Workflow and WorkflowVersion graph contracts with deterministic normalization, structural validation, stable graph signatures, bounded nodes/edges, explicit entry points and safe executor references. Unit tests must reject dangling edges, duplicate keys, unreachable nodes where disallowed, malformed cycles under the selected graph policy, oversized graphs and post-admission mutation.

This claim does not own WorkflowRun/Task state (Task 085+) and does not mark Task 084 complete without repository verification evidence.


## Implementation handoff

Implemented on branch `work/workflow-version-graph-20261004` in draft PR #105.

The package now provides:

- immutable tenant-scoped Workflow identity;
- immutable WorkflowVersion with positive version numbers;
- bounded normalized graph values;
- explicit entry nodes and terminal sinks;
- executor, decision, wait, join and terminal node kinds;
- pinned SkillVersion, ToolVersion, WorkflowVersion, agent-strategy and system executor refs;
- sequential, fan-out, fan-in and conditional graph composition;
- host-independent canonical ordering;
- deterministic SHA-256 graph signatures;
- acyclic v1 validation;
- duplicate/dangling/unreachable/root/sink/join/decision validation;
- direct self-subworkflow rejection;
- mutation-resistant snapshots and focused unit tests.

Shared integration dependency: this new workspace package requires a
`packages/workflows` importer in `pnpm-lock.yaml`. This claim deliberately
does not own that shared file because active PR #98 already modifies it.
Coordination has been posted on #98.

Hosted Foundation CI run `37225219216`, job `111503365191`, failed before
checkout with `runner_id=0` and zero steps. No install, typecheck, test or build
result is claimed.
