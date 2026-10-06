# Twin negative-balance and reversal recovery — TWIN-092

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/twin-negative-balance-recovery-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/TWIN-TRANSFORMATION-TASKS.md` — **TWIN-092** chargeback/refund negative-balance/recovery policy.
- Existing `packages/security/src/twin-economy-earnings.ts` remains canonical for withdrawability holds.

## Owned paths
- `packages/security/src/twin-economy-recovery.ts` (new)
- `packages/security/src/twin-economy-recovery.test.ts` (new)
- `docs/workstreams/twin-negative-balance-recovery-20261006.md`

## Excluded/shared paths
- No edits to Commerce ledger/state machine, PostgreSQL repositories, migrations, Gateway composition, Events, mobile app, production environment, or PR #136-owned files.
- No edit to `packages/security/src/index.ts` in this isolated slice; export/composition remains an integration handoff.

## Dependencies
- Canonical ledger/persistence owner supplies actual available/pending earnings and confirmed reversal exposure.
- Existing abuse/rate-limit and earnings-hold Security modules remain authoritative and are not duplicated.

## Current state
CLAIMED. Implement deterministic recovery policy for confirmed reversal exposure that exceeds available/pending creator earnings, including held earnings, negative recovery balance, future-earning offset, account restriction thresholds, and fail-closed manual-review states.