# Candidate optimization/learning promotion gates — Task 143

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/learning-promotion-gates-20261006`
Base SHA: `873b89e4667a85a2d66acc746200e97b62794b97` (Task 142 exact head / PR #272)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **143** Implement candidate optimization/learning pipeline with promotion gates.
- `docs/SOURCE-OWNERSHIP.md` — learning/traces are gated; telemetry/learning never self-promotes production truth.

## Owned paths
- `packages/telemetry/src/promotion.ts` (new)
- `tests/contracts/learning-promotion-gates.test.ts` (new)
- `docs/workstreams/learning-promotion-gates-20261006.md`

## Excluded/shared paths
- No production mutation, Agent/Skill/Provider/Workflow configuration writes, model fine-tuning jobs, repositories, migrations, package manifests/lockfile or deployment config.
- Evaluation data never grants deployment authority.

## Dependencies
- Task 142 evaluation dataset/run/regression evidence from PR #272.
- Security/Ops owner later supplies authorized promotion review and performs any actual production change.

## Current state
CLAIMED. Implement normalized optimization proposals, exact baseline/candidate revision binding, evaluation/regression gates, minimum evidence thresholds, explicit authorized review, and deterministic promotion decisions that never mutate production state.