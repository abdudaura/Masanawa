# Twin commission retry recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-commission-retry-recovery-20261006`
PR: #294
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-106 — crashes/retries do not duplicate money or sessions.

## Exact owned paths

- `docs/workstreams/twin-commission-retry-recovery-20261006.md`
- `tests/recovery/twin-commission-retry-acceptance.test.ts`

## Explicitly excluded/shared paths

- PR #136 Gateway/mobile/router/chat/APK/production ownership
- Commerce attribution/settlement source and repositories
- canonical ledger/Postgres/migrations
- billing/crypto provider hooks
- TWIN-101 acceptance PR #238 files
- other TWIN-106 recovery PRs #288/#291/#292/#293

## Acceptance slice

- eligible commission decision posts owner earning once under stable attribution + operation identity;
- crash after ledger effect but before caller acknowledgement is safe on exact retry;
- changed base amount/policy/owner/Character under the same settlement identity fails closed;
- ineligible/self/internal-transfer decisions never reach the economic posting boundary;
- refund/reversal recovery remains append-only and cannot over-reverse the original settled commission.

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed acceptance evidence

- eligible acquisition/commerce commission posts owner earning once under stable settlement identity;
- simulated crash after earning post but before caller acknowledgement is safe on exact retry;
- changed base amount/settlement fingerprint under the same settlement identity fails closed;
- self-attribution and internal-transfer decisions remain ineligible and cannot reach the posting boundary;
- partial commission reversal is append-only and independently idempotent;
- exact reversal retry does not double-clawback;
- over-reversal beyond remaining settled commission fails closed;
- no Commerce source/repository, ledger, provider or production integration path changed.

## Remaining production dependencies

1. canonical settlement repository must persist settlement/reversal fingerprints atomically with ledger entries;
2. provider-success funding/purchase hooks must reuse stable attribution + operation identities;
3. refund/reversal integration must reconcile against the exact original settlement;
4. executable CI and persistent-storage crash/restart evidence remain required.

Implementation head before handoff: `2184d3ccf8de6fce680b6b60853bab4beff1fa8b`.

Last update: 2026-10-06.

## Verification

- PR #294 is mergeable. No workflow run was exposed at final verification time; no executable pass is claimed.
