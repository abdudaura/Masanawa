# Twin paid-voice retry recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-paid-voice-retry-recovery-20261006`
PR: #291
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-106 — crashes/retries do not duplicate money or sessions.

## Exact owned paths

- `docs/workstreams/twin-paid-voice-retry-recovery-20261006.md`
- `tests/recovery/twin-paid-voice-retry-acceptance.test.ts`

## Explicitly excluded/shared paths

- PR #136 Gateway/mobile/router/chat/APK/production paths
- Commerce source/model/repository/index and migrations
- provider usage adapters
- canonical ledger/reservation stores
- production environment/credentials
- owner-access recovery PR #288 files

## Acceptance slice

This lane covers the paid-voice crash boundary only:

1. verified usage produces one canonical settlement decision;
2. economic effect is applied under the exact admission/settlement identity;
3. process crashes before the caller records local completion;
4. exact retry with identical admission + decision replays safely and does not duplicate charge, owner earning, platform revenue or refund;
5. changed retry payload under the same admission identity fails closed;
6. ambiguous usage never posts money and remains reconciliation-only;
7. trial usage retry consumes trial units once.

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed acceptance evidence

- exact verified-usage retry under the same admission identity posts paid settlement once;
- simulated crash after consequential settlement but before caller completion does not duplicate customer charge, owner earning, platform revenue or refund;
- same admission identity with changed verified usage/settlement fingerprint fails closed;
- ambiguous provider usage remains `reconcile` and cannot post economic effects;
- trial-covered usage consumes trial units once across the same crash/retry boundary;
- failed-before-media usage consumes no trial units and posts no monetary effect;
- no production ledger, reservation, Gateway, provider or Commerce source path was modified.

## Remaining production dependencies

1. production ledger/trial ports must enforce the same replay identity durably;
2. provider usage reconciliation must supply stable admission identity and exact usage evidence;
3. shared #136 composition must call replay-safe ports before marking voice settlement complete;
4. executable CI and production crash/restart evidence remain required.

Implementation head before handoff: `2ae0187514bf660b5c8172ab41fcec55a657024e`.

Last update: 2026-10-06.

## Verification

- PR #291 is mergeable. CI failed before checkout with runner_id=0 and steps=[].
