# Workstream claim — decision-jev-contracts

Status: implementation complete; shared integration/check evidence pending
Owner: this isolated workstream
Started: 2026-10-04 19:26 Africa/Lagos
Base: main @ 3906419669203844018b6687ad06ab2af48654eb
Production task: 083 — bounded typed Decision/JEV contracts

## Purpose

Implement the first canonical, persistence-neutral decision boundary for durable workflows without touching Agent runtime, Gateway, channels, Commerce, provider, mobile, database migration or deployment ownership.

## Exact owned paths

- `docs/workstreams/decision-jev-contracts.md`
- `docs/DECISION-JEV-CONTRACTS.md`
- `packages/decisions/**`

## Explicit non-ownership

This workstream does not modify:

- `packages/agents/**`
- `packages/workflows/**`
- `packages/contracts/**`
- Gateway, mobile or channel paths
- Commerce/billing/crypto/provider paths
- PostgreSQL migrations or adapters
- root configuration, workspace configuration or lockfiles
- canonical production task/progress documents
- any file owned by active PRs #44, #89-#101

## Acceptance target

The package must define bounded immutable Decision/JEV value contracts, deterministic validation/normalization helpers and unit tests for malformed, oversized and mutation-prone inputs. It must not claim durable workflow persistence, runtime orchestration or completion of Task 083 until checks run and the canonical task owner advances it.


## Implementation handoff

Implemented on branch `work/decision-jev-contracts-20261004` in draft PR #103.

The package now provides:

- bounded immutable Decision/JEV definitions;
- closed-set choice, boolean `noul` and bounded score questions;
- deterministic host-independent normalization;
- bounded JSON-like request packets;
- canonical Tenant/request/correlation plus optional Task/WorkflowRun/Operation trace refs;
- exact request-to-schema binding;
- complete-answer validation;
- confidence/evidence bounds;
- mutation-resistant frozen snapshots;
- runtime rejection of malformed enum casts, non-plain objects, excessive depth/cardinality and non-finite numbers.

Shared integration dependency: the new workspace manifest requires a
`packages/decisions` importer in `pnpm-lock.yaml`. This claim deliberately
does not own that shared file because active PR #98 already modifies it.
Coordination has been posted on #98.

Hosted Foundation CI for this PR currently fails before checkout with no runner
allocated (`runner_id=0`, zero steps), so no install/typecheck/test/build result
is claimed yet.
