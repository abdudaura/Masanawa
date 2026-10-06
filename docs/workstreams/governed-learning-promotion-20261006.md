# Candidate optimization/learning promotion gates — Task 143

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/governed-learning-promotion-20261006`
Base: Task 142 PR #272 @ `873b89e4667a85a2d66acc746200e97b62794b97`
Production task: 143 — candidate optimization/learning pipeline with promotion gates.

## Coordination

No competing Task 143 claim was found at selection. Task 142 evaluation evidence is the base dependency. Task 144 acceptance remains separate.

## Exact owned paths

- `docs/workstreams/governed-learning-promotion-20261006.md`
- `packages/telemetry/src/learning.ts`
- `packages/telemetry/src/learning.test.ts`

## Explicitly excluded/shared paths

- `packages/telemetry/src/index.ts`
- Skill/Agent/Prompt publication stores
- runtime self-modification
- certification/rehearsal implementations
- Gateway/Worker/Ops composition
- storage/migrations
- lockfile/root workspace files

## Acceptance target

- immutable candidate identity by target kind/key/base version + content hash;
- candidate can move proposed -> evaluating -> eligible/rejected only;
- promotion eligibility requires candidate evaluation run with zero regressions against same-dataset baseline;
- candidate run itself must pass;
- independent certification and rehearsal evidence must both pass and be content-hash bound;
- stale/mismatched evidence fails closed;
- result is a bounded promotion proposal only; publication remains an external owner action;
- rejected candidates cannot silently become eligible.

State: CLAIMED.

Last update: 2026-10-06.
