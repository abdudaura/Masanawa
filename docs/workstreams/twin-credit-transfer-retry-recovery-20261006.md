# Twin Credit-transfer retry recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-credit-transfer-retry-recovery-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-106 — crashes/retries do not duplicate money or sessions.

## Exact owned paths

- `docs/workstreams/twin-credit-transfer-retry-recovery-20261006.md`
- `tests/recovery/twin-credit-transfer-retry-acceptance.test.ts`

## Explicitly excluded/shared paths

- PR #136 Gateway/mobile/router/chat/APK/production paths
- Commerce source/repository/index/Postgres/migrations
- Events/Activity/Wallet production composition
- billing/crypto providers and production environment
- TWIN-102 acceptance PR #287 files
- TWIN-106 owner-access PR #288 and paid-voice PR #291 files

## Acceptance slice

- exact Credit transfer retry under the same request/fingerprint applies sender debit and recipient credit once;
- changed payload under the same request identity fails closed;
- internal-transfer provenance and commission-ineligible status remain stable on replay;
- crash after transfer effect but before caller acknowledgement does not duplicate balances;
- append-only reversal uses a distinct reversal request identity and applies once;
- reversal retry is idempotent, changed reversal identity does not mutate original receipt.

State: CLAIMED.

Last update: 2026-10-06.
