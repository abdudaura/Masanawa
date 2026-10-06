# Twin paid-voice retry recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-paid-voice-retry-recovery-20261006`
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

State: CLAIMED.

Last update: 2026-10-06.
