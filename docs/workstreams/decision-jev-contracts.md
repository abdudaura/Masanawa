# Workstream claim — decision-jev-contracts

Status: active
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
