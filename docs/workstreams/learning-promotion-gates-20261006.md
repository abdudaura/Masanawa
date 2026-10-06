# Candidate optimization/learning promotion gates — Task 143

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/learning-promotion-gates-20261006`
Base SHA: `873b89e4667a85a2d66acc746200e97b62794b97` (Task 142 exact head / PR #272)
Implementation head: `01fa536a2b139429160a3840be607bcdf8e69e2b`
PR: #273

## Completed implementation
- Added schema-versioned optimization candidate proposals with exact target/base/candidate revision binding.
- Candidates must advance revision; they cannot mutate an existing revision in place.
- Candidate promotion is bound to an exact evaluation dataset key/version.
- Added minimum evidence, maximum failure, full-evaluation-pass and zero-regression gates.
- Current production revision must still equal the candidate baseline at decision time; stale candidates fail closed.
- Added explicit reviewer/AuthorityContext decision evidence.
- Even perfect telemetry cannot self-promote when review denies or is not approved.
- Promotion output is a decision only; no Agent/Skill/Provider/Workflow production state is mutated here.
- Added root contract tests for stale baseline, dataset mismatch, insufficient/failing evidence, regression rejection and explicit review gating.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/learning-promotion-gates-20261006.md`
2. `packages/telemetry/src/promotion.ts`
3. `tests/contracts/learning-promotion-gates.test.ts`

No production mutation, model-training execution, Agent/Skill/Provider/Workflow configuration writes, repositories, migrations, package manifests/lockfile or deployment config changed.

## Verification
Foundation CI run `37469064359`, job `112287469227` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. This is not recorded as a pass and is not application-failure evidence.

## Remaining dependencies
- PR #272 / Task 142 integrates first.
- Security/Ops owner supplies authorized promotion review.
- Actual production updates remain canonical domain/runtime owner work and must revalidate revision at write time.
- Task 144 still owns plugin isolation/no-silent-self-mutation acceptance.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
