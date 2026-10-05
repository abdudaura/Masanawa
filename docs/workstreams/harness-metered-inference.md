# Harness metered inference evidence — 2026-10-05

Owner/window: ChatGPT Harness metering continuation.
Branch: `work/harness-metered-inference-20261005`
Base: PR #187 head `cf3296b51aacb05121a814db1f97a5e91db4d246`
PR: #188

Purpose: add provider-neutral verified inference usage evidence so AgentRun budgets can
record actual token/cost usage instead of treating estimates as truth.

## Exact owned paths

- `docs/workstreams/harness-metered-inference.md`
- `packages/agents/src/inference-usage.ts`
- `packages/agents/src/inference-usage.test.ts`
- append-only export in `packages/agents/src/index.ts`

No shared `strategy.ts`, provider adapter, Gateway/mobile/channel, persistence/migration,
billing or Commerce files are owned.

## Implemented

- additive `MeteredAgentInferenceProvider` / `MeteredAgentInferenceResult` interfaces;
  the legacy `AgentInferenceProvider` remains unchanged;
- trusted actual-usage sources are only:
  - `provider-reported`
  - `platform-metered`;
- estimated usage is not an accepted actual-usage source;
- actual evidence carries:
  - input tokens;
  - output tokens;
  - provider-cost micros;
  - three-letter cost currency;
  - opaque bounded `evidenceRef`;
  - observation time;
  - optional pricing revision under strict source rules;
- `platform-metered` usage requires a non-empty pricing revision because the platform is
  claiming responsibility for cost calculation;
- `provider-reported` usage must not pretend a platform pricing revision exists;
- unknown fields are rejected;
- negative/fractional/unsafe token and cost values fail closed;
- evidence is converted exactly to the existing AgentRun `InferenceUsageDelta`;
- `recordVerifiedInferenceUsage()` delegates to canonical #184 budget accounting, so
  wrong currency, stale observation time and budget exhaustion retain the same failure
  semantics.

The evidence reference is intentionally opaque. It can point to provider request/response
metering evidence or a platform metering event without putting raw provider payloads,
prompts, secrets or credentials into the budget contract.

## Verification

- implementation before provenance hardening: `de966ca4eb0ffe297d3764aa16d683bbafe6915b`;
- provenance hardening: `24d071a7d379bd06ca5b5bbba3ab8eb6430faa89`;
- provenance test update: `cb521b0ee425dfd55af53f8b17bd493bfec7fa8a`;
- earlier branch audit was 4 commits ahead and 0 behind PR #187 head before the latest
  provenance commits;
- Foundation CI run `37305800921` failed before executing any step; job
  `111749065225` exposes `steps: null`. This is hosted runner non-execution, not a
  TypeScript/test verdict;
- focused tests cover trusted sources, estimated-source rejection, numeric bounds,
  exact delta conversion, canonical budget recording, currency mismatch, exhaustion,
  evidenceRef requirement, pricing-revision source rules and unknown-field rejection.

## Integration handoff

- provider adapters that expose trustworthy native usage may implement
  `MeteredAgentInferenceProvider` and use source `provider-reported`;
- platform adapters that deterministically meter usage/cost may use
  `platform-metered` only with an explicit pricing revision;
- preflight estimates continue to use #184 inference-budget preflight only;
- post-inference actual consumption uses this evidence seam;
- durable budget storage must key/idempotently reconcile actual usage using evidenceRef
  before an inference result is treated as fully accounted;
- mobile/WhatsApp/Telegram never report trusted token/cost usage.

Implementation: evidence contract complete.
Deployment: not claimed.
