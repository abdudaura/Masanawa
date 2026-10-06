# Twin commission retry recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-commission-retry-recovery-20261006`
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

State: CLAIMED.

Last update: 2026-10-06.
