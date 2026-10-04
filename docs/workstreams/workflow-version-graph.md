# Workstream claim — workflow-version-graph

Status: active
Owner: this isolated workstream
Started: 2026-10-04 19:26 Africa/Lagos
Base: main @ 3906419669203844018b6687ad06ab2af48654eb
Production task: 084 — Workflow and immutable WorkflowVersion graph model

## Purpose

Implement the persistence-neutral canonical Workflow/WorkflowVersion graph value model without taking ownership of WorkflowRun/Task state, PostgreSQL persistence, Agent runtime, Gateway, channels, Commerce, providers, devices or deployments.

## Exact owned paths

- `docs/workstreams/workflow-version-graph.md`
- `docs/WORKFLOW-VERSION-GRAPH.md`
- `packages/workflows/**`

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
