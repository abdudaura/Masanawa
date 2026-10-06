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

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed implementation

- immutable LearningCandidate identity by target kind/key/base version/content hash;
- proposed -> evaluating transition with stale-revision protection;
- promotion assessment requires same-dataset baseline/candidate evaluation evidence from Task 142;
- candidate evaluation itself must pass;
- comparison must contain zero new regressions;
- certification and rehearsal evidence are independently required, revisioned, SHA-256 evidence-backed and bound to the exact candidate fingerprint/content hash;
- any failed gate produces terminal rejected candidate evidence;
- all gates passing produces an eligible candidate plus bounded promotion proposal only;
- proposal contains no publication action, runtime authority or self-mutation behavior;
- rejected/eligible candidates cannot be silently reassessed as though still evaluating.

## Remaining integration dependencies

1. Telemetry barrel owner must export learning/evaluation surfaces when ownership is available.
2. Certification and rehearsal owners must provide durable, independently verified gate evidence.
3. A separate governed publisher may consume an eligible proposal to create a new immutable Prompt/Strategy/Skill version.
4. Task 144 acceptance should prove plugins/learning cannot bypass these gates.
5. storage/worker/ops composition remains integration-owner work.

Implementation head before handoff: `1a74083d2a08080319b9e0830ddd53faecb0196c`.

Last update: 2026-10-06.
