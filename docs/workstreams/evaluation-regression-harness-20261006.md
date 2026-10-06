# Trace/evaluation datasets and regression harness — Task 142

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/evaluation-regression-harness-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 142 — trace/evaluation datasets and regression harness.

## Coordination

No competing Task 142 implementation claim was found at selection. Task 143 learning/promotion remains separate and is explicitly excluded.

## Exact owned paths

- `docs/workstreams/evaluation-regression-harness-20261006.md`
- `packages/telemetry/src/evaluation.ts`
- `packages/telemetry/src/evaluation.test.ts`

## Explicitly excluded/shared paths

- `packages/telemetry/src/index.ts`
- runtime prompt/content logging
- Agent/Workflow/Provider implementation files
- Task 143 optimization/promotion
- storage migrations/adapters
- Gateway/Worker/Ops composition
- lockfile/root workspace config

## Acceptance target

- versioned bounded evaluation datasets;
- cases reference canonical AgentRun/WorkflowRun/Operation or named fixture evidence without embedding raw prompt/private content;
- expected outcome tags, forbidden tags, latency and cost ceilings are explicit;
- observations are normalized and deterministic;
- harness produces case-level pass/fail + dataset summary;
- baseline-vs-candidate comparison classifies newly failing cases as regressions;
- no evaluation result grants runtime authority or self-promotes changes.

State: CLAIMED.

Last update: 2026-10-06.
