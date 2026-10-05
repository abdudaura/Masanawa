# Harness metered inference evidence — 2026-10-05

Owner/window: ChatGPT Harness metering continuation.
Branch: `work/harness-metered-inference-20261005`
Base: PR #187 head `cf3296b51aacb05121a814db1f97a5e91db4d246`

Purpose: add provider-neutral verified inference usage evidence so AgentRun budgets can record actual token/cost usage instead of treating estimates as truth.

## Exact owned paths

- `docs/workstreams/harness-metered-inference.md`
- `packages/agents/src/inference-usage.ts`
- `packages/agents/src/inference-usage.test.ts`
- append-only export in `packages/agents/src/index.ts`

## Boundaries

- no shared `strategy.ts` edit;
- no provider adapter edit;
- no Gateway/mobile/channel edit;
- no database/migration edit;
- no billing/Commerce settlement;
- estimated usage is preflight-only and is never accepted as actual usage evidence.

## Acceptance

- provider-neutral evidence carries input/output tokens, cost micros, currency and observation time;
- evidence source must be provider-reported or platform-metered;
- negative/non-safe/non-finite values fail closed;
- currency normalized/bound;
- evidence converts exactly into AgentRun inference usage delta;
- recording actual evidence reuses canonical execution-budget accounting;
- wrong currency or exhausted budget still fails through the existing budget contract;
- metered provider interface remains additive and does not alter legacy AgentInferenceProvider.

Status: active.
