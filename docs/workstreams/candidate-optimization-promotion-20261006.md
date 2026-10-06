# Candidate optimization / learning promotion gates — Task 143 — 2026-10-06

Status: active isolated evaluation/learning slice
Owner/window: ChatGPT continuation window
Branch: `work/candidate-optimization-promotion-20261006`
Base: Task 142 PR #272 @ `873b89e4667a85a2d66acc746200e97b62794b97`

## Exact owned paths

- `packages/telemetry/src/optimization.ts` (new)
- `packages/telemetry/src/optimization.test.ts` (new)
- `docs/CANDIDATE-OPTIMIZATION-PROMOTION.md` (new)
- `docs/workstreams/candidate-optimization-promotion-20261006.md`

## Boundaries

- no shared telemetry barrel while Task 142 ownership remains separate;
- no Agent/Workflow/Skill/Provider production mutation;
- no Gateway/Ops/storage/migration/CI configuration;
- candidate payloads are referenced by immutable content hashes/keys, not embedded private prompts;
- evaluation evidence is consumed from Task 142;
- no candidate may self-approve or self-promote.

## Goal

Implement:
- bounded candidate identity/version/base-revision metadata;
- proposal -> evaluated -> approved -> promoted/rejected lifecycle;
- promotion gate over same Task-142 dataset/version and exact candidate evidence;
- zero-new-regression default;
- optional requirement that the full candidate dataset passes;
- explicit approval evidence from an authorized human/operator boundary;
- stale revision and changed-evidence replay rejection;
- promotion output as evidence only, never a side effect.
