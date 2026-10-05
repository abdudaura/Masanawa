# Harness bounded subworkers — 2026-10-05

Owner/window: ChatGPT harness subworker continuation.
Branch: `work/harness-subworkers-20261005`
Base: PR #151 head `33b4fbff2f0bf455417c5299c7b85ebca5358ba8`

## Exact owned paths

- `docs/workstreams/harness-subworkers.md`
- `packages/agents/src/subworker.ts`
- `packages/agents/src/subworker.test.ts`
- append-only export in `packages/agents/src/index.ts`

## Boundaries

- no Gateway/mobile composition;
- no billing/crypto/Commerce state;
- no direct Tool/provider dispatch;
- no new user-visible Character/personality;
- no authority widening;
- child runs receive zero inherited approvals and must pass an injected non-financial/non-approval policy;
- child runs preserve root/parent lineage plus Task/Workflow trace custody;
- depth and fan-out are bounded.

Status: active.
