# Twin gift retry recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-gift-retry-recovery-20261006`
PR: #293
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

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed acceptance evidence

- exact gift retry under the same request identity applies sender debit and owner credit once;
- simulated crash after executor effect but before caller acknowledgement does not duplicate balances;
- changed amount under the same request identity fails closed;
- replay preserves resolved owner, recipient Character, `reason=gift` execution semantics and no-acquisition-commission receipt semantics;
- non-personal Character and self-gift rejection occur before any executor effect;
- no production Gift, Commerce, Wallet, Event or Gateway source was modified.

## Remaining production dependencies

1. production Gift executor must persist request fingerprint + receipt atomically with ledger movement;
2. Gift Wallet/Activity/Event emission must replay from the same canonical receipt;
3. shared production composition remains #136/integration-owner work;
4. executable CI and persistent-storage crash/restart evidence remain required.

Implementation head before handoff: `aab7ad96f276f6e75be604d8803505c5be23e07a`.

Last update: 2026-10-06.

## Verification

- PR #293 is mergeable. CI failed before checkout with runner_id=0 and steps=[].
