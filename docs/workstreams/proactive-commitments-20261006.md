# Promises, commitments and follow-up triggers — Task 114 — 2026-10-06

Status: active stacked proactivity slice
Owner/window: ChatGPT continuation window
Branch: `work/proactivity-commitments-20261006`
Base: Task 113 PR #323 @ `f8387c2ee39527710b41fb366402276a5182208e`

## Exact owned paths

- `packages/proactivity/src/commitment.ts` (new)
- `packages/proactivity/src/commitment.test.ts` (new)
- `packages/proactivity/src/index.ts` (append-only export on stacked branch)
- `docs/PROACTIVE-COMMITMENTS.md` (new)
- `docs/workstreams/proactive-commitments-20261006.md`

## Boundaries

- no Gateway/worker/scheduler/storage/migrations/mobile/deployment;
- no World canon/routine mutation;
- no Task 115 quiet-hours/frequency/privacy policy;
- no Tool/Provider/credential/action authority;
- follow-up compilation may create only Task-113 trigger definitions.

## Goal

Represent Relationship-scoped promises/commitments with:
- exact responsible party (Character or User);
- bounded human-readable obligation;
- explicit due condition (time, event, or manual);
- revision/state lifecycle;
- fulfillment/cancellation custody;
- deterministic follow-up trigger compilation for time/event due conditions;
- terminal fulfilled/cancelled semantics with no silent resurrection.
