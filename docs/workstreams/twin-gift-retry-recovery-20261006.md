# Twin gift retry recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-gift-retry-recovery-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-106 — crashes/retries do not duplicate money or sessions.

## Exact owned paths

- `docs/workstreams/twin-gift-retry-recovery-20261006.md`
- `tests/recovery/twin-gift-retry-acceptance.test.ts`

## Explicitly excluded/shared paths

- PR #136 Gateway/mobile/router/chat/APK/production ownership
- existing Gift service/resolver source
- Commerce repositories/model/index/Postgres/migrations
- Event/Wallet/Activity production composition
- TWIN-103 acceptance PR #229 files
- TWIN-106 owner-access #288, paid-voice #291 and Credit-transfer #292 files

## Acceptance slice

- canonical gift request resolves the same personal-Twin owner on retry;
- replay-safe executor applies sender debit/owner credit once under the exact request identity;
- crash after executor effect but before GiftService receipt return does not duplicate balances;
- changed payload under the same gift request identity fails closed;
- replay preserves reason=gift, recipient Character and no-acquisition-commission semantics;
- self-gift/non-personal destination remains rejected before any executor effect.

State: CLAIMED.

Last update: 2026-10-06.
