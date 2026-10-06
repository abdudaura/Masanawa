# Twin negative-balance and reversal recovery — TWIN-092

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/twin-negative-balance-recovery-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Implementation commit: `39c51733abc31b63ed0f1f1f1a70072ddbddc23a`
PR: #225

## Task references
- `docs/TWIN-TRANSFORMATION-TASKS.md` — **TWIN-092** chargeback/refund negative-balance/recovery policy.
- Existing `packages/security/src/twin-economy-earnings.ts` remains canonical for withdrawability holds.

## Owned paths
- `packages/security/src/twin-economy-recovery.ts`
- `packages/security/src/twin-economy-recovery.test.ts`
- `docs/workstreams/twin-negative-balance-recovery-20261006.md`

## Excluded/shared paths
- No edits to Commerce ledger/state machine, PostgreSQL repositories, migrations, Gateway composition, Events, mobile app, production environment, or PR #136-owned files.
- No edit to `packages/security/src/index.ts`; export/composition remains an integration handoff.

## Completed implementation
- Added deterministic recovery decisions for confirmed chargeback/refund reversal exposure.
- Recovery consumes available creator earnings first, then holds pending earnings, then creates an explicit negative recovery balance only for uncovered exposure.
- Added configurable manual-review and hard account-restriction thresholds.
- Added future-earning offset policy and a deterministic offset helper that never creates negative values.
- Existing negative balances carry forward into subsequent reversal calculations.
- Policy fails closed to manual review/account restriction when uncovered exposure exists but future offset is disabled.
- No ledger mutation is performed by Security; this module returns policy decisions only.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/twin-negative-balance-recovery-20261006.md`
2. `packages/security/src/twin-economy-recovery.ts`
3. `packages/security/src/twin-economy-recovery.test.ts`

No Commerce/Gateway/mobile/Event/migration/production files changed.

## Verification
GitHub Actions Foundation CI run `37453171761`, job `112234323624` ended `failure` with `steps = null`. Checkout/install/typecheck/tests never executed. This is explicitly not recorded as a pass and is not evidence of an application-code failure.

## Remaining dependencies
- Security package integration owner: export the new module through the canonical Security package surface after collision review.
- Commerce/persistence owner: persist recovery balance and apply returned offsets atomically with canonical ledger/reversal operations.
- Gateway/admin owner: expose restriction/manual-review outcomes only through existing authorized policy/admin paths.
- Production acceptance owner: prove chargeback/refund reversal, restart/retry idempotency, future earning recovery and withdrawal blocking end to end.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
