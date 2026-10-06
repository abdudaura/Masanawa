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

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed implementation

- added bounded, versioned evaluation datasets;
- cases reference canonical AgentRun/WorkflowRun/Operation IDs or named fixtures rather than embedding raw prompt/private content;
- each case carries a SHA-256 evidence hash plus explicit required/forbidden tags and optional latency/cost ceilings;
- observations are normalized and bounded with output fingerprints;
- deterministic case evaluator reports typed failures;
- dataset runner processes canonical case ordering and returns pass/fail summary;
- baseline-vs-candidate comparison classifies regressions, recoveries, unchanged failures and unchanged passes;
- newly failing cases are the only regression gate;
- evaluation results are evidence only and confer no runtime authority or promotion.

## Remaining integration dependencies

1. Telemetry barrel owner must append the evaluation export when ownership is available.
2. Trace producers must provide privacy-safe canonical run/operation references and evidence hashes.
3. Task 143 may consume evaluation results as promotion evidence but must not self-promote candidates.
4. durable dataset/run storage and CI dataset execution remain integration-owner work.

Implementation head before handoff: `bd929fe5bd139e11988c62a746bebcd38f8b69c8`.

Last update: 2026-10-06.
